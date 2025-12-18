// ==UserScript==
// @name         NAR2 Admin Override
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Forza ruolo admin e mostra breadcrumb paths nascosti
// @match        *://nar2.regione.sicilia.it/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ============================================
    // PATCH BREADCRUMB: Forza visualizzazione route nascoste per admin
    // ============================================
    const routesToShow = [
        "/admin",
        "/admin/config",
        "/admin/config/accesso",
        "/admin/config/accesso/azienda",
        "/admin/config/accesso/uffici-ruoli",
        "/admin/config/accesso/utenti",
        "/admin/config/impostazioni",
        "/admin/config/impostazioni/sogei",
        "/admin/config/impostazioni/agent",
        "/admin/config/impostazioni/esecuzione",
        "/admin/config/tabelle",
        "/admin/config/tabelle/attach",
        "/admin/config/anagrafica",
        "/admin/config/anagrafica/asl-presidi",
        "/admin/config/anagrafica/cittadinanze",
        "/admin/config/anagrafica/comuni",
        "/admin/config/anagrafica/province",
        "/admin/config/anagrafica/regioni"
    ];

    // Intercetta webpackJsonp per patchare il BreadcrumbService
    const webpackJsonp = window.webpackJsonp = window.webpackJsonp || [];
    const originalPush = webpackJsonp.push.bind(webpackJsonp);

    webpackJsonp.push = function(chunk) {
        const modules = chunk[1];

        // Cerca il modulo yPgr che contiene BreadcrumbService
        if (modules && modules["yPgr"]) {
            const originalModule = modules["yPgr"];
            modules["yPgr"] = function(l, n, u) {
                originalModule.call(this, l, n, u);

                // Patcha hideRoute se presente nel prototipo
                if (n.b && n.b.prototype && typeof n.b.prototype.hideRoute === 'function') {
                    const originalHideRoute = n.b.prototype.hideRoute;
                    n.b.prototype.hideRoute = function(route) {
                        if (routesToShow.includes(route)) {
                            console.log('[TM] Route breadcrumb forzata visibile:', route);
                            return this;
                        }
                        return originalHideRoute.call(this, route);
                    };
                    console.log('[TM] Patch hideRoute applicata');
                }
            };
        }

        return originalPush(chunk);
    };

    console.log('[TM] Patch webpackJsonp per breadcrumb attiva');

    // ============================================
    // PATCH XHR: Override ruolo utente
    // ============================================
    const targetEndpoint = '/services/index.php/api/user';
    const permissionEndpoint = '/api/utenti/getPermission';

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        this._url = url;
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
        const xhr = this;

        const onReadyStateChange = function() {
            try {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    const contentType = xhr.getResponseHeader('Content-Type') || '';

                    // Intercetta endpoint utente
                    if (xhr._url.includes(targetEndpoint) && contentType.includes('application/json')) {
                        let data = JSON.parse(xhr.responseText);

                        // Forza il ruolo e i permessi admin
                        if (data) {
                            if (data.role) data.role = 'admin';
                            if (data.user && data.user.role) data.user.role = 'admin';
                            if (data.us_admin_role !== undefined) data.us_admin_role = "1";
                            console.log('[TM] Risposta XHR user modificata:', data);

                            Object.defineProperty(xhr, 'responseText', {value: JSON.stringify(data)});
                            Object.defineProperty(xhr, 'response', {value: JSON.stringify(data)});
                        }
                    }

                    // Intercetta endpoint permessi
                    if (xhr._url.includes(permissionEndpoint) && contentType.includes('application/json')) {
                        let data = JSON.parse(xhr.responseText);
                        console.log('[TM] Risposta XHR permessi originale:', data);

                        // Aggiungi permessi admin se non presenti
                        if (Array.isArray(data)) {
                            // Se è un array di permessi, aggiungi quelli admin
                            const adminPermissions = ['admin', 'config', 'accesso', 'impostazioni', 'sistema', 'tabelle', 'anagrafica'];
                            adminPermissions.forEach(p => {
                                if (!data.includes(p)) data.push(p);
                            });
                        } else if (data && typeof data === 'object') {
                            // Se è un oggetto, forza i permessi admin
                            data.isAdmin = true;
                            data.role = 'admin';
                            if (data.permissions && Array.isArray(data.permissions)) {
                                data.permissions.push('admin', 'config', 'accesso', 'impostazioni');
                            }
                        }

                        console.log('[TM] Risposta XHR permessi modificata:', data);
                        Object.defineProperty(xhr, 'responseText', {value: JSON.stringify(data)});
                        Object.defineProperty(xhr, 'response', {value: JSON.stringify(data)});
                    }
                }
            } catch (err) {
                console.warn('[TM] Errore durante la modifica della risposta:', err);
            }
        };

        this.addEventListener('readystatechange', onReadyStateChange);

        return originalSend.apply(this, arguments);
    };

    console.log('[TM] Patch su XMLHttpRequest attiva');

    // ============================================
    // PATCH FETCH: Override per fetch API (se usata)
    // ============================================
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        const url = args[0];

        if (typeof url === 'string' && url.includes('/api/user')) {
            try {
                const clone = response.clone();
                const data = await clone.json();

                if (data) {
                    if (data.role) data.role = 'admin';
                    if (data.user && data.user.role) data.user.role = 'admin';
                    if (data.us_admin_role !== undefined) data.us_admin_role = "1";
                    console.log('[TM] Risposta fetch modificata:', data);

                    return new Response(JSON.stringify(data), {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                }
            } catch (err) {
                console.warn('[TM] Errore durante la modifica fetch:', err);
            }
        }

        return response;
    };
    console.log('[TM] Patch su fetch attiva');

    // ============================================
    // PATCH: Forza ruolo admin in localStorage (set e get)
    // ============================================
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const originalGetItem = localStorage.getItem.bind(localStorage);

    localStorage.setItem = function(key, value) {
        // Intercetta salvataggio dati utente e forza admin
        if (key === 'role' || key === 'user_role') {
            console.log('[TM] Forzatura ruolo admin in localStorage.setItem');
            return originalSetItem(key, 'admin');
        }
        // Intercetta oggetto utente completo
        if (typeof value === 'string' && value.includes('"us_admin_role"')) {
            try {
                let data = JSON.parse(value);
                if (data.role) data.role = 'admin';
                if (data.us_admin_role !== undefined) data.us_admin_role = "1";
                console.log('[TM] Forzatura admin in oggetto utente localStorage');
                return originalSetItem(key, JSON.stringify(data));
            } catch (e) {}
        }
        return originalSetItem(key, value);
    };

    localStorage.getItem = function(key) {
        let value = originalGetItem(key);
        // Intercetta lettura dati utente e forza admin
        if (value && typeof value === 'string') {
            try {
                if (value.includes('"us_admin_role"') || value.includes('"role"')) {
                    let data = JSON.parse(value);
                    let modified = false;
                    if (data.role && data.role !== 'admin') {
                        data.role = 'admin';
                        modified = true;
                    }
                    if (data.us_admin_role !== undefined && data.us_admin_role !== "1") {
                        data.us_admin_role = "1";
                        modified = true;
                    }
                    if (modified) {
                        console.log('[TM] Forzatura admin in localStorage.getItem per:', key);
                        return JSON.stringify(data);
                    }
                }
                // Intercetta permessi e aggiungi quelli admin
                if (key === 'permessi') {
                    let data = JSON.parse(value);
                    const adminPermissions = ['admin', 'config', 'accesso', 'impostazioni', 'sistema', 'tabelle', 'anagrafica'];
                    if (Array.isArray(data)) {
                        let modified = false;
                        adminPermissions.forEach(p => {
                            if (!data.includes(p)) {
                                data.push(p);
                                modified = true;
                            }
                        });
                        if (modified) {
                            console.log('[TM] Forzatura permessi admin in localStorage.getItem');
                            return JSON.stringify(data);
                        }
                    }
                }
            } catch (e) {}
        }
        return value;
    };
    console.log('[TM] Patch su localStorage (get/set) attiva');

    // ============================================
    // PATCH: Forza ruolo admin nello store NgRx via Object.defineProperty
    // ============================================
    // Intercetta la creazione di oggetti con proprietà 'role' e forza admin
    const originalDefineProperty = Object.defineProperty;
    Object.defineProperty = function(obj, prop, descriptor) {
        if (prop === 'role' && descriptor && descriptor.value === 'user') {
            console.log('[TM] Intercettato Object.defineProperty role=user, forzato admin');
            descriptor.value = 'admin';
        }
        return originalDefineProperty.call(this, obj, prop, descriptor);
    };

    // Intercetta Object.assign per modificare oggetti con role
    const originalAssign = Object.assign;
    Object.assign = function(target, ...sources) {
        const result = originalAssign.call(this, target, ...sources);
        if (result && typeof result === 'object') {
            if (result.role === 'user') {
                result.role = 'admin';
                console.log('[TM] Intercettato Object.assign role=user, forzato admin');
            }
            if (result.us_admin_role === '0' || result.us_admin_role === 0) {
                result.us_admin_role = '1';
                console.log('[TM] Intercettato Object.assign us_admin_role=0, forzato 1');
            }
        }
        return result;
    };
    console.log('[TM] Patch su Object.defineProperty e Object.assign attiva');

    // ============================================
    // PATCH: Intercetta NgRx store selector per forzare ruolo admin
    // ============================================
    // Il guard canLoad usa: this.store.pipe(select(selector)).pipe(map(e => e.role === 'admin'))
    // Dobbiamo intercettare quando l'oggetto user passa attraverso RxJS e forzare role='admin'

    // Metodo 1: Patch su RxJS Observable.prototype.subscribe per intercettare valori con 'role'
    const patchRxJS = () => {
        // Cerca l'Observable globale di RxJS
        const checkAndPatch = () => {
            // Prova a trovare rxjs attraverso webpack
            if (window.rxjs && window.rxjs.Observable) {
                const OriginalSubscribe = window.rxjs.Observable.prototype.subscribe;
                window.rxjs.Observable.prototype.subscribe = function(observerOrNext, error, complete) {
                    // Wrap l'observer per intercettare i valori
                    let wrappedObserver = observerOrNext;
                    if (typeof observerOrNext === 'function') {
                        wrappedObserver = function(value) {
                            if (value && typeof value === 'object' && value.role === 'user') {
                                value.role = 'admin';
                                console.log('[TM] RxJS subscribe: forzato role=admin');
                            }
                            return observerOrNext(value);
                        };
                    } else if (observerOrNext && typeof observerOrNext.next === 'function') {
                        const originalNext = observerOrNext.next.bind(observerOrNext);
                        observerOrNext.next = function(value) {
                            if (value && typeof value === 'object' && value.role === 'user') {
                                value.role = 'admin';
                                console.log('[TM] RxJS observer.next: forzato role=admin');
                            }
                            return originalNext(value);
                        };
                    }
                    return OriginalSubscribe.call(this, wrappedObserver, error, complete);
                };
                console.log('[TM] Patch su RxJS Observable.subscribe attiva');
                return true;
            }
            return false;
        };

        if (!checkAndPatch()) {
            // Riprova dopo che Angular si è caricato
            setTimeout(checkAndPatch, 1000);
            setTimeout(checkAndPatch, 3000);
        }
    };
    patchRxJS();

    // Metodo 2: Patch globale su qualsiasi oggetto che viene creato con role='user'
    // Usa un Proxy sul costruttore Object (più aggressivo)
    const originalCreate = Object.create;
    Object.create = function(proto, propertiesObject) {
        const obj = originalCreate.call(this, proto, propertiesObject);
        if (obj && obj.role === 'user') {
            obj.role = 'admin';
            console.log('[TM] Object.create: forzato role=admin');
        }
        return obj;
    };

    // Metodo 3: Intercetta il getter di 'role' su tutti gli oggetti attraverso Proxy
    // Questo è il metodo più efficace per intercettare i check dei guard
    const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    const patchedObjects = new WeakSet();

    const forceAdminOnObject = (obj) => {
        if (!obj || typeof obj !== 'object' || patchedObjects.has(obj)) return obj;

        try {
            if ('role' in obj && obj.role === 'user') {
                obj.role = 'admin';
                console.log('[TM] Forzato role=admin su oggetto esistente');
            }
            patchedObjects.add(obj);
        } catch (e) {}
        return obj;
    };

    // Patcha JSON.parse per intercettare dati che arrivano dal server
    const originalJSONParse = JSON.parse;
    JSON.parse = function(text, reviver) {
        let result = originalJSONParse.call(this, text, reviver);
        if (result && typeof result === 'object') {
            // Ricorsivamente forza admin
            const forceAdmin = (obj) => {
                if (!obj || typeof obj !== 'object') return;
                if (obj.role === 'user') {
                    obj.role = 'admin';
                    console.log('[TM] JSON.parse: forzato role=admin');
                }
                if (obj.us_admin_role === '0' || obj.us_admin_role === 0) {
                    obj.us_admin_role = '1';
                    console.log('[TM] JSON.parse: forzato us_admin_role=1');
                }
                // Controlla proprietà nested
                for (let key in obj) {
                    if (obj[key] && typeof obj[key] === 'object') {
                        forceAdmin(obj[key]);
                    }
                }
            };
            forceAdmin(result);
        }
        return result;
    };
    console.log('[TM] Patch su JSON.parse attiva');

    // ============================================
    // PATCH: Intercetta navigazione a /operatore/bacheca e reindirizza a /admin/config
    // ============================================

    // Flag per tracciare se dobbiamo redirigere
    let shouldRedirectToAdmin = false;

    const originalPushState = history.pushState.bind(history);
    history.pushState = function(state, title, url) {
        if (url && typeof url === 'string' && url.includes('/operatore/bacheca')) {
            console.log('[TM] Intercettata pushState a /operatore/bacheca, imposto flag redirect');
            shouldRedirectToAdmin = true;
            url = '/admin/config';
        }
        return originalPushState(state, title, url);
    };

    const originalReplaceState = history.replaceState.bind(history);
    history.replaceState = function(state, title, url) {
        if (url && typeof url === 'string' && url.includes('/operatore/bacheca')) {
            console.log('[TM] Intercettata replaceState a /operatore/bacheca, imposto flag redirect');
            shouldRedirectToAdmin = true;
            url = '/admin/config';
        }
        return originalReplaceState(state, title, url);
    };
    console.log('[TM] Patch su history.pushState/replaceState attiva');

    // Patch window.location.reload per verificare se siamo su bacheca e redirigere
    const originalReload = window.location.reload.bind(window.location);
    Object.defineProperty(window.location, 'reload', {
        value: function() {
            const currentPath = window.location.pathname;
            console.log('[TM] location.reload chiamato, path attuale:', currentPath, 'flag redirect:', shouldRedirectToAdmin);

            if (currentPath.includes('/operatore/bacheca') || shouldRedirectToAdmin) {
                console.log('[TM] Redirect a /admin/config prima del reload');
                shouldRedirectToAdmin = false;
                window.location.href = '/admin/config';
                return;
            }
            return originalReload();
        },
        configurable: true,
        writable: true
    });
    console.log('[TM] Patch su location.reload attiva');

    // Intercetta anche setter di location.href direttamente
    const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    // Non possiamo ridefinire window.location, ma possiamo intercettare l'uso di href assignment
    // tramite un proxy sul prototipo Location

    // Alternativa: intercetta la navigazione del router Angular via Zone.js
    // La funzione storePermissions usa router.navigateByUrl che passa per Zone.js
    if (window.Zone && window.Zone.current) {
        const originalZoneRun = window.Zone.prototype.run;
        window.Zone.prototype.run = function(callback, applyThis, applyArgs, source) {
            // Wrap la callback per intercettare navigazioni
            const wrappedCallback = function() {
                const result = callback.apply(applyThis, arguments);
                // Se il risultato è una Promise che naviga a bacheca, intercetta
                if (result && typeof result.then === 'function') {
                    return result.then(val => {
                        if (window.location.pathname.includes('/operatore/bacheca')) {
                            console.log('[TM] Zone.run ha navigato a bacheca, redirigendo...');
                            shouldRedirectToAdmin = true;
                        }
                        return val;
                    });
                }
                return result;
            };
            return originalZoneRun.call(this, wrappedCallback, applyThis, applyArgs, source);
        };
        console.log('[TM] Patch su Zone.prototype.run attiva');
    }

    // Monitora anche cambi di URL periodicamente durante navigazione
    let lastPath = window.location.pathname;
    const pathWatcher = setInterval(() => {
        const currentPath = window.location.pathname;
        if (currentPath !== lastPath) {
            console.log('[TM] Path cambiato da', lastPath, 'a', currentPath);
            if (currentPath.includes('/operatore/bacheca')) {
                console.log('[TM] Rilevato path bacheca, forzando redirect a /admin/config');
                clearInterval(pathWatcher);
                window.location.href = '/admin/config';
            }
            lastPath = currentPath;
        }
    }, 100);

    // Ferma il watcher dopo 30 secondi per non impattare le performance
    setTimeout(() => {
        clearInterval(pathWatcher);
        console.log('[TM] Path watcher disattivato dopo timeout');
    }, 30000);

    // ============================================
    // PATCH: Inietta voci menu admin mancanti
    // ============================================
    const adminMenuItems = [
        {
            section: 'Accesso',
            items: [
                { title: 'Utenti', page: '/admin/config/accesso/utenti', icon: 'flaticon-users' },
                { title: 'Aziende', page: '/admin/config/accesso/azienda', icon: 'flaticon-buildings' },
                { title: 'Uffici e Ruoli', page: '/admin/config/accesso/uffici-ruoli', icon: 'flaticon-interface-7' }
            ]
        },
        {
            section: 'Impostazioni',
            items: [
                { title: 'Sogei', page: '/admin/config/impostazioni/sogei', icon: 'flaticon-settings' },
                { title: 'Agent', page: '/admin/config/impostazioni/agent', icon: 'flaticon-cogwheel-2' },
                { title: 'Esecuzioni', page: '/admin/config/impostazioni/esecuzione', icon: 'flaticon-time' }
            ]
        },
        {
            section: 'Tabelle',
            items: [
                { title: 'Allegati', page: '/admin/config/tabelle/attach', icon: 'flaticon-attachment' }
            ]
        }
    ];

    const createMenuItem = (item) => {
        return `
            <li class="kt-menu__item" aria-haspopup="true">
                <a class="kt-menu__link" href="${item.page}">
                    <i class="kt-menu__link-icon ${item.icon}"></i>
                    <span class="kt-menu__link-text">${item.title}</span>
                </a>
            </li>
        `;
    };

    const createMenuSection = (section) => {
        let html = `
            <li class="kt-menu__section">
                <h4 class="kt-menu__section-text">${section.section}</h4>
                <i class="kt-menu__section-icon flaticon-more-v2"></i>
            </li>
        `;
        section.items.forEach(item => {
            html += createMenuItem(item);
        });
        return html;
    };

    // Funzione per navigare via Angular router
    const navigateAngular = (path) => {
        // Usa history API + popstate per triggare il router Angular
        history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    };

    const injectMenuItems = () => {
        const menuNav = document.querySelector('.kt-menu__nav');
        if (!menuNav) {
            setTimeout(injectMenuItems, 500);
            return;
        }

        // Controlla se già iniettato
        if (document.querySelector('[data-tm-injected]')) {
            return;
        }

        // Crea marker per evitare doppia iniezione
        const marker = document.createElement('span');
        marker.setAttribute('data-tm-injected', 'true');
        marker.style.display = 'none';
        menuNav.appendChild(marker);

        // Crea e inserisci le voci
        adminMenuItems.forEach(section => {
            // Sezione header
            const sectionLi = document.createElement('li');
            sectionLi.className = 'kt-menu__section';
            sectionLi.innerHTML = `
                <h4 class="kt-menu__section-text">${section.section}</h4>
                <i class="kt-menu__section-icon flaticon-more-v2"></i>
            `;
            menuNav.appendChild(sectionLi);

            // Items della sezione
            section.items.forEach(item => {
                const itemLi = document.createElement('li');
                itemLi.className = 'kt-menu__item';
                itemLi.setAttribute('aria-haspopup', 'true');
                itemLi.setAttribute('data-ktmenu-submenu-toggle', 'hover');
                itemLi.setAttribute('data-placement', 'right');

                const link = document.createElement('a');
                link.className = 'kt-menu__link kt-menu__toggle';
                link.href = item.page;
                link.innerHTML = `
                    <i class="kt-menu__link-icon ${item.icon}"></i>
                    <span class="kt-menu__link-text">${item.title}</span>
                `;

                // Intercetta click per navigazione Angular
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigateAngular(item.page);
                    console.log('[TM] Navigazione Angular a:', item.page);
                });

                itemLi.appendChild(link);
                menuNav.appendChild(itemLi);
            });
        });

        console.log('[TM] Voci menu admin iniettate');
    };

    // Osserva il DOM per iniettare il menu quando disponibile
    const observer = new MutationObserver((mutations, obs) => {
        const menuNav = document.querySelector('.kt-menu__nav');
        if (menuNav && !menuNav.querySelector('[data-tm-injected]')) {
            injectMenuItems();
        }
    });

    // Inizia osservazione quando il body è disponibile
    const startObserver = () => {
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
            injectMenuItems(); // Prova subito
        } else {
            setTimeout(startObserver, 100);
        }
    };
    startObserver();

    // ============================================
    // PATCH: Inietta stili CSS
    // ============================================
    const injectStyles = function() {
        if (!document.head) {
            setTimeout(injectStyles, 100);
            return;
        }
        const style = document.createElement('style');
        style.textContent = `
            /* Forza visibilità menu admin */
            [data-tm-injected] .kt-menu__item {
                display: list-item !important;
            }
            [data-tm-injected] .kt-menu__section {
                display: list-item !important;
            }
        `;
        document.head.appendChild(style);
        console.log('[TM] Stili CSS iniettati');
    };
    injectStyles();
})();
