import {utils, utils as Utils} from "./Utils.js";
import path, {parse} from "path";
import {Medici} from "./narTsServices/Medici.js";
import {Assistiti} from "./narTsServices/Assistiti.js";
import moment from "moment";
import knex from "knex";
import fs from "fs";
import sqlite3 from 'sqlite3';
import {Nar} from "./narTsServices/Nar.js";
import _ from "lodash";


class Procedure {

    static async getOggettiMediciDistretto(impostazioniServizi, pathFileExcelMediciPediatri, distretti, workingPath = null, soloAttivi = false, tipologia = [Medici.MEDICO_DI_BASE_FILE, Medici.PEDIATRA_FILE], colonnaInizioRapporto = "Data inizio rapporto", colonnaFineRapporto = "Data fine rapporto", colonnaNomeCognome = "Cognome e Nome", colonnaStato = "Stato", colonnaAsl = "ASL", colonnaCodRegionale = "Cod. regionale", colonnaCodFiscale = "Cod. fiscale", colonnaCategoria = "Categoria", colonnaDistretto = "Ambito", colonnaMassimale = "Mas.") {
        let datiMediciPediatriCompleto = await Utils.getObjectFromFileExcel(pathFileExcelMediciPediatri);
        let codToCfDistrettoMap = {};
        let mediciPerDistretto = {};
        for (let dato of datiMediciPediatriCompleto) {
            // find any of distretti keyword in string dato[colonnaDistretto]
            let distretto = distretti.filter(distrettoKeyword =>
                dato[colonnaDistretto]?.toLowerCase().includes(distrettoKeyword.toLowerCase())
            );
            let cfM = dato[colonnaCodFiscale].toString();
            let codReg = dato[colonnaCodRegionale];
            let nomeCogn = dato[colonnaNomeCognome];
            if (distretto.length === 0)
                distretto = ['ND'];
            if (tipologia.includes(dato[colonnaCategoria]) && (!soloAttivi || !dato.hasOwnProperty(colonnaFineRapporto)))
                codToCfDistrettoMap[codReg] = {
                    cod_regionale: codReg,
                    asl: dato[colonnaAsl],
                    distretto: distretto[0],
                    ambito: dato[colonnaDistretto] ?? "ND",
                    nome_cognome: nomeCogn,
                    cf: cfM,
                    tipologia: dato[colonnaCategoria],
                    stato: dato[colonnaStato],
                    dataInizioRapporto: dato[colonnaInizioRapporto],
                    dataFineRapporto: dato[colonnaFineRapporto],
                    massimale: dato[colonnaMassimale]
                };
            // medici per distretto
            if (!mediciPerDistretto.hasOwnProperty(distretto[0]))
                mediciPerDistretto[distretto[0]] = [];
            mediciPerDistretto[distretto[0]].push({
                cod_regionale_medico: codReg,
                cf_medico: cfM,
                nome_cognome_medico: nomeCogn,
                ambito: dato[colonnaDistretto] ?? "ND",
            });
        }
        return {codToCfDistrettoMap: codToCfDistrettoMap, mediciPerDistretto: mediciPerDistretto};
    }

    static async getAssistitiFileFromNar(impostazioniServizi, pathFilePdf, codToCfDistrettoMap, distretti, workingPath = null, nomeFile = "assistitiNar.json",) {
        if (workingPath == null)
            workingPath = await Utils.getWorkingPath();
        let medici = new Medici(impostazioniServizi);

        if (!fs.existsSync(workingPath + path.sep + nomeFile)) {
            let allAssistiti = await medici.getAssistitiDaListaPDF(pathFilePdf, codToCfDistrettoMap);
            await Utils.scriviOggettoSuFile(workingPath + path.sep + "assistitiNar.json", allAssistiti);
        }
        // load all assistiti
        let assistiti = await Utils.leggiOggettoDaFileJSON(workingPath + path.sep + "assistitiNar.json");
        let countAssistiti = 0;
        for (let mmg of Object.keys(assistiti))
            countAssistiti += assistiti[mmg].assistiti.length;
        console.log("ASSISTITI NAR: " + countAssistiti);
        return assistiti;
    }


    /**
     * Ottiene gli assistiti dal sistema TS.
     *
     * @param {Object} impostazioniServizi - Impostazioni dei servizi.
     * @param {Object} codToCfDistrettoMap - Mappa dei codici regionali ai codici fiscali e distretti.
     * @param {{workingPath: null, parallels: number, visibile: boolean}} [config={}] - Configurazione opzionale.
     * @param {string} [config.workingPath=null] - Percorso di lavoro.
     * @param {string} [config.nomeFile="assistitiTS.json"] - Nome del file.
     * @param {number} [config.parallels=20] - Numero di job paralleli.
     * @param {boolean} [config.visibile=false] - Se rendere visibile il processo.
     * @param {Object} [config.callback={fn: null, params: {}}] - Callback.
     */
    static async getAssistitiFromTs(impostazioniServizi, codToCfDistrettoMap, config = {}) {
        let {
            workingPath = null,
            nomeFile = "assistitiTS.json",
            parallels = 20,
            visibile = false,
            callback = {
                fn: null,
                params: {}
            }
        } = config;

        if (workingPath == null)
            workingPath = await Utils.getWorkingPath();
        if (!fs.existsSync(workingPath + path.sep + nomeFile)) {
            let temp = await Medici.getElencoAssistitiFromTsParallels(Object.keys(codToCfDistrettoMap), codToCfDistrettoMap, impostazioniServizi,
                {
                    numParallelsJobs: parallels,
                    visibile: visibile
                });
            await Utils.scriviOggettoSuFile(workingPath + path.sep + nomeFile, temp);
        }
    }

    static async #getDifferenzeAssistitiNarTs(mediciPerDistretto, codToCfDistrettoMap, pathAssistitiPdfNar, impostazioniServizi, distretti, workingPath = null, soloAttivi = false, parallels = 20, visibile = false) {

        await Procedure.getAssistitiFileFromNar(impostazioniServizi, pathAssistitiPdfNar, codToCfDistrettoMap, distretti, workingPath);
        await Procedure.getAssistitiFromTs(impostazioniServizi, codToCfDistrettoMap, {
            workingPath: workingPath,
            parallels: parallels,
            visibile: visibile
        });

        // per codice regionale
        let assistitiNar = await Utils.leggiOggettoDaFileJSON(workingPath + path.sep + "assistitiNar.json");
        //per codice fiscale
        let assistitiTs = await Utils.leggiOggettoDaFileJSON(workingPath + path.sep + "assistitiTs.json");

        // SALVA FILE NAR E TS PER DISTRETTO
        let allAssistitiDistrettuali = {};
        for (let distretto of Object.keys(mediciPerDistretto)) {
            allAssistitiDistrettuali[distretto] = {nar: [], ts: [], codRegNar: {}, codRegTs: {}};
            for (let medico of mediciPerDistretto[distretto]) {
                let codReg = medico.cod_regionale_medico;
                if (assistitiNar.hasOwnProperty(codReg)) {
                    for (let assistito of assistitiNar[codReg].assistiti) {
                        allAssistitiDistrettuali[distretto].nar.push({...assistito, ...medico});
                    }
                    for (let assistito of assistitiTs[codReg]) {
                        allAssistitiDistrettuali[distretto].ts.push({...assistito, ...medico});
                    }
                    allAssistitiDistrettuali[distretto].codRegNar[codReg] = assistitiNar[codReg].assistiti;
                    allAssistitiDistrettuali[distretto].codRegTs[codReg] = assistitiTs[codReg];
                }
            }
        }

        if (!fs.existsSync(workingPath + path.sep + "differenze"))
            fs.mkdirSync(workingPath + path.sep + "differenze");

        let medici = new Medici(impostazioniServizi);
        let allDifferenze = [];
        for (let distretto of Object.keys(allAssistitiDistrettuali)) {
            console.log("DISTRETTO " + distretto);
            if (!fs.existsSync(workingPath + path.sep + "differenze" + path.sep + distretto))
                fs.mkdirSync(workingPath + path.sep + "differenze" + path.sep + distretto);

            await Utils.scriviOggettoSuNuovoFileExcel(workingPath + path.sep + "differenze" + path.sep + distretto + path.sep + "assistitiNar.xlsx", allAssistitiDistrettuali[distretto].nar);
            await Utils.scriviOggettoSuNuovoFileExcel(workingPath + path.sep + "differenze" + path.sep + distretto + path.sep + "assistitiTs.xlsx", allAssistitiDistrettuali[distretto].ts);

            // VERIFICA DIFFERENZE
            let differenze = medici.getAllDifferenzeAnagrafiche(allAssistitiDistrettuali[distretto], codToCfDistrettoMap, distretti[distretto]);
            await Utils.scriviOggettoSuFile(workingPath + path.sep + "differenze" + path.sep + distretto + path.sep + "differenze.json", differenze);
            let allDettaglioDifferenze = [];
            for (let codReg in differenze) {
                allDettaglioDifferenze.push(...differenze[codReg].dettaglioDifferenze);
            }
            allDifferenze.push(...allDettaglioDifferenze);
            await Utils.scriviOggettoSuNuovoFileExcel(workingPath + path.sep + "differenze" + path.sep + distretto + path.sep + "differenze.xlsx", allDettaglioDifferenze);
        }
        await Utils.scriviOggettoSuNuovoFileExcel(workingPath + path.sep + "differenze" + path.sep + "allDifferenze.xlsx", allDifferenze);


    }

    static async getControlliEsenzione(pathElenco, colonnaProtocolli, colonnaEsenzione, anno, arrayEsenzioni, impostazioniServizi, workingPath = null, parallels = 50, maxItemPerJob = 50, includiPrestazioni = true, visibile = false) {
        let risultato = {};
        do {
            let datiRecupero = null;
            if (fs.existsSync(workingPath + path.sep + anno + ".json")) {
                datiRecupero = await Utils.leggiOggettoDaFileJSON(workingPath + path.sep + anno + ".json");
            } else {
                datiRecupero = await Utils.getObjectFromFileExcel(pathElenco);
                let protTemp = {};
                for (let dato of datiRecupero) {
                    if (!Object.hasOwnProperty(dato[colonnaProtocolli]))
                        if (arrayEsenzioni.includes(dato[colonnaEsenzione].trim().toUpperCase()))
                            protTemp[dato[colonnaProtocolli]] = null;
                }
                datiRecupero = protTemp;
                await Utils.scriviOggettoSuFile(workingPath + path.sep + anno + ".json", datiRecupero);
            }
            risultato = await Assistiti.controlliEsenzioneAssistitoParallels(
                impostazioniServizi,
                datiRecupero,
                arrayEsenzioni,
                anno,
                workingPath,
                parallels,
                maxItemPerJob,
                includiPrestazioni,
                visibile);
        } while (risultato.out.error === true)
        console.log("FINE " + anno);
        return 0;
    }

    static async generaDbSqliteDaElencoAssistiti(pathFileAssistitiNar, pathFileAssistitiTs, nomeDb = "assistiti.db", workingPath = null) {
        const insertDb = (sql, params) => {
            return new Promise((resolve, reject) => {
                db.run(sql, params, function (err) {
                    if (err) {
                        reject(err.message);
                    } else {
                        resolve(this.lastID);
                    }
                });
            });
        };
        const getFromDb = (sql, params) => {
            return new Promise((resolve, reject) => {
                db.all(sql, params, function (err, rows) {
                    if (err) {
                        reject(err.message);
                    } else {
                        resolve(rows);
                    }
                });
            });
        }

        if (workingPath == null)
            workingPath = await Utils.getWorkingPath();
        // leggi i dati
        let datiAssistitiTs = await Utils.leggiOggettoDaFileJSON(workingPath + path.sep + pathFileAssistitiTs);
        let datiAssistitiNar = await Utils.leggiOggettoDaFileJSON(workingPath + path.sep + pathFileAssistitiNar);
        // Crea un nuovo database SQLite (o apre uno esistente)
        let db = await new sqlite3.Database(workingPath + path.sep + nomeDb);

        await db.run('CREATE TABLE IF NOT EXISTS medico (codice_regionale TEXT PRIMARY KEY, cf TEXT UNIQUE, nominativo TEXT, mail TEXT, telefono TEXT, distretto TEXT)');
        await db.run('CREATE TABLE IF NOT EXISTS assistito (codice_fiscale TEXT PRIMARY KEY, codice_regionale_ts TEXT, codice_regionale_nar TEXT, FOREIGN KEY(codice_regionale_ts) REFERENCES medico(codice_regionale), FOREIGN KEY(codice_regionale_nar) REFERENCES medico(codice_regionale))');
        let i = 0;
        let count = Object.keys(datiAssistitiNar).length;
        let errori = [];
        for (let dato of Object.values(datiAssistitiNar)) {
            i++;
            console.log("FASE 1: Elaborazione " + i + " di " + count);
            let sql = `INSERT INTO medico(codice_regionale, cf, nominativo, distretto)
                       VALUES (?, ?, ?, ?)`;
            let params = [dato.medico.codice, dato.medico.cf, dato.medico.nominativo, dato.medico.distretto];
            let id = await insertDb(sql, params);
            for (let assistito of dato.assistiti) {
                let sql = `SELECT *
                           FROM assistito
                           WHERE codice_fiscale = ?`;
                let params = [assistito.codiceFiscale];
                let rows = await getFromDb(sql, params);

                if (rows.length === 0) {
                    let sql = `INSERT INTO assistito(codice_fiscale, codice_regionale_nar)
                               VALUES (?, ?)`;
                    let params = [assistito.codiceFiscale, dato.medico.codice];
                    let id = await insertDb(sql, params);
                } else {
                    errori.push({...assistito, medico: dato.medico});
                }
            }
        }
        // write errori on file
        await Utils.scriviOggettoSuFile(workingPath + path.sep + "erroriNar.json", errori);
        i = 0;
        count = Object.keys(datiAssistitiTs).length;
        for (let codReg in datiAssistitiTs) {
            i++;
            console.log("FASE 2: Elaborazione " + i + " di " + count + " cod reg " + codReg);
            let dato = datiAssistitiTs[codReg];
            if (dato) {
                for (let riga of dato) {
                    // verifica se esiste l'assisito
                    let sql = `SELECT *
                               FROM assistito
                               WHERE codice_fiscale = ?`;
                    let params = [riga.cf];
                    let rows = await getFromDb(sql, params);

                    if (rows.length === 0) {
                        let sql = `INSERT INTO assistito(codice_fiscale, codice_regionale_ts)
                                   VALUES (?, ?)`;
                        let params = [riga.cf, codReg];
                        let id = await insertDb(sql, params);
                    } else {
                        let sql = `UPDATE assistito
                                   SET codice_regionale_ts = ?
                                   WHERE codice_fiscale = ?`;
                        let params = [codReg, riga.cf];
                        let id = await insertDb(sql, params);
                    }
                }
            }
        }

        // Chiudi il database
        await db.close();
    }

    /**
     * Analizza le mensilità di un medico in un determinato periodo.
     *
     * @param {string} matricola - Codice identificativo del medico.
     * @param {Object} impostazioniServizi - Configurazione dei servizi necessari per l'analisi.
     * @param {number} daMese - Mese di inizio dell'analisi (1-12).
     * @param {number} daAnno - Anno di inizio dell'analisi.
     * @param {number} aMese - Mese di fine dell'analisi (1-12).
     * @param {number} aAnno - Anno di fine dell'analisi.
     * @param {Object} [config={}] - Configurazione opzionale dell'analisi.
     * @param {boolean} [config.visibile=false] - Se rendere visibile il processo di analisi.
     * @param {boolean} [config.singoloCedolino=false] - Se analizzare un singolo cedolino.
     * @param {string|null} [config.workingPath=null] - Path di lavoro per l'output dell'analisi.
     * @param {string[]} [config.conteggioVoci=["CM0020"]] - Codici delle voci da conteggiare.
     * @returns {Promise<void>}
     */
    static async analizzaMensilitaMedico(matricola, impostazioniServizi, daMese, daAnno, aMese, aAnno, config = {}) {
        let {
            visibile = false,
            singoloCedolino = false,
            workingPath = null,
            conteggioVoci = ["CM0020"],
        } = config;

        process.setMaxListeners(0);
        let da = moment(daAnno + "-" + daMese + "-01", "YYYY-MM-DD");
        let a = moment(aAnno + "-" + aMese + "-01", "YYYY-MM-DD");
        let medici = new Medici(impostazioniServizi, visibile, workingPath, true, Nar.PAGHE);

        let outFinal = [];
        let outDettaglioMese = [];
        do {
            let out = await medici.stampaCedolino(matricola, visibile, da.month() + 1, da.year(), !singoloCedolino ? (da.month() + 1) : (a.month() + 1), !singoloCedolino ? da.year() : a.year(), singoloCedolino);
            let out2 = await medici.analizzaBustaPaga(matricola, da.month() + 1, da.year(), !singoloCedolino ? (da.month() + 1) : (a.month() + 1), !singoloCedolino ? da.year() : a.year(), singoloCedolino);
            const bustakey = da.year().toString() + "-" + (da.month() + 1).toString().padStart(2, '0');
            let outData = {};
            for (let conteggioVoce of conteggioVoci) {
                outData["cedolino"] = bustakey;
                outData["voce"] = conteggioVoce;
                outData["descrizione"] = out2.data.voci[conteggioVoce].descrizioneVoce;
                outData["dal"] = out2.data.voci[conteggioVoce].dal;
                outData["al"] = out2.data.voci[conteggioVoce].al;
                outData["quanti"] = parseFloat(out2.data.voci[conteggioVoce].quanti.replaceAll(",", ""))
                outData['importoUnitario'] = parseFloat(out2.data.voci[conteggioVoce].importoUnitario)
                outData['competenza'] = parseFloat(out2.data.voci[conteggioVoce].competenza.replaceAll(",", ""))
                outData['trattenuta'] = out2.data.voci[conteggioVoce].trattenuta === "" ? out2.data.voci[conteggioVoce].trattenuta : parseFloat(out2.data.voci[conteggioVoce].trattenuta.replaceAll(",", ""))
                let ok = false;
                for (let riga of out2.data.voci[conteggioVoce].dettaglio.splitted) {
                    if (riga.startsWith("periodo"))
                        ok = true;
                    else if (riga.startsWith("tot"))
                        break;
                    else if (ok) {
                        let splitted2 = riga.split("\t");
                        outDettaglioMese.push({
                            cedolino: bustakey,
                            mese: utils.meseNumero[splitted2[0].split(" ")[0]],
                            anno: parseInt(splitted2[0].split(" ")[1]),
                            quantita: parseInt(splitted2[2]),
                            importoUnitario: parseFloat(splitted2[3].replaceAll(",", ".")),
                            importo: parseFloat(splitted2[4].replaceAll(".", ",").replaceAll(",", "."))
                        });
                    }
                }
            }
            if (Object.values(outData) >0)
                outFinal.push(outData);
            da = da.add(1, "month");
        } while (da.isSameOrBefore(a) && !singoloCedolino);
        if (Object.values(outFinal).length > 0)
            await utils.scriviOggettoSuNuovoFileExcel(medici._nar.getWorkingPath() + path.sep + "cedolino_report_" + matricola + "_da_" + daAnno + daMese + "_a_" + aAnno + aMese + ".xlsx", outFinal);
        if (outDettaglioMese.length > 0)
            await utils.scriviOggettoSuNuovoFileExcel(medici._nar.getWorkingPath() + path.sep + "cedolino_dettaglio-report_" + matricola + "_da_" + daAnno + daMese + "_a_" + aAnno + aMese + ".xlsx", Object.values(outDettaglioMese));
    }

    static async generaDbMysqlDaFilePrestazioni(pathFilePrestazioni, datiDb, anno, cancellaDb = true) {
        const db = knex({
            client: 'mysql',
            connection: datiDb
        });
        let datiPrestazioni = await Utils.leggiOggettoDaFileJSON(pathFilePrestazioni);
        if (cancellaDb) {
        }
        for (let protocollo of Object.keys(datiPrestazioni)) {
            let rigaProtocollo = datiPrestazioni[protocollo];
            let prot = await db("protocollo").insert({
                protocollo: protocollo,
                anno: anno,
                cf_esente: rigaProtocollo.cfEsente,
                cf_dichiarante: rigaProtocollo.cfDichiarante,
                cf_titolare: rigaProtocollo.cfTitolare,
                esenzione: rigaProtocollo.esenzione,
                data_inizio: rigaProtocollo.dataInizio,
                data_fine: rigaProtocollo.dataFine,
                esito: rigaProtocollo.esito,
                descrizione: rigaProtocollo.descrizione,
                importo_totale: parseFloat(rigaProtocollo.ricette.totaleGlobale.toString()).toFixed(2),

            });
            // get id of prot
            for (let tipoRicetta of Object.keys(rigaProtocollo.ricette.dettaglio)) {
                for (let ricetta of rigaProtocollo.ricette.dettaglio[tipoRicetta].dettaglio) {
                    let idRicetta = await db("ricetta").insert({
                        numero: ricetta.ricetta,
                        tipologia: tipoRicetta === "ricette_specialistiche" ? "specialistica" : "farmaceutica",
                        struttura: ricetta.struttura,
                        ubicazione: ricetta.ubicazione,
                        data_prescrizione: ricetta.data_prescrizione,
                        data_spedizione: ricetta.data_spedizione,
                        ticket: parseFloat(ricetta.ticket).toFixed(2),
                        id_protocollo: prot[0],
                    })
                    if (ricetta.hasOwnProperty("prestazioni") && ricetta.prestazioni.hasOwnProperty("dettaglio"))
                        for (let prestazione of ricetta.prestazioni.dettaglio) {
                            let idPrestazione = await db("prestazione").insert({
                                regione: prestazione.regione,
                                data_erogazione: prestazione.data_erogazione,
                                quantita: prestazione.quantita,
                                codice_prodotto: prestazione.codice_prodotto,
                                descrizione: prestazione.descrizione,
                                tariffa: prestazione.tariffa,
                                id_ricetta: idRicetta[0],
                            })
                        }
                }
            }
            console.log("protocollo " + protocollo + " inserito");
        }
        return 0;
    }

    static async riapriAssistitiMMG(impostazioniServizi, pathExcelMedici, distretti, workingPath = null, visibile = false, numParallelsJob = 4, nomeFilePdfAssistiti = "assistiti.pdf") {
        if (workingPath == null)
            workingPath = await Utils.getWorkingPath();
        let medici = new Medici(impostazioniServizi);
        let {codToCfDistrettoMap, mediciPerDistretto} = await Procedure.getOggettiMediciDistretto(
            impostazioniServizi,
            pathExcelMedici,
            Object.keys(distretti),
            workingPath);
        let allAssistiti = await medici.getAssistitiDaListaPDF(workingPath + path.sep + nomeFilePdfAssistiti, codToCfDistrettoMap);
        for (let codNar in allAssistiti) {
            let allJobs = [];
            let i = 0;
            let count = allAssistiti[codNar].assistiti.length;
            let numPerJob = Math.ceil(count / numParallelsJob);
            let allAssititi = allAssistiti[codNar].assistiti;
            //filp array
            //allAssititi = allAssititi.reverse();
            while (i < numParallelsJob) {
                let assistiti = new Assistiti(impostazioniServizi, visibile);
                let slice = allAssititi.slice(i * numPerJob, (i + 1) * numPerJob);
                //await assistiti.apriMMGAssistiti(codNar, allAssistiti[codNar].assistiti);
                allJobs.push(assistiti.apriMMGAssistiti(codNar, slice, i + 1, visibile));
                i++;
            }
            let results = await Promise.all(allJobs);
            allJobs = null;
        }
    }


    /**
     * Esegue le verifiche periodiche dei deceduti tra gli assistiti dei medici.
     *
     * @param {Object} impostazioniServizi - Impostazioni per la connessione ai servizi.
     * @param {string} pathExcelMedici - Percorso del file Excel contenente l'elenco dei medici.
     * @param {Object} distretti - Oggetto contenente i distretti da verificare.
     * @param {string} dataQuote - Data di riferimento per il calcolo delle quote.
     * @param {Object} [config={}] - Configurazione opzionale.
     * @param {string} [config.nomeFilePdfAssistiti="assistiti.pdf"] - Nome del file PDF degli assistiti.
     * @param {string} [config.cartellaElaborazione="elaborazioni"] - Nome della cartella per le elaborazioni.
     * @param {number} [config.numParallelsJobs=10] - Numero di job paralleli da eseguire.
     * @param {boolean} [config.visibile=false] - Se mostrare i processi in esecuzione.
     * @param {string} [config.workingPath] - Percorso di lavoro personalizzato.
     * @returns {Promise<void>}
     */
    static async eseguiVerifichePeriodicheDecedutiAssistitiMedici(impostazioniServizi, pathExcelMedici, distretti, dataQuote, config = {}) {
        let {
            nomeFilePdfAssistiti = "assistiti.pdf",
            cartellaElaborazione = "elaborazioni",
            numParallelsJobs = 10,
            visibile = false,
            workingPath = await Utils.getWorkingPath()
        } = config;


        let medici = new Medici(impostazioniServizi);
        let {codToCfDistrettoMap, mediciPerDistretto} = await Procedure.getOggettiMediciDistretto(
            impostazioniServizi,
            pathExcelMedici,
            Object.keys(distretti),
            workingPath);

        await Procedure.getAssistitiFileFromNar(impostazioniServizi, workingPath + path.sep + nomeFilePdfAssistiti, codToCfDistrettoMap, Object.keys(distretti), workingPath);

        await Assistiti.verificaAssititiInVitaParallelsJobs(
            impostazioniServizi,
            workingPath, {
                outPath: cartellaElaborazione,
                numParallelsJobs,
                visibile
            });

        await medici.creaElenchiDeceduti(codToCfDistrettoMap, workingPath, distretti, dataQuote);

        await Procedure.getAssistitiFromTs(impostazioniServizi, codToCfDistrettoMap, {
            workingPath: workingPath,
            parallels: numParallelsJobs,
            visibile: visibile
        });

        await Procedure.#getDifferenzeAssistitiNarTs(
            mediciPerDistretto,
            codToCfDistrettoMap,
            workingPath + path.sep + nomeFilePdfAssistiti,
            impostazioniServizi,
            distretti,
            workingPath)
    }

    static async verificaDatiAssistitiDaFileNar(impostazioniServizi, fileAssistiti, pathExcelMedici, distretti, workingPath = null) {

        let out = {};

        if (workingPath == null)
            workingPath = await Utils.getWorkingPath();
        let medici = new Medici(impostazioniServizi);
        let {codToCfDistrettoMap, mediciPerDistretto} = await Procedure.getOggettiMediciDistretto(
            impostazioniServizi,
            pathExcelMedici,
            Object.keys(distretti),
            workingPath);
        let allAssistiti = await medici.getAssistitiDaListaPDF(fileAssistiti, codToCfDistrettoMap);
        for (let codNar in allAssistiti) {
            let allCodiciFiscali = allAssistiti[codNar].assistiti.map(assistito => assistito.codiceFiscale);
            // put in allCodiciFiscali the first 20 codici fiscali
            allCodiciFiscali = allCodiciFiscali.slice(0, 4);
            let assistiti = await Assistiti.verificaDatiAssistitiNarParallels(impostazioniServizi, allCodiciFiscali, true, 1, false);
            // write data to excel
            await Utils.scriviOggettoSuNuovoFileExcel(workingPath + path.sep + "assistiti_" + codNar + ".xlsx", assistiti.out.dati);
            await Utils.scriviOggettoSuNuovoFileExcel(workingPath + path.sep + "assistitiNonTrovati_" + codNar + ".xlsx", assistiti.out.nonTrovati);
            let storicoMMGOut = [];
            for (let cf in assistiti.storicoMMG) {
                for (let row of assistiti.storicoMMG[cf]) {
                    row.cf = cf;
                    storicoMMGOut.push(row);
                }
            }
            await Utils.scriviOggettoSuNuovoFileExcel(workingPath + path.sep + "storicoMMGAssistiti_" + codNar + ".xlsx", storicoMMGOut);
        }

    }

    /**
     * Verifica gli assistiti in parallelo.
     *
     * @param {string} fileExcel - File Excel con gli assistiti.
     * @param {Object} impostazioniServizi - Impostazioni dei servizi.
     * @param {string} [colonnaCf="cf"] - Colonna del codice fiscale
     * @param {Object} [config={}] - Configurazione opzionale.
     * @param {boolean} [config.includiIndirizzo=true] - Se includere l'indirizzo.
     * @param {number} [config.numParallelsJobs=10] - Numero di job paralleli.
     * @param {boolean} [config.visibile=false] - Se rendere visibile il processo.
     * @param {boolean} [config.legacy=false] - Se utilizzare la modalità legacy.
     * @param {Object} [config.datiMedicoNar=null] - Dati del medico NAR.
     * @param {Object} [config.dateSceltaCfMap=null] - Mappa delle date di scelta CF.
     * @param {boolean} [config.sogei=true] - Se utilizzare SOGEI.
     * @param {boolean} [config.nar2=false] - Se utilizzare NAR2.
     * @param {boolean} [config.salvaFile=true] - Se salvare eventuali file
     * @returns {Promise<Object>} - Risultato della verifica.
     */
    static async verificaDecessiDaFileExcel(fileExcel, impostazioniServizi, config = {}, colonnaCf = "cf",) {
        const outConfig = utils.getFinalConfigFromTemplate(config);
        let assistiti = await Utils.getObjectFromFileExcel(fileExcel);
        let cfs = [];
        for (let assistito of assistiti) {
            if (assistito[colonnaCf] !== undefined && assistito[colonnaCf] !== null && assistito[colonnaCf] !== "")
                cfs.push(assistito[colonnaCf]);
        }
        let ris = await Assistiti.verificaAssistitiParallels(impostazioniServizi, cfs, outConfig);
        console.log("FINE VERIFICA");
        if (outConfig.salvaFile) {
            let parentFolder = path.dirname(fileExcel);
            await Utils.scriviOggettoSuNuovoFileExcel(parentFolder + path.sep + "vivi.xlsx", Object.values(ris.out.vivi));
            await Utils.scriviOggettoSuNuovoFileExcel(parentFolder + path.sep + "morti.xlsx", Object.values(ris.out.morti));
            if (ris.out.nonTrovati.length > 0)
                await Utils.scriviOggettoSuNuovoFileExcel(parentFolder + path.sep + "nonTrovati.xlsx", ris.out.nonTrovati);
            console.log("FILE SALVATI");
        }
    }

    static async raggruppaDecedutiFile(folterPath) {
        let allMorti = [];
        let folderDepth = folterPath.split(path.sep).length;
        let allMortiFiles = utils.getAllFilesRecursive(folterPath, ".xlsx", "morti");
        for (let file of allMortiFiles) {
            let morti = await Utils.getObjectFromFileExcel(file);
            // for each morto add the first folder name after path (not the least) only the first,
            for (let morto of morti) {
                morto.distretto = file.split(path.sep)[folderDepth];
                allMorti.push(morto);
            }
        }
        await Utils.scriviOggettoSuNuovoFileExcel(folterPath + path.sep + "allMorti.xlsx", allMorti);
    }

    static async creaDatabaseAssistitiNarTs(impostazioniServizi, pathExcelMedici, distretti, connData, workingPath = null, reverse = false, numParallelsJobs = 30, visibile = false, nomeFilePdfAssistiti = "assistiti.pdf", cartellaElaborazione = "elaborazioniDB") {
        if (workingPath == null)
            workingPath = await Utils.getWorkingPath();

        let {codToCfDistrettoMap, mediciPerDistretto} = await Procedure.getOggettiMediciDistretto(
            impostazioniServizi,
            pathExcelMedici,
            Object.keys(distretti),
            workingPath);

        let allCfMediciNarMap = {}
        for (let codMedico in codToCfDistrettoMap)
            allCfMediciNarMap[codToCfDistrettoMap[codMedico].cf] = codToCfDistrettoMap[codMedico];

        const db = knex({
            client: 'mysql',
            connection: connData
        });

        for (let codMedico in codToCfDistrettoMap) {
            let datiMedico = codToCfDistrettoMap[codMedico];
            // check if medico is already in db
            let rows = await db("medici").where("codice_fiscale", datiMedico.cf);
            if (rows.length === 0) {
                await db("medici").insert({
                    codice_fiscale: datiMedico.cf,
                    cod_regionale: datiMedico.cod_regionale,
                    nome_cognome: datiMedico.nome_cognome,
                    asl: datiMedico.asl,
                    distretto: distretti[datiMedico.distretto],
                    ambito: datiMedico.ambito,
                    tipologia: datiMedico.tipologia,
                    stato: datiMedico.stato,
                    data_inizio_rapporto: datiMedico.dataInizioRapporto,
                    data_fine_rapporto: datiMedico.dataFineRapporto,
                    massimale: datiMedico.massimale,
                    ultimo_aggiornamento: moment().format("YYYY-MM-DD HH:mm:ss")
                });
            } else {
                await db("medici").where("codice_fiscale", datiMedico.cf).update({
                    cod_regionale: datiMedico.cod_regionale,
                    nome_cognome: datiMedico.nome_cognome,
                    asl: datiMedico.asl,
                    distretto: distretti[datiMedico.distretto],
                    ambito: datiMedico.ambito,
                    tipologia: datiMedico.tipologia,
                    stato: datiMedico.stato,
                    data_inizio_rapporto: datiMedico.dataInizioRapporto,
                    data_fine_rapporto: datiMedico.dataFineRapporto,
                    massimale: datiMedico.massimale,
                    ultimo_aggiornamento: moment().format("YYYY-MM-DD HH:mm:ss")
                });
            }
        }


        let assistitiNar = await Procedure.getAssistitiFileFromNar(impostazioniServizi, workingPath + path.sep + nomeFilePdfAssistiti, codToCfDistrettoMap, Object.keys(distretti), workingPath);

        if (!fs.existsSync(workingPath + path.sep + "TsJsonData")) {
            fs.mkdirSync(workingPath + path.sep + "TsJsonData");
        }
        let quanti = Object.keys(assistitiNar).length;
        let keys = Object.keys(assistitiNar);
        if (reverse)
            keys = keys.reverse();
        let i = 0;
        let controlla = true;
        if (controlla)
            for (let codNar of keys) {
                // show percentage of process
                console.log("MMG:" + codNar + " " + ((i++ / quanti) * 100).toFixed(2) + "% completato");
                if (!fs.existsSync(workingPath + path.sep + "TsJsonData" + path.sep + "assistiti_" + codNar + ".json")) {
                    let allCodiciFiscali = {};
                    for (let assistito of assistitiNar[codNar].assistiti)
                        allCodiciFiscali[assistito.codiceFiscale] = assistito.data_scelta;
                    let assistitits = await Assistiti.verificaAssistitiParallels(impostazioniServizi, Object.keys(allCodiciFiscali), true, numParallelsJobs, visibile, codToCfDistrettoMap[codNar], allCodiciFiscali);
                    if (!fs.existsSync(workingPath + path.sep + "TsJsonData" + path.sep + "assistiti_" + codNar + ".json"))
                        await Utils.scriviOggettoSuFile(workingPath + path.sep + "TsJsonData" + path.sep + "assistiti_" + codNar + ".json", assistitits);
                }
            }
        // write data on db
        let errori = [];
        let allJsonFile = utils.getAllFilesRecursive(workingPath + path.sep + "TsJsonData", ".json");
        let removeAllBad = (str) => {
            return str.replaceAll(" ", "").replaceAll("(", "").replaceAll(")", "").trim();
        }
        for (let file of allJsonFile) {
            let assistiti = await Utils.leggiOggettoDaFileJSON(file);
            for (let type in assistiti.out) {
                switch (type) {
                    case "vivi":
                        for (let cfAssistito in assistiti.out[type]) {
                            let assistito = assistiti.out[type][cfAssistito];
                            if (cfAssistito === assistito.cf) {
                                let rows = await db("assistiti").where("codice_fiscale", assistito.cf);
                                let nascita = assistito.comune_nascita.split(" (");
                                let cfMedicoNar = allCfMediciNarMap.hasOwnProperty(assistito.mmgNarCf) ? assistito.mmgNarCf : null;
                                let cfMedicoTs = allCfMediciNarMap.hasOwnProperty(assistito.mmgCfTs) ? assistito.mmgCfTs : null;
                                let data = {
                                    codice_fiscale: assistito.cf,
                                    nome: assistito.nome,
                                    cognome: assistito.cognome,
                                    sesso: assistito.sesso,
                                    data_nascita: moment(assistito.data_nascita, "DD/MM/YYYY").format("YYYY-MM-DD"),
                                    deceduto: false,
                                    data_decesso: null,
                                    comune_nascita: removeAllBad(nascita[0]),
                                    provincia_nascita: removeAllBad(nascita[1]),
                                    indirizzo_residenza: assistito.indirizzo,
                                    numero_tessera_sanitaria: assistito.numero_tessera,
                                    tipo_assistito_SSN: assistito.tipoAssistitoSSN,
                                    data_inizio_assistenza_ssn: moment(assistito.inizioAssistenzaSSN, "DD/MM/YYYY").format("YYYY-MM-DD"),
                                    data_fine_assistenza_ssn: assistito.fineAssistenzaSSN.toLowerCase() !== "illimitata" ? moment(assistito.fineAssistenzaSSN, "DD/MM/YYYY").format("YYYY-MM-DD") : null,
                                    motivazione_fine_assistenza_ssn: assistito.motivazioneFineAssistenzaSSN ?? null,
                                    asp: assistito.asp,
                                    cf_medico_ts: cfMedicoTs,
                                    assistito_da_ts: assistito.mmgDaTs ? moment(assistito.mmgDaTs, "DD/MM/YYYY").format("YYYY-MM-DD") : null,
                                    cf_medico_nar: cfMedicoNar,
                                    assistito_da_nar: assistito.mmgDaNar ? moment(assistito.mmgDaNar, "DD/MM/YYYY").format("YYYY-MM-DD") : null,
                                    ultimo_aggiornamento: moment().format("YYYY-MM-DD HH:mm:ss")
                                };
                                if (rows.length === 0)
                                    await db("assistiti").insert(data);
                                else
                                    await db("assistiti").where("codice_fiscale", assistito.cf).update(data);
                            } else
                                errori.push("file " + file + " chiave cf " + cfAssistito + " non corrispondente a " + assistiti.out[type][cfAssistito].cf);
                        }
                        break;
                    case "morti":
                        for (let cfAssistito in assistiti.out[type]) {
                            let assistito = assistiti.out[type][cfAssistito];
                            let rows = await db("assistiti").where("codice_fiscale", assistito.cf);
                            let data = {
                                codice_fiscale: assistito.cf,
                                nome: assistito.nome,
                                cognome: assistito.cognome,
                                sesso: assistito.sesso,
                                data_nascita: moment(assistito.data_nascita, "DD/MM/YYYY").format("YYYY-MM-DD"),
                                deceduto: true,
                                data_decesso: assistito.data_decesso ? moment(assistito.data_decesso, "DD/MM/YYYY").format("YYYY-MM-DD") : null,
                                comune_nascita: assistito.comune_nascita,
                                provincia_nascita: assistito.provincia_nascita,
                                indirizzo_residenza: assistito.indirizzo,
                                cf_medico_ts: null,
                                assistito_da_ts: null,
                                cf_medico_nar: codToCfDistrettoMap[assistito.codiceRegionaleMMG].cf,
                                assistito_da_nar: assistito.dataSceltaMMG ? moment(assistito.dataSceltaMMG, "DD/MM/YYYY").format("YYYY-MM-DD") : null,
                                ultimo_aggiornamento: moment().format("YYYY-MM-DD HH:mm:ss")
                            };
                            if (rows.length === 0)
                                await db("assistiti").insert(data);
                            else
                                await db("assistiti").where("codice_fiscale", assistito.cf).update(data);
                        }
                        break;
                }
                if (errori.length > 0)
                    await Utils.scriviOggettoSuFile(workingPath + path.sep + "TsJsonData" + path.sep + "errori.json", errori);
            }
        }
    }


    /**
     * Crea l'anagrafica a partire dai medici TS.
     *
     * @param {Object} impostazioniServizi - Impostazioni dei servizi.
     * @param {string} pathExcelMedici - Percorso del file Excel dei medici.
     * @param {Object} distretti - Distretti.
     * @param {{workingPath: string, visibile: boolean, numParallelsJobs: number, callback: {fn: updateDb, params: {}}}} [config={}] - Configurazione opzionale.
     * @param {string} [config.workingPath=null] - Percorso di lavoro.
     * @param {boolean} [config.visibile=false] - Se rendere visibile il processo.
     * @param {number} [config.numParallelsJobs=10] - Numero di job paralleli.
     * @param {string} [config.fileName="assistitiTS.json"] - Nome del file.
     * @param {Function} [config.callback=null] - Callback da richiamare al momento di aver trovato un nuovo assistito
     */
    static async creaAnagraficaFromMediciTS(impostazioniServizi, pathExcelMedici, distretti, config = {}) {
        // workingPath = null, visibile = false, numParallelsJobs = 10
        let {
            workingPath = null,
            visibile = false,
            numParallelsJobs = 10,
            fileName = "assistitiTS.json",
            callback = {
                fn: null,
                params: {}
            }
        } = config;
        if (workingPath == null)
            workingPath = await Utils.getWorkingPath();

        let {codToCfDistrettoMap, mediciPerDistretto} = await Procedure.getOggettiMediciDistretto(
            impostazioniServizi,
            pathExcelMedici,
            Object.keys(distretti),
            workingPath);
        // if not exist workingPath + path.sep + fileName
        if (!fs.existsSync(workingPath + path.sep + fileName))
            await this.getAssistitiFromTs(impostazioniServizi, codToCfDistrettoMap,
                {
                    workingPath: workingPath,
                    parallels: numParallelsJobs,
                    visibile: visibile,
                    nomeFile: fileName,
                }
            );
        await Assistiti.verificaAssititiInVitaParallelsJobs(impostazioniServizi, workingPath, {
            outPath: "elaborazioni",
            numParallelsJobs: numParallelsJobs,
            visibile: visibile,
            nomeFile: fileName,
            callback: callback
        });
    }

    /**
     * Crea un file JSON contenente tutti gli assistiti estratti da file ZIP.
     *
     * @param {string} pathFiles - Percorso della cartella contenente i file ZIP.
     * @param {string} [nomeFileFinale="assistiti.db"] - Nome del file JSON finale da creare.
     * @returns {Promise<void>} - Promise che si risolve al completamento della creazione del file.
     * @async
     */
    static async creaFileJsonAssistitiCompletoDaFilesZip(pathFiles, nomeFileFinale = "assistiti.db") {
        let allZipFilesInFolder = utils.getAllFilesRecursive(pathFiles, ".zip");
        let out = {};
        let i = 0;
        for (let zipFile of allZipFilesInFolder) {
            let data = await utils.decomprimiELeggiFile(zipFile);
            console.log("File " + zipFile);
            if (Object.keys(data.vivi).length > 0)
                out = {...out, ...data.vivi, ...data.morti};
            console.log("Progresso " + i + " di " + allZipFilesInFolder.length + " totale assistiti: " + Object.keys(out).length);
            i++;
        }
        console.log("Creazione file dati..")
        await utils.scriviOggettoMP(out, pathFiles + path.sep + nomeFileFinale);
        console.log("File dati creato");
    }

    /**
     * Aggiorna l'anagrafica attraverso file ZIP contenenti dati assistiti usando due worker paralleli.
     *
     * @param {string} pathFiles - Percorso della cartella contenente i file ZIP.
     * @param {APIHelper} api - Oggetto DBHelper contenente i dati di connessione al database.
     * @returns {Promise<void>} - Promise che si risolve al completamento dell'aggiornamento.
     * @param {Object} [config={}] - Configurazione opzionale.
     * @param {number} [config.numParallelsJobs=10] - Numero di job paralleli.
     * @param {number} [config.batchSize=100] - Dimensione del batch per l'aggiornamento.
     */
    static async aggiornaApiAnagraficaDaFilesZip(pathFiles, api, config = {}) {
        let {
            numParallelsJobs = 10,
            batchSize = 10,
            retries = 10
        } = config;
        const progressFile = path.join(pathFiles, 'updateDbProgress.json');

        // Buffer condiviso tra i worker
        let dataBuffer = [];
        let isReaderComplete = false;

        // Inizializza o carica il file di progresso
        let progress = fs.existsSync(progressFile)
            ? await Utils.leggiOggettoDaFileJSON(progressFile)
            : {};

        const allZipFilesInFolder = utils.getAllFilesRecursive(pathFiles, ".zip");
        const allZipDaProcessare = _.cloneDeep(allZipFilesInFolder).sort()
            .filter(zipFile => !progress[path.basename(zipFile)]?.elaborato || progress[path.basename(zipFile)]?.errori?.totale > 0);
        // if not exist, create a controlTimestamp.json file with the timestamp of yesterday in unix time
        if (!fs.existsSync(pathFiles + path.sep + "controlTimestamp.json"))
            await Utils.scriviOggettoSuFile(pathFiles + path.sep + "controlTimestamp.json", {timestamp: utils.convertToUnixSeconds(moment().subtract(1, "days").format("DD/MM/YYYY"))});

        // Worker 1: Legge i file ZIP e popola il buffer
        const zipReaderWorker = async () => {
            for (let zipFile of allZipDaProcessare) {
                const nomefile = path.basename(zipFile);
                if (!progress[nomefile]) {
                    progress[nomefile] = {
                        elaborato: false,
                        aggiornati: 0,
                        aggiunti: 0,
                        nonModificati: 0,
                        errori: {totale: 0, cf: []}
                    };
                }

                const data = await utils.decomprimiELeggiFile(zipFile);
                const assistiti = [...Object.values(data.vivi ?? {}), ...Object.values(data.morti ?? {})];

                dataBuffer.push({
                    zipFile,
                    assistiti
                });

            }
            isReaderComplete = true;
        };

        // Worker 2: Processa i dati dal buffer
        const dataProcessorWorker = async () => {
            while (!isReaderComplete || dataBuffer.length > 0) {
                if (dataBuffer.length === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                const {zipFile, assistiti} = dataBuffer.shift();
                //console.log(`Elaborazione ${zipFile} (${assistiti.length} assistiti)`);

                let stats = {
                    aggiornati: 0,
                    nonModificati: 0,
                    aggiunti: 0,
                    errori: {totale: 0, cf: []}
                };

                // Calcola la percentuale di completamento totale
                const completati = Object.values(progress).filter(p => p.elaborato && p.errori.totale === 0).length;
                const totaleFile = allZipFilesInFolder.length;
                const percentualeTotale = ((completati / totaleFile) * 100).toFixed(2);
                console.log(`\nProcessando ${path.basename(zipFile)} - Completamento totale: ${percentualeTotale}% (${completati}/${totaleFile} file)`);

                // Suddivide gli assistiti in gruppi per il processamento parallelo
                const numPerJob = Math.ceil(assistiti.length / numParallelsJobs);
                const jobs = [];

                for (let i = 0; i < numParallelsJobs; i++) {
                    const start = i * numPerJob;
                    const end = Math.min(start + numPerJob, assistiti.length);
                    const slice = assistiti.slice(start, end);

                    jobs.push((async (jobId, assistitiSlice) => {
                        let processedCount = 0;

                        for (let j = 0; j < assistitiSlice.length; j += batchSize) {
                            const batch = assistitiSlice.slice(j, j + batchSize);
                            processedCount += batch.length;

                            const percentuale = ((processedCount / assistitiSlice.length) * 100).toFixed(2);
                            let res;
                            let attempt = 0;
                            let success = false;

                            while (attempt < retries && !success) {
                                try {
                                    res = await api.nuoviAssistiti(batch);
                                    success = true; // If no exception, we succeeded
                                } catch (error) {
                                    attempt++;
                                    console.log(`Attempt ${attempt}/${retries} failed: ${error.message}`);

                                    if (attempt >= retries) {
                                        console.error(`Failed after ${retries} attempts`);
                                        // Create a default response object to avoid errors in the following code
                                        throw new Error(`Failed to update assistiti after ${retries} attempts. Original error: ${error.message}`);
                                    } else {
                                        // Wait with exponential backoff before retrying (1s, 2s, 4s...)
                                        const delay = Math.pow(2, attempt) * 1000;
                                        console.log(`Retrying in ${delay}ms...`);
                                        await new Promise(resolve => setTimeout(resolve, delay));
                                    }
                                }
                            }

                            if (Array.isArray(res.data)) {
                                for (const result of res.data) {
                                    if (result.err?.code === "ALREADY_EXISTS") {
                                        stats.nonModificati++;
                                    } else if (!result.err) {
                                        result.op === "CREATE" ? stats.aggiunti++ : stats.aggiornati++;
                                    } else {
                                        stats.errori.totale++;
                                        stats.errori.cf.push(result.assistito);
                                    }
                                    // MOSTRA CF e STATO
                                    console.log(`${result.assistito} ${result.err?.code ? (result.err.code + " " + result.err.msg) : (result.op === "CREATE" ? "CREATO" : "AGGIORNATO")}`);
                                }
                            } else {
                                stats.errori.totale += batch.length;
                                stats.errori.cf.push(...batch.map(a => a.cf));
                                console.error(`Errore batch in ${zipFile}:`, res);
                            }
                        }
                    })(i + 1, slice));
                }

                await Promise.all(jobs);

                const nomeFile = path.basename(zipFile);
                progress[nomeFile] = {
                    elaborato: true,
                    ...stats
                };

                await Utils.scriviOggettoSuFile(progressFile, progress);

                console.log(`${path.basename(zipFile)}:
                    - Aggiornati: ${stats.aggiornati}
                    - Aggiunti: ${stats.aggiunti}
                    - Non modificati: ${stats.nonModificati}
                    - Errori: ${stats.errori.totale}`);
            }
        };

        // Avvia entrambi i worker in parallelo
        await Promise.all([
            zipReaderWorker(),
            dataProcessorWorker()
        ]);

        // adesso mancano da aggiornare i disabili che non sono stati aggiornati

        // leggi dal file l'ultima data
        let controlTimestamp = await Utils.leggiOggettoDaFileJSON(pathFiles + path.sep + "controlTimestamp.json");
        // converti valore in millisecondi
        let lastTimestamp = controlTimestamp.timestamp * 1000;
        let assistitiDaAggiornare = await api.assistitiNonAggiornatiDa(lastTimestamp);
        const tot = assistitiDaAggiornare ? assistitiDaAggiornare.count : 0;
        if (tot > 0) {
            console.log("Da aggiornare:" + tot);
            assistitiDaAggiornare = assistitiDaAggiornare.assistiti;
            let i = 0;
            // Divide gli assistiti in batch per l'elaborazione parallela
            const parallelJobs = numParallelsJobs;
            const chunkSize = Math.ceil(assistitiDaAggiornare.length / parallelJobs);
            const jobs = [];
            let processedCount = 0;

            for (let j = 0; j < parallelJobs; j++) {
                const start = j * chunkSize;
                const end = Math.min(start + chunkSize, assistitiDaAggiornare.length);
                const assistitiChunk = assistitiDaAggiornare.slice(start, end);

                jobs.push((async (jobId, assistitiSlice) => {
                    for (let assistito of assistitiSlice) {
                        let attempt = 0;
                        let success = false;

                        while (attempt < retries && !success) {
                            try {
                                await api.ricercaAssistito({codiceFiscale: assistito, forzaAggiornamentoTs: true});
                                success = true;

                                // Aggiorna il contatore totale in modo thread-safe
                                processedCount++;
                                const percentuale = ((processedCount / tot) * 100).toFixed(2);
                                console.log(`Aggiornamento ${percentuale}% completato - ${assistito} OK [Job ${jobId}]`);

                            } catch (error) {
                                attempt++;
                                console.log(`Job ${jobId} - Attempt ${attempt}/${retries} failed for ${assistito}: ${error.message}`);

                                if (attempt >= retries) {
                                    console.error(`Job ${jobId} - Failed after ${retries} attempts for ${assistito}`);
                                    break; // Skip this assistito instead of failing the entire process
                                } else {
                                    const delay = Math.pow(2, attempt) * 1000;
                                    console.log(`Job ${jobId} - Retrying in ${delay}ms...`);
                                    await new Promise(resolve => setTimeout(resolve, delay));
                                }
                            }
                        }

                        if (!success) {
                            console.error(`Job ${jobId} - Errore durante l'aggiornamento di ${assistito}`);
                        }
                    }
                })(j + 1, assistitiChunk));
            }

            // Attendi il completamento di tutti i job paralleli
            await Promise.all(jobs);
        } else
            console.log("Nessun assistito da aggiornare");
        console.log("Aggiornamento completato");
    }


    /**
     * Chiude in parallelo gli assistiti deceduti utilizzando i dati contenuti nei file nella cartella specificata.
     *
     * @param {string} pathDeceduti - Percorso della cartella contenente i files dei deceduti (file .xlsx).
     * @param {Object} impostazioniServizi - Impostazioni per la connessione ai servizi NAR/TS.
     * @param {Object} [config={}] - Configurazione opzionale.
     * @param {boolean} [config.visibile=false] - Se rendere visibile il processo.
     * @param {number} [config.numParallelsJobs=10] - Numero di job paralleli.
     * @param {string} [config.fileName="decedutiChiusuraJobStatus.json"] - Nome del file di stato.
     * @param {Array} [config.otherArgs=[]] - Altri argomenti di lancio di puppeteer.
     * @returns {Promise<void>} Promise che si risolve al completamento delle chiusure.
     */
    static async chiudiAssistitiDecedutiParallelsJobs(pathDeceduti, impostazioniServizi, config = {}) {
        let {
            visibile = false,
            numParallelsJobs = 10,
            fileName = "decedutiChiusuraJobStatus.json",
            otherArgs = []
        } = config;
        let out = {datiAssistitiMorti: [], chiusi: [], nonTrovati: [], errori: []};
        let basePath = path.dirname(pathDeceduti);
        if (!fs.existsSync(basePath + path.sep + fileName)) {
            let allDatiMorti = await utils.riunisciExcelDaTag(pathDeceduti, "deceduti");
            out.datiAssistitiMorti = allDatiMorti["deceduti"];
            await utils.scriviOggettoSuFile(basePath + path.sep + fileName, out);
        } else
            out = await utils.leggiOggettoDaFileJSON(basePath + path.sep + fileName);
        let allCfs = out.datiAssistitiMorti;
        let allJobs = [];
        let i = 0;
        let count = allCfs.length;
        allCfs = allCfs.reverse();
        let numPerJob = Math.ceil(count / numParallelsJobs);
        while (i < numParallelsJobs) {
            let assistiti = new Assistiti(impostazioniServizi, visibile, otherArgs);
            let slice = allCfs.slice(i * numPerJob, (i + 1) * numPerJob);
            allJobs.push(assistiti.chiudiAssistitiDeceduti(slice, i + 1));
            i++;
        }
        let results = await Promise.all(allJobs);
        allJobs = null;
        for (let outJob of results) {
            out.chiusi.push(...outJob.chiusi);
            out.nonTrovati.push(...outJob.nonTrovati);
            out.errori.push(...outJob.errori);
        }
        // scrivi chiusi su file excel
        await utils.scriviOggettoSuNuovoFileExcel(basePath + path.sep + "chiusi.xlsx", Object.values(out.chiusi));
        await utils.scriviOggettoSuFile(basePath + path.sep + fileName, {
            nonTrovati: out.nonTrovati,
            errori: out.errori
        });
        return out;
    }
}

export {
    Procedure
};
