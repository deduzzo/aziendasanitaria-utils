import {utils as Utils} from "./Utils.js";
import path, {parse} from "path";
import {Medici} from "./narTsServices/Medici.js";
import {Assistiti} from "./narTsServices/Assistiti.js";
import moment from "moment";
import knex from "knex";
import fs from "fs";


class Procedure {
    static async getDifferenzeAssistitiNarTs(pathAssistitiPdfNar, pathFileExcelMediciPediatri, impostazioniServizi, workingPath = null, parallels = 20, visibile = false) {
        if (workingPath == null)
            workingPath = await Utils.getWorkingPath();
        let medici = new Medici(impostazioniServizi, workingPath);
        let allAssistiti = await medici.getAssistitiDaListaPDF(pathAssistitiPdfNar);
        await Utils.scriviOggettoSuFile(workingPath + path.sep + "assistitiNar.json", allAssistiti);
        let datiMediciPediatriCompleto = await Utils.getObjectFromFileExcel(pathFileExcelMediciPediatri);
        let codToCfMap = {};
        for (let dato of datiMediciPediatriCompleto) {
            codToCfMap[dato['codice regionale'].toString()] = dato['Codice fiscale'];
        }
        let temp = await Medici.getElencoAssistitiFromTsParallels(Object.values(codToCfMap), impostazioniServizi, parallels, visibile);
        await Utils.scriviOggettoSuFile(workingPath + path.sep + "assistitiTs.json", temp);

        // VERIFICA DIFFERENZE
        let assistitiNar = await Utils.leggiOggettoDaFileJSON(workingPath + path.sep + "assistitiNar.json");
        let assistitiTs = await Utils.leggiOggettoDaFileJSON(workingPath + path.sep + "assistitiTs.json");
        let differenze = medici.getAllDifferenzeAnagrafiche(assistitiNar, assistitiTs, codToCfMap);
        await Utils.scriviOggettoSuFile(workingPath + path.sep + "differenze.json", differenze);
    }

    static async getControlliEsenzione(pathElenco, colonnaProtocolli, colonnaEsenzione, anno, arrayEsenzioni, impostazioniServizi, workingPath = null, parallels = 50, maxItemPerJob = 50, includiNucleo = true, visibile = false) {
        let datiRecupero = null;
        let protocolli = {};
        if (fs.existsSync(workingPath + path.sep + anno + ".json")) {
            datiRecupero = await Utils.leggiOggettoDaFileJSON(workingPath + path.sep + anno + ".json");
            for (let dato of Object.keys(datiRecupero)) {
                if (datiRecupero[dato] == null)
                    protocolli[dato] = null;
            }
        }
        else {
            datiRecupero = await Utils.getObjectFromFileExcel(pathElenco);
            for (let dato of datiRecupero) {
                if (!Object.hasOwnProperty(dato[colonnaProtocolli]))
                    if (arrayEsenzioni.includes(dato[colonnaEsenzione].trim().toUpperCase()))
                        protocolli[dato[colonnaProtocolli]] = null;
            }
            await Utils.scriviOggettoSuFile(workingPath + path.sep + anno + ".json", protocolli);
        }
        let risultato = await Assistiti.controlliEsenzioneAssistitoParallels(
            impostazioniServizi,
            protocolli,
            arrayEsenzioni,
            anno,
            workingPath,
            parallels,
            maxItemPerJob,
            includiNucleo,
            visibile);

        console.log("FINE");
        return 0;
    }

    static async salvaCedoliniMedici(matricola, impostazioniServizi, daMese, daAnno, aMese, aAnno) {
        // da,a array mese anno
        let da = moment(daAnno + "-" + daMese + "-01", "YYYY-MM-DD");
        let a = moment(aAnno + "-" + aMese + "-01", "YYYY-MM-DD");
        let medici = new Medici(impostazioniServizi, true);
        do {
            let out = await medici.stampaCedolino(matricola, true, da.month() + 1, da.year(), da.month() + 1, da.year());
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

export {Procedure};