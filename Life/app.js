<!doctype html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#4d5a3a">
  <meta name="description" content="PixelUp Life: casa, lavoro e scadenze in un unico spazio privato.">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="PixelUp Life">
  <link rel="manifest" href="./manifest.json">
  <link rel="apple-touch-icon" href="./icons/icon-192.png">
  <link rel="stylesheet" href="./styles.css?v=life-v5">
  <title>PixelUp Life · Casa e Lavoro</title>
</head>
<body>
  <div class="shell">
    <section id="loginScreen" class="login-shell" aria-labelledby="loginTitle">
      <div class="login-brand">
        <div class="brand-mark">P<span>✦</span></div>
        <div class="overline">IL TUO SPAZIO PRIVATO</div>
        <h1 id="loginTitle">PixelUp Life</h1>
        <p>Casa e lavoro, senza perdere di vista niente.</p>
      </div>
      <form id="loginForm" class="surface login-form">
        <h2>Accedi</h2>
        <p class="subtle">Usa l'account Firebase Authentication abilitato per PixelUp Life.</p>
        <label>Email<input id="email" type="email" autocomplete="username" required placeholder="La tua email"></label>
        <label>Password<input id="password" type="password" autocomplete="current-password" required placeholder="La tua password"></label>
        <div id="loginError" class="error" role="alert" hidden></div>
        <button class="primary" id="loginButton" type="submit">Entra nella dashboard</button>
        <button class="text-btn" type="button" id="resetPasswordButton">Password dimenticata?</button>
      </form>
      <p class="fineprint">I dati personali vengono salvati nel progetto Firebase esistente, ma in uno spazio distinto dai matrimoni.</p>
    </section>

    <div id="mainApp" hidden>
      <header class="topbar">
        <button class="icon-btn" id="menuButton" aria-label="Apri impostazioni" title="Impostazioni">☰</button>
        <div class="top-title"><strong>PixelUp Life</strong><span>La tua vita, organizzata</span></div>
        <button class="icon-btn plus-icon" id="newButton" aria-label="Aggiungi un elemento">＋</button>
      </header>
      <div class="banner" id="banner" role="status" hidden></div>

      <div id="homeView" class="view active">
        <div class="welcome">
          <div class="overline" id="todayLabel">OGGI</div>
          <h1 id="welcomeTitle">Ciao!</h1>
          <p>Le cose importanti, tutte qui.</p>
        </div>
        <button id="nextButton" class="surface next-card" type="button">
          <div class="card-kicker"><span class="dot"></span> IL PROSSIMO IMPEGNO</div>
          <div id="nextTitle" class="next-title">Nessun impegno registrato</div>
          <div id="nextMeta" class="subtle">Inizia aggiungendo una scadenza o un turno.</div>
          <div class="arrow">↗</div>
        </button>
        <div id="reminderAlert" class="reminder-alert" hidden></div>

        <div class="two-cards">
          <button id="homeHouse" class="category-card" type="button">
            <div class="category-icon">⌂</div>
            <div class="category-name">Casa</div>
            <div class="category-description">Scadenze, appuntamenti, spese e liste</div>
            <span class="category-arrow">→</span>
          </button>
          <button id="homeWork" class="category-card" type="button">
            <div class="category-icon">▣</div>
            <div class="category-name">Lavoro</div>
            <div class="category-description">Turni, appuntamenti, stipendio e ferie</div>
            <span class="category-arrow">→</span>
          </button>
        </div>

        <div class="surface budget-card">
          <div class="card-header"><h2>Budget del mese</h2><div class="month-switch"><button id="budgetPrev" type="button" aria-label="Mese precedente">‹</button><span id="budgetMonth" class="subtle"></span><button id="budgetNext" type="button" aria-label="Mese successivo">›</button></div></div>
          <div id="budgetRemaining" class="big-number">€ 0,00</div>
          <div class="subtle">Entrate ricevute − spese effettive. Non rappresenta il saldo in banca.</div>
          <div class="budget-breakdown"><span>Entrate ricevute <strong id="budgetIncome">€ 0</strong></span><span>Spese contabilizzate <strong id="budgetExpenses">€ 0</strong></span></div>
          <div class="budget-followup"><span>Ancora da pagare <strong id="budgetPending">€ 0</strong></span><span>Residuo previsto* <strong id="budgetForecast">€ 0</strong></span></div>
          <div class="budget-followup"><span>Stipendio previsto, non ricevuto <strong id="budgetExpectedSalary">€ 0</strong></span><span>Spese settimanali registrate <strong id="budgetWeekly">€ 0</strong></span></div>
          <p class="subtle">* Comprende lo stipendio previsto e le spese ancora da pagare. Non è il saldo reale del conto.</p>
          <button id="openWeeklyFromHome" type="button" class="small-outline budget-weekly-link">🛒 Inserisci spese settimanali</button>
        </div>

        <div class="group-heading">
          <div><div class="overline">VITA PERSONALE</div><h2>Da ricordare · Casa</h2></div>
        </div>
        <div class="summary-grid">
          <section class="surface compact-card" aria-labelledby="homeDeadlinesTitle">
            <div class="compact-head"><h3 id="homeDeadlinesTitle">🔔 Scadenze</h3><button id="viewAllDeadline" type="button" class="link-btn">Vedi tutte →</button></div>
            <div id="homeDeadlines" class="mini-list"></div>
          </section>
          <section class="surface compact-card" aria-labelledby="homeAppointmentsTitle">
            <div class="compact-head"><h3 id="homeAppointmentsTitle">📅 Appuntamenti</h3><button id="viewAllAppointments" type="button" class="link-btn">Vedi tutti →</button></div>
            <div id="homeAppointments" class="mini-list"></div>
          </section>
        </div>

        <div class="group-heading work-home-heading">
          <div><div class="overline">VITA PROFESSIONALE</div><h2>Da ricordare · Lavoro</h2></div>
        </div>
        <div class="summary-grid">
          <section class="surface compact-card" aria-labelledby="homeWorkDeadlinesTitle">
            <div class="compact-head"><h3 id="homeWorkDeadlinesTitle">🔔 Scadenze</h3><button id="viewAllWorkDeadlines" class="link-btn" type="button">Vedi tutte →</button></div>
            <div id="homeWorkDeadlines" class="mini-list"></div>
          </section>
          <section class="surface compact-card" aria-labelledby="homeWorkAppointmentsTitle">
            <div class="compact-head"><h3 id="homeWorkAppointmentsTitle">📅 Appuntamenti</h3><button id="viewAllWork" class="link-btn" type="button">Vedi tutti →</button></div>
            <div id="homeWorkAppointments" class="mini-list"></div>
          </section>
        </div>
        <button id="quickAddButton" class="quick-btn" type="button">＋ Aggiungi un impegno</button>
      </div>

      <div id="houseView" class="view">
        <div class="view-heading"><button class="back-btn" type="button" data-nav="home" aria-label="Torna alla home">←</button><div><div class="overline">VITA PERSONALE</div><h1>Casa</h1></div></div>
        <p class="section-intro">Solo i tuoi impegni personali. Gli appuntamenti di lavoro restano nella sezione Lavoro.</p>
        <div class="summary-grid section-summary">
          <section class="surface compact-card" aria-labelledby="houseDeadlineTitle">
            <div class="compact-head"><h3 id="houseDeadlineTitle">🔔 Scadenze</h3><button id="houseOpenDeadline" class="link-btn" type="button">Apri →</button></div>
            <div id="houseDeadlinesPreview" class="mini-list"></div>
          </section>
          <section class="surface compact-card" aria-labelledby="houseAppointmentsTitle">
            <div class="compact-head"><h3 id="houseAppointmentsTitle">📅 Appuntamenti</h3><button id="houseOpenAppointments" class="link-btn" type="button">Apri →</button></div>
            <div id="houseAppointmentsPreview" class="mini-list"></div>
          </section>
        </div>
        <nav class="tabs" id="houseTabs" aria-label="Sezioni casa">
          <button data-tab="deadlines" class="active">Scadenze</button>
          <button data-tab="appointments">Appuntamenti</button>
          <button data-tab="expenses">Pagamenti</button>
          <button data-tab="weekly">Spese settimanali</button>
          <button data-tab="tasks">Liste</button>
        </nav>
        <div id="weeklyPanel" class="surface section-panel weekly-panel" hidden>
          <div class="card-header"><div><h2>Spese settimanali</h2><p class="subtle section-hint">Benzina, alimentari, Jay e tutte le altre spese effettive. Ogni inserimento viene conteggiato subito nel budget.</p></div></div>
          <div class="month-switch weekly-month"><button type="button" id="weeklyPrev" aria-label="Mese precedente">‹</button><strong id="weeklyMonth"></strong><button type="button" id="weeklyNext" aria-label="Mese successivo">›</button></div>
          <div class="weekly-tabs" id="weeklyTabs" aria-label="Settimane del mese"></div>
          <div class="weekly-summary"><span>Spesa settimana <strong id="weeklyWeekTotal">€ 0</strong></span><span>Totale mese <strong id="weeklyMonthTotal">€ 0</strong></span></div>
          <div id="weeklyCategoryCards" class="weekly-categories"></div>
          <div class="weekly-custom">
            <button id="weeklyNewCategory" type="button" class="small-outline">＋ Nuova categoria</button>
            <form id="weeklyCategoryForm" class="weekly-new-category" hidden>
              <label>Nome categoria<input id="weeklyCategoryName" maxlength="45" placeholder="Es. Pannolini, farmacia, auto" required></label>
              <button type="submit" class="small-outline">Salva categoria</button>
              <button id="weeklyCancelCategory" type="button" class="text-btn">Annulla</button>
            </form>
          </div>
          <h3 class="weekly-entries-heading">Spese registrate questa settimana</h3>
          <div id="weeklyEntries" class="rows"></div>
        </div>
        <div id="houseSectionPanel" class="section-panel surface">
          <div class="card-header"><div><h2 id="houseSectionTitle">Scadenze</h2><p id="houseSectionHint" class="subtle section-hint">Promemoria 48 ore prima</p></div><button class="add-sm" type="button" id="houseAddButton">＋ Aggiungi</button></div>
          <div id="houseItems" class="rows"></div>
        </div>
      </div>

      <div id="workView" class="view">
        <div class="view-heading"><button class="back-btn" type="button" data-nav="home" aria-label="Torna alla home">←</button><div><div class="overline">VITA PROFESSIONALE</div><h1>Lavoro</h1></div></div>
        <p class="section-intro">Scadenze e appuntamenti di lavoro separati dalla Casa. I turni sono soltanto una foto, non eventi in agenda.</p>
        <div class="summary-grid section-summary">
          <section class="surface compact-card" aria-labelledby="workDeadlinesTitle">
            <div class="compact-head"><h3 id="workDeadlinesTitle">🔔 Scadenze</h3><button id="workOpenDeadlines" class="link-btn" type="button">Apri →</button></div>
            <div id="workDeadlinesPreview" class="mini-list"></div>
          </section>
          <section class="surface compact-card" aria-labelledby="workMeetingsTitle">
            <div class="compact-head"><h3 id="workMeetingsTitle">📅 Appuntamenti</h3><button id="workOpenMeetings" class="link-btn" type="button">Apri →</button></div>
            <div id="workMeetingsPreview" class="mini-list"></div>
          </section>
        </div>
        <button id="workOpenShifts" class="surface shift-photo-shortcut" type="button">
          <span class="shift-shortcut-icon">🖼️</span>
          <span class="shift-shortcut-text"><strong>Turni di lavoro</strong><small id="shiftPhotoStatus">Apri e carica la foto dei turni</small></span>
          <span class="shift-shortcut-arrow">→</span>
        </button>
        <nav class="tabs" id="workTabs" aria-label="Sezioni lavoro">
          <button data-tab="workDeadlines" class="active">Scadenze</button>
          <button data-tab="meetings">Appuntamenti</button>
          <button data-tab="shifts">Turni · Foto</button>
          <button data-tab="salary">Stipendio</button>
          <button data-tab="leave">Ferie</button>
        </nav>
        <div id="shiftPhotoPanel" class="surface section-panel shift-photo-panel" hidden>
          <div class="card-header"><div><h2>Foto dei turni</h2><p class="subtle section-hint">Carica una foto dal telefono. La ritroverai qui quando accedi, anche da un altro dispositivo.</p></div></div>
          <input type="file" id="shiftPhotoInput" accept="image/jpeg,image/png,image/webp" hidden>
          <div id="shiftPhotoEmpty" class="shift-photo-empty">
            <div class="shift-photo-emoji">📷</div>
            <p>Non hai ancora caricato una foto dei turni.</p>
            <button id="shiftPhotoUpload" type="button" class="primary">＋ Carica foto dei turni</button>
          </div>
          <button id="shiftPhotoOpen" type="button" class="shift-photo-preview" aria-label="Ingrandisci foto dei turni" hidden>
            <img id="shiftPhotoImage" alt="Foto del calendario dei turni caricata dall'utente">
            <span>🔍 Tocca per ingrandire</span>
          </button>
          <div id="shiftPhotoActions" class="shift-photo-actions" hidden>
            <button id="shiftPhotoReplace" class="small-outline" type="button">↻ Sostituisci foto</button>
            <button id="shiftPhotoDelete" class="danger-outline" type="button">Elimina foto</button>
          </div>
          <p class="subtle shift-photo-notice">L'immagine viene compressa e salvata nel tuo spazio privato Firestore. La foto precedente viene sostituita, senza modificare gli altri impegni.</p>
        </div>
        <div id="salaryPanel" class="surface salary-panel" hidden>
          <div class="card-header"><h2>Stipendio</h2><button class="add-sm" id="editSalary" type="button">Impostazioni</button></div>
          <div class="month-switch salary-month"><button type="button" id="salaryPrev" aria-label="Mese precedente">‹</button><strong id="salaryMonth"></strong><button type="button" id="salaryNextMonth" aria-label="Mese successivo">›</button></div>
          <div class="subtle">Previsto per il mese</div><div id="salaryAmount" class="big-number">€ 0,00</div>
          <p id="salaryNext" class="subtle"></p>
          <p id="salaryStatus" class="salary-status"></p>
          <div id="salaryManualDateWrap" class="salary-manual-date" hidden>
            <label>Data prevista per questo mese<input id="salaryManualDate" type="date"></label>
            <button id="salarySaveManualDate" type="button" class="small-outline">Salva data</button>
          </div>
          <form id="salaryReceiptForm" class="form-grid salary-receipt-form">
            <label>Importo effettivo ricevuto (€)<input id="salaryActualAmount" type="number" min="0.01" step="0.01" inputmode="decimal" required></label>
            <label>Data effettiva di accredito<input id="salaryActualDate" type="date" required></label>
            <button type="submit" class="primary" id="salaryConfirm">✓ Conferma stipendio ricevuto</button>
            <button type="button" class="danger-outline" id="salaryUndo" hidden>Annulla conferma di questo mese</button>
          </form>
          <div class="salary-note">La data prevista è un promemoria: lo stipendio entra nel budget effettivo solo dopo la conferma. Per anticiparlo a un giorno lavorativo, puoi saltare sabati e domeniche.</div>
          <div class="card-header salary-extra"><h2>Entrate extra</h2><button class="add-sm" type="button" id="incomeAdd">＋ Aggiungi</button></div><div id="incomeItems" class="rows"></div>
        </div>
        <div id="workSectionPanel" class="section-panel surface">
          <div class="card-header"><div><h2 id="workSectionTitle">Turni di lavoro</h2><p id="workSectionHint" class="subtle section-hint">Condividi senza stipendio o note private</p></div><button class="add-sm" id="workAddButton" type="button">＋ Aggiungi</button></div>
          <div id="workItems" class="rows"></div>
        </div>
      </div>

      <div id="settingsView" class="view">
        <div class="view-heading"><button class="back-btn" type="button" data-nav="home" aria-label="Torna alla home">←</button><div><div class="overline">ACCOUNT</div><h1>Impostazioni</h1></div></div>
        <div class="surface section-panel">
          <form id="settingsForm" class="form-grid">
            <label>Come vuoi essere chiamato?<input id="displayName" maxlength="60" placeholder="Il tuo nome" required></label>
            <label>Stipendio netto previsto (€)<input id="salaryInput" type="number" min="0" step="0.01" inputmode="decimal" required></label>
            <label>Data prevista di accredito
              <select id="salaryScheduleMode">
                <option value="endOffset">Giorni prima della fine del mese</option>
                <option value="fixed">Giorno fisso del mese</option>
                <option value="manual">Data manuale, diversa ogni mese</option>
              </select>
            </label>
            <label id="salaryOffsetWrap">Quanti giorni prima della fine del mese?<input id="salaryOffset" type="number" min="0" max="30" step="1" value="1"></label>
            <label id="salaryFixedWrap" hidden>Giorno fisso del mese (1–31)<input id="salaryFixed" type="number" min="1" max="31" step="1" value="30"></label>
            <label id="salaryWeekendWrap" class="checkbox-line"><input id="salaryWeekend" type="checkbox"> Se la data cade nel weekend, anticipala al venerdì</label>
            <div class="subtle">Esempio: un giorno prima della fine di ottobre = 30 ottobre. Le festività bancarie non sono calcolate automaticamente. Lo stipendio si considera ricevuto solo dopo la tua conferma.</div>
            <button type="submit" class="primary">Salva impostazioni</button>
          </form>
        </div>
        <div class="surface section-panel"><h2>Promemoria</h2><p class="subtle spacer-text">Ogni scadenza non completata viene segnalata nell'app nelle 48 ore precedenti. Le notifiche del browser sono possibili quando l'app è aperta. Per riceverle anche ad app chiusa servirà un servizio programmato.</p><button id="notificationsButton" class="small-outline" type="button">Attiva notifiche del browser</button></div>
        <div class="surface section-panel"><h2>Il tuo account</h2><p class="subtle" id="currentAccount"></p><button id="logoutButton" class="danger-outline" type="button">Esci</button></div>
      </div>
      <div class="bottom-spacer"></div>
    </div>
  </div>

  <div id="modalBackdrop" class="modal-backdrop" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-top"><div><div class="overline">PIXELUP LIFE</div><h2 id="modalTitle">Aggiungi</h2></div><button id="closeModal" class="close" type="button" aria-label="Chiudi">×</button></div>
      <form id="itemForm">
        <div class="form-grid">
          <label>Sezione<select id="itemKind" required>
            <option value="deadline">Casa · Scadenza</option>
            <option value="appointment">Casa · Appuntamento</option>
            <option value="expense">Casa · Spesa</option>
            <option value="task">Casa · Lista / attività</option>
            <option value="workDeadline">Lavoro · Scadenza</option>
            <option value="meeting">Lavoro · Appuntamento / call</option>
            <option value="leave">Lavoro · Ferie / permesso</option>
            <option value="income">Lavoro · Entrata extra</option>
          </select></label>
          <label>Titolo<input id="itemTitle" required maxlength="140" placeholder="Es. Assicurazione auto"></label>
          <div id="formDate" class="form-row"><label>Data<input id="itemDate" type="date"></label><label id="timeWrap">Ora<input id="itemTime" type="time"></label></div>
          <div id="formShift" class="form-row" hidden><label>Entrata<input id="itemStart" type="time"></label><label>Uscita<input id="itemEnd" type="time"></label></div>
          <label id="amountWrap">Importo (€)<input id="itemAmount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></label>
          <label id="recurrenceWrap">Ripetizione<select id="itemRepeat"><option value="none">Non ripetere</option><option value="monthly">Ogni mese</option><option value="yearly">Ogni anno</option></select></label>
          <label id="paymentModeWrap">Modalità di pagamento
            <select id="itemPaymentMode">
              <option value="manual">Manuale — conta solo quando premi Pagato</option>
              <option value="auto">Automatico / RID — conta dal giorno successivo</option>
            </select>
            <small class="payment-hint">L'app non verifica il tuo conto bancario. Il RID viene considerato pagato in base alla data.</small>
          </label>
          <label id="includeBudgetWrap" class="checkbox-line"><input id="itemIncludeBudget" type="checkbox"> Conta questo importo nelle spese del budget</label>
          <label>Note (private)<textarea id="itemNotes" rows="2" maxlength="1000" placeholder="Facoltative"></textarea></label>
          <label id="doneWrap" class="checkbox-line"><input id="itemDone" type="checkbox"> Già completato</label>
        </div>
        <div class="modal-actions"><button class="primary" id="saveItem" type="submit">Salva</button><button class="small-outline" id="cancelItem" type="button">Annulla</button></div>
      </form>
    </div>
  </div>
  <div id="weeklyModalBackdrop" class="modal-backdrop" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="weeklyModalTitle">
      <div class="modal-top"><div><div class="overline">PIXELUP LIFE · SPESE</div><h2 id="weeklyModalTitle">Registra una spesa</h2></div><button id="weeklyCloseModal" type="button" class="close" aria-label="Chiudi">×</button></div>
      <form id="weeklyEntryForm" class="form-grid">
        <p id="weeklyModalCategory" class="subtle"></p>
        <label>Importo pagato (€)<input id="weeklyAmount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Es. 45,70" required></label>
        <label>Data della spesa<input id="weeklyDate" type="date" required></label>
        <label>Nota (facoltativa)<input id="weeklyNote" maxlength="140" placeholder="Es. Rifornimento auto"></label>
        <div class="modal-actions"><button type="submit" id="weeklySave" class="primary">Salva spesa</button><button type="button" id="weeklyCancelModal" class="small-outline">Annulla</button></div>
      </form>
    </div>
  </div>
  <div id="shiftPhotoLightbox" class="shift-photo-lightbox" role="dialog" aria-label="Foto dei turni ingrandita" aria-modal="true" hidden>
    <button id="shiftPhotoClose" type="button" aria-label="Chiudi foto">×</button>
    <img id="shiftPhotoZoomImage" alt="Foto dei turni ingrandita">
  </div>
  <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
  <script type="module" src="./app.js?v=life-v5"></script>
</body>
</html>
