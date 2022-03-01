import {common} from "../common.js";
import md5File from "md5-file";
import fs from "fs";
import * as xml2js from "xml2js";
import { promisify } from 'util';
import moment from "moment";

export class FlussoHOSPICE {
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
        //let out = {}
        for (let assistenza of result["HspAttivita"]["Assistenza"])
        {
            let inizio = moment(assistenza["PresaInCarico"][0]["DataRicovero"][0], "YYYY-MM-DD");
            let fine = moment(assistenza["Conclusione"][0]["DataDimissione"][0], "YYYY-MM-DD");
            let differenza = Math.round(moment.duration(fine.diff(inizio)).asDays());
            somma+= differenza >0 ? differenza : 1;
        }
        return somma
    }

    async calcolaGiornate() {
        let fileOut = {}
        let allFiles = common.getAllFilesRecursive(this._settings.in_folder, this._settings.extensions, "att")
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

}