import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC1V5SnMW9YQ3IvyhjYCpAsOFQky9mIKck",
  authDomain: "misn-service-app.firebaseapp.com",
  projectId: "misn-service-app",
  storageBucket: "misn-service-app.appspot.com",
  messagingSenderId: "769756513526",
  appId: "1:769756513526:web:7a0c6d5495060a88bf18d7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('openid');
googleProvider.addScope('email');
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, googleProvider, db, storage };
