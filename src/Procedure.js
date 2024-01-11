import { utils as Utils } from "./Utils.js";
import path from "path";
import { Medici } from "./narTsServices/Medici.js";


class Procedure {
    static async getDifferenzeNarTs(pathAssistitiPdfNar, pathFileExcelMediciPediatri, impostazioniServizi, workingPath = null,parallels = 20, visibile = false) {
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
}

export { Procedure };