
/* PixelUp Life v5 — Casa e Lavoro + RID/manuali + foto turni.
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
let budgetPeriod = monthKey(new Date());
let weeklyPeriod = monthKey(new Date()), weeklySelected = Math.ceil(new Date().getDate()/7);
let salaryPeriod = monthKey(new Date());
let weeklyEditId = null, weeklyCategoryId = null;
let lastSalaryFormKey = null;
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
  user=current;items=[];profile={displayName:'Vincenzo',salaryNet:0};
  $('loginScreen').hidden=!!current;$('mainApp').hidden=!current;
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

// PAGAMENTI AUTOMATICI E MANUALI
const PAYMENT_CUTOVER = '2026-10-29';
const isFinancial = item => ['deadline','expense'].includes(item.kind);
const paymentMode = item => item.paymentMode === 'auto' ? 'auto' : 'manual';
function paymentRecord(item,date){return item.payments?.[date] || null}
function isPaymentPaid(item,date,today=iso(new Date())){
  if (!validDate(date)) return false;
  if (paymentRecord(item,date)) return true;
  if ((item.repeat||'none')==='none' && item.done) return true;
  if (item.lastCompletedOccurrence === date) return true;
  return paymentMode(item)==='auto' && date<today;
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

// SPESE SETTIMANALI
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
function weekBounds(period,week){
  const d=periodDate(period), last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  const start=1+(week-1)*7,end=Math.min(last,week*7);
  return start>last?null:{start,end,min:period+'-'+String(start).padStart(2,'0'),max:period+'-'+String(end).padStart(2,'0')};
}
function weekForDate(s){return Math.ceil(Number(s.slice(8,10))/7)}
function weeklyRecords(period=weeklyPeriod,week=null){return items.filter(x=>
  x.kind==='weeklyExpense'&&validDate(x.date)&&x.date.startsWith(period)&&
  (week===null||weekForDate(x.date)===week)
)}
function sumAmounts(records){return records.reduce((n,x)=>n+Math.max(0,Number(x.amount)||0),0)}
function weeklyCategories(){
  const custom=items.filter(x=>x.kind==='weeklyCategory'&&x.name).map(x=>({id:x.id,name:x.name,emoji:'✦'}));
  const all=[...WEEKLY_DEFAULT_CATEGORIES,...custom];
  const selected=weeklyRecords(weeklyPeriod,weeklySelected);
  for(const x of selected){
    if(!all.some(c=>c.id===x.categoryId))all.push({id:x.categoryId,name:x.categoryName||'Altra categoria',emoji:'📦'});
  }
  return all;
}
function renderWeekly(){
  $('weeklyPanel').hidden=houseTab!=='weekly';
  $('houseSectionPanel').hidden=houseTab==='weekly';
  $('weeklyMonth').textContent=periodLabel(weeklyPeriod);
  const last=periodDate(weeklyPeriod);
  const weeks=Math.ceil(new Date(last.getFullYear(),last.getMonth()+1,0).getDate()/7);
  weeklySelected=Math.max(1,Math.min(weeks,weeklySelected));
  $('weeklyTabs').innerHTML=Array.from({length:weeks},(_,i)=>{
    const w=weekBounds(weeklyPeriod,i+1);
    return `<button type="button" data-week="${i+1}" class="${weeklySelected===i+1?'active':''}">Sett. ${i+1}<small>${w.start}–${w.end}</small></button>`;
  }).join('');
  const thisWeek=weeklyRecords(weeklyPeriod,weeklySelected);
  $('weeklyWeekTotal').textContent=money(sumAmounts(thisWeek));
  $('weeklyMonthTotal').textContent=money(sumAmounts(weeklyRecords(weeklyPeriod)));
  $('weeklyCategoryCards').innerHTML=weeklyCategories().map(category=>{
    const current=thisWeek.filter(x=>x.categoryId===category.id);
    const monthTotal=sumAmounts(weeklyRecords(weeklyPeriod).filter(x=>x.categoryId===category.id));
    return `<div class="weekly-category-card">
      <div class="weekly-category-heading"><span>${esc(category.emoji)} ${esc(category.name)}</span><strong>${money(sumAmounts(current))}</strong><small>Mese: ${money(monthTotal)}</small></div>
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
  const bounds=weekBounds(weeklyPeriod,weeklySelected);
  $('weeklyDate').min=bounds.min;$('weeklyDate').max=bounds.max;
  const today=iso(new Date());
  $('weeklyDate').value=old?.date||(today>=bounds.min&&today<=bounds.max?today:bounds.max);
  $('weeklyAmount').value=old?.amount??'';
  $('weeklyNote').value=old?.notes||'';
  $('weeklyModalBackdrop').hidden=false;
  document.body.style.overflow='hidden';
}
function closeWeeklyModal(){weeklyEditId=null;weeklyCategoryId=null;$('weeklyModalBackdrop').hidden=true;document.body.style.overflow=''}
$('weeklyTabs').addEventListener('click',e=>{const b=e.target.closest('[data-week]');if(!b)return;weeklySelected=Number(b.dataset.week);renderWeekly()});
$('weeklyPrev').addEventListener('click',()=>{weeklyPeriod=periodMove(weeklyPeriod,-1);weeklySelected=1;render()});
$('weeklyNext').addEventListener('click',()=>{weeklyPeriod=periodMove(weeklyPeriod,1);weeklySelected=1;render()});
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
  const amount=Number($('weeklyAmount').value),date=$('weeklyDate').value,bounds=weekBounds(weeklyPeriod,weeklySelected);
  if(!Number.isFinite(amount)||amount<=0||amount>1e7)return toast('Inserisci un importo valido.');
  if(!validDate(date)||date<bounds.min||date>bounds.max)return toast('Scegli una data di questa settimana.');
  const old=weeklyEditId?items.find(x=>x.id===weeklyEditId):null;
  const category=old?{name:old.categoryName}:weeklyCategoryFor(weeklyCategoryId);
  const data={kind:'weeklyExpense',title:category.name,categoryId:weeklyCategoryId,categoryName:category.name,
    date,amount:Math.round(amount*100)/100,notes:$('weeklyNote').value.trim(),updatedAt:serverTimestamp()};
  $('weeklySave').disabled=true;
  try{
    if(weeklyEditId)await updateDoc(doc(db,'lifeUsers',user.uid,'items',weeklyEditId),data);
    else await addDoc(collection(db,'lifeUsers',user.uid,'items'),{...data,createdAt:serverTimestamp()});
    closeWeeklyModal();toast('Spesa registrata e conteggiata nel budget.');
  }catch(err){toast('Spesa non salvata: '+cleanError(err))}
  finally{$('weeklySave').disabled=false}
});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('weeklyModalBackdrop').hidden)closeWeeklyModal()});

// STIPENDIO V5
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
  $('salaryNext').textContent=due?'Accredito previsto: '+fmtDate(due,{day:'numeric',month:'long',year:'numeric'}):'Data di accredito da inserire per questo mese';
  $('salaryManualDateWrap').hidden=salarySchedule().mode!=='manual';
  $('salaryManualDate').value=salaryOverride(salaryPeriod)?.date||'';
  $('salaryManualDate').min=salaryPeriod+'-01';
  $('salaryManualDate').max=iso(lastDayMonth(periodDate(salaryPeriod)));
  const formKey=salaryPeriod+'|'+expected+'|'+(saved?.amount??'')+'|'+(saved?.receivedDate??'');
  if(formKey!==lastSalaryFormKey){
    $('salaryActualAmount').value=saved?.amount??expected;
    $('salaryActualDate').value=saved?.receivedDate||iso(new Date());
    lastSalaryFormKey=formKey;
  }
  $('salaryStatus').textContent=saved?'✓ Ricevuto '+money(saved.amount)+' il '+fmtDate(saved.receivedDate):'Da confermare · lo stipendio non è ancora conteggiato nelle entrate ricevute';
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
  $('salaryConfirm').disabled=true;
  try{
    await setDoc(doc(db,'lifeUsers',user.uid,'items','salaryReceipt_'+salaryPeriod),
      {kind:'salaryReceipt',period:salaryPeriod,date:date,receivedDate:date,amount:Math.round(amount*100)/100,updatedAt:serverTimestamp()},{merge:true});
    toast('Stipendio registrato nel mese di accredito.');
  }catch(err){toast('Accredito non salvato: '+cleanError(err))}
  finally{$('salaryConfirm').disabled=false}
});
$('salaryUndo').addEventListener('click',async()=>{
  if(!user||!salaryReceipt(salaryPeriod))return;
  if(!confirm('Annullare la conferma dello stipendio di '+periodLabel(salaryPeriod)+'?'))return;
  try{await deleteDoc(doc(db,'lifeUsers',user.uid,'items','salaryReceipt_'+salaryPeriod));toast('Conferma stipendio annullata.')}catch(err){toast(cleanError(err))}
});
$('budgetPrev').addEventListener('click',()=>{budgetPeriod=periodMove(budgetPeriod,-1);render()});
$('budgetNext').addEventListener('click',()=>{budgetPeriod=periodMove(budgetPeriod,1);render()});
$('openWeeklyFromHome').addEventListener('click',()=>{weeklyPeriod=budgetPeriod;weeklySelected=1;goHouse('weekly')});

function monthlyBudget(period=budgetPeriod){
  const monthStart=periodDate(period), monthEnd=lastDayMonth(monthStart);
  const now=new Date(),today=iso(now),thisMonth=period;
  let expenses=0,pending=0,extra=0,weekly=0,receivedSalary=0;
  for(const x of items){
    const amount=Math.max(0,Number(x.amount)||0);
    if(x.kind==='salaryReceipt'&&validDate(x.receivedDate)&&x.receivedDate.slice(0,7)===thisMonth)receivedSalary+=amount;
    if(x.kind==='weeklyExpense'&&validDate(x.date)&&x.date.slice(0,7)===thisMonth){weekly+=amount;expenses+=amount;continue}
    if(x.kind==='income'&&validDate(x.date)&&x.date.slice(0,7)===thisMonth)extra+=amount;
    if(!amount||!isFinancial(x)||(x.kind==='deadline'&&x.includeBudget!==true))continue;
    for(const [due,record] of Object.entries(x.payments||{})){
      if(validDate(due)&&record&&validDate(record.paidAt)&&record.paidAt.slice(0,7)===thisMonth)
        expenses+=Math.max(0,Number(record.amount??amount)||0);
    }
    if(paymentMode(x)==='auto'){
      const firstCheck=addDays(monthStart,-1);
      for(const due of paymentDatesBetween(x,firstCheck,monthEnd)){
        if(paymentRecord(x,due))continue;
        const posting=iso(addDays(fromISO(due),1));
        if(posting.slice(0,7)===thisMonth&&posting<=today)expenses+=amount;
        else if(due.slice(0,7)===thisMonth&&posting>today)pending+=amount;
      }
    }else{
      const since=(x.repeat&&x.repeat!=='none')
        ?fromISO([x.date,x.trackingStart||PAYMENT_CUTOVER].sort().at(-1)):fromISO(x.date);
      for(const due of paymentDatesBetween(x,since,monthEnd)){
        if(paymentRecord(x,due))continue;
        const legacy=(x.repeat||'none')==='none'?x.done:(x.lastCompletedOccurrence===due);
        if(legacy){if(due.slice(0,7)===thisMonth)expenses+=amount}
        else if(due.slice(0,7)===thisMonth)pending+=amount;
      }
    }
  }
  const expectedSalary=Math.max(0,Number(profile.salaryNet)||0);
  const receivedThisPeriod=!!salaryReceipt(period);
  const expectedUnreceived=receivedThisPeriod?0:expectedSalary;
  const income=receivedSalary+extra;
  return {income,receivedSalary,extra,expenses,pending,weekly,
    expectedUnreceived,remaining:income-expenses,
    forecast:income+expectedUnreceived-expenses-pending};
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
  const b=monthlyBudget(budgetPeriod);
  $('budgetMonth').textContent=periodLabel(budgetPeriod);
  $('budgetRemaining').textContent=money(b.remaining);$('budgetRemaining').style.color=b.remaining<0?'#a14636':'';
  $('budgetIncome').textContent=money(b.income);$('budgetExpenses').textContent=money(b.expenses);
  $('budgetPending').textContent=money(b.pending);$('budgetForecast').textContent=money(b.forecast);
  $('budgetExpectedSalary').textContent=money(b.expectedUnreceived);
  $('budgetWeekly').textContent=money(b.weekly);
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
function renderWork(){
  const showingSalary=workTab==='salary',showingShifts=workTab==='shifts';
  $('shiftPhotoPanel').hidden=!showingShifts;
  $('salaryPanel').hidden=!showingSalary;
  $('workSectionPanel').hidden=showingSalary||showingShifts;
  if(showingSalary){
    const extra=items.filter(i=>i.kind==='income'&&i.date?.slice(0,7)===salaryPeriod);
    $('incomeItems').innerHTML=extra.length?ordered(extra).map(row).join(''):'<div class="empty">Nessuna entrata extra registrata questo mese.</div>';
    return;
  }
  if(showingShifts)return;
  const [title,hint]=SECTIONS[workTab];$('workSectionTitle').textContent=title;$('workSectionHint').textContent=hint;
  const selected=ordered(items.filter(x=>TYPE[x.kind]?.group==='work'&&TYPE[x.kind]?.section===workTab));
  $('workItems').innerHTML=selected.length?selected.map(row).join(''):'<div class="empty">Non ci sono elementi per questa sezione.</div>';
}

// FOTO TURNI
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

// MODALI E SALVATAGGIO
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

// NAVIGAZIONE
function goHouse(tab='deadlines'){houseTab=tab;showPage('house')}
function goWork(tab='shifts'){workTab=tab;showPage('work')}
$('menuButton').addEventListener('click',()=>showPage('settings'));
$('homeHouse').addEventListener('click',()=>goHouse(houseTab));
$('homeWork').addEventListener('click',()=>goWork(workTab));
$('newButton').addEventListener('click',()=>{
  if(page==='house'&&houseTab==='weekly')openWeeklyModal('alimentari');
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
$('houseTabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;houseTab=b.dataset.tab;render()});
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

if('serviceWorker' in navigator&&location.protocol==='https:')
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
