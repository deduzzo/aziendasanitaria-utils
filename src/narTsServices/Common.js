import ExcelJS from "exceljs";
import moment from "moment-timezone";
import fs from "fs";
import CodiceFiscaleUtils from "@marketto/codice-fiscale-utils";
import {common} from "../common.js";
import _ from "lodash";

export class Common {

    static async creaOggettoDaFileExcel(filename, accoppiateOggettoColonna, limit = null) {
        let out = [];
        var workbook = new ExcelJS.Workbook();
        let fileExcel = await workbook.xlsx.readFile(filename);
        let worksheet = (await fileExcel).worksheets[0];
        for (let i = 0; i < worksheet.rowCount; i++) {
            if (i > 1) {
                let riga = {_index: i - 1};
                let keys = Object.keys(accoppiateOggettoColonna)
                for (let key of keys) {
                    try {
                        if (worksheet.getRow(i).getCell(accoppiateOggettoColonna[key]).value === undefined || worksheet.getRow(i).getCell(accoppiateOggettoColonna[key]).value === null)
                            riga[key] = null;
                        else if (worksheet.getRow(i).getCell(accoppiateOggettoColonna[key]).value.constructor.name === "String")
                            riga[key] = worksheet.getRow(i).getCell(accoppiateOggettoColonna[key]).value?.trim()?.toUpperCase() ?? null;
                        else if (worksheet.getRow(i).getCell(accoppiateOggettoColonna[key]).value.constructor.name === "Date")
                            // get the date in dd/mm/yyyy format
                            riga[key] = moment(worksheet.getRow(i).getCell(accoppiateOggettoColonna[key]).value).format("DD/MM/YYYY");
                        else
                            riga[key] = worksheet.getRow(i).getCell(accoppiateOggettoColonna[key]).value ?? null;
                    } catch (e) {
                        riga[key] = null;
                    }
                }
                out.push(riga);
                if (limit)
                    if (i > limit)
                        break;
            }
        }
        return out;
    }

    // function similar to creaOggettoDaFileExcel but that write in the some manner accoppiaOggettoColonna, index is stored in _index
    static async scriviOggettoSuFileExcel(filename, accoppiateOggettoColonna, data, filter = [], scriviHeader = false) {
        var workbook = new ExcelJS.Workbook();
        let fileExcel = await workbook.xlsx.readFile(filename);
        let worksheet = (await fileExcel).worksheets[0];
        if (scriviHeader)
            for (let key of Object.keys(accoppiateOggettoColonna))
                worksheet.getRow(1).getCell(accoppiateOggettoColonna[key]).value = key;
        for (let riga of data) {
            let keys = Object.keys(riga).filter(key => key !== "_index");
            for (let key of keys) {
                let toWrite = true;
                if (filter.length > 0)
                    if (!filter.includes(key))
                        toWrite = false;
                if (toWrite)
                    worksheet.getRow(riga._index + 1).getCell(accoppiateOggettoColonna[key]).value = riga[key];
            }
        }
        await fileExcel.xlsx.writeFile(filename);
    }

    static async scriviOggettoSuNuovoFileExcel(filename,data, customHeader = null, scriviHeader = true) {
        var workbook = new ExcelJS.Workbook();
        // fileExcel will be a new file
        let worksheet = workbook.addWorksheet('dati');
        if (scriviHeader) {
            if (customHeader)
                worksheet.addRow(Object.values(customHeader));
            else
                worksheet.addRow(Object.keys(data[0]));
        }
        for (let riga of data) {
            worksheet.addRow(Object.values(riga));
        }
        await workbook.xlsx.writeFile(filename);
    }

    // a function that write a txt file with the data as array, parameters: path and array
    static async scriviOggettoSuFileTxt(filename, data) {
        // write a file with the data
        await fs.writeFileSync(filename, JSON.stringify(data, common.replacer, "\t"), 'utf8');
    }


    static estraiDataDiNascita(codiceFiscale) {
        // Estra i caratteri relativi alla data di nascita
        let anno = parseInt(codiceFiscale.substring(6, 8));
        let mese = codiceFiscale.substring(8, 9);
        let giorno = parseInt(codiceFiscale.substring(9, 11));

        // Corregge il giorno per le donne
        if (giorno > 40) {
            giorno -= 40;
        }

        // Converte il mese in numerico
        const meseMap = {
            'A': '01',
            'B': '02',
            'C': '03',
            'D': '04',
            'E': '05',
            'H': '06',
            'L': '07',
            'M': '08',
            'P': '09',
            'R': '10',
            'S': '11',
            'T': '12'
        };
        mese = meseMap[mese];

        // Estende l'anno a quattro cifre
        anno = anno > moment().year().toString().substring(2, 4) ? 1900 + anno : 2000 + anno;

        // Restituisce la data in formato dd/mm/yyyy
        let stringDate = `${giorno.toString().padStart(2, '0')}/${mese}/${anno}`;
        let momentDate = moment(stringDate, "DD/MM/YYYY");
        let eta = moment().diff(momentDate, 'years');
        return {dataString: stringDate, eta: eta};
    }

    static contaAssistitiPerCriterio(codiciFiscali, comparator, value) {
        //comparator is a string that can be "<", ">", "<=", ">=", "="
        //value is the value to compare
        //assistiti is an array of {dataString: x, eta: y}
        //return the number of assistiti that match the criterio using eta
        let out = 0;
        for (let cf of codiciFiscali) {
            let dataCf =    Common.estraiDataDiNascita(cf);
            console.log(dataCf.eta);
            switch (comparator) {
                case "<":
                    if (dataCf.eta < value)
                        out++;
                    break;
                case ">":
                    if (dataCf.eta > value)
                        out++;
                    break;
                case "<=":
                    if (dataCf.eta <= value)
                        out++;
                    break;
                case ">=":
                    if (dataCf.eta >= value)
                        out++;
                    break;
                case "=":
                    if (dataCf.eta === value)
                        out++;
                    break;
            }
        }
        return out;
    }
}
