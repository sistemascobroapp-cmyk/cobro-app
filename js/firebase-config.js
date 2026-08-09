// CONFIGURACIÓN DE TU BASE DE DATOS Y AUTENTICACIÓN FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCJC4CuD9nIpM4aeB2CetEr67mcIcYQAKU",
  authDomain: "cobro-app-sistema.firebaseapp.com",
  projectId: "cobro-app-sistema",
  storageBucket: "cobro-app-sistema.firebasestorage.app",
  messagingSenderId: "113239643051",
  appId: "1:113239643051:web:45ba63588be2b8a91b38ee"
};

let db = null;
let auth = null;

try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
} catch (e) {
  console.warn("Error al inicializar Firebase:", e);
}