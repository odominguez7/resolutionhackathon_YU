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
  apiKey: "AIzaSyB_69EWVG034sXfa9ukiU4hz_COiykBuLE",
  authDomain: "resolution-hack.firebaseapp.com",
  projectId: "resolution-hack",
  storageBucket: "resolution-hack.firebasestorage.app",
  messagingSenderId: "471409463813",
  appId: "1:471409463813:web:e2e2c163dcc6ec40eb026c",
  measurementId: "G-GJ6HFQ29MX",
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
