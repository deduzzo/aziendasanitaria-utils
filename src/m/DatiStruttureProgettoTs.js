import puppeteer from 'puppeteer';
import moment from "moment";
import {common} from "./../common.js"
import {Nar} from "../narTsServices/Nar.js";
import {Ts} from "../narTsServices/Ts.js";

export class DatiStruttureProgettoTs {

    //cod reg = 190, cod_asl = 205
    _parametriMap =
        {
            _ANNO: "<anno>",
            _MESE: "<mese>",
            _COD_REG: "<cod_reg>",
            _COD_ASL: "<cod_asl>",
            _COD_STRUTTURA: "<cod_struttura>"
        }


    _urlProspettoContabileV1 = "https://sistemats4.sanita.finanze.it/SimossLiqV2Web/caricaDettaglioProspettiContabiliSFatt.do?" +
        "tipoStampa=html&annoSped=<anno>&meseSped=<mese>&tipoPeriodo=s&codReg=<cod_reg>&codAsl=<cod_asl>" +
        "&tipoErogazione=tutti&tipoRicerca=&codSsa=<cod_struttura>&tutte=n&aslAccorpata=<cod_asl>"

    /**
     * @param {ImpostazioniFlussoM} impostazioni - Impostazioni Flusso M
     */
    constructor(impostazioni) {
        this._impostazioni = impostazioni;
    }


    #sostituisciValoriInUrl(url, map) {
        // map = { ANNO: 2021, MESE: 1, COD_REG: ecc..  }
        for (let chiave in map)
            url = url.replaceAll(this._parametriMap[chiave.toString()], map[chiave].toString());
        return url;
    }

    async ottieniInformazioniStrutture(arrayStrutture) {
        // arraystrutture: {mese, anno, codiceRegione, codiceAsl, codiceStruttura}
        const maxRetryOriginal = 5;
        let maxRetry = maxRetryOriginal;
        let out = {error: false, out: {}}
        let ris = {}
        let ts = new Ts(this._impostazioni.impostazioniServizi);
        let page = await ts.getWorkingPage();
        if (page)
            for (let val of Object.values(arrayStrutture)) {
                let {mese, anno, codiceRegione, codiceAsl, codiceStruttura} = val
                maxRetry = maxRetryOriginal;
                out = {error: false, out: {}}
                do {
                    //try {
                    let map = {
                        _MESE: common.mesi[mese],
                        _ANNO: anno,
                        _COD_REG: codiceRegione,
                        _COD_ASL: codiceAsl,
                        _COD_STRUTTURA: codiceStruttura
                    }
                    let url = this.#sostituisciValoriInUrl(this._urlProspettoContabileV1, map);
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
                            let totaliPerBranca = {}
                            let dichiarati = {}
                            let righeTabella1 = document.querySelector("body > div:nth-child(5) > table:nth-child(9)").rows.length;
                            let righeTabella2 = document.querySelector("body > div:nth-child(5) > table:nth-child(14)").rows.length;
                            for (let i = 3; i < righeTabella1; i++) {
                                totaliPerBranca[document.querySelector("body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(" + i + ") > td:nth-child(1)").innerHTML.replaceAll("&nbsp;", "")] =
                                    {
                                        numero_ricette: parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(" + i + ") > td:nth-child(2)").innerText.replaceAll('.', '').replaceAll(',', '.')),
                                        importo_totale: parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(" + i + ") > td:nth-child(3)").innerText.replaceAll('.', '').replaceAll(',', '.')),
                                        ticket_totale: parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(" + i + ") > td:nth-child(4)").innerText.replaceAll('.', '').replaceAll(',', '.')),
                                        sconto_totale: parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(" + i + ") > td:nth-child(6)").innerText.replaceAll('.', '').replaceAll(',', '.')),
                                        netto_mese_totale: parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(" + i + ") > td:nth-child(7)").innerText.replaceAll('.', '').replaceAll(',', '.')),
                                    }
                            }
                            dichiarati.numero_ricette = parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(14) > tbody > tr:nth-child(" + righeTabella2 + ") > td:nth-child(2)").innerText.replaceAll('.', '').replaceAll(',', '.'));
                            dichiarati.importo_totale = parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(14) > tbody > tr:nth-child(" + righeTabella2 + ") > td:nth-child(3)").innerText.replaceAll('.', '').replaceAll(',', '.'));
                            dichiarati.netto_mese_totale = parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(14) > tbody > tr:nth-child(" + righeTabella2 + ") > td:nth-child(5)").innerText.replaceAll('.', '').replaceAll(',', '.'));
                            out2.out = {
                                denominazione_ts: document.querySelector("body > div:nth-child(5) > table:nth-child(6) > tbody > tr:nth-child(2) > td:nth-child(2)").innerHTML.replaceAll('&nbsp;', '').replaceAll('&amp','').trim(),
                                cod_struttura: parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(6) > tbody > tr:nth-child(3) > td:nth-child(2)").innerText.replaceAll('.', '').replaceAll(',', '.')),
                                importo_totale: parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(" + righeTabella1 + ") > td:nth-child(3)").innerText.replaceAll('.', '').replaceAll(',', '.')),
                                ticket_totale: parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(" + righeTabella1 + ") > td:nth-child(4)").innerText.replaceAll('.', '').replaceAll(',', '.')),
                                netto_mese_totale: parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(" + righeTabella1 + ") > td:nth-child(7)").innerText.replaceAll('.', '').replaceAll(',', '.')),
                                numero_ricette: parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(" + righeTabella1 + ") > td:nth-child(2)").innerText.replaceAll('.', '').replaceAll(',', '.')),
                                sconto: parseFloat(document.querySelector("body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(" + righeTabella1 + ") > td:nth-child(6)").innerText.replaceAll('.', '').replaceAll(',', '.')),
                                is_definitivo: !document.querySelector("body > div:nth-child(5) > table:nth-child(18)").innerText.includes("non sono ancora definitivi"),
                                totali_per_branca: totaliPerBranca,
                                totali_dichiarati: dichiarati
                            }
                        }
                        return out2;
                    });
                    out = datiStruttura;
                    if (!datiStruttura.error) {
                        let numeroPrestazioni = 0;
                        let i = 3;
                        for (let branca in out.out.totali_per_branca) {
                            await page.click("body > div:nth-child(5) > table:nth-child(9) > tbody > tr:nth-child(" + i++ + ") > td:nth-child(8) > a");
                            await page.waitForSelector('body > div:nth-child(5) > table:nth-child(13)');
                            await page.waitForTimeout(200);
                            let numeroPrestazioniBranca = 0;
                            try {
                                numeroPrestazioniBranca = await page.evaluate(() => {
                                    let num = document.querySelector("body > div:nth-child(5) > table:nth-child(13)").rows.length;
                                    console.log("quanti " + num)
                                    return document.querySelector("body > div:nth-child(5) > table:nth-child(13) > tbody > tr:nth-child(" + num.toString() + ") > td:nth-child(3)").innerText;
                                });
                            } catch (ex) {
                                console.log(ex);
                            }
                            numeroPrestazioniBranca = parseInt(numeroPrestazioniBranca.toString().trim())
                            out.out.totali_per_branca[branca].numeroPrestazioni = numeroPrestazioniBranca;
                            numeroPrestazioni += numeroPrestazioniBranca;
                            await page.goBack()
                            await page.waitForSelector('body > div:nth-child(5) > table:nth-child(6)');
                        }
                        out.out.numeroPrestazioni = numeroPrestazioni
                        out.out.dataOra = moment().format("YYYY/MM/DD-HH:mm:ss");
                    }
                    /*} catch (ex) {
                        out.error = true;
                        out.errortext = "Generic error2";
                    }*/
                } while (out.error && out.errortext !== "no_data" && --maxRetry > 0)
                ris[codiceStruttura + "-" + mese + anno] = out;
                console.log("Struttura " + codiceStruttura + " mese " + mese + " anno " + anno + " elaborata");
                console.log("valori:")
                console.log(out);
            }
        await ts.doLogout()
        return ris;
    }
}