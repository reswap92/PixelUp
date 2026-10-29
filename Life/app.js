
/* PixelUp Life v2 — Casa e Lavoro separati.
   Stesso Firebase e stessi percorsi Firestore della v1.
   Nessuna scrittura in weddingEvents, accessCodes, transmindBookings o PayPal. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore, collection, doc, onSnapshot, addDoc,
  setDoc, updateDoc, deleteDoc, serverTimestamp
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

// "appointment" e "meeting" sono tipologie distinte.
const TYPE = {
  deadline:{label:'Scadenza Casa',group:'house',section:'deadlines'},
  appointment:{label:'Appuntamento Casa',group:'house',section:'appointments'},
  expense:{label:'Spesa',group:'house',section:'expenses'},
  task:{label:'Attività',group:'house',section:'tasks'},
  shift:{label:'Turno lavoro',group:'work',section:'shifts'},
  meeting:{label:'Appuntamento lavoro',group:'work',section:'meetings'},
  leave:{label:'Ferie / permesso',group:'work',section:'leave'},
  income:{label:'Entrata extra',group:'work',section:'salary'}
};
const SECTIONS = {
  deadlines:['Scadenze','Un avviso nell’app 48 ore prima; ripetizione mensile o annuale'],
  appointments:['Appuntamenti personali','Visite, appuntamenti, compleanni e impegni di Casa'],
  expenses:['Spese','Spese fisse e occasionali collegate al budget'],
  tasks:['Liste e attività','Le cose da fare e da acquistare'],
  shifts:['Turni di lavoro','La condivisione WhatsApp include solo date e orari'],
  meetings:['Appuntamenti di lavoro','Riunioni, corsi, call e colloqui professionali'],
  leave:['Ferie e permessi','Assenze pianificate, riposi e permessi']
};
const kindForSection = {deadlines:'deadline',appointments:'appointment',expenses:'expense',tasks:'task',shifts:'shift',meetings:'meeting',leave:'leave',salary:'income'};
let user = null;
let profile = {displayName:'Vincenzo',salaryNet:0};
let items = [];
let stopProfile = null, stopItems = null;
let page = 'home', houseTab = 'deadlines', workTab = 'shifts', editId = null;
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
  if(!current){$('password').value='';showLoginError('');banner('');return}
  $('currentAccount').textContent=current.email||'Account Firebase';
  showPage('home');banner('Caricamento dati personali...');
  const pRef=doc(db,'lifeUsers',current.uid);
  stopProfile=onSnapshot(pRef, snap=>{
    if(user?.uid!==current.uid)return;
    profile={displayName:'Vincenzo',salaryNet:0,...(snap.exists()?snap.data():{})};
    $('displayName').value=profile.displayName||'Vincenzo';
    $('salaryInput').value=Number(profile.salaryNet)||0;
    banner('');render();
  },err=>banner('Errore impostazioni: '+cleanError(err)));
  stopItems=onSnapshot(collection(db,'lifeUsers',current.uid,'items'),snap=>{
    if(user?.uid!==current.uid)return;
    items=snap.docs.map(d=>({id:d.id,...d.data()}));
    banner('');render();checkReminders();
  },err=>banner('Impossibile leggere Casa/Lavoro: '+cleanError(err)));
});

// Restituisce la prossima occorrenza per le scadenze ripetute.
function nextOccurrence(item,now=new Date()){
  if(!validDate(item.date))return null;
  const orig=fromISO(item.date),rep=item.repeat||'none';
  if(rep==='none')return {date:item.date,completed:!!item.done};
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
  let candidate;
  if(rep==='monthly'){
    candidate=dateForMonth(today.getFullYear(),today.getMonth(),orig.getDate());
    if(candidate<today && (today-candidate)/86400000>7)candidate=dateForMonth(today.getFullYear(),today.getMonth()+1,orig.getDate());
  }else if(rep==='yearly'){
    candidate=new Date(today.getFullYear(),orig.getMonth(),Math.min(orig.getDate(),new Date(today.getFullYear(),orig.getMonth()+1,0).getDate()),12);
    if(candidate<today && (today-candidate)/86400000>7)candidate=new Date(today.getFullYear()+1,orig.getMonth(),orig.getDate(),12);
  }else return {date:item.date,completed:!!item.done};
  if(candidate<orig)candidate=orig;
  let key=iso(candidate);
  if(item.lastCompletedOccurrence===key){
    candidate=rep==='monthly'?dateForMonth(candidate.getFullYear(),candidate.getMonth()+1,orig.getDate()):new Date(candidate.getFullYear()+1,orig.getMonth(),orig.getDate(),12);
    key=iso(candidate);
  }
  return {date:key,completed:false};
}
function eventDate(item){const occ=nextOccurrence(item);return occ?.date||item.date||''}
function eventMoment(item,occDate=eventDate(item)){
  if(!validDate(occDate))return null;
  const hhmm=item.kind==='shift'?(item.start||'09:00'):(item.time||(item.kind==='deadline'?'09:00':'12:00'));
  const full=new Date(`${occDate}T${/^\d{2}:\d{2}$/.test(hhmm)?hhmm:'12:00'}:00`);
  return !isNaN(full)?full:null;
}
function isCompleted(item){const occ=nextOccurrence(item);return occ?.completed||false}
function getNextEvents(limit=3){const now=new Date();return items
  .filter(x=>!['expense','income'].includes(x.kind))
  .filter(x=>!isCompleted(x))
  .map(x=>({item:x,moment:eventMoment(x)})).filter(x=>x.moment&&x.moment>=now)
  .sort((a,b)=>a.moment-b.moment).slice(0,limit)}

// Anteprime filtrate: Casa mostra deadline/appointment;
// Lavoro mostra shift/meeting/leave.
function previewItems(kinds,limit=3){
  const today=iso(new Date());
  return items.filter(x=>kinds.includes(x.kind)&&!isCompleted(x))
    .map(x=>({item:x,date:eventDate(x),moment:eventMoment(x)}))
    .filter(x=>validDate(x.date)&&x.date>=today&&x.moment)
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

function monthlyBudget(){
  const now=new Date(),thisMonth=monthKey(now);let expenses=0,extra=0;
  for(const x of items){
    const amount=Math.max(0,Number(x.amount)||0);if(!amount)continue;
    if(x.kind==='income'&&monthKey(fromISO(x.date)||now)===thisMonth)extra+=amount;
    const isCost=x.kind==='expense'||(x.kind==='deadline'&&x.includeBudget===true);
    if(!isCost)continue;
    if(x.repeat==='monthly'){
      if(validDate(x.date)&&fromISO(x.date)<=lastDayMonth(now))expenses+=amount;
    }else if(x.repeat==='yearly'){
      const d=fromISO(x.date);if(d&&(d.getMonth()===now.getMonth())&&d<=lastDayMonth(now))expenses+=amount;
    }else if(x.date?.slice(0,7)===thisMonth)expenses+=amount;
  }
  const salary=Math.max(0,Number(profile.salaryNet)||0);
  return {salary,extra,income:salary+extra,expenses,remaining:salary+extra-expenses};
}
function paydayInfo(){
  const now=new Date(),end=lastDayMonth(now);let date=end;
  if(now>new Date(end.getFullYear(),end.getMonth(),end.getDate(),23,59,59))date=lastDayMonth(new Date(now.getFullYear(),now.getMonth()+1,1));
  const days=Math.max(0,Math.ceil((new Date(date.getFullYear(),date.getMonth(),date.getDate(),23,59)-now)/86400000));
  return {date,days};
}

function render(){
  if(!user)return;
  $('todayLabel').textContent=new Date().toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'}).toUpperCase();
  const first=(profile.displayName||'Vincenzo').trim().split(/\s+/)[0]||'Vincenzo';
  $('welcomeTitle').textContent='Ciao '+first+' 👋';
  const next=getNextEvents(1)[0];
  $('nextTitle').textContent=next?next.item.title:'Nessun impegno registrato';
  $('nextMeta').textContent=next?`${fmtDate(eventDate(next.item),{weekday:'long',day:'numeric',month:'long'})} · ${TYPE[next.item.kind]?.label||'Impegno'}${next.item.time?' · '+next.item.time:''}${next.item.kind==='shift'?' · '+(next.item.start||'--:--')+'–'+(next.item.end||'--:--'):''}`:'Inizia aggiungendo una scadenza o un turno.';
  const dueSoon=items.filter(x=>x.kind==='deadline'&&!isCompleted(x)).map(x=>({item:x,m:eventMoment(x)})).filter(x=>x.m&&(x.m.getTime()-Date.now())>=0&&(x.m.getTime()-Date.now())<=48*3600000).sort((a,b)=>a.m-b.m);
  const reminder=$('reminderAlert');reminder.hidden=!dueSoon.length;reminder.replaceChildren();
  if(dueSoon.length){
    const bold=document.createElement('strong');bold.textContent=`🔔 ${dueSoon.length} ${dueSoon.length===1?'scadenza entro':'scadenze entro'} 48 ore`;reminder.appendChild(bold);
    const detail=document.createElement('span');detail.textContent=dueSoon.map(x=>x.item.title+' · '+fmtDate(eventDate(x.item))).join(' • ');reminder.appendChild(detail);
  }
  const b=monthlyBudget();
  $('budgetMonth').textContent=new Date().toLocaleDateString('it-IT',{month:'long',year:'numeric'});
  $('budgetRemaining').textContent=money(b.remaining);$('budgetRemaining').style.color=b.remaining<0?'#a14636':'';
  $('budgetIncome').textContent=money(b.income);$('budgetExpenses').textContent=money(b.expenses);
  fillPreview('homeDeadlines',['deadline'],3);
  fillPreview('homeAppointments',['appointment'],3);
  fillPreview('homeWorkUpcoming',['meeting','shift','leave'],4,true);
  fillPreview('houseDeadlinesPreview',['deadline'],3);
  fillPreview('houseAppointmentsPreview',['appointment'],3);
  fillPreview('workMeetingsPreview',['meeting'],3);
  fillPreview('workShiftsPreview',['shift'],3);
  const p=paydayInfo();$('salaryAmount').textContent=money(b.salary);
  $('salaryNext').textContent=`Prossimo accredito previsto: ${fmtDate(iso(p.date),{day:'numeric',month:'long',year:'numeric'})} (tra ${p.days} giorni)`;
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
function row(item){
  const type=TYPE[item.kind]||TYPE.task,done=isCompleted(item),repeat=item.repeat||'none',date=eventDate(item);
  const info=[];if(date)info.push(fmtDate(date));
  if(item.kind==='shift')info.push(`${item.start||'--:--'}–${item.end||'--:--'}`);
  else if(item.time)info.push('Ore '+item.time);
  if(Number(item.amount)>0)info.push(money(item.amount));
  if(repeat!=='none')info.push(repeat==='monthly'?'Mensile':'Annuale');
  const btnDone=['deadline','task','appointment','meeting','leave'].includes(item.kind);
  return `<div class="item-row" data-kind="${esc(item.kind)}"><div><h3>${esc(item.title||type.label)}</h3><p>${esc(info.join(' · '))}</p>${item.notes?`<p>${esc(item.notes)}</p>`:''}${done?'<span class="pill success">Completato</span>':item.kind==='deadline'&&date&&date<iso(new Date())?'<span class="pill">Da verificare</span>':''}${item.kind==='deadline'&&!done?'<span class="pill">Promemoria 48 ore prima</span>':''}</div><div class="item-actions">${btnDone?`<button class="edit-mini" type="button" data-action="complete" data-id="${esc(item.id)}">${done?'Riapri':'✓ Fatto'}</button>`:''}<button class="edit-mini" type="button" data-action="edit" data-id="${esc(item.id)}">Modifica</button><button class="edit-mini danger" type="button" data-action="delete" data-id="${esc(item.id)}">×</button></div></div>`;
}
function renderHouse(){
  const [title,hint]=SECTIONS[houseTab];$('houseSectionTitle').textContent=title;$('houseSectionHint').textContent=hint;
  const selected=ordered(items.filter(x=>TYPE[x.kind]?.group==='house'&&TYPE[x.kind]?.section===houseTab));
  $('houseItems').innerHTML=selected.length?selected.map(row).join(''):`<div class="empty">Non hai ancora inserito ${houseTab==='tasks'?'attività':'elementi'} in questa sezione.</div>`;
}
function renderWork(){
  const showingSalary=workTab==='salary';$('workShiftActions').hidden=workTab!=='shifts';
  $('salaryPanel').hidden=!showingSalary;$('workSectionPanel').hidden=showingSalary;
  if(showingSalary){
    const extra=items.filter(i=>i.kind==='income'&&i.date?.slice(0,7)===monthKey(new Date()));
    $('incomeItems').innerHTML=extra.length?ordered(extra).map(row).join(''):'<div class="empty">Nessuna entrata extra registrata questo mese.</div>';
    return;
  }
  const [title,hint]=SECTIONS[workTab];$('workSectionTitle').textContent=title;$('workSectionHint').textContent=hint;
  const selected=ordered(items.filter(x=>TYPE[x.kind]?.group==='work'&&TYPE[x.kind]?.section===workTab));
  $('workItems').innerHTML=selected.length?selected.map(row).join(''):'<div class="empty">Non ci sono elementi per questa sezione.</div>';
}

// La tendina è limitata a Casa quando si apre da Casa,
// e a Lavoro quando si apre da Lavoro.
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
  $('includeBudgetWrap').hidden=kind!=='deadline';
  $('doneWrap').hidden=!['deadline','task','appointment','meeting','leave'].includes(kind);
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
    done:['deadline','task','appointment','meeting','leave'].includes(kind)&&$('itemDone').checked,
    updatedAt:serverTimestamp()
  };
  if(previous?.repeat!==payload.repeat||previous?.date!==payload.date)payload.lastCompletedOccurrence='';
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
  if(action==='delete'){
    if(!confirm(`Eliminare definitivamente "${item.title}"?`))return;
    try{await deleteDoc(doc(db,'lifeUsers',user.uid,'items',id));toast('Elemento eliminato.')}
    catch(err){toast(cleanError(err))}
  }
  if(action==='complete'){
    try{
      const repeating=['monthly','yearly'].includes(item.repeat);
      const ref=doc(db,'lifeUsers',user.uid,'items',id);
      if(repeating){
        const date=eventDate(item);
        await updateDoc(ref,{lastCompletedOccurrence:item.lastCompletedOccurrence===date?'':date,updatedAt:serverTimestamp()});
      }else await updateDoc(ref,{done:!item.done,updatedAt:serverTimestamp()});
      toast('Stato aggiornato.');
    }catch(err){toast(cleanError(err))}
  }
}
document.addEventListener('click',e=>{
  const rowButton=e.target.closest('[data-action][data-id]');
  if(rowButton){actOnRow(rowButton.dataset.action,rowButton.dataset.id);return}
  const nav=e.target.closest('[data-nav]');if(nav)showPage(nav.dataset.nav);
});

function goHouse(tab='deadlines'){houseTab=tab;showPage('house')}
function goWork(tab='shifts'){workTab=tab;showPage('work')}
$('menuButton').addEventListener('click',()=>showPage('settings'));
$('homeHouse').addEventListener('click',()=>goHouse(houseTab));
$('homeWork').addEventListener('click',()=>goWork(workTab));
$('newButton').addEventListener('click',()=>{
  if(page==='house')openModal(kindForSection[houseTab]||'deadline',null,'house');
  else if(page==='work')openModal(kindForSection[workTab]||'shift',null,'work');
  else openModal('deadline');
});
$('quickAddButton').addEventListener('click',()=>openModal('deadline'));
$('houseAddButton').addEventListener('click',()=>openModal(kindForSection[houseTab],null,'house'));
$('workAddButton').addEventListener('click',()=>openModal(kindForSection[workTab],null,'work'));
$('incomeAdd').addEventListener('click',()=>openModal('income',null,'work'));
$('viewAllDeadline').addEventListener('click',()=>goHouse('deadlines'));
$('viewAllAppointments').addEventListener('click',()=>goHouse('appointments'));
$('viewAllWork').addEventListener('click',()=>goWork('meetings'));
$('houseOpenDeadline').addEventListener('click',()=>goHouse('deadlines'));
$('houseOpenAppointments').addEventListener('click',()=>goHouse('appointments'));
$('workOpenMeetings').addEventListener('click',()=>goWork('meetings'));
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
  try{
    await setDoc(doc(db,'lifeUsers',user.uid),{displayName:name,salaryNet:salary,updatedAt:serverTimestamp()},{merge:true});
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
setInterval(checkReminders,15*60*1000);

function shiftShareText(period){
  const now=new Date(),start=period==='week'?addDays(new Date(now.getFullYear(),now.getMonth(),now.getDate(),12),-((now.getDay()+6)%7)):firstDayMonth(now);
  const end=period==='week'?addDays(start,6):lastDayMonth(now);
  const entries=items.filter(x=>['shift','leave'].includes(x.kind)&&x.date>=iso(start)&&x.date<=iso(end)).sort((a,b)=>a.date.localeCompare(b.date)||String(a.start).localeCompare(String(b.start)));
  if(!entries.length){toast('Non ci sono turni o ferie nel periodo selezionato.');return ''}
  const header=`I miei turni · ${fmtDate(iso(start))} – ${fmtDate(iso(end))}`;
  const lines=entries.map(x=>`${fmtDate(x.date,{weekday:'long',day:'2-digit',month:'short'})}: ${x.kind==='leave'?x.title:(x.start||'--:--')+'–'+(x.end||'--:--')}`);
  return [header,'',...lines,'','Condiviso con PixelUp Life'].join('\n');
}
function shareWhatsapp(period){const text=shiftShareText(period);if(!text)return;window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener,noreferrer')}
$('shareWeek').addEventListener('click',()=>shareWhatsapp('week'));
$('shareMonth').addEventListener('click',()=>shareWhatsapp('month'));

// Mantiene attiva la PWA.
if('serviceWorker' in navigator&&location.protocol==='https:')
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
