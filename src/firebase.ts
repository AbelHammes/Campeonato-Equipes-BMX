import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, Database } from 'firebase/database';
import { CampeonatoData, Modalidade } from './types';

export const firebaseConfig = {
  apiKey: typeof atob !== "undefined" ? atob("QUl6YVN5QUZGeFIyVXROcVdpUkkxWml6M1NrN3cyMWppS1pDM3ZV") : "QUl6YVN5QUZGeFIyVXROcVdpUkkxWml6M1NrN3cyMWppS1pDM3ZV",
  authDomain: "system-bmx.firebaseapp.com",
  databaseURL: "https://system-bmx-default-rtdb.firebaseio.com",
  projectId: "system-bmx",
  storageBucket: "system-bmx.firebasestorage.app",
  messagingSenderId: "979293880216",
  appId: "1:979293880216:web:1c049f0faa71e284c5b5ed"
};

// Inicializa o Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const database: Database = getDatabase(app);

/**
 * Salva os dados de uma modalidade específica no Realtime Database do Firebase.
 * Estrutura: campeonatos/{eventID}/{modalidade}
 */
export async function salvarCampeonato(eventID: string, modalidade: Modalidade, data: CampeonatoData): Promise<void> {
  if (!eventID) return;
  const dbRef = ref(database, `campeonatos/${eventID}/${modalidade}`);
  await set(dbRef, data);
}

/**
 * Escuta atualizações em tempo real para uma modalidade específica.
 */
export function escutarCampeonato(
  eventID: string,
  modalidade: Modalidade,
  callback: (data: CampeonatoData | null) => void
): () => void {
  if (!eventID) return () => {};
  const dbRef = ref(database, `campeonatos/${eventID}/${modalidade}`);
  
  const unsubscribe = onValue(dbRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as CampeonatoData);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error("Erro na escuta do Firebase Realtime Database:", error);
  });

  return unsubscribe;
}
