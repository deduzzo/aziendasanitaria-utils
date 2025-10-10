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
        input.focus();
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
        inp.focus();
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
      <div class="tm-small">Incolla qui il JSON (nome, cognome, cf, dataNascita, indirizzoResidenza, ...)</div>
      <textarea id="tmTextarea" class="tm-mm-textarea" placeholder='{"nome":"ROBERTO","cognome":"DE DOMENICO","cf":"...","dataNascita":"dd/MM/yyyy","indirizzoResidenza":"PACE SALITA BISIGNANI 3, 98167 MESSINA (ME)"}'></textarea>

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
    }, 300);

    ta.addEventListener('input', () => { save('tm_json', ta.value); autoParseFromTextarea(); });
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

    /* ====================== WebSocket Connection ====================== */
    let ws = null;
    let reconnectInterval = null;

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

            case 'apriMenuRicercaAssistito':
                // Clicca sul menu "Anagrafica Paziente"
                try {
                    const menuItem = document.getElementById('z_rk_59');
                    if (menuItem) {
                        menuItem.click();
                        toast('✓ Menu Anagrafica Paziente aperto', false);
                    } else {
                        console.warn('Menu item z_rk_59 non trovato');
                        toast('⚠ Menu non trovato', true);
                    }
                } catch (e) {
                    console.error('Errore nell\'apertura del menu:', e);
                    toast('⚠ Errore apertura menu', true);
                }
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
                // Clicca sul pulsante "Indirizzo"
                try {
                    console.log('Ricerca pulsante "Indirizzo"...');

                    // Cerca il pulsante "Indirizzo" in tutti i documenti
                    let addressButton = null;
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

                    console.log('Pulsante "Indirizzo" trovato:', addressButton);
                    addressButton.click();
                    toast('✓ Scheda Indirizzo aperta', false);

                } catch (e) {
                    console.error('Errore apertura scheda indirizzo:', e);
                    toast('⚠ Errore apertura scheda indirizzo', true);
                }
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
                        }

                        // 4. Attendi che il campo Metodo di Pagamento appaia e seleziona "SEPA CREDIT TRANSFER"
                        console.log('STEP 4/4: Attesa campo Metodo di Pagamento...');
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
                        await selectComboboxValue(metodoPagInput.id, 'SEPA CREDIT TRANSFER', comboDoc);
                        console.log('  ✓ Valore selezionato');
                        await new Promise(resolve => setTimeout(resolve, 800));

                        // 5. Check "Per Reversale"
                        console.log('STEP 5/6: Check Per Reversale...');
                        let reversaleCheckbox = null;
                        for (const doc of searchDocs) {
                            const reversaleSpans = doc.querySelectorAll('span.z-checkbox[title]');
                            for (const span of reversaleSpans) {
                                const title = (span.getAttribute('title') || '').trim();
                                const cleanTitle = title.replace(/[(\)\s]/g, '');
                                if (cleanTitle.includes('IsPerReversale')) {
                                    reversaleCheckbox = span.querySelector('input[type="checkbox"]');
                                    if (reversaleCheckbox) {
                                        console.log('  → Checkbox trovata:', reversaleCheckbox.id);
                                        if (!reversaleCheckbox.checked) {
                                            reversaleCheckbox.click();
                                            console.log('  ✓ Checkbox selezionata');
                                        }
                                        break;
                                    }
                                }
                            }
                            if (reversaleCheckbox) break;
                        }
                        await new Promise(resolve => setTimeout(resolve, 600));

                        // 6. Check "Per Mandato"
                        console.log('STEP 6/6: Check Per Mandato...');
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
                        await new Promise(resolve => setTimeout(resolve, 800));

                        // 7. Seleziona "ESENTE" nel combobox Soggetto Destinatario Delle Spese
                        console.log('STEP 7/8: Selezione ESENTE in Soggetto Destinatario...');
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
                            await selectComboboxValue(soggettoInput.id, 'ESENTE', soggettoDoc);
                            console.log('  ✓ ESENTE selezionato');
                        }
                        await new Promise(resolve => setTimeout(resolve, 800));

                        // 8. Seleziona "Nessuna" nel combobox Causale Esenzione Spese
                        console.log('STEP 8/8: Selezione Nessuna in Causale Esenzione...');
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

    function connectWebSocket() {
        if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
            console.log('WebSocket già connesso o in connessione');
            return;
        }

        try {
            ws = new WebSocket('ws://localhost:12345');

            ws.onopen = () => {
                console.log('Connesso al server WebSocket locale');
                toast('✓ Connesso al server locale', false);
                if (reconnectInterval) {
                    clearInterval(reconnectInterval);
                    reconnectInterval = null;
                }
            };

            ws.onmessage = (event) => {
                console.log('Messaggio ricevuto dal server:', event.data);
                try {
                    const message = JSON.parse(event.data);

                    // Gestione comandi strutturati
                    if (message.command) {
                        handleWebSocketCommand(message.command, message.data);
                    } else {
                        // Retrocompatibilità: se non c'è il campo command, tratta come dati paziente
                        ta.value = JSON.stringify(message, null, 2);
                        save('tm_json', ta.value);
                        autoParseFromTextarea();
                        toast('📥 Dati ricevuti dal server', false);
                    }
                } catch (e) {
                    console.error('Errore nel parsing del messaggio ricevuto:', e);
                    toast('⚠ Messaggio ricevuto non valido', true);
                }
            };

            ws.onerror = (error) => {
                console.error('Errore WebSocket:', error);
            };

            ws.onclose = () => {
                console.log('Connessione WebSocket chiusa');
                ws = null;
                // Tenta riconnessione automatica ogni 5 secondi
                if (!reconnectInterval) {
                    reconnectInterval = setInterval(() => {
                        console.log('Tentativo di riconnessione...');
                        connectWebSocket();
                    }, 5000);
                }
            };
        } catch (e) {
            console.error('Errore nella creazione della connessione WebSocket:', e);
        }
    }

    // Connetti al caricamento dello script
    connectWebSocket();
})();
