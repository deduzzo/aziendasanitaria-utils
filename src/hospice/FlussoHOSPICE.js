import {utils} from "../Utils.js";
import md5File from "md5-file";
import fs from "fs";
import * as xml2js from "xml2js";
import { promisify } from 'util';
import moment from "moment";


export class FlussoHOSPICE {
    /**
     * @param {ImpostazioniFlussoHOSPICE} settings - Settings
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

    async #calcolaGiornateDaFile(file) {
        const parser = new xml2js.Parser({attrkey: "ATTR"});
        let xml_string = fs.readFileSync(file, "utf8");
        const result = await promisify(parser.parseString)(xml_string);
        let somma = 0;
        let out = "";
        for (let assistenza of result["HspAttivita"]["Assistenza"])
        {
            let inizio = moment(assistenza["PresaInCarico"][0]["DataRicovero"][0], "YYYY-MM-DD");
            let fine = moment(assistenza["Conclusione"][0]["DataDimissione"][0], "YYYY-MM-DD");
            let differenza = Math.round(moment.duration(fine.diff(inizio)).asDays());
            let dif = differenza >0 ? differenza : 1;
            out+= 'id: ' + assistenza["PresaInCarico"][0]["Id_Rec"][0] + ' inizio: '+ inizio.format('DD/MM/YYYY') + ' fine: '+ fine.format('DD/MM/YYYY') + ' giorni:  '+dif + '\n';
            somma+= dif;
        }

        out+= "\n\n TOTALE:" + somma;

        return somma
    }

    async #calcolaPazientiDaFile(file) {
        const parser = new xml2js.Parser({attrkey: "ATTR"});
        let xml_string = fs.readFileSync(file, "utf8");
        const result = await promisify(parser.parseString)(xml_string);
        return result["HspAttivita"]["Assistenza"].length;
    }

    async calcolaGiornate() {
        let fileOut = {}
        let allFiles = utils.getAllFilesRecursive(this._settings.in_folder, this._settings.extensions, "att")
        let somma = 0;
        for (let file of allFiles) {
            let md5 = md5File.sync(file);
            if (!fileOut.hasOwnProperty(md5)) {
                fileOut[md5] = await this.#calcolaGiornateDaFile(file)
                somma+= fileOut[md5];
            }
        }
        return somma;
    }

    async calcolaUtenti() {
        let fileOut = {}
        let allFiles = utils.getAllFilesRecursive(this._settings.in_folder, this._settings.extensions, "att")
        let somma = 0;
        for (let file of allFiles) {
            let md5 = md5File.sync(file);
            if (!fileOut.hasOwnProperty(md5)) {
                fileOut[md5] = await this.#calcolaPazientiDaFile(file)
                somma+= fileOut[md5];
            }
        }
        return somma;
    }

}