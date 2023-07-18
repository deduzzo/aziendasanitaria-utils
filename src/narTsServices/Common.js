import ExcelJS from "exceljs";
import moment from "moment-timezone";

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
    static async scriviOggettoSuFileExcel(filename, accoppiateOggettoColonna, data, toWriteOnly = []) {
        var workbook = new ExcelJS.Workbook();
        let fileExcel = await workbook.xlsx.readFile(filename);
        let worksheet = (await fileExcel).worksheets[0];
        for (let riga of data) {
            let keys = Object.keys(riga).filter(key => key !== "_index");
            for (let key of keys) {
                let toWrite = true;
                if (toWriteOnly.length > 0)
                    if (!toWriteOnly.includes(key))
                        toWrite = false;
                if (toWrite)
                    worksheet.getRow(riga._index + 1).getCell(accoppiateOggettoColonna[key]).value = riga[key];
            }
        }
        await fileExcel.xlsx.writeFile(filename);
    }
}
