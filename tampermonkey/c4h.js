// ==UserScript==
// @name         Modal JSON → Form (auto-parsing indirizzo)
// @namespace    roby.tools
// @version      0.5
// @description  Compila Nome/Cognome/CF/DataNascita/Note da JSON + estrae Indirizzo/CAP/Città. Parsing indirizzo automatico su input JSON.
// @match        http://192.168.250.66/C4H_WebUI/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
    'use strict';

    /* =============================== CSS =============================== */
    const css = `
.tm-mini-modal {
  position: fixed; top: 16px; right: 16px; width: 340px; max-width: 90vw; min-width: 280px;
  background: #f9fafb; color: #111; border: 1px solid #ccc; border-radius: 10px;
  z-index: 999999999; box-shadow: 0 6px 20px rgba(0,0,0,.25);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Helvetica Neue";
  resize: both; overflow: auto;
}
.tm-mm-header { display:flex; align-items:center; justify-content:space-between;
  padding:6px 8px; background:#e5e7eb; font-weight:600; font-size:13px; cursor:move; user-select:none; border-bottom:1px solid #ccc;
}
.tm-mm-body { padding:8px; display:flex; flex-direction:column; gap:6px; }
.tm-mm-textarea { width:100%; min-height:100px; resize:vertical; border-radius:6px; border:1px solid #bbb; background:#fff; color:#000; padding:6px; box-sizing:border-box; outline:none; font-size:12px; }
.tm-input { width:100%; border:1px solid #bbb; background:#fff; color:#000; padding:6px; border-radius:6px; font-size:12px; user-select:text; cursor:text; }
.tm-input:focus { outline: 2px solid #3b82f6; outline-offset: 1px; }
.tm-small { font-size:11px; color:#555; margin:0; }
.tm-row { display:flex; gap:6px; align-items:center; }
.tm-btn { appearance:none; border:1px solid #888; background:#f3f4f6; color:#111; padding:6px 8px; border-radius:6px; cursor:pointer; font-weight:600; transition:background .2s, color .2s; font-size:12px; }
.tm-btn:hover { background:#d1d5db; }
.tm-close { background:transparent; border:none; color:#333; cursor:pointer; font-size:18px; padding:0 4px; }
.tm-info-box { background:#fff; border:1px solid #bbb; border-radius:6px; padding:8px; font-size:12px; }
.tm-info-row { display:flex; gap:4px; margin-bottom:4px; }
.tm-info-row:last-child { margin-bottom:0; }
.tm-info-label { font-weight:600; color:#666; min-width:60px; }
.tm-info-value { color:#111; flex:1; }
.tm-json-section { display:none; }
.tm-json-section.visible { display:block; }
.tm-toggle-btn { width:100%; }
`;
    if (typeof GM_addStyle === 'function') GM_addStyle(css);
    else { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }

    /* ============================ Helpers ============================== */
    function waitForElement(selector, root = document, timeoutMs = 30000) {
        // Supportare id raw (es. "z_k2_p31") auto-prependendo '#'
        const normalized = (() => {
            if (!selector) return selector;
            const isRawId = /^[A-Za-z_][-\w:!.]*$/.test(selector) && !selector.startsWith('#') && !selector.startsWith('[') && !selector.startsWith('.') && !selector.includes(' ');
            return isRawId ? `#${selector}` : selector;
        })();

        const tryQuery = (r, sel) => {
            // Se il selettore è un id con '!' (non CSS-safe), usa getElementById
            if (sel.startsWith('#') && sel.includes('!')) {
                const id = sel.slice(1);
                try { return r.getElementById ? r.getElementById(id) : null; } catch (_) { return null; }
            }
            try { return r.querySelector(sel); } catch (_) { return null; }
        };

        const collectRoots = (baseDoc) => {
            const roots = [baseDoc];
            try {
                const frames = baseDoc.querySelectorAll('iframe, frame');
                frames.forEach(fr => {
                    try {
                        const cd = fr.contentDocument || fr.contentWindow?.document;
                        if (cd && cd.documentElement) roots.push(cd);
                    } catch (_) { /* cross-origin, ignora */ }
                });
            } catch (_) { /* ignora */ }
            return roots;
        };

        return new Promise((resolve, reject) => {
            const sel = normalized;
            const roots = collectRoots(root);

            // Check iniziale su tutti i root noti
            for (const r of roots) {
                const found = tryQuery(r, sel);
                if (found) return resolve(found);
            }

            // Prepara osservatori su ogni root (document/iframe) per intercettare inserimenti futuri
            const observers = [];
            const onFound = (el) => {
                observers.forEach(o => { try { o.disconnect(); } catch (_) {} });
                resolve(el);
            };

            roots.forEach(r => {
                try {
                    const obs = new MutationObserver(() => {
                        const el2 = tryQuery(r, sel);
                        if (el2) onFound(el2);
                    });
                    obs.observe(r.documentElement || r, { childList: true, subtree: true });
                    observers.push(obs);
                } catch (_) { /* ignora */ }
            });

            if (timeoutMs) setTimeout(() => {
                observers.forEach(o => { try { o.disconnect(); } catch (_) {} });
                reject(new Error(`Timeout attesa selector: ${sel}`));
            }, timeoutMs);
        });
    }

    function toast(msg, error=false){
        const t=document.createElement('div');
        t.textContent=msg;
        t.style.cssText=`position:fixed;bottom:16px;right:16px;z-index:999999999;background:${error?'#7f1d1d':'#065f46'};color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.3);font-weight:600;`;
        document.body.appendChild(t); setTimeout(()=>t.remove(),2500);
    }
    function sanitizeJSONText(text){ return (text || '').trim().replace(/^\uFEFF/, ''); }

    async function setInputValue(selector, value) {
        const input = await waitForElement(selector, document, 40000);
        const prevReadonly = input.hasAttribute('readonly');
        const prevClass = input.className;
        if (prevReadonly) input.removeAttribute('readonly');
        if (prevClass) input.className = prevClass.replace(/-readonly\b/g, '');

        // Simula click del mouse per attivare eventuali controlli script esterni
        input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        await new Promise(resolve => setTimeout(resolve, 50));

        // Seleziona tutto il contenuto esistente
        input.focus();
        input.select();
        input.setSelectionRange(0, input.value.length);

        await new Promise(resolve => setTimeout(resolve, 50));

        input.value = value ?? '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();

        setTimeout(() => {
            if (prevReadonly) input.setAttribute('readonly', 'readonly');
            input.className = prevClass;
        }, 200);
    }

    async function setDateValue(selector, valueDDMMYYYY) {
        if (!valueDDMMYYYY) return;
        const inp = await waitForElement(selector, document, 40000);
        if (!inp) throw new Error(`Campo data non trovato: ${selector}`);
        const prevReadonly = inp.hasAttribute('readonly');
        if (prevReadonly) inp.removeAttribute('readonly');

        // Simula click del mouse per attivare eventuali controlli script esterni
        inp.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        inp.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        inp.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        await new Promise(resolve => setTimeout(resolve, 50));

        // Seleziona tutto il contenuto esistente
        inp.focus();
        inp.select();
        inp.setSelectionRange(0, inp.value.length);

        await new Promise(resolve => setTimeout(resolve, 50));

        inp.value = valueDDMMYYYY;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        inp.blur();

        if (prevReadonly) inp.setAttribute('readonly','readonly');
    }

    async function setInputValueAndEnter(selector, value, delayMs = 1000) {
        try {
            const input = await waitForElement(selector, document, 40000);
            console.log('Campo Gruppo trovato:', input);

            const prevReadonly = input.hasAttribute('readonly');
            const prevClass = input.className;
            if (prevReadonly) input.removeAttribute('readonly');
            if (prevClass) input.className = prevClass.replace(/-readonly\b/g, '');

            input.focus();
            input.value = value ?? '';
            console.log('Valore impostato su Gruppo:', input.value);

            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));

            // Aspetta il delay specificato e poi simula Enter
            setTimeout(() => {
                console.log('Simulazione Enter su Gruppo...');
                input.focus(); // Assicurati che abbia ancora il focus

                const enterEvent = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                });
                input.dispatchEvent(enterEvent);

                const enterEventPress = new KeyboardEvent('keypress', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                });
                input.dispatchEvent(enterEventPress);

                const enterEventUp = new KeyboardEvent('keyup', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                });
                input.dispatchEvent(enterEventUp);

                console.log('Enter simulato su Gruppo');
                input.blur();

                if (prevReadonly) input.setAttribute('readonly', 'readonly');
                input.className = prevClass;
            }, delayMs);
        } catch (error) {
            console.error('Errore setInputValueAndEnter:', error);
            throw error;
        }
    }

    function toTitleCase(s='') {
        return s.toLowerCase().replace(/\b([a-zà-ú]+)/gi, (m) => m.charAt(0).toUpperCase() + m.slice(1));
    }

    // Parsing indirizzo tipo: "VIA TEST 12, 00100 ROMA (RM)"
    function parseIndirizzo(str='') {
        const src = str.trim();
        const re = /^(.*?)(\d+)\s*,\s*(\d{5})\s+(.+)$/i;
        const m = src.match(re);
        let indirizzo = '', cap = '', citta = '';
        if (m) {
            const via = m[1].trim().replace(/\s+,?$/, '');
            const civico = m[2].trim();
            cap = m[3].trim();
            let cityProv = m[4].trim(); // "ROMA (RM)"
            const city = (cityProv.match(/^(.+?)\s*\(/) || [,''])[1];
            const prov = (cityProv.match(/\(([^)]+)\)/) || [,''])[1];
            const cityTC = city ? toTitleCase(city.trim()) : '';
            citta = prov ? `${cityTC}(${prov})` : toTitleCase(cityProv);
            indirizzo = via ? `${via}, ${civico}` : civico;
        } else {
            const re2 = /^(.*?),\s*(\d{5})\s+(.+)$/i;
            const n = src.match(re2);
            if (n) {
                indirizzo = n[1].trim();
                cap = n[2].trim();
                const cityProv = n[3].trim();
                const city = (cityProv.match(/^(.+?)\s*\(/) || [,''])[1];
                const prov = (cityProv.match(/\(([^)]+)\)/) || [,''])[1];
                const cityTC = city ? toTitleCase(city.trim()) : '';
                citta = prov ? `${cityTC}(${prov})` : toTitleCase(cityProv);
            } else {
                indirizzo = src;
            }
        }
        return { indirizzo, cap, citta };
    }

    // Debounce semplice
    function debounce(fn, ms=300){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }; }

    /* ============================== UI ================================= */
    const modal = document.createElement('div');
    modal.className = 'tm-mini-modal';
    modal.innerHTML = `
    <div class="tm-mm-header" id="tmDragHandle">
      <span>Compila form da JSON</span>
      <button class="tm-close" id="tmCloseBtn" title="Chiudi">×</button>
    </div>
    <div class="tm-mm-body">
      <div class="tm-info-box" id="tmInfoBox">
        <div class="tm-info-row">
          <span class="tm-info-label">Nome:</span>
          <span class="tm-info-value" id="tmInfoNome">-</span>
        </div>
        <div class="tm-info-row">
          <span class="tm-info-label">Cognome:</span>
          <span class="tm-info-value" id="tmInfoCognome">-</span>
        </div>
        <div class="tm-info-row">
          <span class="tm-info-label">CF:</span>
          <span class="tm-info-value" id="tmInfoCF">-</span>
        </div>
        <div class="tm-info-row">
          <span class="tm-info-label">Nato il:</span>
          <span class="tm-info-value" id="tmInfoDN">-</span>
        </div>
      </div>

      <button id="btnToggleJson" class="tm-btn tm-toggle-btn">Mostra JSON completo</button>

      <div class="tm-json-section" id="tmJsonSection">
        <div class="tm-small">Incolla qui il JSON (nome, cognome, cf, dataNascita, indirizzoResidenza, ...)</div>
        <textarea id="tmTextarea" class="tm-mm-textarea" placeholder='{"nome":"ROBERTO","cognome":"DE DOMENICO","cf":"...","dataNascita":"dd/MM/yyyy","indirizzoResidenza":"PACE SALITA BISIGNANI 3, 98167 MESSINA (ME)"}'></textarea>
      </div>

      <div class="tm-small">Note fisse (testo uguale per tutti i record, fuori dal JSON)</div>
      <input id="tmNoteFixed" class="tm-input" placeholder="Note da copiare nel campo Note" />

      <div class="tm-small">Indirizzo (estratto dal JSON)</div>
      <input id="tmAddr" class="tm-input" placeholder="Indirizzo (es. PACE SALITA BISIGNANI, 3)" />
      <div class="tm-row">
        <input id="tmCap" class="tm-input" placeholder="CAP (es. 98167)" />
        <input id="tmCity" class="tm-input" placeholder="Città (es. Messina(ME))" />
      </div>

      <div class="tm-row" style="justify-content:space-between">
        <button id="btnFill" class="tm-btn">Compila da JSON</button>
        <button id="btnClear" class="tm-btn">Svuota</button>
      </div>
      <div class="tm-row" style="justify-content:space-between; gap:4px;">
        <button id="btnRicerca" class="tm-btn" style="flex:1">Ricerca</button>
        <button id="btnNuovo" class="tm-btn" style="flex:1">Nuovo</button>
        <button id="btnIndirizzo" class="tm-btn" style="flex:1">Indirizzo</button>
        <button id="btnPagamento" class="tm-btn" style="flex:1">Pagamento</button>
      </div>
      <div class="tm-small">Suggerimento: la data deve essere nel formato <b>dd/MM/yyyy</b> (es. 03/01/1986).</div>
    </div>
  `;
    document.documentElement.appendChild(modal);

    // Riferimenti UI + persistenza base
    const ta    = modal.querySelector('#tmTextarea');
    const noteFixed = modal.querySelector('#tmNoteFixed');
    const addr  = modal.querySelector('#tmAddr');
    const cap   = modal.querySelector('#tmCap');
    const city  = modal.querySelector('#tmCity');
    const btnToggleJson = modal.querySelector('#btnToggleJson');
    const jsonSection = modal.querySelector('#tmJsonSection');
    const infoNome = modal.querySelector('#tmInfoNome');
    const infoCognome = modal.querySelector('#tmInfoCognome');
    const infoCF = modal.querySelector('#tmInfoCF');
    const infoDN = modal.querySelector('#tmInfoDN');

    function save(key, val){
        if (typeof GM_setValue === 'function') GM_setValue(key, val);
        else localStorage.setItem(key, val);
    }
    function load(key, def=''){
        if (typeof GM_getValue === 'function') return GM_getValue(key, def);
        const v = localStorage.getItem(key);
        return v==null?def:v;
    }

    ta.value = load('tm_json','');
    noteFixed.value = load('tm_notefixed','');
    addr.value = load('tm_addr','');
    cap.value = load('tm_cap','');
    city.value = load('tm_city','');

    // Aggiorna info box
    function updateInfoBox() {
        const raw = sanitizeJSONText(ta.value);
        try {
            const data = JSON.parse(raw);
            infoNome.textContent = data.nome ?? data.Nome ?? data["MMGNome"] ?? data["MMG Nome"] ?? '-';
            infoCognome.textContent = data.cognome ?? data.Cognome ?? data["MMGCognome"] ?? data["MMG Cognome"] ?? '-';
            infoCF.textContent = data.cf ?? data.CF ?? data.codiceFiscale ?? data.CodiceFiscale ?? '-';
            infoDN.textContent = data.dataNascita ?? data.DataNascita ?? '-';
        } catch (_) {
            infoNome.textContent = '-';
            infoCognome.textContent = '-';
            infoCF.textContent = '-';
            infoDN.textContent = '-';
        }
    }

    const autoParseFromTextarea = debounce(() => {
        const raw = sanitizeJSONText(ta.value);
        try {
            const data = JSON.parse(raw);
            const indirizzoRaw = data.indirizzoResidenza ?? data.indirizzo ?? '';
            if (!indirizzoRaw) return;
            const parsed = parseIndirizzo(indirizzoRaw);
            if (parsed.indirizzo) { addr.value = parsed.indirizzo; save('tm_addr', addr.value); }
            if (parsed.cap) { cap.value = parsed.cap; save('tm_cap', cap.value); }
            if (parsed.citta) { city.value = parsed.citta; save('tm_city', city.value); }
        } catch (_) {
            // JSON parziale/non valido: non mostro errori mentre digiti
        }
        updateInfoBox();
    }, 300);

    // Toggle JSON section
    btnToggleJson.addEventListener('click', () => {
        jsonSection.classList.toggle('visible');
        btnToggleJson.textContent = jsonSection.classList.contains('visible')
            ? 'Nascondi JSON completo'
            : 'Mostra JSON completo';
    });

    ta.addEventListener('input', () => { save('tm_json', ta.value); autoParseFromTextarea(); });

    // Aggiorna info box al caricamento
    updateInfoBox();
    noteFixed.addEventListener('input', ()=>save('tm_notefixed',noteFixed.value));
    addr.addEventListener('input', ()=>save('tm_addr',addr.value));
    cap.addEventListener('input',  ()=>save('tm_cap',cap.value));
    city.addEventListener('input', ()=>save('tm_city',city.value));

    // chiudi / svuota
    modal.querySelector('#tmCloseBtn').addEventListener('click', ()=>modal.remove());
    modal.querySelector('#btnClear').addEventListener('click', ()=>{
        ta.value=''; noteFixed.value=''; addr.value=''; cap.value=''; city.value='';
        ['tm_json','tm_notefixed','tm_addr','tm_cap','tm_city'].forEach(k=>save(k,''));
    });

    // drag
    (function makeDraggable(box, handle) {
        let ox=0, oy=0, dragging=false;
        handle.addEventListener('mousedown', (e) => {
            dragging = true;
            const r = box.getBoundingClientRect();
            ox = e.clientX - r.left; oy = e.clientY - r.top; e.preventDefault();
        });
        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            box.style.left = Math.max(0, e.clientX - ox) + 'px';
            box.style.top  = Math.max(0, e.clientY - oy) + 'px';
            box.style.right = 'auto';
        });
        window.addEventListener('mouseup', () => dragging = false);
    })(modal, modal.querySelector('#tmDragHandle'));

    /* ====================== Selettori interni (hardcoded) ===================== */
    const SEL = {
        // Selettori aggiornati basati sui title attributes e classi dinamiche
        nome:    'input.z-textbox[title*="(Nome)" i]',
        cognome: 'input.z-textbox[title*="(Cognome)" i]',
        cf:      'input.z-textbox[title*="Codice fiscale" i], input.z-textbox[title*="(DUNS)" i]',
        dn:      'input.z-datebox-inp[id$="!real"], input[title*="(DataNascita)" i]',
        note:    'input.z-textbox[title*="Optional short description" i], input.z-textbox[title*="(Description)" i]',
        // Gruppo: il campo è dentro un div con title, cerchiamo l'input dentro quel container
        gruppo:  'div[title*="Gruppo disabili gravissimi"] input.z-textbox, div[title*="(C_BP_Group_ID)"] input.z-textbox'
    };

    /* =========================== COMPILAZIONE =========================== */
    async function compileFromJSON() {
        const raw = sanitizeJSONText(ta.value);
        if (!raw) { toast('JSON mancante', true); return; }

        let data;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            console.error('JSON parse error:', e);
            toast('JSON non valido', true);
            return;
        }

        const nome =
            data.nome ?? data.Nome ?? data["MMGNome"] ?? data["MMG Nome"] ?? '';

        const cognome =
            data.cognome ?? data.Cognome ?? data["MMGCognome"] ?? data["MMG Cognome"] ?? '';

        const cf =
            data.cf ?? data.CF ?? data.codiceFiscale ?? data.CodiceFiscale ?? '';

        const dataNascita =
            data.dataNascita ?? data.DataNascita ?? '';

        const noteText = (noteFixed.value || '');

        // aggiorna anche indirizzo in UI se disponibile
        const indirizzoRaw = data.indirizzoResidenza ?? data.indirizzo ?? '';
        if (indirizzoRaw) {
            const parsed = parseIndirizzo(indirizzoRaw);
            if (parsed.indirizzo) { addr.value = parsed.indirizzo; save('tm_addr', addr.value); }
            if (parsed.cap) { cap.value = parsed.cap; save('tm_cap', cap.value); }
            if (parsed.citta) { city.value = parsed.citta; save('tm_city', city.value); }
        }

        try {
            // Compila prima il campo Gruppo con "dis" (senza await per non bloccare)
            setInputValueAndEnter(SEL.gruppo, 'dis', 1000).catch(() => {
                console.warn('Campo Gruppo non trovato o non compilabile');
            });

            // Compila gli altri campi
            if (cognome) await setInputValue(SEL.cognome, cognome);
            if (nome)    await setInputValue(SEL.nome, nome);
            if (cf)      await setInputValue(SEL.cf, cf);
            if (dataNascita) await setDateValue(SEL.dn, dataNascita);
            if (noteText)    await setInputValue(SEL.note, noteText);
            toast('Campi compilati ✔ (Gruppo → "dis", indirizzo aggiornato)');
        } catch (err) {
            console.error(err);
            toast('Errore nella compilazione (controlla i campi/readonly).', true);
        }
    }

    // Fix: chiavi con spazi (MMG Cognome/MMG Nome)
    Object.defineProperty(Object.prototype, 'MMG Cognome', { get(){ return this['MMG Cognome']; }, configurable: true });
    Object.defineProperty(Object.prototype, 'MMG Nome', { get(){ return this['MMG Nome']; }, configurable: true });

    modal.querySelector('#btnFill').addEventListener('click', compileFromJSON);

    // Event listeners per i pulsanti delle procedure
    modal.querySelector('#btnRicerca').addEventListener('click', () => {
        handleWebSocketCommand('ricercaAnagrafica');
    });

    modal.querySelector('#btnNuovo').addEventListener('click', () => {
        handleWebSocketCommand('aggiungiNuovoAssistito');
    });

    modal.querySelector('#btnIndirizzo').addEventListener('click', () => {
        handleWebSocketCommand('schedaIndirizzo');
    });

    modal.querySelector('#btnPagamento').addEventListener('click', () => {
        handleWebSocketCommand('metodoPagamento');
    });

    /* ====================== WebSocket Connection (ASP Anagrafica Desktop) ====================== */
    let ws = null;

    // Helper per selezionare un valore in un combobox ZK
    async function selectComboboxValue(inputId, value, doc = document) {
        const input = doc.getElementById(inputId);
        if (!input) {
            throw new Error(`Combobox input ${inputId} non trovato`);
        }

        const prevReadonly = input.hasAttribute('readonly');
        if (prevReadonly) input.removeAttribute('readonly');

        input.focus();
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();

        if (prevReadonly) input.setAttribute('readonly', 'readonly');

        console.log(`Combobox ${inputId} impostato su: ${value}`);
    }

    // Helper per cliccare un checkbox
    async function clickCheckbox(checkboxId, doc = document) {
        const checkbox = doc.getElementById(checkboxId);
        if (!checkbox) {
            throw new Error(`Checkbox ${checkboxId} non trovato`);
        }

        if (!checkbox.checked) {
            checkbox.click();
            console.log(`Checkbox ${checkboxId} selezionato`);
        }
    }

    // Gestione comandi WebSocket
    function handleWebSocketCommand(command, data) {
        console.log(`Esecuzione comando: ${command}`, data);

        switch (command) {
            case 'inviaDatiPaziente':
                // Popola la textarea con i dati del paziente
                ta.value = JSON.stringify(data, null, 2);
                save('tm_json', ta.value);
                autoParseFromTextarea();
                toast('📥 Dati paziente ricevuti', false);
                break;

            case 'ricercaAnagrafica':
                // Sequenza completa: apri menu Anagrafica Paziente + inserisci CF e ricerca
                (async () => {
                    try {
                        console.log('=== INIZIO RICERCA ANAGRAFICA ===');

                        // STEP 1: Cerca e clicca sul menu "Anagrafica Paziente" usando il title
                        console.log('STEP 1: Ricerca menu Anagrafica Paziente...');
                        const searchDocs = [document];
                        const frames = document.querySelectorAll('iframe, frame');
                        frames.forEach(fr => {
                            try {
                                const doc = fr.contentDocument || fr.contentWindow?.document;
                                if (doc) searchDocs.push(doc);
                            } catch (_) { /* cross-origin */ }
                        });

                        let menuItem = null;
                        for (const doc of searchDocs) {
                            // Cerca tr con title="Anagrafica Paziente"
                            const menuRows = doc.querySelectorAll('tr[title="Anagrafica Paziente"]');
                            if (menuRows.length > 0) {
                                menuItem = menuRows[0];
                                console.log('  → Menu trovato:', menuItem.id);
                                break;
                            }
                        }

                        if (!menuItem) {
                            toast('⚠ Menu "Anagrafica Paziente" non trovato', true);
                            console.error('Menu "Anagrafica Paziente" non trovato');
                            return;
                        }

                        menuItem.click();
                        console.log('  ✓ Menu cliccato, attesa 1500ms...');
                        toast('✓ Menu Anagrafica Paziente aperto', false);
                        await new Promise(resolve => setTimeout(resolve, 1500));

                        // STEP 2: Inserisci CF e simula Enter
                        console.log('STEP 2: Inserimento CF...');
                        const raw = sanitizeJSONText(ta.value);
                        if (!raw) {
                            toast('⚠ Nessun dato JSON disponibile', true);
                            return;
                        }

                        const jsonData = JSON.parse(raw);
                        const cf = jsonData.cf || jsonData.CF || jsonData.codiceFiscale || jsonData.CodiceFiscale || '';

                        if (!cf) {
                            toast('⚠ CF non trovato nei dati', true);
                            return;
                        }

                        console.log('Ricerca campo CF con waitForElement...');
                        let cfInput;
                        try {
                            cfInput = await waitForElement('input.z-textbox[title*="Codice fiscale"][title*="DUNS"]', document, 5000);
                        } catch (e) {
                            console.warn('Campo CF con title DUNS non trovato, provo con altri selettori...');
                            try {
                                cfInput = await waitForElement('input.z-textbox[title*="Codice fiscale"]', document, 5000);
                            } catch (e2) {
                                console.warn('Campo CF con title non trovato, cerco in tutti gli iframe...');
                                for (const frame of frames) {
                                    try {
                                        const doc = frame.contentDocument || frame.contentWindow?.document;
                                        if (doc) {
                                            cfInput = doc.querySelector('input.z-textbox[title*="Codice fiscale"]');
                                            if (cfInput) break;
                                        }
                                    } catch (_) { /* cross-origin */ }
                                }
                            }
                        }

                        if (!cfInput) {
                            toast('⚠ Campo ricerca CF non trovato', true);
                            console.error('Campo CF non trovato con nessun selettore');
                            return;
                        }

                        console.log('Campo CF trovato:', cfInput);

                        // Popola il campo
                        const prevReadonly = cfInput.hasAttribute('readonly');
                        if (prevReadonly) cfInput.removeAttribute('readonly');

                        cfInput.focus();
                        cfInput.value = cf;
                        cfInput.dispatchEvent(new Event('input', { bubbles: true }));
                        cfInput.dispatchEvent(new Event('change', { bubbles: true }));

                        console.log(`CF "${cf}" inserito nel campo di ricerca`);
                        toast(`✓ CF "${cf}" inserito`, false);

                        // Dopo 500ms, simula Enter sul campo
                        setTimeout(() => {
                            try {
                                console.log('Simulazione Enter sul campo CF...');
                                cfInput.focus();

                                const enterEventDown = new KeyboardEvent('keydown', {
                                    key: 'Enter',
                                    code: 'Enter',
                                    keyCode: 13,
                                    which: 13,
                                    bubbles: true,
                                    cancelable: true
                                });
                                cfInput.dispatchEvent(enterEventDown);

                                const enterEventPress = new KeyboardEvent('keypress', {
                                    key: 'Enter',
                                    code: 'Enter',
                                    keyCode: 13,
                                    which: 13,
                                    bubbles: true,
                                    cancelable: true
                                });
                                cfInput.dispatchEvent(enterEventPress);

                                const enterEventUp = new KeyboardEvent('keyup', {
                                    key: 'Enter',
                                    code: 'Enter',
                                    keyCode: 13,
                                    which: 13,
                                    bubbles: true,
                                    cancelable: true
                                });
                                cfInput.dispatchEvent(enterEventUp);

                                console.log('Enter simulato sul campo CF');
                                toast('✓ Ricerca CF avviata (Enter)', false);

                                cfInput.blur();
                                if (prevReadonly) cfInput.setAttribute('readonly', 'readonly');

                            } catch (e) {
                                console.error('Errore nella simulazione Enter:', e);
                                toast('⚠ Errore simulazione Enter', true);
                            }
                        }, 500);

                        console.log('=== RICERCA ANAGRAFICA COMPLETATA ===');

                    } catch (e) {
                        console.error('Errore ricerca anagrafica:', e);
                        toast('⚠ Errore ricerca anagrafica', true);
                    }
                })();
                break;

            case 'inserisciRicercaCf':
                // Inserisce il CF nel campo di ricerca e clicca OK
                (async () => {
                    try {
                        // Estrai il CF dai dati JSON salvati
                        const raw = sanitizeJSONText(ta.value);
                        if (!raw) {
                            toast('⚠ Nessun dato JSON disponibile', true);
                            return;
                        }

                        const jsonData = JSON.parse(raw);
                        const cf = jsonData.cf || jsonData.CF || jsonData.codiceFiscale || jsonData.CodiceFiscale || '';

                        if (!cf) {
                            toast('⚠ CF non trovato nei dati', true);
                            return;
                        }

                        console.log('Ricerca campo CF con waitForElement...');
                        // Cerca il campo input del CF usando waitForElement (cerca anche negli iframe)
                        // Prova prima con il title, poi con selettori più generici
                        let cfInput;
                        try {
                            cfInput = await waitForElement('input.z-textbox[title*="Codice fiscale"][title*="DUNS"]', document, 5000);
                        } catch (e) {
                            console.warn('Campo CF con title DUNS non trovato, provo con altri selettori...');
                            try {
                                cfInput = await waitForElement('input.z-textbox[title*="Codice fiscale"]', document, 5000);
                            } catch (e2) {
                                console.warn('Campo CF con title non trovato, provo con ID diretto...');
                                // Ultimo tentativo: cerca in tutti gli iframe
                                const frames = document.querySelectorAll('iframe, frame');
                                for (const frame of frames) {
                                    try {
                                        const doc = frame.contentDocument || frame.contentWindow?.document;
                                        if (doc) {
                                            cfInput = doc.querySelector('input.z-textbox[title*="Codice fiscale"]');
                                            if (cfInput) break;
                                        }
                                    } catch (_) { /* cross-origin */ }
                                }
                            }
                        }

                        if (!cfInput) {
                            toast('⚠ Campo ricerca CF non trovato', true);
                            console.error('Campo CF non trovato con nessun selettore');
                            return;
                        }

                        console.log('Campo CF trovato:', cfInput);

                        // Popola il campo
                        const prevReadonly = cfInput.hasAttribute('readonly');
                        if (prevReadonly) cfInput.removeAttribute('readonly');

                        cfInput.focus();
                        cfInput.value = cf;
                        cfInput.dispatchEvent(new Event('input', { bubbles: true }));
                        cfInput.dispatchEvent(new Event('change', { bubbles: true }));

                        console.log(`CF "${cf}" inserito nel campo di ricerca`);
                        toast(`✓ CF "${cf}" inserito`, false);

                        // Dopo 500ms, simula Enter sul campo
                        setTimeout(() => {
                            try {
                                console.log('Simulazione Enter sul campo CF...');
                                cfInput.focus();

                                // Simula keydown
                                const enterEventDown = new KeyboardEvent('keydown', {
                                    key: 'Enter',
                                    code: 'Enter',
                                    keyCode: 13,
                                    which: 13,
                                    bubbles: true,
                                    cancelable: true
                                });
                                cfInput.dispatchEvent(enterEventDown);

                                // Simula keypress
                                const enterEventPress = new KeyboardEvent('keypress', {
                                    key: 'Enter',
                                    code: 'Enter',
                                    keyCode: 13,
                                    which: 13,
                                    bubbles: true,
                                    cancelable: true
                                });
                                cfInput.dispatchEvent(enterEventPress);

                                // Simula keyup
                                const enterEventUp = new KeyboardEvent('keyup', {
                                    key: 'Enter',
                                    code: 'Enter',
                                    keyCode: 13,
                                    which: 13,
                                    bubbles: true,
                                    cancelable: true
                                });
                                cfInput.dispatchEvent(enterEventUp);

                                console.log('Enter simulato sul campo CF');
                                toast('✓ Ricerca CF avviata (Enter)', false);

                                cfInput.blur();
                                if (prevReadonly) cfInput.setAttribute('readonly', 'readonly');

                            } catch (e) {
                                console.error('Errore nella simulazione Enter:', e);
                                toast('⚠ Errore simulazione Enter', true);
                            }
                        }, 500);

                    } catch (e) {
                        console.error('Errore inserimento CF:', e);
                        toast('⚠ Errore inserimento CF', true);
                    }
                })();
                break;

            case 'aggiungiNuovoAssistito':
                // Clicca sul pulsante "Nuovo record" e compila il form
                (async () => {
                    try {
                        console.log('Ricerca pulsante "Nuovo record"...');

                        // Cerca il pulsante "Nuovo record" in tutti i documenti
                        let newButton = null;
                        const searchDocs = [document];
                        const frames = document.querySelectorAll('iframe, frame');
                        frames.forEach(fr => {
                            try {
                                const doc = fr.contentDocument || fr.contentWindow?.document;
                                if (doc) searchDocs.push(doc);
                            } catch (_) { /* cross-origin */ }
                        });

                        // Prova con ID specifico
                        for (const doc of searchDocs) {
                            newButton = doc.getElementById('z_8l_1c');
                            if (newButton) break;
                        }

                        // Se non trovato, cerca per immagine New24.png
                        if (!newButton) {
                            for (const doc of searchDocs) {
                                const newImgs = doc.querySelectorAll('img[src*="New24.png"]');
                                if (newImgs.length > 0) {
                                    newButton = newImgs[0].closest('a, button, [role="button"]') || newImgs[0].parentElement;
                                    if (newButton) break;
                                }
                            }
                        }

                        if (!newButton) {
                            toast('⚠ Pulsante "Nuovo record" non trovato', true);
                            console.error('Pulsante "Nuovo record" non trovato');
                            return;
                        }

                        console.log('Pulsante "Nuovo record" trovato:', newButton);

                        // Clicca sul pulsante
                        newButton.click();
                        toast('✓ Pulsante "Nuovo record" cliccato', false);

                        // Aspetta 1 secondo per il caricamento del form, poi compila
                        setTimeout(() => {
                            console.log('Compilazione form da JSON...');
                            try {
                                compileFromJSON();
                            } catch (e) {
                                console.error('Errore nella compilazione del form:', e);
                                toast('⚠ Errore compilazione form', true);
                            }
                        }, 1000);

                    } catch (e) {
                        console.error('Errore aggiungiNuovoAssistito:', e);
                        toast('⚠ Errore nell\'aggiunta nuovo assistito', true);
                    }
                })();
                break;

            case 'salva':
                // Clicca sul pulsante "Salva modifiche"
                try {
                    console.log('Ricerca pulsante "Salva modifiche"...');

                    // Cerca il pulsante "Salva modifiche" in tutti i documenti
                    let saveButton = null;
                    const searchDocs = [document];
                    const frames = document.querySelectorAll('iframe, frame');
                    frames.forEach(fr => {
                        try {
                            const doc = fr.contentDocument || fr.contentWindow?.document;
                            if (doc) searchDocs.push(doc);
                        } catch (_) { /* cross-origin */ }
                    });

                    // Prova con ID specifico
                    for (const doc of searchDocs) {
                        saveButton = doc.getElementById('z_9l_5c');
                        if (saveButton) break;
                    }

                    // Se non trovato, cerca per immagine Save24.png
                    if (!saveButton) {
                        for (const doc of searchDocs) {
                            const saveImgs = doc.querySelectorAll('img[src*="Save24.png"]');
                            if (saveImgs.length > 0) {
                                saveButton = saveImgs[0].closest('a, button, [role="button"]') || saveImgs[0].parentElement;
                                if (saveButton) break;
                            }
                        }
                    }

                    if (!saveButton) {
                        toast('⚠ Pulsante "Salva" non trovato', true);
                        console.error('Pulsante "Salva" non trovato');
                        return;
                    }

                    console.log('Pulsante "Salva" trovato:', saveButton);
                    saveButton.click();
                    toast('✓ Modifiche salvate', false);

                } catch (e) {
                    console.error('Errore salvataggio:', e);
                    toast('⚠ Errore nel salvataggio', true);
                }
                break;

            case 'schedaIndirizzo':
                // Sequenza completa: apri Indirizzo + Nuovo record + Griglia + compila CAP e indirizzo
                (async () => {
                    try {
                        console.log('=== INIZIO SEQUENZA SCHEDA INDIRIZZO ===');

                        const searchDocs = [document];
                        const frames = document.querySelectorAll('iframe, frame');
                        frames.forEach(fr => {
                            try {
                                const doc = fr.contentDocument || fr.contentWindow?.document;
                                if (doc) searchDocs.push(doc);
                            } catch (_) { /* cross-origin */ }
                        });

                        // STEP 1: Click sul pulsante "Indirizzo"
                        console.log('STEP 1/6: Ricerca pulsante "Indirizzo"...');
                        let addressButton = null;

                        // Prova con ID specifico
                        for (const doc of searchDocs) {
                            addressButton = doc.getElementById('z_9l_oq');
                            if (addressButton) break;
                        }

                        // Se non trovato, cerca per testo "Indirizzo"
                        if (!addressButton) {
                            for (const doc of searchDocs) {
                                const buttons = doc.querySelectorAll('button');
                                for (const btn of buttons) {
                                    if (btn.textContent.trim() === 'Indirizzo') {
                                        addressButton = btn;
                                        break;
                                    }
                                }
                                if (addressButton) break;
                            }
                        }

                        if (!addressButton) {
                            toast('⚠ Pulsante "Indirizzo" non trovato', true);
                            console.error('Pulsante "Indirizzo" non trovato');
                            return;
                        }

                        console.log('  → Pulsante trovato:', addressButton.id);
                        addressButton.click();
                        toast('✓ Scheda Indirizzo aperta', false);
                        await new Promise(resolve => setTimeout(resolve, 800));

                        // STEP 2: Click su "Nuovo record" - cerca per title o immagine
                        console.log('STEP 2/6: Click su "Nuovo record"...');
                        let newRecordBtn = null;

                        // Cerca per title="Nuovo record"
                        for (const doc of searchDocs) {
                            const buttons = doc.querySelectorAll('a[title="Nuovo record"], button[title="Nuovo record"]');
                            if (buttons.length > 0) {
                                // Filtra per quelli che hanno l'immagine New24.png
                                for (const btn of buttons) {
                                    const hasNewImg = btn.querySelector('img[src*="New24.png"]');
                                    if (hasNewImg) {
                                        newRecordBtn = btn;
                                        break;
                                    }
                                }
                            }
                            if (newRecordBtn) break;
                        }

                        // Se non trovato, cerca solo per immagine
                        if (!newRecordBtn) {
                            for (const doc of searchDocs) {
                                const newImgs = doc.querySelectorAll('img[src*="New24.png"]');
                                for (const img of newImgs) {
                                    const btn = img.closest('a[z\\.type="zul.btn.Tbtn"], a.z-toolbar-button, button');
                                    if (btn) {
                                        newRecordBtn = btn;
                                        break;
                                    }
                                }
                                if (newRecordBtn) break;
                            }
                        }

                        if (!newRecordBtn) {
                            throw new Error('Pulsante Nuovo record non trovato');
                        }
                        console.log('  → Pulsante trovato:', newRecordBtn.id);
                        newRecordBtn.click();
                        toast('✓ Nuovo record creato', false);
                        await new Promise(resolve => setTimeout(resolve, 800));

                        // STEP 3: Click su "Passa alla visualizzazione a Griglia" - cerca per title o immagine
                        console.log('STEP 3/6: Click su "Griglia"...');
                        let gridBtn = null;

                        // Cerca per title contenente "Griglia"
                        for (const doc of searchDocs) {
                            const buttons = doc.querySelectorAll('a[title*="Griglia"], button[title*="Griglia"]');
                            if (buttons.length > 0) {
                                // Filtra per quelli che hanno l'immagine Multi24.png
                                for (const btn of buttons) {
                                    const hasMultiImg = btn.querySelector('img[src*="Multi24.png"]');
                                    if (hasMultiImg) {
                                        gridBtn = btn;
                                        break;
                                    }
                                }
                            }
                            if (gridBtn) break;
                        }

                        // Se non trovato, cerca solo per immagine
                        if (!gridBtn) {
                            for (const doc of searchDocs) {
                                const multiImgs = doc.querySelectorAll('img[src*="Multi24.png"]');
                                for (const img of multiImgs) {
                                    const btn = img.closest('a[z\\.type="zul.btn.Tbtn"], a.z-toolbar-button, button');
                                    if (btn) {
                                        gridBtn = btn;
                                        break;
                                    }
                                }
                                if (gridBtn) break;
                            }
                        }

                        if (!gridBtn) {
                            throw new Error('Pulsante Griglia non trovato');
                        }
                        console.log('  → Pulsante trovato:', gridBtn.id);
                        gridBtn.click();
                        toast('✓ Vista griglia attivata', false);
                        await new Promise(resolve => setTimeout(resolve, 800));

                        // STEP 4: Click sull'elemento con Location10.png
                        console.log('STEP 4/6: Click su Location...');
                        let locationBtn = null;
                        for (const doc of searchDocs) {
                            const locationImgs = doc.querySelectorAll('img[src*="Location10.png"]');
                            if (locationImgs.length > 0) {
                                locationBtn = locationImgs[0].closest('td, button, a, [role="button"]') || locationImgs[0].parentElement;
                                if (locationBtn) break;
                            }
                        }
                        if (!locationBtn) {
                            throw new Error('Pulsante Location non trovato');
                        }
                        console.log('  → Pulsante trovato');
                        locationBtn.click();
                        toast('✓ Location selezionato', false);
                        await new Promise(resolve => setTimeout(resolve, 800));

                        // STEP 5: Inserisci CAP cercando il label "CAP" e poi l'input nella riga
                        console.log('STEP 5/6: Inserimento CAP...');
                        const capValue = cap.value || '';
                        if (!capValue) {
                            toast('⚠ CAP mancante', true);
                            console.warn('CAP non disponibile');
                        } else {
                            // Cerca il label "CAP" in tutti i documenti
                            let capInput = null;
                            for (const doc of searchDocs) {
                                const labels = doc.querySelectorAll('span.z-label');
                                for (const label of labels) {
                                    if (label.textContent.trim() === 'CAP') {
                                        // Trova il tr parent usando closest con 'tr' semplice
                                        const row = label.closest('tr');
                                        if (row && row.getAttribute('z.type') === 'Grw') {
                                            // Trova tutti gli input di tipo textbox nella riga
                                            const allInputs = row.querySelectorAll('input.textbox');
                                            for (const inp of allInputs) {
                                                if (inp.getAttribute('z.type') === 'zul.vd.Txbox') {
                                                    capInput = inp;
                                                    console.log('  → Campo CAP trovato:', capInput.id);
                                                    break;
                                                }
                                            }
                                            if (capInput) break;
                                        }
                                    }
                                }
                                if (capInput) break;
                            }

                            if (!capInput) {
                                throw new Error('Campo CAP non trovato');
                            }

                            const prevReadonly = capInput.hasAttribute('readonly');
                            if (prevReadonly) capInput.removeAttribute('readonly');

                            // Simula click del mouse sul campo
                            capInput.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                            capInput.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                            capInput.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                            capInput.focus();

                            await new Promise(resolve => setTimeout(resolve, 50));

                            // Seleziona tutto il contenuto esistente
                            capInput.select();
                            capInput.setSelectionRange(0, capInput.value.length);

                            await new Promise(resolve => setTimeout(resolve, 50));

                            // Scrivi il CAP carattere per carattere
                            capInput.value = '';

                            for (let i = 0; i < capValue.length; i++) {
                                const char = capValue[i];
                                const isLastChar = (i === capValue.length - 1);

                                capInput.value += char;

                                // Simula keydown
                                capInput.dispatchEvent(new KeyboardEvent('keydown', {
                                    key: char,
                                    code: 'Digit' + char,
                                    keyCode: char.charCodeAt(0),
                                    which: char.charCodeAt(0),
                                    bubbles: true,
                                    cancelable: true
                                }));

                                // Simula keypress
                                capInput.dispatchEvent(new KeyboardEvent('keypress', {
                                    key: char,
                                    code: 'Digit' + char,
                                    keyCode: char.charCodeAt(0),
                                    which: char.charCodeAt(0),
                                    bubbles: true,
                                    cancelable: true
                                }));

                                // Evento input per attivare eventuali listener
                                capInput.dispatchEvent(new Event('input', { bubbles: true }));

                                // Simula keyup
                                capInput.dispatchEvent(new KeyboardEvent('keyup', {
                                    key: char,
                                    code: 'Digit' + char,
                                    keyCode: char.charCodeAt(0),
                                    which: char.charCodeAt(0),
                                    bubbles: true,
                                    cancelable: true
                                }));

                                // Attendi tra ogni carattere per simulare digitazione umana
                                if (!isLastChar) {
                                    await new Promise(resolve => setTimeout(resolve, 50));
                                }
                            }

                            // Dispatch evento change dopo la digitazione completa
                            capInput.dispatchEvent(new Event('change', { bubbles: true }));

                            console.log(`  → CAP "${capValue}" digitato, perdita focus...`);

                            // Attendi un attimo prima di perdere il focus
                            await new Promise(resolve => setTimeout(resolve, 200));

                            // Simula perdita del focus che attiva l'autopopolamento
                            capInput.blur();

                            toast(`✓ CAP "${capValue}" inserito`, false);
                            if (prevReadonly) capInput.setAttribute('readonly', 'readonly');

                            console.log('  ✓ Enter simulato su CAP');
                            await new Promise(resolve => setTimeout(resolve, 600));
                        }

                        // STEP 6: Inserisci indirizzo cercando il label (Indirizzo, Via, Address Line 1, ecc.)
                        console.log('STEP 6/6: Inserimento indirizzo...');
                        const indirizzoValue = addr.value || '';
                        if (!indirizzoValue) {
                            toast('⚠ Indirizzo mancante', true);
                            console.warn('Indirizzo non disponibile');
                        } else {
                            // Cerca il label dell'indirizzo in tutti i documenti
                            let addrInput = null;
                            const possibleLabels = ['Indirizzo 1', 'Indirizzo', 'Via', 'Address', 'Address Line 1'];

                            for (const doc of searchDocs) {
                                const labels = doc.querySelectorAll('span.z-label');
                                for (const label of labels) {
                                    const labelText = label.textContent.trim();
                                    // Verifica se il label corrisponde esattamente a uno dei possibili nomi
                                    if (possibleLabels.includes(labelText)) {
                                        // Trova il tr parent usando closest con 'tr' semplice
                                        const row = label.closest('tr');
                                        if (row && row.getAttribute('z.type') === 'Grw') {
                                            // Trova tutti gli input di tipo textbox nella riga
                                            const allInputs = row.querySelectorAll('input.textbox');
                                            for (const inp of allInputs) {
                                                if (inp.getAttribute('z.type') === 'zul.vd.Txbox') {
                                                    addrInput = inp;
                                                    console.log('  → Campo indirizzo trovato:', addrInput.id, '(label:', labelText + ')');
                                                    break;
                                                }
                                            }
                                            if (addrInput) break;
                                        }
                                    }
                                }
                                if (addrInput) break;
                            }

                            if (!addrInput) {
                                throw new Error('Campo indirizzo non trovato');
                            }

                            const prevReadonly = addrInput.hasAttribute('readonly');
                            if (prevReadonly) addrInput.removeAttribute('readonly');

                            addrInput.focus();
                            addrInput.value = indirizzoValue;
                            addrInput.dispatchEvent(new Event('input', { bubbles: true }));
                            addrInput.dispatchEvent(new Event('change', { bubbles: true }));
                            addrInput.blur();

                            if (prevReadonly) addrInput.setAttribute('readonly', 'readonly');

                            console.log(`  → Indirizzo "${indirizzoValue}" inserito`);
                            toast(`✓ Indirizzo compilato`, false);
                        }

                        console.log('=== SEQUENZA SCHEDA INDIRIZZO COMPLETATA ===');
                        toast('✓ Scheda indirizzo compilata', false);

                    } catch (e) {
                        console.error('=== ERRORE NELLA SEQUENZA INDIRIZZO ===', e);
                        toast('⚠ Errore: ' + e.message, true);
                    }
                })();
                break;

            case 'metodoPagamento':
                // Sequenza: 1) Metodi di Pagamento, 2) Nuovo, 3) Griglia
                (async () => {
                    try {
                        console.log('=== INIZIO SEQUENZA METODO PAGAMENTO ===');

                        const searchDocs = [document];
                        const frames = document.querySelectorAll('iframe, frame');
                        frames.forEach(fr => {
                            try {
                                const doc = fr.contentDocument || fr.contentWindow?.document;
                                if (doc) searchDocs.push(doc);
                            } catch (_) { /* cross-origin */ }
                        });

                        // 1. Click su "Metodi di Pagamento" - cerca per testo
                        console.log('STEP 1/3: Click su "Metodi di Pagamento"...');
                        let metPagBtn = null;
                        for (const doc of searchDocs) {
                            const buttons = doc.querySelectorAll('button');
                            for (const btn of buttons) {
                                if (btn.textContent.trim() === 'Metodi di Pagamento') {
                                    metPagBtn = btn;
                                    console.log('  → Pulsante trovato:', btn.id, btn.className);
                                    break;
                                }
                            }
                            if (metPagBtn) break;
                        }
                        if (!metPagBtn) {
                            console.error('  ✗ Pulsante "Metodi di Pagamento" non trovato');
                            throw new Error('Pulsante Metodi di Pagamento non trovato');
                        }
                        metPagBtn.click();
                        console.log('  ✓ Click eseguito, attesa 1500ms...');
                        await new Promise(resolve => setTimeout(resolve, 1500));

                        // 2. Click su "Nuovo record" - cerca per immagine
                        console.log('STEP 2/3: Click su "Nuovo record"...');
                        let newBtn = null;
                        for (const doc of searchDocs) {
                            const newImgs = doc.querySelectorAll('img[src*="New24.png"]');
                            if (newImgs.length > 0) {
                                newBtn = newImgs[0].closest('a, button, [role="button"]') || newImgs[0].parentElement;
                                console.log('  → Pulsante trovato:', newBtn.tagName, newBtn.id, newBtn.className);
                                break;
                            }
                        }
                        if (!newBtn) {
                            console.error('  ✗ Pulsante "Nuovo record" non trovato');
                            throw new Error('Pulsante Nuovo record non trovato');
                        }
                        newBtn.click();
                        console.log('  ✓ Click eseguito, attesa 2000ms...');
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        // 3. Verifica se la vista griglia è già attiva, se no clicca sul pulsante
                        console.log('STEP 3/3: Verifica vista griglia...');
                        let isGridVisible = false;
                        for (const doc of searchDocs) {
                            const gridRow = doc.querySelector('tr[z\\.rid="z_bl_641"]');
                            if (gridRow) {
                                const visible = gridRow.getAttribute('z.visible');
                                const display = window.getComputedStyle(gridRow).display;
                                isGridVisible = visible === 'true' && display !== 'none';
                                console.log('  → Elemento griglia trovato, z.visible:', visible, 'display:', display, 'isVisible:', isGridVisible);
                                break;
                            }
                        }

                        if (isGridVisible) {
                            console.log('  ✓ Vista griglia già attiva, salto il click');
                        } else {
                            console.log('  → Vista griglia NON attiva, click sul pulsante...');
                            let gridBtn = null;
                            let gridImg = null;
                            for (const doc of searchDocs) {
                                const gridImgs = doc.querySelectorAll('img[src*="Multi24.png"]');
                                console.log(`  → Trovate ${gridImgs.length} immagini Multi24.png in questo documento`);
                                if (gridImgs.length > 0) {
                                    gridImg = gridImgs[0];
                                    gridBtn = gridImgs[0].closest('a[title*="Griglia"]');
                                    if (!gridBtn) {
                                        gridBtn = gridImgs[0].closest('a, button, [role="button"]') || gridImgs[0].parentElement;
                                    }
                                    console.log('  → Immagine trovata:', gridImg.id, gridImg.src);
                                    console.log('  → Pulsante parent trovato:', gridBtn.tagName, gridBtn.id, gridBtn.title);
                                    break;
                                }
                            }
                            if (!gridBtn) {
                                console.error('  ✗ Pulsante Griglia non trovato');
                                throw new Error('Pulsante Griglia non trovato');
                            }

                            console.log('  → Provo metodo 1: click() diretto...');
                            gridBtn.click();
                            console.log('  ✓ click() eseguito');

                            console.log('  → Provo metodo 2: focus + click...');
                            gridBtn.focus();
                            gridBtn.click();
                            console.log('  ✓ focus + click eseguito');

                            console.log('  → Provo metodo 3: eventi mouse...');
                            gridBtn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
                            gridBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
                            gridBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
                            gridBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
                            console.log('  ✓ Eventi mouse eseguiti');

                            // Attendi 1 secondo dopo il click sulla griglia
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }

                        // 4. Check "Per Mandato"
                        console.log('STEP 4/7: Check Per Mandato...');
                        let mandatoCheckbox = null;
                        for (const doc of searchDocs) {
                            const mandatoSpans = doc.querySelectorAll('span.z-checkbox[title]');
                            for (const span of mandatoSpans) {
                                const title = (span.getAttribute('title') || '').trim();
                                const cleanTitle = title.replace(/[(\)\s]/g, '');
                                if (cleanTitle.includes('IsPerMandato')) {
                                    mandatoCheckbox = span.querySelector('input[type="checkbox"]');
                                    if (mandatoCheckbox) {
                                        console.log('  → Checkbox trovata:', mandatoCheckbox.id);
                                        if (!mandatoCheckbox.checked) {
                                            mandatoCheckbox.click();
                                            console.log('  ✓ Checkbox selezionata');
                                        }
                                        break;
                                    }
                                }
                            }
                            if (mandatoCheckbox) break;
                        }
                        await new Promise(resolve => setTimeout(resolve, 500));

                        // 5. Attendi che il campo Metodo di Pagamento appaia e seleziona "SEPA CREDIT TRANSFER"
                        console.log('STEP 5/7: Attesa campo Metodo di Pagamento...');
                        let metodoPagInput = null;
                        let comboDoc = null;
                        let attempts = 0;
                        const maxAttempts = 20; // 10 secondi max

                        while (!metodoPagInput && attempts < maxAttempts) {
                            const currentSearchDocs = [document];
                            const currentFrames = document.querySelectorAll('iframe, frame');
                            currentFrames.forEach(fr => {
                                try {
                                    const doc = fr.contentDocument || fr.contentWindow?.document;
                                    if (doc && doc.documentElement) currentSearchDocs.push(doc);
                                } catch (_) { /* cross-origin */ }
                            });

                            for (const doc of currentSearchDocs) {
                                // Cerca il parent span.z-combobox con title (non l'input direttamente)
                                const allComboboxSpans = doc.querySelectorAll('span.z-combobox[title]');
                                for (const comboSpan of allComboboxSpans) {
                                    const title = (comboSpan.getAttribute('title') || '').trim();
                                    const cleanTitle = title.replace(/[(\)\s]/g, '');
                                    if (cleanTitle.includes('MetodoPagamento') || cleanTitle.includes('MetodidiPagamento')) {
                                        // Trova l'input dentro questo span
                                        metodoPagInput = comboSpan.querySelector('input.z-combobox-inp');
                                        if (metodoPagInput) {
                                            comboDoc = doc;
                                            console.log('  → Campo trovato:', metodoPagInput.id, 'dal parent span:', comboSpan.id);
                                            break;
                                        }
                                    }
                                }
                                if (metodoPagInput) break;
                            }
                            if (!metodoPagInput) {
                                attempts++;
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        }

                        if (!metodoPagInput) {
                            console.error('  ✗ Campo Metodo Pagamento non trovato');
                            throw new Error('Campo Metodo Pagamento non trovato');
                        }

                        console.log('  → Selezione SEPA CREDIT TRANSFER...');
                        // Simula comportamento umano completo: click, selezione, digitazione intervallata, autocomplete, Enter
                        const prevReadonly = metodoPagInput.hasAttribute('readonly');
                        if (prevReadonly) metodoPagInput.removeAttribute('readonly');

                        // 1. Click sul campo per attivarlo
                        metodoPagInput.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                        metodoPagInput.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                        metodoPagInput.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                        metodoPagInput.focus();

                        await new Promise(resolve => setTimeout(resolve, 50));

                        // 2. Seleziona tutto il testo esistente
                        metodoPagInput.select();
                        metodoPagInput.setSelectionRange(0, metodoPagInput.value.length);

                        await new Promise(resolve => setTimeout(resolve, 50));

                        // 3. Scrivi "S" carattere per carattere con delay tra ogni carattere
                        const text = 'S';
                        metodoPagInput.value = '';

                        for (let i = 0; i < text.length; i++) {
                            const char = text[i];
                            metodoPagInput.value += char;

                            // Simula keydown
                            metodoPagInput.dispatchEvent(new KeyboardEvent('keydown', {
                                key: char,
                                code: 'Key' + char.toUpperCase(),
                                keyCode: char.charCodeAt(0),
                                which: char.charCodeAt(0),
                                bubbles: true,
                                cancelable: true
                            }));

                            // Simula keypress
                            metodoPagInput.dispatchEvent(new KeyboardEvent('keypress', {
                                key: char,
                                code: 'Key' + char.toUpperCase(),
                                keyCode: char.charCodeAt(0),
                                which: char.charCodeAt(0),
                                bubbles: true,
                                cancelable: true
                            }));

                            // Evento input per attivare l'autocomplete
                            metodoPagInput.dispatchEvent(new Event('input', { bubbles: true }));

                            // Simula keyup
                            metodoPagInput.dispatchEvent(new KeyboardEvent('keyup', {
                                key: char,
                                code: 'Key' + char.toUpperCase(),
                                keyCode: char.charCodeAt(0),
                                which: char.charCodeAt(0),
                                bubbles: true,
                                cancelable: true
                            }));

                            // Attendi tra ogni carattere per dare tempo all'autocomplete di attivarsi
                            await new Promise(resolve => setTimeout(resolve, 10));
                        }

                        // 4. Attendi che l'autocomplete si attivi completamente
                        await new Promise(resolve => setTimeout(resolve, 300));

                        // 5. Simula Enter per confermare la selezione dall'autocomplete
                        metodoPagInput.dispatchEvent(new KeyboardEvent('keydown', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true,
                            cancelable: true
                        }));
                        metodoPagInput.dispatchEvent(new KeyboardEvent('keypress', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true,
                            cancelable: true
                        }));
                        metodoPagInput.dispatchEvent(new KeyboardEvent('keyup', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true,
                            cancelable: true
                        }));

                        await new Promise(resolve => setTimeout(resolve, 100));

                        metodoPagInput.blur();
                        if (prevReadonly) metodoPagInput.setAttribute('readonly', 'readonly');

                        console.log('  ✓ SEPA digitato e confermato con Enter (comportamento umano)');
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        // 6. Seleziona "ESENTE" nel combobox Soggetto Destinatario Delle Spese
                        console.log('STEP 6/7: Selezione ESENTE in Soggetto Destinatario...');
                        let soggettoInput = null;
                        let soggettoDoc = null;
                        for (const doc of searchDocs) {
                            const soggettoSpans = doc.querySelectorAll('span.z-combobox[title]');
                            for (const span of soggettoSpans) {
                                const title = (span.getAttribute('title') || '').trim();
                                const cleanTitle = title.replace(/[(\)\s]/g, '');
                                if (cleanTitle.includes('SoggettoDestinatarioDelleSpese')) {
                                    soggettoInput = span.querySelector('input.z-combobox-inp');
                                    if (soggettoInput) {
                                        soggettoDoc = doc;
                                        console.log('  → Campo trovato:', soggettoInput.id);
                                        break;
                                    }
                                }
                            }
                            if (soggettoInput) break;
                        }
                        if (soggettoInput) {
                            // Simula comportamento umano: click, selezione, digitazione "E", Enter
                            const prevReadonlySogg = soggettoInput.hasAttribute('readonly');
                            if (prevReadonlySogg) soggettoInput.removeAttribute('readonly');

                            // 1. Click sul campo
                            soggettoInput.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                            soggettoInput.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                            soggettoInput.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                            soggettoInput.focus();

                            await new Promise(resolve => setTimeout(resolve, 50));

                            // 2. Seleziona tutto il testo esistente
                            soggettoInput.select();
                            soggettoInput.setSelectionRange(0, soggettoInput.value.length);

                            await new Promise(resolve => setTimeout(resolve, 50));

                            // 3. Scrivi "E"
                            const textSogg = 'E';
                            soggettoInput.value = '';

                            for (let i = 0; i < textSogg.length; i++) {
                                const char = textSogg[i];
                                soggettoInput.value += char;

                                soggettoInput.dispatchEvent(new KeyboardEvent('keydown', {
                                    key: char,
                                    code: 'Key' + char.toUpperCase(),
                                    keyCode: char.charCodeAt(0),
                                    which: char.charCodeAt(0),
                                    bubbles: true,
                                    cancelable: true
                                }));

                                soggettoInput.dispatchEvent(new KeyboardEvent('keypress', {
                                    key: char,
                                    code: 'Key' + char.toUpperCase(),
                                    keyCode: char.charCodeAt(0),
                                    which: char.charCodeAt(0),
                                    bubbles: true,
                                    cancelable: true
                                }));

                                soggettoInput.dispatchEvent(new Event('input', { bubbles: true }));

                                soggettoInput.dispatchEvent(new KeyboardEvent('keyup', {
                                    key: char,
                                    code: 'Key' + char.toUpperCase(),
                                    keyCode: char.charCodeAt(0),
                                    which: char.charCodeAt(0),
                                    bubbles: true,
                                    cancelable: true
                                }));

                                await new Promise(resolve => setTimeout(resolve, 10));
                            }

                            // 4. Attendi autocomplete
                            await new Promise(resolve => setTimeout(resolve, 300));

                            // 5. Simula Enter
                            soggettoInput.dispatchEvent(new KeyboardEvent('keydown', {
                                key: 'Enter',
                                code: 'Enter',
                                keyCode: 13,
                                which: 13,
                                bubbles: true,
                                cancelable: true
                            }));
                            soggettoInput.dispatchEvent(new KeyboardEvent('keypress', {
                                key: 'Enter',
                                code: 'Enter',
                                keyCode: 13,
                                which: 13,
                                bubbles: true,
                                cancelable: true
                            }));
                            soggettoInput.dispatchEvent(new KeyboardEvent('keyup', {
                                key: 'Enter',
                                code: 'Enter',
                                keyCode: 13,
                                which: 13,
                                bubbles: true,
                                cancelable: true
                            }));

                            await new Promise(resolve => setTimeout(resolve, 100));

                            soggettoInput.blur();
                            if (prevReadonlySogg) soggettoInput.setAttribute('readonly', 'readonly');

                            console.log('  ✓ ESENTE digitato e confermato con Enter');
                        }
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        // 7. Seleziona "Nessuna" nel combobox Causale Esenzione Spese
                        console.log('STEP 7/7: Selezione Nessuna in Causale Esenzione...');
                        let causaleInput = null;
                        let causaleDoc = null;
                        for (const doc of searchDocs) {
                            const causaleSpans = doc.querySelectorAll('span.z-combobox[title]');
                            for (const span of causaleSpans) {
                                const title = (span.getAttribute('title') || '').trim();
                                const cleanTitle = title.replace(/[(\)\s]/g, '');
                                if (cleanTitle.includes('CausaleEsenzioneSpese')) {
                                    causaleInput = span.querySelector('input.z-combobox-inp');
                                    if (causaleInput) {
                                        causaleDoc = doc;
                                        console.log('  → Campo trovato:', causaleInput.id);
                                        break;
                                    }
                                }
                            }
                            if (causaleInput) break;
                        }
                        if (causaleInput) {
                            await selectComboboxValue(causaleInput.id, 'Nessuna', causaleDoc);
                            console.log('  ✓ Nessuna selezionato');
                        }
                        await new Promise(resolve => setTimeout(resolve, 800));

                        console.log('=== SEQUENZA COMPLETATA ===');
                        toast('✓ Metodo pagamento configurato', false);

                    } catch (e) {
                        console.error('=== ERRORE NELLA SEQUENZA ===', e);
                        toast('⚠ Errore: ' + e.message, true);
                    }
                })();
                break;

            default:
                console.warn(`Comando sconosciuto: ${command}`);
                toast(`⚠ Comando sconosciuto: ${command}`, true);
        }
    }

    const WS_URL = 'ws://127.0.0.1:12345';
    const WS_RECONNECT_INTERVAL = 5000;
    let wsReconnectTimer = null;

    function connectWebSocket() {
        if (ws && ws.readyState === WebSocket.OPEN) return;

        try {
            ws = new WebSocket(WS_URL);

            ws.onopen = () => {
                console.log('WebSocket connesso a', WS_URL);
                toast('✓ Connesso ad ASP Anagrafica Desktop', false);
                if (wsReconnectTimer) { clearInterval(wsReconnectTimer); wsReconnectTimer = null; }
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('WS messaggio ricevuto:', message);
                    if (message.command) {
                        handleWebSocketCommand(message.command, message.data);
                    } else {
                        ta.value = JSON.stringify(message, null, 2);
                        save('tm_json', ta.value);
                        autoParseFromTextarea();
                        toast('📥 Dati ricevuti dal server', false);
                    }
                } catch (e) {
                    console.error('Errore parsing messaggio WS:', e);
                    toast('⚠ Messaggio ricevuto non valido', true);
                }
            };

            ws.onclose = () => {
                console.log('WebSocket disconnesso, riconnessione tra 5s...');
                scheduleReconnect();
            };

            ws.onerror = (err) => {
                console.error('Errore WebSocket:', err);
            };
        } catch (e) {
            console.error('Errore creazione WebSocket:', e);
            scheduleReconnect();
        }
    }

    function scheduleReconnect() {
        if (!wsReconnectTimer) {
            wsReconnectTimer = setInterval(connectWebSocket, WS_RECONNECT_INTERVAL);
        }
    }

    connectWebSocket();
})();
