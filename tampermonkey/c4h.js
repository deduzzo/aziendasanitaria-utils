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
})();
