import {utils} from "./Utils.js";
import path from "path";
import fs from "fs";
import * as cheerio from 'cheerio';

class Stipendi {

    static async getDataFromPdfCedoliniConvenzionati(pathPdf) {
        let cedolini = {};
        let errors = [];
        const splitPagina = "ASP MESSINA - ";
        const startPagina = "\n                                               ASP MESSINA -"
        const datiCed = await utils.getHtmlFromPdf(pathPdf);
        try {
            if (datiCed.includes(splitPagina) && datiCed.startsWith(startPagina)) {
                let pagine = datiCed.split(splitPagina);
                for (let indexPagina = 1; indexPagina < pagine.length; indexPagina++) {
                    let pagina = pagine[indexPagina];
                    let righe = utils.removeEmptyValuesFromArray(pagina.split("\n"));
                    let datiCedolino = {
                        filePath: pathPdf,
                        gestione: null,
                        ruolo: null,
                        datiMedico: {
                            cognome: null,
                            nome: null,
                            codiceFiscale: null,
                            matricola: null,
                            dataNascita: null,
                            cod: null,
                            indirizzo: null,
                        },
                        rapporto: {
                            tipo: null,
                            dataInizio: null,
                            dal: null,
                            qualifica: null,
                            qualificaString: null,
                            posizione: null,
                            livello: null
                        },
                        cedolino: {
                            elaborazione: {
                                mese: null,
                                anno: null,
                            },
                            competenza: {
                                mese: null,
                                anno: null,
                            },
                            righe: [],
                            totali: {
                                arretratiPrecedenti: null,
                                arretratiAttuali: null,
                                totaleCompetenze: null,
                                ritenute: null,
                                netto: null,
                            },
                            totPagine: null,
                            paginaDa: null,
                            paginaA: null,
                            pagamento: {
                                iban: null,
                                banca: null,
                            }
                        }
                    }
                    const rigaGestioneSplitted = utils.removeEmptyValuesFromArray(righe[4].split("   "));
                    datiCedolino.gestione = rigaGestioneSplitted[0];
                    datiCedolino.ruolo = rigaGestioneSplitted[1] + "-" + rigaGestioneSplitted[2];
                    datiCedolino.datiMedico.cod = rigaGestioneSplitted[3];
                    const rigaAssistito1 = utils.removeEmptyValuesFromArray(righe[5].split("  "));
                    datiCedolino.datiMedico.dataNascita = rigaAssistito1[0];
                    datiCedolino.datiMedico.codiceFiscale = rigaAssistito1[1];
                    datiCedolino.datiMedico.matricola = rigaAssistito1[2];
                    datiCedolino.datiMedico.cognome = rigaAssistito1[3];
                    datiCedolino.datiMedico.nome = rigaAssistito1[4];
                    const rigaRapportoIndirizzo1 = utils.removeEmptyValuesFromArray(righe[6].split("   "));
                    datiCedolino.rapporto.tipo = rigaRapportoIndirizzo1[0];
                    datiCedolino.rapporto.dataInizio = rigaRapportoIndirizzo1[1];
                    datiCedolino.rapporto.dal = rigaRapportoIndirizzo1[2];
                    datiCedolino.datiMedico.indirizzo = rigaRapportoIndirizzo1[3];
                    datiCedolino.datiMedico.indirizzo += ", " + righe[7].trim();
                    const rigaQualificaProfLivello = utils.removeEmptyValuesFromArray(righe[8].split("  "));
                    datiCedolino.rapporto.qualifica = rigaQualificaProfLivello[0];
                    datiCedolino.rapporto.posizione = rigaQualificaProfLivello[1];
                    datiCedolino.rapporto.livello = rigaQualificaProfLivello[2];
                    datiCedolino.rapporto.qualificaString = righe[9].trim().toUpperCase();
                    datiCedolino.cedolino.totPagine = righe[righe.length - 2].split("/")[1];
                    datiCedolino.paginaDa = indexPagina;
                    datiCedolino.paginaA = indexPagina + parseInt(datiCedolino.cedolino.totPagine) - 1;

                    let paginaCorrente = 1;
                    do {
                        if (paginaCorrente > 1) {
                            pagina = pagine[++indexPagina];
                            righe = utils.removeEmptyValuesFromArray(pagina.split("\n"));
                        }
                        for (let riga of utils.removeEmptyValuesFromArray(righe.slice(10))) {
                            if (!isNaN(riga[0])) {
                                let rigaTemp = {
                                    codice: null,
                                    descrizione: null,
                                    tariffa: null,
                                    quantita: null,
                                    ritenute: null,
                                    competenza: null,
                                }
                                riga = riga.trim();
                                rigaTemp.codice = riga.substring(0, 4);
                                rigaTemp.descrizione = riga.substring(0, 50).replace(rigaTemp.codice, "").trim();
                                const virgole = {
                                    tariffa: 56,
                                    quantita: 70,
                                    ritenute: 80,
                                    competenza: 89
                                }
                                const parteValori = utils.removeEmptyValuesFromArray(riga.substring(50).split(" "));
                                let numTrovati = 0;
                                for (let key in virgole) {
                                    if (riga[virgole[key]] === ",") {
                                        rigaTemp[key] = parseFloat(parteValori[numTrovati].replace(",", "."));
                                        numTrovati++;
                                    }
                                }
                                datiCedolino.cedolino.righe.push(rigaTemp);
                            }
                            if (riga.startsWith("Coniuge"))
                                break;
                        }
                    } while (paginaCorrente++ < datiCedolino.cedolino.totPagine);
                    const rigaBancaSplitted = utils.removeEmptyValuesFromArray(righe[righe.length - 1].split("     "));
                    datiCedolino.cedolino.pagamento.banca = rigaBancaSplitted[1];
                    datiCedolino.cedolino.pagamento.iban = rigaBancaSplitted[0];
                    const rigaTotaliSplitted = utils.removeEmptyValuesFromArray(righe[righe.length - 3].split("  "));
                    datiCedolino.cedolino.competenza.anno = utils.meseNumero[rigaTotaliSplitted[0].split(" ")[0].toLowerCase()];
                    datiCedolino.cedolino.competenza.mese = parseInt(rigaTotaliSplitted[0].split(" ")[1]);
                    if (rigaTotaliSplitted.length === 2 && rigaTotaliSplitted[1] === ',00') {
                        datiCedolino.cedolino.totali.netto = 0.0;
                        datiCedolino.cedolino.totali.ritenute = 0.0;
                        datiCedolino.cedolino.totali.totaleCompetenze = 0.0;
                    } else {
                        datiCedolino.cedolino.totali.netto = parseFloat(rigaTotaliSplitted[rigaTotaliSplitted.length - 1].replace(",", "."));
                        datiCedolino.cedolino.totali.ritenute = parseFloat(rigaTotaliSplitted[rigaTotaliSplitted.length - 2].replace(",", "."));
                        datiCedolino.cedolino.totali.totaleCompetenze = parseFloat(rigaTotaliSplitted[rigaTotaliSplitted.length - 3].replace(",", "."));
                    }
                    const rigaElaborazione = utils.removeEmptyValuesFromArray(righe[righe.length - 4].replace("ELAB.:", "").split(" "));
                    datiCedolino.cedolino.elaborazione.anno = parseInt(rigaElaborazione[1]);
                    datiCedolino.cedolino.elaborazione.mese = utils.meseNumero[rigaElaborazione[0].toLowerCase()];
                    const key = datiCedolino.datiMedico.codiceFiscale + "-" +  datiCedolino.datiMedico.matricola + "-" + datiCedolino.gestione + "-" + datiCedolino.cedolino.competenza.anno + "-" + datiCedolino.cedolino.competenza.mese;
                    if (!cedolini[key]) {
                        cedolini[key] = datiCedolino;
                    } else {
                        errors.push({msg: "Cedolino duplicato", key: key, data: {otherPath: cedolini[key].filePath, thisPath: pathPdf}});
                    }
                }
                console.log(path.basename(pathPdf) + " OK. Caricati n° " + Object.keys(cedolini).length + " cedolini");
                return {cedolini, errors};
            } else {
                console.error("Formato file pdf non riconosciuto", path.basename(pathPdf))
                return null;
            }
        } catch (e) {
            console.error("Errore in lettura file pdf", path.basename(pathPdf), e);
            return {cedolini: {}, errors: [{msg: "Errore in lettura file pdf", data: pathPdf}]};
        }
    }

    static async getDataFromHtmlMMGPls(pathHtml) {
        const html = fs.readFileSync(pathHtml, 'utf-8');
        const $ = cheerio.load(html);
        // get all tables that contain a row with "Azienda Sanitaria Provinciale di Messina Part."
        const tables = $("table").first().find("table").filter((i, el) => {
            const rows = $(el).find("tr");
            let found = false;
            rows.each((i, row) => {
                if ($(row).text().includes("Azienda Sanitaria Provinciale di Messina Part.")) {
                    found = true;
                }
            });
            return found;
        });
        let allCedoliniRows = [];
        // for each table console the row content
        tables.each((i, table) => {
            const rows = $(table).find('> tr, > tbody > tr');
            const cedoliniRows = [];
            rows.each((i, row) => {
                const val = $(row).text().trim();
                if (val.length > 0) {
                    cedoliniRows.push(val);
                    console.log(val);
                }
            });
            allCedoliniRows.push(cedoliniRows);
        });
        console.log("ciao");
    }

    static async getAllDatiStipendiConvenzionati(pathCedolini) {
        let allCedoliniData = {cedolini: {}, errors: []};
        let allPdfFiles = utils.getAllFilesRecursive(pathCedolini, ".pdf");
        for (let pdfFile of allPdfFiles) {
            const out = await Stipendi.getDataFromPdfCedoliniConvenzionati(pdfFile);
            if (out) {
                let cedoliniSingoli = {};
                let {cedolini, errors} = out;
                for (let cedolino in cedolini)
                    cedoliniSingoli[cedolino] = [cedolini[cedolino].paginaDa, cedolini[cedolino].paginaA];
                allCedoliniData.cedolini = {...allCedoliniData.cedolini, ...cedolini};
                allCedoliniData.errors = [...allCedoliniData.errors, ...errors];
                if (errors.length > 0)
                    console.error("ERRORS: ", errors);
                console.log("STATS: Cedolini caricati: ", Object.keys(allCedoliniData.cedolini).length, "Errori: ", allCedoliniData.errors.length);
                await utils.estraiPagineDaPdf(pdfFile, cedoliniSingoli);
            }
        }
        await utils.scriviOggettoMP(allCedoliniData, pathCedolini + path.sep + "cedoliniData.db");
        return allCedoliniData;
    }
}

export default Stipendi;
