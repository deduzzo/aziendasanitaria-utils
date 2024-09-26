import {utils} from "./Utils.js";
import fs from "fs";
import {promisify} from "util";
import * as xml2js from "xml2js";

class Indicatori {
    static D33ZA = "D33ZA";
    static D30Z = "D30Z";
    static ARS_PATH = "ARS_PATH";
    static SIAD_PATH = "SIAD_PATH";
    static HOSPICE_PATH = "HOSPICE_PATH";
    static async getIndicatore(indicatore, params) {
        let out= {result: null, error: null};
        let paramsRequired = [];
        switch (indicatore) {
            case this.D33ZA:
                paramsRequired = [this.ARS_PATH];
                if (paramsRequired.every(key => params.hasOwnProperty(key))) {
                    const parser = new xml2js.Parser({attrkey: "ATTR"});
                    let allFiles = utils.getAllFilesRecursive(params[this.ARS_PATH], [".xml"], "ACC");
                    let allAssistiti = {};
                    let i = 0;
                    for (let file of allFiles) {
                        i++;
                        console.log("Processo il file "+ file + ": " + i + " di " + allFiles.length);
                        let xml_string = fs.readFileSync(file, "utf8");
                        const result = await promisify(parser.parseString)(xml_string);
                        for (let assistenza of result["Tracciato1"]["FlsResSemires_1"]) {
                            let annoTrasmissione = parseInt(assistenza["Chiave"][0]['ID_REC'][0].substring(12, 16));
                            let annoNascita =  parseInt(assistenza['AssistitoAmmissione'][0]['Assistito'][0]['DatiAnagrafici'][0]['AnnoNascita'][0]);
                            let tipoPrestazione = assistenza["Chiave"][0]['tipoPrestazione'][0];
                            let eta = annoTrasmissione - annoNascita;
                            let cf = assistenza['AssistitoAmmissione'][0]['Assistito'][0]['DatiAnagrafici'][0]['CUNI'][0];
                            if (!allAssistiti.hasOwnProperty(cf) && ['R1','R2','R3'].includes(tipoPrestazione.toUpperCase()) && eta > 75 ) {
                                allAssistiti[cf] = {
                                    annoNascita: annoNascita, annoTrasmissione: annoTrasmissione, eta: eta, tipoPrestazione: tipoPrestazione
                                };
                            }
                        }
                    }
                    //console.log(Object.keys(allAssistiti).length);
                    out.result = Object.keys(allAssistiti).length;
                }
                else
                    out.error = "Parametri mancanti: " + paramsRequired.filter(key => !params.hasOwnProperty(key)).join(", ");
                break;
            case this.D30Z:
                paramsRequired = [this.SIAD_PATH, this.HOSPICE_PATH];
                if (paramsRequired.every(key => params.hasOwnProperty(key))) {
                    // PRIMA PARTE, CALCOLO ASSISTITI IN HOSPICE CON ASSISTENZA CONCLUSA CON DECESSO (MOTIVO 6)
                    // E PATOLOGIA RESONSABILE E' CON ICD9 COMPRESO TRA 140 e 208
                    const parser = new xml2js.Parser({attrkey: "ATTR"});
                    let allFilesHospice = utils.getAllFilesRecursive(params[this.HOSPICE_PATH], [".xml"], "ATT");
                    let assistitiDecedutiConRequisitiHospice = {};
                    let i = 0;
                    for (let file of allFilesHospice) {
                        i++;
                        console.log("Processo il file "+ file + ": " + i + " di " + allFilesHospice.length);
                        let xml_string = fs.readFileSync(file, "utf8");
                        const result = await promisify(parser.parseString)(xml_string);
                        for (let assistenza of result["HspAttivita"]["Assistenza"]) {
                            const patologiaResponsabile = parseInt(assistenza['PresaInCarico'][0]['PatologiaResponsabile'][0]);
                            if (parseInt(assistenza['Conclusione'][0]['Modalita'][0]) === 6 && patologiaResponsabile >= 140 && patologiaResponsabile <= 208) {
                                let cf = assistenza['PresaInCarico'][0]['Id_Rec'][0].substring(22,38);
                                if (!assistitiDecedutiConRequisitiHospice.hasOwnProperty(cf))
                                    assistitiDecedutiConRequisitiHospice[cf] = { cf };
                            }
                        }
                    }
                    let allFilesSiadT1 = utils.getAllFilesRecursive(params[this.SIAD_PATH], [".xml"], "AAD");
                    let allFilesSiadT2 = utils.getAllFilesRecursive(params[this.SIAD_PATH], [".xml"], "APS");
                    let idrecTracciato1Validi = {};
                    let assistitiDecedutiConRequisitiSiad = {};
                    const ignoraMotivoSospensione = true;
                    const ignoraPatologiaT1 = false;
                    i = 0;
                    for (let file of allFilesSiadT1) {
                        i++;
                        console.log("Processo il file " + file + ": " + i + " di " + allFilesSiadT1.length);
                        let xml_string = fs.readFileSync(file, "utf8");
                        const result = await promisify(parser.parseString)(xml_string);
                        for (let assistenza of result["FlsAssDom_1"]['Assistenza']) {
                            const idRec = assistenza['Eventi'][0]['PresaInCarico'][0]['Id_Rec'][0];
                            try {
                                const patologiaPrevalente = parseInt(assistenza['Eventi'][0]['Valutazione'][0]['Patologia'][0]['Prevalente'][0]);
                                let curePalliative=
                                    (assistenza['Eventi'][0]['Valutazione'][0].hasOwnProperty('CurePalliative') && parseInt(assistenza['Eventi'][0]['Valutazione'][0]['CurePalliative'][0]) === 1) ||
                                    (assistenza['Eventi'][0]['Valutazione'][0].hasOwnProperty('AssistStatoTerminaleOnc') && parseInt(assistenza['Eventi'][0]['Valutazione'][0]['AssistStatoTerminaleOnc'][0]) === 1);
                                if (curePalliative && (ignoraPatologiaT1 || ( patologiaPrevalente >= 140 && patologiaPrevalente <= 208 )) )
                                    if (!idrecTracciato1Validi.hasOwnProperty(idRec))
                                        idrecTracciato1Validi[idRec] = true;
                            }
                            catch (ex) {}
                        }
                    }
                    i = 0;
                    for (let file of allFilesSiadT2) {
                        i++;
                        console.log("Processo il file " + file + ": " + i + " di " + allFilesSiadT2.length);
                        let xml_string = fs.readFileSync(file, "utf8");
                        const result = await promisify(parser.parseString)(xml_string);
                        for (let assistenza of result["FlsAssDom_2"]['Assistenza']) {
                            try {
                                let motivazioneChiusura = parseInt(assistenza['Eventi'][0]['Conclusione'][0]['Motivazione'][0]);
                                let idRec = assistenza['Eventi'][0]['PresaInCarico'][0]['Id_Rec'][0];
                                if (
                                    (motivazioneChiusura === 3 || ignoraMotivoSospensione) && idrecTracciato1Validi.hasOwnProperty(idRec)
                                ){
                                    let cf = idRec.substring(16, 32);
                                    if (!assistitiDecedutiConRequisitiSiad.hasOwnProperty(cf))
                                        assistitiDecedutiConRequisitiSiad[cf] = {cf};
                                }
                            } catch (ex) {
                            }

                        }
                    }
                    out.result = { hospice: Object.keys(assistitiDecedutiConRequisitiHospice).length, siad: Object.keys(assistitiDecedutiConRequisitiSiad).length };
                    console.log("Hospice: " + Object.keys(assistitiDecedutiConRequisitiHospice).length + " SIAD: " + Object.keys(assistitiDecedutiConRequisitiSiad).length);
                    console.log("FINE");

                }
                else
                    out.error = "Parametri mancanti: " + paramsRequired.filter(key => !params.hasOwnProperty(key)).join(", ");
                break;
        }
        return out;
    }
}

export {
    Indicatori
};