// app.js — gestione stanze Escape Room

// Import SDK Firebase (versione modulare)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot,
  collection, addDoc, serverTimestamp, getDocs, deleteDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// 🔑 Configurazione del tuo progetto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCfAhPh98-0eGuGYKZXROERgcUPWSxG6ww",
  authDomain: "escaperoom-7d744.firebaseapp.com",
  projectId: "escaperoom-7d744",
  storageBucket: "escaperoom-7d744.appspot.com", // correggi qui: deve finire in .appspot.com
  messagingSenderId: "682511578993",
  appId: "1:682511578993:web:8a78282082dddf0b23e8d0",
  measurementId: "G-WGFBG1M2CL"
};

// 🔥 Inizializza Firebase
export const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);

// Funzioni di supporto
const rndCode = () => Math.random().toString(36).slice(2,7).toUpperCase();

export async function createRoom(){
  const code = rndCode();
  const state = {
    code, createdAt: Date.now(),
    startTs: 0, durationMs: 50*60*1000,
    started:false, finished:false,
    scenarioIndex:0, stepIndex:0,
    rivalUid:null, playersCount:0,
    order: ['demo1','demo2'] // scenari di test
  };
  await setDoc(doc(db,'rooms',code), state);
  return code;
}

export function watchRoom(code, cb){
  return onSnapshot(doc(db,'rooms',code), s=> cb(s.data()));
}

export async function getRoom(code){
  const s = await getDoc(doc(db,'rooms',code));
  return s.exists()? s.data() : null;
}

export async function startGame(code){
  const ps = await getDocs(collection(db,'rooms',code,'players'));
  const arr=[]; ps.forEach(d=>arr.push({id:d.id, ...d.data()}));
  if(arr.length < 4 || arr.length > 8) throw new Error('PLAYER_COUNT_INVALID');
  const rival = arr[Math.floor(Math.random()*arr.length)];
  await updateDoc(doc(db,'rooms',code), {
    started:true, startTs: Date.now(), rivalUid: rival.id
  });
}

export async function nextStep(code){
  const st = await getRoom(code);
  const stepsLen = 5, order = st.order||[];
  let step = st.stepIndex + 1, scenIdx = st.scenarioIndex, finished=false;
  if(step >= stepsLen){ step=0; scenIdx++; }
  if(scenIdx >= order.length){ scenIdx=order.length-1; step=stepsLen-1; finished=true; }
  await updateDoc(doc(db,'rooms',code), { stepIndex: step, scenarioIndex: scenIdx, finished });
}

export async function resetRoom(code){
  await updateDoc(doc(db,'rooms',code), {
    started:false, finished:false,
    scenarioIndex:0, stepIndex:0,
    startTs:0, rivalUid:null
  });
}

export async function joinRoom(code, name){
  const ref = await addDoc(collection(db,'rooms',code,'players'), {
    name, joinedAt: serverTimestamp()
  });
  await updatePlayersCount(code);
  return ref;
}

export async function leaveRoom(code, pid){
  await deleteDoc(doc(db,'rooms',code,'players',pid));
  await updatePlayersCount(code);
}

async function updatePlayersCount(code){
  const ps = await getDocs(collection(db,'rooms',code,'players'));
  await updateDoc(doc(db,'rooms',code), { playersCount: ps.size });
}
