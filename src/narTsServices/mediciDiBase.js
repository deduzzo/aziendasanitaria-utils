import pdf2html from "pdf2html";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import fse from "fs-extra/lib/output-file/index.js";

export class MediciDiBase {

    /**
     *
     * @param {ImpostazioniServiziTerzi} impostazioni
     */
    constructor(impostazioni) {
        this._impostazioni = impostazioni;
    }

    async getPffAssistitiMedici(datiMedici) {
        let out = {error: false, data: {}};
        const browser = await puppeteer.launch({headless: false});
        const page = await browser.newPage();
        try {
            const pageTarget = page.target();
            await page.goto('https://nar.regione.sicilia.it/NAR/');
            await page.type("#loginform > div > input:nth-child(2)", this._impostazioni.nar_username);
            await page.type("#loginform > div > input:nth-child(7)", this._impostazioni.nar_password);
            await page.click("#loginform > div > div > div:nth-child(1) > input");
            const newTarget = await browser.waitForTarget(target => target.opener() === pageTarget);
            await page.close();
            //get the new page object:
            const newPage = await newTarget.page();
            await newPage.goto('https://nar.regione.sicilia.it/NAR/mainLogin.do');
            await newPage.waitForSelector("#oCMenu_fill");
            await newPage.click("body > table > tbody > tr > td > table:nth-child(14) > tbody > tr:nth-child(1) > td > table > tbody > tr > td > table > tbody > tr:nth-child(1) > td > button");
            await newPage.waitForSelector("#oCMenubbar_0");

            browser.on('targetchanged', target => console.log(target.url()));

            for (let dati of datiMedici) {
                await newPage.goto("https://nar.regione.sicilia.it/NAR/mainMenu.do?ACTION=START&KEY=39100000176");
                await newPage.waitForSelector("input[name='distrCod']");
                await newPage.type("input[name='distrCod']", "20502M03");
                await newPage.keyboard.press("Tab");
                //timeout 1000 ms
                await newPage.waitForTimeout(2000);
                await newPage.type("input[name='cognome']", dati['cognome']);
                await newPage.type("input[name='nome']", dati['nome']);
                await newPage.click("button[name='BTN_CONFIRM']") // Click on button

                let content = await newPage.content();
                await fse.outputFile("D:\\DATI\\dev\\asp\\flussisanitari-utils\\output\\NAR\\out.pff", content);

            }
        } catch (ex) {
            out.error = true;
            out.data = "error: " + ex.message + " " + ex.stack;
            return out;
        }
        await browser.close();
        return out;
    }


    async getAssistitiByPdf(pdfPath) {
        let out = {}
        const html = await pdf2html.text('D:\\DATI\\Desktop\\outFolder\\test.pdf');
        let ready = false;
        for (let line of html.split("\n")) {
            if (!ready && line.toUpperCase().includes("ASSISTITI IN CARICO AL MEDICO DI BASE"))
                ready = true;
            else if (ready) {
                let assistitoRow = line.split(" ");
                if (assistitoRow.length >= 9) {

                    assistitoRow[3] = assistitoRow[3].replaceAll(assistitoRow[8], "");
                    console.log(assistitoRow);
                    out[assistitoRow[assistitoRow.length - 1]] = {
                        nome: assistitoRow[3],
                        cognome: assistitoRow[2],
                        sesso: assistitoRow[assistitoRow.length - 5],
                        dataNascita: assistitoRow[assistitoRow.length - 4],
                        codiceFiscale: assistitoRow[assistitoRow.length - 1],
                        codiceComuneResidenza: assistitoRow[assistitoRow.length - 3],
                    }
                    // TODO: GESTIRE PIU' NOMI
                }
            }
        }
        return out;
    }


}
