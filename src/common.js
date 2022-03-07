import path from "path";
import fs from 'fs';
import * as nodemailer from "nodemailer";
import fsExtra from 'fs-extra'

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
        if (fs.statSync(dirPath + path.sep + file).isDirectory()) {
            arrayOfFiles = getAllFilesRecursive(dirPath + path.sep + file, extensions,filterFileName, arrayOfFiles)
        } else {
            //arrayOfFiles.push(path.join(__dirname, dirPath, "/", file))
            if (path.extname(file) !== "" && extensions.includes(path.extname(file).toLowerCase()) &&
                (filterFileName === null || path.basename(file).toLowerCase().includes(filterFileName.toLowerCase()))
            )
                arrayOfFiles.push(path.join(dirPath, path.sep, file))
        }
    })
    return arrayOfFiles
}

/**
 * @param {ImpostazioniMail} settings Impostazioni mail
 * @param {String} destinatario Destinatario
 * @param {String} oggetto Oggetto Mail
 * @param {String} corpo Corpo mail in HTML
 * @param {Array} pathAllegati Array Path Allegati
 */
const inviaMail = async (settings, destinatario, oggetto, corpo,  pathAllegati = []) => {
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
        to: destinatario, // list of receivers
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

    let info = await transporter.sendMail({...mail});
    console.log("Message sent: %s", info.messageId);
    return info.messageId;
}

const creaCartellaSeNonEsisteSvuotalaSeEsiste = (cartella) =>
{
    fsExtra.emptyDirSync(cartella);
}



export const common = {getAllFilesRecursive, creaCartellaSeNonEsisteSvuotalaSeEsiste, mesi}
