import pdf2html from "pdf2html";
import ExcelJS from "exceljs";
import path, {resolve} from "path";
import {Nar} from "./Nar.js";
import {Ts} from "./Ts.js";
import puppeteer from "puppeteer";
import * as os from "os";
import fs from "fs";
import chokidar from "chokidar";
import moment from "moment";
import {utils} from "../Utils.js";
import {Parser} from "@marketto/codice-fiscale-utils";
import {EventEmitter} from "events";
import {Procedure} from "../Procedure.js";

export class Medici {

    static CF = "cf";
    static MATRICOLA = "matricola";
    static NOME = "nome";
    static COGNOME = "cognome";
    static DATA_FINE_RAPPORTO = "dataFineRapporto";
    static MEDICO_DI_BASE_NAR = "MDB";
    static MEDICO_DI_BASE_FILE = "Medico di base";
    kok
    static PEDIATRA_FILE = "Pediatra di Libera Scelta";

    /**
     *
     * @param {ImpostazioniServiziTerzi} impostazioni
     * @param visibile
     * @param workingPath
     * @param batchProcess
     * @param narType
     */


    constructor(impostazioni, visibile = false, workingPath = null, batchProcess = false, narType = Nar.NAR) {
        this._impostazioni = impostazioni;
        this._nar = new Nar(this._impostazioni, visibile, workingPath, batchProcess, narType);
        this._ts = new Ts(this._impostazioni);
        this._visibile = visibile;
        this._retry = 20;
    }

    kjìì

    /*async getPffAssistitiMedici(datiMedici) {
        let out = {error: false, data: {}};
        try {
            if (!this._nar.logged)
                await this._nar.doLogin();
            if (this._nar.logged) {
                let page = await this._nar.getWorkingPage();
                if (page) {
                    for (let dati of Object.keys(datiMedici)) {
                        await page.goto("https://nar.regione.sicilia.it/NAR/mainMenu.do?ACTION=START&KEY=39100000118");
                        await page.waitForSelector("input[name='codRegionale@Filter']")
                        await page.type("input[name='codRegionale@Filter']", dati);
                        await page.click("button[name='BTN_CONFIRM']");
                        // BTN_MULTI_PRINT.PRINT
                        await page.waitForSelector("button[name='BTN_MULTI_PRINT.PRINT']");
                        let ambito = await page.evaluate(() => {
                            const decodeHtml = (html) => {
                                let txt = document.createElement("textarea");
                                txt.innerHTML = html;
                                return txt.value;
                            }
                            return decodeHtml(document.querySelector("#inside > table > tbody > tr > td:nth-child(9) > a").innerHTML);
                        });
                        // #inside > table > tbody > tr > td:nth-child(3) > a
                        await page.click("#inside > table > tbody > tr > td:nth-child(3) > a");
                        // cognome@
                        await page.waitForSelector("input[name='cognome@']");
                        // grab cognome@ and nome@
                        let datiExtr = await page.evaluate(() => {
                            let datiEstratti = {};
                            datiEstratti.cognome = document.querySelector("input[name='cognome@']").value;
                            datiEstratti.nome = document.querySelector("input[name='nome@']").value;
                            return datiEstratti;
                        });
                        await page.goto("https://nar.regione.sicilia.it/NAR/mainMenu.do?ACTION=START&KEY=39100000176");
                        await page.waitForSelector("input[name='distrCod']");
                        //await page.type("input[name='distrDescr']", ambito);
                        //await page.keyboard.press("Tab");
                        //timeout 1000 ms
                        //await utils.waitForTimeout(2000);
                        await page.type("input[name='cognome']", datiExtr['cognome']);
                        await page.type("input[name='nome']", datiExtr['nome']);
                        await page.click("button[name='BTN_CONFIRM']") // Click on button
                        // get the new page opened
                        const newTarget = await this._nar.browser.waitForTarget(target => target.opener() === page.target());
                        await newTarget.waitForSelector("body > table > tbody > tr > td > form > table:nth-child(19) > tbody > tr > td.scheda > table.scheda > tbody > tr > td > div")
                    }
                }
            }
        } catch (ex) {
            out.error = true;
            out.data = "error: " + ex.message + " " + ex.stack;
            return out;
        }
        return out;
    }*/


    async analizzaBustaPaga(matricola, mesePagamentoDa, annoPagamentoDa, mesePagamentoA, annoPagamentoA, singoloCedolino,annoRiferimentoDa = null, meseRiferimentoDa = null, annoRiferimentoA = null, meseRiferimentoA = null, salvaReport = true) {
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
                    page.setDefaultTimeout(120000);
                    await page.goto("https://nar.regione.sicilia.it/NAR/mainMenu.do?ACTION=START&KEY=18200000062");
                    await page.waitForSelector("input[name='codTipoLettura']");
                    await page.type("input[name='codTipoLettura']", "TL_VIS_CEDOLINO");
                    //press tab and wait for 500 ms
                    await page.keyboard.press("Tab");
                    await utils.waitForTimeout(1000);
                    await page.focus("input[name='annoPagamentoDa@Filter']");
                    await page.keyboard.down('Control');
                    await page.keyboard.press('A');
                    await page.keyboard.up('Control');
                    await page.keyboard.press('Backspace');
                    await page.type("input[name='annoPagamentoDa@Filter']", annoPagamentoDa.toString());
                    await page.select("select[name='mesePagamentoDa@Filter']", mesePagamentoDa.toString());
                    await page.focus("input[name='annoPagamentoA@Filter']");
                    await page.keyboard.down('Control');
                    await page.keyboard.press('A');
                    await page.keyboard.up('Control');
                    await page.keyboard.press('Backspace');
                    await page.type("input[name='annoPagamentoA@Filter']", annoPagamentoA.toString());
                    await page.select("select[name='mesePagamentoA@Filter']", mesePagamentoA.toString());
                    await page.type("input[name='annoRiferimentoDa@Filter']", annoRiferimentoDa ? annoRiferimentoDa.toString() : "");
                    if (meseRiferimentoDa)
                        await page.select("select[name='meseRiferimentoDa@Filter']", meseRiferimentoDa.toString());
                    if (annoRiferimentoA)
                        await page.type("input[name='annoRiferimentoA@Filter']", annoRiferimentoA.toString());
                    if (meseRiferimentoA)
                        await page.select("select[name='meseRiferimentoA@Filter']", meseRiferimentoA.toString());
                    await page.click("button[name='BTN_BUTTON_VISUALIZZA']");
                    //page wait for selector id=#thickbox
                    await page.waitForSelector("#thickbox");
                    await page.click("#thickbox");
                    await page.type("#matricola", matricola);
                    await utils.waitForTimeout(1000);
                    await page.keyboard.press("Tab");
                    //wait 400 ms
                    await utils.waitForTimeout(1000);
                    await page.waitForSelector("body > table > tbody > tr > td > table:nth-child(3) > tbody > tr > td > form > table:nth-child(31) > tbody > tr > td:nth-child(1) > table > tbody > tr:nth-child(2) > td:nth-child(1)");
                    await utils.waitForTimeout(1000);
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
                        await page.waitForSelector("#windowContent");
                        await utils.waitForTimeout(singoloCedolino ? 1000 : 400);
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
                        await page.waitForSelector("#windowContent");
                        await utils.waitForTimeout(singoloCedolino ? 1000 : 400);
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
                        await page.waitForSelector("#windowContent");
                        await utils.waitForTimeout(singoloCedolino ? 1000 : 400);
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
                        await utils.waitForTimeout(200);
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
                    let title = mesePagamentoDa !== mesePagamentoA ? ("Report dettagliato mensilità " + mesePagamentoDa.toString().padStart(2, "0") + "/" + annoPagamentoDa + " - " + mesePagamentoA.toString().padStart(2, "0") + "/" + annoPagamentoA) : ("Report dettagliato mensilità " + mesePagamentoDa.toString().padStart(2, "0") + "/" + annoPagamentoDa);
                    let htmlString = "<html><body><h1><div style='text-align: center; margin-top: 30px'>Matric." + matricola + " " + title + "</div></h1><br />" + htmlOutput + "</body></html>";

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
                    const fileName = mesePagamentoDa !== mesePagamentoA ? (matricola + "_" + annoPagamentoDa + "_" + mesePagamentoDa.toString().padStart(2, '0') + "-" + mesePagamentoA.toString().padStart(2, '0') + '_dettaglio.pdf') : (matricola + "_" + annoPagamentoDa + mesePagamentoDa.toString().padStart(2, '0') + '_dettaglio.pdf');
                    await page.pdf({
                        path: this._nar.getWorkingPath() + path.sep + fileName,
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

    async stampaCedolino(matricola, visibile = false, mesePagamentoDa, annoPagamentoDa, mesePagamentoA, annoPagamentoA, singoloCedolino, annoRiferimentoDa = null, meseRiferimentoDa = null, annoRiferimentoA = null, meseRiferimentoA = null) {
        let out = null;
        if (!this._nar._batchProcess || this._nar.type !== Nar.PAGHE) {
            await this._nar.doLogout();
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
                    await utils.waitForTimeout(500);
                    await page.waitForSelector("input[name='tipoLetturaRaggrCodice']");
                    await page.type("input[name='templateCodice']", "ME");
                    await utils.waitForTimeout(500);
                    await page.type("input[name='tipoLetturaRaggrCodice']", "ORDINAM_STAMPE_PREFINCATE");
                    await utils.waitForTimeout(500);
                    await page.click("input[name='generaRiepilogo@Filter']");
                    await page.click("input[name='totaleGenerale@Filter']");
                    await page.click("input[name='escludiVociAZero@Filter']");
                    await page.click("input[name='Anagrafica']");
                    await page.waitForSelector("input[name='matr@Filter']");
                    await page.type("input[name='matr@Filter']", matricola);
                    await utils.waitForTimeout(500);
                    await page.focus("input[name='dataDal@Filter']");
                    await utils.waitForTimeout(500);
                    await page.$eval(
                        "input[name='dataDal@Filter']",
                        (element, newValue) => {
                            element.value = newValue;
                        },
                        "01/01/2000"
                    );
                    //press f4
                    await utils.waitForTimeout(500);
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

                    // set selectedIndex = mesePagamentoDa to select[name='mesePagamentoDa@Filter']
                    await page.select("select[name='mesePagamentoDa@Filter']", mesePagamentoDa.toString());
                    await page.select("select[name='mesePagamentoA@Filter']", mesePagamentoA.toString());
                    if (annoRiferimentoDa)
                        await page.type("input[name='annoRiferimentoDa@Filter']", annoRiferimentoDa.toString());
                    if (meseRiferimentoDa)
                        await page.select("select[name='meseRiferimentoDa@Filter']", meseRiferimentoDa.toString());
                    if (annoRiferimentoA)
                        await page.type("input[name='annoRiferimentoA@Filter']", annoRiferimentoA.toString());
                    if (meseRiferimentoA)
                        await page.select("select[name='meseRiferimentoA@Filter']", meseRiferimentoA.toString());
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
                    await utils.waitForTimeout(300);
                    if (file) {
                        // copy the file to the working path with filename
                        let filename = (mesePagamentoDa !== mesePagamentoA) ? (matricola + "_" + annoPagamentoDa + "_" + mesePagamentoDa.toString().padStart(2, '0') + "-" + mesePagamentoA.toString().padStart(2, '0') + '_cedolino.pdf') : (matricola + "_" + annoPagamentoDa + mesePagamentoDa.toString().padStart(2, '0') + '_cedolino.pdf');
                        fs.copyFileSync(file, this._nar.getWorkingPath() + path.sep + filename);
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

    async getDataFineRapporto(datiMedici, type = Medici.MEDICO_DI_BASE_NAR) {
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

    async getAssistitiDaTs(codRegMedici, codToCfDistrettoMap, index = 1) {
        let page = await this._ts.getWorkingPage(this._visibile);
        page.setDefaultTimeout(5000);
        let datiAssistiti = {};
        if (page) {
            for (let codRegionale of codRegMedici) {
                let retry = 5;
                while (retry > 0) {
                    try {
                        let cfMedico = codToCfDistrettoMap[codRegionale].cf;

                        console.log("[" + index + "]" + " elaborando: " + cfMedico);
                        await page.goto("https://sistemats4.sanita.finanze.it/simossHome/servizi.jsp", {waitUntil: 'networkidle2'});
                        await page.goto("https://sistemats4.sanita.finanze.it/simossHome/traceAuditing.do?p=U4", {waitUntil: 'networkidle2'});
                        await page.waitForSelector("input[name='codiceFiscale']");
                        await page.type("input[name='codiceFiscale']", cfMedico);
                        await page.click("#go");
                        // wait for page load
                        // Attendiamo che il selettore #mef sia presente E che sia visibile
                        await page.waitForSelector("#mef", {
                            visibile: true,
                            timeout: 30000  // timeout di 30 secondi
                        });
                        const error = await page.$("body > div:nth-child(12) > div > fieldset > p:nth-child(2)");
                        // error is also if "document.querySelector('body > div:nth-child(12) > div > fieldset').innerHTML" contains "Nessun risultato trovato"
                        const error2 = await page.evaluate(() => {
                            const error = document.querySelector('body > div:nth-child(12) > div > fieldset');
                            if (error)
                                return error.innerHTML.toLowerCase().includes("nessun risultato")
                            else
                                return false;
                        });
                        if (!error && !error2) {
                            await page.waitForSelector("body > div:nth-child(12) > div:nth-child(3) > div:nth-child(2)");
                            await page.click("#menu_voci > ol > li:nth-child(1) > a");
                            // Attendiamo che il selettore #mef sia presente E che sia visibile
                            await page.waitForSelector("#mef", {
                                visibile: true,
                                timeout: 30000  // timeout di 30 secondi
                            });
                            // if page contains selector "body > div:nth-child(12) > div"
                            let dati = await page.evaluate(() => {

                                const pulisci = (str) => {
                                    return str.replaceAll("\n", "").replaceAll("\t", "").replaceAll("\r", "").trim();
                                }

                                let out = [];
                                let allElements = document.querySelectorAll(".tabellaContenitoreTitoli50");
                                for (let allElement of allElements) {
                                    if (allElement && allElement.hasChildNodes() && allElement.children.length > 2 && pulisci(allElement.children[0].textContent) !== "Cognome") {
                                        let cf = pulisci(allElement.children[2].textContent);
                                        out.push({
                                            cf: cf,
                                            cognome: pulisci(allElement.children[0].textContent),
                                            nome: pulisci(allElement.children[1].textContent),
                                        });
                                    }
                                }
                                return out;
                            });
                            console.log("[" + index + "]" + " " + cfMedico + " cod regionale " + codRegionale + " " + Object.keys(dati).length + " assistiti");
                            datiAssistiti[codRegionale] = dati;
                            break;
                        } else
                            datiAssistiti[codRegionale] = null;
                    } catch (ex) {
                        console.log("[" + index + "]" + " errore, ritento tentativo " + retry);
                        retry--;
                    }
                    if (retry === 0)
                        datiAssistiti[codRegionale] = null;
                }

            }
            return datiAssistiti;
        }
    }

    /**
     * Ottiene l'elenco degli assistiti da TS in parallelo.
     *
     * @param {Array} codRegionali - Codici regionali dei medici.
     * @param {Object} codToCfDistrettoMap - Mappa dei codici regionali ai codici fiscali dei distretti.
     * @param {Object} impostazioni - Impostazioni dei servizi.
     * @param {Object} [config={}] - Configurazione opzionale.
     * @param {number} [config.numParallelsJobs=20] - Numero di job paralleli.
     * @param {boolean} [config.visibile=false] - Se rendere visibile il processo.
     */
    static async getElencoAssistitiFromTsParallels(codRegionali, codToCfDistrettoMap, impostazioni, config = {}) {
        //numParallelsJobs = 20, visibile = false
        let {
            numParallelsJobs = 20,
            visibile = false,
        } = config;

        EventEmitter.defaultMaxListeners = 40;
        let out = {};
        let jobs = [];
        let jobSize = Math.ceil(codRegionali.length / numParallelsJobs);
        for (let i = 0; i < numParallelsJobs; i++) {
            let job = codRegionali.slice(i * jobSize, (i + 1) * jobSize);
            jobs.push(job);
        }
        let promises = [];
        for (let i = 0; i < jobs.length; i++) {
            let mediciTemp = new Medici(impostazioni, visibile);
            promises.push(mediciTemp.getAssistitiDaTs(jobs[i], codToCfDistrettoMap, i));
            console.log("job " + i + " " + jobs[i].length + " medici");
        }
        let results = await Promise.all(promises);
        for (let result of results) {
            Object.assign(out, result);
        }
        return out;
    }

    getAllDifferenzeAnagrafiche(assistitiNarTs, codToCfMap, distretto) {
        let out = {};

        for (let codNar of Object.keys(assistitiNarTs.codRegNar)) {
            if (assistitiNarTs.codRegTs.hasOwnProperty(codNar)) {
                let res = this.#getDifferenzeAnagrafiche(
                    assistitiNarTs.codRegNar[codNar],
                    assistitiNarTs.codRegTs[codNar],
                    codToCfMap[codNar],
                    distretto
                );
                out[codNar] = res;
            }
        }
        return out;
    }

    #getDifferenzeAnagrafiche(assistitiNar, assistitiTs, datiMedico, distretto) {
        let differenze = [];
        let allAssistitiTs = [];
        let allAssistitiNar = [];
        let allAssistiti = {};
        let infoAggiuntive = {
            codice_regionale_medico: datiMedico.cod_regionale,
            distretto: distretto,
            ambito_medico: datiMedico.ambito,
            nome_cognome_medico: datiMedico.nome_cognome,
            codice_fiscale_medico: datiMedico.cf
        }
        for (let assistito of assistitiNar) {
            if (!allAssistiti.hasOwnProperty(assistito.codiceFiscale))
                allAssistiti[assistito.codiceFiscale] = {
                    nome: assistito.nome,
                    cognome: assistito.cognome,
                    codiceFiscale: assistito.codiceFiscale
                };
            allAssistitiNar.push(assistito.codiceFiscale);
        }
        for (let assistito of assistitiTs) {
            if (!allAssistiti.hasOwnProperty(assistito.cf))
                allAssistiti[assistito.cf] = {
                    nome_assistito: assistito.nome,
                    cognome_assistito: assistito.cognome,
                    codice_fiscale_assistito: assistito.cf
                };
            allAssistitiTs.push(assistito.cf);
        }
        for (let assistito of Object.keys(allAssistiti)) {
            let trovatoNar = false;
            let trovatoTs = false;
            if (allAssistitiNar.includes(assistito))
                trovatoNar = true;
            if (allAssistitiTs.includes(assistito))
                trovatoTs = true;
            let ris = null;
            if (trovatoNar && !trovatoTs) {
                ris = {
                    ...infoAggiuntive,
                    ...allAssistiti[assistito],
                    motivo: "assistito presente SOLO su sistema NAR"
                };
            } else if (!trovatoNar && trovatoTs)
                ris = {
                    ...infoAggiuntive,
                    ...allAssistiti[assistito],
                    motivo: "assistito presente SOLO su sistema TS"
                };
            if (ris) {
                differenze.push(ris);
            }
        }
        return {numDifferenze: differenze.length, dettaglioDifferenze: differenze};
    }


    async getAssistitiDaListaPDF(pdfPath, codToCfDistrettoMap) {
        let out = {}
        let lastCodice = "";
        const html = await pdf2html.text(pdfPath);
        let ready = false;
        for (let line of html.split("\n")) {
            if (!ready && line.toUpperCase().includes("ASSISTITI IN CARICO AL"))
                ready = true;
            else if (ready) {
                let assistitoRow = line.split(" ");
                if (assistitoRow[assistitoRow.length - 2] === "Codice" && assistitoRow[assistitoRow.length - 1] !== "fiscale") {
                    if (lastCodice !== assistitoRow[assistitoRow.length - 1])
                        lastCodice = assistitoRow[assistitoRow.length - 1];
                    if (!out.hasOwnProperty(lastCodice))
                        out[lastCodice] = {assistiti: [], medico: {}}
                    out[lastCodice].medico.codice = lastCodice;
                    out[lastCodice].medico.cf = codToCfDistrettoMap[lastCodice].cf;
                    out[lastCodice].medico.distretto = codToCfDistrettoMap[lastCodice].distretto;
                    out[lastCodice].medico.nominativo = codToCfDistrettoMap[lastCodice].nome_cognome;
                } else if (assistitoRow.length >= 9) {
                    assistitoRow[3] = assistitoRow[3].replaceAll(assistitoRow[8], "");
                    //(assistitoRow);
                    // remove all numbers from string assistitoRow[3]
                    out[lastCodice].assistiti.push({
                        nome: assistitoRow[3].replace(/\d+/g, ''),
                        cognome: assistitoRow[2],
                        sesso: assistitoRow[assistitoRow.length - 5],
                        dataNascita: assistitoRow[assistitoRow.length - 4],
                        codiceFiscale: assistitoRow[assistitoRow.length - 1],
                        codiceComuneResidenza: assistitoRow[assistitoRow.length - 3],
                        data_scelta: assistitoRow[assistitoRow.length - 2],
                    });
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
    *
    * Esempio:
    *
    *
        const medici = new Medici(impostazioniServizi);

    let datiMedici = {
        "318883": {from: [2022, 12], to: [2023, 12]},
        "318884": {from: [2022, 12], to: [2023, 12]}
    };


    let out = await medici.batchVerificheBustePagaDettagli(datiMedici);
    *
     */
    async batchVerificheBustePagaDettagli(datiMedici) {
        process.setMaxListeners(30);
        this._nar.batchProcess = true;
        this._nar.type = Nar.PAGHE;
        await this._nar.doLogin();
        let error = false;
        let times = 0;
        for (let matr of Object.keys(datiMedici)) {
            let dati = datiMedici[matr];
            let dataInizio = moment(dati.from[0] + "-" + dati.from[1] + "-01", "YYYY-MM-DD");
            let dataFine = moment(dati.to[0] + "-" + dati.to[1] + "-01", "YYYY-MM-DD");
            let dataInizioTemp = new moment(dataInizio);
            while (dataInizioTemp.isSameOrBefore(dataFine)) {
                let mese = dataInizioTemp.month() + 1;
                let anno = dataInizioTemp.year();
                let out1 = await this.analizzaBustaPaga(matr, mese, anno, mese, anno);
                // write dati busta object to json file
                let path2 = this._nar.getWorkingPath() + path.sep + matr + "_" + anno + mese.toString().padStart(2, '0') + '_datibusta.json';
                await utils.scriviOggettoSuFile(path2, out1);
                if (!error)
                    if (out1.error)
                        error = true;
                times++;
                if (times % 10 === 0) {
                    await this._nar.doLogout();
                }
                dataInizioTemp.add(1, 'month');
            }
            await Procedure.salvaCedoliniMedici(matr, this._impostazioni, dataInizio.month() + 1, dataInizio.year(), dataFine.month() + 1, dataFine.year());
        }
        this._nar.batchProcess = false;
        await this._nar.doLogout();
        return error;
    }

    /*
    * @param {array} datiMedici
    * @param {array} riferimento es. [[2010, 1], [2023, 6]]
     */
    async calcolaDatiTrascinamentoLibrettiPediatrici(datiMedici, periodoRiferimento, periodoPrimoCompilatore = null, meseAnnoNascitaDaConsiderare = null, primoCompilatorePagato = false, nonConsiderareSeNonInRange = false) {
        let out = {};
        let allRows = [];
        let nonConsiderati = []
        let importi = {};
        let perAnnoGlobale = {};
        let natiPerAnno = {};
        let dataInizioRiferimento = moment(periodoRiferimento[0][0] + "-" + periodoRiferimento[0][1] + "-01", "YYYY-MM-DD").startOf('month');
        let dataFineRiferimento = moment(periodoRiferimento[1][0] + "-" + periodoRiferimento[1][1] + "-01", "YYYY-MM-DD").endOf('month');
        let dataInizioPrimoCompilatore = periodoPrimoCompilatore ? moment(periodoPrimoCompilatore[0][0] + "-" + periodoPrimoCompilatore[0][1] + "-01", "YYYY-MM-DD").startOf('month') : null;
        let dataFinePrimoCompilatore = periodoPrimoCompilatore ? moment(periodoPrimoCompilatore[1][0] + "-" + periodoPrimoCompilatore[1][1] + "-01", "YYYY-MM-DD").endOf('month') : null;
        let dataNascitaDaConsiderare = meseAnnoNascitaDaConsiderare ? moment(meseAnnoNascitaDaConsiderare[0] + "-" + meseAnnoNascitaDaConsiderare[1] + "-01", "YYYY-MM-DD").startOf('month') : null;
        const CF_PAZIENTE = "CF_PAZIENTE"
        const CODICE_MEDICO = "COD_REG_MEDICO";
        const DATA_INIZIO = "DATA_SCELTA";
        const DATA_FINE = "DATA_REVOCA";
        let importogiornaliero = parseFloat((10 / 365).toFixed(4));
        for (let riga of datiMedici) {
            let note = "";
            let nonConsiderare = null;
            let dataInizio = moment(riga[DATA_INIZIO]);
            if (nonConsiderareSeNonInRange) {
                if (dataInizio.isBefore(dataInizioRiferimento) || dataInizio.isAfter(dataFineRiferimento))
                    nonConsiderare = "Non nel range di date di riferimento: " + moment(dataInizioRiferimento).format("DD/MM/YYYY") + " - " + moment(dataFineRiferimento).format("DD/MM/YYYY");
            } else {
                if (dataInizio.isBefore(dataInizioRiferimento))
                    dataInizio = dataInizioRiferimento;
            }
            let dataFine = riga[DATA_FINE] !== "" ? moment(riga[DATA_FINE]) : dataFineRiferimento;
            if (dataFine.isAfter(dataFineRiferimento))
                dataFine = dataFineRiferimento;


            const codMedico = riga[CODICE_MEDICO];
            const cf = riga[CF_PAZIENTE];

            const dataNascita = moment(Parser.cfToBirthDate(cf));

            if (dataFinePrimoCompilatore) {
                if (dataInizio.isBefore(dataFinePrimoCompilatore)) {
                    if (primoCompilatorePagato) {
                        // set dataInizio the first day of the next year from dataInizio
                        dataInizio = moment(dataInizio).add(1, 'year').startOf('year');
                        note = "Primo compilatore pagato, la data di pagamento salta all'anno successivo";
                    }
                } else
                    nonConsiderare = "Non nel range di date del primo compilatore: " + moment(dataInizioPrimoCompilatore).format("DD/MM/YYYY") + " - " + moment(dataFinePrimoCompilatore).format("DD/MM/YYYY");
            }
            const numGiorni = dataInizio.isBefore(dataFine) ? (dataFine.diff(dataInizio, 'days') + 1) : 0;
            if (dataNascitaDaConsiderare && dataNascita.isBefore(dataNascitaDaConsiderare))
                nonConsiderare = "Nato prima del " + moment(dataNascitaDaConsiderare).format("DD/MM/YYYY");
            if (nonConsiderare === null) {
                if (dataNascita.year() === moment(riga[DATA_INIZIO]).year()) {
                    if (!natiPerAnno.hasOwnProperty(dataNascita.year()))
                        natiPerAnno[dataNascita.year()] = [];
                    if (!natiPerAnno[dataNascita.year()].includes(cf))
                        natiPerAnno[dataNascita.year()].push(cf);
                }
                if (!out.hasOwnProperty(codMedico)) {
                    out[codMedico] = {};
                    importi[codMedico] = 0.0;
                }
                if (!out[codMedico].hasOwnProperty(cf))
                    out[codMedico][cf] = [];
                out[codMedico][cf].push({dataInizio: dataInizio, dataFine: dataFine, numGiorni: numGiorni});
                importi[codMedico] += numGiorni > 0 ? parseFloat((numGiorni * importogiornaliero).toFixed(2)) : 0
                allRows.push({
                    codMedico: codMedico,
                    cf: cf,
                    dataNascita: dataNascita.format("DD/MM/YYYY"),
                    dataInizioOriginale: moment(riga[DATA_INIZIO]).format("DD/MM/YYYY"),
                    dataFineOriginale: moment(riga[DATA_FINE]).format("DD/MM/YYYY"),
                    dataInizioCalcolata: dataInizio.format("DD/MM/YYYY"),
                    dataFineCalcolata: dataFine.format("DD/MM/YYYY"),
                    numGiorni: numGiorni > 0 ? numGiorni : 0,
                    importo: numGiorni > 0 ? parseFloat((numGiorni * importogiornaliero).toFixed(2)) : 0,
                    note: note
                });
                let perAnno = null;
                if (numGiorni > 0)
                    perAnno = utils.calcolaDifferenzaGiorniPerAnno(dataInizio, dataFine, numGiorni);
                if (perAnno) {
                    for (let key in perAnno['perAnno']) {
                        if (!perAnnoGlobale.hasOwnProperty(key))
                            perAnnoGlobale[key] = {numGiorni: 0, importo: 0.0, anno: key};
                        perAnnoGlobale[key].numGiorni += perAnno['perAnno'][key];
                        //perAnnoGlobale[key].importo += parseFloat((perAnno['perAnno'][key] * importogiornaliero).toFixed(2));
                    }
                }
            } else {
                nonConsiderati.push({
                    codMedico: codMedico,
                    cf: cf,
                    dataNascita: dataNascita.format("DD/MM/YYYY"),
                    dataInizioOriginale: moment(riga[DATA_INIZIO]).format("DD/MM/YYYY"),
                    dataFineOriginale: moment(riga[DATA_FINE]).format("DD/MM/YYYY"),
                    dataInizioCalcolata: dataInizio.format("DD/MM/YYYY"),
                    dataFineCalcolata: dataFine.format("DD/MM/YYYY"),
                    numGiorni: numGiorni > 0 ? numGiorni : 0,
                    importo: numGiorni > 0 ? parseFloat((numGiorni * importogiornaliero).toFixed(2)) : 0,
                    note: nonConsiderare
                });
            }
        }

        for (let key in perAnnoGlobale)
            perAnnoGlobale[key].importo += parseFloat((perAnnoGlobale[key].numGiorni * importogiornaliero).toFixed(2));


        let totale = 0.0;
        let data = [];
        for (let key of Object.keys(importi)) {
            totale += importi[key];
            data.push({'codice': key, 'importo': importi[key]});
        }
        // show the totale and format as currency
        console.log("Totale: " + totale.toLocaleString('it-IT', {style: 'currency', currency: 'EUR'}));
        await utils.scriviOggettoSuNuovoFileExcel("importi_libretti.xlsx", data);
        await utils.scriviOggettoSuNuovoFileExcel("importi_libretti_dettaglio.xlsx", allRows);
        await utils.scriviOggettoSuNuovoFileExcel("non_considerati.xlsx", nonConsiderati);
        await utils.scriviOggettoSuNuovoFileExcel("importi_libretti_per_anno.xlsx", Object.values(perAnnoGlobale));

        // show every natiPerAnno length
        for (let key in natiPerAnno)
            console.log("Nati nel " + key + ": " + natiPerAnno[key].length);
        return totale;
    }


    async creaElenchiDeceduti(codToCfDistrettoMap, pathData, distretti, dataQuote = null) {
        let lista = {perDistretto: {}, nonTrovati: []};
        if (!dataQuote)
            dataQuote = moment().format("YYYY-MM-DD");
        let allfiles = utils.getAllFilesRecursive(pathData + path.sep + "elaborazioni" + path.sep, ".json");
        let allAssistiti = await utils.leggiOggettoDaFileJSON(pathData + path.sep + "assistitiNar.json");
        for (let medico in codToCfDistrettoMap) {
            let fileMedico = allfiles.filter(file => file.includes(medico));
            if (fileMedico.length === 0)
                lista.nonTrovati.push(codToCfDistrettoMap[medico]);
            else if (fileMedico.length === 1) {
                let fileData = await utils.leggiOggettoDaFileJSON(fileMedico[0]);
                for (let deceduto of Object.values(fileData.deceduti)) {
                    if (!lista.perDistretto.hasOwnProperty(codToCfDistrettoMap[medico].distretto))
                        lista.perDistretto[codToCfDistrettoMap[medico].distretto] = {
                            recuperi: [],
                            problemi: [],
                            medici: {}
                        };
                    let allAssistitiMedicoMap = {};
                    for (let assistito of Object.values(allAssistiti[medico].assistiti)) {
                        allAssistitiMedicoMap[assistito.codiceFiscale] = assistito;
                    }
                    let numQuote = 0;
                    let dataScelta = moment(allAssistitiMedicoMap[deceduto.cf].data_scelta, "DD/MM/YYYY");

                    if (!deceduto.hasOwnProperty('indirizzo') || deceduto.indirizzo === "" || deceduto.indirizzo === null)
                        deceduto.indirizzo = "-";
                    deceduto.dataScelta = dataScelta.format("DD/MM/YYYY");
                    deceduto.codMedico = medico;
                    deceduto.nomeCognomeMedico = codToCfDistrettoMap[medico].nome_cognome;
                    deceduto.distretto = distretti[codToCfDistrettoMap[medico].distretto];
                    deceduto.ambito = codToCfDistrettoMap[medico].ambito;
                    if (deceduto.hasOwnProperty('data_decesso') && deceduto.data_decesso !== "" && deceduto.data_decesso !== null && moment(deceduto.data_decesso, "DD/MM/YYYY").isAfter(moment("01/01/1900", "DD/MM/YYYY"))) {
                        let dataInizio = moment(deceduto.data_decesso, "DD/MM/YYYY").isBefore(dataScelta) ? dataScelta.format("DD/MM/YYYY") : deceduto.data_decesso;
                        // se la data di decesso è superiore al 1 gennaio 1900
                        numQuote = utils.calcolaMesiDifferenza(dataInizio, dataQuote);
                        deceduto.numQuoteDaRecuperare = numQuote;
                        deceduto.note = "";
                        if (moment(deceduto.data_decesso, "DD/MM/YYYY").isBefore(dataScelta)) {
                            deceduto.note = "Data decesso precedente alla data di scelta";
                            lista.perDistretto[codToCfDistrettoMap[medico].distretto].problemi.push(deceduto);
                        } else {
                            lista.perDistretto[codToCfDistrettoMap[medico].distretto].recuperi.push(deceduto);
                            if (!lista.perDistretto[codToCfDistrettoMap[medico].distretto].medici.hasOwnProperty(medico))
                                lista.perDistretto[codToCfDistrettoMap[medico].distretto].medici[medico] = {
                                    codice: medico,
                                    distretto: distretti[codToCfDistrettoMap[medico].distretto],
                                    ambito: codToCfDistrettoMap[medico].ambito,
                                    nomeCognome: codToCfDistrettoMap[medico].nome_cognome,
                                    numDeceduti: 0,
                                    quote: 0
                                };
                            lista.perDistretto[codToCfDistrettoMap[medico].distretto].medici[medico].numDeceduti += 1;
                            lista.perDistretto[codToCfDistrettoMap[medico].distretto].medici[medico].quote += numQuote;
                        }
                    } else {
                        deceduto.numQuoteDaRecuperare = 0;
                        deceduto.note = "Data di decesso non valida";
                        lista.perDistretto[codToCfDistrettoMap[medico].distretto].problemi.push(deceduto);
                    }
                }
            }
        }
        let out = {};
        for (let distretto in lista.perDistretto) {
            if (!out.hasOwnProperty(distretto))
                out[distretto] = {recuperi: [], problemi: []};
            out[distretto].recuperi.push(...lista.perDistretto[distretto].recuperi);
            out[distretto].problemi.push(...lista.perDistretto[distretto].problemi);
        }
        let global = {recuperi: [], problemi: []};
        for (let distretto in out) {
            // add column distretto in each recuperi and problemi
            for (let recupero of out[distretto].recuperi)
                global.recuperi.push(recupero);
            for (let problema of out[distretto].problemi)
                global.problemi.push(problema);
        }
        // create folder if exist pathData + path.sep + "recuperi" + path.sep
        if (!fs.existsSync(pathData + path.sep + "recuperi" + path.sep))
            fs.mkdirSync(pathData + path.sep + "recuperi" + path.sep);
        if (!fs.existsSync(pathData + path.sep + "recuperi" + path.sep + "per distretto" + path.sep))
            fs.mkdirSync(pathData + path.sep + "recuperi" + path.sep + "per distretto" + path.sep);
        for (let distretto in out) {
            await utils.scriviOggettoSuNuovoFileExcel(pathData + path.sep + "recuperi" + path.sep + "per distretto" + path.sep + distretto + "_recuperi.xlsx", out[distretto].recuperi);
            await utils.scriviOggettoSuNuovoFileExcel(pathData + path.sep + "recuperi" + path.sep + "per distretto" + path.sep + distretto + "_problemi.xlsx", out[distretto].problemi);
        }
        await utils.scriviOggettoSuNuovoFileExcel(pathData + path.sep + "recuperi" + path.sep + "global_recuperi.xlsx", global.recuperi);
        await utils.scriviOggettoSuNuovoFileExcel(pathData + path.sep + "recuperi" + path.sep + "global_problemi.xlsx", global.problemi);
    }
}
