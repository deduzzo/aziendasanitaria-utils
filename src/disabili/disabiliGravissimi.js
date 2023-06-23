import puppeteer from 'puppeteer';
import ExcelJS from "exceljs"
import {common} from "../common.js";
import path from 'path';
import fs from "fs";
import {utility} from "../utility.js";

export class DisabiliGravissimi {

    constructor() {
        this._ts_username = ""
        this._ts_password = ""
        this._nar_username = "";
        this._nar_password = "";
    }


    get ts_username() {
        return this._ts_username;
    }

    set ts_username(value) {
        this._ts_username = value;
    }

    get ts_password() {
        return this._ts_password;
    }

    set ts_password(value) {
        this._ts_password = value;
    }

    get nar_username() {
        return this._nar_username;
    }

    set nar_username(value) {
        this._nar_username = value;
    }

    get nar_password() {
        return this._nar_password;
    }

    set nar_password(value) {
        this._nar_password = value;
    }

    async _caricaCodiciFiscali(filePath, colonnaCodiceFiscale,limit = null) {
        let codici = [];
        let i = 0;
        var workbook = new ExcelJS.Workbook();
        let files = common.getAllFilesRecursive(filePath, '.xlsx');
        for (let filename of files) {
            console.log('read file ', filename);
            let fileExcel = await workbook.xlsx.readFile(filename);
            let worksheets = (await fileExcel).worksheets;
            for (let worksheet of worksheets) {
                for (i = 0; i < worksheet.rowCount; i++) {
                    if (i > 1)
                        codici.push({
                            cf: worksheet.getRow(i).getCell(colonnaCodiceFiscale).value.trim().toUpperCase(),
                            file: filename,
                            rownumber: i
                        });
                    if (limit)
                        if (i>limit)
                            break;
                }
            }
        }
        return codici;
    }

    async _verificaDataDecessoDaTS(datiUtenti) {
        let out = {error: false, data: {}};
        const browser = await puppeteer.launch({headless: false});
        const page = await browser.newPage();
        try {
            await page.goto('https://sistemats4.sanita.finanze.it/simossHome/login.jsp');
            await page.type("#j_username", this.ts_username);
            await page.type("#j_password", this.ts_password);
            await page.click("#login > fieldset > input:nth-child(11)");
            await page.waitForSelector('#dettaglio_utente')
            /*await page.waitForNavigation({
                waitUntil: 'networkidle0',
            });*/
            console.log("loaded")
            let i = 0;
            for (let cf of  Object.keys(datiUtenti)) {
                i++;
                let dato = datiUtenti[cf];
                await page.goto("https://sistemats4.sanita.finanze.it/simossAssistitiWeb/assistitiInit.do", {waitUntil: 'networkidle2'});
                await page.type("input[name='cognome']", dato.cognome);
                await page.type("input[name='nome']", dato.nome);
                await page.type("input[name='dataNascita']", dato.dataNascita);
                await page.type("select[name='sesso']", dato.sesso);
                await page.type("input[name='comuneNascita']", dato.comuneNascita);
                await page.type("input[name='provinciaNascita']", dato.provinciaNascita);
                await page.click('#go');
                await page.waitForSelector("body > div:nth-child(12) > h1")
                datiUtenti[cf].dataDecesso = await page.evaluate(() => {
                    let data = null;
                    if (document.querySelector("body > div:nth-child(12) > div:nth-child(15) > div.cellaAss35.bold > div").innerHTML === "Data Decesso")
                        data = document.querySelector("body > div:nth-child(12) > div:nth-child(15) > div.cellaAss59 > div").innerHTML.replaceAll("&nbsp;", "").trim();
                    return data;
                });
                console.log("codice fiscale: " + cf + " data decesso:" + (datiUtenti[cf].dataDecesso ? datiUtenti[cf].dataDecesso : "non recuperabile"));
            }
        } catch (e) {
            console.log(e);
            out.error = true;
            out.data = e;
        }
        await browser.close();
    }

    async _verificaDatiDaNar(codiciFiscali) {
        let out = {error: false, data: {}};
        const browser = await puppeteer.launch({headless: false});
        const page = await browser.newPage();
        try {
            const pageTarget = page.target();
            await page.goto('https://nar.regione.sicilia.it/NAR/');
            await page.type("#loginform > div > input:nth-child(2)", this.nar_username);
            await page.type("#loginform > div > input:nth-child(7)", this.nar_password);
            await page.click("#loginform > div > div > div:nth-child(1) > input");
            const newTarget = await browser.waitForTarget(target => target.opener() === pageTarget);
            //get the new page object:
            const newPage = await newTarget.page();
            await newPage.goto('https://nar.regione.sicilia.it/NAR/mainLogin.do');
            await newPage.waitForSelector("#oCMenu_fill");
            await newPage.click("body > table > tbody > tr > td > table:nth-child(14) > tbody > tr:nth-child(1) > td > table > tbody > tr > td > table > tbody > tr:nth-child(1) > td > button");
            await newPage.waitForSelector("#oCMenubbar_0");
            for (let cf of codiciFiscali) {
                await newPage.goto("https://nar.regione.sicilia.it/NAR/mainMenu.do?ACTION=START&KEY=39100000113");
                await newPage.waitForSelector("#ext-gen136 > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(31) > tbody > tr > td.scheda > table:nth-child(1) > tbody > tr > td > table > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr > td:nth-child(1) > input");
                await newPage.waitForTimeout(1000);
                await newPage.type("#ext-gen136 > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(31) > tbody > tr > td.scheda > table:nth-child(1) > tbody > tr > td > table > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr > td:nth-child(1) > input", cf);
                await newPage.waitForSelector("#inside");
                await newPage.click("#inside > table > tbody > tr > td:nth-child(2) > a");
                await newPage.waitForSelector("#id1");
                let datiAssistito = await newPage.evaluate(() => {
                    let dati = {error: false, data: {}};
                    try {
                        dati.data.cognome = document.querySelector("input[name='cognomePaziente@']").value;
                        dati.data.nome = document.querySelector("input[name='nomePaziente@']").value;
                        dati.data.dataNascita = document.querySelector("input[name='dataNascita@']").value;
                        dati.data.comuneNascita = document.querySelector("input[name='codiceComuneNascita_d']").value;
                        dati.data.provinciaNascita = document.querySelector("input[name='provinciaComuneNascita@']").value;
                        dati.data.sesso = document.querySelector("select[name='sesso@']").value;
                    } catch (ex) {
                        dati.error = true;
                        dati.data = "error: " + ex.message + " " + ex.stack;
                        return dati;
                    }
                    return dati;
                });
                console.log(datiAssistito);
                if (!datiAssistito.error)
                    out.data[cf] = datiAssistito.data;
            }
        } catch (ex) {
            out.error = true;
            out.data = "error: " + ex.message + " " + ex.stack;
            return out;
        }
        await browser.close();
        return out;
    }


    async verificaUtentiInVita(filePath, colonnaCodiceFiscale, writeFile = true,limit = null) {
        let out = {error: false, out: {vivi: [], nonTrovati: [], morti: []}}
        let codiciFiscali = await this._caricaCodiciFiscali(filePath, colonnaCodiceFiscale,limit);
        console.log("codici fiscali totali:" + codiciFiscali)
        const browser = await puppeteer.launch({headless: false});
        const page = await browser.newPage();
        try {
            await page.goto('https://sistemats4.sanita.finanze.it/simossHome/login.jsp');
            await page.type("#j_username", this.ts_username);
            await page.type("#j_password", this.ts_password);
            await page.click("#login > fieldset > input:nth-child(11)");
            await page.waitForSelector('#dettaglio_utente')
            /*await page.waitForNavigation({
                waitUntil: 'networkidle0',
            });*/
            console.log("loaded")
        } catch (ex) {
            out.error = true;
            out.errortext = "Generic error1";
        }
        let i = 0;
        if (!out.error && codiciFiscali.length > 0) {
            for (let cfrow of codiciFiscali) {
                let codiceFiscale = cfrow.cf;
                i++;
                await page.goto("https://sistemats4.sanita.finanze.it/simossAssistitiWeb/assistitiInit.do", {waitUntil: 'networkidle2'});
                await page.type('body > div:nth-child(12) > form > fieldset > div:nth-child(2) > div.right_column.margin-right.width25 > input[type=text]', codiceFiscale);
                await page.click('#go');
                await page.waitForSelector("body > div:nth-child(12) > h1")
                let datiAssistito = await page.evaluate(() => {
                    let vivo = null;
                    if (document.querySelector("body > div:nth-child(12) > div:nth-child(3) > div.cellaAss35.bold > div"))
                        vivo = true;
                    else if (document.querySelector('body > div:nth-child(12) > div > fieldset > ul').innerHTML.toLowerCase().includes('deceduto'))
                        vivo = false;
                    else if (document.querySelector('body > div:nth-child(12) > div > fieldset > ul').innerHTML.toLowerCase().includes('stato trovato'))
                        vivo = null;
                    return vivo;
                });
                if (datiAssistito === true)
                    out.out.vivi.push(cfrow);
                else if (datiAssistito === false)
                    out.out.morti.push(cfrow);
                else
                    out.out.nonTrovati.push(cfrow);
                if (datiAssistito !== true)
                    console.log(cfrow.cf + " stato:" + (datiAssistito === null ? " NON TROVATO" : " MORTO"))
                if (datiAssistito !== true)
                    console.log("morti:" + out.out.morti.length + ", non trovati:" + out.out.nonTrovati.length);
            }
        }
        await browser.close();
        let cfMorti = [];
        for(let row of out.out.morti){
            cfMorti.push(row.cf);
        }
        let datiMorti = await this._verificaDatiDaNar(cfMorti);
        let dateDecesso = await this._verificaDataDecessoDaTS(datiMorti.data);
        if (writeFile)
            fs.writeFileSync(filePath + path.sep + 'decessi.txt', JSON.stringify(out, utility.replacer, "\t"), 'utf8');
        return out;
    }


}
