const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Variable global de base de datos
let db = null;

// Función para conectar a Firebase de forma segura
function conectarFirebase() {
  if (db) return db;

  try {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!rawServiceAccount) {
      console.error("❌ FALTA VARIABLE: FIREBASE_SERVICE_ACCOUNT no está configurada en Render.");
      return null;
    }

    let serviceAccount = typeof rawServiceAccount === 'string' 
      ? JSON.parse(rawServiceAccount) 
      : rawServiceAccount;

    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    db = admin.firestore();
    console.log("🔥 Conectado a Firestore con éxito");
    return db;
  } catch (error) {
    console.error("❌ Error de conexión a Firebase:", error.message);
    return null;
  }
}

// Intentar conectar al arrancar el servidor
conectarFirebase();

// ==========================================
// 1. RUTA: CREAR LINK DE PAGO MERCADO PAGO
// ==========================================
app.post('/crear-preferencia', async (req, res) => {
  try {
    const firestore = conectarFirebase();

    if (!firestore) {
      return res.status(500).json({ 
        error: "Error de credenciales en el servidor. Revisa la variable FIREBASE_SERVICE_ACCOUNT en Render." 
      });
    }

    const { prestamoId, cuotaId, usuarioId, monto, clienteNombre, numeroCuota } = req.body;

    const userDoc = await firestore.collection('usuarios').doc(usuarioId).get();
    if (!userDoc.exists) return res.status(404).json({ error: "Usuario prestamista no encontrado" });

    const userData = userDoc.data();
    const accessToken = userData.configMercadoPago?.accessToken;

    if (!accessToken) {
      return res.status(400).json({ error: "El prestamista no configuró su Access Token de Mercado Pago en la app." });
    }

    const serverUrl = process.env.SERVER_URL || `https://${req.get('host')}`;
    
    // Obtener la URL del frontend del cliente y redirigir a pago-exitoso.html
    const rawFrontendUrl = req.headers.origin || req.headers.referer || "https://google.com";
    const baseUrl = rawFrontendUrl.replace(/\/index\.html$/, '').replace(/\/$/, '');
    const successUrl = `${baseUrl}/pago-exitoso.html`;

    const preferenceData = {
      items: [{
        title: `Cuota #${numeroCuota || 1} - ${clienteNombre || "CobroApp"}`,
        quantity: 1,
        currency_id: "ARS",
        unit_price: Number(monto)
      }],
      external_reference: `${prestamoId}|${cuotaId}`,
      notification_url: `${serverUrl}/webhook-mp?uid=${usuarioId}`,
      back_urls: {
        success: successUrl,
        failure: successUrl,
        pending: successUrl
      },
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

    if (!mpResponse.ok) {
      console.error("Error Mercado Pago API:", mpData);
      return res.status(500).json({ error: mpData.message || "Error al generar preferencia en Mercado Pago" });
    }

    return res.json({ init_point: mpData.init_point });
  } catch (e) {
    console.error("Error en /crear-preferencia:", e);
    return res.status(500).json({ error: e.message });
  }
});

// ==========================================
// 2. RUTA: WEBHOOK DE MERCADO PAGO (PONE CUOTA EN VERDE)
// ==========================================
app.all('/webhook-mp', async (req, res) => {
  try {
    const firestore = conectarFirebase();
    if (!firestore) return res.status(200).send("OK");

    const usuarioId = req.query.uid;
    const paymentId = req.query["data.id"] || req.body?.data?.id || req.query.id;

    if (paymentId && usuarioId) {
      const userDoc = await firestore.collection('usuarios').doc(usuarioId).get();
      const accessToken = userDoc.data()?.configMercadoPago?.accessToken;

      if (accessToken) {
        const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { "Authorization": `Bearer ${accessToken}` }
        });

        const paymentData = await paymentRes.json();

        if (paymentData.status === "approved" && paymentData.external_reference) {
          const [prestamoId, cuotaId] = paymentData.external_reference.split("|");
          const prestamoRef = firestore.collection("prestamos").doc(prestamoId);
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