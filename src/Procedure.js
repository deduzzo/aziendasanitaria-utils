import {utils as Utils} from "./Utils.js";
import path, {parse} from "path";
import {Medici} from "./narTsServices/Medici.js";
import {Assistiti} from "./narTsServices/Assistiti.js";
import moment from "moment";
import knex from "knex";
import fs from "fs";
import sqlite3 from 'sqlite3';
import {Nar} from "./narTsServices/Nar.js";


class Procedure {

    static async getOggettiMediciDistretto(impostazioniServizi, pathFileExcelMediciPediatri, distretti, workingPath = null, soloAttivi = false, tipologia = [Medici.MEDICO_DI_BASE_FILE, Medici.PEDIATRA_FILE], colonnaFineRapporto = "Data fine rapporto", colonnaNomeCognome = "Cognome e Nome", colonnaCodRegionale = "Cod. regionale", colonnaCodFiscale = "Cod. fiscale", colonnaCategoria = "Categoria", colonnaDistretto = "Ambito") {
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
                    distretto: distretto[0],
                    ambito: dato[colonnaDistretto] ?? "ND",
                    nome_cognome: nomeCogn,
                    cf: cfM
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
            let allAssistiti = await medici.getAssistitiDaListaPDF(pathFilePdf, codToCfDistrettoMap, 'cf');
            await Utils.scriviOggettoSuFile(workingPath + path.sep + "assistitiNar.json", allAssistiti);
        }
    }

    static async getAssistitiFromTs(impostazioniServizi, codToCfDistrettoMap, workingPath = null, parallels = 20, visibile = false, nomeFile = "assistitiTs.json",) {
        if (workingPath == null)
            workingPath = await Utils.getWorkingPath();
        if (!fs.existsSync(workingPath + path.sep + nomeFile)) {
            let temp = await Medici.getElencoAssistitiFromTsParallels(Object.keys(codToCfDistrettoMap), codToCfDistrettoMap, impostazioniServizi, parallels, visibile);
            await Utils.scriviOggettoSuFile(workingPath + path.sep + nomeFile, temp);
        }
    }

    static async getDifferenzeAssistitiNarTs(mediciPerDistretto,codToCfDistrettoMap, pathAssistitiPdfNar, impostazioniServizi, distretti, soloAttivi = false, workingPath = null, parallels = 20, visibile = false) {
        await Procedure.getAssistitiFileFromNar(impostazioniServizi, pathAssistitiPdfNar, codToCfDistrettoMap, distretti, workingPath);
        await Procedure.getAssistitiFromTs(impostazioniServizi, codToCfDistrettoMap, workingPath, parallels, visibile);

        // per codice regionale
        let assistitiNar = await Utils.leggiOggettoDaFileJSON(workingPath + path.sep + "assistitiNar.json");
        //per codice fiscale
        let assistitiTs = await Utils.leggiOggettoDaFileJSON(workingPath + path.sep + "assistitiTs.json");

        // SALVA FILE NAR E TS PER DISTRETTO
        let allAssistitiDistrettuali = {};
        for (let distretto of Object.keys(mediciPerDistretto)) {
            allAssistitiDistrettuali[distretto] = {nar: [], ts: []};
            for (let medico of mediciPerDistretto[distretto]) {
                let codReg = medico.cod_regionale_medico;
                if (assistitiNar.hasOwnProperty(codReg)) {
                    for (let assistito of assistitiNar[codReg].assistiti) {
                        allAssistitiDistrettuali[distretto].nar.push({...assistito, ...medico});
                    }
                    for (let assistito of assistitiTs[codReg]) {
                        allAssistitiDistrettuali[distretto].ts.push({...assistito, ...medico});
                    }
                }
            }
        }

        for (let distretto of Object.keys(allAssistitiDistrettuali)) {
            console.log("DISTRETTO " + distretto);
            if (!fs.existsSync(workingPath + path.sep + "assistitiNar_" + distretto + ".xlsx"))
                await Utils.scriviOggettoSuNuovoFileExcel(workingPath + path.sep + "assistitiNar_" + distretto + ".xlsx", allAssistitiDistrettuali[distretto].nar);
            if (!fs.existsSync(workingPath + path.sep + "assistitiTs_" + distretto + ".xlsx"))
                await Utils.scriviOggettoSuNuovoFileExcel(workingPath + path.sep + "assistitiTs_" + distretto + ".xlsx", allAssistitiDistrettuali[distretto].ts);
        }

        if (!fs.existsSync(workingPath + path.sep + "medici.json"))
            await Utils.scriviOggettoSuFile(workingPath + path.sep + "medici.json", Object.values(codToCfDistrettoMap));

        // VERIFICA DIFFERENZE
        let medici = new Medici(impostazioniServizi);
        let differenze = medici.getAllDifferenzeAnagrafiche(assistitiNar, assistitiTs, codToCfDistrettoMap);
        await Utils.scriviOggettoSuFile(workingPath + path.sep + "differenze.json", differenze);
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

    static async analizzaMensilitaMedico(matricola, impostazioniServizi, daMese, daAnno, aMese, aAnno,visible = false) {
        // da,a array mese anno
        let da = moment(daAnno + "-" + daMese + "-01", "YYYY-MM-DD");
        let a = moment(aAnno + "-" + aMese + "-01", "YYYY-MM-DD");
        let medici = new Medici(impostazioniServizi,visible,null,true,Nar.PAGHE);
        do {
            let out = await medici.stampaCedolino(matricola, visible, da.month() + 1, da.year(), da.month() + 1, da.year());
            let out2 = await medici.analizzaBustaPaga(matricola,da.month() + 1, da.year(), da.month() + 1, da.year());
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

    static async eseguiVerifichePeriodicheDecedutiAssistitiMedici(impostazioniServizi, pathExcelMedici, distretti, dataQuote,workingPath = null, nomeFilePdfAssistiti = "assistiti.pdf", cartellaElaborazione = "elaborazioni", numParallelsJobs = 6, visible = false) {
        if (workingPath == null)
            workingPath = await Utils.getWorkingPath();

        let medici = new Medici(impostazioniServizi);
        let {codToCfDistrettoMap, mediciPerDistretto} = await Procedure.getOggettiMediciDistretto(
            impostazioniServizi,
            pathExcelMedici,
            distretti,
            workingPath);

        await Procedure.getAssistitiFileFromNar(impostazioniServizi, workingPath + path.sep + nomeFilePdfAssistiti, codToCfDistrettoMap, distretti, workingPath);

        await Assistiti.verificaAssititiInVitaParallelsJobs(
            impostazioniServizi,
            workingPath,
            cartellaElaborazione,
            numParallelsJobs,
            visible);


        await medici.creaElenchiDeceduti(codToCfDistrettoMap,workingPath, distretti, dataQuote);

        await Procedure.getAssistitiFromTs(impostazioniServizi, codToCfDistrettoMap, workingPath, numParallelsJobs, visible);

        await Procedure.getDifferenzeAssistitiNarTs(
            mediciPerDistretto,
            codToCfDistrettoMap,
            workingPath + path.sep + nomeFilePdfAssistiti,
            impostazioniServizi,
            distretti);
    }

    static async verificaDecessiDaFileExcel(fileExcel, impostazioniServizi, colonnaCf, verificaIndirizzi = true, salvaFile = true) {
        let assistiti = await Utils.getObjectFromFileExcel(fileExcel);
        let cfs = [];
        for (let assistito of assistiti) {
            cfs.push(assistito[colonnaCf]);
        }
        let ris = await Assistiti.verificaAssistitiParallels(impostazioniServizi, cfs, verificaIndirizzi);
        if (salvaFile) {
            let parentFolder= path.dirname(fileExcel);
            await Utils.scriviOggettoSuNuovoFileExcel(parentFolder + path.sep + "vivi.xlsx", Object.values(ris.out.vivi));
            await Utils.scriviOggettoSuNuovoFileExcel(parentFolder + path.sep + "morti.xlsx", Object.values(ris.out.morti));
            if (ris.out.nonTrovati.length > 0)
                await Utils.scriviOggettoSuNuovoFileExcel(parentFolder + path.sep + "nonTrovati.xlsx", ris.out.nonTrovati);
        }
    }



}

export {
    Procedure
};