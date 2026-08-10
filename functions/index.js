const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// ==========================================
// 1. FUNCIÓN PARA CREAR EL LINK DE PAGO ÚNICO
// ==========================================
exports.crearPreferenciaPago = functions.https.onRequest(async (req, res) => {
  // Configuración de cabeceras CORS para permitir llamadas desde tu app
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  try {
    const { prestamoId, cuotaId, usuarioId, monto, clienteNombre, numeroCuota } = req.body;

    if (!prestamoId || !cuotaId || !usuarioId || !monto) {
      return res.status(400).json({ error: "Faltan parámetros requeridos" });
    }

    // 1. Obtener el Access Token del prestamista desde Firestore
    const userDoc = await db.collection("usuarios").doc(usuarioId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Prestamista no encontrado" });
    }

    const userData = userDoc.data();
    const accessToken = userData.configMercadoPago?.accessToken;
    const estaActivo = userData.configMercadoPago?.activo;

    if (!accessToken || !estaActivo) {
      return res.status(400).json({ error: "El prestamista no tiene activado el cobro automático de Mercado Pago" });
    }

    // URL donde Mercado Pago avisará cuando el pago se apruebe
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    const webhookUrl = `https://us-central1-${projectId}.cloudfunctions.net/webhookMercadoPago?uid=${usuarioId}`;

    // 2. Crear la preferencia directamente en la API de Mercado Pago
    const preferenceData = {
      items: [
        {
          title: `Cuota #${numeroCuota || 1} - ${clienteNombre || "CobroApp"}`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: Number(monto)
        }
      ],
      external_reference: `${prestamoId}|${cuotaId}`,
      notification_url: webhookUrl,
      back_urls: {
        success: "https://cobroapp.com/pago-exitoso",
        failure: "https://cobroapp.com/pago-fallido"
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
      return res.status(500).json({ error: "Error al generar la preferencia de Mercado Pago" });
    }

    // Retornamos el link de pago generado
    return res.status(200).json({
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point
    });

  } catch (error) {
    console.error("Error en crearPreferenciaPago:", error);
    return res.status(500).json({ error: error.message });
  }
});


// ==========================================
// 2. WEBHOOK: RECIBE NOTIFICACIONES Y MARCA EN VERDE
// ==========================================
exports.webhookMercadoPago = functions.https.onRequest(async (req, res) => {
  try {
    const usuarioId = req.query.uid;
    const paymentId = req.query["data.id"] || req.body?.data?.id || req.query.id;
    const topic = req.query.type || req.body?.type || req.body?.action;

    // Solo procesamos eventos de tipo pago
    if ((topic === "payment" || topic === "payment.created") && paymentId && usuarioId) {
      
      // 1. Obtener Access Token del prestamista
      const userDoc = await db.collection("usuarios").doc(usuarioId).get();
      if (!userDoc.exists) return res.status(200).send("OK");

      const accessToken = userDoc.data().configMercadoPago?.accessToken;
      if (!accessToken) return res.status(200).send("OK");

      // 2. Consultar el estado real del pago en la API de Mercado Pago
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { "Authorization": `Bearer ${accessToken}` }
      });

      if (!paymentResponse.ok) return res.status(200).send("OK");
      const paymentData = await paymentResponse.json();

      // 3. Verificar si el pago fue APROBADO
      if (paymentData.status === "approved" && paymentData.external_reference) {
        const [prestamoId, cuotaId] = paymentData.external_reference.split("|");

        if (prestamoId && cuotaId) {
          const prestamoRef = db.collection("prestamos").doc(prestamoId);
          const prestamoDoc = await prestamoRef.get();

          if (prestamoDoc.exists) {
            const prestamo = prestamoDoc.data();
            let cambioEfectuado = false;

            // Actualizar el estado de la cuota específica
            const cuotasActualizadas = (prestamo.cuotasDetalle || []).map(c => {
              if (c.id === cuotaId && !c.pagado) {
                cambioEfectuado = true;
                return { ...c, pagado: true, montoPendiente: 0, fechaPagoAuto: new Date().toISOString() };
              }
              return c;
            });

            if (cambioEfectuado) {
              const todasPagadas = cuotasActualizadas.every(c => c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5));
              const updateData = { cuotasDetalle: cuotasActualizadas };

              if (todasPagadas) {
                updateData.estado = "finalizado";
                updateData.fechaFinalizacion = new Date().toISOString().split("T")[0];
              }

              // Guardar cambios en Firestore -> Inmediatamente la App lo pone en VERDE
              await prestamoRef.update(updateData);
              console.log(`✅ Cuota ${cuotaId} del préstamo ${prestamoId} acreditada automáticamente.`);
            }
          }
        }
      }
    }

    // Mercado Pago requiere una respuesta 200 para confirmar recepción
    return res.status(200).send("OK");

  } catch (error) {
    console.error("Error en Webhook Mercado Pago:", error);
    return res.status(200).send("OK"); // Respondemos 200 para evitar reintentos infinitos
  }
});