// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Pega aquí la configuración que copiaste de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCoFF99YGFehQbCUbXlrjGb25EbAGaCXdI",
    authDomain: "gestion-ventas-app-64f18.firebaseapp.com",
    projectId: "gestion-ventas-app-64f18",
    storageBucket: "gestion-ventas-app-64f18.firebasestorage.app",
    messagingSenderId: "273200916717",
    appId: "1:273200916717:web:db24c10e9e013b32af44e4"
  };

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar los servicios que usaremos
export const auth = getAuth(app);
export const db = getFirestore(app);