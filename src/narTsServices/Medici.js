import pdf2html from "pdf2html";
import fse from "fs-extra/lib/output-file/index.js";
import ExcelJS from "exceljs";
import path, {resolve} from "path";
import {Nar} from "./Nar.js";
import {Ts} from "./Ts.js";
import {common} from "../common.js";
import puppeteer from "puppeteer";
import * as os from "os";
import fs from "fs";
import chokidar from "chokidar";

export class Medici {

    /**
     *
     * @param {ImpostazioniServiziTerzi} impostazioni
     * @param workingPath
     */


    constructor(impostazioni, workingPath = null) {
        this._impostazioni = impostazioni;
        this._nar = new Nar(this._impostazioni);
        this._ts = new Ts(this._impostazioni);
        this._retry = 20;
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

    async analizzaBustaPaga(matricola, mesePagamentoDa, annoPagamentoDa, mesePagamentoA, annoPagamentoA, annoRiferimentoDa = 2010, meseRiferimentoDa = 1, annoRiferimentoA = null, meseRiferimentoA = null, salvaReport = true) {
        let out = null;
        let retry = this._retry;
        do {
            out = {error: false, data: null};
            let htmlOutput = "";
            if (!this._nar._batchProcess) {
                await this._nar.doLogout();
                this._nar.type = Nar.PAGHE;
            }
            try {
                let page = await this._nar.getWorkingPage();
                if (page) {
                    page.setDefaultTimeout(5000);
                    await page.goto("https://nar.regione.sicilia.it/NAR/mainMenu.do?ACTION=START&KEY=18200000062");
                    await page.waitForSelector("input[name='codTipoLettura']");
                    await page.type("input[name='codTipoLettura']", "TL_VIS_CEDOLINO");
                    //press tab and wait for 500 ms
                    await page.keyboard.press("Tab");
                    await page.waitForTimeout(1000);
                    await page.focus("input[name='annoPagamentoDa@Filter']");
                    await page.keyboard.down('Control');
                    await page.keyboard.press('A');
                    await page.keyboard.up('Control');
                    await page.keyboard.press('Backspace');
                    await page.type("input[name='annoPagamentoDa@Filter']", annoPagamentoDa.toString());
                    await page.type("select[name='mesePagamentoDa@Filter']", (mesePagamentoDa === 1 ? "1 " : mesePagamentoDa.toString()));
                    await page.focus("input[name='annoPagamentoA@Filter']");
                    await page.keyboard.down('Control');
                    await page.keyboard.press('A');
                    await page.keyboard.up('Control');
                    await page.keyboard.press('Backspace');
                    await page.type("input[name='annoPagamentoA@Filter']", annoPagamentoA.toString());
                    await page.type("select[name='mesePagamentoA@Filter']", (mesePagamentoA === 1 ? "1 " : mesePagamentoA.toString()));
                    await page.type("input[name='annoRiferimentoDa@Filter']", annoRiferimentoDa.toString());
                    await page.type("select[name='meseRiferimentoDa@Filter']", (meseRiferimentoDa === 1 ? "1 " : meseRiferimentoDa.toString()));
                    if (annoRiferimentoA)
                        await page.type("input[name='annoRiferimentoA@Filter']", annoRiferimentoA.toString());
                    if (meseRiferimentoA)
                        await page.type("select[name='meseRiferimentoA@Filter']", (meseRiferimentoA === 1 ? "1 " : meseRiferimentoA.toString()));
                    await page.click("button[name='BTN_BUTTON_VISUALIZZA']");
                    //page wait for selector id=#thickbox
                    await page.waitForSelector("#thickbox");
                    await page.click("#thickbox");
                    await page.type("#matricola", matricola);
                    await page.keyboard.press("Tab");
                    //wait 400 ms
                    await page.waitForTimeout(400);
                    await page.waitForSelector("body > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(31) > tbody > tr > td:nth-child(1) > table > tbody > tr:nth-child(2) > td:nth-child(1)");
                    let datiBusta = await page.evaluate(() => {
                        let out = {
                            datiInquadramento: {},
                            voci: {},
                            trattenuteMedico: {},
                            trattenuteEnte: {},
                            totali: {}
                        };
                        let tabellaInquadramento = document.querySelector("body > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(34) > tbody > tr > td.scheda > table:nth-child(1) > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(3) > td > table:nth-child(6)");
                        let index = 0;
                        for (let rows of tabellaInquadramento.rows) {
                            if (index > 1)
                                out.datiInquadramento[rows.cells[0].innerText] = {
                                    descrizione: rows.cells[1].innerText,
                                    valore: rows.cells[2].innerText,
                                    descrizioneValore: rows.cells[3].innerText
                                };
                            index++;
                        }
                        index = 0;
                        let tabelle = {
                            voci: document.querySelector("body > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(34) > tbody > tr > td.scheda > table:nth-child(1) > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(3) > td > table:nth-child(7)"),
                            trattenuteMedico: document.querySelector("body > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(34) > tbody > tr > td.scheda > table:nth-child(1) > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(3) > td > table:nth-child(8)"),
                            trattenuteEnte: document.querySelector("body > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(34) > tbody > tr > td.scheda > table:nth-child(1) > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(3) > td > table:nth-child(9)")
                        }

                        for (let keyTabella of Object.keys(tabelle)) {
                            index = 0;
                            for (let rows of tabelle[keyTabella].rows) {
                                if (index > 1)
                                    out[keyTabella][rows.cells[0].innerText] = {
                                        descrizioneVoce: rows.cells[1].innerText,
                                        dal: rows.cells[2].innerText,
                                        al: rows.cells[3].innerText,
                                        quanti: rows.cells[4].innerText,
                                        importoUnitario: rows.cells[5].innerText,
                                        competenza: rows.cells[6].innerText,
                                        trattenuta: rows.cells[7].innerText,
                                    };
                                index++;
                            }
                        }

                        let tabellaTotali = document.querySelector("body > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(34) > tbody > tr > td.scheda > table:nth-child(1) > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(3) > td > table:nth-child(10)");
                        for (let cell of tabellaTotali.rows[1].cells) {
                            let split = cell.innerText.split("\n");
                            out.totali[split[0]] = {totale: split[1]};
                        }

                        return out;
                    });

                    for (let i = 0; i < Object.keys(datiBusta.voci).length; i++) {
                        await page.click("body > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(34) > tbody > tr > td.scheda > table:nth-child(1) > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(3) > td > table:nth-child(7) > tbody > tr:nth-child(" + (i + 3) + ") > td:nth-child(1)")
                        await page.waitForTimeout(400);
                        await page.waitForSelector("#windowContent");
                        let datiDettagliCampo = await page.evaluate(() => {
                            return {
                                splitted: document.querySelector("#window").innerText.split("\n"),
                                html: document.querySelector("#windowContent").innerHTML
                            };
                        });
                        htmlOutput += datiDettagliCampo.html + "<br />";
                        datiBusta.voci[datiDettagliCampo.splitted[3].replaceAll("Codice:", "").trim()].dettaglio = datiDettagliCampo;
                        await page.click("img[id='windowClose']");
                    }
                    for (let i = 0; i < Object.keys(datiBusta.trattenuteMedico).length; i++) {
                        await page.click("body > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(34) > tbody > tr > td.scheda > table:nth-child(1) > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(3) > td > table:nth-child(8) > tbody > tr:nth-child(" + (i + 3) + ") > td:nth-child(1)")
                        await page.waitForTimeout(200);
                        await page.waitForSelector("#windowContent");
                        let datiDettagliCampo = await page.evaluate(() => {
                            return {
                                splitted: document.querySelector("#window").innerText.split("\n"),
                                html: document.querySelector("#windowContent").innerHTML
                            };
                        });
                        htmlOutput += datiDettagliCampo.html + "<br />";
                        datiBusta.trattenuteMedico[datiDettagliCampo.splitted[3].replaceAll("Codice:", "").trim()].dettaglio = datiDettagliCampo;
                        await page.click("img[id='windowClose']");
                    }
                    for (let i = 0; i < Object.keys(datiBusta.trattenuteEnte).length; i++) {
                        await page.click("body > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(34) > tbody > tr > td.scheda > table:nth-child(1) > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(3) > td > table:nth-child(9) > tbody > tr:nth-child(" + (i + 3) + ") > td:nth-child(1)")
                        await page.waitForTimeout(200);
                        await page.waitForSelector("#windowContent");
                        let datiDettagliCampo = await page.evaluate(() => {
                            return {
                                splitted: document.querySelector("#window").innerText.split("\n"),
                                html: document.querySelector("#windowContent").innerHTML
                            };
                        });
                        htmlOutput += datiDettagliCampo.html + "<br />";
                        datiBusta.trattenuteEnte[datiDettagliCampo.splitted[3].replaceAll("Codice:", "").trim()].dettaglio = datiDettagliCampo;
                        await page.click("img[id='windowClose']");
                    }
                    for (let i = 0; i < Object.keys(datiBusta.totali).length; i++) {
                        await page.click("body > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(34) > tbody > tr > td.scheda > table:nth-child(1) > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(3) > td > table:nth-child(10) > tbody > tr.riga_griglia > td:nth-child(" + (i + 1) + ")")
                        await page.waitForTimeout(200);
                        await page.waitForSelector("#windowContent");
                        let datiDettagliCampo = await page.evaluate((i) => {
                            return {
                                splitted: document.querySelector("#window").innerText.split("\n"),
                                html: document.querySelector("#windowContent").innerHTML,
                                title: document.querySelector("body > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(34) > tbody > tr > td.scheda > table:nth-child(1) > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(3) > td > table:nth-child(10) > tbody > tr.riga_griglia > td:nth-child(" + (i + 1) + ")").innerText.split("\n")[0]
                            };
                        }, i);
                        htmlOutput += datiDettagliCampo.html + "<br />";
                        datiBusta.totali[datiDettagliCampo.title].dettaglio = datiDettagliCampo;
                        await page.click("img[id='windowClose']");
                    }
                    out.data = datiBusta;
                }
            } catch (ex) {
                out.error = true;
                out.data = "error: " + ex.message + " " + ex.stack;
                if (!this._nar._batchProcess)
                    await this._nar.doLogout();
            }
            if (!out.error) {
                if (salvaReport) {
                    let htmlString = "<html><body><h1><div style='text-align: center; margin-top: 30px'>Matric." + matricola + " Report dettagliato mensilità " + mesePagamentoDa.toString().padStart(2, "0") + "/" + annoPagamentoDa + " </div></h1><br />" + htmlOutput + "</body></html>";

                    // Crea un file temporaneo
                    const tempFileDettaglio = path.join(os.tmpdir(), 'temp_dettaglio.html');
                    fs.writeFileSync(tempFileDettaglio, htmlString);
                    // Avvia un'istanza di browser

                    const browser = await puppeteer.launch();
                    const page = await browser.newPage();

                    // Carica il file temporaneo nella pagina
                    await page.goto(`file://${tempFileDettaglio}`);


                    // Salva la pagina come PDF
                    await page.goto(`file://${tempFileDettaglio}`);
                    await page.pdf({
                        path: this._nar.getWorkingPath() + path.sep + matricola + "_" + annoPagamentoDa + mesePagamentoDa.toString().padStart(2, '0') + '_dettaglio.pdf',
                        format: 'A4'
                    });
                    //await page.pdf({path: this._workingPath + path.sep + matricola + "_" + annoPagamentoDa + mesePagamentoDa.toString().padStart(2, '0') + '_busta.pdf', format: 'A4'});

                    // Chiude il browser
                    if (!this._nar._batchProcess)
                        await browser.close();
                }
            } else
                retry--;
        } while (out.error === true && retry > 0);
        return out;
    }

    async stampaCedolino(matricola, mesePagamentoDa, annoPagamentoDa, mesePagamentoA, annoPagamentoA, annoRiferimentoDa = null, meseRiferimentoDa = null, annoRiferimentoA = null, meseRiferimentoA = null) {
        let out = null;
        if (!this._nar._batchProcess) {
            await this._nar.doLogout();
            this._nar.type = Nar.PAGHE;
        }
        let retry = this._retry;
        do {
            out = {error: false, data: null};
            try {
                let page = await this._nar.getWorkingPage();
                if (page) {
                    await page.goto("https://nar.regione.sicilia.it/NAR/mainMenu.do?ACTION=START&KEY=18200000069");
                    await page.type("input[name='tipoLetturaLayoutCodice']", "TL_CEDOLINO_PREFINCATO");
                    await page.keyboard.press("Tab");
                    await page.waitForTimeout(500);
                    await page.waitForSelector("input[name='tipoLetturaRaggrCodice']");
                    await page.type("input[name='templateCodice']", "ME");
                    await page.waitForTimeout(500);
                    await page.type("input[name='tipoLetturaRaggrCodice']", "ORDINAM_STAMPE_PREFINCATE");
                    await page.waitForTimeout(500);
                    await page.click("input[name='generaRiepilogo@Filter']");
                    await page.click("input[name='totaleGenerale@Filter']");
                    await page.click("input[name='escludiVociAZero@Filter']");
                    await page.click("input[name='Anagrafica']");
                    await page.waitForSelector("input[name='matr@Filter']");
                    await page.type("input[name='matr@Filter']", matricola);
                    //press f4
                    await page.keyboard.press("F4");
                    await page.waitForSelector("input[name='annoPagamentoA@Filter']");
                    await page.focus("input[name='annoPagamentoA@Filter']");
                    await page.keyboard.down('Control');
                    await page.keyboard.press('A');
                    await page.keyboard.up('Control');
                    await page.keyboard.press('Backspace');
                    await page.type("input[name='annoPagamentoA@Filter']", annoPagamentoA.toString());
                    await page.focus("input[name='annoPagamentoDa@Filter']");
                    await page.keyboard.down('Control');
                    await page.keyboard.press('A');
                    await page.keyboard.up('Control');
                    await page.keyboard.press('Backspace');
                    await page.type("input[name='annoPagamentoDa@Filter']", annoPagamentoDa.toString());

                    await page.type("select[name='mesePagamentoDa@Filter']", (mesePagamentoDa === 1 ? "1 " : mesePagamentoDa.toString()));
                    await page.type("select[name='mesePagamentoA@Filter']", (mesePagamentoA === 1 ? "1 " : mesePagamentoA.toString()));
                    if (annoRiferimentoDa)
                        await page.type("input[name='annoRiferimentoDa@Filter']", annoRiferimentoDa.toString());
                    if (meseRiferimentoDa)
                        await page.type("select[name='meseRiferimentoDa@Filter']", (meseRiferimentoDa === 1 ? "1 " : meseRiferimentoDa.toString()));
                    if (annoRiferimentoA)
                        await page.type("input[name='annoRiferimentoA@Filter']", annoRiferimentoA.toString());
                    if (meseRiferimentoA)
                        await page.type("select[name='meseRiferimentoA@Filter']", (meseRiferimentoA === 1 ? "1 " : meseRiferimentoA.toString()));
                    let download = this._nar.getDownloadPath();
                    const watcher = chokidar.watch(download, {
                        ignored: /(^|[\/\\])\..*|\.tmp$|\.crdownload$/,
                        persistent: true
                    });

                    const waitForPDF = () => {
                        return new Promise((resolve, reject) => {
                            watcher.on('add', function (path) {
                                resolve(path);
                            });
                            watcher.on('error', function (error) {
                                reject(null);
                            });
                        });
                    }
                    await page.click("button[name='BTN_CONFIRM']");
                    const file = await waitForPDF();
                    await page.waitForTimeout(300);
                    if (file) {
                        // copy the file to the working path with filename
                        fs.copyFileSync(file, this._nar.getWorkingPath() + path.sep + matricola + "_" + annoPagamentoDa + mesePagamentoDa.toString().padStart(2, '0') + '_cedolino.pdf');
                    } else
                        out.error = true;
                    //dispose the watcher
                    watcher.unwatch(download);
                    await watcher.close();
                    if (!this._nar._batchProcess)
                        await this._nar.doLogout();
                }
            } catch (ex) {
                out.error = true;
                out.data = "error: " + ex.message + " " + ex.stack;
                if (!this._nar._batchProcess)
                    await this._nar.doLogout();
                retry--;
            }
        } while (out.error === true && retry > 0);
        return out;
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
                        } else {
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


    async getAssistitiDaListaPDF(pdfPath) {
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

    /*
    * @param {array} datiMedici
    * @param {array} riferimento
    *
    * Esempio:
    *
    *
    let out = await medici.batchVerificheBustePagaDettagli({
        "314505": [
            [2019, 6],
        ],
        "316318": [
            [2019, 3],
            [2019, 4],
        ]
    },[[2010, 1], [2023, 6]]);
    *
     */
    async batchVerificheBustePagaDettagli(datiMedici, riferimento) {
        process.setMaxListeners(30);
        this._nar.batchProcess = true;
        this._nar.type = Nar.PAGHE;
        await this._nar.doLogin();
        let error = false;
        let times = 0;
        for (let matr of Object.keys(datiMedici)) {
            let dati = datiMedici[matr];
            for (let i = 0; i < dati.length; i++) {
                let busta = dati[i];
                let out1 = await this.analizzaBustaPaga(matr, busta[1], busta[0], busta[1], busta[0], riferimento[0][0], riferimento[0][1], riferimento[1][0], riferimento[1][1]);
                let ou2 = await this.stampaCedolino(matr, busta[1], busta[0], busta[1], busta[0]);
                if (!error)
                    if (out1.error || ou2.error)
                        error = true;
                times++;
                if (times % 10 === 0) {
                    await this._nar.doLogout();
                }
            }
        }
        this._nar.batchProcess = false;
        await this._nar.doLogout();
        return error;
    }

    async verificaLibrettiPediatrici(datiMedici, riferimento) {

    }


}
