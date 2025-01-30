import path from "path";
import * as nodemailer from "nodemailer";
import fs from 'fs-extra'
import moment from "moment-timezone";
import puppeteer from 'puppeteer';
import emlFormat from "eml-format";
import MsgReader from '@freiraum/msgreader';
import pdf2html from "pdf2html";
import ExcelJS from "exceljs";
import excel from "excel-date-to-js";
import {Parser} from "@marketto/codice-fiscale-utils";
import os from "os";
import {existsSync, mkdirSync} from "fs";
import libre from "libreoffice-convert";
import {promisify} from "util";
import BigJSON from "big-json";
import {pack, Packr, unpack} from "msgpackr";
import zlib from 'zlib';
import archiver from 'archiver';
import unzipper from 'unzipper';
import _ from "lodash";
import crypto from "crypto";
import AdmZip from 'adm-zip';

moment.tz.setDefault('Europe/Rome');

const mesi = {
    "01": "Gennaio",
    "02": "Febbraio",
    "03": "Marzo",
    "04": "Aprile",
    "05": "Maggio",
    "06": "Giugno",
    "07": "Luglio",
    "08": "Agosto",
    "09": "Settembre",
    "10": "Ottobre",
    "11": "Novembre",
    "12": "Dicembre"
}

const meseNumero = {
    "gennaio": 1,
    "febbraio": 2,
    "marzo": 3,
    "aprile": 4,
    "maggio": 5,
    "giugno": 6,
    "luglio": 7,
    "agosto": 8,
    "settembre": 9,
    "ottobre": 10,
    "novembre": 11,
    "dicembre": 12
}

const defaultJobConfig = {
    includiIndirizzo: true,
    numParallelsJobs: 10,
    visibile: false,
    verbose: true,
    legacy: false,
    datiMedicoNar: null,
    dateSceltaCfMap: null,
    sogei: true,
    nar2: true,
    salvaFile: true,
    index: 1,
    callback: {
        fn: null,
        params: {}
    }
};

const getFinalConfigFromTemplate = (config, template = defaultJobConfig) => {
    let outConfig = _.cloneDeep(template);
    for (let key in config) {
        outConfig[key] = config[key];
    }

    const validKeys = [...Object.keys(template)];
    const invalidKeys = Object.keys(config).filter(key => !validKeys.includes(key));

    if (invalidKeys.length > 0)
        throw new Error(`Chiavi di configurazione non valide: ${invalidKeys.join(', ')}`);
    else
        return outConfig;
}

const getAllFilesRecursive = (dirPath, extensions, filterFileName = null, arrayOfFiles = []) => {
    let files = fs.readdirSync(dirPath)

    files.forEach(function (file) {
        try {
            if (fs.statSync(dirPath + path.sep + file).isDirectory()) {
                arrayOfFiles = getAllFilesRecursive(dirPath + path.sep + file, extensions, filterFileName, arrayOfFiles)
            } else {
                //arrayOfFiles.push(path.join(__dirname, dirPath, "/", file))
                if (path.extname(file) !== "" && extensions.includes(path.extname(file).toLowerCase()) &&
                    (filterFileName === null || path.basename(file).toLowerCase().includes(filterFileName.toLowerCase()))
                )
                    arrayOfFiles.push(path.join(dirPath, path.sep, file))
            }
        } catch (ex) {
            console.log(ex);
        }
    })
    return arrayOfFiles
}

/**
 * @param {ImpostazioniMail} settings Impostazioni mail
 * @param {Array} destinatari Destinatari in array
 * @param {String} oggetto Oggetto Mail
 * @param {String} corpo Corpo mail in HTML
 * @param {Array} pathAllegati Array Path Allegati
 */
const inviaMail = async (settings, destinatari, oggetto, corpo, pathAllegati = []) => {
    const arrayDestinatariToString = (allDest) => {
        let out = "";
        for (let dest of allDest)
            out += dest + ","
        console.log(out.substring(0, out.length - 1))
        return out.substring(0, out.length - 1);
    }
    let transporter = nodemailer.createTransport({
        host: settings.host,
        port: settings.porta,
        auth: {
            user: settings.user,
            pass: settings.password,
        }
    });
// send mail with defined transport object
    let mail = {
        from: settings.mittente,
        to: arrayDestinatariToString(destinatari), // list of receivers
        subject: oggetto, // Subject line
        html: corpo, // html body
    }
    pathAllegati.forEach((allegato) => {
        if (!mail.hasOwnProperty("attachments")) mail.attachments = [];
        mail.attachments.push(
            {
                filename: path.basename(allegato),
                content: fs.createReadStream(allegato)
            })
    })

    let info = null;
    try {
        info = await transporter.sendMail({...mail});
        console.log("Message sent: %s", info.messageId);
        return {error: false, messageId: info.messageId};
    } catch (ex) {
        return {error: true, errorTxt: ex}
    }
}

const creaCartellaSeNonEsisteSvuotalaSeEsiste = (cartella) => {
    fs.emptyDirSync(cartella);
}

const mRowToJson = (row, starts) => {
    var obj = {}
    let from = 0;
    for (let key in starts) {
        obj[key] = row.substr(from, starts[key].length).trim().toUpperCase();
        if (starts[key].type === "date") {
            if (moment(obj[key], "DDMMYYYY").isValid())
                obj[key] = moment(obj[key], "DDMMYYYY");
        } else if (starts[key].type === "double")
            obj[key] = obj[key] === "" ? 0 : parseFloat(obj[key].replace(',', '.'));
        else if (starts[key].type === "int")
            obj[key] = parseInt(obj[key]);
        from += starts[key].length;
    }
    return obj;
};

const verificaLunghezzaRiga = (starts) => {
    let lunghezza = 0;
    for (let val of Object.values(starts))
        lunghezza += val.length;
    return lunghezza;
}

const ottieniDatiAssistito = async (codiceFiscale, user, password) => {
    // arraystrutture: {mese, anno, codiceRegione, codiceAsl, codiceStruttura}
    const maxRetryOriginal = 5;
    let maxRetry = maxRetryOriginal;
    let out = {error: false, out: {}}
    let datiAssistito = {};
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    try {
        await page.goto('https://sistemats4.sanita.finanze.it/simossHome/login.jsp');
        await page.type("#j_username", user);
        await page.type("#j_password", password);
        await page.click("#login > fieldset > input:nth-child(11)");
        await page.waitForSelector('#dettaglio_utente')
        console.log("loaded")
    } catch (ex) {
        out.error = true;
        out.errortext = "Generic error1";
    }
    if (!out.error) {
        await page.goto("https://sistemats4.sanita.finanze.it/simossAssistitiWeb/assistitiInit.do", {waitUntil: 'networkidle2'});
        await page.type("body > div:nth-child(12) > form > fieldset > div:nth-child(2) > div.right_column.margin-right.width25 > input[type=text]", user);
        await page.click('#go');
        await page.waitForSelector(' body > div:nth-child(12)');
        let datiAssistito = await page.evaluate(() => {
            let datiAssistito = {
                'codiceFiscale': document.querySelector("body > div:nth-child(12) > div:nth-child(3) > div.cellaAss59 > div").innerHTML.replaceAll('&nbsp;', '').trim(),
                'cognome': document.querySelector("body > div:nth-child(12) > div:nth-child(5) > div.cellaAss59 > div").innerHTML.replaceAll('&nbsp;', '').trim(),
                'nome': document.querySelector('body > div:nth-child(12) > div:nth-child(7) > div.cellaAss59 > div').innerHTML.replaceAll('&nbsp;', '').trim(),
                'sesso': document.querySelector('body > div:nth-child(12) > div:nth-child(9) > div.cellaAss59 > div').innerHTML.replaceAll('&nbsp;', '').trim(),
                'dataNascita': document.querySelector('body > div:nth-child(12) > div:nth-child(11) > div.cellaAss59 > div').innerHTML.replaceAll('&nbsp;', '').trim(),
                'comuneNascita': document.querySelector('body > div:nth-child(12) > div:nth-child(13) > div.cellaAss59 > div').innerHTML.replaceAll('&nbsp;', '').trim().substring(0, document.querySelector('body > div:nth-child(12) > div:nth-child(13) > div.cellaAss59 > div').innerHTML.replaceAll('&nbsp;', '').indexOf('(') - 1),
                'provinciaNascita': document.querySelector('body > div:nth-child(12) > div:nth-child(13) > div.cellaAss59 > div').innerHTML.replaceAll('&nbsp;', '').trim().substring(document.querySelector('body > div:nth-child(12) > div:nth-child(13) > div.cellaAss59 > div').innerHTML.replaceAll('&nbsp;', '').indexOf('(') + 1, document.querySelector('body > div:nth-child(12) > div:nth-child(13) > div.cellaAss59 > div').innerHTML.replaceAll('&nbsp;', '').indexOf(')'))
            };
            return datiAssistito;
        });
        console.log(datiAssistito);
        await browser.close()
    }
    return datiAssistito;
}


const extractAttachmentsEml = async (sourceFolder, destinationFolder) => {
    // Assicurarsi che la cartella di destinazione esista
    await fs.ensureDir(destinationFolder);

    let files = await fs.readdir(sourceFolder);

    for (let file of files) {
        if (path.extname(file) === '.eml') {
            const emlFilePath = path.join(sourceFolder, file);

            let emlContent = await fs.readFile(emlFilePath, 'utf8');

            let email = await new Promise((resolve, reject) => {
                emlFormat.read(emlContent, (err, email) => {
                    if (err) reject(err);
                    resolve(email);
                });
            });

            if (email.attachments) {
                for (let attachment of email.attachments) {
                    const outputPath = path.join(destinationFolder, attachment.filename);
                    await fs.writeFile(outputPath, attachment.data);
                    console.log('Allegato estratto:', outputPath);
                }
            }
        }
    }
}


const extractAttachmentsMsg = async (sourceFolder, destinationFolder) => {
    await fs.ensureDir(destinationFolder);
    let files = await fs.readdir(sourceFolder);

    for (let file of files) {
        if (path.extname(file).toLowerCase() === '.msg') {
            const msgFilePath = path.join(sourceFolder, file);

            let buffer = await fs.readFile(msgFilePath);
            const msgReader = new MsgReader.default(buffer);
            const msg = msgReader.getFileData();

            if (!msg.error) {
                if (msg.attachments && msg.attachments.length) {
                    for (let attachment of msg.attachments) {
                        const attachmentData = msgReader.getAttachment(attachment);
                        if (attachmentData && attachmentData.fileName) {
                            const outputPath = path.join(destinationFolder, attachmentData.fileName);
                            await fs.writeFile(outputPath, attachmentData.content);
                            console.log('Allegato estratto:', outputPath);
                        } else {
                            console.warn(`Non è stato possibile estrarre un allegato da ${msgFilePath}`);
                        }
                    }
                }
            } else {
                console.error(`Errore durante la lettura del file: ${msgFilePath}`);
            }
        }
    }
};

const onlyFirstDigitMaiusc = (str, sep = " ") => {
    let strsplitted = str.split(" ");
    let out = "";
    for (let str of strsplitted) {
        if (str.trim() !== "") {
            str = str.trim();
            out += str.charAt(0).toUpperCase();
            out += str.substring(1).toLowerCase();
            out += sep;
        }
    }
    return out.substring(0, out.length - 1);
}

const rinominaCedolini = async (in_path) => {
    let arrayMonth = {
        "GEN": 1,
        "FEB": 2,
        "MAR": 3,
        "APR": 4,
        "MAG": 5,
        "GIU": 6,
        "LUG": 7,
        "AGO": 8,
        "SET": 9,
        "OTT": 10,
        "NOV": 11,
        "DIC": 12
    }
    let arrayNameOfMonth = {
        1: "gennaio",
        2: "febbraio",
        3: "marzo",
        4: "aprile",
        5: "maggio",
        6: "giugno",
        7: "luglio",
        8: "agosto",
        9: "settembre",
        10: "ottobre",
        11: "novembre",
        12: "dicembre"
    }
    let files = await fs.readdirSync(in_path);
    const outPath = in_path + path.sep + "out";
    await fs.ensureDir(outPath);
    for (let file of files) {
        if (path.extname(file).toLowerCase() === '.pdf') {
            const data = await pdf2html.text(in_path + path.sep + file);
            const rows = data.split("\n");
            const nomeRows = rows[8].split("     ");
            const nome = onlyFirstDigitMaiusc(nomeRows[nomeRows.length - 1], "_");
            let dataCorsista = moment(rows[10].split("                ")[1], "DD/MM/YY");
            let annoCorsista = dataCorsista.get().year();
            let mese = arrayMonth[file.substring(file.length - 7, file.length - 4)]
            let annoCedolino = mese < 9 ? file.substring(file.length - 12, file.length - 8) : file.substring(file.length - 13, file.length - 9);
            let newName = nome + "_" + annoCorsista + "_" + (annoCorsista + 3) + "_" + arrayNameOfMonth[mese] + "_" + annoCedolino + "_cedolino.pdf";
            //copy the file to the folder outPath with name newName
            console.log("copio " + file + " nome nuovo " + newName);
            await fs.copyFile(in_path + path.sep + file, outPath + path.sep + newName);
        }
    }
}


const creaOggettoDaFileExcel = async (filename, accoppiateOggettoColonna, limit = null) => {
    let out = [];
    var workbook = new ExcelJS.Workbook();
    let fileExcel = await workbook.xlsx.readFile(filename);
    let worksheet = (await fileExcel).worksheets[0];
    for (let i = 0; i <= worksheet.rowCount; i++) {
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

const scriviOggettoSuNuovoFileExcel = async (filename, data, customHeader = null, scriviHeader = true) => {
    var workbook = new ExcelJS.Workbook();
    // if data is array, convert it to object
    let worksheet = workbook.addWorksheet('dati');
    if (data && Object.values(data).length > 0) {
        if (scriviHeader) {
            if (typeof data[0] !== "string") {
                if (customHeader)
                    worksheet.addRow(Object.values(customHeader));
                else
                    worksheet.addRow((data !== null) ? Object.keys(data[0]) : "");
            } else
                worksheet.addRow([customHeader]);
        }
        for (let riga of data) {
            if (typeof riga !== "string")
                worksheet.addRow(Object.values(riga));
            else
                worksheet.addRow([riga]);
        }
    }
    await workbook.xlsx.writeFile(filename);
}

// a function that write a txt file with the data as array, parameters: path and array
const scriviOggettoSuFile = async (filename, data) => {

    const replacer = (key, value) => {
        if (value instanceof Map) {
            return {
                dataType: 'Map',
                value: Array.from(value.entries()), // or with spread: value: [...value]
            };
        } else {
            return value;
        }
    }

    // write a file with the data
    await fs.writeFileSync(filename, JSON.stringify(data, replacer, "\t"), 'utf8');
}


const scriviGrossoOggettoSuFileJSON = (filename, data) => {
    return new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(filename);
        const stringifyStream = BigJSON.createStringifyStream({
            body: data
        });

        stringifyStream.pipe(writeStream);

        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });
}

const leggiOggettoMP = async (filename = "dati.bin") => {

    const ungzip = promisify(zlib.gunzip);

    const packr = new Packr({
        variableMapSize: true,
        useRecords: false,
        structuredClone: true,
        moreTypes: true,
        useFloat32: false
    });

    try {
        console.log('🚀 Lettura file...');
        const buffer = await fs.promises.readFile(filename);

        console.log('🚀 Decompressione GZIP...');
        const decompressed = await ungzip(buffer);

        console.log('🚀 Decompressione MessagePack...');
        return packr.unpack(decompressed);
    } catch (error) {
        console.log('🚀 Errore:', error);
        return null
    }
};

const scriviOggettoMP = async (data, filename = "dati.bin") => {
    const packr = new Packr({
        variableMapSize: true,
        useRecords: false,
        structuredClone: true,
        moreTypes: true,           // Supporto per più tipi di dati
        useFloat32: false          // Usa float64 per maggiore precisione
    });

    const gzip = promisify(zlib.gzip);


    console.log('🚀 Compressione dati MessagePack...');
    const packed = packr.pack(data);

    console.log('🚀 Compressione GZIP...');
    const compressed = await gzip(packed, {level: 9}); // massimo livello di compressione

    console.log('🚀 Salvataggio file...');
    await fs.promises.writeFile(filename, compressed);

    console.log('🚀 Completato');
};


const estraiDataDiNascita = (codiceFiscale) => {
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

const getObjectFromFileExcel = async (filePath, numSheet = null, usaHeader = true, startFromRows = null) => {
    let out = [];
    let header = {};
    let workbook = new ExcelJS.Workbook();
    let fileExcel = await workbook.xlsx.readFile(filePath);
    let selectedWs = !numSheet ? fileExcel.worksheets : [fileExcel.worksheets[numSheet]];

    for (let worksheet of selectedWs) {
        worksheet.eachRow({includeEmpty: false}, (row, rowNumber) => {
            if (!startFromRows || rowNumber >= startFromRows) {
                let riga = {};
                if ((startFromRows == null && rowNumber === 1) || (startFromRows && rowNumber === startFromRows)) {
                    row.eachCell({includeEmpty: false}, (cell, colNumber) => {
                        colNumber = colNumber - 1;
                        if (usaHeader) {
                            let headerTemp = "";
                            if (cell.value.richText)
                                for (let text of cell.value.richText)
                                    headerTemp += text.text;
                            else
                                headerTemp = cell.value;
                            header[colNumber] = headerTemp;
                        } else
                            header[colNumber] = colNumber;
                    });
                } else {
                    /*                row.eachCell({includeEmpty: true}, (cell, colNumber) => {
                                        riga[header[colNumber]] = cell.value ?? "";
                                    });*/
                    Object.keys(header).forEach((key) => {
                        riga[header[key]] = row._cells[key]?._value.model.value ?? "";
                    });
                    out.push(riga);
                }
            }
        });
    }

    return out;
}


const contaAssistitiPerCriterio = (codiciFiscali, comparator, value) => {
    //comparator is a string that can be "<", ">", "<=", ">=", "="
    //value is the value to compare
    //assistiti is an array of {dataString: x, eta: y}
    //return the number of assistiti that match the criterio using eta
    let out = 0;
    for (let cf of codiciFiscali) {
        let dataCf = this.estraiDataDiNascita(cf);
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


const parseDateExcel = (excelTimestamp) => {
    let date = null;
    try {
        date = moment.utc(excel.getJsDateFromExcel(excelTimestamp));
    } catch (ex) {
        sails.log.error(excelTimestamp);
        return null;
    }
    if (!moment(date).isValid())
        return null;
    else return date.tz(tz).unix();
}

const compareDate = (unixDate1, unixDate2) => {
    return moment.unix(unixDate1).isSame(moment.unix(unixDate2), 'day');
}

const dataFromStringToUnix = (date) => {
    if (moment(date, 'DD/MM/YYYY').isValid())
        return moment(date, 'DD/MM/YYYY').unix();
    else
        return null;
}

const dataFromUnixToString = (date) => {
    if (moment.unix(date).isValid() && date != null)
        return moment.unix(date).format('DD/MM/YYYY');
    else
        return null;
}

const nowToUnixDate = () => {
    return moment().unix();
}


const getAgeFromCF = (codiceFiscale) => {
    // Estrai la data di nascita dal codice fiscale
    const birthdate = moment(Parser.cfToBirthDate(codiceFiscale));

    let years = moment().diff(birthdate, 'years', false);

    return years;
}

const calcolaDifferenzaGiorniPerAnno = (dataInizio, dataFine, numGiorniPerVerifica) => {
    if (moment(dataInizio).isValid() && moment(dataFine).isValid() && moment(dataInizio).isSameOrBefore(dataFine)) {
        const giorniPerAnno = {};
        let totali = 0;
        let annoCorrente;
        let dataCorrente = moment.utc(dataInizio);
        while (dataCorrente.isBefore(dataFine)) {
            annoCorrente = dataCorrente.year();
            const fineAnno = moment.utc(dataCorrente).endOf('year');

            let giorniDiff;
            if (fineAnno.isAfter(dataFine)) {
                giorniDiff = dataFine.diff(dataCorrente, 'days') + 1;
                dataCorrente = dataFine;
            } else {
                giorniDiff = fineAnno.diff(dataCorrente, 'days') + 1;
                dataCorrente = fineAnno.add(1, 'day');
            }

            giorniPerAnno[annoCorrente] = (giorniPerAnno[annoCorrente] || 0) + giorniDiff;
            totali += giorniDiff;
        }

        const diffTotale = totali - numGiorniPerVerifica;
        if (diffTotale !== 0) {
            giorniPerAnno[annoCorrente] -= diffTotale;
            totali -= diffTotale;
        }


        return {perAnno: giorniPerAnno, totale: totali};
    } else return null;
};

const decodeHtml = (html) => {
    let txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}

const leggiOggettoDaFileJSON = async (filename) => {
    let out = [];
    let data = await fs.readFileSync(filename, 'utf8');
    out = JSON.parse(data);
    return out;
}

/**
 * Scrive un oggetto su file e lo comprime in formato ZIP
 * @param {string} filename - Nome del file da creare
 * @param {Array|Object} data - Dati da scrivere nel file
 * @param {string} [zipFilename] - Nome del file ZIP di output (opzionale)
 * @returns {Promise<void>}
 */
const scriviEComprimiFile = async (filename, data) => {
    try {
        // Scriviamo prima il file
        await scriviOggettoSuFile(filename, data);

        // Creiamo il nome del file zip
        const outputZipFile = filename.replace(/\.[^/.]+$/, '') + '.zip';

        // Creiamo una nuova istanza di AdmZip
        const zip = new AdmZip();

        // Aggiungiamo il file allo zip
        zip.addLocalFile(filename);

        // Scriviamo il file zip
        await new Promise((resolve, reject) => {
            zip.writeZip(outputZipFile, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });

        // Eliminiamo il file originale
        await fs.promises.unlink(filename);

        console.log('Compressione completata con successo');

    } catch (error) {
        console.error('Errore durante la compressione:', error);
        throw error;
    }
};

/**
 * Decomprime un file ZIP e restituisce i dati contenuti
 * @param {string} zipFilename - Nome del file ZIP da decomprimere
 * @returns {Promise<Array|Object>} - Dati contenuti nel file
 */
const decomprimiELeggiFile = async (zipFilename) => {
    try {
        // Verifichiamo che il file esista
        if (!fs.existsSync(zipFilename)) {
            throw new Error(`Il file ${zipFilename} non esiste`);
        }

        // Creiamo una directory temporanea per l'estrazione
        const tempDir = path.join(path.dirname(zipFilename), 'temp_extract');
        await fs.promises.mkdir(tempDir, {recursive: true});

        // Estraiamo il contenuto del ZIP
        await fs.createReadStream(zipFilename)
            .pipe(unzipper.Extract({path: tempDir}))
            .promise();

        // Troviamo il primo file nella directory temporanea
        const files = await fs.promises.readdir(tempDir);
        if (files.length === 0) {
            throw new Error('ZIP vuoto');
        }

        // Leggiamo il contenuto del file
        const extractedFilePath = path.join(tempDir, files[0]);
        const content = await fs.promises.readFile(extractedFilePath, 'utf8');

        // Puliamo la directory temporanea
        await fs.promises.rm(tempDir, {recursive: true});

        // Parsifichiamo il JSON
        return JSON.parse(content, (key, value) => {
            if (value && value.dataType === 'Map' && Array.isArray(value.value)) {
                return new Map(value.value);
            }
            return value;
        });
    } catch (error) {
        console.error('Errore durante la decompressione:', error);
        throw error;
    }
};

const calcolaMesiDifferenza = (dataInizio, dataFine = null) => {
    dataInizio = moment(dataInizio, "DD/MM/YYYY");
    if (dataFine == null)
        dataFine = moment();
    else
        dataFine = moment(dataFine, "DD/MM/YYYY");
    if (moment(dataInizio).isValid() && dataFine.isValid() && dataInizio.isSameOrBefore(dataFine)) {
        return dataFine.diff(moment(dataInizio), 'months', false);
    } else return 0;
}

const getWorkingPath = () => {
    let wp = path.join(os.homedir(), 'flussi_sanitari_wp', moment().format('YYYYMMDD'));
    if (existsSync(wp) === false)
        mkdirSync(wp, {recursive: true});
    return wp;
}

const convertDocxToPdf = async (docxPath, pdfPath) => {
    libre.convertAsync = promisify(libre.convert);
    try {
        const docxBuffer = fs.readFileSync(docxPath);
        const pdfBuffer = await libre.convertAsync(docxBuffer, '.pdf', undefined);
        fs.writeFileSync(pdfPath, pdfBuffer);
    } catch (error) {
        console.error(`Error converting file: ${error}`);
    }
}

const riunisciJsonDaTag = async (path, tag, filter = null) => {
    let files = getAllFilesRecursive(path, ".json", filter);
    let out = {};
    out[tag] = [];
    for (let file of files) {
        let data = await leggiOggettoDaFileJSON(file);
        if (typeof data[tag] === "object")
            out[tag].push(...Object.values(data[tag]));
        else
            out[tag].push(...data[tag]);
    }
    return out;
}

const replaceNullWithEmptyString = (obj) => {
    return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [
            key,
            value === null ? "" : value
        ])
    );
}

const removeKeyIfExist = (obj, key) => {
    if (obj.hasOwnProperty(key))
        delete obj[key];
    return obj;
}

const ottieniEtaDaDataDiNascita = (dataNascita, eventualeDataDecesso = null) => {
    if (moment(dataNascita, 'DD/MM/YYYY').isValid()) {
        let eta = moment().diff(moment(dataNascita, 'DD/MM/YYYY'), 'years');
        if (eventualeDataDecesso && moment(eventualeDataDecesso, 'DD/MM/YYYY').isValid())
            eta = moment(eventualeDataDecesso, 'DD/MM/YYYY').diff(moment(dataNascita, 'DD/MM/YYYY'), 'years');
        return eta;
    } else {
        return null;
    }
}

const trovaPICfromData = (ids, data) => {
    if (!ids || ids.length === 0) return null;

    const sortedIds = [...ids].sort();

    let selectedID = -1;
    for (let i = 0; i < sortedIds.length; i++) {
        const dateOfid = moment(sortedIds[i].substring(6, 16), "YYYY-MM-DD");
        if (dateOfid <= data) {
            selectedID = i;
        } else {
            break;
        }
    }

    if (selectedID === -1) {
        return {
            precedenti: [],
            corrente: null,
            successive: sortedIds
        };
    }

    return {
        precedenti: sortedIds.slice(0, selectedID),
        corrente: sortedIds[selectedID],
        successive: sortedIds.slice(selectedID + 1)
    };
};

/**
 * Trova la data precedente e successiva in un array di stringhe
 * @param {string} dataAttivita - Data nel formato YYYY-MM-DD
 * @param {string[]} array - Array di stringhe che iniziano con date nel formato YYYY-MM-DD
 * @returns {Object|null} Oggetto con date precedente e successiva, o null se l'array è vuoto
 */
const trovaDataPicDaAttivita = (dataAttivita, array) => {
    // Se l'array è vuoto, restituisci null
    if (!dataAttivita || !array || Object.keys(array).length === 0) {
        return null;
    }
    let scartate = 0;
    const keys = Object.keys(array);
    let kysOk = [];
    for (let key of keys) {
        const obj = array[key];
        const fine = moment(obj.fine, "YYYY-MM-DD");
        const fineReale = moment(obj.fine_reale, "YYYY-MM-DD");
        const inizio = moment(obj.inizio, "YYYY-MM-DD");
        const durataTeorica = fine.diff(inizio, 'days');
        const durataReale = fineReale.diff(inizio, 'days');
        // se la durata reale è superiore alla metà di quella teorica
        if (durataReale > durataTeorica / 3)
            kysOk.push(key);
        else
            scartate++;
    }

    // Estrai le date dall'inizio di ogni stringa (primi 10 caratteri)
    const dates = kysOk.map(str => str.substring(0, 10));

    // Ordina le date
    dates.sort();

    let corrente = null;
    let successiva = null;

    // Trova la data precedente e successiva
    for (let i = 0; i < dates.length; i++) {
        if (dates[i] <= dataAttivita) {
            corrente = dates[dates.indexOf(dates[i])];
        } else {
            successiva = dates[dates.indexOf(dates[i])];
            break;
        }
    }
    if (scartate > 0)
        console.log("Scartate: " + scartate);
    return {
        corrente,
        successiva
    };
}

const waitForTimeout = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Converte una data (stringa `DD/MM/YYYY`) in un timestamp Unix (secondi).
 * @param {string} dateStr - La data in formato "gg/mm/aaaa", es. "03/01/1986".
 * @param {string} timeZone - Il fuso orario di riferimento (es. "Europe/Rome" o "UTC").
 * @returns {number} Il timestamp in secondi (UTC).
 */
function convertToUnixSeconds(dateStr, timeZone = 'Europe/Rome') {
    // Esempio: '03/01/1986'
    // Parse come "DD/MM/YYYY" nel timezone specificato
    const m = moment.tz(dateStr, 'DD/MM/YYYY', timeZone);

    // Se vuoi forzare l’orario a mezzanotte (nel caso la stringa non contenga orario)
    // puoi fare: m.startOf('day');

    // Ottieni il timestamp in secondi
    return m.unix();
}

/**
 * Converte un timestamp Unix (secondi) in una stringa "DD/MM/YYYY" (o altro formato),
 * forzando un certo fuso orario.
 *
 * @param {number} unixSeconds - Il timestamp Unix in secondi.
 * @param {string} timeZone - Il fuso orario di riferimento (ad es. 'Europe/Rome' o 'UTC').
 * @param {string} format - Il formato di output (default: 'DD/MM/YYYY').
 * @returns {string} Data formattata.
 */
function convertFromUnixSeconds(unixSeconds, timeZone = 'Europe/Rome', format = 'DD/MM/YYYY') {
    // Crea un oggetto Moment a partire da unixSeconds (che sono secondi).
    // Poi imposta il fuso orario desiderato.
    // Infine formatta la data.
    return moment.unix(unixSeconds).tz(timeZone).format(format);
}

const calcolaMD5daStringa = (str) => {
    return crypto.createHash('md5').update(str).digest('hex');
};


export const utils = {
    getAllFilesRecursive,
    creaCartellaSeNonEsisteSvuotalaSeEsiste,
    mesi,
    inviaMail,
    verificaLunghezzaRiga,
    mRowToJson,
    ottieniDatiAssistito,
    extractAttachmentsMsg,
    extractAttachmentsEml,
    rinominaCedolini,
    onlyFirstDigitMaiusc,
    creaOggettoDaFileExcel,
    scriviOggettoSuNuovoFileExcel,
    scriviOggettoSuFile,
    estraiDataDiNascita,
    getObjectFromFileExcel,
    contaAssistitiPerCriterio,
    parseDateExcel,
    compareDate,
    dataFromStringToUnix,
    dataFromUnixToString,
    nowToUnixDate,
    getAgeFromCF,
    calcolaDifferenzaGiorniPerAnno,
    decodeHtml,
    leggiOggettoDaFileJSON,
    calcolaMesiDifferenza,
    getWorkingPath,
    convertDocxToPdf,
    riunisciJsonDaTag,
    replaceNullWithEmptyString,
    trovaPICfromData,
    scriviGrossoOggettoSuFileJSON,
    leggiOggettoMP,
    scriviOggettoMP,
    removeKeyIfExist,
    ottieniEtaDaDataDiNascita,
    decomprimiELeggiFile,
    scriviEComprimiFile,
    defaultJobConfig,
    getFinalConfigFromTemplate,
    meseNumero,
    trovaDataPicDaAttivita,
    waitForTimeout,
    convertToUnixSeconds,
    convertFromUnixSeconds,
    calcolaMD5daStringa
}
