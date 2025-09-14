<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>PixelUp AI – Chat</title>
<style>
  :root {
    --bg:#ffffff; 
    --card:#f8f9fa; 
    --muted:#6c757d; 
    --acc:#007bff; 
    --txt:#212529;
  }
  *{box-sizing:border-box}
  body{
    margin:0;
    background:var(--bg);
    color:var(--txt);
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial;
  }
  header{
    padding:16px;
    border-bottom:1px solid #dee2e6;
    display:flex;
    justify-content:space-between;
    align-items:center;
  }
  h1{font-size:18px;margin:0}
  .badge{
    font-size:12px;
    color:#fff;
    background:var(--acc);
    padding:4px 8px;
    border-radius:999px;
    margin-left:6px
  }
  main{max-width:920px;margin:0 auto;padding:16px}
  .card{
    background:var(--card);
    border:1px solid #dee2e6;
    border-radius:12px
  }
  .chat{height:62vh;overflow:auto;padding:16px}
  .row{display:flex;gap:8px;margin-top:10px}
  textarea{
    flex:1;
    min-height:56px;
    max-height:160px;
    resize:vertical;
    padding:12px;
    border-radius:12px;
    border:1px solid #ced4da;
    background:#fff;
    color:var(--txt);
  }
  button{
    border-radius:12px;
    border:1px solid #ced4da;
    background:#fff;
    color:var(--txt);
    padding:12px 14px;
    cursor:pointer;
  }
  button.primary{
    background:linear-gradient(90deg,#5bbcff,#6ee7ff);
    color:#fff;
    border:none;
    font-weight:700
  }
  .msg{
    max-width:75%;
    padding:10px 12px;
    border-radius:12px;
    margin:8px 0;
    white-space:pre-wrap;
    line-height:1.45
  }
  .user{background:#e9ecef;margin-left:auto}
  .bot{background:#ffffff;border:1px solid #dee2e6}
  .footer{color:var(--muted);text-align:center;font-size:12px;margin:12px 0}
</style>
</head>
<body>
<header>
  <div class="top">
    <h1>PixelUp AI <span class="badge">Chat</span></h1>
  </div>
</header>

<main>
  <div class="card">
    <div id="chat" class="chat"></div>
    <div style="padding:12px;border-top:1px solid #dee2e6">
      <div class="row">
        <textarea id="inp" placeholder="Scrivi qui la tua domanda..."></textarea>
        <button class="primary" id="send">Invia</button>
      </div>
      <div class="row">
        <button id="newChat">Nuova chat</button>
        <button id="copyLast">Copia ultima risposta</button>
        <button id="exportChat">Esporta .txt</button>
      </div>
    </div>
  </div>
  <p class="footer">© PixelUp – Chat IA per template. Powered by OpenAI.</p>
</main>

<script>
  const $ = (id)=>document.getElementById(id);
  const chatEl = $('chat'); 
  const inp = $('inp');

  // Endpoint Vercel (chiave nascosta lato server)
  const CHAT_ENDPOINT = "https://pixelup-ai-api.vercel.app/api/chatAI";

  // Parametro template da URL (?tpl=neo-mamme / wedding / cv / fitness …)
  const params = new URLSearchParams(location.search);
  const tpl = params.get('tpl') || 'neo-mamme';

  // Stato chat
  let history = [];

  function appendMsg(text, who='bot'){
    const div = document.createElement('div');
    div.className = 'msg ' + (who==='user' ? 'user' : 'bot');
    div.textContent = text;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  // Messaggio di benvenuto
  appendMsg(`Ciao! Questa è la chat dedicata a **${tpl}**.\nFornisci dettagli concreti e ti risponderò restando nel tema.`);

  // Invia messaggio
  $('send').onclick = async ()=>{
    const q = inp.value.trim();
    if(!q) return;
    appendMsg(q, 'user');
    inp.value='';

    appendMsg('⏳ Sto pensando...', 'bot');

    try{
      const res = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          tpl,
          messages: history.concat([{role:'user', content: q}])
        })
      });
      const data = await res.json();
      const text = data?.output || ('⚠️ Errore: ' + (data?.error || 'sconosciuto'));
      chatEl.lastChild.textContent = text;
      history.push({role:'user', content:q}, {role:'assistant', content:text});
    }catch(e){
      chatEl.lastChild.textContent = '⚠️ Errore server: ' + e.message;
    }
  };

  // Nuova chat
  $('newChat').onclick = ()=>{
    history = [];
    chatEl.innerHTML='';
    appendMsg(`Nuova chat su **${tpl}**. Dimmi pure!`);
  };

  // Copia ultima risposta
  $('copyLast').onclick = ()=>{
    const msgs = [...chatEl.querySelectorAll('.msg.bot')];
    if(!msgs.length) return;
    navigator.clipboard.writeText(msgs[msgs.length-1].textContent||'');
  };

  // Esporta chat
  $('exportChat').onclick = ()=>{
    const blob = new Blob([chatEl.innerText || ''], {type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pixelup-${tpl}-chat.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
</script>
</body>
</html>
