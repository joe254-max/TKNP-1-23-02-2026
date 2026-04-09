import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "AIzaSyAXmz2Equo4nrBImMQb2gUQQr3gkvnWdb8",
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "studio-3375051386-348a4.firebaseapp.com",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "studio-3375051386-348a4",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "studio-3375051386-348a4.firebasestorage.app",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "777399671763",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || "1:777399671763:web:812446eae727e8bca96d26",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig as any);

export const db = getFirestore();
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
export async function signInWithGooglePopup() {
  return await signInWithPopup(auth, googleProvider);
}

export const signalsCollection = (classId: string) => collection(db, 'signals', classId, 'messages');
export const signalsQuery = (classId: string) => query(signalsCollection(classId), orderBy('createdAt'));
export const addSignal = async (classId: string, payload: any) => {
  return await addDoc(signalsCollection(classId), { ...payload, createdAt: serverTimestamp() });
};
export const listenSignals = (classId: string, onUpdate: (snap: any) => void) => {
  const q = signalsQuery(classId);
  return onSnapshot(q, onUpdate);
};
export const removeSignal = async (classId: string, docId: string) => {
  try { await deleteDoc(doc(db, 'signals', classId, 'messages', docId)); } catch { /* ignore */ }
};
