import {utils as Utils} from "./Utils.js";
import path, {parse} from "path";
import {Medici} from "./narTsServices/Medici.js";
import {Assistiti} from "./narTsServices/Assistiti.js";
import moment from "moment";
import knex from "knex";
import fs from "fs";


class Procedure {
    static async getDifferenzeAssistitiNarTs(pathAssistitiPdfNar, pathFileExcelMediciPediatri, impostazioniServizi, distretti, soloAttivi = false, workingPath = null, parallels = 20, visibile = false, tipologia = [Medici.MEDICO_DI_BASE_FILE, Medici.PEDIATRA_FILE], colonnaFineRapporto = "Data fine rapporto", colonnaNomeCognome = "Cognome e Nome", colonnaCodRegionale = "Cod. regionale", colonnaCodFiscale = "Cod. fiscale", colonnaCategoria = "Categoria", colonnaDistretto = "Ambito") {
        if (workingPath == null)
            workingPath = await Utils.getWorkingPath();
        let medici = new Medici(impostazioniServizi, workingPath);
        let datiMediciPediatriCompleto = await Utils.getObjectFromFileExcel(pathFileExcelMediciPediatri);
        let codToCfDistrettoMap = {};
        let mediciPerDistretto = {};
        for (let dato of datiMediciPediatriCompleto) {
            // find any of distretty kewrord in string dato[colonnaDistretto]
            let distretto = distretti.filter(distrettoKeyword =>
                dato[colonnaDistretto]?.toLowerCase().includes(distrettoKeyword.toLowerCase())
            );
            let cfM = dato[colonnaCodFiscale].toString();
            let codReg = dato[colonnaCodRegionale];
            let nomeCogn = dato[colonnaNomeCognome];
            if (distretto.length === 0)
                distretto = ['N.D.'];
            if (tipologia.includes(dato[colonnaCategoria]) && (!soloAttivi || !dato.hasOwnProperty(colonnaFineRapporto)))
                codToCfDistrettoMap[codReg] = {
                    cod_regionale: codReg,
                    distretto: distretto[0],
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
            });
        }

        if (!fs.existsSync(workingPath + path.sep + "assistitiNar.json")) {
            let allAssistiti = await medici.getAssistitiDaListaPDF(pathAssistitiPdfNar, codToCfDistrettoMap, 'cf');
            await Utils.scriviOggettoSuFile(workingPath + path.sep + "assistitiNar.json", allAssistiti);
        }
        if (!fs.existsSync(workingPath + path.sep + "assistitiTs.json")) {
            let temp = await Medici.getElencoAssistitiFromTsParallels(Object.keys(codToCfDistrettoMap), codToCfDistrettoMap, impostazioniServizi, parallels, visibile);
            await Utils.scriviOggettoSuFile(workingPath + path.sep + "assistitiTs.json", temp);
        }

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
            if (!fs.existsSync(workingPath + path.sep + "assistitiNar_" + distretto + ".xlsx"))
                await Utils.scriviOggettoSuNuovoFileExcel(workingPath + path.sep + "assistitiNar_" + distretto + ".xlsx", allAssistitiDistrettuali[distretto].nar);
            if (!fs.existsSync(workingPath + path.sep + "assistitiTs_" + distretto + ".xlsx"))
                await Utils.scriviOggettoSuNuovoFileExcel(workingPath + path.sep + "assistitiTs_" + distretto + ".xlsx", allAssistitiDistrettuali[distretto].ts);
        }

        // VERIFICA DIFFERENZE
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

    static
    async salvaCedoliniMedici(matricola, impostazioniServizi, daMese, daAnno, aMese, aAnno) {
        // da,a array mese anno
        let da = moment(daAnno + "-" + daMese + "-01", "YYYY-MM-DD");
        let a = moment(aAnno + "-" + aMese + "-01", "YYYY-MM-DD");
        let medici = new Medici(impostazioniServizi, true);
        do {
            let out = await medici.stampaCedolino(matricola, true, da.month() + 1, da.year(), da.month() + 1, da.year());
            da = da.add(1, "month");
        } while (da.isSameOrBefore(a));
    }

    static
    async generaDbMysqlDaFilePrestazioni(pathFilePrestazioni, datiDb, anno, cancellaDb = true) {
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
                    await db("ricetta").insert({
                        numero: ricetta.ricetta,
                        tipologia: tipoRicetta === "ricette_specialistiche" ? "specialistica" : "farmaceutica",
                        struttura: ricetta.struttura,
                        ubicazione: ricetta.ubicazione,
                        data_prescrizione: ricetta.data_prescrizione,
                        data_spedizione: ricetta.data_spedizione,
                        ticket: parseFloat(ricetta.ticket).toFixed(2),
                        id_protocollo: prot[0],
                    })
                }
            }
            console.log("protocollo " + protocollo + " inserito");
        }
        return 0;
    }

}

export {
    Procedure
};