import pdf2html from "pdf2html";
import puppeteer from "puppeteer";
import fse from "fs-extra/lib/output-file/index.js";
import ExcelJS from "exceljs";
import path from "path";
import {Nar} from "./Nar.js";

export class MediciDiBase {

    /**
     *
     * @param {ImpostazioniServiziTerzi} impostazioni
     */
    constructor(impostazioni) {
        this._impostazioni = impostazioni;
        this._nar = new Nar(this._impostazioni);
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

            //browser.on('targetchanged', target => console.log(target.url()));

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
        let out = {assistiti: {}, medico: {}}
        const html = await pdf2html.text(pdfPath);
        let ready = false;
        for (let line of html.split("\n")) {
            if (!ready && line.toUpperCase().includes("ASSISTITI IN CARICO AL"))
                ready = true;
            else if (ready) {
                let assistitoRow = line.split(" ");
                if (assistitoRow[assistitoRow.length - 2] === "Codice") {
                    out.medico.codice = assistitoRow[assistitoRow.length - 1];
                } else if (assistitoRow.length >= 9) {

                    assistitoRow[3] = assistitoRow[3].replaceAll(assistitoRow[8], "");
                    //(assistitoRow);
                    out.assistiti[assistitoRow[assistitoRow.length - 1]] = {
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

    async verificaModelli(codiciFiscali, codiceMedico, pathReport = null, limit = null) {
        let out = {error: false, data: {}};
        const browser = await puppeteer.launch({headless: false});
        const page = await browser.newPage();

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
        await newPage.waitForSelector("select[name='ufficio@Controller']");
        //await newPage.waitForSelector("#oCMenu_fill");
        await newPage.type("select[name='ufficio@Controller']", "UffSce");
        await newPage.waitForTimeout(2000);
        await newPage.click("input[name='BTN_CONFIRM']");
        await newPage.waitForSelector("#oCMenubbar_0");
        //browser.on('targetchanged', target => console.log(target.url()));
        let codiciFiscaliConErrori = [];
        let finito = false;
        while (!finito) {
            let k = 0;
            for (let cf of codiciFiscali) {
                try {
                    await newPage.goto("https://nar.regione.sicilia.it/NAR/mainMenu.do?ACTION=START&KEY=39100000113");
                    await newPage.waitForSelector("button[name='BTN_CONFIRM']");
                    await newPage.type("input[name='codiceFiscaleISISTP@Filter']", cf);
                    await newPage.waitForSelector("#inside");
                    await newPage.click("#inside > table > tbody > tr > td:nth-child(2) > a");
                    await newPage.waitForSelector("#mediciTable");
                    let datiAssistito = await newPage.evaluate(({cf}) => {
                        let dati = {
                            error: false,
                            datiMedico: [],
                            datiAssistito: {},
                            motivazione: null,
                            daPagare: null
                        };
                        let tab = document.querySelector("#mediciTable")
                        for (let i = 1; i < tab.rows.length; i++) {
                            let riga = tab.rows[i];
                            dati.datiMedico.push({
                                codice: riga.cells[2].innerHTML,
                                cognome_nome: riga.cells[3].innerHTML,
                                categoria: riga.cells[4].innerHTML,
                                data: riga.cells[6].innerHTML
                            });
                        }
                        // dati Assistito
                        dati.datiAssistito.cognome = document.querySelector("input[name='cognomePaziente@']").value;
                        dati.datiAssistito.nome = document.querySelector("input[name='nomePaziente@']").value;
                        dati.datiAssistito.cf = document.querySelector("input[name='codiceFiscale@']").value;
                        dati.datiAssistito.sesso = document.querySelector("select[name='sesso@']").value;
                        dati.datiAssistito.codiceComuneNascita = document.querySelector("input[name='codiceComuneNascita_c']").value;
                        dati.datiAssistito.comuneNascita = document.querySelector("input[name='codiceComuneNascita_d']").value;
                        return dati;
                    }, {cf});
                    //timeout 1000 ms
                    let daPagare = false;
                    let rigaUltimaVoltaMedicoScelto = null;
                    for (let i = 0; i < datiAssistito.datiMedico.length; i++) {
                        if (datiAssistito.datiMedico[i].codice === codiceMedico)
                            if (rigaUltimaVoltaMedicoScelto === null)
                                rigaUltimaVoltaMedicoScelto = i;
                    }
                    if (rigaUltimaVoltaMedicoScelto === 0 || (datiAssistito.datiMedico[rigaUltimaVoltaMedicoScelto - 1].categoria === "M")) {
                        daPagare = true;
                        if (rigaUltimaVoltaMedicoScelto === 0)
                            datiAssistito.motivazione = "Pediatra in pensione cod. " + codiceMedico + " ultima scelta attuale";
                        else
                            datiAssistito.motivazione = "Medico cod." + datiAssistito.datiMedico[rigaUltimaVoltaMedicoScelto - 1].codice + " (" + datiAssistito.datiMedico[rigaUltimaVoltaMedicoScelto - 1].cognome_nome + ") cat." + datiAssistito.datiMedico[rigaUltimaVoltaMedicoScelto - 1].categoria + " scelta successiva";
                    } else {
                        datiAssistito.motivazione = "Medico cod." + datiAssistito.datiMedico[rigaUltimaVoltaMedicoScelto - 1].codice + " (" + datiAssistito.datiMedico[rigaUltimaVoltaMedicoScelto - 1].cognome_nome + ") cat." + datiAssistito.datiMedico[rigaUltimaVoltaMedicoScelto - 1].categoria + " scelta successiva";
                    }
                    datiAssistito.daPagare = daPagare;
                    console.log("Da pagare: " + (daPagare ? "SI" : "NO") + " motivazione: " + datiAssistito.motivazione);
                    out.data[cf] = datiAssistito;
                    //remove cf if exist as object in codiciFiscaliConErrori
                    codiciFiscaliConErrori = codiciFiscaliConErrori.filter(item => item !== cf);
                    k++;
                    if (limit !== null)
                        if (k % limit === 0)
                            break;
                } catch (ex) {
                    //out.error = true;
                    //out.data = "error: " + ex.message + " " + ex.stack;
                    console.log("Errore nel cf:" + cf);
                    codiciFiscaliConErrori.push(cf);
                }
            }
            if (codiciFiscaliConErrori.length === 0)
                finito = true;
            else {
                codiciFiscali = [...codiciFiscaliConErrori];
                finito = false;
            }
        }

        if (!out.data.error)
            if (pathReport) {
                const workbook = new ExcelJS.Workbook();
                let sheet1 = workbook.addWorksheet("Ris. elab. " + codiceMedico);

                sheet1.columns = [
                    {header: 'Nr', key: 'progressivo'},
                    {header: 'Cod. Medico', key: 'codMedico'},
                    {header: 'TesseraSanitaria', key: 'cf'},
                    {header: 'Nominativo Assistito', key: 'nominativo'},
                    {header: 'Sesso', key: 'sesso'},
                    {header: 'Valido', key: 'valido'},
                    {header: 'Motivazione', key: 'motivazione'},
                ];
                let i = 2;
                for (let cf in out.data) {
                    sheet1.insertRow(i,
                        {
                            progressivo: i++ -1,
                            codMedico: codiceMedico,
                            cf: cf,
                            nominativo: out.data[cf].datiAssistito.cognome + " " + out.data[cf].datiAssistito.nome,
                            sesso: out.data[cf].datiAssistito.sesso,
                            valido: (out.data[cf].daPagare ? "SI" : "NO"),
                            motivazione: out.data[cf].motivazione,
                        });
                }
                await workbook.xlsx.writeFile(pathReport + path.sep + codiceMedico + ".xlsx");
                console.log("Report salvato");
            }

        await browser.close();
        return out;
    }


}
