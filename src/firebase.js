import { getStorage } from "firebase/storage";
import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getMessaging } from "firebase/messaging";
import { getAnalytics, isSupported } from "firebase/analytics";
const firebaseConfig = {
  apiKey: "AIzaSyBaWoS-bvWh454kn_Dq1nkTEjHBNVQKohs",
  authDomain: "sugarcafe-9e54d.firebaseapp.com",
  projectId: "sugarcafe-9e54d",
  storageBucket: "sugarcafe-9e54d.firebasestorage.app",
  messagingSenderId: "417153769971",
  appId: "1:417153769971:web:e515c341086006be063286",
  measurementId: "G-GG7R7TGD7JD",
};
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const auth = getAuth(app);
export const storage = getStorage(app);
/* Google Analytics */
export let analytics = null;
if (typeof window !== "undefined") {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(console.error);
}
/* Firebase Cloud Messaging */
export const messaging = getMessaging(app);
export default app;
