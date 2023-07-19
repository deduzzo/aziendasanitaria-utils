import path from 'path';
import fs from "fs";
import {utility} from "../utility.js";
import {Nar} from "./Nar.js";
import {Ts} from "./Ts.js";

export class Decessi {

    /**
     *
     * @param {ImpostazioniServiziTerzi} impostazioni
     */
    constructor(impostazioni) {
        this._impostazioni = impostazioni;
        this._nar = new Nar(this._impostazioni);
        this._ts = new Ts(this._impostazioni);
        this.retryTimeout = 5;
    }



    async #verificaDataDecessoDaTS(datiUtenti) {
        let out = {error: false, data: {}};
        try {
            let page = await this._ts.getWorkingPage();
            if (page) {
                let i = 0;
                for (let cf of Object.keys(datiUtenti)) {
                    i++;
                    let dato = datiUtenti[cf];
                    console.log("VERIFICA:")
                    console.log(dato);
                    await page.goto("https://sistemats4.sanita.finanze.it/simossAssistitiWeb/assistitiInit.do", {waitUntil: 'networkidle2'});
                    await page.type("input[name='cognome']", dato.cognome);
                    await page.type("input[name='nome']", dato.nome);
                    await page.type("input[name='dataNascita']", dato.dataNascita);
                    await page.type("select[name='sesso']", dato.sesso);
                    await page.type("input[name='comuneNascita']", dato.comuneNascita);
                    await page.type("input[name='provinciaNascita']", dato.provinciaNascita);
                    await page.click('#go');
                    await page.waitForSelector("body > div:nth-child(12) > h1")
                    datiUtenti[cf].dataDecesso = await page.evaluate(() => {
                        let data = null;
                        try {
                            if (document.querySelector("body > div:nth-child(12) > div:nth-child(15) > div.cellaAss35.bold > div").innerHTML === "Data Decesso")
                                data = document.querySelector("body > div:nth-child(12) > div:nth-child(15) > div.cellaAss59 > div").innerHTML.replaceAll("&nbsp;", "").trim();
                        }
                        catch (e) { }
                        return data;
                    });
                    console.log("codice fiscale: " + cf + " data decesso:" + (datiUtenti[cf].dataDecesso ?? "non recuperabile"));
                }
            }
        } catch (e) {
            console.log(e);
            out.error = true;
            out.data = e;
        }
        await this._ts.doLogout();
        return datiUtenti;
    }

    async #verificaDatiAssititoDaNar(codiciFiscali) {
        let out = {error: false, data: {}};
        let page = await this._nar.getWorkingPage();
        if (page) {
            try {
                for (let cf of codiciFiscali) {
                    await page.goto("https://nar.regione.sicilia.it/NAR/mainMenu.do?ACTION=START&KEY=39100000113");
                    await page.waitForSelector("input[name='codiceFiscaleISISTP@Filter']");
                    await page.waitForTimeout(1000);
                    await page.type("input[name='codiceFiscaleISISTP@Filter']", cf);
                    await page.waitForSelector("#inside");
                    await page.click("#inside > table > tbody > tr > td:nth-child(2) > a");
                    await page.waitForSelector("#id1");
                    let datiAssistito = await page.evaluate((cf) => {
                        let dati = {error: false, data: {}};
                        try {
                            dati.data.cf = cf;
                            dati.data.cognome = document.querySelector("input[name='cognomePaziente@']").value;
                            dati.data.nome = document.querySelector("input[name='nomePaziente@']").value;
                            dati.data.sesso = document.querySelector("select[name='sesso@']").value;
                            dati.data.dataNascita = document.querySelector("input[name='dataNascita@']").value;
                            dati.data.comuneNascita = document.querySelector("input[name='codiceComuneNascita_d']").value;
                            dati.data.provinciaNascita = document.querySelector("input[name='provinciaComuneNascita@']").value;
                        } catch (ex) {
                            dati.error = true;
                            dati.data = "error: " + ex.message + " " + ex.stack;
                            return dati;
                        }
                        return dati;
                    });
                    console.log(datiAssistito);
                    if (!datiAssistito.error)
                        out.data[cf] = datiAssistito.data;
                }
            } catch (ex) {
                out.error = true;
                out.data = "error: " + ex.message + " " + ex.stack;
                return out;
            }
        }
        await this._nar.doLogout();
        return out;
    }


    async verificaAssititiInVita(codiciFiscali, writeFile = true, limit = null) {
        let out = {error: false, out: {vivi: [], nonTrovati: [], morti: []}}
        console.log("codici fiscali totali:" + codiciFiscali.length)
        if (codiciFiscali !== null && codiciFiscali.length > 0) {
            let page = await this._ts.getWorkingPage();
            if (page) {
                let i = 0;
                if (!out.error && codiciFiscali.length > 0) {
                    for (let codiceFiscale of codiciFiscali) {
                        i++;
                        await page.goto("https://sistemats4.sanita.finanze.it/simossAssistitiWeb/assistitiInit.do", {waitUntil: 'networkidle2'});
                        await page.type('body > div:nth-child(12) > form > fieldset > div:nth-child(2) > div.right_column.margin-right.width25 > input[type=text]', codiceFiscale);
                        await page.click('#go');
                        await page.waitForSelector("body > div:nth-child(12) > h1")
                        let datiAssistito = await page.evaluate(() => {
                            let vivo = null;
                            if (document.querySelector("body > div:nth-child(12) > div:nth-child(3) > div.cellaAss35.bold > div"))
                                vivo = true;
                            else if (document.querySelector('body > div:nth-child(12) > div > fieldset > ul').innerHTML.toLowerCase().includes('deceduto'))
                                vivo = false;
                            else if (document.querySelector('body > div:nth-child(12) > div > fieldset > ul').innerHTML.toLowerCase().includes('stato trovato'))
                                vivo = null;
                            return vivo;
                        });
                        if (datiAssistito === true)
                            out.out.vivi.push(codiceFiscale);
                        else if (datiAssistito === false)
                            out.out.morti.push(codiceFiscale);
                        else
                            out.out.nonTrovati.push(codiceFiscale);
                        if (datiAssistito !== true)
                            console.log(codiceFiscale + " stato:" + (datiAssistito === null ? " NON TROVATO" : " MORTO"))
                        if (datiAssistito !== true)
                            console.log("morti:" + out.out.morti.length + ", non trovati:" + out.out.nonTrovati.length);
                        if (limit)
                            if (i > limit)
                                break;
                    }
                }
                await this._ts.doLogout();
                let datiMorti = await this.#verificaDatiAssititoDaNar(out.out.morti);
                let dateDecesso = await this.#verificaDataDecessoDaTS(datiMorti.data);
                out.out.morti = dateDecesso;
                //if (writeFile)
                //    Common.scriviOggettoSuNuovoFileExcel(dateDecesso, "dataDecesso.xlsx");
            }
        } else
            out = {error: true, out: "Nessun codice fiscale trovato"}
        return out;
    }


}
