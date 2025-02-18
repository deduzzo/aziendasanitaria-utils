import {utils} from "./Utils.js";


class Stipendi {

    static async getDataFromCedoliniConvenzionati(path) {
        let cedolini = {};
        let errors = [];
        const splitPagina = "ASP MESSINA - ";
        const datiCed = await utils.getHtmlFromPdf(path);
        let pagine = datiCed.split(splitPagina);
        for (let indexPagina = 1; indexPagina< pagine.length; indexPagina++) {
            let pagina = pagine[indexPagina];
            let righe = utils.removeEmptyValuesFromArray(pagina.split("\n"));
            let datiCedolino = {
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
            datiCedolino.cedolino.totali.netto = parseFloat(rigaTotaliSplitted[rigaTotaliSplitted.length-1].replace(",", "."));
            datiCedolino.cedolino.totali.ritenute = parseFloat(rigaTotaliSplitted[rigaTotaliSplitted.length-2].replace(",", "."));
            datiCedolino.cedolino.totali.totaleCompetenze = parseFloat(rigaTotaliSplitted[rigaTotaliSplitted.length-3].replace(",", "."));
            const rigaElaborazione = utils.removeEmptyValuesFromArray(righe[righe.length - 4].replace("ELAB.:","").split(" "));
            datiCedolino.cedolino.elaborazione.anno = parseInt(rigaElaborazione[1]);
            datiCedolino.cedolino.elaborazione.mese = utils.meseNumero[rigaElaborazione[0].toLowerCase()];
            const key = datiCedolino.datiMedico.codiceFiscale + "-" + datiCedolino.gestione + "-" + datiCedolino.cedolino.competenza.anno + "-" + datiCedolino.cedolino.competenza.mese;
            if (!cedolini[key]) {
                cedolini[key] = datiCedolino;
            }
            else {
                errors.push({msg: "Cedolino duplicato", key:key, data: datiCedolino});
            }
        }
        return {cedolini, errors};
    }

}

export default Stipendi;
