/* PixelUp Life v5.3 — Budget a cicli stipendio + RID/manuali + foto turni.
   Stesso Firebase e stessi percorsi Firestore della v1.
   Nessuna scrittura in weddingEvents, accessCodes, transmindBookings o PayPal. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore, collection, doc, onSnapshot, addDoc,
  setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

// Configurazione web pubblica, uguale alla v1.
const firebaseConfig = {
  apiKey: 'AIzaSyD0kpQb-t5aJrMQ9mNnvJgl53Fe8UgPwrc',
  authDomain: 'backtag-16de3.firebaseapp.com',
  projectId: 'backtag-16de3',
  storageBucket: 'backtag-16de3.firebasestorage.app',
  messagingSenderId: '415455463905',
  appId: '1:415455463905:web:abd5e58bdeaaf6e3b9eaa0'
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = (n) => new Intl.NumberFormat('it-IT', {style:'currency', currency:'EUR'}).format(Number(n) || 0);
const fmtDate = (s, opts={day:'2-digit',month:'short',year:'numeric'}) => {
  if (!s) return 'Senza data';
  const d = fromISO(s);
  return d && !isNaN(d) ? d.toLocaleDateString('it-IT',opts) : 'Data non valida';
};
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !!fromISO(s) && iso(fromISO(s)) === s;
function fromISO(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))return null;const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12)}
function iso(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function firstDayMonth(now=new Date()){return new Date(now.getFullYear(),now.getMonth(),1,12)}
function lastDayMonth(now=new Date()){return new Date(now.getFullYear(),now.getMonth()+1,0,12)}
function monthKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`}
function addDays(d,days){const copy=new Date(d);copy.setDate(copy.getDate()+days);return copy}
function dateForMonth(year,monthIndex,anchorDay){const day=Math.min(anchorDay,new Date(year,monthIndex+1,0).getDate());return new Date(year,monthIndex,day,12)}

// "appointment" e "meeting" sono tipologie distinte: NON vengono mai mostrate
// l'una nella sezione dell'altra.
const TYPE = {
  deadline:{label:'Scadenza Casa',group:'house',section:'deadlines'},
  appointment:{label:'Appuntamento Casa',group:'house',section:'appointments'},
  expense:{label:'Spesa',group:'house',section:'expenses'},
  task:{label:'Attività',group:'house',section:'tasks'},
  shift:{label:'Turno lavoro (archivio)',group:'work',section:'shifts'},
  workDeadline:{label:'Scadenza Lavoro',group:'work',section:'workDeadlines'},
  meeting:{label:'Appuntamento lavoro',group:'work',section:'meetings'},
  leave:{label:'Ferie / permesso',group:'work',section:'leave'},
  income:{label:'Entrata extra',group:'work',section:'salary'}
};
const SECTIONS = {
  deadlines:['Scadenze','RID dal giorno successivo o pagamento manuale con conferma'],
  appointments:['Appuntamenti personali','Visite, appuntamenti, compleanni e impegni di Casa'],
  expenses:['Pagamenti singoli','Spese con data di scadenza e pagamento manuale o automatico'],
  weekly:['Spese settimanali','Benzina, spesa alimentare, Jay e altre categorie: importi realmente pagati'],
  tasks:['Liste e attività','Le cose da fare e da acquistare'],
  shifts:['Foto dei turni','Carica una foto al posto dell’agenda turni'],
  workDeadlines:['Scadenze di lavoro','Attività e impegni professionali da non dimenticare'],
  meetings:['Appuntamenti di lavoro','Riunioni, corsi, call e colloqui professionali'],
  leave:['Ferie e permessi','Assenze pianificate, riposi e permessi']
};
const kindForSection = {deadlines:'deadline',appointments:'appointment',expenses:'expense',tasks:'task',workDeadlines:'workDeadline',meetings:'meeting',leave:'leave',salary:'income'};
let user = null;
let profile = {displayName:'Vincenzo',salaryNet:0};
let items = [];
let stopProfile = null, stopItems = null;
let page = 'home', houseTab = 'deadlines', workTab = 'workDeadlines', editId = null;
let selectedCycleId = null; // null = ciclo dello stipendio attualmente attivo
let weeklySelected = 1;
let salaryPeriod = monthKey(new Date());
let weeklyEditId = null, weeklyCategoryId = null;
let lastSalaryFormKey = null;
let selectedSavingWeek = 1;
let editingSavingContribution = null;
let editingSavingPlanId = null;
let lastCoachPricesKey = null;
let toastTimer = null;
const notifiedThisSession = new Set();

function toast(message){const node=$('toast');node.textContent=message;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.hidden=true,4000)}
function banner(message=''){const node=$('banner');node.textContent=message;node.hidden=!message}
function showPage(which){
  page=which;
  for(const n of document.querySelectorAll('.view'))n.classList.remove('active');
  $(`${which}View`).classList.add('active');
  render();window.scrollTo({top:0,behavior:'auto'});
}
function showLoginError(text){$('loginError').textContent=text;$('loginError').hidden=!text}
function cleanError(e){
  if(e?.code==='auth/invalid-credential'||e?.code==='auth/wrong-password')return 'Email o password non corretti.';
  if(e?.code==='auth/too-many-requests')return 'Troppi tentativi: riprova più tardi.';
  if(e?.code==='auth/user-not-found')return 'Account non trovato.';
  if(e?.code==='permission-denied')return 'Accesso ai dati negato. Controlla le regole Firestore per lifeUsers.';
  return e?.message || 'Errore imprevisto.';
}

$('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();showLoginError('');$('loginButton').disabled=true;
  try{await signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value)}
  catch(err){showLoginError(cleanError(err))}
  finally{$('loginButton').disabled=false}
});
$('resetPasswordButton').addEventListener('click',async()=>{
  const email=$('email').value.trim();if(!email){showLoginError('Inserisci prima la tua email.');return}
  try{await sendPasswordResetEmail(auth,email);toast('Se l’account esiste, riceverai le istruzioni via email.')}
  catch(err){showLoginError(cleanError(err))}
});
$('logoutButton').addEventListener('click',()=>signOut(auth).catch(err=>toast(cleanError(err))));

onAuthStateChanged(auth, current=>{
  if(stopProfile){stopProfile();stopProfile=null}
  if(stopItems){stopItems();stopItems=null}
  user=current;items=[];profile={displayName:'Vincenzo',salaryNet:0};selectedCycleId=null;weeklySelected=1;
  $('loginScreen').hidden=!!current;$('mainApp').hidden=!current;
  if(current){prepareSavingForm();selectedSavingWeek=1;editingSavingContribution=null;lastCoachPricesKey=null;}
  if(!current){$('password').value='';showLoginError('');banner('');renderShiftPhoto();return}
  $('currentAccount').textContent=current.email||'Account Firebase';
  showPage('home');banner('Caricamento dati personali...');
  const pRef=doc(db,'lifeUsers',current.uid);
  stopProfile=onSnapshot(pRef, snap=>{
    if(user?.uid!==current.uid)return;
    profile={displayName:'Vincenzo',salaryNet:0,...(snap.exists()?snap.data():{})};
    $('displayName').value=profile.displayName||'Vincenzo';
    $('salaryInput').value=Number(profile.salaryNet)||0;
    $('salaryScheduleMode').value=salarySchedule().mode;
    $('salaryOffset').value=salarySchedule().offset;
    $('salaryFixed').value=salarySchedule().day;
    $('salaryWeekend').checked=salarySchedule().weekend;
    updateSalaryScheduleFields();
    banner('');render();
  },err=>banner('Errore impostazioni: '+cleanError(err)));
  stopItems=onSnapshot(collection(db,'lifeUsers',current.uid,'items'),snap=>{
    if(user?.uid!==current.uid)return;
    items=snap.docs.map(d=>({id:d.id,...d.data()}));
    banner('');render();checkReminders();
  },err=>banner('Impossibile leggere Casa/Lavoro: '+cleanError(err)));
});

// Modalità e storico dei pagamenti, senza toccare altre raccolte Firebase.
// Le spese già esistenti senza paymentMode diventano manuali (nessun RID inventato).
// La data di riferimento per i vecchi ricorrenti è il passaggio a questa versione.
const PAYMENT_CUTOVER = '2026-10-29';
const isFinancial = item => ['deadline','expense'].includes(item.kind);
const paymentMode = item => item.paymentMode === 'auto' ? 'auto' : 'manual';
function paymentRecord(item,date){return item.payments?.[date] || null}
function isPaymentPaid(item,date,today=iso(new Date())){
  if (!validDate(date)) return false;
  if (paymentRecord(item,date)) return true;
  if ((item.repeat||'none')==='none' && item.done) return true; // dati v1/v2
  if (item.lastCompletedOccurrence === date) return true; // dati v1/v2
  return paymentMode(item)==='auto' && date<today; // RID: giorno successivo
}
function paymentDatesBetween(item,start,end){
  if(!validDate(item.date))return [];
  const startISO=iso(start),endISO=iso(end),anchor=fromISO(item.date);
  if((item.repeat||'none')==='none')return item.date>=startISO&&item.date<=endISO?[item.date]:[];
  const out=[];
  if(item.repeat==='monthly'){
    let cursor=new Date(start.getFullYear(),start.getMonth(),1,12);
    const finish=new Date(end.getFullYear(),end.getMonth(),1,12);
    for(;cursor<=finish;cursor.setMonth(cursor.getMonth()+1)){
      const d=iso(dateForMonth(cursor.getFullYear(),cursor.getMonth(),anchor.getDate()));
      if(d>=item.date&&d>=startISO&&d<=endISO)out.push(d);
    }
  }else if(item.repeat==='yearly'){
    for(let y=start.getFullYear();y<=end.getFullYear();y++){
      const d=iso(new Date(y,anchor.getMonth(),Math.min(anchor.getDate(),new Date(y,anchor.getMonth()+1,0).getDate()),12));
      if(d>=item.date&&d>=startISO&&d<=endISO)out.push(d);
    }
  }
  return out;
}
// La prima rata manuale non pagata resta visibile anche se è scaduta.
// Una rata automatica passa alla successiva dal giorno dopo la scadenza.
function nextOccurrence(item,now=new Date()){
  if(!validDate(item.date))return null;
  const repeat=item.repeat||'none';
  if(isFinancial(item)){
    if(repeat==='none')return {date:item.date,completed:isPaymentPaid(item,item.date,iso(now))};
    const first=fromISO([item.date,item.trackingStart||PAYMENT_CUTOVER].sort().at(-1));
    const end=new Date(now.getFullYear()+2,now.getMonth(),1,12);
    const dates=paymentDatesBetween(item,first,end);
    const waiting=dates.find(d=>!isPaymentPaid(item,d,iso(now)));
    return waiting?{date:waiting,completed:false}:null;
  }
  return {date:item.date,completed:!!item.done};
}
function eventDate(item){const occ=nextOccurrence(item);return occ?.date||item.date||''}
function eventMoment(item,occDate=eventDate(item)){
  if(!validDate(occDate))return null;
  const hhmm=item.kind==='shift'?(item.start||'09:00'):(item.time||(['deadline','workDeadline'].includes(item.kind)?'09:00':'12:00'));
  const full=new Date(`${occDate}T${/^\d{2}:\d{2}$/.test(hhmm)?hhmm:'12:00'}:00`);
  return !isNaN(full)?full:null;
}
function isCompleted(item){const occ=nextOccurrence(item);return occ?.completed||false}
function getNextEvents(limit=3){const now=new Date();return items
  .filter(x=>['deadline','appointment','workDeadline','meeting'].includes(x.kind))
  .filter(x=>!isCompleted(x))
  .map(x=>({item:x,moment:eventMoment(x)})).filter(x=>x.moment&&x.moment>=now)
  .sort((a,b)=>a.moment-b.moment).slice(0,limit)}

// Anteprime filtrate: Casa e Lavoro separati. I turni in foto non sono eventi.
function previewItems(kinds,limit=3){
  const today=iso(new Date());
  return items.filter(x=>kinds.includes(x.kind)&&!isCompleted(x))
    .map(x=>({item:x,date:eventDate(x),moment:eventMoment(x)}))
    .filter(x=>validDate(x.date)&&x.moment && (x.date>=today || (isFinancial(x.item) && !isPaymentPaid(x.item,x.date,today))))
    .sort((a,b)=>a.moment-b.moment)
    .slice(0,limit);
}
function previewHTML(entry,showType=false){
  const {item,date}=entry;
  const extra=item.kind==='shift'?[item.start,item.end].filter(Boolean).join('–'):(item.time||'');
  const category=showType?(TYPE[item.kind]?.label||'Impegno'):'';
  return `<div class="mini-row">
    <span class="date-chip">${esc(fmtDate(date,{day:'2-digit',month:'short'}))}</span>
    <div class="mini-label"><strong>${esc(item.title)}</strong>
    <small>${esc([category,extra].filter(Boolean).join(' · ')||fmtDate(date,{weekday:'long'}))}</small></div>
  </div>`;
}
function fillPreview(target,kinds,limit=3,showType=false){
  const found=previewItems(kinds,limit);
  $(target).innerHTML=found.length?found.map(x=>previewHTML(x,showType)).join(''):'<div class="empty">Nessun impegno in programma.</div>';
}


// V5 — spese settimanali: 1–7, 8–14, 15–21, 22–28, 29–ultimo giorno.
// Le spese vengono contabilizzate quando le inserisci, senza un secondo click Pagato.
const WEEKLY_DEFAULT_CATEGORIES = [
  {id:'benzina',name:'Benzina',emoji:'⛽'},
  {id:'alimentari',name:'Spesa alimentare',emoji:'🛒'},
  {id:'jay',name:'Jay · cane',emoji:'🐶'},
  {id:'bimba',name:'Bimba / famiglia',emoji:'🧸'},
  {id:'farmacia',name:'Farmacia',emoji:'💊'},
  {id:'altro',name:'Altro',emoji:'📦'}
];
function periodDate(period){return fromISO(period+'-01')}
function periodMove(period,delta){const d=periodDate(period);return monthKey(new Date(d.getFullYear(),d.getMonth()+delta,1,12))}
function periodLabel(period){return periodDate(period).toLocaleDateString('it-IT',{month:'long',year:'numeric'})}
function dayLabel(date){return fmtDate(date,{day:'numeric',month:'short',year:'numeric'})}
function dateInRange(date,start,endExclusive=null){return validDate(date) && date>=start && (!endExclusive || date<endExclusive)}

// Ogni ricevuta stipendio è un inizio ciclo. Il ciclo seguente chiude il precedente.
// Nessun documento precedente viene modificato o cancellato.
function salaryCycles(){
  const receipts=items.filter(x=>x.kind==='salaryReceipt' && validDate(x.receivedDate) && Number(x.amount)>0)
    .slice().sort((a,b)=>a.receivedDate.localeCompare(b.receivedDate)||String(a.id||'').localeCompare(String(b.id||'')));
  return receipts.map((receipt,index)=>({
    id:receipt.id, period:receipt.period, start:receipt.receivedDate,
    endExclusive:receipts[index+1]?.receivedDate||null,
    salary:Math.max(0,Number(receipt.amount)||0),receipt
  }));
}
function activeSalaryCycle(){
  const now=iso(new Date());
  return salaryCycles().filter(c=>c.start<=now).at(-1)||null;
}
function pendingSalaryPlaceholder(){
  // Prima del primo stipendio confermato: le spese si possono registrare,
  // ma non vengono erroneamente attribuite a uno stipendio non ricevuto.
  const start=iso(firstDayMonth(new Date()));
  return {id:'unassigned',start,endExclusive:null,salary:0,receipt:null,unconfirmed:true};
}
function displayedCycle(){
  const cycles=salaryCycles();
  if(selectedCycleId){
    const selected=cycles.find(c=>c.id===selectedCycleId);
    if(selected)return selected;
    selectedCycleId=null;
  }
  return activeSalaryCycle()||pendingSalaryPlaceholder();
}
function cycleNextExpectedDate(cycle){
  if(cycle.endExclusive)return cycle.endExclusive;
  if(cycle.unconfirmed)return null;
  const current=iso(new Date());
  // Il ciclo si chiude soltanto con la prossima conferma reale,
  // non con una data prevista. Quest'ultima è solo una stima.
  const ref=periodDate(cycle.period||cycle.start.slice(0,7));
  const firstCandidate=periodMove(monthKey(ref),1);
  for(let i=0;i<6;i++){
    const date=plannedSalaryDate(periodMove(firstCandidate,i));
    if(date&&date>cycle.start&&date>=current)return date;
  }
  return null;
}
function cycleExpenseHorizon(cycle){
  if(cycle.endExclusive)return addDays(fromISO(cycle.endExclusive),-1);
  const expected=cycleNextExpectedDate(cycle);
  // Non tagliare le spese se il prossimo stipendio è in ritardo.
  const today=new Date();
  const minDay=addDays(fromISO(iso(today)),7);
  const expectedDay=expected?addDays(fromISO(expected),-1):minDay;
  return expectedDay>minDay?expectedDay:minDay;
}
function cycleTitle(cycle){
  if(cycle.unconfirmed)return 'Prima del primo stipendio';
  return cycle.endExclusive
    ?dayLabel(cycle.start)+' – '+dayLabel(addDays(fromISO(cycle.endExclusive),-1))
    : 'Dal '+dayLabel(cycle.start)+' · ciclo attivo';
}
function inCycle(date,cycle){return dateInRange(date,cycle.start,cycle.endExclusive)}

function cycleWeekBounds(cycle,week){
  const first=fromISO(cycle.start);
  const start=addDays(first,(week-1)*7);
  const limit=cycleExpenseHorizon(cycle);
  if(start>limit)return null;
  let end=addDays(start,6);
  if(end>limit)end=limit;
  return {start:start.getDate(),end:end.getDate(),min:iso(start),max:iso(end)};
}
function calendarDayDiff(start,end){
  const a=fromISO(start),b=fromISO(end);
  return Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);
}
function cycleWeekForDate(date,cycle){
  return Math.floor(calendarDayDiff(cycle.start,date)/7)+1;
}
function weeklyRecords(cycle=displayedCycle(),week=null){
  return items.filter(x=>x.kind==='weeklyExpense'&&inCycle(x.date,cycle)&&
    (week===null||cycleWeekForDate(x.date,cycle)===week));
}
function sumAmounts(records){return records.reduce((n,x)=>n+Math.max(0,Number(x.amount)||0),0)}
function weeklyCategories(){
  const custom=items.filter(x=>x.kind==='weeklyCategory'&&x.name).map(x=>({id:x.id,name:x.name,emoji:'✦'}));
  const all=[...WEEKLY_DEFAULT_CATEGORIES,...custom];
  const selected=weeklyRecords(displayedCycle(),weeklySelected);
  for(const x of selected){
    if(!all.some(c=>c.id===x.categoryId))all.push({id:x.categoryId,name:x.categoryName||'Altra categoria',emoji:'📦'});
  }
  return all;
}
function renderWeekly(){
  $('weeklyPanel').hidden=houseTab!=='weekly';
  $('houseSectionPanel').hidden=houseTab==='weekly';
  const cycle=displayedCycle();
  $('weeklyMonth').textContent=cycleTitle(cycle);
  const available=salaryCycles().filter(c=>c.start<=iso(new Date()));
  const index=available.findIndex(c=>c.id===cycle.id);
  $('weeklyPrev').disabled=cycle.unconfirmed||index<=0;
  $('weeklyNext').disabled=cycle.unconfirmed||index>=available.length-1;
  const horizon=cycleExpenseHorizon(cycle);
  const weekCount=Math.max(1,Math.min(104,Math.floor(calendarDayDiff(cycle.start,iso(horizon))/7)+1));
  weeklySelected=Math.max(1,Math.min(weekCount,weeklySelected));
  $('weeklyTabs').innerHTML=Array.from({length:weekCount},(_,i)=>{
    const w=cycleWeekBounds(cycle,i+1);
    return `<button type="button" data-week="${i+1}" class="${weeklySelected===i+1?'active':''}">Sett. ${i+1}<small>${esc(fmtDate(w.min,{day:'numeric',month:'short'}))} – ${esc(fmtDate(w.max,{day:'numeric',month:'short'}))}</small></button>`;
  }).join('');
  const thisWeek=weeklyRecords(cycle,weeklySelected);
  $('weeklyWeekTotal').textContent=money(sumAmounts(thisWeek));
  $('weeklyMonthTotal').textContent=money(sumAmounts(weeklyRecords(cycle)));
  $('weeklyCategoryCards').innerHTML=weeklyCategories().map(category=>{
    const current=thisWeek.filter(x=>x.categoryId===category.id);
    const cycleTotal=sumAmounts(weeklyRecords(cycle).filter(x=>x.categoryId===category.id));
    return `<div class="weekly-category-card">
      <div class="weekly-category-heading"><span>${esc(category.emoji)} ${esc(category.name)}</span><strong>${money(sumAmounts(current))}</strong><small>Ciclo: ${money(cycleTotal)}</small></div>
      <button type="button" class="small-outline" data-weekly-add="${esc(category.id)}">＋ Registra spesa</button>
    </div>`;
  }).join('');
  $('weeklyEntries').innerHTML=thisWeek.length?thisWeek.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`
    <div class="item-row"><div><h3>${esc(x.categoryName||'Spesa')} · ${money(x.amount)}</h3>
    <p>${esc(fmtDate(x.date))}${x.notes?' · '+esc(x.notes):''}</p></div>
    <div class="item-actions"><button class="edit-mini" type="button" data-weekly-edit="${esc(x.id)}">Modifica</button>
    <button class="edit-mini danger" type="button" data-weekly-delete="${esc(x.id)}">×</button></div></div>`).join('')
    :'<div class="empty">Non hai registrato spese in questa settimana.</div>';
}


function weeklyCategoryFor(id){
  return weeklyCategories().find(c=>c.id===id)||{id,name:'Altra categoria'};
}
function openWeeklyModal(categoryId,itemId=null){
  const old=itemId?items.find(x=>x.id===itemId&&x.kind==='weeklyExpense'):null;
  if(itemId&&!old)return;
  weeklyEditId=old?.id||null;
  weeklyCategoryId=old?.categoryId||categoryId;
  const category=old?{name:old.categoryName}:weeklyCategoryFor(weeklyCategoryId);
  $('weeklyModalTitle').textContent=old?'Modifica spesa':'Registra spesa';
  $('weeklyModalCategory').textContent=category.name+' · settimana '+weeklySelected;
  const bounds=cycleWeekBounds(displayedCycle(),weeklySelected);
  if(!bounds)return toast('Settimana non disponibile.');
  const today=iso(new Date());
  if(!old&&bounds.min>today)return toast('Questa settimana non è ancora iniziata.');
  $('weeklyDate').min=bounds.min;
  $('weeklyDate').max=bounds.max<today?bounds.max:today;
  $('weeklyDate').value=old?.date||(today>=bounds.min&&today<=bounds.max?today:bounds.min);
  $('weeklyAmount').value=old?.amount??'';
  $('weeklyNote').value=old?.notes||'';
  $('weeklyModalBackdrop').hidden=false;
  document.body.style.overflow='hidden';
}
function closeWeeklyModal(){weeklyEditId=null;weeklyCategoryId=null;$('weeklyModalBackdrop').hidden=true;document.body.style.overflow=''}
function chooseWeekOfToday(){
  const cycle=displayedCycle(),today=iso(new Date());
  weeklySelected=inCycle(today,cycle)?cycleWeekForDate(today,cycle):1;
}
function selectCycleByOffset(delta){
  const cycles=salaryCycles().filter(c=>c.start<=iso(new Date()));
  const current=displayedCycle();
  const index=cycles.findIndex(c=>c.id===current.id);
  const next=cycles[index+delta];
  if(!next)return;
  selectedCycleId=next.id===activeSalaryCycle()?.id?null:next.id;
  chooseWeekOfToday();render();
}
$('weeklyTabs').addEventListener('click',e=>{const b=e.target.closest('[data-week]');if(!b)return;weeklySelected=Number(b.dataset.week);renderWeekly()});
$('weeklyPrev').addEventListener('click',()=>selectCycleByOffset(-1));
$('weeklyNext').addEventListener('click',()=>selectCycleByOffset(1));
$('weeklyCategoryCards').addEventListener('click',e=>{const b=e.target.closest('[data-weekly-add]');if(b)openWeeklyModal(b.dataset.weeklyAdd)});
$('weeklyEntries').addEventListener('click',async e=>{
  const edit=e.target.closest('[data-weekly-edit]');if(edit){const x=items.find(i=>i.id===edit.dataset.weeklyEdit);if(x)openWeeklyModal(x.categoryId,x.id);return}
  const del=e.target.closest('[data-weekly-delete]');if(!del||!user)return;
  const record=items.find(x=>x.id===del.dataset.weeklyDelete&&x.kind==='weeklyExpense');if(!record)return;
  if(!confirm('Eliminare questa spesa di '+money(record.amount)+'? Verrà rimossa anche dal budget.'))return;
  try{await deleteDoc(doc(db,'lifeUsers',user.uid,'items',record.id));toast('Spesa eliminata dal budget.')}catch(err){toast(cleanError(err))}
});


$('weeklyNewCategory').addEventListener('click',()=>{$('weeklyCategoryForm').hidden=false;$('weeklyCategoryName').focus()});
$('weeklyCancelCategory').addEventListener('click',()=>{$('weeklyCategoryForm').hidden=true;$('weeklyCategoryForm').reset()});
$('weeklyCategoryForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!user)return;
  const name=$('weeklyCategoryName').value.trim();if(!name)return;
  if(weeklyCategories().some(c=>c.name.toLocaleLowerCase('it')===name.toLocaleLowerCase('it'))){toast('Categoria già esistente.');return}
  try{
    await addDoc(collection(db,'lifeUsers',user.uid,'items'),{kind:'weeklyCategory',name,createdAt:serverTimestamp()});
    $('weeklyCategoryForm').reset();$('weeklyCategoryForm').hidden=true;toast('Categoria aggiunta.');
  }catch(err){toast('Categoria non salvata: '+cleanError(err))}
});
$('weeklyCloseModal').addEventListener('click',closeWeeklyModal);
$('weeklyCancelModal').addEventListener('click',closeWeeklyModal);
$('weeklyModalBackdrop').addEventListener('click',e=>{if(e.target===$('weeklyModalBackdrop'))closeWeeklyModal()});
$('weeklyEntryForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!user)return;
  const amount=Number($('weeklyAmount').value),date=$('weeklyDate').value,bounds=cycleWeekBounds(displayedCycle(),weeklySelected);
  if(!Number.isFinite(amount)||amount<=0||amount>1e7)return toast('Inserisci un importo valido.');
  if(!bounds||!validDate(date)||date<bounds.min||date>bounds.max||date>iso(new Date()))return toast('Scegli una data già trascorsa di questa settimana.');
  const old=weeklyEditId?items.find(x=>x.id===weeklyEditId):null;
  const category=old?{name:old.categoryName}:weeklyCategoryFor(weeklyCategoryId);
  const data={kind:'weeklyExpense',title:category.name,categoryId:weeklyCategoryId,categoryName:category.name,
    date,amount:Math.round(amount*100)/100,notes:$('weeklyNote').value.trim(),updatedAt:serverTimestamp()};
  $('weeklySave').disabled=true;
  try{
    if(weeklyEditId)await updateDoc(doc(db,'lifeUsers',user.uid,'items',weeklyEditId),data);
    else await addDoc(collection(db,'lifeUsers',user.uid,'items'),{...data,createdAt:serverTimestamp()});
    closeWeeklyModal();toast('Spesa attribuita al ciclo stipendio della sua data.');
  }catch(err){toast('Spesa non salvata: '+cleanError(err))}
  finally{$('weeklySave').disabled=false}
});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('weeklyModalBackdrop').hidden)closeWeeklyModal()});

// V5 — stipendio previsto a calendario, contabilizzazione SOLO dopo conferma.
function salarySchedule(){
  const s=profile.salarySchedule||{};
  return {mode:['endOffset','fixed','manual'].includes(s.mode)?s.mode:'endOffset',
    offset:Number.isInteger(Number(s.offset))?Math.max(0,Math.min(30,Number(s.offset))):1,
    day:Number.isInteger(Number(s.day))?Math.max(1,Math.min(31,Number(s.day))):30,
    weekend:!!s.weekend};
}
function salaryReceipt(period){return items.find(x=>x.kind==='salaryReceipt'&&x.period===period)||null}
function salaryOverride(period){return items.find(x=>x.kind==='salaryDateOverride'&&x.period===period)||null}
function plannedSalaryDate(period){
  const override=salaryOverride(period);
  if(override?.date?.startsWith(period)&&validDate(override.date))return override.date;
  const config=salarySchedule(),first=periodDate(period),last=new Date(first.getFullYear(),first.getMonth()+1,0,12);
  if(config.mode==='manual')return null;
  const date=config.mode==='fixed'?new Date(first.getFullYear(),first.getMonth(),Math.min(config.day,last.getDate()),12):addDays(last,-config.offset);
  if(config.weekend){while([0,6].includes(date.getDay()))date.setDate(date.getDate()-1)}
  return iso(date);
}
function updateSalaryScheduleFields(){
  const mode=$('salaryScheduleMode').value;
  $('salaryOffsetWrap').hidden=mode!=='endOffset';
  $('salaryFixedWrap').hidden=mode!=='fixed';
  $('salaryWeekendWrap').hidden=mode==='manual';
}
$('salaryScheduleMode').addEventListener('change',updateSalaryScheduleFields);
function renderSalary(){
  const saved=salaryReceipt(salaryPeriod),expected=Math.max(0,Number(profile.salaryNet)||0);
  $('salaryMonth').textContent=periodLabel(salaryPeriod);
  $('salaryAmount').textContent=money(expected);
  const due=plannedSalaryDate(salaryPeriod);
  $('salaryNext').textContent=(due?'Accredito previsto: '+fmtDate(due,{day:'numeric',month:'long',year:'numeric'}):'Data di accredito da inserire per questo mese')+' · Il ciclo inizia alla data reale confermata.';
  $('salaryManualDateWrap').hidden=salarySchedule().mode!=='manual';
  $('salaryManualDate').value=salaryOverride(salaryPeriod)?.date||'';
  $('salaryManualDate').min=salaryPeriod+'-01';
  $('salaryManualDate').max=iso(lastDayMonth(periodDate(salaryPeriod)));
  const formKey=salaryPeriod+'|'+expected+'|'+(saved?.amount??'')+'|'+(saved?.receivedDate??'');
  if(formKey!==lastSalaryFormKey){
    $('salaryActualAmount').value=saved?.amount??expected;
    const today=iso(new Date());
    $('salaryActualDate').value=saved?.receivedDate||(today.startsWith(salaryPeriod)?today:(due||today));
    lastSalaryFormKey=formKey;
  }
  $('salaryStatus').textContent=saved?'✓ Ricevuto '+money(saved.amount)+' il '+fmtDate(saved.receivedDate)+' · apre un ciclo budget':'Da confermare · il nuovo budget inizia solo con l’accredito reale';
  $('salaryStatus').classList.toggle('salary-received',!!saved);
  $('salaryConfirm').textContent=saved?'Aggiorna accredito':'✓ Conferma stipendio ricevuto';
  $('salaryUndo').hidden=!saved;
}
$('salaryPrev').addEventListener('click',()=>{salaryPeriod=periodMove(salaryPeriod,-1);render()});
$('salaryNextMonth').addEventListener('click',()=>{salaryPeriod=periodMove(salaryPeriod,1);render()});
$('salarySaveManualDate').addEventListener('click',async()=>{
  if(!user)return;const date=$('salaryManualDate').value;
  if(!validDate(date)||!date.startsWith(salaryPeriod))return toast('Inserisci una data del mese selezionato.');
  try{await setDoc(doc(db,'lifeUsers',user.uid,'items','salaryDate_'+salaryPeriod),
    {kind:'salaryDateOverride',period:salaryPeriod,date,updatedAt:serverTimestamp()},{merge:true});
    toast('Data prevista salvata.');
  }catch(err){toast(cleanError(err))}
});
$('salaryReceiptForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!user)return;
  const amount=Number($('salaryActualAmount').value),date=$('salaryActualDate').value;
  if(!Number.isFinite(amount)||amount<=0||amount>1e7||!validDate(date))return toast('Verifica importo e data effettiva.');
  if(date>iso(new Date()))return toast('Non puoi confermare uno stipendio con una data futura.');
  if(items.some(x=>x.kind==='salaryReceipt'&&x.period!==salaryPeriod&&x.receivedDate===date))return toast('Hai già confermato uno stipendio per questa data.');
  $('salaryConfirm').disabled=true;
  try{
    await setDoc(doc(db,'lifeUsers',user.uid,'items','salaryReceipt_'+salaryPeriod),
      {kind:'salaryReceipt',period:salaryPeriod,date:date,receivedDate:date,amount:Math.round(amount*100)/100,updatedAt:serverTimestamp()},{merge:true});
    selectedCycleId=null;chooseWeekOfToday();toast('Stipendio confermato: nuovo ciclo budget aperto.');
  }catch(err){toast('Accredito non salvato: '+cleanError(err))}
  finally{$('salaryConfirm').disabled=false}
});
$('salaryUndo').addEventListener('click',async()=>{
  if(!user||!salaryReceipt(salaryPeriod))return;
  if(!confirm('Annullare la conferma dello stipendio di '+periodLabel(salaryPeriod)+'?'))return;
  try{await deleteDoc(doc(db,'lifeUsers',user.uid,'items','salaryReceipt_'+salaryPeriod));toast('Conferma stipendio annullata.')}catch(err){toast(cleanError(err))}
});
$('budgetPrev').addEventListener('click',()=>selectCycleByOffset(-1));
$('budgetNext').addEventListener('click',()=>selectCycleByOffset(1));
$('openWeeklyFromHome').addEventListener('click',()=>{chooseWeekOfToday();goHouse('weekly')});
$('openSalaryFromHome').addEventListener('click',()=>goWork('salary'));
$('openSavingsFromHome').addEventListener('click',()=>showPage('savings'));

// Entrate esistenti (V5.2): erano già considerate incassate; non alteriamo i dati precedenti.
function incomeWasReceived(x){return x.kind==='income' && x.received!==false}
function incomeEffectiveDate(x){return validDate(x.incomeReceivedDate)?x.incomeReceivedDate:x.date}
function moneyVal(value){return Math.round((Number(value)||0)*100)/100}

// Riepilogo per intervallo stipendio, non per mese solare.
// L'inizio è la data effettiva di accredito; la fine è esclusiva.
function cycleBudget(cycle=displayedCycle(), today=iso(new Date())){
  const start=fromISO(cycle.start);
  const to=cycle.endExclusive?addDays(fromISO(cycle.endExclusive),-1):cycleExpenseHorizon(cycle);
  const historical=!!cycle.endExclusive;
  const lastPaid=cycle.endExclusive?cycle.endExclusive:iso(addDays(fromISO(today),1));
  let expenses=0,pending=0,extra=0,weekly=0;
  for(const x of items){
    const amount=Math.max(0,Number(x.amount)||0);
    if(!amount)continue;
    if(x.kind==='weeklyExpense'&&inCycle(x.date,cycle)){
      weekly+=amount;expenses+=amount;continue;
    }
    if(incomeWasReceived(x)&&inCycle(incomeEffectiveDate(x),cycle)&&incomeEffectiveDate(x)<=today){extra+=amount;continue}
    if(!isFinancial(x)||(x.kind==='deadline'&&x.includeBudget!==true))continue;
    const recordedDues=new Set();
    for(const [due,record] of Object.entries(x.payments||{})){
      if(!validDate(due)||!record)continue;
      recordedDues.add(due);
      if(validDate(record.paidAt)&&inCycle(record.paidAt,cycle)&&record.paidAt<=today)
        expenses+=Math.max(0,Number(record.amount??amount)||0);
    }
    const lookback=addDays(start,-1);
    const startAt=lookback<fromISO(x.date)?fromISO(x.date):lookback;
    for(const due of paymentDatesBetween(x,startAt,to)){
      if(recordedDues.has(due))continue;
      if(paymentMode(x)==='auto'){
        const posting=iso(addDays(fromISO(due),1));
        if(inCycle(posting,cycle)){
          if(posting<=today)expenses+=amount;
          else if(!historical)pending+=amount;
        }
      }else{
        const previouslyPaid=(x.repeat||'none')==='none'?!!x.done:x.lastCompletedOccurrence===due;
        if(previouslyPaid&&inCycle(due,cycle)&&due<=today)expenses+=amount;
        else if(!historical && due>=cycle.start && due<=iso(to))pending+=amount;
      }
    }
  }
  const income=cycle.salary+extra;
  return {income,salary:cycle.salary,extra,expenses,pending,weekly,
    remaining:income-expenses,forecast:income-expenses-pending,
    historical,cycle};
}

// Manteniamo il riepilogo dello storico fino a dodici stipendi confermati.
function lastTwelveCycles(){
  const cycles=salaryCycles().filter(c=>c.start<=iso(new Date())&&c.endExclusive).slice(-12);
  return cycles.map(c=>({cycle:c,...cycleBudget(c)}));
}



// ----- RISPARMIO V5.3: obiettivi indipendenti dal budget dello stipendio -----
function savingPlans(){return items.filter(x=>x.kind==='savingPlan'&&validDate(x.startDate)&&validDate(x.endExclusive)&&Number(x.target)>0)
  .slice().sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||String(a.id).localeCompare(String(b.id)));}
function activeSavingPlan(){return savingPlans().filter(x=>x.status!=='closed').at(-1)||null}
function savingContributions(plan){return items.filter(x=>x.kind==='savingContribution'&&x.planId===plan.id&&validDate(x.date))}
function savedForPlan(plan){return sumAmounts(savingContributions(plan))}
function savingEnd(start,months){const d=fromISO(start);return iso(dateForMonth(d.getFullYear(),d.getMonth()+months,d.getDate()))}
function savingWeekCount(plan){return Math.ceil(calendarDayDiff(plan.startDate,plan.endExclusive)/7)}
function savingWeek(plan,index){
  const start=addDays(fromISO(plan.startDate),(index-1)*7),limit=addDays(fromISO(plan.endExclusive),-1);
  const end=addDays(start,6);return {min:iso(start),max:iso(end>limit?limit:end)};
}
function savingWeekIndex(date,plan){return Math.floor(calendarDayDiff(plan.startDate,date)/7)+1}
function savingMonthRanges(plan){
  const list=[];
  for(let i=0;i<plan.durationMonths;i++){
    const min=savingEnd(plan.startDate,i),max=savingEnd(plan.startDate,i+1);
    list.push({min,max,label:fromISO(min).toLocaleDateString('it-IT',{month:'short',year:'numeric'})});
  }return list;
}
function savingPlanFormValues(){
  const amount=Number($('savingTarget').value),start=$('savingStart').value,months=Number($('savingDuration').value);
  return {amount,start,months};
}
function updateSavingPlanPreview(){
  const {amount,start,months}=savingPlanFormValues();
  if(!Number.isFinite(amount)||amount<=0||!validDate(start)){$('savingPlanPreview').textContent='Inserisci cifra e data di partenza.';return}
  const end=savingEnd(start,months),weeks=Math.ceil(calendarDayDiff(start,end)/7);
  $('savingPlanPreview').textContent='Dal '+dayLabel(start)+' al '+dayLabel(addDays(fromISO(end),-1))+'. '+money(amount/months)+' al mese, circa '+money(amount/weeks)+' a settimana ('+weeks+' settimane reali).';
}
$('savingTarget').addEventListener('input',updateSavingPlanPreview);
$('savingStart').addEventListener('change',updateSavingPlanPreview);
$('savingDuration').addEventListener('change',updateSavingPlanPreview);
function prepareSavingForm(plan=null){
  editingSavingPlanId=plan?.id||null;
  $('savingPlanName').value=plan?.title||'Il mio salvadanaio';
  $('savingTarget').value=plan?.target||'';
  $('savingStart').value=plan?.startDate||iso(new Date());
  $('savingDuration').value=String(plan?.durationMonths||3);
  $('savingPlanEditorTitle').textContent=plan?'Modifica obiettivo':'Crea il tuo obiettivo';
  $('savingPlanSubmit').textContent=plan?'Salva modifiche':'Crea piano risparmio';
  $('savingPlanEditor').hidden=false;updateSavingPlanPreview();
}
$('savingPlanForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!user)return;
  const {amount,start,months}=savingPlanFormValues();
  if(!Number.isFinite(amount)||amount<=0||amount>1e7||!validDate(start)||![3,6,9,12].includes(months))return toast('Controlla obiettivo, data e durata.');
  if(start>iso(new Date()))return toast('Scegli una data di inizio non futura.');
  const end=savingEnd(start,months);
  if(editingSavingPlanId){
    const linked=items.filter(x=>x.kind==='savingContribution'&&x.planId===editingSavingPlanId);
    if(linked.some(x=>!dateInRange(x.date,start,end)))return toast('Le nuove date escluderebbero versamenti già registrati.');
  }else if(activeSavingPlan())return toast('Chiudi prima l’obiettivo attivo per crearne un altro.');
  const data={kind:'savingPlan',title:$('savingPlanName').value.trim()||'Il mio salvadanaio',
    target:moneyVal(amount),startDate:start,endExclusive:end,durationMonths:months,updatedAt:serverTimestamp()};
  $('savingPlanSubmit').disabled=true;
  try{
    if(editingSavingPlanId)await updateDoc(doc(db,'lifeUsers',user.uid,'items',editingSavingPlanId),data);
    else await addDoc(collection(db,'lifeUsers',user.uid,'items'),{...data,status:'active',createdAt:serverTimestamp()});
    editingSavingPlanId=null;$('savingPlanEditor').hidden=true;selectedSavingWeek=1;
    toast('Piano di risparmio salvato.');
  }catch(err){toast('Piano non salvato: '+cleanError(err))}
  finally{$('savingPlanSubmit').disabled=false}
});
$('savingEditPlan').addEventListener('click',()=>{const p=activeSavingPlan();if(p){prepareSavingForm(p);$('savingPlanEditor').scrollIntoView({behavior:'smooth'})}});
function resetSavingContributionForm(plan){
  editingSavingContribution=null;
  $('savingContributionForm').reset();
  $('savingContributionTitle').textContent='Registra soldi messi da parte';
  $('savingContributionSave').textContent='＋ Registra accantonamento';
  $('savingContributionCancel').hidden=true;
  const week=savingWeek(plan,selectedSavingWeek),today=iso(new Date());
  $('savingContributionDate').min=week.min;
  $('savingContributionDate').max=week.min>today?week.max:(week.max<today?week.max:today);
  $('savingContributionDate').value=week.min>today?'':(today>=week.min&&today<=week.max?today:week.max);
  $('savingContributionSave').disabled=week.min>today;
}
function startSavingContribution(){const p=activeSavingPlan();if(!p)return;
  resetSavingContributionForm(p);$('savingAmount').focus();}
$('savingContributionCancel').addEventListener('click',()=>{const p=activeSavingPlan();if(p)resetSavingContributionForm(p)});
$('savingWeekTabs').addEventListener('click',e=>{
  const b=e.target.closest('[data-saving-week]');if(!b)return;
  selectedSavingWeek=Number(b.dataset.savingWeek);
  const p=activeSavingPlan();if(p)resetSavingContributionForm(p);renderSavings();
});
$('savingContributionForm').addEventListener('submit',async e=>{
  e.preventDefault();const plan=activeSavingPlan();if(!user||!plan)return;
  const amount=Number($('savingAmount').value),date=$('savingContributionDate').value;
  if(!Number.isFinite(amount)||amount<=0||amount>1e7||!dateInRange(date,plan.startDate,plan.endExclusive)||date>iso(new Date()))return toast('Controlla importo e data dell’accantonamento.');
  if(savingWeekIndex(date,plan)!==selectedSavingWeek)return toast('La data deve appartenere alla settimana selezionata.');
  $('savingContributionSave').disabled=true;
  const data={kind:'savingContribution',planId:plan.id,date,amount:moneyVal(amount),notes:$('savingContributionNote').value.trim(),updatedAt:serverTimestamp()};
  try{
    if(editingSavingContribution)await updateDoc(doc(db,'lifeUsers',user.uid,'items',editingSavingContribution),data);
    else await addDoc(collection(db,'lifeUsers',user.uid,'items'),{...data,createdAt:serverTimestamp()});
    resetSavingContributionForm(plan);toast('Risparmio realmente accantonato registrato.');
  }catch(err){toast('Accantonamento non salvato: '+cleanError(err))}
  finally{$('savingContributionSave').disabled=false}
});
$('savingWeekEntries').addEventListener('click',async e=>{
  const plan=activeSavingPlan();if(!user||!plan)return;
  const edit=e.target.closest('[data-saving-edit]');
  if(edit){const x=items.find(i=>i.id===edit.dataset.savingEdit&&i.kind==='savingContribution'&&i.planId===plan.id);if(!x)return;
    selectedSavingWeek=savingWeekIndex(x.date,plan);
    editingSavingContribution=x.id;
    $('savingAmount').value=x.amount;$('savingContributionNote').value=x.notes||'';
    const bounds=savingWeek(plan,selectedSavingWeek);
    $('savingContributionDate').min=bounds.min;$('savingContributionDate').max=iso(new Date())<bounds.max?iso(new Date()):bounds.max;
    $('savingContributionDate').value=x.date;
    $('savingContributionTitle').textContent='Modifica accantonamento';
    $('savingContributionSave').textContent='Salva modifica';$('savingContributionCancel').hidden=false;
    $('savingContributionForm').scrollIntoView({behavior:'smooth'});return;
  }
  const del=e.target.closest('[data-saving-delete]');if(!del)return;
  const x=items.find(i=>i.id===del.dataset.savingDelete&&i.kind==='savingContribution'&&i.planId===plan.id);if(!x)return;
  if(!confirm('Eliminare questo accantonamento di '+money(x.amount)+'?'))return;
  try{await deleteDoc(doc(db,'lifeUsers',user.uid,'items',x.id));if(editingSavingContribution===x.id)resetSavingContributionForm(plan);toast('Accantonamento eliminato.');}
  catch(err){toast(cleanError(err))}
});
$('savingClosePlan').addEventListener('click',async()=>{
  const plan=activeSavingPlan();if(!plan||!user)return;
  const total=savedForPlan(plan),met=total>=Number(plan.target);
  if(!met&&iso(new Date())<plan.endExclusive)return toast('L’obiettivo è ancora in corso. Puoi chiuderlo alla scadenza o quando è raggiunto.');
  if(!confirm('Archiviare il piano? Accantonato '+money(total)+' su '+money(plan.target)+'. I dati rimarranno nello storico.'))return;
  try{await updateDoc(doc(db,'lifeUsers',user.uid,'items',plan.id),{status:'closed',closedAt:iso(new Date()),updatedAt:serverTimestamp()});
    toast('Piano archiviato. Puoi creare un nuovo obiettivo.');}
  catch(err){toast(cleanError(err))}
});

// Prezzi personalizzabili per una stima onesta delle sfide.
const COACH_DEFAULT_PRICES={smoke:6,coffee:1.5,impulse:20,snack:3,waste:10};
const COACH_TIPS=[
  {id:'smoke',emoji:'🚭',title:'2 pacchetti di sigarette in meno',units:2,description:'Se fumi, prova a ridurre gli acquisti senza rinunciare ad attività salutari.'},
  {id:'coffee',emoji:'☕',title:'4 caffè fuori in meno',units:4,description:'Prepara il caffè a casa quando ti fa comodo.'},
  {id:'impulse',emoji:'🛍️',title:'Rimanda un acquisto non necessario',units:1,description:'Aspetta 48 ore prima di acquistare qualcosa che non ti serve.'},
  {id:'snack',emoji:'🥨',title:'2 acquisti al distributore in meno',units:2,description:'Porta uno spuntino da casa, se già disponibile.'},
  {id:'waste',emoji:'🥬',title:'Evita uno spreco alimentare',units:1,description:'Consuma ciò che hai già prima di acquistare altro.'}
];
function coachPrices(){return {...COACH_DEFAULT_PRICES,...(profile.savingHabitPrices||{})}}
function coachChallengeId(plan,week,tip){return 'savingChallenge_'+plan.id+'_'+week+'_'+tip}
function currentSavingWeek(plan){
  const today=iso(new Date()),last=savingWeekCount(plan);
  if(today<plan.startDate)return 1;
  if(today>=plan.endExclusive)return last;
  return Math.min(last,savingWeekIndex(today,plan));
}
function savingChallenge(plan,week,tip){return items.find(x=>x.id===coachChallengeId(plan,week,tip))||null}
function updateCoachPricesForm(){
  const prices=coachPrices(),key=JSON.stringify(prices);
  if(lastCoachPricesKey===key)return;
  for(const [suffix,name] of [['Smoke','smoke'],['Coffee','coffee'],['Impulse','impulse'],['Snack','snack'],['Waste','waste']])
    $('coachPrice'+suffix).value=prices[name];
  lastCoachPricesKey=key;
}
$('coachPricesForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!user)return;
  const prices={};for(const [suffix,name] of [['Smoke','smoke'],['Coffee','coffee'],['Impulse','impulse'],['Snack','snack'],['Waste','waste']]){
    const val=Number($('coachPrice'+suffix).value);
    if(!Number.isFinite(val)||val<0||val>10000)return toast('Verifica i prezzi inseriti.');
    prices[name]=moneyVal(val);
  }
  try{await setDoc(doc(db,'lifeUsers',user.uid),{savingHabitPrices:prices,updatedAt:serverTimestamp()},{merge:true});toast('Prezzi delle abitudini salvati.');}
  catch(err){toast(cleanError(err))}
});
$('savingCoachTips').addEventListener('click',async e=>{
  const b=e.target.closest('[data-coach-tip]');if(!b||!user)return;
  const plan=activeSavingPlan();if(!plan||!plan.id)return;
  const tip=COACH_TIPS.find(t=>t.id===b.dataset.coachTip);if(!tip)return;
  const week=selectedSavingWeek,id=coachChallengeId(plan,week,tip.id);
  const prev=savingChallenge(plan,week,tip.id);
  const next=prev?.status==='done'?'planned':prev?.status==='planned'?'done':'planned';
  try{await setDoc(doc(db,'lifeUsers',user.uid,'items',id),{kind:'savingChallenge',planId:plan.id,week,tipId:tip.id,
    potential:moneyVal(tip.units*(Number(coachPrices()[tip.id])||0)),status:next,updatedAt:serverTimestamp()},{merge:true});
    toast(next==='done'?'Sfida completata. Registra a parte i soldi davvero accantonati.':'Sfida impostata.');}
  catch(err){toast(cleanError(err))}
});
function renderSavingHome(){
  const p=activeSavingPlan();
  $('homeSavingsSummary').textContent=p?money(savedForPlan(p))+' su '+money(p.target)+' · '+p.durationMonths+' mesi':'Crea un obiettivo da 3, 6, 9 o 12 mesi';
}
function renderSavings(){
  const plan=activeSavingPlan(),today=iso(new Date());
  $('savingActive').hidden=!plan;$('savingCoach').hidden=!plan;
  $('savingPlanEditor').hidden=!!plan && editingSavingPlanId!==plan.id;
  if(!plan && editingSavingPlanId){editingSavingPlanId=null}
  if(!plan){if(!$('savingTarget').value)prepareSavingForm();}
  if(plan){
    const target=Math.max(0,Number(plan.target)||0),saved=savedForPlan(plan),missing=Math.max(0,target-saved);
    const count=savingWeekCount(plan),current=currentSavingWeek(plan);
    selectedSavingWeek=Math.min(count,Math.max(1,selectedSavingWeek));
    $('savingActiveTitle').textContent=plan.title||'Il mio salvadanaio';
    $('savingActiveDates').textContent=dayLabel(plan.startDate)+' – '+dayLabel(addDays(fromISO(plan.endExclusive),-1))+' · '+plan.durationMonths+' mesi';
    $('savingActual').textContent=money(saved);$('savingMissing').textContent=money(missing);
    const percentage=target?Math.min(100,saved/target*100):0;
    $('savingProgressFill').style.width=percentage+'%';
    $('savingProgressText').textContent=percentage.toFixed(0)+'% raggiunto'+(today>=plan.endExclusive?' · periodo terminato: puoi archiviare':'');
    $('savingMonthlyTarget').textContent=money(target/plan.durationMonths);
    $('savingWeeklyTarget').textContent=money(target/count);
    const outstanding=Math.max(1,count-current+1);
    $('savingRecommended').textContent=missing>0?'Per arrivare all’obiettivo: circa '+money(missing/outstanding)+' per ciascuna delle '+outstanding+' settimane rimanenti.':'Complimenti: importo obiettivo raggiunto! Puoi archiviare il piano.';
    $('savingWeekTabs').innerHTML=Array.from({length:count},(_,i)=>{
      const week=i+1,b=savingWeek(plan,week),actual=sumAmounts(savingContributions(plan).filter(x=>savingWeekIndex(x.date,plan)===week));
      return `<button type="button" data-saving-week="${week}" class="${selectedSavingWeek===week?'active':''}">Sett. ${week}<small>${esc(fmtDate(b.min,{day:'numeric',month:'short'}))}–${esc(fmtDate(b.max,{day:'numeric',month:'short'}))}</small><small>${money(actual)}</small></button>`;
    }).join('');
    const b=savingWeek(plan,selectedSavingWeek),weekEntries=savingContributions(plan).filter(x=>savingWeekIndex(x.date,plan)===selectedSavingWeek);
    $('savingWeekHint').textContent='Dal '+dayLabel(b.min)+' al '+dayLabel(b.max)+(b.min>today?' · Settimana futura: potrai registrare un accantonamento quando inizierà.':selectedSavingWeek===current?' · settimana attuale':'');
    $('savingWeekActual').textContent=money(sumAmounts(weekEntries));$('savingWeekTarget').textContent=money(target/count);
    $('savingCoachTarget').textContent='Traguardo di questa settimana: '+money(target/count)+'. Hai già accantonato '+money(sumAmounts(weekEntries))+'; mancano '+money(Math.max(0,target/count-sumAmounts(weekEntries)))+' per la tappa. Scegli solo le sfide adatte alle tue abitudini.';
    if(!editingSavingContribution){
      $('savingContributionDate').min=b.min;$('savingContributionDate').max=b.min>today?b.max:(b.max<today?b.max:today);
      if(b.min>today)$('savingContributionDate').value='';
      else if(!$('savingContributionDate').value||$('savingContributionDate').value<b.min||$('savingContributionDate').value>b.max)
        $('savingContributionDate').value=today>=b.min&&today<=b.max?today:b.max;
      $('savingContributionSave').disabled=b.min>today;
    }
    $('savingWeekEntries').innerHTML=weekEntries.length?weekEntries.slice().sort((x,y)=>y.date.localeCompare(x.date)).map(x=>
      `<div class="item-row"><div><h3>✓ ${money(x.amount)} accantonati</h3><p>${esc(dayLabel(x.date))}${x.notes?' · '+esc(x.notes):''}</p></div><div class="item-actions"><button type="button" class="edit-mini" data-saving-edit="${esc(x.id)}">Modifica</button><button type="button" class="edit-mini danger" data-saving-delete="${esc(x.id)}">×</button></div></div>`).join(''):'<div class="empty">Non hai ancora confermato accantonamenti per questa settimana.</div>';
    $('savingMonthlyBars').innerHTML=savingMonthRanges(plan).map(range=>{
      const amount=sumAmounts(savingContributions(plan).filter(x=>dateInRange(x.date,range.min,range.max)));
      const pct=Math.min(100,amount/Math.max(1,target/plan.durationMonths)*100);
      return `<div class="expense-bar"><div><span>${esc(range.label)}</span><strong>${money(amount)}</strong></div><div class="expense-track"><div style="width:${pct}%"></div></div></div>`;
    }).join('');
    updateCoachPricesForm();
    const prices=coachPrices();let completed=0;
    $('savingCoachTips').innerHTML=COACH_TIPS.map(t=>{
      const prev=savingChallenge(plan,selectedSavingWeek,t.id);
      const potential=moneyVal(t.units*(Number(prices[t.id])||0));
      if(prev?.status==='done')completed+=Number(prev.potential)||potential;
      return `<div class="coach-tip"><div class="coach-icon">${t.emoji}</div><div><strong>${esc(t.title)}</strong><p>${esc(t.description)}</p><small>Risparmio potenziale: ${money(potential)}</small><button type="button" class="small-outline" data-coach-tip="${esc(t.id)}">${prev?.status==='done'?'✓ Completata · modifica':prev?'Segna completata':'＋ Prova la sfida'}</button></div></div>`;
    }).join('');
    $('savingCoachTotal').textContent='Sfide completate: '+money(completed)+' di risparmio ipotetico. Non sono denaro accantonato finché non lo registri.';
    $('savingClosePlan').disabled=today<plan.endExclusive&&saved<target;
    $('savingClosePlan').textContent= saved>=target?'✓ Archivia obiettivo raggiunto':today>=plan.endExclusive?'Archivia obiettivo terminato':'Potrai archiviare a fine piano';
  }
  const currentYear=new Date().getFullYear();
  const allSaved=items.filter(x=>x.kind==='savingContribution'&&validDate(x.date));
  const thisYear=sumAmounts(allSaved.filter(x=>x.date.startsWith(String(currentYear))));
  const previousYear=sumAmounts(allSaved.filter(x=>x.date.startsWith(String(currentYear-1))));
  $('savingYearSummary').innerHTML=`<div><small>${currentYear} · Accantonato</small><strong>${money(thisYear)}</strong></div><div><small>${currentYear-1} · Accantonato</small><strong>${money(previousYear)}</strong></div>`;
  const history=savingPlans().filter(p=>p.status==='closed').reverse();
  $('savingPlanHistory').innerHTML=history.length?history.map(p=>{
    const total=savedForPlan(p),pct=Math.round(total/Math.max(1,Number(p.target))*100);
    return `<div class="item-row"><div><h3>${esc(p.title||'Piano risparmio')}</h3><p>${esc(dayLabel(p.startDate))} – ${esc(dayLabel(addDays(fromISO(p.endExclusive),-1)))}</p><p>Accantonato ${money(total)} / ${money(p.target)} · ${pct}%</p></div><span class="pill ${total>=Number(p.target)?'success':''}">${total>=Number(p.target)?'Raggiunto':'Concluso'}</span></div>`;
  }).join(''):'<div class="empty">I piani conclusi compariranno qui.</div>';
}

// Analisi delle spese realmente contabilizzate, per ciclo dello stipendio.
function cycleExpenseCategories(cycle,today=iso(new Date())){
  const result=new Map();
  const add=(label,value)=>result.set(label,(result.get(label)||0)+Math.max(0,Number(value)||0));
  for(const x of items){
    const amount=Math.max(0,Number(x.amount)||0);if(!amount)continue;
    if(x.kind==='weeklyExpense'&&inCycle(x.date,cycle)&&x.date<=today){add(x.categoryName||'Altre spese',amount);continue}
    if(!isFinancial(x)||(x.kind==='deadline'&&!x.includeBudget))continue;
    const recorded=new Set();
    for(const [due,p] of Object.entries(x.payments||{})){
      if(!validDate(due)||!p)continue;recorded.add(due);
      if(validDate(p.paidAt)&&inCycle(p.paidAt,cycle)&&p.paidAt<=today)add('Pagamenti e scadenze',p.amount??amount);
    }
    const from=addDays(fromISO(cycle.start),-1),to=cycle.endExclusive?addDays(fromISO(cycle.endExclusive),-1):cycleExpenseHorizon(cycle);
    const first=from<fromISO(x.date)?fromISO(x.date):from;
    for(const due of paymentDatesBetween(x,first,to)){
      if(recorded.has(due))continue;
      if(paymentMode(x)==='auto'){
        const posted=iso(addDays(fromISO(due),1));if(inCycle(posted,cycle)&&posted<=today)add('Pagamenti e scadenze',amount);
      }else if(((x.repeat||'none')==='none'&&x.done)||x.lastCompletedOccurrence===due){
        if(inCycle(due,cycle)&&due<=today)add('Pagamenti e scadenze',amount);
      }
    }
  }
  return [...result].sort((a,b)=>b[1]-a[1]);
}
function renderExpenseAnalysis(cycle){
  const groups=cycleExpenseCategories(cycle),total=groups.reduce((s,x)=>s+x[1],0);
  $('analysisCycle').textContent=cycle.unconfirmed?'Nessuno stipendio':cycleTitle(cycle);
  $('expenseAnalysisBars').innerHTML=groups.length?groups.map(([name,amount])=>
    `<div class="expense-bar"><div><span>${esc(name)}</span><strong>${money(amount)}</strong></div><div class="expense-track"><div style="width:${total?100*amount/total:0}%"></div></div></div>`).join(''):'<div class="empty">Non hai ancora spese contabilizzate in questo ciclo.</div>';
  const cycles=salaryCycles().filter(x=>x.start<=iso(new Date())),index=cycles.findIndex(x=>x.id===cycle.id);
  if(index<1){$('expenseCycleCompare').textContent='Il confronto sarà disponibile dopo due stipendi confermati.';return}
  const prev=cycleBudget(cycles[index-1]),current=cycleBudget(cycle);
  const diff=current.expenses-prev.expenses;
  $('expenseCycleCompare').textContent='Rispetto al ciclo precedente: '+(diff>0?'hai registrato '+money(diff)+' di spese in più':diff<0?'hai registrato '+money(-diff)+' di spese in meno':'stesse spese registrate')+(cycle.endExclusive?'':'. Il ciclo attuale non è ancora concluso.');
}

function render(){
  if(!user)return;
  $('todayLabel').textContent=new Date().toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'}).toUpperCase();
  const first=(profile.displayName||'Vincenzo').trim().split(/\s+/)[0]||'Vincenzo';
  $('welcomeTitle').textContent='Ciao '+first+' 👋';
  const next=getNextEvents(1)[0];
  $('nextTitle').textContent=next?next.item.title:'Nessun impegno registrato';
  $('nextMeta').textContent=next?`${fmtDate(eventDate(next.item),{weekday:'long',day:'numeric',month:'long'})} · ${TYPE[next.item.kind]?.label||'Impegno'}${next.item.time?' · '+next.item.time:''}`:'Inizia aggiungendo una scadenza o un appuntamento.';
  const dueSoon=items.filter(x=>['deadline','workDeadline'].includes(x.kind)&&!isCompleted(x)).map(x=>({item:x,m:eventMoment(x)})).filter(x=>x.m&&(x.m.getTime()-Date.now())>=0&&(x.m.getTime()-Date.now())<=48*3600000).sort((a,b)=>a.m-b.m);
  const reminder=$('reminderAlert');reminder.hidden=!dueSoon.length;reminder.replaceChildren();
  if(dueSoon.length){
    const bold=document.createElement('strong');bold.textContent=`🔔 ${dueSoon.length} ${dueSoon.length===1?'scadenza entro':'scadenze entro'} 48 ore`;reminder.appendChild(bold);
    const detail=document.createElement('span');detail.textContent=dueSoon.map(x=>x.item.title+' · '+fmtDate(eventDate(x.item))).join(' • ');reminder.appendChild(detail);
  }
  const cycle=displayedCycle(),b=cycleBudget(cycle);
  const cycles=salaryCycles().filter(c=>c.start<=iso(new Date()));
  const cindex=cycles.findIndex(c=>c.id===cycle.id);
  $('budgetPrev').disabled=cycle.unconfirmed||cindex<=0;
  $('budgetNext').disabled=cycle.unconfirmed||cindex>=cycles.length-1;
  $('budgetMonth').textContent=cycle.unconfirmed?'Da confermare':cycle.endExclusive?'Archivio':'Attivo';
  $('budgetCycleTitle').textContent=cycleTitle(cycle);
  const expected=cycleNextExpectedDate(cycle);
  $('budgetCycleHint').textContent=cycle.unconfirmed
    ? 'Conferma lo stipendio da Lavoro → Stipendio per iniziare il primo ciclo.'
    :cycle.endExclusive?'Periodo chiuso; nessuna spesa è stata cancellata.'
      :'Si chiuderà quando confermerai il prossimo stipendio.'+(expected?' Data prevista: '+dayLabel(expected)+'.':'');
  $('budgetRemaining').textContent=money(b.remaining);
  $('budgetRemaining').style.color=b.remaining<0?'#a14636':'';
  $('budgetIncome').textContent=money(b.income);
  $('budgetExpenses').textContent=money(b.expenses);
  $('budgetPending').textContent=money(b.pending);
  $('budgetForecast').textContent=money(b.forecast);
  $('budgetExpectedSalary').textContent=money(b.salary);
  $('budgetWeekly').textContent=money(b.weekly);
  $('budgetPending').parentElement.firstChild.textContent=b.historical?'Ciclo chiuso ':'Ancora da pagare ';
  const history=lastTwelveCycles();
  const closed=history.filter(x=>x.cycle.endExclusive);
  $('budgetHistoryTotal').textContent=money(closed.reduce((sum,x)=>sum+x.remaining,0));
  $('budgetHistoryCount').textContent=closed.length+' cicli completati · avanzo registrato, non saldo bancario';
  renderExpenseAnalysis(cycle);
  renderSavingHome();
  renderSavings();


  fillPreview('homeDeadlines',['deadline'],3);
  fillPreview('homeAppointments',['appointment'],3);
  fillPreview('homeWorkDeadlines',['workDeadline'],3);
  fillPreview('homeWorkAppointments',['meeting'],3);
  fillPreview('houseDeadlinesPreview',['deadline'],3);
  fillPreview('houseAppointmentsPreview',['appointment'],3);
  fillPreview('workMeetingsPreview',['meeting'],3);
  fillPreview('workDeadlinesPreview',['workDeadline'],3);
  renderShiftPhoto();
  renderSalary();
  highlightTabs();renderHouse();renderWork();
}
function highlightTabs(){
  document.querySelectorAll('#houseTabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===houseTab));
  document.querySelectorAll('#workTabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===workTab));
}
function ordered(list){return list.slice().sort((a,b)=>{
  if(isCompleted(a)!==isCompleted(b))return Number(isCompleted(a))-Number(isCompleted(b));
  const x=eventDate(a)||'9999-12-31',y=eventDate(b)||'9999-12-31';
  return x.localeCompare(y)||String(a.title||'').localeCompare(String(b.title||''));
})}
function lastManualPayment(item){
  const records=Object.entries(item.payments||{}).filter(([due,r])=>validDate(due)&&r&&validDate(r.paidAt));
  records.sort((a,b)=>b[1].paidAt.localeCompare(a[1].paidAt)||b[0].localeCompare(a[0]));
  if(records.length)return records[0][0];
  if(item.lastCompletedOccurrence)return item.lastCompletedOccurrence;
  if((item.repeat||'none')==='none'&&item.done)return item.date;
  return null;
}
function row(item){
  const type=TYPE[item.kind]||TYPE.task,financial=isFinancial(item),done=isCompleted(item),repeat=item.repeat||'none',date=eventDate(item);
  const info=[];if(date)info.push(fmtDate(date));
  if(item.kind==='shift')info.push(`${item.start||'--:--'}–${item.end||'--:--'}`);
  else if(item.time)info.push('Ore '+item.time);
  if(Number(item.amount)>0)info.push(money(item.amount));
  if(repeat!=='none')info.push(repeat==='monthly'?'Mensile':'Annuale');
  let status='',paymentButtons='';
  if(financial){
    const auto=paymentMode(item)==='auto';
    const paid=date&&isPaymentPaid(item,date);
    const previous=lastManualPayment(item);
    const overdue=date&&date<iso(new Date())&&!paid;
    status=paid?`<span class="pill success">${auto?'RID contabilizzato (presunto)':'Pagato'}</span>`
      :`<span class="pill ${overdue?'warning':''}">${auto?'RID · contabilizzazione dal giorno dopo':(overdue?'Scaduto · da pagare':'Da pagare')}</span>`;
    if(!auto&&!paid&&date){
      paymentButtons=`<button class="edit-mini pay-btn" type="button" data-action="pay" data-id="${esc(item.id)}">✓ Pagato</button>`;
    }
    if(previous){
      paymentButtons+=`<button class="edit-mini" type="button" data-action="unpay" data-id="${esc(item.id)}">↶ Annulla pagamento</button>`;
    }
  }else if(item.kind==='income'){
    const received=incomeWasReceived(item);
    info.push(item.incomeSource||'Altra entrata');
    if(received){status='<span class="pill success">Incassata '+esc(fmtDate(incomeEffectiveDate(item)))+'</span>';}
    else{status='<span class="pill">Da incassare</span>';}
    paymentButtons=`<button class="edit-mini" type="button" data-action="${received?'incomeUndo':'incomeReceive'}" data-id="${esc(item.id)}">${received?'↶ Annulla incasso':'✓ Incassato'}</button>`;
  }else if(done){status='<span class="pill success">Completato</span>'}
  const btnDone=['task','appointment','meeting','workDeadline','leave'].includes(item.kind);
  return `<div class="item-row" data-kind="${esc(item.kind)}"><div><h3>${esc(item.title||type.label)}</h3><p>${esc(info.join(' · '))}</p>${item.notes?`<p>${esc(item.notes)}</p>`:''}${status}</div><div class="item-actions">${paymentButtons}${btnDone?`<button class="edit-mini" type="button" data-action="complete" data-id="${esc(item.id)}">${done?'Riapri':'✓ Fatto'}</button>`:''}<button class="edit-mini" type="button" data-action="edit" data-id="${esc(item.id)}">Modifica</button><button class="edit-mini danger" type="button" data-action="delete" data-id="${esc(item.id)}">×</button></div></div>`;
}
function renderHouse(){
  renderWeekly();
  if(houseTab==='weekly')return;
  const [title,hint]=SECTIONS[houseTab];$('houseSectionTitle').textContent=title;$('houseSectionHint').textContent=hint;
  const selected=ordered(items.filter(x=>TYPE[x.kind]?.group==='house'&&TYPE[x.kind]?.section===houseTab));
  $('houseItems').innerHTML=selected.length?selected.map(row).join(''):`<div class="empty">Non hai ancora inserito ${houseTab==='tasks'?'attività':'elementi'} in questa sezione.</div>`;
}

function renderIncomeSources(records){
  const sums=new Map();
  for(const x of records){if(!incomeWasReceived(x))continue;
    const source=x.incomeSource||'Altre entrate';
    sums.set(source,(sums.get(source)||0)+Math.max(0,Number(x.amount)||0));}
  return [...sums].map(([name,total])=>`<span>${esc(name)} <strong>${money(total)}</strong></span>`).join('')||'<small>Nessuna entrata extra ancora incassata.</small>';
}

function renderWork(){
  const showingSalary=workTab==='salary',showingShifts=workTab==='shifts';
  $('shiftPhotoPanel').hidden=!showingShifts;
  $('salaryPanel').hidden=!showingSalary;
  $('workSectionPanel').hidden=showingSalary||showingShifts;
  if(showingSalary){
    const cycle=displayedCycle();
    const extra=items.filter(i=>i.kind==='income'&&(inCycle(i.date,cycle)||
      (incomeWasReceived(i)&&inCycle(incomeEffectiveDate(i),cycle))));
    $('incomeCycleLabel').textContent='Entrate riferite al ciclo: '+cycleTitle(cycle)+'. Le entrate ancora previste non aumentano il budget.';
    $('incomeSourceSummary').innerHTML=renderIncomeSources(extra);
    $('incomeItems').innerHTML=extra.length?extra.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(row).join(''):'<div class="empty">Nessuna entrata extra per questo ciclo.</div>';
    return;
  }
  if(showingShifts)return;
  const [title,hint]=SECTIONS[workTab];$('workSectionTitle').textContent=title;$('workSectionHint').textContent=hint;
  const selected=ordered(items.filter(x=>TYPE[x.kind]?.group==='work'&&TYPE[x.kind]?.section===workTab));
  $('workItems').innerHTML=selected.length?selected.map(row).join(''):'<div class="empty">Non ci sono elementi per questa sezione.</div>';
}

// La foto dei turni si salva dentro il documento privato lifeUsers/{uid}.
// Non richiede Firebase Storage né nuove regole Firestore.
// Si mantiene UNA foto alla volta, compressa per rientrare nel limite Firestore di 1 MiB.
function renderShiftPhoto(){
  const data=typeof profile.shiftImageDataUrl==='string' && profile.shiftImageDataUrl.startsWith('data:image/') ? profile.shiftImageDataUrl : '';
  $('shiftPhotoEmpty').hidden=!!data;
  $('shiftPhotoOpen').hidden=!data;
  $('shiftPhotoActions').hidden=!data;
  $('shiftPhotoStatus').textContent=data?'Foto caricata · tocca per vederla':'Carica la foto dei tuoi turni';
  const photo=$('shiftPhotoImage');
  if(data){if(photo.src!==data)photo.src=data;}
  else{photo.removeAttribute('src');if(!$('shiftPhotoLightbox').hidden)closeShiftZoom();}
}
function imageToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error('Impossibile leggere la foto.'));
    reader.readAsDataURL(file);
  });
}
async function compressShiftPhoto(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Usa una foto JPG, PNG o WEBP.');
  if(file.size>25*1024*1024)throw new Error('Foto troppo grande: scegli un file sotto 25 MB.');
  const url=URL.createObjectURL(file);
  const picture=new Image();
  try{
    await new Promise((resolve,reject)=>{
      picture.onload=resolve;
      picture.onerror=()=>reject(new Error('La foto non può essere aperta.'));
      picture.src=url;
    });
    if(!picture.naturalWidth||!picture.naturalHeight)throw new Error('Immagine non valida.');
    const longest=Math.max(picture.naturalWidth,picture.naturalHeight);
    // Riduce prima la risoluzione e poi la qualità per mantenere il testo leggibile.
    for(const maxSide of [2600,2300,2000,1750,1500,1250]){
      const scale=Math.min(1,maxSide/longest);
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(picture.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(picture.naturalHeight*scale));
      const context=canvas.getContext('2d');
      if(!context)throw new Error('Compressione non supportata sul dispositivo.');
      context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(picture,0,0,canvas.width,canvas.height);
      for(const quality of [.93,.86,.78,.69]){
        const encoded=canvas.toDataURL('image/webp',quality);
        if(encoded.startsWith('data:image/webp;')&&encoded.length<700000)return encoded;
      }
    }
    throw new Error('Questa foto è troppo dettagliata. Prova con uno screenshot più piccolo.');
  }finally{URL.revokeObjectURL(url)}
}
function closeShiftZoom(){
  $('shiftPhotoLightbox').hidden=true;
  $('shiftPhotoZoomImage').removeAttribute('src');
  document.body.style.overflow='';
}
$('shiftPhotoUpload').addEventListener('click',()=>$('shiftPhotoInput').click());
$('shiftPhotoReplace').addEventListener('click',()=>$('shiftPhotoInput').click());
$('shiftPhotoInput').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file||!user)return;
  const owner=user.uid;
  $('shiftPhotoUpload').disabled=true;$('shiftPhotoReplace').disabled=true;
  toast('Preparazione e salvataggio della foto...');
  try{
    const dataUrl=await compressShiftPhoto(file);
    if(user?.uid!==owner)return;
    await setDoc(doc(db,'lifeUsers',owner),{
      shiftImageDataUrl:dataUrl,
      shiftImageUpdatedAt:serverTimestamp()
    },{merge:true});
    toast('Foto dei turni salvata su Firebase.');
  }catch(err){toast('Foto non salvata: '+cleanError(err));}
  finally{
    $('shiftPhotoInput').value='';
    $('shiftPhotoUpload').disabled=false;$('shiftPhotoReplace').disabled=false;
  }
});
$('shiftPhotoDelete').addEventListener('click',async()=>{
  if(!user||!profile.shiftImageDataUrl)return;
  if(!confirm('Eliminare la foto dei turni da PixelUp Life?'))return;
  try{await updateDoc(doc(db,'lifeUsers',user.uid),{
    shiftImageDataUrl:deleteField(),shiftImageUpdatedAt:deleteField()
  });toast('Foto dei turni eliminata.');}
  catch(err){toast('Eliminazione non riuscita: '+cleanError(err))}
});
$('shiftPhotoOpen').addEventListener('click',()=>{
  const data=profile.shiftImageDataUrl;if(!data)return;
  $('shiftPhotoZoomImage').src=data;
  $('shiftPhotoLightbox').hidden=false;document.body.style.overflow='hidden';
});
$('shiftPhotoClose').addEventListener('click',closeShiftZoom);
$('shiftPhotoLightbox').addEventListener('click',e=>{if(e.target===$('shiftPhotoLightbox'))closeShiftZoom()});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('shiftPhotoLightbox').hidden)closeShiftZoom()});

// La tendina è limitata a Casa quando si apre da Casa,
// e a Lavoro quando si apre da Lavoro. In home può mostrare entrambe.
function openModal(kind='deadline',id=null,scope='all'){
  const item=id?items.find(x=>x.id===id):null;
  editId=item?.id||null;
  const chosenKind=item?.kind||kind;
  const effectiveScope=item?(TYPE[item.kind]?.group||'all'):scope;
  for(const option of $('itemKind').options){
    const forbidden=effectiveScope!=='all'&&TYPE[option.value]?.group!==effectiveScope;
    option.disabled=forbidden;option.hidden=forbidden;
  }
  $('modalTitle').textContent=editId?'Modifica elemento':effectiveScope==='work'?'Nuovo elemento · Lavoro':effectiveScope==='house'?'Nuovo elemento · Casa':'Nuovo elemento';
  $('itemForm').reset();$('itemKind').value=chosenKind;
  $('itemTitle').value=item?.title||'';$('itemDate').value=item?.date||iso(new Date());$('itemTime').value=item?.time||'';
  $('itemStart').value=item?.start||'09:00';$('itemEnd').value=item?.end||'17:00';$('itemAmount').value=item?.amount??'';
  $('itemRepeat').value=item?.repeat||'none';$('itemIncludeBudget').checked=item?.includeBudget===true;
  $('itemPaymentMode').value=paymentMode(item||{});
  $('itemNotes').value=item?.notes||'';$('itemDone').checked=!!item?.done;
  $('itemIncomeSource').value=['Vinted','PixelUp','Secondo lavoro','Altro'].includes(item?.incomeSource)?item.incomeSource:'Altro';
  $('itemIncomeReceived').checked=item?incomeWasReceived(item):false;
  updateFormVisibility();$('modalBackdrop').hidden=false;document.body.style.overflow='hidden';
  setTimeout(()=>$('itemTitle').focus(),40);
}
function closeModal(){editId=null;$('modalBackdrop').hidden=true;document.body.style.overflow=''}
function updateFormVisibility(){
  const kind=$('itemKind').value,dated=kind!=='task',shift=kind==='shift';
  $('formDate').hidden=!dated;$('timeWrap').hidden=!['appointment','meeting'].includes(kind);
  $('formShift').hidden=!shift;$('amountWrap').hidden=!['deadline','expense','income'].includes(kind);
  $('recurrenceWrap').hidden=!['deadline','expense'].includes(kind);
  $('paymentModeWrap').hidden=!['deadline','expense'].includes(kind);
  $('includeBudgetWrap').hidden=kind!=='deadline';
  $('incomeSourceWrap').hidden=kind!=='income';$('incomeReceivedWrap').hidden=kind!=='income';
  $('doneWrap').hidden=!['task','appointment','meeting','workDeadline','leave'].includes(kind);
  $('itemDate').required=dated;$('itemStart').required=shift;$('itemEnd').required=shift;
  if(kind==='expense')$('itemIncludeBudget').checked=true;
}
$('itemKind').addEventListener('change',updateFormVisibility);
$('closeModal').addEventListener('click',closeModal);$('cancelItem').addEventListener('click',closeModal);
$('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))closeModal()});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modalBackdrop').hidden)closeModal()});
$('itemForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!user)return;
  const kind=$('itemKind').value;if(!TYPE[kind])return toast('Tipo non valido.');
  if($('itemKind').selectedOptions[0]?.disabled)return toast('Questa voce non appartiene alla sezione scelta.');
  const title=$('itemTitle').value.trim(),date=$('itemDate').value;
  if(!title)return toast('Inserisci un titolo.');
  if(kind!=='task'&&!validDate(date))return toast('Inserisci una data valida.');
  const value=Number($('itemAmount').value)||0;if(value<0)return toast('Importo non valido.');
  const previous=editId?items.find(i=>i.id===editId):null;
  const payload={
    kind,title,date:kind==='task'?'':date,
    time:['appointment','meeting'].includes(kind)?$('itemTime').value:'',
    start:kind==='shift'?$('itemStart').value:'',end:kind==='shift'?$('itemEnd').value:'',
    amount:['deadline','expense','income'].includes(kind)?value:0,
    repeat:['deadline','expense'].includes(kind)?$('itemRepeat').value:'none',
    includeBudget:kind==='deadline'&&$('itemIncludeBudget').checked,
    notes:$('itemNotes').value.trim(),
    ...(kind==='income'?{incomeSource:$('itemIncomeSource').value,received:$('itemIncomeReceived').checked,
      incomeReceivedDate:$('itemIncomeReceived').checked?date:''}:{}),
    done:isFinancial({kind})?(isFinancial(previous||{}) && previous?.done===true):$('itemDone').checked,
    paymentMode:isFinancial({kind})?$('itemPaymentMode').value:'manual',
    trackingStart:previous?.trackingStart||(previous?.date||iso(new Date())),
    updatedAt:serverTimestamp()
  };
  if(previous?.repeat!==payload.repeat||previous?.date!==payload.date||previous?.kind!==payload.kind){payload.lastCompletedOccurrence='';payload.done=false;}
  $('saveItem').disabled=true;
  try{
    const root=collection(db,'lifeUsers',user.uid,'items');
    if(editId)await updateDoc(doc(root,editId),payload);
    else await addDoc(root,{...payload,lastCompletedOccurrence:'',createdAt:serverTimestamp()});
    closeModal();toast('Elemento salvato online.');
  }catch(err){toast('Salvataggio non riuscito: '+cleanError(err))}
  finally{$('saveItem').disabled=false}
});
async function actOnRow(action,id){
  const item=items.find(x=>x.id===id);if(!item||!user)return;
  if(action==='edit'){openModal(item.kind,id,TYPE[item.kind]?.group||'all');return}
  const ref=doc(db,'lifeUsers',user.uid,'items',id);
  if(item.kind==='income'&&(action==='incomeReceive'||action==='incomeUndo')){
    if(action==='incomeUndo'&&!confirm('Annullare la conferma di questa entrata?'))return;
    try{await updateDoc(ref,{received:action==='incomeReceive',incomeReceivedDate:action==='incomeReceive'?iso(new Date()):'',updatedAt:serverTimestamp()});
      toast(action==='incomeReceive'?'Entrata confermata nel ciclo dello stipendio.':'Conferma incasso annullata.');}
    catch(err){toast(cleanError(err))}return;
  }
  if(action==='delete'){
    if(!confirm(`Eliminare definitivamente "${item.title}"?`))return;
    try{await deleteDoc(ref);toast('Elemento eliminato.')}catch(err){toast(cleanError(err))}
    return;
  }
  if(action==='pay'&&isFinancial(item)){
    if(paymentMode(item)==='auto')return toast('È impostato come RID automatico. Modifica la modalità per confermarlo manualmente.');
    const due=eventDate(item);if(!validDate(due)||isPaymentPaid(item,due))return toast('Pagamento già registrato.');
    try{
      await updateDoc(ref,{[`payments.${due}`]:{paidAt:iso(new Date()),amount:Math.max(0,Number(item.amount)||0)},updatedAt:serverTimestamp()});
      toast('Pagamento confermato: importo contabilizzato nel budget.');
    }catch(err){toast('Pagamento non salvato: '+cleanError(err))}
    return;
  }
  if(action==='unpay'&&isFinancial(item)){
    const due=lastManualPayment(item);if(!due)return;
    if(!confirm('Annullare la conferma di pagamento di '+item.title+' del '+fmtDate(due)+'?'))return;
    const changes={updatedAt:serverTimestamp()};
    if(paymentRecord(item,due))changes[`payments.${due}`]=deleteField();
    if(item.lastCompletedOccurrence===due)changes.lastCompletedOccurrence='';
    if((item.repeat||'none')==='none'&&item.done)changes.done=false;
    try{await updateDoc(ref,changes);toast('Pagamento annullato. Budget aggiornato.')}
    catch(err){toast(cleanError(err))}
    return;
  }
  if(action==='complete'&&!isFinancial(item)){
    try{await updateDoc(ref,{done:!item.done,updatedAt:serverTimestamp()});toast('Stato aggiornato.')}
    catch(err){toast(cleanError(err))}
  }
}
document.addEventListener('click',e=>{
  const rowButton=e.target.closest('[data-action][data-id]');
  if(rowButton){actOnRow(rowButton.dataset.action,rowButton.dataset.id);return}
  const nav=e.target.closest('[data-nav]');if(nav)showPage(nav.dataset.nav);
});

function goHouse(tab='deadlines'){houseTab=tab;if(tab==='weekly')chooseWeekOfToday();showPage('house')}
function goWork(tab='shifts'){workTab=tab;showPage('work')}
$('menuButton').addEventListener('click',()=>showPage('settings'));
$('homeHouse').addEventListener('click',()=>goHouse(houseTab));
$('homeWork').addEventListener('click',()=>goWork(workTab));
$('newButton').addEventListener('click',()=>{
  if(page==='savings'){const plan=activeSavingPlan();if(plan)startSavingContribution();else $('savingTarget').focus();}
  else if(page==='house'&&houseTab==='weekly')openWeeklyModal('alimentari');
  else if(page==='house')openModal(kindForSection[houseTab]||'deadline',null,'house');
  else if(page==='work'&&workTab==='shifts')$('shiftPhotoInput').click();
  else if(page==='work')openModal(kindForSection[workTab]||'workDeadline',null,'work');
  else openModal('deadline');
});
$('quickAddButton').addEventListener('click',()=>openModal('deadline'));
$('houseAddButton').addEventListener('click',()=>{if(houseTab==='weekly')openWeeklyModal('alimentari');else openModal(kindForSection[houseTab],null,'house')});
$('workAddButton').addEventListener('click',()=>{if(workTab==='shifts')$('shiftPhotoInput').click();else openModal(kindForSection[workTab],null,'work')});
$('incomeAdd').addEventListener('click',()=>openModal('income',null,'work'));
$('viewAllDeadline').addEventListener('click',()=>goHouse('deadlines'));
$('viewAllAppointments').addEventListener('click',()=>goHouse('appointments'));
$('viewAllWork').addEventListener('click',()=>goWork('meetings'));
$('viewAllWorkDeadlines').addEventListener('click',()=>goWork('workDeadlines'));
$('houseOpenDeadline').addEventListener('click',()=>goHouse('deadlines'));
$('houseOpenAppointments').addEventListener('click',()=>goHouse('appointments'));
$('workOpenMeetings').addEventListener('click',()=>goWork('meetings'));
$('workOpenDeadlines').addEventListener('click',()=>goWork('workDeadlines'));
$('workOpenShifts').addEventListener('click',()=>goWork('shifts'));
$('nextButton').addEventListener('click',()=>{
  const n=getNextEvents(1)[0];if(!n)return;
  const section=TYPE[n.item.kind]?.section;
  if(TYPE[n.item.kind]?.group==='house')goHouse(section);
  else goWork(section);
});
$('houseTabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;houseTab=b.dataset.tab;if(houseTab==='weekly')chooseWeekOfToday();render()});
$('workTabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;workTab=b.dataset.tab;render()});
$('settingsForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!user)return;
  const name=$('displayName').value.trim(),salary=Number($('salaryInput').value);
  if(!name||!Number.isFinite(salary)||salary<0){toast('Controlla nome e stipendio.');return}
  const mode=$('salaryScheduleMode').value;
  const offset=Number($('salaryOffset').value),day=Number($('salaryFixed').value);
  if(!['endOffset','fixed','manual'].includes(mode)||!Number.isInteger(offset)||offset<0||offset>30||!Number.isInteger(day)||day<1||day>31){toast('Controlla i parametri della data stipendio.');return}
  try{
    await setDoc(doc(db,'lifeUsers',user.uid),{displayName:name,salaryNet:salary,
      salarySchedule:{mode,offset,day,weekend:$('salaryWeekend').checked},updatedAt:serverTimestamp()},{merge:true});
    toast('Impostazioni salvate.');
  }catch(err){toast(cleanError(err))}
});
$('editSalary').addEventListener('click',()=>showPage('settings'));
$('notificationsButton').addEventListener('click',async()=>{
  if(!('Notification' in window)){toast('Notifiche non disponibili su questo browser.');return}
  try{
    const permission=await Notification.requestPermission();
    toast(permission==='granted'?'Notifiche abilitate quando la pagina è aperta.':'Permesso non concesso.');
    if(permission==='granted')checkReminders();
  }catch(err){toast('Errore: '+cleanError(err))}
});
function checkReminders(){
  if(!user||!('Notification' in window)||Notification.permission!=='granted')return;
  const now=Date.now();
  for(const item of items){
    if(item.kind!=='deadline'||isCompleted(item))continue;
    const date=eventDate(item),moment=eventMoment(item,date);if(!moment)continue;
    const delta=moment.getTime()-now;if(delta<0||delta>48*3600000)continue;
    const key=`${user.uid}/${item.id}/${date}`;if(notifiedThisSession.has(key))continue;
    notifiedThisSession.add(key);
    try{new Notification('PixelUp Life · Scadenza entro 48 ore',{body:`${item.title} — ${fmtDate(date)}${item.amount?' · '+money(item.amount):''}`,icon:'./icons/icon-192.png'})}
    catch(e){console.warn('Notifica non disponibile:',e)}
  }
}
setInterval(()=>{if(user){render();checkReminders();}},60*1000);

// Il service worker presente continua a gestire la PWA; le query ?v=life-v2
// evitano che CSS/JS vecchi vengano riutilizzati dopo l'aggiornamento.
if('serviceWorker' in navigator&&location.protocol==='https:')
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
