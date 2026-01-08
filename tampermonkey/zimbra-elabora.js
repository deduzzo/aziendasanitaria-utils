// ==UserScript==
// @name         Zimbra - Elabora Email con Claude
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  Aggiunge pulsante AI arancione su Zimbra per inviare email e allegati a Claude tramite MCP
// @match        *://posta.asp.messina.it/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Zimbra-Elabora] Script inizializzato v1.8 - Pulsante AI arancione');

    // Configurazione
    const CONFIG = {
        mcpServerUrl: 'http://localhost:3456',
        buttonIcon: '✦', // Icona AI (stellina)
    };

    // Trova il pulsante Rispondi attivo (può essere in diverse viste: main, ricerca, ecc.)
    function findReplyButton() {
        // Cerca tutti i pulsanti REPLY visibili nella pagina
        const replyButtons = Array.from(document.querySelectorAll('[id*="__REPLY"]'))
            .filter(el => {
                // Escludi elementi secondari (icone, titoli, dropdown)
                if (el.id.includes('_left_icon') || el.id.includes('_title') ||
                    el.id.includes('_right_icon') || el.id.includes('_dropdown') ||
                    el.id.includes('_ALL')) {
                    return false;
                }
                // Deve essere visibile
                const rect = el.getBoundingClientRect();
                return rect.top > 0 && rect.top < 1000 && rect.width > 0;
            });

        return replyButtons.length > 0 ? replyButtons[0] : null;
    }

    // Ottiene l'ID base dalla vista corrente (es: "zb__TV-main" o "zb__TV-SR-1")
    function getViewBaseId() {
        const replyBtn = findReplyButton();
        if (!replyBtn) return null;

        // Estrae il prefisso (es: "zb__TV-main" da "zb__TV-main__REPLY")
        const match = replyBtn.id.match(/^(.*?)__REPLY/);
        return match ? match[1] : null;
    }

    // Flag per observer
    let observerActive = false;

    // Utility: aspetta che un elemento sia disponibile nel DOM
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver(() => {
                if (document.querySelector(selector)) {
                    observer.disconnect();
                    resolve(document.querySelector(selector));
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Timeout: ${selector} non trovato`));
            }, timeout);
        });
    }

    // Mostra notifica toast
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#2563eb'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 999999;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 400px;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    // Estrai il contenuto testuale dell'email
    function extractEmailContent() {
        try {
            console.log('[Zimbra-Elabora] 📄 Inizio estrazione contenuto email...');

            // Trova il contenitore del messaggio correntemente visualizzato
            const messageContainers = Array.from(document.querySelectorAll('[id*="zv__TV"][id*="__MSG"]'))
                .filter(el => {
                    const rect = el.getBoundingClientRect();
                    return rect.top > 0 && rect.top < 1000 && rect.height > 100;
                });

            // Usa il primo container trovato (quello visibile)
            const messageContainer = messageContainers.length > 0 ? messageContainers[0] : document;
            console.log('[Zimbra-Elabora] Container messaggio per contenuto:', messageContainer.id || 'documento intero');

            // Corpo del messaggio - prova vari selettori NEL CONTAINER CORRENTE
            let bodyText = '';
            const bodySelectors = [
                '[id*="MSG__body"]',
                '.MsgBody',
                '[class*="MsgBody"]',
                'iframe'  // A volte il corpo è in un iframe
            ];

            for (const selector of bodySelectors) {
                const element = messageContainer.querySelector(selector);
                if (element) {
                    if (element.tagName === 'IFRAME') {
                        // Prova a leggere dall'iframe
                        try {
                            const iframeDoc = element.contentDocument || element.contentWindow.document;
                            bodyText = iframeDoc.body ? iframeDoc.body.innerText : '';
                        } catch (e) {
                            console.warn('[Zimbra-Elabora] Impossibile leggere iframe (CORS?)');
                        }
                    } else {
                        bodyText = element.innerText || element.textContent || '';
                    }

                    if (bodyText.length > 0) {
                        console.log(`[Zimbra-Elabora] ✓ Corpo trovato con selettore: ${selector} (${bodyText.length} caratteri)`);
                        break;
                    }
                }
            }

            // Mittente, destinatario, oggetto - cerca NEL CONTAINER CORRENTE
            let from = '';
            let to = '';
            let subject = '';
            let date = '';

            // Da (mittente)
            const fromSelectors = ['[id*="_from"]', '.MsgHdrFrom', '[class*="From"]'];
            for (const sel of fromSelectors) {
                const el = messageContainer.querySelector(sel);
                if (el && el.textContent) {
                    from = el.textContent.replace(/^Da:\s*/i, '').trim();
                    if (from) break;
                }
            }

            // A (destinatario)
            const toSelectors = ['[id*="_to"]', '.MsgHdrTo', '[class*="To"]'];
            for (const sel of toSelectors) {
                const el = messageContainer.querySelector(sel);
                if (el && el.textContent) {
                    to = el.textContent.replace(/^A:\s*/i, '').trim();
                    if (to) break;
                }
            }

            // Oggetto
            const subjectSelectors = ['.SubjectCol', '[id*="subject"]', '.MsgHdrSubject', 'h1'];
            for (const sel of subjectSelectors) {
                const el = messageContainer.querySelector(sel);
                if (el && el.textContent) {
                    subject = el.textContent.replace(/^Oggetto:\s*/i, '').trim();
                    if (subject && subject.length > 3) break;
                }
            }

            // Data
            const dateSelectors = ['[id*="_date"]', '.MsgHdrDate', '[class*="Date"]'];
            for (const sel of dateSelectors) {
                const el = messageContainer.querySelector(sel);
                if (el && el.textContent) {
                    date = el.textContent.replace(/^Data:\s*/i, '').replace(/^Inviato:\s*/i, '').trim();
                    if (date) break;
                }
            }

            console.log('[Zimbra-Elabora] ✅ Contenuto estratto:', {
                from: from.substring(0, 50),
                to: to.substring(0, 50),
                subject: subject.substring(0, 50),
                bodyLength: bodyText.length
            });

            return {
                from,
                to,
                subject,
                date,
                body: bodyText.trim()
            };
        } catch (error) {
            console.error('[Zimbra-Elabora] ❌ Errore estrazione contenuto:', error);
            return null;
        }
    }

    // Estrai informazioni sugli allegati
    async function extractAttachments() {
        try {
            console.log('[Zimbra-Elabora] 🔍 Inizio estrazione allegati...');

            const attachments = [];

            // Trova il contenitore del messaggio correntemente visualizzato
            const messageContainers = Array.from(document.querySelectorAll('[id*="zv__TV"][id*="__MSG"]'))
                .filter(el => {
                    const rect = el.getBoundingClientRect();
                    return rect.top > 0 && rect.top < 1000 && rect.height > 100;
                });

            // Usa il primo container trovato (quello visibile)
            const messageContainer = messageContainers.length > 0 ? messageContainers[0] : document;
            console.log('[Zimbra-Elabora] Container messaggio:', messageContainer.id || 'documento intero');

            // METODO 1: Cerca link con classe "AttLink" SOLO nel container del messaggio corrente
            const attLinks = messageContainer.querySelectorAll('a.AttLink');
            console.log(`[Zimbra-Elabora] Trovati ${attLinks.length} link AttLink nel messaggio corrente`);

            // Raggruppa per container padre (ogni TD contiene un allegato completo)
            const processedContainers = new Set();

            for (const link of attLinks) {
                try {
                    // Trova il container padre (di solito un TD)
                    const container = link.closest('td, div, span');
                    if (!container || processedContainers.has(container)) {
                        continue;
                    }

                    const containerText = container.textContent;

                    // Verifica che contenga un'estensione file (qualsiasi estensione)
                    if (!/\.[a-z0-9]{2,5}\b/i.test(containerText)) {
                        continue;
                    }

                    processedContainers.add(container);

                    // Trova il link col nome file (primo AttLink nel container)
                    const fileNameLink = container.querySelector('a.AttLink');
                    let fileName = fileNameLink ? fileNameLink.textContent.trim() : '';

                    // Trova il link "Scarica"
                    const downloadLink = Array.from(container.querySelectorAll('a.AttLink'))
                        .find(a => a.textContent.trim() === 'Scarica' || a.id.includes('download'));

                    if (!downloadLink || !downloadLink.href) {
                        console.log('[Zimbra-Elabora] Container saltato (no link download)');
                        continue;
                    }

                    const downloadUrl = downloadLink.href;

                    // Estrai dimensione cercando nel text node dopo il link del nome file
                    let size = '';
                    if (fileNameLink && fileNameLink.nextSibling) {
                        const nextText = fileNameLink.nextSibling.textContent || '';
                        const sizeMatch = nextText.match(/\(([0-9.,]+\s*[KMG]B)\)/i);
                        if (sizeMatch) {
                            size = sizeMatch[1];
                        }
                    }

                    // Fallback: cerca nel containerText
                    if (!size) {
                        const sizeMatch = containerText.match(/\(([0-9.,]+\s*[KMG]B)\)/i);
                        if (sizeMatch) {
                            size = sizeMatch[1];
                        }
                    }

                    // Determina tipo MIME dall'estensione
                    let mimeType = '';
                    const ext = fileName.match(/\.([a-z0-9]+)$/i);
                    if (ext) {
                        const extMap = {
                            'pdf': 'application/pdf',
                            'doc': 'application/msword',
                            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            'xls': 'application/vnd.ms-excel',
                            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            'zip': 'application/zip',
                            'jpg': 'image/jpeg',
                            'jpeg': 'image/jpeg',
                            'png': 'image/png',
                            'txt': 'text/plain',
                            'xml': 'application/xml',
                            'eml': 'message/rfc822',
                            'msg': 'application/vnd.ms-outlook'
                        };
                        mimeType = extMap[ext[1].toLowerCase()] || 'application/octet-stream';
                    }

                    console.log('[Zimbra-Elabora] ✅ Allegato trovato:', {
                        fileName,
                        size,
                        mimeType,
                        url: downloadUrl.substring(0, 80) + '...'
                    });

                    attachments.push({
                        fileName,
                        size,
                        mimeType,
                        downloadUrl
                    });
                } catch (err) {
                    console.warn('[Zimbra-Elabora] ⚠️ Errore parsing allegato:', err);
                }
            }

            // METODO 2 (fallback): Cerca link con "part=" nell'URL SOLO nel container corrente
            if (attachments.length === 0) {
                console.log('[Zimbra-Elabora] Metodo 1 fallito, provo fallback...');
                if (messageContainer) {
                    const partLinks = messageContainer.querySelectorAll('a[href*="part="]');
                    console.log(`[Zimbra-Elabora] Fallback: trovati ${partLinks.length} link con part= nel messaggio corrente`);

                    for (const link of partLinks) {
                        try {
                            const fileName = link.textContent.trim() || 'allegato';
                            const downloadUrl = link.href;

                            // Cerca dimensione nel parent
                            const parent = link.parentElement;
                            const sizeMatch = parent ? parent.textContent.match(/\(([0-9.,]+\s*[KMG]B)\)/i) : null;
                            const size = sizeMatch ? sizeMatch[1] : '';

                            attachments.push({
                                fileName,
                                size,
                                mimeType: '',
                                downloadUrl
                            });
                        } catch (err) {
                            console.warn('[Zimbra-Elabora] Errore fallback:', err);
                        }
                    }
                }
            }

            // METODO 3: Cerca immagini inline nel corpo dell'email corrente
            try {
                const inlineImages = [];

                // Cerca nel body del messaggio corrente
                const messageBody = messageContainer.querySelector('[id*="MSG__body"], .MsgBody');
                if (messageBody) {
                    const imgs = messageBody.querySelectorAll('img');
                    inlineImages.push(...Array.from(imgs));
                }

                // Cerca nell'iframe del messaggio corrente
                const iframe = messageContainer.querySelector('iframe');
                if (iframe) {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        if (iframeDoc) {
                            const iframeImgs = iframeDoc.querySelectorAll('img');
                            inlineImages.push(...Array.from(iframeImgs));
                        }
                    } catch (e) {
                        console.warn('[Zimbra-Elabora] Impossibile leggere iframe (CORS)');
                    }
                }

                if (inlineImages.length > 0) {
                    console.log(`[Zimbra-Elabora] 🖼️ Trovate ${inlineImages.length} immagini inline`);

                    for (const img of inlineImages) {
                        try {
                            const src = img.src || '';
                            const alt = img.alt || '';

                            // Salta immagini molto piccole (icone, tracker, etc.)
                            if (img.width < 50 || img.height < 50) continue;

                            // Salta immagini esterne di tracciamento
                            if (src.includes('tracking') || src.includes('pixel')) continue;

                            let fileName = alt || `immagine-inline-${img.width}x${img.height}`;
                            if (!fileName.match(/\.(jpg|jpeg|png|gif)$/i)) {
                                // Determina estensione dal src o default a jpg
                                if (src.includes('png')) fileName += '.png';
                                else if (src.includes('gif')) fileName += '.gif';
                                else fileName += '.jpg';
                            }

                            attachments.push({
                                fileName,
                                size: `${img.width}x${img.height}`,
                                mimeType: src.includes('png') ? 'image/png' : 'image/jpeg',
                                downloadUrl: src,
                                isInline: true  // Flag per distinguere da allegati standard
                            });

                            console.log('[Zimbra-Elabora] 🖼️ Immagine inline trovata:', {
                                fileName,
                                size: `${img.width}x${img.height}`,
                                srcPreview: src.substring(0, 50) + '...'
                            });
                        } catch (err) {
                            console.warn('[Zimbra-Elabora] Errore parsing immagine inline:', err);
                        }
                    }
                }
            } catch (error) {
                console.warn('[Zimbra-Elabora] Errore ricerca immagini inline:', error);
            }

            console.log(`[Zimbra-Elabora] ✅ Totale allegati estratti: ${attachments.length}`);
            return attachments;
        } catch (error) {
            console.error('[Zimbra-Elabora] ❌ Errore estrazione allegati:', error);
            return [];
        }
    }

    // Invia i dati al server MCP
    async function sendToMCP(emailData) {
        try {
            const response = await fetch(`${CONFIG.mcpServerUrl}/process-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(emailData)
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('[Zimbra-Elabora] Errore invio a MCP:', error);

            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                throw new Error('Server MCP non disponibile. Assicurati che Claude Desktop sia avviato.');
            }

            throw error;
        }
    }

    // Scarica un allegato e convertilo in Base64
    async function downloadAttachment(url, fileName) {
        try {
            console.log(`[Zimbra-Elabora] 📥 Download ${fileName}...`);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const blob = await response.blob();
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64data = reader.result.split(',')[1];
                    resolve(base64data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            console.log(`[Zimbra-Elabora] ✅ ${fileName} scaricato (${(blob.size / 1024).toFixed(1)} KB)`);
            return {
                success: true,
                base64Data: base64,
                size: blob.size,
                mimeType: blob.type
            };
        } catch (error) {
            console.error(`[Zimbra-Elabora] ❌ Errore download ${fileName}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Handler click pulsante Elabora
    async function handleElaboraClick(event) {
        event.preventDefault();
        event.stopPropagation();

        // Verifica che il pulsante non sia disabilitato
        const btn = event.currentTarget;
        if (btn.classList.contains('ZDisabled') || btn.getAttribute('aria-disabled') === 'true') {
            console.log('[Zimbra-Elabora] Pulsante disabilitato, click ignorato');
            return;
        }

        console.log('[Zimbra-Elabora] Click su Elabora');
        showToast('Estrazione email in corso...', 'info');

        try {
            const emailContent = extractEmailContent();
            if (!emailContent) {
                throw new Error('Impossibile estrarre il contenuto dell\'email');
            }

            const attachments = await extractAttachments();

            // Scarica gli allegati in Base64
            if (attachments.length > 0) {
                showToast(`Download ${attachments.length} allegati...`, 'info');
                console.log(`[Zimbra-Elabora] 📦 Download di ${attachments.length} allegati...`);

                for (const attachment of attachments) {
                    // Salta immagini inline (sono già nel corpo)
                    if (attachment.isInline) {
                        console.log(`[Zimbra-Elabora] ⏭️ Salto immagine inline: ${attachment.fileName}`);
                        continue;
                    }

                    // Scarica l'allegato
                    const downloaded = await downloadAttachment(attachment.downloadUrl, attachment.fileName);

                    if (downloaded.success) {
                        attachment.base64Data = downloaded.base64Data;
                        attachment.actualSize = downloaded.size;
                        attachment.actualMimeType = downloaded.mimeType;
                        // Rimuovi l'URL (non più necessario)
                        delete attachment.downloadUrl;
                    } else {
                        attachment.downloadError = downloaded.error;
                    }
                }
            }

            const emailData = {
                ...emailContent,
                attachments,
                timestamp: new Date().toISOString()
            };

            console.log('[Zimbra-Elabora] Dati estratti:', {
                ...emailData,
                attachments: emailData.attachments.map(a => ({
                    fileName: a.fileName,
                    size: a.size,
                    hasBase64: !!a.base64Data,
                    base64Length: a.base64Data ? a.base64Data.length : 0
                }))
            });

            showToast('Invio a Claude...', 'info');
            const result = await sendToMCP(emailData);

            console.log('[Zimbra-Elabora] Risposta MCP:', result);
            showToast('✅ Email inviata a Claude!', 'success');

        } catch (error) {
            console.error('[Zimbra-Elabora] Errore:', error);
            showToast(`Errore: ${error.message}`, 'error');
        }
    }

    // Crea il pulsante Elabora
    function createElaboraButton() {
        const replyButton = findReplyButton();
        if (!replyButton) {
            console.error('[Zimbra-Elabora] Pulsante Rispondi non trovato');
            return null;
        }

        const viewBaseId = getViewBaseId();
        if (!viewBaseId) {
            console.error('[Zimbra-Elabora] Impossibile determinare vista corrente');
            return null;
        }

        console.log('[Zimbra-Elabora] Creazione pulsante AI arancione per vista:', viewBaseId, {
            replyId: replyButton.id,
            classes: replyButton.className,
            ariaDisabled: replyButton.getAttribute('aria-disabled')
        });

        // Clona il pulsante Rispondi
        const elaboraButton = replyButton.cloneNode(true);
        elaboraButton.id = `${viewBaseId}__ELABORA`;
        elaboraButton.setAttribute('aria-label', 'Invia via MCP per analisi IA');
        elaboraButton.title = 'Invia via MCP per analisi IA';
        elaboraButton.setAttribute('data-elabora-button', 'true'); // Marker per identificarlo facilmente

        // Cambia il testo con l'icona
        const textElement = elaboraButton.querySelector('.ZWidgetTitle');
        if (textElement) {
            textElement.textContent = CONFIG.buttonIcon;
            textElement.style.fontSize = '16px';
            textElement.style.fontWeight = 'bold';
        }

        // Cambia l'icona - usa l'icona AI invece di quella di default
        const iconElement = elaboraButton.querySelector('.ImgReply, [class*="Img"]');
        if (iconElement) {
            // Sostituisci con un'icona personalizzata
            iconElement.style.background = 'none';
            iconElement.style.width = '16px';
            iconElement.style.height = '16px';
            iconElement.textContent = '⚡';
            iconElement.style.fontSize = '14px';
            iconElement.style.display = 'flex';
            iconElement.style.alignItems = 'center';
            iconElement.style.justifyContent = 'center';
        }

        // Stile arancione per il pulsante (sfondo solido)
        elaboraButton.style.cssText += `
            background: #ff8c00 !important;
            border-color: #ff7700 !important;
            color: white !important;
        `;

        // Stile hover
        elaboraButton.addEventListener('mouseenter', function() {
            if (!this.classList.contains('ZDisabled')) {
                this.style.background = '#ffa500 !important';
                this.style.borderColor = '#ff8811';
            }
        });

        elaboraButton.addEventListener('mouseleave', function() {
            if (!this.classList.contains('ZDisabled')) {
                this.style.background = '#ff8c00 !important';
                this.style.borderColor = '#ff7700';
            }
        });

        // Rimuovi event listener clonati
        const cleanButton = elaboraButton.cloneNode(true);

        // Riapplica gli stili (perché cloneNode non clona gli event listener ma nemmeno gli stili inline)
        cleanButton.style.cssText = elaboraButton.style.cssText;

        // Riapplica event listeners per hover
        cleanButton.addEventListener('mouseenter', function() {
            if (!this.classList.contains('ZDisabled')) {
                this.style.background = '#ffa500 !important';
                this.style.borderColor = '#ff8811';
            }
        });

        cleanButton.addEventListener('mouseleave', function() {
            if (!this.classList.contains('ZDisabled')) {
                this.style.background = '#ff8c00 !important';
                this.style.borderColor = '#ff7700';
            }
        });

        // Aggiungi il nostro event listener
        cleanButton.addEventListener('click', handleElaboraClick);

        console.log('[Zimbra-Elabora] Pulsante AI arancione creato');
        return cleanButton;
    }

    // Inserisci il pulsante nella toolbar
    function insertElaboraButton() {
        // Controlla se il pulsante esiste già usando il marker
        const existingButton = document.querySelector('[data-elabora-button="true"]');
        if (existingButton) {
            const rect = existingButton.getBoundingClientRect();
            if (rect.top > 0 && rect.top < 1000) {
                console.log('[Zimbra-Elabora] Pulsante già presente e visibile in questa vista');
                return;
            } else {
                console.log('[Zimbra-Elabora] Pulsante esistente ma nascosto, lo rimuovo');
                existingButton.remove();
            }
        }

        const replyButton = findReplyButton();
        if (!replyButton) {
            console.error('[Zimbra-Elabora] Pulsante Rispondi non trovato');
            return;
        }

        // Trova la toolbar row che contiene tutti i pulsanti
        const toolbarRow = replyButton.closest('tr[id*="_items"]');
        if (!toolbarRow) {
            console.error('[Zimbra-Elabora] Toolbar row non trovata');
            return;
        }

        const elaboraButton = createElaboraButton();
        if (!elaboraButton) {
            return;
        }

        // Crea un TD wrapper per il pulsante (come gli altri pulsanti)
        const tdWrapper = document.createElement('td');
        tdWrapper.id = `${elaboraButton.id}_wrapper`;
        tdWrapper.className = '';
        tdWrapper.appendChild(elaboraButton);

        // Inserisci come PRIMO elemento nella toolbar
        toolbarRow.insertBefore(tdWrapper, toolbarRow.firstElementChild);
        console.log('[Zimbra-Elabora] Pulsante AI arancione inserito come primo nella toolbar');

        // Sincronizza lo stato iniziale
        setTimeout(() => syncButtonState(), 100);
    }

    // Sincronizza lo stato del pulsante con throttling
    let syncTimeout = null;
    function syncButtonState() {
        if (syncTimeout) return;

        syncTimeout = setTimeout(() => {
            const replyButton = findReplyButton();
            const elaboraButton = document.querySelector('[data-elabora-button="true"]');

            if (replyButton && elaboraButton) {
                const isDisabled = replyButton.classList.contains('ZDisabled') ||
                                  replyButton.getAttribute('aria-disabled') === 'true';

                console.log('[Zimbra-Elabora] Sync stato:', {
                    replyDisabled: isDisabled,
                    replyClasses: replyButton.className,
                    elaboraClasses: elaboraButton.className
                });

                if (isDisabled) {
                    elaboraButton.classList.add('ZDisabled');
                    elaboraButton.setAttribute('aria-disabled', 'true');
                    console.log('[Zimbra-Elabora] Pulsante Elabora -> DISABILITATO');
                } else {
                    elaboraButton.classList.remove('ZDisabled');
                    elaboraButton.setAttribute('aria-disabled', 'false');
                    console.log('[Zimbra-Elabora] Pulsante Elabora -> ABILITATO');
                }
            } else {
                console.log('[Zimbra-Elabora] Sync saltato:', {
                    replyExists: !!replyButton,
                    elaboraExists: !!elaboraButton
                });
            }

            syncTimeout = null;
        }, 200);
    }

    // Observer semplificato
    function observeToolbar() {
        if (observerActive) return;

        // Observer globale per cambiamenti nella pagina
        const globalObserver = new MutationObserver((mutations) => {
            const elaboraExists = document.querySelector('[data-elabora-button="true"]');
            const replyExists = findReplyButton();

            // Se esiste Reply ma non esiste Elabora (o è nascosto), reinserisci
            if (replyExists && !elaboraExists) {
                console.log('[Zimbra-Elabora] Pulsante AI scomparso, reinserisco');
                insertElaboraButton();
            } else if (elaboraExists && replyExists) {
                // Verifica che il pulsante sia visibile
                const rect = elaboraExists.getBoundingClientRect();
                if (rect.top < 0 || rect.top > 1000) {
                    console.log('[Zimbra-Elabora] Pulsante AI nascosto, reinserisco');
                    elaboraExists.remove();
                    insertElaboraButton();
                }
            }
        });

        // Osserva il body per cambiamenti globali
        globalObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        console.log('[Zimbra-Elabora] Observer globale attivato');

        // Sincronizzazione periodica come fallback
        setInterval(() => {
            syncButtonState();
        }, 2000);
        console.log('[Zimbra-Elabora] Sincronizzazione periodica attivata (ogni 2s)');

        observerActive = true;
    }

    // Monitora selezione email
    function monitorEmailSelection() {
        document.addEventListener('click', (e) => {
            // Trova se è stato cliccato su una riga email
            const row = e.target.closest('[id*="zlif__TV"], [class*="Row"]');
            if (row) {
                console.log('[Zimbra-Elabora] 📧 Email selezionata:', {
                    rowId: row.id,
                    rowClasses: row.className
                });

                // Dopo un piccolo delay, controlla lo stato del pulsante
                setTimeout(() => {
                    const replyBtn = findReplyButton();
                    const elaboraBtn = document.querySelector('[data-elabora-button="true"]');
                    console.log('[Zimbra-Elabora] Stato pulsanti dopo selezione:', {
                        rispondiDisabled: replyBtn?.classList.contains('ZDisabled'),
                        elaboraDisabled: elaboraBtn?.classList.contains('ZDisabled')
                    });
                }, 100);
            }
        }, true);
        console.log('[Zimbra-Elabora] Monitor selezione email attivo');
    }

    // Monitora cambio URL/vista (inbox -> ricerca, ecc.)
    function monitorViewChange() {
        let lastHash = window.location.hash;

        setInterval(() => {
            const currentHash = window.location.hash;
            if (currentHash !== lastHash) {
                console.log('[Zimbra-Elabora] Cambio vista rilevato:', lastHash, '->', currentHash);
                lastHash = currentHash;

                // Aspetta che la nuova vista si carichi
                setTimeout(() => {
                    const replyExists = findReplyButton();
                    const elaboraExists = document.querySelector('[data-elabora-button="true"]');

                    if (replyExists && !elaboraExists) {
                        console.log('[Zimbra-Elabora] Inserisco pulsante nella nuova vista');
                        insertElaboraButton();
                    } else if (elaboraExists) {
                        // Verifica che sia visibile
                        const rect = elaboraExists.getBoundingClientRect();
                        if (rect.top < 0 || rect.top > 1000) {
                            console.log('[Zimbra-Elabora] Pulsante nascosto dopo cambio vista, reinserisco');
                            elaboraExists.remove();
                            insertElaboraButton();
                        }
                    }
                }, 500);
            }
        }, 1000);

        console.log('[Zimbra-Elabora] Monitor cambio vista attivo');
    }

    // Inizializzazione
    async function init() {
        try {
            console.log('[Zimbra-Elabora] Attesa toolbar...');

            // Aspetta che compaia un pulsante Reply (qualsiasi vista)
            await new Promise((resolve, reject) => {
                const checkInterval = setInterval(() => {
                    const replyBtn = findReplyButton();
                    if (replyBtn) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 500);

                setTimeout(() => {
                    clearInterval(checkInterval);
                    reject(new Error('Timeout: pulsante Rispondi non trovato'));
                }, 10000);
            });

            console.log('[Zimbra-Elabora] Toolbar trovata, inserisco pulsante AI arancione...');
            insertElaboraButton();

            // Attiva observer
            observeToolbar();

            // Monitora selezione email
            monitorEmailSelection();

            // Monitora cambio vista
            monitorViewChange();

            console.log('[Zimbra-Elabora] Inizializzazione completata');
        } catch (error) {
            console.error('[Zimbra-Elabora] Errore inizializzazione:', error);
        }
    }

    // Avvia quando il DOM è pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
