import {Nar} from "./Nar.js";
import {Ts} from "./Ts.js";
import {utils as Utils, utils} from "../Utils.js";
import path from "path";
import fs from "fs";
import AsyncLock from 'async-lock';
const lock = new AsyncLock();
import {EventEmitter} from 'events';
import _ from 'lodash';
import {ImpostazioniServiziTerzi} from "../config/ImpostazioniServiziTerzi.js";
import {Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun} from "docx";
import moment from "moment";
import {Nar2} from "./Nar2.js";
import cliProgress from 'cli-progress';

export class Assistiti {

    /**
     *
     * @param {Config} configurazioneServiziTerzi
     * @param visible
     */
    constructor(configurazioneServiziTerzi, visible = false) {
        this._impostazioni = new ImpostazioniServiziTerzi(configurazioneServiziTerzi);
        this._nar = new Nar(this._impostazioni, visible);
        this._ts = new Ts(this._impostazioni);
        this._nar2 = new Nar2(this._impostazioni, visible);
        this.retryTimeout = 5;
    }


    async #verificaDataDecessoDaTS(datiUtenti, visibile = true, index = 1) {
        let page = await this._ts.getWorkingPage(visibile);
        if (page) {
            console.log("VERIFICA DATE DECESSO")
            for (let cf of Object.keys(datiUtenti)) {
                try {
                    let dato = datiUtenti[cf];
                    await page.goto("https://sistemats4.sanita.finanze.it/simossAssistitiWeb/assistitiInit.do", {waitUntil: 'networkidle2'});
                    await page.type("input[name='cognome']", dato.cognome);
                    await page.type("input[name='nome']", dato.nome);
                    await page.type("input[name='dataNascita']", dato.data_nascita);
                    await page.type("select[name='sesso']", dato.sesso);
                    await page.type("input[name='comuneNascita']", dato.comune_nascita);
                    await page.type("input[name='provinciaNascita']", (dato.provincia_nascita !== "SE" && dato.provincia_nascita !== "XX") ? dato.provincia_nascita : "EE");
                    await page.click('#go');
                    await page.waitForSelector("body > div:nth-child(12) > h1")
                    datiUtenti[cf].data_decesso = await page.evaluate(() => {
                        let data = null;
                        try {
                            if (document.querySelector("body > div:nth-child(12) > div:nth-child(15) > div.cellaAss35.bold > div").innerHTML === "Data Decesso")
                                data = document.querySelector("body > div:nth-child(12) > div:nth-child(15) > div.cellaAss59 > div").innerHTML.replaceAll("&nbsp;", "").trim();
                        } catch (e) {
                        }
                        return data;
                    });
                } catch (e) {
                }
                console.log(index + "# -" + cf + " data decesso: " + (datiUtenti[cf].data_decesso ?? "NON RECUPERABILE"));
            }
        }
        await this._ts.doLogout();
        if (this._ts._browser)
            await this._ts._browser.close();
        this._ts._browser = null;
        return datiUtenti;
    }

    async apriMMGAssistiti(codNarMMG, allCfAssistiti, index = 1, visible= false) {
        // set _maxListeners 20
        EventEmitter.defaultMaxListeners = 20;
        // Funzione per eseguire un task con timeout
        const performTaskWithTimeout = async (task, timeout) => {
            let timer;
            const timeoutPromise = new Promise((_, reject) => {
                timer = setTimeout(() => {
                    reject(new Error('Task timed out'));
                }, timeout);
            });

            try {
                await Promise.race([task(), timeoutPromise]);
            } finally {
                clearTimeout(timer);
            }
        }


        let out = {chiusi: [], nonTrovati: [], errori: [], currentIndex: 0};

        await this._nar.doLogout();
        let page = await this._nar.getWorkingPage(visible);
        console.log("$#" + index + " " + " TOTALI: " + allCfAssistiti.length)
        if (page) {
            while (out.currentIndex < allCfAssistiti.length) {
                let cf = allCfAssistiti[out.currentIndex].codiceFiscale;
                try {
                    await performTaskWithTimeout(async () => {
                        await page.goto("https://nar.regione.sicilia.it/NAR/mainMenu.do?ACTION=START&KEY=39100000113");
                        await page.waitForSelector("input[name='codiceFiscaleISISTP@Filter']");
                        await page.waitForTimeout(1000);
                        await page.type("input[name='codiceFiscaleISISTP@Filter']", cf);
                        await page.waitForSelector("#inside");
                        // if page has selector "#inside > table > tbody > tr > td:nth-child(2) > a" then
                        if (await page.$("#inside > table > tbody > tr > td:nth-child(2) > a") !== null) {
                            await page.click("#inside > table > tbody > tr > td:nth-child(2) > a");
                            await page.waitForSelector("#mediciTable");
                            // click button with selector #mediciTable > tbody > tr.row0\,.row_highlight > td:nth-child(10) > button
                            await page.click("#mediciTable > tbody > tr.row0 > td:nth-child(10) > button");
                            await page.waitForSelector("#tipoOperazioneScelta");
                            let chiuso = await page.evaluate((codNarMMG) => {
                                return document.querySelector("input[name='idMedicoCodRegionale']").value === codNarMMG &&
                                    (document.querySelector("#dataRevoca > table > tbody > tr > td:nth-child(1) > input") !== null && document.querySelector("#dataRevoca > table > tbody > tr > td:nth-child(1) > input").value !== "")
                            }, codNarMMG);
                            if (chiuso) {
                                // select all content of input with selector "pazienteMedico.dataRevoca@"
                                await page.evaluate(() => {
                                    document.querySelector("input[name='pazienteMedico.dataRevoca@']").select();
                                    // send key "Backspace"
                                    document.execCommand('insertText', false, '');
                                    // focus on pazienteMedico.dataRevoca@
                                    document.querySelector("input[name='pazienteMedico.dataRevoca@']").focus();
                                });
                                // type tab key
                                await page.keyboard.press('Tab');
                                // wait for 200 ms
                                await page.waitForTimeout(2000);
                                // click button name="BTN_CONFIRM"
                                await page.click("button[name='BTN_CONFIRM']");
                                // aspetta finchè la pagina non finisce il caricamento
                                await page.waitForTimeout(3000);
                                console.log("#" + index + " Assistito " + cf + " riaperto");
                                out.chiusi.push(cf);
                            }
                        } else
                            console.log("#" + index + " - Assistito " + cf + " già aperto");
                        out.currentIndex++;
                    }, 30000); // Timeout di 60 secondi
                } catch (ex) {
                    if (ex.message.includes("No node found for selector: #mediciTable > tbody > tr.row0 > td:nth-child(10)")) {
                        console.log("#" + index + " Assistito " + cf + " già aperto");
                        out.currentIndex++;
                    } else {
                        console.log("#" + index + " " + cf + " errore: " + ex.message + " " + ex.stack);
                        out.errori.push(cf + "_su_nar");
                        await this._nar.doLogout();
                        page = await this._nar.getWorkingPage();
                    }
                }
            }
        }
    }

    async chiudiAssistitiDeceduti(datiAssistitiMorti, index = 1, provaNar2 = true) {
        // set _maxListeners 20
        EventEmitter.defaultMaxListeners = 20;
        // Funzione per eseguire un task con timeout
        const performTaskWithTimeout = async (task, timeout) => {
            let timer;
            const timeoutPromise = new Promise((_, reject) => {
                timer = setTimeout(() => {
                    reject(new Error('Task timed out'));
                }, timeout);
            });

            try {
                await Promise.race([task(), timeoutPromise]);
            } finally {
                clearTimeout(timer);
            }
        }


        let out = {chiusi: [], nonTrovati: [], errori: [], currentIndex: 0};

        await this._nar.doLogout();
        let page = await this._nar.getWorkingPage();
        console.log("$#" + index + " " + " TOTALI: " + datiAssistitiMorti.length)
        if (page) {
            while (out.currentIndex < datiAssistitiMorti.length) {
                let assistito = datiAssistitiMorti[out.currentIndex];
                let cf = assistito.cf;
                console.log("#" + index + " " + cf + " in lavorazione");
                if ((assistito.data_decesso === "" || assistito.data_decesso === null || assistito.data_decesso === undefined) && provaNar2 === true) {
                    console.log("#" + index + " " + cf + " data decesso non presente, provo a recuperarla da NAR2");
                    let dataNar2 = await this._nar2.getDatiAssistitoFromCfSuSogei(cf);
                    if (dataNar2.ok && dataNar2.deceduto === true) {
                        // parse from format "2024-08-06 00:00:00" to "06/08/2024"
                        assistito.data_decesso = dataNar2.dataDecesso;
                        console.log("#" + index + " " + cf + " data decesso recuperata da NAR2: " + assistito.data_decesso);
                    }
                }
                if (assistito.data_decesso !== "" && assistito.data_decesso !== null && assistito.data_decesso !== undefined) {
                    try {
                        await performTaskWithTimeout(async () => {
                            await page.goto("https://nar.regione.sicilia.it/NAR/mainMenu.do?ACTION=START&KEY=39100000113");
                            await page.waitForSelector("input[name='codiceFiscaleISISTP@Filter']");
                            await page.waitForTimeout(1000);
                            await page.type("input[name='codiceFiscaleISISTP@Filter']", cf);
                            await page.waitForSelector("#inside");
                            await page.click("#inside > table > tbody > tr > td:nth-child(2) > a");
                            await page.waitForSelector("#mediciTable");
                            let datiAssistito = await page.evaluate(() => {
                                let data = {deceduto: null, dataDecesso: null};
                                const selectElement = document.querySelector("select[name='categoriaCittadino@']");
                                const selectedOption = selectElement.options[selectElement.selectedIndex];
                                if (selectedOption.text.toLowerCase().includes("deceduto") && document.querySelector("input[name='dataDecesso@']").value !== "") {
                                    data.deceduto = true;
                                    data.dataDecesso = document.querySelector("input[name='dataDecesso@']").value;
                                }
                                return data;
                            });
                            if (datiAssistito.deceduto && datiAssistito.dataDecesso === assistito.data_decesso) {
                                console.log("#" + index + " " + cf + " deceduto già chiuso correttamente il " + datiAssistito.dataDecesso);
                                out.chiusi.push({
                                    cf: cf,
                                    data_decesso: assistito.data_decesso,
                                    data_chiusura: datiAssistito.dataDecesso,
                                    data_ora_operazione: moment().format("YYYY-MM-DD HH:mm:ss"),
                                    chiuso_precedentemente: true
                                })
                            } else {
                                // da chiudere
                                await page.click("button[name='Btn1']");
                                await page.waitForSelector("input[name='pazienteMedico.dataRevoca@']");
                                await page.type("input[name='pazienteMedico.dataRevoca@']", assistito.data_decesso);
                                // type tab
                                await page.keyboard.press('Tab');
                                // wait for 500 ms
                                await page.waitForTimeout(1000);
                                await page.type("input[name='idTipoOpeRevoca_c']", "3");
                                await page.keyboard.press('Tab');
                                await page.waitForTimeout(1000);
                                await page.type("input[name='idMotivoRevoca_c']", "A08");
                                await page.keyboard.press('Tab');
                                await page.waitForTimeout(1000);
                                // click BTN_CONFIRM
                                await page.click("button[name='BTN_CONFIRM']");
                                // wait until "body > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(18) > tbody > tr > td > table > tbody > tr:nth-child(3) > td:nth-child(4) > p" value is "deceduto"
                                await page.waitForFunction(() => {
                                    const element = document.querySelector("body > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(18) > tbody > tr > td > table > tbody > tr:nth-child(3) > td:nth-child(4) > p");
                                    return element && element.textContent.toLowerCase().includes("deceduto");
                                }, {timeout: 60000});
                                console.log("#" + index + " " + cf + " deceduto chiuso il " + assistito.data_decesso);
                                out.chiusi.push({
                                    cf: cf,
                                    data_decesso: assistito.data_decesso,
                                    data_chiusura: assistito.data_decesso,
                                    data_ora_operazione: moment().format("YYYY-MM-DD HH:mm:ss"),
                                    chiuso_precedentemente: false
                                })
                            }

                        }, 60000); // Timeout di 60 secondi
                    } catch (ex) {
                        console.log("#" + index + " " + cf + " errore: " + ex.message + " " + ex.stack);
                        out.errori.push(cf + "_su_nar");
                        await this._nar.doLogout();
                        page = await this._nar.getWorkingPage();
                    }

                } else {
                    console.log("#" + index + " " + cf + " data decesso non valida");
                    out.errori.push(cf + " data decesso non valida");

                }
                if (out.currentIndex % 10 === 0)
                    console.log("#" + index + "[" + out.currentIndex + " di " + datiAssistitiMorti.length + "] % " + (out.currentIndex / datiAssistitiMorti.length * 100).toFixed(2));
                out.currentIndex++;
            }
        }
        console.log("#" + index + " FINE");
        return out;
    }

    async verificaDatiAssititoDaNar(codiciFiscali, visibile, index = 1) {
        let out = {data: {}, nonTrovati: [], storicoMMG: {}};
        let page = await this._nar.getWorkingPage(visibile);
        console.log("$#" + index + " " + " TOTALI: " + codiciFiscali.length)
        if (page) {
            let i = 0;
            for (let cf of codiciFiscali) {
                try {
                    await page.goto("https://nar.regione.sicilia.it/NAR/mainMenu.do?ACTION=START&KEY=39100000113");
                    await page.waitForSelector("input[name='codiceFiscaleISISTP@Filter']");
                    await page.waitForTimeout(1000);
                    await page.type("input[name='codiceFiscaleISISTP@Filter']", cf);
                    await page.waitForSelector("#inside");
                    await page.click("#inside > table > tbody > tr > td:nth-child(2) > a");
                    await page.waitForSelector("#mediciTable");
                    let datiAssistito = await page.evaluate(() => {
                        let dati = {error: false, data: {}};
                        try {
                            dati.data.cognome = document.querySelector("input[name='cognomePaziente@']")?.value;
                            dati.data.nome = document.querySelector("input[name='nomePaziente@']")?.value;
                            dati.data.sesso = document.querySelector("select[name='sesso@']")?.value;
                            dati.data.data_nascita = document.querySelector("input[name='dataNascita@']")?.value;
                            dati.data.comune_nascita = document.querySelector("input[name='codiceComuneNascita_d']")?.value;
                            dati.data.provincia_nascita = document.querySelector("input[name='provinciaComuneNascita@']")?.value;
                            dati.data.indirizzo = document.querySelector("input[name='indirizzoResidenza@']")?.value;
                            if (document.querySelector("#mediciTable").rows.length > 1) {
                                let mmg = [];
                                for (let i = 1; i < document.querySelector("#mediciTable").rows.length; i++) {
                                    let mmgRow = {}
                                    mmgRow.tipoMMG = document.querySelector("#mediciTable").rows[i].cells[4].innerText;
                                    mmgRow.codiceRegionaleMMG = document.querySelector("#mediciTable").rows[i].cells[2].innerText;
                                    mmgRow.nominativoMMG = document.querySelector("#mediciTable").rows[i].cells[3].innerText;
                                    mmgRow.statoMMG = !document.querySelector("#mediciTable").rows[i].cells[7].innerText.toLowerCase().includes('revoca');
                                    mmgRow.tipoOpMMG = document.querySelector("#mediciTable").rows[i].cells[5].innerText;
                                    mmgRow.dataSceltaMMG = document.querySelector("#mediciTable").rows[i].cells[6].innerText;
                                    mmgRow.dataRevocaMMG = document.querySelector("#mediciTable").rows[i].cells[8].innerText;
                                    if (i === 1)
                                        dati.data = {...dati.data, ...mmgRow};
                                    mmg.push(mmgRow);
                                }
                                dati.data.storicoMMG = mmg;
                            }
                            if (!dati.data.hasOwnProperty('indirizzo'))
                                dati.data.indirizzo = "";
                        } catch (ex) {
                            dati.error = true;
                            dati.data = "error: " + ex.message + " " + ex.stack;
                            return dati;
                        }
                        return dati;
                    });
                    if (!datiAssistito.error) {
                        console.log("#" + index + " " + cf + " dati su NAR ok");
                        datiAssistito.data.cf = cf;
                        out.storicoMMG[cf] = datiAssistito.data.storicoMMG;
                        delete datiAssistito.data.storicoMMG;
                        out.data[cf] = datiAssistito.data;
                    } else {
                        console.log("#" + index + " " + cf + " dati su NAR ERRORE");
                        out.nonTrovati.push(cf + "_su_nar");
                    }
                } catch (ex) {
                    out.nonTrovati.push(cf + "_su_nar");
                }
                if (i++ % 10 === 0)
                    console.log("#" + index + " - " + i + "/" + codiciFiscali.length + " " + (i / codiciFiscali.length * 100).toFixed(2) + "% " + " [trovati: " + Object.keys(out.data).length + ", nonTrovati: " + out.nonTrovati.length + "]");
            }
        }
        console.log("#" + index + " FINE");
        await this._nar.doLogout();
        if (this._nar._browser)
            await this._nar._browser.close();
        this._nar._browser = null;
        return out;
    }


    async verificaAssititiInVita(codiciFiscali, limit = null, inserisciIndirizzo = false, index = 1, visibile = true, datiMedicoNar, dateSceltaCfMap = null) {
        let out = {error: false, out: {vivi: {}, nonTrovati: [], morti: [], obsoleti: {}}}
        console.log("$#" + index + " " + " TOTALI: " + codiciFiscali.length)
        if (codiciFiscali.length > 0) {
            let page = await this._ts.getWorkingPage(visibile);
            page.setDefaultTimeout(600000);
            if (page) {
                let i = 0;
                if (!out.error && codiciFiscali.length > 0) {
                    for (let codiceFiscale of codiciFiscali) {
                        codiceFiscale = codiceFiscale.trim().replaceAll(" ", "").toUpperCase();
                        // remove all spaces from codiceFiscale
                        let datiAssistito = {};
                        let obsoleto = false;
                        do {
                            obsoleto = false;
                            i++;
                            const url = 'https://sistemats4.sanita.finanze.it/simossAssistitiWeb/assistitiInit.do';
                            let attempts = 0;
                            const maxAttempts = 10;
                            const waitOptions = {waitUntil: 'networkidle2', timeout: 4000};

                            while (attempts < maxAttempts) {
                                try {
                                    await page.goto(url, waitOptions);
                                    break;
                                } catch (error) {
                                    attempts++;
                                    if (attempts === maxAttempts) {
                                        console.error('Massimo numero di tentativi raggiunto, impossibile caricare la pagina');
                                        // stop script
                                        throw error;
                                    }
                                }
                            }

                            try {
                                await page.type('body > div:nth-child(12) > form > fieldset > div:nth-child(2) > div.right_column.margin-right.width25 > input[type=text]', codiceFiscale);
                                await page.click('#go');
                                await page.waitForSelector("body > div:nth-child(12) > h1")
                                datiAssistito = await page.evaluate(() => {

                                    let removeAllNbsp = (str) => {
                                        return str.replaceAll(" ", "").trim();
                                    }

                                    let dati = {}
                                    let vivo = null;
                                    let obsoleto = false;
                                    if (document.querySelector("body > div:nth-child(12) > div:nth-child(3) > div.cellaAss35.bold > div"))
                                        vivo = true;
                                    else if (document.querySelector('body > div:nth-child(12) > div > fieldset > ul').innerHTML.toLowerCase().includes('deceduto'))
                                        vivo = false;
                                    else if (document.querySelector('body > div:nth-child(12) > div > fieldset > ul').innerHTML.toLowerCase().includes('obsoleto')) {
                                        vivo = true;
                                        obsoleto = true;
                                    } else if (document.querySelector('body > div:nth-child(12) > div > fieldset > ul').innerHTML.toLowerCase().includes('stato trovato'))
                                        vivo = null;
                                    if (vivo !== null)
                                        dati.vivo = vivo;
                                    dati.trovato = vivo !== null;
                                    if (dati.trovato && vivo) {
                                        dati.vivo = vivo;
                                        let ind = obsoleto ? 4 : 3;
                                        let fineAssistenza = false;
                                        if (document.querySelector("body > div:nth-child(12) > div:nth-child(" + (3 + 35) + ") > div.cellaAss59 > div") !== null)
                                            fineAssistenza = true;
                                        if (document.querySelector("#menu_voci > ol").children.length > 2) {
                                            dati.asp = removeAllNbsp(document.querySelector("body > div:nth-child(12) > div:nth-child(" + (!fineAssistenza ? (ind + 19) : (ind + 21)) + ") > div.cellaAss59 > div").innerText.trim());
                                            let mmg = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (ind + 15) + ") > div.cellaAss59 > div").innerText.trim().split("-");
                                            dati.mmgCfTs = mmg.length === 2 ? mmg[1].trim() : "";
                                            dati.mmgDaTs = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (ind + 17) + ") > div.cellaAss59 > div").innerText.trim()
                                            dati.tipoAssistitoSSN = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (!fineAssistenza ? (ind + 21) : (ind + 23)) + ") > div.cellaAss59 > div").innerText.trim();
                                            dati.inizioAssistenzaSSN = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (!fineAssistenza ? (ind + 23) : (ind + 25)) + ") > div.cellaAss59 > div").innerText.trim();
                                            dati.fineAssistenzaSSN = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (!fineAssistenza ? (ind + 25) : (ind + 27)) + ") > div.cellaAss59 > div").innerText.trim();
                                            if (fineAssistenza)
                                                dati.motivazioneFineAssistenzaSSN = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (ind + 29) + ") > div.cellaAss59 > div").innerText.trim();
                                            else
                                                dati.motivazioneFineAssistenzaSSN = "";
                                        } else {
                                            dati.asp = "TRASFERITO";
                                            dati.mmgCfTs = "";
                                            dati.mmgDaTs = "";
                                            dati.tipoAssistitoSSN = "";
                                            dati.inizioAssistenzaSSN = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (ind + 15) + ") > div.cellaAss59 > div").innerText.trim()
                                            dati.fineAssistenzaSSN = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (3 + 17) + ") > div.cellaAss59 > div").innerText.trim();
                                            dati.motivazioneFineAssistenzaSSN = "";
                                        }
                                        dati.cf = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (ind) + ") > div.cellaAss59 > div").innerText.trim();
                                        dati.cognome = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (ind + 2) + ") > div.cellaAss59 > div").innerText.trim();
                                        dati.nome = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (ind + 4) + ") > div.cellaAss59 > div").innerText.trim();
                                        dati.sesso = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (ind + 6) + ") > div.cellaAss59 > div").innerText.trim();
                                        dati.data_nascita = removeAllNbsp(document.querySelector("body > div:nth-child(12) > div:nth-child(" + (ind + 8) + ") > div.cellaAss59 > div").innerText.trim());
                                        dati.comune_nascita = removeAllNbsp(document.querySelector("body > div:nth-child(12) > div:nth-child(" + (ind + 10) + ") > div.cellaAss59 > div").innerText.trim());
                                        dati.obsoleto = obsoleto;
                                        dati.errore = false
                                        return dati;
                                    }
                                    return dati;
                                });
                            } catch (e) {
                                datiAssistito = {errore: true};
                            }
                            if (datiMedicoNar)
                                datiAssistito.mmgNarCf = datiMedicoNar.cf;
                            if (dateSceltaCfMap)
                                datiAssistito.mmgDaNar = dateSceltaCfMap[codiceFiscale];
                            if (datiAssistito.obsoleto) {
                                if (!out.out.obsoleti.hasOwnProperty(codiceFiscale))
                                    out.out.obsoleti[codiceFiscale] = [];
                                let codFiscaleNuovo = datiAssistito.cf;
                                datiAssistito.cf = codiceFiscale;
                                out.out.obsoleti[codiceFiscale].push(datiAssistito);
                                datiAssistito.cf = codFiscaleNuovo;
                                codiceFiscale = codFiscaleNuovo;
                                obsoleto = true;
                                console.log(codiceFiscale + " OBSOLETO, RITENTO");
                            }
                        }
                        while (obsoleto);
                        if (datiAssistito.trovato && datiAssistito.vivo) {
                            if (!datiAssistito.asp.toUpperCase().includes("MESSINA"))
                                console.log(codiceFiscale + " NON IN ASP");
                            datiAssistito.cf = codiceFiscale;
                            if (inserisciIndirizzo) {
                                try {
                                    await page.goto("https://sistemats4.sanita.finanze.it/simossAssistitiWeb/ricercaTS.do", {waitUntil: 'networkidle2'});
                                    await page.goto("https://sistemats4.sanita.finanze.it/simossAssistitiWeb/visualizzaTS.do?pos=0", {waitUntil: 'networkidle2'});
                                    const selectorNormale = "body > div:nth-child(13) > h1:nth-child(1)";
                                    const errorSelector = "#caption";

                                    let resolvedSelector = await Promise.race([
                                        page.waitForSelector(selectorNormale).then(() => selectorNormale),
                                        page.waitForSelector(errorSelector).then(() => errorSelector)
                                    ]);

                                    if (resolvedSelector === selectorNormale) {
                                        let datiTessera = await page.evaluate(() => {

                                            let removeAllNbsp = (str) => {
                                                return str.replaceAll(" ", "").trim();
                                            }

                                            try {
                                                return {
                                                    error: false,
                                                    indirizzo: removeAllNbsp(document.querySelector("body > div:nth-child(13) > div:nth-child(14) > div.cellaAss65 > div").innerText.trim()),
                                                    numero_tessera: document.querySelector("body > div:nth-child(13) > div:nth-child(2) > div.cellaAss65 > div").innerHTML.trim().replaceAll("&nbsp;", "").trim(),
                                                }
                                            } catch (e) {
                                                return {error: true, data: e};
                                            }
                                        });
                                        if (!datiTessera.error) {
                                            datiAssistito.indirizzo = datiTessera.indirizzo;
                                            datiAssistito.numero_tessera = datiTessera.numero_tessera;
                                        }
                                    }
                                } catch (e) {

                                }
                            }
                            out.out.vivi[codiceFiscale] = datiAssistito;
                        } else if (datiAssistito.vivo === false && datiAssistito.trovato)
                            out.out.morti.push(codiceFiscale);
                        else
                            out.out.nonTrovati.push(codiceFiscale);
                        if (!datiAssistito.trovato || !datiAssistito.vivo) {
                            console.log("#" + index + " " + codiceFiscale + " stato:" + (!datiAssistito.trovato ? " NON TROVATO" : (datiAssistito.vivo ? " VIVO" : " MORTO")))
                        }
                        if (limit)
                            if (i >= limit)
                                break;
                        // show progress
                        if (i % 10 === 0) {
                            console.log("#" + index + " - " + i + "/" + codiciFiscali.length + " " + (i / codiciFiscali.length * 100).toFixed(2) + "% " + " [vivi: " + Object.keys(out.out.vivi).length + ", morti: " + out.out.morti.length + ", nonTrovati:" + out.out.nonTrovati.length + ", obsoleti:" + Object.keys(out.out.obsoleti).length + "]");
                        }
                    }
                }
            }
        }
        await this._ts.doLogout(false);
        if (this._ts._browser)
            await this._ts._browser.close();
        this._ts._browser = null;
        let dateDecesso = [];
        if (out.out.morti.length > 0) {
            let datiMorti = await this.verificaDatiAssititoDaNar(out.out.morti, visibile, index);
            if (Object.values(datiMorti.data).length > 0)
                dateDecesso = await this.#verificaDataDecessoDaTS(datiMorti.data, visibile, index);
        }
        out.out.morti = dateDecesso;
        return out;
    }

    async verificaAssititiInVitaNar2(codiciFiscali, limit = null, index = 1, visibile = true, datiMedicoNar, dateSceltaCfMap = null, allVerbose= false) {
        let out = {error: false, out: {vivi: {}, nonTrovati: [], morti: {}}}
        console.log("$#" + index + " " + " TOTALI: " + codiciFiscali.length)
        if (codiciFiscali.length > 0) {
            let i = 0;
            for (let codiceFiscale of codiciFiscali) {
                let datiAssistito = await this._nar2.getDatiAssistitoCompleti(codiceFiscale)
                if (allVerbose)
                    console.log("#" + index + " " + codiceFiscale + " stato:" + (!datiAssistito.ok ? " ERRORE" : (!datiAssistito.deceduto ? " VIVO" : (" MORTO il " + datiAssistito.dataDecesso))))
                let cleanData = datiAssistito.ok ? datiAssistito.dati() : null;
                if (!datiAssistito.ok)
                    out.out.nonTrovati.push(codiceFiscale);
                else if (!cleanData.inVita)
                    out.out.morti[codiceFiscale] = cleanData;
                else
                    out.out.vivi[codiceFiscale] = cleanData;
                if (i % 20 === 0 && i >0)
                    console.log("#" + index + " - " + i + "/" + codiciFiscali.length + " " + (i / codiciFiscali.length * 100).toFixed(2) + "% " + " [vivi: " + Object.keys(out.out.vivi).length + ", morti: " + Object.keys(out.out.morti).length + ", nonTrovati:" + out.out.nonTrovati.length + "]");
                i++;
            }
        }
        return out;
    }


    static async verificaAssistitiParallels(configImpostazioniServizi, codiciFiscali, includiIndirizzo = true, numParallelsJobs = 10, visible = false, legacy = false, datiMedicoNar = null, dateSceltaCfMap = null) {
        EventEmitter.defaultMaxListeners = 100;
        let out = {error: false, out: {vivi: {}, nonTrovati: [], morti: {}, obsoleti: {}}}
        let jobs = [];
        let jobSize = Math.ceil(codiciFiscali.length / numParallelsJobs);
        for (let i = 0; i < numParallelsJobs; i++) {
            let job = codiciFiscali.slice(i * jobSize, (i + 1) * jobSize);
            jobs.push(job);
        }
        let promises = [];
        for (let i = 0; i < jobs.length; i++) {
            let assistitiTemp = new Assistiti(configImpostazioniServizi, visible);
            if (legacy)
                promises.push(assistitiTemp.verificaAssititiInVita(jobs[i], null, includiIndirizzo, i + 1, visible, datiMedicoNar, dateSceltaCfMap));
            else
                promises.push(assistitiTemp.verificaAssititiInVitaNar2(jobs[i], null, i + 1, visible, datiMedicoNar, dateSceltaCfMap));
        }
        let results = await Promise.all(promises);
        promises = null;
        for (let result of results) {
            out.error = out.error || result.error;
            out.out.vivi = Object.assign(out.out.vivi, result.out.vivi);
            out.out.nonTrovati = [...out.out.nonTrovati, ...result.out.nonTrovati];
            out.out.morti = Object.assign(out.out.morti, result.out.morti);
            result = null;
        }
        return out;
    }

    static async verificaDatiAssistitiNarParallels(configImpostazioniServizi, codiciFiscali, includiIndirizzo = false, numParallelsJobs = 10, visible = false) {
        EventEmitter.defaultMaxListeners = 100;
        let out = {error: false, out: {dati: [], nonTrovati: [], storicoMMG: {}}}
        let jobs = [];
        let jobSize = Math.ceil(codiciFiscali.length / numParallelsJobs);
        for (let i = 0; i < numParallelsJobs; i++) {
            let job = codiciFiscali.slice(i * jobSize, (i + 1) * jobSize);
            jobs.push(job);
        }
        let promises = [];
        for (let i = 0; i < jobs.length; i++) {
            let assistitiTemp = new Assistiti(configImpostazioniServizi, visible);
            promises.push(assistitiTemp.verificaDatiAssititoDaNar(jobs[i], true, i + 1));
        }
        let results = await Promise.all(promises);
        promises = null;
        for (let result of results) {
            out.out.dati.push(...Object.values(result.data));
            out.out.nonTrovati.push(...result.nonTrovati);
            out.storicoMMG = {...out.storicoMMG, ...result.storicoMMG};
            result = null;
        }
        return out;
    }


    async controlliEsenzioneAssistito(protocolli, arrayEsenzione, anno, index = 1, includiPrestazioni = true, visibile = false) {
        let datoFinale = {error: false, out: {}};
        let start = true;
        let numErrori = 0;
        let i = 0;
        for (let protocollo of protocolli) {
            let ok = true;
            do {
                if (numErrori > 5) {
                    return {error: true, out: "TROPPI ERRORI"};
                }
                let datiEsenzioni = {error: false, out: {}};
                try {
                    let page = await this._ts.getWorkingPage(visibile);
                    if (page) {
                        if (start) {
                            await page.goto("https://sistemats4.sanita.finanze.it/simossHome/traceAuditing.do?p=U67", {waitUntil: 'networkidle2'});
                            start = false;
                        }
                        await page.goto("https://sistemats4.sanita.finanze.it/EsenzioniReddito/gestioneControlli.do", {waitUntil: 'networkidle2'});
                        await Promise.all([
                            page.waitForNavigation({waitUntil: 'networkidle2'}),
                            page.select('select[name="annoControllo"]', anno),
                        ]);
                        await page.click('input[type="radio"][name="scelta2"][value="PROT"]');
                        // wait 1 sec
                        await page.type("input[name='protocollo']", protocollo);
                        // set value "CFT" to radio with name "scelta2"

                        await page.click('input[type="submit"][name="button"][value="Conferma"]');

                        await page.waitForSelector("body > table > tbody > tr > td > div > form > fieldset > div:nth-child(6) > table");

                        datiEsenzioni = await page.evaluate((arrayEsenzione) => {
                            // get table with selector "body > table > tbody > tr > td > div > form > fieldset > div:nth-child(6) > table"
                            let table = document.querySelector("body > table > tbody > tr > td > div > form > fieldset > div:nth-child(6) > table");
                            let dati = {error: false, out: {}};
                            try {
                                for (let i = 1; i < table.rows.length; i++) {
                                    let row = table.rows[i];
                                    if (arrayEsenzione.includes(row.cells[2].innerText.trim().toUpperCase())) {
                                        let temp = {}
                                        temp.value = row.cells[0].children[0].value;
                                        temp.protocollo = row.cells[1].innerText.trim();
                                        temp.esenzione = row.cells[2].innerText.trim();
                                        temp.dataInizio = row.cells[4].innerText.trim();
                                        temp.dataFine = row.cells[5].innerText.trim();
                                        temp.esito = row.cells[6].innerText.trim();
                                        temp.descrizione = row.cells[7].innerText.trim();
                                        dati.out[temp.protocollo] = temp;
                                    } else
                                        console.log("no");
                                }
                            } catch (ex) {
                                dati.error = true;
                                dati.out = ex.message + " " + ex.stack;
                            }
                            return dati;
                        }, arrayEsenzione);
                        for (let key of Object.keys(datiEsenzioni.out)) {
                            let riga = datiEsenzioni.out[key];
                            await page.click('input[type="radio"][name="scelta"][value="' + riga.value + '"]');
                            // delete key "value" from riga
                            delete riga.value;
                            await Promise.all([
                                page.waitForNavigation({waitUntil: 'networkidle2'}),
                                await page.click('input[type="submit"][name="button"][value="Dettaglio"]')
                            ]);
                            let dettagliProtocollo = await page.evaluate(() => {
                                let out = {};
                                out.cfEsente = document.querySelector('input[name="CF_SOG_ESENTE"]').value;
                                out.cfDichiarante = document.querySelector('input[name="CF_AUTOCER"]').value;
                                out.cfTitolare = document.querySelector('input[name="CF_SOG_TITOLARE"]').value;
                                return out;
                            });
                            riga.cfEsente = dettagliProtocollo.cfEsente === "" ? null : dettagliProtocollo.cfEsente;
                            riga.cfDichiarante = dettagliProtocollo.cfDichiarante === "" ? null : dettagliProtocollo.cfDichiarante;
                            riga.cfTitolare = dettagliProtocollo.cfTitolare === "" ? null : dettagliProtocollo.cfTitolare;
                            await Promise.all([
                                page.waitForNavigation({waitUntil: 'networkidle2'}),
                                await page.click('input[type="submit"][name="button"][value="Dettaglio"]')
                            ]);

                            let ricetteProtocollo = await page.evaluate(() => {
                                let dati = {error: false, out: {dettaglio: {}, totaleGlobale: 0.0}};
                                // get child of component with selector "body > table > tbody > tr > td > div > form > fieldset"
                                let tabelle = Array.from(document.querySelector("body > table > tbody > tr > td > div > form > fieldset").querySelectorAll(".tabella")).map(tabella => tabella);
                                for (let tabella of tabelle) {
                                    let titoloTabella = tabella.rows[0].cells[0].innerText.replaceAll("\n", "").replaceAll(" ", "_").toLowerCase();
                                    dati.out.dettaglio[titoloTabella] = {dettaglio: [], totale: null};
                                    for (let i = 2; i < tabella.rows.length; i++) {
                                        let row = tabella.rows[i];
                                        if (i !== tabella.rows.length - 1)
                                            dati.out.dettaglio[titoloTabella].dettaglio.push({
                                                value: row.cells[0].children[0].value,
                                                ricetta: row.cells[1].innerText,
                                                struttura: row.cells[2].innerText,
                                                ubicazione: row.cells[3].innerText,
                                                data_prescrizione: row.cells[4].innerText,
                                                data_spedizione: row.cells[5].innerText,
                                                ticket: parseFloat(row.cells[6].innerText),
                                            });
                                        else
                                            dati.out.dettaglio[titoloTabella].totale = parseFloat(row.cells[1].innerText);
                                    }
                                    dati.out.totaleGlobale += dati.out.dettaglio[titoloTabella].totale;
                                }
                                return dati;
                            });
                            if (ricetteProtocollo.error)
                                datiEsenzioni.error = true;
                            else {
                                datiEsenzioni.out[key].ricette = ricetteProtocollo.out;
                                if (includiPrestazioni) {
                                    for (let tipo in ricetteProtocollo.out.dettaglio) {
                                        for (let ricetta of ricetteProtocollo.out.dettaglio[tipo].dettaglio) {
                                            await page.click('input[type="radio"][name="scelta"][value="' + ricetta.value + '"]');
                                            delete ricetta.value;
                                            await Promise.all([
                                                page.waitForNavigation({waitUntil: 'networkidle2'}),
                                                await page.click('input[type="submit"][name="button"][value="Dettaglio"]')
                                            ]);
                                            let prestazioni = await page.evaluate(() => {
                                                let dati = {error: false, out: {dettaglio: [], tariffaGlobale: 0.0}};
                                                // get child of component with selector "body > table > tbody > tr > td > div > form > fieldset"
                                                let table = document.querySelector("body > table > tbody > tr > td > div > form > fieldset > div:nth-child(6) > table");
                                                try {
                                                    for (let i = 1; i < table.rows.length; i++) {
                                                        let row = table.rows[i];
                                                        let temp = {}
                                                        temp.regione = row.cells[0].innerText.trim();
                                                        temp.data_erogazione = row.cells[1].innerText.trim();
                                                        temp.quantita = parseInt(row.cells[2].innerText.trim());
                                                        temp.codice_prodotto = row.cells[3].innerText.trim();
                                                        temp.descrizione = row.cells[4].innerText.trim();
                                                        temp.tariffa = parseFloat(row.cells[5].innerText.trim());
                                                        dati.out.tariffaGlobale += temp.tariffa;
                                                        dati.out.dettaglio.push(temp);
                                                    }
                                                } catch (ex) {
                                                    dati.error = true;
                                                    dati.out = ex.message + " " + ex.stack;
                                                }
                                                return dati;
                                            });
                                            if (!prestazioni.error) {
                                                ricetta.prestazioni = prestazioni.out;
                                            }
                                            await page.goBack();
                                        }
                                    }
                                }
                            }
                            await page.goBack();
                            await page.goBack();
                        }
                    }
                    //console.log("#" + index + " " + codiceFiscale + " " + (datiEsenzioni.error ? "ERRORE" : "OK"));
                    if (datiEsenzioni.error)
                        datoFinale.error = true;
                    if (i % 5 === 0)
                        console.log("#" + index + " " + i + "/" + protocolli.length + " " + (i / protocolli.length * 100).toFixed(2) + "% ");
                } catch (e) {
                    ok = false;
                }
                if (ok) {
                    i++;
                    datoFinale.out[protocollo] = datiEsenzioni.out[protocollo];
                } else {
                    console.log("#" + index + " " + protocollo + " ERRORE, RITENTO");
                    numErrori++;
                    start = true;
                    //await this._ts.doLogout();
                    //this._ts = new Ts(this._impostazioni);
                }
            } while (!ok);
        }
        if (this._ts._browser)
            await this._ts._browser.close();
        this._ts._browser = null;
        return datoFinale;
    }

    static async controlliEsenzioneAssistitoParallels(configImpostazioniServizi, protocolli, arrayEsenzioni, anno, workingPath, numParallelsJobs = 10, maxItemsPerJob = 40, includiPrestazioni = true, visible = false) {
        EventEmitter.defaultMaxListeners = 200;
        let out = {error: false, out: Object.assign({}, protocolli)};
        let protocolliMancanti = {}
        for (let dato of Object.keys(protocolli)) {
            if (protocolli[dato] == null)
                protocolliMancanti[dato] = null;
        }

        protocolli = Object.keys(protocolliMancanti);

        if (Object.keys(protocolliMancanti).length > 0) {
            // Dividi i protocolli in gruppi più piccoli
            let jobs = [];
            for (let i = 0; i < protocolli.length; i += maxItemsPerJob) {
                jobs.push(protocolli.slice(i, i + maxItemsPerJob));
            }

            const aggiornaFile = async (index) => {
                await lock.acquire('fileWriteLock', async function () {
                    await Utils.scriviOggettoSuFile(workingPath + path.sep + anno + ".json", out.out);
                    console.log("[" + index + "] AGGIORNAMENTO FILE OK")
                });
            }

            // Funzione per processare un singolo job
            async function processJob(job, index = 1) {
                let assistitiTemp = new Assistiti(configImpostazioniServizi);
                let result = null;
                try {
                    result = await assistitiTemp.controlliEsenzioneAssistito(job, arrayEsenzioni, anno, index, includiPrestazioni, visible);
                } catch (e) {
                    console.log("[" + index + "] errore elaborazione job:" + job);
                    result = {error: true, out: "errore elaborazione job:" + job};
                }
                await assistitiTemp._ts.doLogout();
                assistitiTemp = null;
                if (!result.error) {
                    await lock.acquire('updateData', async function () {
                        for (const key in result.out) {
                            out.out[key] = result.out[key];
                        }
                    });
                    if (index % numParallelsJobs === 0)
                        await aggiornaFile(index);
                } else
                    out.error = true;
            }

            // Gestisce l'esecuzione parallela dei jobs
            async function manageParallelJobs(jobs) {
                let activeJobs = [];
                let index = 1;
                while (jobs.length > 0) {
                    if (activeJobs.length < numParallelsJobs) {
                        let job = jobs.shift();
                        console.log("Rimangono " + jobs.length + " jobs ");
                        let jobPromise = processJob(job, index++).then(() => {
                            activeJobs = activeJobs.filter(j => j !== jobPromise);
                        });
                        activeJobs.push(jobPromise);
                    } else {
                        await Promise.race(activeJobs);
                    }
                }
                await Promise.all(activeJobs);
            }

            await manageParallelJobs(jobs);
            await aggiornaFile(0);
        }
        return out;
    }

    async generaReport() {
        let workingPath = await utils.getWorkingPath();
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({
                        children: [
                            new TextRun("Hello World"),
                            new TextRun({
                                text: "Foo Bar",
                                bold: true,
                            }),
                            new TextRun({
                                text: "\tGithub is the best",
                                bold: true,
                            }),
                        ],
                    }),
                ],
            }]
        });

        await Packer.toBuffer(doc).then((buffer) => {
            fs.writeFileSync(workingPath + path.sep + "My Document.docx", buffer);
        });

    }


    static async verificaAssititiInVitaParallelsJobs(impostazioniServizi, pathJob, outPath = "elaborazioni", numOfParallelJobs = 15, visibile = false, nomeFile = "assistitiNar.json") {
        EventEmitter.defaultMaxListeners = 100;

        // Stato globale del progresso
        let completati = 0;
        let totaleMedici = 0;

        // Creiamo una nuova barra di progresso multi-riga
        const multibar = new cliProgress.MultiBar({
            clearOnComplete: false,
            hideCursor: true,
            format: '{bar} {percentage}% | {value}/{total} | {message}',
        }, cliProgress.Presets.shades_classic);

        // Creiamo la barra principale e le barre per i job
        const mainBar = multibar.create(100, 0, { message: 'Totale' });
        const jobBars = Array(numOfParallelJobs).fill(null).map(() =>
            multibar.create(100, 0, { message: 'In attesa...' })
        );

        const updateUI = (index, message, incrementaCompletati = false) => {
            if (incrementaCompletati) {
                completati++;
                const percentuale = totaleMedici > 0 ? Math.floor((completati / totaleMedici) * 100) : 0;
                mainBar.update(percentuale, {
                    message: `Progresso: ${completati}/${totaleMedici}`
                });
            }

            if (index !== undefined) {
                const barIndex = index % numOfParallelJobs;
                jobBars[barIndex].update(0, { message });
            }
        };

        const processJob = async (codMedico, index) => {
            const subProcess = (index % numOfParallelJobs) + 1;

            let assistitiCfArray = [];
            for (let cf of datiAssititi[codMedico].assistiti) {
                assistitiCfArray.push(cf.codiceFiscale);
            }

            // Aggiorniamo UI per mostrare che stiamo processando
            updateUI(subProcess - 1, `[#${subProcess}] Elaborazione ${codMedico} in corso... [0/${datiAssititi[codMedico].assistiti.length}]`);

            let ris = await Assistiti.verificaAssistitiParallels(impostazioniServizi, assistitiCfArray, false, numOfParallelJobs, visibile);

            const updateJobStatus = async (ris) => {
                await utils.scriviEComprimiFile(pathJob + path.sep + outPath + path.sep + codMedico + ".json", {
                    vivi: ris.out.vivi,
                    deceduti: ris.out.morti,
                    nonTrovati: ris.out.nonTrovati,
                    obsoleti: ris.out.obsoleti,
                });
                if (Object.keys(ris.out.morti).length > 0)
                    await utils.scriviOggettoSuNuovoFileExcel(pathJob + path.sep + outPath + path.sep + codMedico + "_deceduti.xlsx", Object.values(ris.out.morti));
                if (ris.out.nonTrovati.length > 0)
                    await utils.scriviOggettoSuNuovoFileExcel(pathJob + path.sep + outPath + path.sep + codMedico + "_nontrovati.xlsx", ris.out.nonTrovati, ["CF non trovati"]);

                jobStatus[codMedico].elaborati = Object.keys(ris.out.vivi).length + Object.keys(ris.out.morti).length + ris.out.nonTrovati.length;
                jobStatus[codMedico].vivi = Object.keys(ris.out.vivi).length;
                jobStatus[codMedico].deceduti = Object.keys(ris.out.morti).length;
                jobStatus[codMedico].nonTrovati = ris.out.nonTrovati.length;
                jobStatus[codMedico].completo = true;
                jobStatus[codMedico].ok = (jobStatus[codMedico].elaborati === jobStatus[codMedico].totale);
                await utils.scriviOggettoSuFile(pathJob + path.sep + "jobstatus.json", jobStatus);

                const message = `[#${subProcess}] ${codMedico}: ${jobStatus[codMedico].elaborati}/${jobStatus[codMedico].totale} [vivi: ${jobStatus[codMedico].vivi}, morti: ${jobStatus[codMedico].deceduti}, nonTrovati: ${jobStatus[codMedico].nonTrovati}]`;
                updateUI(subProcess - 1, message, true);
            };

            return lock.acquire('jobstatus.json', () => updateJobStatus(ris), (err, ret) => {
                if (err) {
                    const barIndex = (subProcess - 1) % numOfParallelJobs;
                    jobBars[barIndex].update(0, {
                        message: `[#${subProcess}] ERRORE ${codMedico}: ${err.message}`
                    });
                }
                ris = null;
            });
        }

        const taskPool = async (poolSize, tasks) => {
            const results = [];
            const executingTasks = [];
            for (const [index, task] of tasks.entries()) {
                const executingTask = task(index).then(res => {
                    executingTasks.splice(executingTasks.indexOf(executingTask), 1);
                    return res;
                });
                executingTasks.push(executingTask);
                results.push(executingTask);
                if (executingTasks.length >= poolSize) {
                    await Promise.race(executingTasks);
                }
            }
            return Promise.all(results);
        }

        if (!fs.existsSync(pathJob + path.sep + outPath))
            fs.mkdirSync(pathJob + path.sep + outPath);

        let datiAssititi = await utils.leggiOggettoDaFileJSON(pathJob + path.sep + nomeFile);

        if (!fs.existsSync(pathJob + path.sep + "jobstatus.json")) {
            let dati = {}
            for (let codiceMedico of Object.keys(datiAssititi)) {
                dati[codiceMedico] = {
                    totale: Object.values(datiAssititi[codiceMedico].assistiti).length,
                    completo: false
                };
            }
            await utils.scriviOggettoSuFile(pathJob + path.sep + "jobstatus.json", dati);
        }

        let jobStatus = await utils.leggiOggettoDaFileJSON(pathJob + path.sep + "jobstatus.json");

        for (let codiceMedico in jobStatus) {
            let modifica = false;

            if (jobStatus[codiceMedico].hasOwnProperty("ok") && jobStatus[codiceMedico].nonTrovati > jobStatus[codiceMedico].totale * 0.1) {
                jobStatus[codiceMedico].completo = false;
                _.unset(jobStatus[codiceMedico], "nonTrovati");
                _.unset(jobStatus[codiceMedico], "elaborati");
                _.unset(jobStatus[codiceMedico], "vivi");
                _.unset(jobStatus[codiceMedico], "deceduti");
                _.unset(jobStatus[codiceMedico], "nonTrovati");
                _.unset(jobStatus[codiceMedico], "ok");

                let files = fs.readdirSync(pathJob + path.sep + outPath);
                for (let file of files) {
                    if (file.startsWith(codiceMedico))
                        fs.unlinkSync(pathJob + path.sep + outPath + path.sep + file);
                }
                modifica = true;
                updateUI(undefined, `RIMOSSO PER TROPPI NON TROVATI: ${codiceMedico}`);
            }
            if (modifica)
                await utils.scriviOggettoSuFile(pathJob + path.sep + "jobstatus.json", jobStatus);
        }

        let jobsDaElaborare = Object.keys(jobStatus).filter((el) => !jobStatus[el].completo);
        totaleMedici = jobsDaElaborare.length;

        // Inizializziamo la UI
        mainBar.update(0, { message: `Avvio elaborazione di ${totaleMedici} medici...` });

        await taskPool(numOfParallelJobs, jobsDaElaborare.map((codMedico, index) => () => processJob(codMedico, index)));

        // Completiamo e fermiamo le barre di progresso
        mainBar.update(100, { message: "PROCESSO COMPLETATO!" });
        multibar.stop();
    }


}
