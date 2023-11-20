import {Nar} from "./Nar.js";
import {Ts} from "./Ts.js";
import {utils} from "../Utils.js";
import path from "path";
import fs from "fs";
import AsyncLock from 'async-lock';
const lock = new AsyncLock();
import {EventEmitter} from 'events';
import _ from 'lodash';

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


    async #verificaDataDecessoDaTS(datiUtenti, visibile = true, index = 1) {
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
                }
                console.log(index + "# -" + cf + " data decesso: " + (datiUtenti[cf].data_decesso ?? "NON RECUPERABILE"));
            }
        }
        await this._ts.doLogout();
        return datiUtenti;
    }

    async verificaDatiAssititoDaNar(codiciFiscali, visibile, index = 1) {
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
                        out.data[cf] = datiAssistito.data;
                    } else {
                        console.log("#" + index + " " + cf + " dati su NAR ERRORE");
                        out.nonTrovati.push(cf + "_su_nar");
                    }
                } catch (ex) {
                    out.nonTrovati.push(cf + "_su_nar");
                }
            }
        }
        await this._nar.doLogout();
        return out;
    }


    async verificaAssititiInVita(codiciFiscali, limit = null, inserisciIndirizzo = false, index = 1, visibile = true) {
        let out = {error: false, out: {vivi: {}, nonTrovati: [], morti: [], obsoleti: {}}}
        console.log("#" + index + " " + " TOTALI: " + codiciFiscali.length)
        if (codiciFiscali.length > 0) {
            let page = await this._ts.getWorkingPage(visibile);
            page.setDefaultTimeout(600000);
            if (page) {
                let i = 0;
                if (!out.error && codiciFiscali.length > 0) {
                    for (let codiceFiscale of codiciFiscali) {
                        let datiAssistito = {};
                        let obsoleto = false;
                        do {
                            obsoleto = false;
                            i++;
                            await page.goto("https://sistemats4.sanita.finanze.it/simossAssistitiWeb/assistitiInit.do", {waitUntil: 'networkidle2'});
                            try {
                                await page.type('body > div:nth-child(12) > form > fieldset > div:nth-child(2) > div.right_column.margin-right.width25 > input[type=text]', codiceFiscale);
                                await page.click('#go');
                                await page.waitForSelector("body > div:nth-child(12) > h1")
                                datiAssistito = await page.evaluate(() => {
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
                                        let ind = obsoleto ? 4 : 3
                                        dati.inAsp = document.querySelector("#menu_voci > ol").children.length > 2;
                                        dati.cf = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (ind) + ") > div.cellaAss59 > div").innerText.trim();
                                        dati.cognome = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (ind + 2) + ") > div.cellaAss59 > div").innerText.trim();
                                        dati.nome = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (ind + 4) + ") > div.cellaAss59 > div").innerText.trim();
                                        dati.sesso = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (ind + 6) + ") > div.cellaAss59 > div").innerText.trim();
                                        dati.data_nascita = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (ind + 8) + ") > div.cellaAss59 > div").innerText.trim();
                                        dati.comune_nascita = document.querySelector("body > div:nth-child(12) > div:nth-child(" + (ind + 10) + ") > div.cellaAss59 > div").innerText.trim();
                                        dati.obsoleto = obsoleto;
                                        dati.errore = false
                                        return dati;
                                    }
                                    return dati;
                                });
                            } catch (e) {
                                datiAssistito = {errore: true};
                            }
                            if (datiAssistito.obsoleto) {
                                if (!out.out.obsoleti.hasOwnProperty(codiceFiscale))
                                    out.out.obsoleti[codiceFiscale] = [];
                                let codFiscaleNuovo = datiAssistito.cf;
                                datiAssistito.cf = codiceFiscale;
                                out.out.obsoleti[codiceFiscale].push(datiAssistito);
                                datiAssistito.cf = codFiscaleNuovo;
                                codiceFiscale = codFiscaleNuovo;
                                obsoleto = true;
                                console.log("OBSOLETO, RITENTO");
                            }
                        }
                        while (obsoleto);
                        if (datiAssistito.trovato && datiAssistito.vivo) {
                            if (!datiAssistito.inAsp)
                                console.log("NON IN ASP!!");
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
        let dateDecesso = [];
        if (out.out.morti.length > 0) {
            let datiMorti = await this.verificaDatiAssititoDaNar(out.out.morti, visibile, index);
            if (Object.values(datiMorti.data).length > 0)
                dateDecesso = await this.#verificaDataDecessoDaTS(datiMorti.data, visibile, index);
        }
        out.out.morti = dateDecesso;
        return out;
    }

    static async verificaAssistitiParallels(impostazioniServizi,codiciFiscali, includiIndirizzo = false, numParallelsJobs = 10,visible = false) {
        EventEmitter.defaultMaxListeners = 40;
        let out = {error: false, out: {vivi: {}, nonTrovati: [], morti: [], obsoleti: {}}}
        let jobs = [];
        let jobSize = Math.ceil(codiciFiscali.length / numParallelsJobs);
        for (let i = 0; i < numParallelsJobs; i++) {
            let job = codiciFiscali.slice(i * jobSize, (i + 1) * jobSize);
            jobs.push(job);
        }
        let promises = [];
        for (let i = 0; i < jobs.length; i++) {
            let assistitiTemp = new Assistiti(impostazioniServizi);
            promises.push(assistitiTemp.verificaAssititiInVita(jobs[i], null, includiIndirizzo, i + 1, visible));
        }
        let results = await Promise.all(promises);
        for (let result of results) {
            out.error = out.error || result.error;
            out.out.vivi = {...out.out.vivi, ...result.out.vivi};
            out.out.nonTrovati = [...out.out.nonTrovati, ...result.out.nonTrovati];
            out.out.morti = [...out.out.morti, ...result.out.morti];
            out.out.obsoleti = {...out.out.obsoleti, ...result.out.obsoleti};
        }
        return out;
    }


    static async verificaAssititiInVitaParallelsJobs(impostazioniServizi, pathJob, outPath = "elaborazioni", numOfParallelJobs = 20, visibile = false) {
        EventEmitter.defaultMaxListeners = 40;
        const processJob = async (codMedico, index) => {
            index = (index % numOfParallelJobs) + 1;
            let assistiti = new Assistiti(impostazioniServizi);
            let ris = await assistiti.verificaAssititiInVita(Object.keys(datiAssititi[codMedico].assistiti, true), null, false, index, visibile);

            const updateJobStatus = async (ris) => {
                await utils.scriviOggettoSuFile(pathJob + path.sep + outPath + path.sep + codMedico + ".json", {
                    deceduti: ris.out.morti,
                    nonTrovati: ris.out.nonTrovati,
                    obsoleti: ris.out.obsoleti,
                });
                if (Object.keys(ris.out.morti).length > 0)
                    await utils.scriviOggettoSuNuovoFileExcel(pathJob + path.sep + outPath + path.sep + codMedico + "_deceduti.xlsx", Object.values(ris.out.morti));
                if (ris.out.nonTrovati.length > 0)
                    await utils.scriviOggettoSuNuovoFileExcel(pathJob + path.sep + outPath + path.sep + codMedico + "_nontrovati.xlsx", ris.out.nonTrovati, ["CF non trovati"]);
                // update jobstatus.json
                jobStatus[codMedico].elaborati = Object.keys(ris.out.vivi).length + Object.keys(ris.out.morti).length + ris.out.nonTrovati.length;
                jobStatus[codMedico].vivi = Object.keys(ris.out.vivi).length;
                jobStatus[codMedico].deceduti = Object.keys(ris.out.morti).length;
                jobStatus[codMedico].nonTrovati = ris.out.nonTrovati.length;
                jobStatus[codMedico].completo = true;
                jobStatus[codMedico].ok = (jobStatus[codMedico].elaborati === jobStatus[codMedico].totale);
                await utils.scriviOggettoSuFile(pathJob + path.sep + "jobstatus.json", jobStatus);
                console.log("[" + index + "]" + " AGGIORNAMENTO JOB STATUS OK");
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
        // verifica non trovati
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
                // remove all files that starts with "codiceMedico*" from pathJob + path.sep + outPath
                let files = fs.readdirSync(pathJob + path.sep + outPath);
                for (let file of files) {
                    if (file.startsWith(codiceMedico))
                        fs.unlinkSync(pathJob + path.sep + outPath + path.sep + file);
                }
                modifica = true;
                console.log("[" + codiceMedico + "] " + "RIMOSSO PER TROPPI NON TROVATI");
            }
            if (modifica)
                await utils.scriviOggettoSuFile(pathJob + path.sep + "jobstatus.json", jobStatus);
        }
        // filter all jobs that have completo = false
        let jobsDaElaborare = Object.keys(jobStatus).filter((el) => !jobStatus[el].completo);
        await taskPool(numOfParallelJobs, jobsDaElaborare.map((codMedico, index) => () => processJob(codMedico, index)));
        console.log("PROCESSO COMPLETATO!");
    }


}
