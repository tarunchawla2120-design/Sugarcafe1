import { getStorage } from "firebase/storage";
import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBaWoS-bvWh454kn_Dq1nkTEjHBNVQKohs",
  authDomain: "sugarcafe-9e54d.firebaseapp.com",
  projectId: "sugarcafe-9e54d",
  storageBucket: "sugarcafe-9e54d.firebasestorage.app",
  messagingSenderId: "417153769971",
  appId: "1:417153769971:web:e515c341086006be063286",
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
