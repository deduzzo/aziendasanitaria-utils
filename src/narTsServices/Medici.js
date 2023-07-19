import pdf2html from "pdf2html";
import fse from "fs-extra/lib/output-file/index.js";
import ExcelJS from "exceljs";
import path from "path";
import {Nar} from "./Nar.js";
import {Ts} from "./Ts.js";
import {common} from "../common.js";

export class Medici {

    /**
     *
     * @param {ImpostazioniServiziTerzi} impostazioni
     * @param workingPath
     */

    constructor(impostazioni,workingPath = null) {
        this._impostazioni = impostazioni;
        this._nar = new Nar(this._impostazioni);
        this._ts = new Ts(this._impostazioni);
        this._workingPath = workingPath;
    }

    static CF = "cf";
    static MATRICOLA = "matricola";
    static NOME = "nome";
    static COGNOME = "cognome";
    static DATA_FINE_RAPPORTO = "dataFineRapporto";
    static MEDICO_DI_BASE = "MDB";



    async getPffAssistitiMedici(datiMedici) {
        let out = {error: false, data: {}};
        try {
            if (!this._nar.logged)
                await this._nar.doLogin();
            if (this._nar.logged) {
                let page = this._nar.getWorkingPage();
                for (let dati of datiMedici) {
                    await page.goto("https://nar.regione.sicilia.it/NAR/mainMenu.do?ACTION=START&KEY=39100000176");
                    await page.waitForSelector("input[name='distrCod']");
                    await page.type("input[name='distrCod']", "20502M03");
                    await page.keyboard.press("Tab");
                    //timeout 1000 ms
                    await page.waitForTimeout(2000);
                    await page.type("input[name='cognome']", dati['cognome']);
                    await page.type("input[name='nome']", dati['nome']);
                    await page.click("button[name='BTN_CONFIRM']") // Click on button

                    let content = await page.content();
                    await fse.outputFile("D:\\DATI\\dev\\asp\\flussisanitari-utils\\output\\NAR\\out.pff", content);
                }
            }
        } catch (ex) {
            out.error = true;
            out.data = "error: " + ex.message + " " + ex.stack;
            return out;
        }
        return out;
    }


    static async caricaCodiciFiscaliDaFileExcel(filePath, colonnaCodiceFiscale, limit = null) {
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
                        if (i > limit)
                            break;
                }
            }
        }
        return codici;
    }

    async getDataFineRapporto(datiMedici, type = Medici.MEDICO_DI_BASE) {
        let out = {error: false, data: [], notFound: []};
        try {
            let page = this._nar.getWorkingPage();
            if (page) {
                for (let medico of datiMedici) {
                    await page.goto("https://nar.regione.sicilia.it/NAR/mainMenu.do?ACTION=START&KEY=3500000036");
                    await page.waitForSelector("input[name='cognome@Filter']");
                    if (medico.hasOwnProperty(Medici.CF))
                        await page.type("input[name='codiceFiscale@Filter']", medico[Medici.CF]);
                    else (medico.hasOwnProperty(Medici.NOME) && medico.hasOwnProperty(Medici.COGNOME))
                    {
                        await page.type("input[name='cognome@Filter']", medico[Medici.COGNOME]);
                        await page.type("input[name='nome@Filter']", medico[Medici.NOME]);
                    }
                    try {
                        if (type !== null) {
                            await page.type("input[name='rapporto@Filter']", type);
                            await page.keyboard.press("Tab");
                            await page.waitForSelector("input[name='categoria']")
                        }
                        await page.click("button[name='BTN_CONFIRM']");
                        // wait for selector only for 10 seconds max
                        await page.waitForSelector("button[name='BTN_CF']", {timeout: 10000});
                        await page.click("body > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(20) > tbody > tr > td:nth-child(8) > table.scheda_ena > tbody > tr > td > div");
                        await page.waitForSelector("input[name='btn1']");
                        let datiEstrapolatiMedico = await page.evaluate(() => {
                            let out = {};
                            try {
                                out.data = document.querySelector("body > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(21) > tbody > tr > td.scheda > table:nth-child(1) > tbody > tr > td > table > tbody > tr > td.detailBox > div > table > tbody > tr > td:nth-child(4)").innerHTML.replaceAll("\\n", "").replaceAll("\\t", "").replaceAll("\\r", "").trim();
                            } catch (ex) {

                            }
                            return out;
                        }, {timeout: 10000});
                        if (datiEstrapolatiMedico.data) {
                            medico[Medici.DATA_FINE_RAPPORTO] = datiEstrapolatiMedico.data;
                            console.log(medico);
                            out.data.push(medico);
                        }
                        else
                        {
                            console.log("nessun dato leggibile");
                            out.notFound.push(medico);
                        }
                    } catch (ex) {
                        console.log("più dati trovati");
                        out.notFound.push(medico);
                    }
                }
            }
        } catch (ex) {
            out.error = true;
            out.data = "error: " + ex.message + " " + ex.stack;
            return out;
        }

        return out;
    }


    async getAssistitiByListaPDF(pdfPath) {
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
        if (!this._nar.logged)
            await this._nar.doLogin();
        if (this._nar.logged) {
            let page = this._nar.getWorkingPage();
            let codiciFiscaliConErrori = [];
            let finito = false;
            while (!finito) {
                let k = 0;
                for (let cf of codiciFiscali) {
                    try {
                        await page.goto("https://nar.regione.sicilia.it/NAR/mainMenu.do?ACTION=START&KEY=39100000113");
                        await page.waitForSelector("button[name='BTN_CONFIRM']");
                        await page.type("input[name='codiceFiscaleISISTP@Filter']", cf);
                        await page.waitForSelector("#inside");
                        await page.click("#inside > table > tbody > tr > td:nth-child(2) > a");
                        await page.waitForSelector("#mediciTable");
                        let datiAssistito = await page.evaluate(({cf}) => {
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
                            progressivo: i++ - 1,
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

        return out;
    }


}
