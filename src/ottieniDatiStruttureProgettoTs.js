import puppeteer from 'puppeteer';
import {settings} from "../src/config/config.js"
import moment from "moment";

//cod reg = 190, cod_asl = 205
const _parametriMap =
    {
        _ANNO: "<anno>",
        _MESE: "<mese>",
        _COD_REG: "<cod_reg>",
        _COD_ASL: "<cod_asl>",
        _COD_STRUTTURA: "<cod_struttura>"
    }

const _mesi = {
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

const _urlProspettoContabileV1 = "https://sistemats4.sanita.finanze.it/SimossLiqV2Web/caricaDettaglioProspettiContabiliS.do?" +
    "tipoStampa=html&annoSped=<anno>&meseSped=<mese>&tipoPeriodo=s&codReg=<cod_reg>&codAsl=<cod_asl>" +
    "&tipoErogazione=tutti&tipoRicerca=&codSsa=<cod_struttura>&tutte=n&aslAccorpata=<cod_asl>"

const _sostituisciValoriInUrl= (url, map) => {
    // map = { ANNO: 2021, MESE: 1, COD_REG: ecc..  }
    for (let chiave in map)
        url = url.replaceAll(_parametriMap[chiave.toString()], map[chiave].toString());
    return url;
}

const ottieniInformazioniStrutture = async (arrayStrutture) => {
        // arraystrutture: {mese, anno, codiceRegione, codiceAsl, codiceStruttura}
        const maxRetryOriginal = 5;
        let maxRetry = maxRetryOriginal;
        let out = {error: false, out: {}}
        let ris = {}
        const browser = await puppeteer.launch({headless: false});
        const page = await browser.newPage();
        try {
            await page.goto('https://sistemats4.sanita.finanze.it/simossHome/login.jsp');
            await page.type("#j_username", settings.ts_username);
            await page.type("#j_password", settings.ts_password);
            await page.click("#login > fieldset > input:nth-child(11)");
            await page.waitForSelector('#dettaglio_utente')
            /*await page.waitForNavigation({
                waitUntil: 'networkidle0',
            });*/
            console.log("loaded")
        }catch (ex) {
            out.error = true;
            out.errortext = "Generic error";
        }
        if (!out.error)
            for (let val of Object.values(arrayStrutture)) {
                let {mese, anno, codiceRegione, codiceAsl, codiceStruttura} = val
                maxRetry = maxRetryOriginal;
                out = {error: false, out: {}}
                do {
                    try {
                        let map = {
                            _MESE: _mesi[mese],
                            _ANNO: anno,
                            _COD_REG: codiceRegione,
                            _COD_ASL: codiceAsl,
                            _COD_STRUTTURA: codiceStruttura
                        }
                        let url = _sostituisciValoriInUrl(_urlProspettoContabileV1, map);
                        await page.goto(url, {waitUntil: 'networkidle2'});
                        let datiStruttura = await page.evaluate(() => {
                            let out2 = {error: false, out: {}}
                            //todo: distinzione tra errore e dato mancante
                            if (document.body?.innerText.toLowerCase().includes("outOfMemory".toLowerCase())) {
                                out2.error = true;
                                out2.errortext = document.body?.innerText;
                            } else if (document.querySelector("body > div:nth-child(3) > div > div > fieldset > ul > li")?.innerText.toLowerCase() === "errore generico") {
                                out2.error = true;
                                out2.errortext = "no_data";
                            } else if (document.querySelector("body > div:nth-child(3) > div > div > fieldset > ul > li") ||
                                !document.querySelector("body > div:nth-child(5) > table:nth-child(6) > tbody > tr:nth-child(3) > td:nth-child(2)")) {
                                out2.error = true;
                                out2.errortext = "Page Error";
                            } else {
                                //totale ricette : body > div:nth-child(5) > table:nth-child(14) > tbody > tr:nth-child(4) > td:nth-child(2)
                                //importo totale: body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(4) > td:nth-child(3)
                                //totale ticket: body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(4) > td:nth-child(4)
                                //netto del mese: body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(4) > td:nth-child(7)
                                console.log("ciao");
                                out2.out = {
                                    cod_struttura: parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(6) > tbody > tr:nth-child(3) > td:nth-child(2)").innerText.replaceAll('.', '').replaceAll(',', '.')),
                                    importo_totale: parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(4) > td:nth-child(3)").innerText.replaceAll('.', '').replaceAll(',', '.')),
                                    ticket_totale: parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(4) > td:nth-child(4)").innerText.replaceAll('.', '').replaceAll(',', '.')),
                                    netto_mese_totale: parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(4) > td:nth-child(7)").innerText.replaceAll('.', '').replaceAll(',', '.')),
                                }
                            }
                            return out2;
                        });
                        out = datiStruttura;
                        if (!datiStruttura.error) {
                            await page.click("body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(3) > td:nth-child(8) > a");
                            await page.waitForSelector('body > div:nth-child(5) > table:nth-child(6)');
                            let numeroPrestazioni = await page.evaluate(() => {
                                let num = document.querySelector("body > div:nth-child(5) > table:nth-child(13)").rows.length;
                                console.log("quanti " + num)
                                return document.querySelector("body > div:nth-child(5) > table:nth-child(13) > tbody > tr:nth-child(" + num.toString() + ") > td:nth-child(3)").innerText;
                            });
                            out.out.numeroPrestazioni = parseInt(numeroPrestazioni);
                            out.out.dataOra = moment().format("YYYY/MM/DD-HH:mm:ss");
                        }
                    } catch (ex) {
                        out.error = true;
                        out.errortext = "Generic error";
                    }
                } while (out.error && out.errortext !== "no_data" && --maxRetry > 0)
                ris[codiceStruttura + "-" + mese + anno] = out;
                console.log("Struttura " + codiceStruttura + " mese " + mese + " anno " + anno + " elaborata");
                console.log("valori:")
                console.log(out);
            }
        await browser.close()
        return ris;
    }

export const progettoTSFlussoM = { ottieniInformazioniStrutture }