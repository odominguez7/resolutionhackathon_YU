import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB_69EWVG034sXfa9ukiU4hz_COiykBuLE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "resolution-hack.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "resolution-hack",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "resolution-hack.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_ID || "471409463813",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:471409463813:web:e2e2c163dcc6ec40eb026c",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider("apple.com");

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signInWithApple = () => signInWithPopup(auth, appleProvider);
export const signOut = () => fbSignOut(auth);

export const getToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
};

export { onAuthStateChanged, type User };
