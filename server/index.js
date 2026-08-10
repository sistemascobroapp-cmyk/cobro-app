const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Cargar credenciales de Firebase de forma segura
try {
  let rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!rawServiceAccount) {
    throw new Error("La variable FIREBASE_SERVICE_ACCOUNT está vacía o no existe.");
  }

  // Si la variable viene formateada con saltos de línea escapados, la limpiamos
  const serviceAccount = typeof rawServiceAccount === 'string' 
    ? JSON.parse(rawServiceAccount) 
    : rawServiceAccount;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log("🔥 Firebase Admin inicializado correctamente");
} catch (error) {
  console.error("❌ Error crítico al inicializar Firebase Admin:", error.message);
}