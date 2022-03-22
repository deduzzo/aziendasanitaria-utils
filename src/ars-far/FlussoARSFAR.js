import {common} from "../common.js";
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

}