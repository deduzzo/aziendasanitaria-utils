import path from "path";
import fs from 'fs';
import * as nodemailer from "nodemailer";
import fsExtra from 'fs-extra'
import moment from "moment/moment.js";
import puppeteer from 'puppeteer';

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

const getAllFilesRecursive = (dirPath, extensions,filterFileName = null, arrayOfFiles = []) => {
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
const inviaMail = async (settings, destinatari, oggetto, corpo,  pathAllegati = []) => {
    const arrayDestinatariToString = (allDest) => {
        let out = "";
        for (let dest of allDest)
            out+= dest + ","
        console.log(out.substring(0,out.length-1))
        return out.substring(0,out.length-1);
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
    pathAllegati.forEach((allegato) =>
    {
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
    }
    catch (ex) {return {error: true, errorTxt: ex}}
}

const creaCartellaSeNonEsisteSvuotalaSeEsiste = (cartella) =>
{
    fsExtra.emptyDirSync(cartella);
}

const mRowToJson = (row,starts ) =>{
    var obj = {}
    let from = 0;
    for (let key in starts)
    {
        obj[key] = row.substr(from, starts[key].length).trim().toUpperCase();
        if (starts[key].type === "date") {
            if (moment(obj[key], "DDMMYYYY").isValid())
                obj[key] = moment(obj[key], "DDMMYYYY");
        }
        else if (starts[key].type === "double")
            obj[key] = obj[key] === "" ? 0 : parseFloat(obj[key].replace(',', '.'));
        else if (starts[key].type === "int")
            obj[key] = parseInt(obj[key]);
        from+= starts[key].length;
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



export const common = {getAllFilesRecursive, creaCartellaSeNonEsisteSvuotalaSeEsiste, mesi, inviaMail, verificaLunghezzaRiga,mRowToJson,ottieniDatiAssistito}
