import {Nar} from "./Nar.js";
import {Ts} from "./Ts.js";
import {utils} from "../Utils.js";
import path from "path";
import fs from "fs";
import AsyncLock from 'async-lock';
const lock = new AsyncLock();
import { EventEmitter } from 'events';

export class Assistiti {

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


    async #verificaDataDecessoDaTS(datiUtenti,closeBrowser = true,visibile = true) {
        let out = {error: false, data: {}};
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
                    await page.type("input[name='provinciaNascita']", dato.provincia_nascita);
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
                    console.log("codice fiscale: " + cf + " data decesso:" + (datiUtenti[cf].data_decesso ?? "non recuperabile"));
                }
            }
            await page.close();
        }
        await this._ts.doLogout(closeBrowser);
        return datiUtenti;
    }

    async verificaDatiAssititoDaNar(codiciFiscali,closeBrowser,visibile) {
        let out = {data: {}, nonTrovati: []};
        let page = await this._nar.getWorkingPage(visibile);
        if (page) {
            for (let cf of codiciFiscali) {
                try {
                    await page.goto("https://nar.regione.sicilia.it/NAR/mainMenu.do?ACTION=START&KEY=39100000113");
                    await page.waitForSelector("input[name='codiceFiscaleISISTP@Filter']");
                    await page.waitForTimeout(1000);
                    await page.type("input[name='codiceFiscaleISISTP@Filter']", cf);
                    await page.waitForSelector("#inside");
                    await page.click("#inside > table > tbody > tr > td:nth-child(2) > a");
                    await page.waitForSelector("#id1");
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
                        } catch (ex) {
                            dati.error = true;
                            dati.data = "error: " + ex.message + " " + ex.stack;
                            return dati;
                        }
                        return dati;
                    });
                    console.log(datiAssistito);
                    if (!datiAssistito.error) {
                        datiAssistito.data.cf = cf;
                        out.data[cf] = datiAssistito.data;
                    } else
                        out.nonTrovati.push(cf + "_su_nar");
                } catch (ex) {
                    out.nonTrovati.push(cf + "_su_nar");
                }
            }
            await page.close();
        }
        await this._nar.doLogout(closeBrowser);
        return out;
    }


    async verificaAssititiInVita(codiciFiscali, limit = null, inserisciIndirizzo = false,closeBrowser = true,visibile = true,index = 1) {
        let out = {error: false, out: {vivi: {}, nonTrovati: [], morti: []}}
        console.log("[" + index + "]" +" codici fiscali totali:" + codiciFiscali.length)
        if (codiciFiscali.length > 0) {
            let page = await this._ts.getWorkingPage(visibile);
            page.setDefaultTimeout(600000);
            if (page) {
                let i = 0;
                if (!out.error && codiciFiscali.length > 0) {
                    for (let codiceFiscale of codiciFiscali) {
                        i++;
                        await page.goto("https://sistemats4.sanita.finanze.it/simossAssistitiWeb/assistitiInit.do", {waitUntil: 'networkidle2'});
                        let datiAssistito = {};
                        try {
                            await page.type('body > div:nth-child(12) > form > fieldset > div:nth-child(2) > div.right_column.margin-right.width25 > input[type=text]', codiceFiscale);
                            await page.click('#go');
                            await page.waitForSelector("body > div:nth-child(12) > h1")
                            datiAssistito = await page.evaluate(() => {
                                let dati = {}
                                let vivo = null;
                                if (document.querySelector("body > div:nth-child(12) > div:nth-child(3) > div.cellaAss35.bold > div"))
                                    vivo = true;
                                else if (document.querySelector('body > div:nth-child(12) > div > fieldset > ul').innerHTML.toLowerCase().includes('deceduto'))
                                    vivo = false;
                                else if (document.querySelector('body > div:nth-child(12) > div > fieldset > ul').innerHTML.toLowerCase().includes('stato trovato'))
                                    vivo = null;
                                if (vivo !== null)
                                    dati.vivo = vivo;
                                dati.trovato = vivo !== null;
                                if (dati.trovato && vivo) {
                                    dati.vivo = vivo;
                                    dati.cognome = document.querySelector("body > div:nth-child(12) > div:nth-child(5) > div.cellaAss59 > div").innerText.trim();
                                    dati.nome = document.querySelector("body > div:nth-child(12) > div:nth-child(7) > div.cellaAss59 > div").innerText.trim();
                                    dati.sesso = document.querySelector("body > div:nth-child(12) > div:nth-child(9) > div.cellaAss59 > div").innerText.trim();
                                    dati.data_nascita = document.querySelector("body > div:nth-child(12) > div:nth-child(11) > div.cellaAss59 > div").innerText.trim();
                                    dati.comune_nascita = document.querySelector("body > div:nth-child(12) > div:nth-child(13) > div.cellaAss59 > div").innerText.trim();
                                    return dati;
                                }
                                return dati;
                            });
                        } catch (e) {
                            datiAssistito = {errore: true};
                        }

                        if (datiAssistito.trovato && datiAssistito.vivo) {
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
                                            try {
                                                return {
                                                    error: false,
                                                    indirizzo: document.querySelector("body > div:nth-child(13) > div:nth-child(14) > div.cellaAss65 > div").innerText.trim(),
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
                        } else if (!datiAssistito.vivo)
                            out.out.morti.push(codiceFiscale);
                        else
                            out.out.nonTrovati.push(codiceFiscale);
                        if (!datiAssistito.trovato || !datiAssistito.vivo) {
                            console.log("[" + index + "] " +codiceFiscale + " stato:" + (!datiAssistito.trovato ? " NON TROVATO" : (datiAssistito.vivo ? " VIVO" : " MORTO")))
                        }
                        if (limit)
                            if (i >= limit)
                                break;
                        // show progress
                        if (i % 10 === 0) {
                            console.log("[" + index + "] codici fiscali processati:" + i + " su " + codiciFiscali.length);
                            // show stats vivi, morti and non trovati
                            console.log("[" + index + "] vivi:" + Object.keys(out.out.vivi).length + ", morti:" + out.out.morti.length + ", non trovati:" + out.out.nonTrovati.length);
                        }
                    }
                }
            }
            await page.close();
        } else
            out = {error: true, out: "Nessun codice fiscale trovato"}
        await this._ts.doLogout(false);
        let dateDecesso = [];
        if (out.out.morti.length > 0) {
            let datiMorti = await this.verificaDatiAssititoDaNar(out.out.morti,closeBrowser,visibile);
            if (Object.values(datiMorti.data).length > 0)
                dateDecesso = await this.#verificaDataDecessoDaTS(datiMorti.data,closeBrowser,visibile);
        }
        out.out.morti = dateDecesso;
        return out;
    }

    // asssititi.json dati di input
    // jobstatus.json stato processo
    // output[codicemedico].json dati di output
    // output[codicemedico].xlsx dati di output in excel
    async verificaAssititiInVitaJobs(pathJob, outPath = "elaborazioni") {
        // create path if not exist outPath in pathJob
        if (!fs.existsSync(pathJob + path.sep + outPath))
            fs.mkdirSync(pathJob + path.sep + outPath);
        // get assititi.json in pathJob
        let datiAssititi = await utils.leggiOggettoDaFileJSON(pathJob + path.sep + "assistiti.json");
        // if !exist jobstatus.json create it
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
        // load jobstatus.json
        let jobStatus = await utils.leggiOggettoDaFileJSON(pathJob + path.sep + "jobstatus.json");
        // filter all jobs that have completo = false
        let jobsDaElaborare = Object.keys(jobStatus).filter((el) => !jobStatus[el].completo);
        for (let codMedico of jobsDaElaborare) {
            let ris = await this.verificaAssititiInVita(Object.keys(datiAssititi[codMedico].assistiti), null, false);
            await utils.scriviOggettoSuFile(pathJob + path.sep + outPath + path.sep + codMedico + ".json", {deceduti: ris.out.morti, nonTrovati: ris.out.nonTrovati});
            if (Object.keys(ris.out.morti).length > 0)
                await utils.scriviOggettoSuNuovoFileExcel(pathJob + path.sep + outPath + path.sep + codMedico + "_deceduti.xlsx", Object.values(ris.out.morti));
            if (ris.out.nonTrovati.length > 0)
                await utils.scriviOggettoSuNuovoFileExcel(pathJob + path.sep + outPath + path.sep + codMedico + "_nontrovati.xlsx", Object.values(ris.out.nonTrovati));
            // update jobstatus.json
            jobStatus[codMedico].elaborati = Object.keys(ris.out.vivi).length + Object.keys(ris.out.morti).length + ris.out.nonTrovati.length;
            jobStatus[codMedico].vivi = Object.keys(ris.out.vivi).length;
            jobStatus[codMedico].deceduti = Object.keys(ris.out.morti).length;
            jobStatus[codMedico].nonTrovati = ris.out.nonTrovati.length;
            jobStatus[codMedico].completo = true;
            jobStatus[codMedico].ok = (jobStatus[codMedico].elaborati === jobStatus[codMedico].totale);
            await utils.scriviOggettoSuFile(pathJob + path.sep + "jobstatus.json", jobStatus);
        }
    }



    async verificaAssititiInVitaParallelsJobs(pathJob, outPath = "elaborazioni",numOfParallelJobs = 10) {
        EventEmitter.defaultMaxListeners = 20;
         const processJob = async (codMedico,index) => {
             index = index +1;
             let ris = await this.verificaAssititiInVita(Object.keys(datiAssititi[codMedico].assistiti,true), null, false, false,false,index);

             const updateJobStatus = async (ris) => {
                 await utils.scriviOggettoSuFile(pathJob + path.sep + outPath + path.sep + codMedico + ".json", {
                     deceduti: ris.out.morti,
                     nonTrovati: ris.out.nonTrovati
                 });
                 if (Object.keys(ris.out.morti).length > 0)
                     await utils.scriviOggettoSuNuovoFileExcel(pathJob + path.sep + outPath + path.sep + codMedico + "_deceduti.xlsx", Object.values(ris.out.morti));
                 if (ris.out.nonTrovati.length > 0)
                     await utils.scriviOggettoSuNuovoFileExcel(pathJob + path.sep + outPath + path.sep + codMedico + "_nontrovati.xlsx", Object.values(ris.out.nonTrovati));
                 // update jobstatus.json
                 jobStatus[codMedico].elaborati = Object.keys(ris.out.vivi).length + Object.keys(ris.out.morti).length + ris.out.nonTrovati.length;
                 jobStatus[codMedico].vivi = Object.keys(ris.out.vivi).length;
                 jobStatus[codMedico].deceduti = Object.keys(ris.out.morti).length;
                 jobStatus[codMedico].nonTrovati = ris.out.nonTrovati.length;
                 jobStatus[codMedico].completo = true;
                 jobStatus[codMedico].ok = (jobStatus[codMedico].elaborati === jobStatus[codMedico].totale);
                 await utils.scriviOggettoSuFile(pathJob + path.sep + "jobstatus.json", jobStatus);
                 console.log("[" + index + "]" +" AGGIORNAMENTO JOB STATUS OK");
             };

             return lock.acquire('jobstatus.json', () => updateJobStatus(ris), (err, ret) => {
                 if (err) {
                     console.log("[" + index + "] errore elaborazione job:" + codMedico + " " + err.message + " " + err.stack);
                 }
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
        // get assititi.json in pathJob
        let datiAssititi = await utils.leggiOggettoDaFileJSON(pathJob + path.sep + "assistiti.json");
        // if !exist jobstatus.json create it
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
        // load jobstatus.json
        let jobStatus = await utils.leggiOggettoDaFileJSON(pathJob + path.sep + "jobstatus.json");
        // filter all jobs that have completo = false
        let jobsDaElaborare = Object.keys(jobStatus).filter((el) => !jobStatus[el].completo);
        await taskPool(numOfParallelJobs, jobsDaElaborare.map((codMedico, index) => () => processJob(codMedico, index)));
    }





}
