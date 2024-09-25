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
                const parser = new xml2js.Parser({attrkey: "ATTR"});
                if (paramsRequired.every(key => params.hasOwnProperty(key))) {
                    let allFiles = utils.getAllFilesRecursive(params[this.ARS_PATH], [".xml"], "ACC");
                    let allAssistiti = {};
                    for (let file of allFiles) {
                        let xml_string = fs.readFileSync(file, "utf8");
                        const result = await promisify(parser.parseString)(xml_string);
                        for (let assistenza of result["Tracciato1"]["FlsResSemires_1"]) {
                            console.log(assistenza);
                        }
                    }
                }
                else
                    out.error = "Parametri mancanti: " + paramsRequired.filter(key => !params.hasOwnProperty(key)).join(", ");
                break;
            case this.D30Z:
                paramsRequired = [this.SIAD_PATH, this.HOSPICE_PATH];
                if (paramsRequired.every(key => params.hasOwnProperty(key))) {

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