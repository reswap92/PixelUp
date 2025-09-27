<script type="module">
import { SCENARIOS, SCENARIO_ORDER, DURATION_MIN, MIN_PLAYERS, MAX_PLAYERS, norm } from './scenarios.js';
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot,
  collection, addDoc, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:"AIzaSyD0kpQb-t5aJrMQ9mNnvJgl53Fe8UgPwrc",
  authDomain:"backtag-16de3.firebaseapp.com",
  projectId:"backtag-16de3",
  storageBucket:"backtag-16de3.firebasestorage.app",
  messagingSenderId:"415455463905",
  appId:"1:415455463905:web:abd5e58bdeaaf6e3b9eaa0",
  measurementId:"G-6565LXTZW7"
};
export const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);

// ===== Helpers =====
export const byId = id => document.getElementById(id);
export const rndCode = () => Math.random().toString(36).slice(2,7).toUpperCase();
export const now = () => Date.now();

// ===== Ticket (attivazione QR) =====
export async function validateTicket(token){
  if(!token) return {ok:false, reason:'TOKEN_MISSING'};
  const ref = doc(db,'tickets', token);
  const snap = await getDoc(ref);
  if(!snap.exists()) return {ok:false, reason:'NOT_FOUND'};
  const t = snap.data();
  if(!t.valid) return {ok:false, reason:'INVALID'};
  if(t.consumed) return {ok:false, reason:'CONSUMED'};
  return {ok:true, ref};
}
export async function consumeTicket(ref){ await updateDoc(ref, {consumed:true, consumedAt: now()}); }

// ===== Rooms =====
export async function createRoom({token}){
  const code = rndCode();
  const ref = doc(db,'rooms', code);
  const state = {
    code, createdAt: now(),
    startTs: 0, durationMs: DURATION_MIN*60*1000,
    started:false, finished:false,
    scenarioIndex:0, stepIndex:0,
    rivalUid:null, // id doc del player rivale
    playersCount:0, order: SCENARIO_ORDER
  };
  await setDoc(ref, state);
  if(token) await consumeTicket(token); // se passi ref token qui, consumalo
  return code;
}

export function watchRoom(code, cb){ return onSnapshot(doc(db,'rooms',code), s=> cb(s.data())); }
export async function getRoom(code){ const s=await getDoc(doc(db,'rooms',code)); return s.exists()? s.data(): null; }

export async function startGame(code){
  const st = await getRoom(code);
  if(st.started) return;
  // assegna rivale a caso tra i players
  const playersSnap = await (await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js"))
    .getDocs(collection(db,'rooms',code,'players'));
  const arr = []; playersSnap.forEach(d=>arr.push({id:d.id, ...d.data()}));
  if(arr.length < MIN_PLAYERS || arr.length > MAX_PLAYERS) throw new Error('PLAYER_COUNT_INVALID');
  const rival = arr[Math.floor(Math.random()*arr.length)];
  await updateDoc(doc(db,'rooms',code), {
    started:true, startTs: now(), rivalUid: rival.id
  });
}

export async function nextStep(code){
  const st = await getRoom(code);
  const order = st.order || SCENARIO_ORDER;
  const scenId = order[st.scenarioIndex];
  const scen = SCENARIOS.find(s=>s.id===scenId);
  let step = st.stepIndex + 1, scenIdx = st.scenarioIndex, finished = false;

  if(step >= scen.steps.length){ step = 0; scenIdx++; }
  if(scenIdx >= order.length){ scenIdx = order.length-1; step = scen.steps.length-1; finished = true; }

  await updateDoc(doc(db,'rooms',code), { stepIndex: step, scenarioIndex: scenIdx, finished });
}

export async function resetRoom(code){
  await updateDoc(doc(db,'rooms',code), { started:false, finished:false, scenarioIndex:0, stepIndex:0, startTs:0, rivalUid:null });
}

// ===== Players =====
export async function joinRoom(code, name){
  const ref = await addDoc(collection(db,'rooms',code,'players'), { name, joinedAt: serverTimestamp() });
  await updateCount(code);
  return ref.id;
}
export async function leaveRoom(code, pid){
  await deleteDoc(doc(db,'rooms',code,'players',pid));
  await updateCount(code);
}
async function updateCount(code){
  const { getDocs } = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js");
  const snap = await getDocs(collection(db,'rooms',code,'players'));
  await updateDoc(doc(db,'rooms',code), { playersCount: snap.size });
}

// ===== Chat =====
export function watchChat(code, cb){
  const { query, orderBy, onSnapshot:os } = (await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js")).default||{};
}
</script>
