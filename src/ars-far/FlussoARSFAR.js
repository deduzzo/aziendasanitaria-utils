import {common} from "../Common.js";
import md5File from "md5-file";
import fs from "fs";
import * as xml2js from "xml2js";
import { promisify } from 'util';
import moment from "moment";

export class FlussoARSFAR {
    /**
     * @param {ImpostazioniFlussoARSFAR} settings - Settings
     */
    constructor(settings) {
        this._settings = settings;
    }

    get settings() {
        return this._settings;
    }

    set settings(value) {
        this._settings = value;
    }

    async #calcolaAmmissioniDaFileACC(file) {
        const parser = new xml2js.Parser({attrkey: "ATTR"});
        let xml_string = fs.readFileSync(file, "utf8");
        const result = await promisify(parser.parseString)(xml_string);
        let risp = result["Tracciato1"]?.hasOwnProperty("FlsResSemires_1") ? result["Tracciato1"]["FlsResSemires_1"].length : 0;
        console.log(file + "[ACC] => " + risp);
        return risp;
    }

    async #calcolaAmmissioniDaFileEVE(file) {
        const parser = new xml2js.Parser({attrkey: "ATTR"});
        let xml_string = fs.readFileSync(file, "utf8");
        const result = await promisify(parser.parseString)(xml_string);
        let risp = result["Tracciato2"]?.hasOwnProperty("FlsResSemires_2") ? result["Tracciato2"]["FlsResSemires_2"].length : 0;
        console.log(file + "[EVE] => " + risp);
        return risp;
    }

    async #estrapolaDatiDaFileACC (file) {
        let out = {}
        const parser = new xml2js.Parser({attrkey: "ATTR"});
        let xml_string = fs.readFileSync(file, "utf8");
        const result = await promisify(parser.parseString)(xml_string);
    }

    async calcolaAmmissioniFromPath(pathFile = this._settings.in_folder) {
        let fileOut = {}
        let allFilesACC = common.getAllFilesRecursive(pathFile, this._settings.extensions, this._settings.pic)
        let allFilesEVE = common.getAllFilesRecursive(pathFile, this._settings.extensions, this._settings.att)
        let somma1 = 0;
        let somma2 = 0;
        let quanti1 = 0;
        let quanti2 = 0;
        for (let file of allFilesACC) {
            let md5 = md5File.sync(file);
            if (!fileOut.hasOwnProperty(md5)) {
                fileOut[md5] = await this.#calcolaAmmissioniDaFileACC(file)
                somma1+= fileOut[md5];
                quanti1++;
            }
        }
        for (let file of allFilesEVE) {
            let md5 = md5File.sync(file);
            if (!fileOut.hasOwnProperty(md5)) {
                fileOut[md5] = await this.#calcolaAmmissioniDaFileEVE(file)
                somma2+= fileOut[md5];
                quanti2++;
            }
        }
        console.log("somma1:" + somma1 + ", quanti: " + quanti1)
        console.log("somma2:" + somma2 + ", quanti: " + quanti1)
        return somma1;
    }

    async estrapolaDatiPerRelazione(pathFile = this._settings.in_folder) {
        const parser = new xml2js.Parser({attrkey: "ATTR"});
        let fileOut = {}
        let totaleRicoveri={totale: 0,uomini: 0, donne: 0};
        let provenienzaRicoverati = {}
        let etaRicoverati ={}
        let giorniDegenza = 0;
        let assistitiSpese = {} // {cf: "XXXXXX",spesa:x,....}
        let allFilesACC = common.getAllFilesRecursive(pathFile, this._settings.extensions, this._settings.pic)
        let allFilesEVE = common.getAllFilesRecursive(pathFile, this._settings.extensions, this._settings.att)
        for (let file of allFilesACC) {
            let md5 = md5File.sync(file);
            if (!fileOut.hasOwnProperty(md5)) {
                fileOut[md5] = md5;
                let xml_string = fs.readFileSync(file, "utf8");
                const result = await promisify(parser.parseString)(xml_string);
                for (let assistenza of result["Tracciato1"]["FlsResSemires_1"]) {
                    console.log(assistenza);
                    let sesso = assistenza["AssistitoAmmissione"][0]['Assistito'][0]['DatiAnagrafici'][0]["Genere"][0] === "2" ? "F" : "M"
                    let provenienza = assistenza["AssistitoAmmissione"][0]['Ammissione'][0]["TipoStrutturaProvenienza"][0];
                    let eta = new Date().getFullYear() - parseInt(assistenza["AssistitoAmmissione"][0]['Assistito'][0]['DatiAnagrafici'][0]["AnnoNascita"][0])
                    totaleRicoveri = {totale: totaleRicoveri.totale +1,uomini: sesso === "M" ? totaleRicoveri.uomini +1 : totaleRicoveri.uomini,donne: sesso === "F" ? totaleRicoveri.donne +1 : totaleRicoveri.donne }
                    if (!provenienzaRicoverati.hasOwnProperty(provenienza))
                        provenienzaRicoverati[provenienza] = 1;
                    else
                        provenienzaRicoverati[provenienza] =  provenienzaRicoverati[provenienza] + 1;
                    if (!etaRicoverati.hasOwnProperty(eta))
                        etaRicoverati[eta] = 1;
                    else
                        etaRicoverati[eta] = etaRicoverati[eta] +1
                }
            }
        }
        for (let file of allFilesEVE) {
            let md5 = md5File.sync(file);
            if (!fileOut.hasOwnProperty(md5)) {
                fileOut[md5] = md5;
            }
        }
        return {'totaleRicoveri': totaleRicoveri, 'provenienzaRicoverati': provenienzaRicoverati, 'etaRicoverati': etaRicoverati};
    }



}