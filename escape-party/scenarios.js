<script type="module">
// normalizza input
export const norm = s => (s||'').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');

// Ogni step può essere: image | video | audio
// { type, src, prompt, answer }
export const SCENARIOS = [
  { id:'doom', title:'Sotterranei del Doom', steps:[
    { type:'image', src:'assets/doom-1.jpg', prompt:'Codice sul lucchetto (4 cifre)', answer:'3412' },
    { type:'image', src:'assets/doom-2.jpg', prompt:'Parola nascosta nelle rune',   answer:'chiave' },
    { type:'audio', src:'assets/amb_doom3.mp3', prompt:'Conta i rintocchi',         answer:'7' },
    { type:'image', src:'assets/doom-4.jpg', prompt:'Parola allo specchio (senza accenti)', answer:'verita' },
    { type:'image', src:'assets/doom-5.jpg', prompt:'Chiave Finale', answer:'salvezza' },
  ]},
  { id:'nave', title:'La Nave Fantasma', steps:[
    { type:'image', src:'assets/nave-1.jpg', prompt:'Quante lanterne si vedono?', answer:'2' },
    { type:'image', src:'assets/nave-2.jpg', prompt:'Coordinate scritte? (es: 13N)', answer:'13n' },
    { type:'image', src:'assets/nave-3.jpg', prompt:'Direzione della bussola?', answer:'ne' },
    { type:'image', src:'assets/nave-4.jpg', prompt:'Numero di vele spiegate', answer:'3' },
    { type:'image', src:'assets/nave-5.jpg', prompt:'Parola sul diario (macchia accanto a?)', answer:'mare' }
  ]},
  { id:'lab', title:'Laboratorio Abbandonato', steps:[
    { type:'image', src:'assets/lab-1.jpg', prompt:'Simbolo sulla porta?', answer:'biohazard' },
    { type:'image', src:'assets/lab-2.jpg', prompt:'Formula sul muro?', answer:'c6h12o6' },
    { type:'image', src:'assets/lab-3.jpg', prompt:'Colore reagente finale', answer:'verde' },
    { type:'image', src:'assets/lab-4.jpg', prompt:'Ora sul monitor rotto', answer:'0317' },
    { type:'image', src:'assets/lab-5.jpg', prompt:'Parola sul terminale', answer:'override' },
  ]},
  { id:'tempio', title:'Tempio delle Sabbie', steps:[
    { type:'image', src:'assets/tempio-1.jpg', prompt:'Quante statue guardiane?', answer:'2' },
    { type:'image', src:'assets/tempio-2.jpg', prompt:'Animale inciso?', answer:'scarabeo' },
    { type:'image', src:'assets/tempio-3.jpg', prompt:'Da dove entra il sole? (n/s/e/o)', answer:'est' },
    { type:'image', src:'assets/tempio-4.jpg', prompt:'Scrivi un simbolo del papiro (es: ankh)', answer:'ankh' },
    { type:'image', src:'assets/tempio-5.jpg', prompt:'Parola nel sigillo (SALVTS→ latinizzato)', answer:'salvts' },
  ]},
  { id:'manicomio', title:'Manicomio Dimenticato', steps:[
    { type:'image', src:'assets/manicomio-1.jpg', prompt:'Numero della stanza', answer:'209' },
    { type:'image', src:'assets/manicomio-2.jpg', prompt:'Nome del farmaco', answer:'litio' },
    { type:'image', src:'assets/manicomio-3.jpg', prompt:'Oggetto a terra', answer:'siringa' },
    { type:'image', src:'assets/manicomio-4.jpg', prompt:'Ora ferma', answer:'0000' },
    { type:'image', src:'assets/manicomio-5.jpg', prompt:'Scritta sul muro', answer:'liberami' },
  ]},
];

// Ordine livelli (5 scenari)
export const SCENARIO_ORDER = ['doom','nave','lab','tempio','manicomio'];
export const DURATION_MIN = 50; // 40–60 consigliato
export const MIN_PLAYERS = 4, MAX_PLAYERS = 8;
</script>
