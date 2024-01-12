import {utils as Utils} from "./Utils.js";
import path from "path";
import {Medici} from "./narTsServices/Medici.js";
import {Assistiti} from "./narTsServices/Assistiti.js";


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

    static async getControlliEsenzione(pathElenco, colonnaCf, anno, tipoEsenzione, impostazioniServizi, workingPath = null, parallels = 20, visibile = false) {
        let datiRecupero = await Utils.getObjectFromFileExcel(pathElenco);
        let codFiscali = {};
        for (let dato of datiRecupero) {
            if (!Object.hasOwnProperty(dato[colonnaCf]))
                codFiscali[dato[colonnaCf]] = dato[colonnaCf];
        }
        let risultato = await Assistiti.controlliEsenzioneAssistitoParallels(impostazioniServizi, Object.keys(codFiscali), tipoEsenzione, anno, parallels, visibile);
        //let assistiti = new Assistiti(impostazioniServizi);
        //let risultato = await assistiti.controlliEsenzioneAssistito(Object.keys(codFiscali).slice(0, 30), tipoEsenzione, anno,1,true,true);
        await Utils.scriviOggettoSuFile(workingPath + path.sep + "controllo.json", risultato.out);
        console.log("FINE");
    }


}

export {Procedure};