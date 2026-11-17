import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// Pegá acá la configuración de tu app web:
// Firebase Console > Configuración del proyecto > Tus apps > Configuración del SDK
const firebaseConfig = {
  apiKey: "AIzaSyALLkuBSC8ZSNWfsr3XsnzOwZl64kL3OgQ",
  authDomain: "approl-ae9cb.firebaseapp.com",
  projectId: "approl-ae9cb",
  storageBucket: "approl-ae9cb.firebasestorage.app",
  messagingSenderId: "882791313715",
  appId: "1:882791313715:web:15d4127ff4de4b824d8e46"
};

export const db = getFirestore(initializeApp(firebaseConfig))
