import {utils as Utils} from "./Utils.js";
import path, {parse} from "path";
import {Medici} from "./narTsServices/Medici.js";
import {Assistiti} from "./narTsServices/Assistiti.js";
import moment from "moment";
import knex from "knex";


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

    static async getControlliEsenzione(pathElenco, colonnaCf, colonnaEsenzione, anno, arrayEsenzioni, impostazioniServizi, workingPath = null, parallels = 20, includiNucleo = true, visibile = false) {
        let datiRecupero = await Utils.getObjectFromFileExcel(pathElenco);
        let codFiscali = {};
        for (let dato of datiRecupero) {
            if (!Object.hasOwnProperty(dato[colonnaCf]))
                if (arrayEsenzioni.includes(dato[colonnaEsenzione].trim().toUpperCase()))
                    codFiscali[dato[colonnaCf]] = dato[colonnaCf];
        }
        let risultato = await Assistiti.controlliEsenzioneAssistitoParallels(impostazioniServizi, Object.keys(codFiscali), arrayEsenzioni, anno, parallels, includiNucleo, visibile);
        //let assistiti = new Assistiti(impostazioniServizi);
        //let risultato = await assistiti.controlliEsenzioneAssistito(Object.keys(codFiscali).slice(0, 30), tipoEsenzione, anno,1,true,true);
        await Utils.scriviOggettoSuFile(workingPath + path.sep + "controllo.json", risultato.out);
        console.log("FINE");
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
        for (let cf of Object.keys(datiPrestazioni)) {
            let rigaProtocolli = datiPrestazioni[cf].out;
            for (let protocollo of Object.keys(rigaProtocolli)) {
                /*                await db("protocollo").insert({
                                    cf: cf,
                                    protocollo: protocollo,
                                    anno: anno,
                                });*/
                let rigaProtocollo = rigaProtocolli[protocollo];
                let prot = await db("protocollo").insert({
                    protocollo: protocollo,
                    anno: anno,
                    cf_titolare_esenzione: cf,
                    esenzione: rigaProtocollo.esenzione,
                    cod_fiscale: rigaProtocollo.codFiscaleEsenzione,
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
                            tipologia: tipoRicetta === "ricette_specialistiche" ? "specialistica": "farmaceutica",
                            struttura: ricetta.struttura,
                            ubicazione: ricetta.ubicazione,
                            data_prescrizione: ricetta.data_prescrizione,
                            data_spedizione: ricetta.data_spedizione,
                            ticket: parseFloat(ricetta.ticket).toFixed(2),
                            id_protocollo: prot[0],
                        })
                    }
                }
                console.log("ricette inserite per protocollo " + protocollo + " cf " + cf);
            }
        }
    }

}

export {Procedure};