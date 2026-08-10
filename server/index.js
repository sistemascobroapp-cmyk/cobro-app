const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ==========================================
// 1. INICIALIZAR FIREBASE ADMIN
// ==========================================
try {
  let rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!rawServiceAccount) {
    throw new Error("La variable FIREBASE_SERVICE_ACCOUNT no existe en Render.");
  }

  // Parsear JSON
  const serviceAccount = typeof rawServiceAccount === 'string' 
    ? JSON.parse(rawServiceAccount) 
    : rawServiceAccount;

  // Corregir formato de los saltos de línea en la clave privada
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  } else {
    throw new Error("El JSON cargado no contiene la propiedad 'private_key'.");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log("🔥 Firebase Admin inicializado correctamente");
} catch (error) {
  console.error("❌ Error crítico al inicializar Firebase Admin:", error.message);
}

// ==========================================
// 2. RUTA 1: CREAR LINK DE PAGO MERCADO PAGO
// ==========================================
app.post('/crear-preferencia', async (req, res) => {
  try {
    const { prestamoId, cuotaId, usuarioId, monto, clienteNombre, numeroCuota } = req.body;

    const userDoc = await db.collection('usuarios').doc(usuarioId).get();
    if (!userDoc.exists) return res.status(404).json({ error: "Usuario no encontrado" });

    const accessToken = userDoc.data().configMercadoPago?.accessToken;
    if (!accessToken) return res.status(400).json({ error: "Token de MP no configurado" });

    const serverUrl = process.env.SERVER_URL || `https://${req.get('host')}`;

    const preferenceData = {
      items: [{
        title: `Cuota #${numeroCuota || 1} - ${clienteNombre || "CobroApp"}`,
        quantity: 1,
        currency_id: "ARS",
        unit_price: Number(monto)
      }],
      external_reference: `${prestamoId}|${cuotaId}`,
      notification_url: `${serverUrl}/webhook-mp?uid=${usuarioId}`,
      auto_return: "approved"
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preferenceData)
    });

    const mpData = await mpResponse.json();
    return res.json({ init_point: mpData.init_point });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ==========================================
// 3. RUTA 2: WEBHOOK (PONE LA CUOTA EN VERDE)
// ==========================================
app.all('/webhook-mp', async (req, res) => {
  try {
    const usuarioId = req.query.uid;
    const paymentId = req.query["data.id"] || req.body?.data?.id || req.query.id;

    if (paymentId && usuarioId) {
      const userDoc = await db.collection('usuarios').doc(usuarioId).get();
      const accessToken = userDoc.data()?.configMercadoPago?.accessToken;

      if (accessToken) {
        const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { "Authorization": `Bearer ${accessToken}` }
        });

        const paymentData = await paymentRes.json();

        if (paymentData.status === "approved" && paymentData.external_reference) {
          const [prestamoId, cuotaId] = paymentData.external_reference.split("|");
          const prestamoRef = db.collection("prestamos").doc(prestamoId);
          const prestamoDoc = await prestamoRef.get();

          if (prestamoDoc.exists) {
            const prestamo = prestamoDoc.data();
            let cambio = false;

            const cuotasActualizadas = (prestamo.cuotasDetalle || []).map(c => {
              if (c.id === cuotaId && !c.pagado) {
                cambio = true;
                return { ...c, pagado: true, montoPendiente: 0, fechaPagoAuto: new Date().toISOString() };
              }
              return c;
            });

            if (cambio) {
              const todasPagadas = cuotasActualizadas.every(c => c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5));
              const updateData = { cuotasDetalle: cuotasActualizadas };
              if (todasPagadas) {
                updateData.estado = "finalizado";
                updateData.fechaFinalizacion = new Date().toISOString().split("T")[0];
              }
              await prestamoRef.update(updateData);
              console.log(`✅ Cuota ${cuotaId} acreditada automáticamente.`);
            }
          }
        }
      }
    }
    return res.status(200).send("OK");
  } catch (e) {
    return res.status(200).send("OK");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));