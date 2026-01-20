// ==UserScript==
// @name         Protocollo ASP - Stampa Etichetta
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Stampa etichette protocollo su Zebra GK420t (100x50mm) via server locale
// @match        https://protocollo.asp.messina.it/InteractiveDashboard/Reserved/Card/Detail*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Protocollo-Etichetta] Script inizializzato v2.0');

    // Configurazione
    const CONFIG = {
        serverUrl: 'http://localhost:3457',
        printEndpoint: '/print'
    };

    // CSS per la modal
    const modalStyles = `
        #etichetta-modal {
            position: fixed;
            top: 100px;
            right: 20px;
            width: 280px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.25);
            z-index: 99999;
            font-family: 'Segoe UI', Arial, sans-serif;
            overflow: hidden;
        }
        #etichetta-modal-header {
            background: linear-gradient(135deg, #1976D2, #1565C0);
            color: white;
            padding: 12px 16px;
            font-weight: 600;
            font-size: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
        }
        #etichetta-modal-header .close-btn {
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
            opacity: 0.8;
            transition: opacity 0.2s;
        }
        #etichetta-modal-header .close-btn:hover {
            opacity: 1;
        }
        #etichetta-modal-content {
            padding: 16px;
        }
        #etichetta-preview {
            border: 2px dashed #ccc;
            padding: 10px;
            margin-bottom: 12px;
            background: #fafafa;
            font-size: 11px;
            line-height: 1.4;
        }
        #etichetta-preview .preview-title {
            font-weight: bold;
            text-align: center;
            margin-bottom: 6px;
            font-size: 10px;
        }
        #etichetta-preview .preview-tipo {
            text-align: center;
            font-size: 9px;
            color: #666;
            margin-bottom: 4px;
        }
        #etichetta-preview .preview-protocollo {
            text-align: center;
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 4px;
        }
        #etichetta-preview .preview-data {
            text-align: center;
            font-size: 10px;
        }
        #etichetta-server-status {
            font-size: 11px;
            padding: 6px 10px;
            margin-bottom: 10px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        #etichetta-server-status.online {
            background: #E8F5E9;
            color: #2E7D32;
        }
        #etichetta-server-status.offline {
            background: #FFEBEE;
            color: #C62828;
        }
        #etichetta-server-status .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }
        #etichetta-server-status.online .dot {
            background: #4CAF50;
        }
        #etichetta-server-status.offline .dot {
            background: #F44336;
        }
        #etichetta-btn-stampa {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #43A047, #388E3C);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.2s;
        }
        #etichetta-btn-stampa:hover:not(:disabled) {
            background: linear-gradient(135deg, #388E3C, #2E7D32);
            transform: translateY(-1px);
        }
        #etichetta-btn-stampa:active:not(:disabled) {
            transform: translateY(0);
        }
        #etichetta-btn-stampa:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        #etichetta-status {
            margin-top: 10px;
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
            text-align: center;
            display: none;
        }
        #etichetta-status.success {
            display: block;
            background: #E8F5E9;
            color: #2E7D32;
        }
        #etichetta-status.error {
            display: block;
            background: #FFEBEE;
            color: #C62828;
        }
        #etichetta-status.loading {
            display: block;
            background: #E3F2FD;
            color: #1565C0;
        }
    `;

    // Inietta gli stili
    function injectStyles() {
        if (document.getElementById('etichetta-styles')) return;
        const style = document.createElement('style');
        style.id = 'etichetta-styles';
        style.textContent = modalStyles;
        document.head.appendChild(style);
    }

    // Verifica se il server è online
    function checkServerStatus() {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: CONFIG.serverUrl + '/',
                timeout: 2000,
                onload: (response) => {
                    resolve(response.status === 200);
                },
                onerror: () => resolve(false),
                ontimeout: () => resolve(false)
            });
        });
    }

    // Aggiorna indicatore stato server
    async function updateServerStatus() {
        const statusEl = document.getElementById('etichetta-server-status');
        const btn = document.getElementById('etichetta-btn-stampa');
        if (!statusEl) return;

        const isOnline = await checkServerStatus();

        if (isOnline) {
            statusEl.className = 'online';
            statusEl.innerHTML = '<span class="dot"></span> Server Zebra: Online';
            if (btn) btn.disabled = false;
        } else {
            statusEl.className = 'offline';
            statusEl.innerHTML = '<span class="dot"></span> Server Zebra: Offline';
            if (btn) btn.disabled = true;
        }

        return isOnline;
    }

    // Estrae i dati del protocollo dalla pagina
    function extractProtocolData() {
        const data = {
            tipoDocumento: '',
            numeroProtocollo: '',
            dataProtocollo: '',
            azienda: 'Azienda Sanitaria Provinciale Messina'
        };

        // Tipo documento dall'header
        const tipoEl = document.querySelector('[class*="cardHeaderLabel"]');
        if (tipoEl) {
            const tipoText = tipoEl.textContent || '';
            const match = tipoText.match(/Tipo documento[:\s]+([^\n]+)/i);
            if (match) {
                data.tipoDocumento = match[1].trim();
            }
        }

        // Fallback: cerca nel campo form
        if (!data.tipoDocumento) {
            const tipoInput = document.querySelector('input[value*="Protocollo"]');
            if (tipoInput) {
                data.tipoDocumento = tipoInput.value;
            }
        }

        // Fallback 2: cerca il generic element
        if (!data.tipoDocumento) {
            const tipoGeneric = Array.from(document.querySelectorAll('div, span')).find(el => {
                const text = el.textContent || '';
                return (text.includes('Protocollo in Uscita') ||
                       text.includes('Protocollo in Entrata') ||
                       text.includes('Documento Interno')) &&
                       el.childElementCount === 0;
            });
            if (tipoGeneric && tipoGeneric.textContent.length < 50) {
                data.tipoDocumento = tipoGeneric.textContent.trim();
            }
        }

        // Numero Protocollo - cerca nell'header
        const headerElements = document.querySelectorAll('[class*="cardHeader"] span, [class*="cardHeader"] div');
        headerElements.forEach(el => {
            const text = el.textContent || '';
            const match = text.match(/\d{7}\/\d{2}/);
            if (match && !data.numeroProtocollo) {
                data.numeroProtocollo = match[0];
            }
        });

        // Fallback: cerca nel campo input
        if (!data.numeroProtocollo) {
            const numInput = document.querySelector('input[type="text"]');
            if (numInput && numInput.value && /\d{7}\/\d{2}/.test(numInput.value)) {
                data.numeroProtocollo = numInput.value;
            }
        }

        // Fallback 2: cerca nel body
        if (!data.numeroProtocollo) {
            const allText = document.body.innerText;
            const match = allText.match(/N\.\s*Protocollo[:\s]+(\d{7}\/\d{2})/i);
            if (match) {
                data.numeroProtocollo = match[1];
            }
        }

        // Data Protocollo
        const dataPattern = /\d{2}\/\d{2}\/\d{4}/;

        headerElements.forEach(el => {
            const text = el.textContent || '';
            const match = text.match(dataPattern);
            if (match && !data.dataProtocollo) {
                data.dataProtocollo = match[0];
            }
        });

        // Fallback: cerca nei campi input
        if (!data.dataProtocollo) {
            const dataInputs = document.querySelectorAll('input[type="text"]');
            dataInputs.forEach(input => {
                if (dataPattern.test(input.value) && !data.dataProtocollo) {
                    data.dataProtocollo = input.value;
                }
            });
        }

        console.log('[Protocollo-Etichetta] Dati estratti:', data);
        return data;
    }

    // Aggiorna l'anteprima
    function updatePreview() {
        const data = extractProtocolData();
        const preview = document.getElementById('etichetta-preview');
        if (preview) {
            preview.innerHTML = `
                <div class="preview-title">${data.azienda}</div>
                <div class="preview-tipo">${data.tipoDocumento || '(tipo documento)'}</div>
                <div class="preview-protocollo">N. ${data.numeroProtocollo || '-------/--'}</div>
                <div class="preview-data">del ${data.dataProtocollo || '--/--/----'}</div>
            `;
        }
        return data;
    }

    // Stampa l'etichetta via server locale
    async function printLabel() {
        const data = extractProtocolData();
        const btn = document.getElementById('etichetta-btn-stampa');

        if (!data.numeroProtocollo) {
            showStatus('Impossibile leggere il numero protocollo', 'error');
            return;
        }

        // Verifica server
        const isOnline = await checkServerStatus();
        if (!isOnline) {
            showStatus('Server Zebra offline! Avvia: node server.js', 'error');
            return;
        }

        // Disabilita pulsante durante la stampa
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>⏳</span><span>Stampa in corso...</span>';
        }

        showStatus('Invio alla stampante...', 'loading');

        // Invia richiesta al server
        GM_xmlhttpRequest({
            method: 'POST',
            url: CONFIG.serverUrl + CONFIG.printEndpoint,
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(data),
            onload: (response) => {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<span>🖨️</span><span>STAMPA ETICHETTA</span>';
                }

                try {
                    const result = JSON.parse(response.responseText);
                    if (result.success) {
                        showStatus('✓ Etichetta stampata!', 'success');
                    } else {
                        showStatus('Errore: ' + (result.error || 'sconosciuto'), 'error');
                    }
                } catch (e) {
                    showStatus('Errore risposta server', 'error');
                }
            },
            onerror: (error) => {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<span>🖨️</span><span>STAMPA ETICHETTA</span>';
                }
                showStatus('Errore connessione al server', 'error');
                console.error('[Protocollo-Etichetta] Errore:', error);
            }
        });
    }

    // Mostra messaggio di stato
    function showStatus(message, type) {
        const status = document.getElementById('etichetta-status');
        if (status) {
            status.textContent = message;
            status.className = type;

            if (type === 'success') {
                setTimeout(() => {
                    status.style.display = 'none';
                }, 3000);
            }
        }
    }

    // Crea la modal
    function createModal() {
        // Rimuovi modal esistente
        const existing = document.getElementById('etichetta-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'etichetta-modal';
        modal.innerHTML = `
            <div id="etichetta-modal-header">
                <span>🏷️ Stampa Etichetta</span>
                <button class="close-btn" title="Chiudi">&times;</button>
            </div>
            <div id="etichetta-modal-content">
                <div id="etichetta-server-status" class="offline">
                    <span class="dot"></span> Verifica server...
                </div>
                <div id="etichetta-preview">
                    <div class="preview-title">Caricamento...</div>
                </div>
                <button id="etichetta-btn-stampa" disabled>
                    <span>🖨️</span>
                    <span>STAMPA ETICHETTA</span>
                </button>
                <div id="etichetta-status"></div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        modal.querySelector('.close-btn').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        modal.querySelector('#etichetta-btn-stampa').addEventListener('click', printLabel);

        // Drag functionality
        makeDraggable(modal);

        // Aggiorna preview e stato server
        setTimeout(async () => {
            updatePreview();
            await updateServerStatus();
        }, 500);

        // Controlla stato server ogni 10 secondi
        setInterval(updateServerStatus, 10000);
    }

    // Rende la modal trascinabile
    function makeDraggable(element) {
        const header = element.querySelector('#etichetta-modal-header');
        let isDragging = false;
        let offsetX, offsetY;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('close-btn')) return;
            isDragging = true;
            offsetX = e.clientX - element.offsetLeft;
            offsetY = e.clientY - element.offsetTop;
            element.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            element.style.left = (e.clientX - offsetX) + 'px';
            element.style.top = (e.clientY - offsetY) + 'px';
            element.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            element.style.cursor = '';
        });
    }

    // Inizializzazione
    function init() {
        if (!window.location.href.includes('/Card/Detail')) {
            console.log('[Protocollo-Etichetta] Non sulla pagina di dettaglio, skip');
            return;
        }

        console.log('[Protocollo-Etichetta] Inizializzazione modal...');

        injectStyles();

        setTimeout(() => {
            createModal();
            console.log('[Protocollo-Etichetta] Modal creata');
        }, 1500);
    }

    // Avvia quando il DOM è pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Gestisci navigazione SPA
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            setTimeout(init, 1000);
        }
    }).observe(document, { subtree: true, childList: true });

})();
