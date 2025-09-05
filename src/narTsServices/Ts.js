import puppeteer from "puppeteer";
import fs from "fs";

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
