import puppeteer from "puppeteer";
import fs from "fs";
import axios from "axios";
import * as cheerio from "cheerio";

export class Ts {
    /**
     *
     * @param {ImpostazioniServiziTerzi} impostazioni
     */
    constructor(impostazioni) {
        this._impostazioni = impostazioni;
        this._browser = null;
        this._logged = false;
        this._workingPage = null;
        this._retry = 5;
    }

    /**
     * Parse file TXT Forniture Assistiti (record length 381) and return { data, stats }.
     * stats contains parsed header and trailer and raw first/last lines.
     * @param {string} filePath
     * @returns {{data: Array, stats: object}}
     */
    static getDataFromTSFile(filePath){
        // Parse fixed-width TS text file (381 chars per record)
        // Returns { data: [...detail records...], stats: { header, trailer, firstLineRaw, lastLineRaw, warnings } }
        const out = { data: [], stats: {} };
        try {
            if (!filePath) return out;
            const content = fs.readFileSync(filePath, 'utf8');
            if (!content) return out;
            const lines = content.split(/\r?\n/).filter(l => l !== "");
            if (lines.length === 0) return out;

            const padRight = (s, len) => (s || '').padEnd(len, ' ');
            const slice = (s, start1, len) => padRight(s, 381).substring(start1 - 1, start1 - 1 + len);
            const trimRight = (s) => s.replace(/[\s\u00A0]+$/g, '');

            // Header (first line)
            const headerLine = lines[0];
            const header = {
                tipo_record: slice(headerLine, 1, 1).trim(),
                sigla_fornitura: slice(headerLine, 2, 3).trim(),
                sottotipo: slice(headerLine, 5, 1).trim(),
                descrizione_data_elaborazione: slice(headerLine, 6, 23).trim(),
                data_elaborazione: slice(headerLine, 29, 8).trim(),
                decodifica_sottotipo: trimRight(slice(headerLine, 37, 345 - 1)) // 37-381 inclusive -> 345 chars
            };

            // Trailer (last line)
            const trailerLine = lines[lines.length - 1];
            const trailer = {
                tipo_record: slice(trailerLine, 1, 1).trim(),
                sigla_fornitura: slice(trailerLine, 2, 3).trim(),
                sottotipo: slice(trailerLine, 5, 3).trim(),
                descrizione_data_elaborazione: slice(trailerLine, 6, 23).trim(),
                data_elaborazione: slice(trailerLine, 29, 8).trim(),
                descrizione_numero_record: slice(trailerLine, 37, 19).trim(),
                numero_record_scritti: slice(trailerLine, 56, 8).trim(),
                decodifica_sottotipo: trimRight(slice(trailerLine, 64, 318)) // 64-381 inclusive
            };

            // Detail lines 2..n-1
            const details = [];
            for (let i = 1; i < lines.length - 1; i++) {
                const line = padRight(lines[i], 381);
                const tipo = slice(line, 1, 1);
                if (tipo !== '1') continue; // skip unexpected
                const rec = {
                    tipo_record: tipo,
                    codice_fiscale: slice(line, 2, 16).trim(),
                    codice_regione: slice(line, 18, 3).trim(),
                    codice_asl: slice(line, 21, 3).trim(),
                    codice_assistito: slice(line, 24, 10).trim(),
                    codice_tipo_assistito: slice(line, 34, 1).trim(),
                    cf_medico: slice(line, 35, 16).trim(),
                    data_inizio_assistenza_medica: slice(line, 51, 8).trim(),
                    codice_comune_residenza: slice(line, 59, 4).trim(),
                    codice_municipio: slice(line, 63, 2).trim(),
                    codice_regione_residenza_at: slice(line, 65, 3).trim(),
                    codice_asl_residenza_at: slice(line, 68, 3).trim(),
                    codice_regione_residenza_asl: slice(line, 71, 3).trim(),
                    codice_asl_residenza_asl: slice(line, 74, 3).trim(),
                    data_fine_validita_ssn: slice(line, 77, 8).trim(),
                    codice_fine_validita: slice(line, 85, 3).trim(),
                    data_dismissione_medico: slice(line, 88, 8).trim(),
                    data_inizio_assistenza_asl: slice(line, 96, 8).trim(),
                    data_fine_assistenza_asl: slice(line, 104, 8).trim(),
                    identificativo_tessera: slice(line, 112, 20).trim(),
                    codice_regione_tessera: slice(line, 132, 3).trim(),
                    codice_regione_residenza_tessera: slice(line, 135, 3).trim(),
                    codice_asl_tessera: slice(line, 138, 3).trim(),
                    cognome: trimRight(slice(line, 141, 40)).trim(),
                    nome: trimRight(slice(line, 181, 35)).trim(),
                    sesso: slice(line, 216, 1).trim(),
                    data_nascita: slice(line, 217, 8).trim(),
                    comune_nascita: trimRight(slice(line, 225, 45)).trim(),
                    provincia_nascita: slice(line, 270, 2).trim(),
                    indirizzo_residenza: trimRight(slice(line, 272, 50)).trim(),
                    cap_residenza: slice(line, 322, 5).trim(),
                    comune_residenza: trimRight(slice(line, 327, 45)).trim(),
                    provincia_residenza: slice(line, 372, 2).trim(),
                    data_scadenza_tessera: slice(line, 374, 8).trim(),
                };
                details.push(rec);
            }

            out.data = details;
            const expectedCount = parseInt(trailer.numero_record_scritti?.trim() || '0', 10);
            const warnings = [];
            if (!Number.isNaN(expectedCount) && expectedCount !== details.length) {
                warnings.push(`Numero record scritti nel trailer (${expectedCount}) diverso dai dettagli letti (${details.length}).`);
            }
            out.stats = {
                header,
                trailer,
                firstLineRaw: headerLine,
                lastLineRaw: trailerLine,
                warnings
            };
            return out;
        } catch (e) {
            return { data: [], stats: { error: e.message } };
        }
    }


    /**
     * Crea una sessione HTTP autenticata su SistemaTS (senza browser).
     * Restituisce un'istanza axios con i cookie di sessione.
     * @returns {Promise<import('axios').AxiosInstance|null>}
     */
    /**
     * Crea un'istanza axios con gestione manuale dei cookie per SistemaTS.
     * @returns {import('axios').AxiosInstance}
     */
    static #createSessionWithCookies() {
        const session = axios.create({
            baseURL: 'https://sistemats4.sanita.finanze.it',
            maxRedirects: 0,
            validateStatus: () => true,
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
        });
        // Decodifica le risposte da ISO-8859-1 (encoding usato da SistemaTS)
        session.interceptors.response.use((response) => {
            if (response.data instanceof ArrayBuffer || Buffer.isBuffer(response.data)) {
                response.data = new TextDecoder('iso-8859-1').decode(response.data);
            }
            return response;
        });
        const cookies = {};
        session._cookies = cookies;
        const cookieInterceptor = (response) => {
            const setCookies = response.headers['set-cookie'];
            if (setCookies) {
                for (const raw of setCookies) {
                    const [pair] = raw.split(';');
                    const [name, ...rest] = pair.split('=');
                    cookies[name.trim()] = rest.join('=').trim();
                }
            }
            return response;
        };
        session.interceptors.response.use(cookieInterceptor, (err) => {
            if (err.response) cookieInterceptor(err.response);
            return Promise.reject(err);
        });
        session.interceptors.request.use((config) => {
            const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
            if (cookieStr) config.headers['Cookie'] = cookieStr;
            return config;
        });
        return session;
    }

    /**
     * Segue i redirect HTTP manualmente (necessario con maxRedirects: 0).
     */
    static async #followRedirects(session, resp, maxHops = 10) {
        let r = resp;
        let i = 0;
        while (r.status >= 300 && r.status < 400 && r.headers.location && i < maxHops) {
            const loc = r.headers.location;
            r = await session.get(loc);
            i++;
        }
        return r;
    }

    async #getHttpSession() {
        if (this._httpSession) return this._httpSession;

        for (let attempt = 0; attempt < this._retry; attempt++) {
            try {
                const session = Ts.#createSessionWithCookies();

                // 1. GET login page per ottenere JSESSIONID
                await session.get('/simossHome/login.jsp');

                // 2. POST login (j_security_check)
                const params = new URLSearchParams();
                params.append('j_username', this._impostazioni.ts_username);
                params.append('j_password', this._impostazioni.ts_password);
                let resp = await session.post('/simossHome/j_security_check', params.toString(), {
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                });
                resp = await Ts.#followRedirects(session, resp);

                const html = typeof resp.data === 'string' ? resp.data : '';
                if (!html.includes('dettaglio_utente')) continue;

                // 3. Inizializza la sezione STP tramite traceAuditing
                resp = await session.get('/simossHome/traceAuditing.do?p=U59');
                resp = await Ts.#followRedirects(session, resp);

                // 4. Accedi alla pagina di ricerca STP per completare l'init
                resp = await session.get('/simossStp/ricercaStp.do?resetLink=');
                resp = await Ts.#followRedirects(session, resp);

                const stpHtml = typeof resp.data === 'string' ? resp.data : '';
                if (stpHtml.includes('ricercaStpActionForm')) {
                    this._httpSession = session;
                    return session;
                }
            } catch (e) {
                console.log(`Tentativo login HTTP ${attempt + 1}/${this._retry} fallito:`, e.message);
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        return null;
    }

    /**
     * Ricerca un assistito STP/ENI per codice sul portale SistemaTS (senza browser/Puppeteer).
     * @param {object} params
     * @param {string} params.prefisso - 'STP' o 'ENI' (default: 'STP')
     * @param {string} params.codiceAsl - codice ASL (es. '205')
     * @param {string} params.suffissoCodiceStp - suffisso numerico del codice STP (es. '0000001')
     * @returns {Promise<{error: boolean, data: object|null, message?: string}>}
     */
    async ricercaStpPerCodice({prefisso = 'STP', codiceAsl = '205', suffissoCodiceStp = ''} = {}) {
        const out = {error: false, data: null};
        try {
            const session = await this.#getHttpSession();
            if (!session) {
                out.error = true;
                out.message = 'Login HTTP su SistemaTS fallito';
                return out;
            }

            // POST ricerca per codice STP
            const params = new URLSearchParams();
            params.append('tipoRicerca', 'codiceStp');
            params.append('prefissoCodiceStpEni', prefisso);
            params.append('codiceAslAoScelto', codiceAsl);
            params.append('suffissoCodiceStp', suffissoCodiceStp);
            params.append('prefissoCodiceStpEniRange', prefisso);
            params.append('codiceAslAoSceltoRange', codiceAsl);
            params.append('dal', '0000000');
            params.append('al', '0000000');
            params.append('ricercaPerCodiceERange', 'Conferma');

            let resp = await session.post('/simossStp/ricercaPerCodiceERange.do', params.toString(), {
                headers: {'Content-Type': 'application/x-www-form-urlencoded'}
            });
            resp = await Ts.#followRedirects(session, resp);

            const $ = cheerio.load(resp.data || '');
            const dati = Ts.#parseStpPage($);
            if (dati) {
                out.data = dati;
            } else {
                out.error = true;
                out.message = 'Nessun dato trovato o pagina non riconosciuta';
            }
        } catch (e) {
            out.error = true;
            out.message = e.message;
        }
        return out;
    }

    /**
     * Ricerca assistiti STP/ENI per range di codici.
     * @param {object} params
     * @param {string} params.prefisso - 'STP' o 'ENI'
     * @param {string} params.codiceAsl - codice ASL
     * @param {string} params.dal - codice inizio range (es. '0000001')
     * @param {string} params.al - codice fine range (es. '0000010')
     * @returns {Promise<{error: boolean, data: Array, message?: string}>}
     */
    async ricercaStpPerRange({prefisso = 'STP', codiceAsl = '205', dal = '0000000', al = '0000000'} = {}) {
        const out = {error: false, data: []};
        try {
            const session = await this.#getHttpSession();
            if (!session) {
                out.error = true;
                out.message = 'Login HTTP su SistemaTS fallito';
                return out;
            }

            const params = new URLSearchParams();
            params.append('tipoRicerca', 'elencoStp');
            params.append('prefissoCodiceStpEni', prefisso);
            params.append('codiceAslAoScelto', codiceAsl);
            params.append('suffissoCodiceStp', '');
            params.append('prefissoCodiceStpEniRange', prefisso);
            params.append('codiceAslAoSceltoRange', codiceAsl);
            params.append('dal', dal);
            params.append('al', al);
            params.append('ricercaPerCodiceERange', 'Conferma');

            let resp = await session.post('/simossStp/ricercaPerCodiceERange.do', params.toString(), {
                headers: {'Content-Type': 'application/x-www-form-urlencoded'}
            });
            resp = await Ts.#followRedirects(session, resp);

            const $ = cheerio.load(resp.data || '');
            const datiSingolo = Ts.#parseStpPage($);
            if (datiSingolo) {
                out.data = [datiSingolo];
            } else {
                out.data = Ts.#parseStpList($);
            }
        } catch (e) {
            out.error = true;
            out.message = e.message;
        }
        return out;
    }

    /**
     * Ricerca assistiti STP/ENI per dati anagrafici (cognome, genere).
     * @param {object} params
     * @param {string} params.prefisso - 'STP' o 'ENI'
     * @param {string} params.codiceAsl - codice ASL
     * @param {string} params.cognome - cognome da cercare
     * @param {string} params.genere - 'M', 'F' o '' per tutti
     * @returns {Promise<{error: boolean, data: Array, message?: string}>}
     */
    async ricercaStpPerDati({prefisso = 'STP', codiceAsl = '205', cognome = '', genere = ''} = {}) {
        const out = {error: false, data: []};
        try {
            const session = await this.#getHttpSession();
            if (!session) {
                out.error = true;
                out.message = 'Login HTTP su SistemaTS fallito';
                return out;
            }

            const params = new URLSearchParams();
            params.append('prefissoCodiceStpEni', prefisso);
            params.append('codiceAslAoScelto', codiceAsl);
            params.append('cognome', cognome);
            params.append('genere', genere);
            params.append('ricercaPerDati', 'Conferma');

            let resp = await session.post('/simossStp/ricercaPerDatiStp.do', params.toString(), {
                headers: {'Content-Type': 'application/x-www-form-urlencoded'}
            });
            resp = await Ts.#followRedirects(session, resp);

            const $ = cheerio.load(resp.data || '');
            const datiSingolo = Ts.#parseStpPage($);
            if (datiSingolo) {
                out.data = [datiSingolo];
            } else {
                out.data = Ts.#parseStpList($);
            }
        } catch (e) {
            out.error = true;
            out.message = e.message;
        }
        return out;
    }

    /**
     * Parsing della pagina di dettaglio di un singolo STP/ENI.
     * Estrae i dati anagrafici, domicilio e assistenza dal HTML.
     * @param {import('cheerio').CheerioAPI} $
     * @returns {object|null}
     */
    static #parseStpPage($) {
        // La pagina usa coppie: div.cellaAss35.bold > div.margin-left (label)
        //                       div.cellaAss59 > div.margin-left (valore)
        // Raccolte in container div.tabellaContenitoreTitoli
        const campi = {};
        $('div.tabellaContenitoreTitoli').each((_, container) => {
            const labelEl = $(container).find('div.cellaAss35 div.margin-left');
            const valueEl = $(container).find('div.cellaAss59 div.margin-left');
            if (labelEl.length && valueEl.length) {
                const label = labelEl.text().replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
                const value = valueEl.text().replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
                if (label) campi[label] = value;
            }
        });

        if (!campi['Codice STP/ENI']) return null;

        return {
            codice_stp_eni: campi['Codice STP/ENI'] || '',
            cognome: campi['Cognome'] || '',
            nome: campi['Nome'] || '',
            genere: campi['Genere'] || '',
            data_nascita: campi['Data Nascita'] || '',
            nazionalita: campi['Nazionalit\u00e0'] || campi['Nazionalita']
                || Object.entries(campi).find(([k]) => k.startsWith('Nazionalit'))?.[1] || '',
            indirizzo: campi['Indirizzo'] || '',
            cap: campi['CAP'] || '',
            comune: campi['Comune'] || '',
            provincia: campi['Provincia'] || '',
            medico: campi['Medico'] || '',
            asl_ao: campi['ASL/AO'] || '',
            regione: campi['Regione'] || '',
            tipo_assistito: campi['Tipo Assistito'] || '',
            data_inizio_assistenza: campi['Data Inizio Assistenza'] || '',
            data_fine_assistenza: campi['Data Fine Assistenza'] || '',
            motivazione_fine_assistenza: campi['Motivazione Fine Assistenza'] || '',
        };
    }

    /**
     * Parsing di una pagina con elenco di risultati STP/ENI.
     * @param {import('cheerio').CheerioAPI} $
     * @returns {Array<object>}
     */
    static #parseStpList($) {
        const results = [];
        // Colonne: Codice STP/ENI, Cognome, Nome, Genere, Nazionalità, Dettaglio
        $('table tr').each((i, row) => {
            if (i === 0) return; // skip header
            const cells = $(row).find('td');
            if (cells.length >= 3) {
                const clean = (idx) => $(cells[idx]).text().replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
                const rec = {
                    codice_stp_eni: clean(0),
                    cognome: clean(1),
                    nome: clean(2),
                };
                if (cells.length >= 4) rec.genere = clean(3);
                if (cells.length >= 5) rec.nazionalita = clean(4);
                const link = $(row).find('a').attr('href');
                if (link) rec._detailLink = link;
                if (rec.codice_stp_eni) results.push(rec);
            }
        });
        return results;
    }

    /**
     * Dato un link di dettaglio dalla lista, recupera i dati completi dell'STP/ENI.
     * @param {string} detailLink - URL relativo dal risultato della lista
     * @returns {Promise<{error: boolean, data: object|null, message?: string}>}
     */
    async getDettaglioStp(detailLink) {
        const out = {error: false, data: null};
        try {
            const session = await this.#getHttpSession();
            if (!session) {
                out.error = true;
                out.message = 'Login HTTP su SistemaTS fallito';
                return out;
            }
            let resp = await session.get(detailLink);
            resp = await Ts.#followRedirects(session, resp);
            const $ = cheerio.load(resp.data || '');
            const dati = Ts.#parseStpPage($);
            if (dati) {
                out.data = dati;
            } else {
                out.error = true;
                out.message = 'Pagina dettaglio non riconosciuta';
            }
        } catch (e) {
            out.error = true;
            out.message = e.message;
        }
        return out;
    }

    /**
     * Chiude la sessione HTTP (resetta i cookie).
     */
    closeHttpSession() {
        this._httpSession = null;
    }

    get logged() {
        return this._logged;
    }

    async getWorkingPage(visibile = false) {
        if (!this.logged)
            await this.doLogin(visibile)
        if (!this.logged)
            return null;
        else
            return this._workingPage;
    }

    async doLogin(visibile = false) {
        let retry = this._retry
        while (!this._logged && retry > 0) {
            this._browser = null;
            this._browser = await puppeteer.launch({headless: !visibile});
            const page = (await this._browser.pages())[0];
            try {
                await page.goto('https://sistemats4.sanita.finanze.it/simossHome/login.jsp');
                await page.type("#j_username", this._impostazioni.ts_username);
                await page.type("#j_password", this._impostazioni.ts_password);
                await page.click("#login > fieldset > input:nth-child(11)");
                await page.waitForSelector('#dettaglio_utente')
                this._workingPage = page;
                this._logged = true;
            } catch (e) {
                console.log(e);
                this._logged = false;
                await this._browser.close();
                this._browser = null;
                retry--;
            }
        }
        return this.logged;
    }

    async doLogout() {
        this._logged = false;
        if (this._logged) {
            await this._browser.close();
            this._browser = null;
            return true;
        } else return false;
    }


}
