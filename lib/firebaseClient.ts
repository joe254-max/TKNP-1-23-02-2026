import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "AIzaSyDXaON0Ie0ybYf2DPtYFQMftmodnwjGw4I",
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "studio-5321791587-6245a.firebaseapp.com",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "studio-5321791587-6245a",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "studio-5321791587-6245a.firebasestorage.app",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "362872819261",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || undefined,
};

if (!getApps().length) initializeApp(firebaseConfig as any);

export const db = getFirestore();

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
