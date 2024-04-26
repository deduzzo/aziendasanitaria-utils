import {utils, utils as Utils} from "./Utils.js";
import path, {parse} from "path";
import {Medici} from "./narTsServices/Medici.js";
import {Assistiti} from "./narTsServices/Assistiti.js";
import moment from "moment";
import knex from "knex";
import fs from "fs";
import sqlite3 from 'sqlite3';
import {Nar} from "./narTsServices/Nar.js";


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

    static async getAssistitiFromTs(impostazioniServizi, codToCfDistrettoMap, workingPath = null, parallels = 20, visibile = false, nomeFile = "assistitiTs.json",) {
        if (workingPath == null)
            workingPath = await Utils.getWorkingPath();
        if (!fs.existsSync(workingPath + path.sep + nomeFile)) {
            let temp = await Medici.getElencoAssistitiFromTsParallels(Object.keys(codToCfDistrettoMap), codToCfDistrettoMap, impostazioniServizi, parallels, visibile);
            await Utils.scriviOggettoSuFile(workingPath + path.sep + nomeFile, temp);
        }
    }

    static async #getDifferenzeAssistitiNarTs(mediciPerDistretto, codToCfDistrettoMap, pathAssistitiPdfNar, impostazioniServizi, distretti, workingPath = null, soloAttivi = false, parallels = 20, visibile = false) {

        await Procedure.getAssistitiFileFromNar(impostazioniServizi, pathAssistitiPdfNar, codToCfDistrettoMap, distretti, workingPath);
        await Procedure.getAssistitiFromTs(impostazioniServizi, codToCfDistrettoMap, workingPath, parallels, visibile);

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

    static async analizzaMensilitaMedico(matricola, impostazioniServizi, daMese, daAnno, aMese, aAnno, visible = false) {
        // da,a array mese anno
        let da = moment(daAnno + "-" + daMese + "-01", "YYYY-MM-DD");
        let a = moment(aAnno + "-" + aMese + "-01", "YYYY-MM-DD");
        let medici = new Medici(impostazioniServizi, visible, null, true, Nar.PAGHE);
        do {
            let out = await medici.stampaCedolino(matricola, visible, da.month() + 1, da.year(), da.month() + 1, da.year());
            let out2 = await medici.analizzaBustaPaga(matricola, da.month() + 1, da.year(), da.month() + 1, da.year());
            da = da.add(1, "month");
        } while (da.isSameOrBefore(a));
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

    static async eseguiVerifichePeriodicheDecedutiAssistitiMedici(impostazioniServizi, pathExcelMedici, distretti, dataQuote, workingPath = null, nomeFilePdfAssistiti = "assistiti.pdf", cartellaElaborazione = "elaborazioni", numParallelsJobs = 6, visible = false) {
        if (workingPath == null)
            workingPath = await Utils.getWorkingPath();

        let medici = new Medici(impostazioniServizi);
        let {codToCfDistrettoMap, mediciPerDistretto} = await Procedure.getOggettiMediciDistretto(
            impostazioniServizi,
            pathExcelMedici,
            Object.keys(distretti),
            workingPath);

        await Procedure.getAssistitiFileFromNar(impostazioniServizi, workingPath + path.sep + nomeFilePdfAssistiti, codToCfDistrettoMap, Object.keys(distretti), workingPath);

        await Assistiti.verificaAssititiInVitaParallelsJobs(
            impostazioniServizi,
            workingPath,
            cartellaElaborazione,
            numParallelsJobs,
            visible);


        await medici.creaElenchiDeceduti(codToCfDistrettoMap, workingPath, distretti, dataQuote);

        await Procedure.getAssistitiFromTs(impostazioniServizi, codToCfDistrettoMap, workingPath, numParallelsJobs, visible);

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

    static async verificaDecessiDaFileExcel(fileExcel, impostazioniServizi, colonnaCf, verificaIndirizzi = false, visible = false, numParallels = 10, salvaFile = true) {
        let assistiti = await Utils.getObjectFromFileExcel(fileExcel);
        let cfs = [];
        for (let assistito of assistiti) {
            cfs.push(assistito[colonnaCf]);
        }
        // get the first 50 cfs
        let ris = await Assistiti.verificaAssistitiParallels(impostazioniServizi, cfs, verificaIndirizzi, numParallels, visible);
        console.log("FINE VERIFICA");
        if (salvaFile) {
            let parentFolder = path.dirname(fileExcel);
            await Utils.scriviOggettoSuNuovoFileExcel(parentFolder + path.sep + "vivi.xlsx", Object.values(ris.out.vivi));
            await Utils.scriviOggettoSuNuovoFileExcel(parentFolder + path.sep + "morti.xlsx", Object.values(ris.out.morti));
            if (ris.out.nonTrovati.length > 0)
                await Utils.scriviOggettoSuNuovoFileExcel(parentFolder + path.sep + "nonTrovati.xlsx", ris.out.nonTrovati);
        }
        console.log("FILE SALVATI");
    }

    static async creaDatabaseAssistitiNarTs(impostazioniServizi, pathExcelMedici, distretti, connData, workingPath = null, nomeFilePdfAssistiti = "assistiti.pdf", cartellaElaborazione = "elaborazioniDB", numParallelsJobs = 20, visible = false) {
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
        let i = 0;
        let controlla = false;
        if (controlla)
            for (let codNar in assistitiNar) {
                // show percentage of process
                console.log("MMG:" + codNar + " " + ((i++ / quanti) * 100).toFixed(2) + "% completato");
                if (!fs.existsSync(workingPath + path.sep + "TsJsonData" + path.sep + "assistiti_" + codNar + ".json")) {
                    let allCodiciFiscali = {};
                    for (let assistito of assistitiNar[codNar].assistiti)
                        allCodiciFiscali[assistito.codiceFiscale] = assistito.data_scelta;
                    let assistitits = await Assistiti.verificaAssistitiParallels(impostazioniServizi, Object.keys(allCodiciFiscali), true, numParallelsJobs, visible, codToCfDistrettoMap[codNar], allCodiciFiscali);
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


}

export {
    Procedure
};