import moment from 'moment';
import path, {parse} from 'path';
import readline from 'readline';
import md5File from 'md5-file';
import fs from 'fs';
import {common} from "../common.js";
import _ from 'lodash';
import MDBReader from "mdb-reader";
import {DatiStruttureProgettoTs} from "./DatiStruttureProgettoTs.js";
import ExcelJS from "exceljs"
import loki from 'lokijs';

export class FlussoM {
    /**
     * @param {ImpostazioniFlussoM} settings - Settings
     */
    constructor(settings, starts = this._startsFlussoMV10082012) {
        this._settings = settings;
        this._starts = starts
    }

    get settings() {
        return this._settings;
    }

    set settings(value) {
        this._settings = value;
    }

    get starts() {
        return this._starts;
    }

    set starts(value) {
        this._starts = value;
    }

    static PER_STRUTTURA = "PER_STRUTTURA"
    static PER_STRUTTURA_ANNO_MESE = "PER_STRUTTURA_ANNO_MESE"
    static TAB_TOTALI_PER_MESE = "TAB_TOTALI_PER_MESE"
    static TAB_CONSEGNE_PER_CONTENUTO = "TAB_CONSEGNE_PER_CONTENUTO"
    static TAB_CONSEGNE_PER_NOME_FILE = "TAB_CONSEGNE_PER_NOME_FILE"
    static TAB_DIFFERENZE_CONTENUTO_NOMEFILE = "TAB_DIFFERENZE_CONTENUTO_NOMEFILE"
    static DIVIDI_PER_MESE = "DIVIDI_PER_MESE"

    _startsFlussoMV10082012 = {
        regione: {id: 1, length: 3, type: "string", required: true},
        asID: {id: 2, length: 3, type: "string", required: true}, // codice azienda sanitaria
        arseID: {id: 3, length: 6, type: "string", required: true}, // codice regionale struttura erogatrice STS11
        brancaID: {id: 4, length: 2, type: "int", required: true}, // codice branca STS21
        mpID: {id: 5, length: 16, type: "string", required: true}, // codice medico prescrittore
        cognome: {id: 6, length: 30, type: "string", required: false}, // cognome utente
        nome: {id: 7, length: 20, type: "string", required: false}, // nome utente
        cf: {id: 8, length: 16, type: "string", required: true}, // codice fiscale
        sesso: {id: 9, length: 1, type: "string", required: false}, // sesso utente
        dataNascita: {id: 10, length: 8, type: "date", required: false}, // data Nascita Utente
        comRes: {id: 11, length: 6, type: "string", required: true}, // comune di residenza utente
        aspRes: {id: 12, length: 3, type: "string", required: true}, // Azienda Sanitaria provinciale di residenza
        dataPren: {id: 13, length: 8, type: "date", required: true}, // Data di Prenotazione, solo su riga 99
        ricettaID: {id: 14, length: 16, type: "string", required: true}, // Numero ricetta
        progrRicetta: {id: 15, length: 2, type: "string", required: true}, // Progressivo riga per ricetta
        diagnosi: {id: 16, length: 5, type: "string", required: false}, // codifica ICD9CM
        dataErog: {id: 17, length: 8, type: "date", required: true}, // Data erogazione, in caso di ciclo si riporta chisura ciclo
        nomID: {id: 18, length: 1, type: "string", required: true}, // codifica nomenclatore
        prestID: {id: 19, length: 7, type: "string", required: true}, // codice prestazione secondo nomenclatore
        quant: {id: 20, length: 3, type: "int", required: true}, // quantità
        ticket: {id: 21, length: 2, type: "double", required: true}, // posizione utente nei confronti del ticket
        esenzione: {id: 22, length: 6, type: "string", required: true}, // codice esenzione
        importoTicket: {id: 23, length: 7, type: "double", required: true}, // importo ticket
        totale: {id: 24, length: 8, type: "double", required: true}, // importo totale
        posContabile: {id: 25, length: 1, type: "string", required: true}, // posizione contabile
        recordID: {id: 26, length: 20, type: "string", required: true}, // identificativo Record
        CRIL: {id: 27, length: 8, type: "string", required: true}, // centro di rilevazione regionale CRIL
        op: {id: 28, length: 1, type: "string", required: true}, // onere prestazione
        tipoAccesso: {id: 29, length: 1, type: "string", required: true}, // tipo accesso, se è primo accesso o meno 0->altro 1-> primo accesso
        tempoMax: {id: 30, length: 1, type: "string", required: true}, // garanzia tempi massimi
        classePrior: {id: 31, length: 1, type: "string", required: true}, // Classe priorità
        vuoto: {id: 32, length: 2, type: "string", required: false}, // campo vuoto
    };




    #calcolaNumPrestazioni (righe) {
        let quanti = 0;
        for (let riga of righe) {
            quanti += parseInt(riga.quant);
        }
        return quanti;
    }

    #buildRicetteFromMRows (rows) {
        let ricetta = {}
        let riga99 = rows.filter((p) => p.progrRicetta === "99")[0];
        let prestazioni = rows.filter((p) => p.progrRicetta !== "99");
        var totPrestazioniCalcolate = prestazioni.reduce(function (tot, arr) {
            // return the sum with previous value
            return tot + arr.totale;
            // set initial value as 0
        }, 0);

        if (riga99 != null) {
            ricetta.id = riga99.ricettaID;
            ricetta.dataPren = moment(riga99.dataPren, "MM-DD-YYYY");
            ricetta.prestazioni = prestazioni;
            ricetta.codiceStruttura = riga99.arseID;
            ricetta.cf = riga99.cf;
            ricetta.riga99 = riga99;
            ricetta.numPrestazioni = this.#calcolaNumPrestazioni(prestazioni);
            ricetta.totale = riga99.totale;
            ricetta.totaleTicket = riga99.importoTicket;
            ricetta.differenzeTotale = parseFloat((totPrestazioniCalcolate - ricetta.totale - ricetta.totaleTicket).toFixed(2));
            ricetta.totalePrestazioniCalcolate = totPrestazioniCalcolate;
            return ricetta;
        } else {
            return null;
        }
    }

    #totaliMeseAnnoStruttura (ricette) {
        let out = {}
        for (let ricetta of ricette) {
            let key = null;
            let dataErog99 = ricetta.riga99.dataErog ? (ricetta.riga99.dataErog.month() + 1).toString() + ricetta.riga99.dataErog.year().toString() : null
            if (dataErog99?.length < 6)
                dataErog99 = "0" + dataErog99
            for (let prestazione of ricetta.prestazioni) {
                let dataErog = prestazione.dataErog ? (prestazione.dataErog.month() + 1).toString() + prestazione.dataErog.year().toString() : null;
                if (dataErog.length < 6)
                    dataErog = "0" + dataErog
                //if (dataErog !== dataErog99)
                //    console.log("data")
                key = (prestazione.arseID.substring(0, 4)) + (dataErog ?? dataErog99);
                if (!out.hasOwnProperty(key))
                    out[key] = {totaleLordo: 0, totaleTicket: 0, numPrestazioni: 0, totaleNetto: 0}
                out[key].totaleLordo += prestazione.totale;
                out[key].numPrestazioni += prestazione.quant;
                out[key].totaleNetto += ricetta.riga99.totale;
            }
            out[key].totaleTicket += ricetta.riga99.importoTicket;
            out[key].totaleNetto += ricetta.riga99.totale;
        }
        for (let key in out) {
            out[key].totaleLordo = parseFloat(out[key].totaleLordo.toFixed(2));
            out[key].totaleTicket = parseFloat(out[key].totaleTicket.toFixed(2));
            out[key].totaleNetto = parseFloat(out[key].totaleNetto.toFixed(2));
        }
        return out;
    }

    #checkMeseAnnoStruttura (ricette) {
        //chiave: mmAAAA, count: ?
        let datePrestazioni = {}
        let dateRiga99 = {}
        let dateMancanti99 = []
        let datePrestazioniMancanti = []
        let dateFuoriPeriodoDiCompetenza = []
        let codiceStruttura = null;
        for (let ricetta of ricette) {
            let key99 = null;
            if (!codiceStruttura && codiceStruttura !== "error") codiceStruttura = ricetta.riga99.arseID;
            if (ricetta.riga99.dataErog !== "") {
                try {
                    key99 = (ricetta.riga99.dataErog.month() + 1).toString() + ricetta.riga99.dataErog.year().toString()
                    if (key99.length === 5) key99 = "0" + key99;
                    if (ricetta.riga99.posContabile === "2" || ricetta.riga99.posContabile === "3") {
                        if (!dateFuoriPeriodoDiCompetenza.hasOwnProperty(key99))
                            dateFuoriPeriodoDiCompetenza[key99] = 1
                        else
                            dateFuoriPeriodoDiCompetenza[key99] = dateFuoriPeriodoDiCompetenza[key99] + 1;
                    } else { // se non c'è lo consideriamo nel periodo di competenza
                        if (!dateRiga99.hasOwnProperty(key99))
                            dateRiga99[key99] = 1
                        else
                            dateRiga99[key99] = dateRiga99[key99] + 1;
                    }
                    //controllo codice struttura
                    if (codiceStruttura !== "error")
                        if (codiceStruttura !== ricetta.riga99.arseID)
                            codiceStruttura = "error";
                } catch (ex) {
                    dateMancanti99.push(ricetta.riga99);
                }
            } else
                dateMancanti99.push(ricetta.riga99);
            for (let prestazione of ricetta.prestazioni) {
                if (prestazione.dataErog) {
                    try {
                        let key = (prestazione.dataErog.month() + 1).toString() + prestazione.dataErog.year().toString()
                        if (key.length === 5) key = "0" + key;
                        if (prestazione.posContabile === "2" || prestazione.posContabile === "3") {
                            if (!dateFuoriPeriodoDiCompetenza.hasOwnProperty(key))
                                dateFuoriPeriodoDiCompetenza[key] = 1
                            else
                                dateFuoriPeriodoDiCompetenza[key] = dateFuoriPeriodoDiCompetenza[key] + 1;
                        } else { // se non c'è lo consideriamo nel periodo di competenza
                            if (key99 === null || key === key99) {
                                if (!datePrestazioni.hasOwnProperty(key))
                                    datePrestazioni[key] = 0
                                else
                                    datePrestazioni[key] = datePrestazioni[key] + 1;
                            }
                        }
                        //controllo codice struttura
                        if (codiceStruttura !== "error")
                            if (codiceStruttura !== prestazione.arseID)
                                codiceStruttura = "error";
                    } catch (ex) {
                        datePrestazioniMancanti.push(prestazione);
                    }
                }
            }
        }
        let out = {date: [], risultato: {}}
        let totale = 0
        for (let key99 of Object.keys(dateRiga99)) {
            if (out.date.hasOwnProperty(key99))
                out.date[key99].count = out.date[key99].count + dateRiga99[key99];
            else
                out.date[key99] = {count: dateRiga99[key99]}
            totale += dateRiga99[key99];
        }
        for (let key of Object.keys(datePrestazioni)) {
            if (out.date.hasOwnProperty(key))
                out.date[key].count = out.date[key].count + datePrestazioni[key];
            else
                out.date[key] = {count: datePrestazioni[key]}
            totale += datePrestazioni[key];
        }
        for (let keyFuori of Object.keys(dateFuoriPeriodoDiCompetenza)) {
            if (out.date.hasOwnProperty(keyFuori))
                out.date[keyFuori].count = out.date[keyFuori].count + dateFuoriPeriodoDiCompetenza[keyFuori];
            else
                out.date[keyFuori] = {count: dateFuoriPeriodoDiCompetenza[keyFuori]}
            totale += dateFuoriPeriodoDiCompetenza[keyFuori];
        }
        let chiaveDataPrevalente = null
        for (let key of Object.keys(out.date)) {
            if (chiaveDataPrevalente === null)
                chiaveDataPrevalente = key;
            out.date[key].percentuale = ((out.date[key].count * 100) / totale).toFixed(2);
            if (out.date[key].percentuale > out.date[chiaveDataPrevalente].percentuale)
                chiaveDataPrevalente = key;
        }
        return {
            meseAnnoPrevalente: chiaveDataPrevalente,
            totale: out.date[chiaveDataPrevalente].count,
            percentuale: out.date[chiaveDataPrevalente].percentuale,
            codiceStruttura: codiceStruttura,
            date: out.date,
        };
    }

    async #processLineByLine(filePath, lunghezzaRiga) {
        let errors = [];
        const fileStream = fs.createReadStream(filePath);

        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        // Note: we use the crlfDelay option to recognize all instances of CR LF
        // ('\r\n') in input.txt as a single line break.

        let nLine = 0;
        for await (const line of rl) {
            // Each line in input.txt will be successively available here as `line`.
            nLine++;
            if (line.length !== lunghezzaRiga) {
                console.log("file: " + filePath);
                console.log('length: ' + line.length);
                console.log('nLine: ' + nLine);
                errors.push({file: filePath, lunghezza: line.length, linea: nLine})
            }
        }
        return errors;
    }

    async #elaboraFileFlussoM(filePath) {
        console.log("Elaboro " + filePath + " ...");
        const fileStream = fs.createReadStream(filePath);

        const rl = readline.createInterface({input: fileStream, crlfDelay: Infinity});
        var i = 0;
        var ricette = {};
        var ricettaTemp = [];
        let totale = {
            totale: 0,
            ticket: 0,
            numPrestazioni: 0,
            totalePrestazioniCalcolate: 0
        }
        let prestMap = {}
        let lunghezzaRiga = common.verificaLunghezzaRiga(this._starts);
        let error = null;
        for await (const line of rl) {
            if (line.length !== lunghezzaRiga) {
                error = i;
                break;
            } else {
                var t =  common.mRowToJson(line, this._starts);
                ricettaTemp.push(t);
                if (t.progrRicetta === "99") {
                    var rt = this.#buildRicetteFromMRows(ricettaTemp);
                    //TODO: filtro?
                    ricette[rt.id] = rt;
                    totale.totalePrestazioniCalcolate = totale.totalePrestazioniCalcolate + rt.totalePrestazioniCalcolate;
                    totale.numPrestazioni = totale.numPrestazioni + rt.numPrestazioni;
                    this.#calcolaTotaliPrestazioni(rt.prestazioni, prestMap)
                    totale.totale = totale.totale + rt.totale;
                    totale.ticket = totale.ticket + rt.totaleTicket;
                    ricettaTemp = [];
                }
                i++;
            }
        }
        if (error === null) {
            totale.prestazioniMap = prestMap;
            totale.totalePrestazioniCalcolate = parseFloat(totale.totalePrestazioniCalcolate.toFixed(2));
            totale.totale = parseFloat(totale.totale.toFixed(2));
            totale.ticket = parseFloat(totale.ticket.toFixed(2));
            let datiDaFile = this.#controllaNomeFileFlussoM(path.basename(filePath));
            let calcolaPrestazioniPerMese = this.#totaliMeseAnnoStruttura(Object.values(ricette))
            return {
                nomeFile: path.basename(filePath),
                datiDaFile: datiDaFile,
                absolutePath: filePath,
                hash: md5File.sync(filePath),
                totaleNetto: totale.totale,
                totaleLordo: parseFloat((totale.totale + totale.ticket).toFixed(2)),
                totaleTicket: totale.ticket,
                numPrestazioni: totale.numPrestazioni,
                totaleLordoPrestazioniCalcolate: parseFloat(totale.totalePrestazioniCalcolate.toFixed(2)),
                calcolaPrestazioniPerMese: calcolaPrestazioniPerMese,
                prestazioni: totale.prestazioniMap,
                numeroRighe: i,
                numeroRicette: Object.values(ricette).length,
                ricette: ricette,
                nonOk: Object.values(ricette).filter((p) => p.differenzeTotale !== 0)
            }
        } else
            return {
                error: true,
                rowError: i + 1,
                nomeFile: path.basename(filePath),
                absolutePath: filePath,
                hash: md5File.sync(filePath)
            }
    }
    #calcolaTotaliPrestazioni (allPrest,mapPrest) {
        for (let prest of allPrest) {
            let key = prest.dataErog.year().toString() + ((prest.dataErog.month() + 1).toString().length === 1 ? ("0" + (prest.dataErog.month() + 1).toString()) : (prest.dataErog.month() + 1).toString());

            if (!mapPrest.hasOwnProperty(key))
                mapPrest[key] = {}

            if (mapPrest[key].hasOwnProperty(prest.prestID)) {
                mapPrest[key][prest.prestID].num = mapPrest[key][prest.prestID].num + prest.quant;
                mapPrest[key][prest.prestID].totale = parseFloat((mapPrest[key][prest.prestID].totale + (prest.totale * prest.quant)).toFixed(2));
            } else {
                mapPrest[key][prest.prestID] = {}
                mapPrest[key][prest.prestID].num = prest.quant;
                mapPrest[key][prest.prestID].totale = parseFloat((prest.totale * prest.quant).toFixed(2));
            }
        }
        return mapPrest;
    }

    #controllaNomeFileFlussoM (nome) {
        try {
            if (nome.length !== 14)
                return null;
            return {
                idDistretto: nome.substring(0, 1),
                codStruttura: nome.substring(1, 5),
                mese: nome.substring(5, 7),
                anno: "20" + nome.substring(7, 9),
            }
        } catch (ex) {
            return null;
        }
    }


    #loadStruttureFromFlowlookDB () {
        const buffer = fs.readFileSync(this._settings.flowlookDBFilePath);
        const reader = new MDBReader(buffer);

        const strutture = reader.getTable(this._settings.flowlookDBTableSTS11).getData();
        let struttureFiltrate = strutture.filter(p => p["CodiceAzienda"] === this._settings.codiceAzienda && p["CodiceRegione"] === this._settings.codiceRegione);
        let mancanti = []
        let struttureOut = {}
        struttureFiltrate.forEach(p => {
            if (this._settings.datiStruttureRegione.comuniDistretti.hasOwnProperty(p["CodiceComune"])) {
                struttureOut[p['CodiceStruttura']] = {
                    codiceRegione: p['CodiceRegione'],
                    codiceAzienda: p['CodiceAzienda'],
                    denominazione: p['DenominazioneStruttura'],
                    codiceComune: p['CodiceComune'],
                    idDistretto: this._settings.datiStruttureRegione.comuniDistretti[p["CodiceComune"]],
                    dataUltimoAggiornamento: moment(p['DataAggiornamento'], 'DD/MM/YYYY')
                };
            } else
                mancanti.push(p);
        })
        return struttureOut;
    }


    async elaboraFlussi() {
        let fileOut = {ripetuti: [], ok: {}, errori: [], warning: []}
        //1- ottieni tutti i file txt della cartella
        let allFiles = common.getAllFilesRecursive(this._settings.in_folder, this._settings.extensions);
        let numFiles = allFiles.length;
        var progress = 0;
        // 2- elaborazione
        for (var file of allFiles) {
            let md5 = md5File.sync(file);
            if (!fileOut.ok.hasOwnProperty(md5)) {
                let ricetta = await this.#ottieniStatDaFileFlussoM(file)
                if (!ricetta.errore && !ricetta.warning)
                    fileOut.ok[ricetta.out.hash] = _.omit(ricetta.out, ["ricette", "nonOk"])
                else {
                    if (ricetta.warning)
                        fileOut.warning.push("WARNING!!: " + ricetta.warning)
                    else
                        fileOut.errori.push(ricetta.out)
                }
                console.log("elaborazione: " + ++progress + " di " + numFiles)
            } else {
                console.log("elaborazione: " + ++progress + " di " + numFiles + "\n File già presente")
                fileOut.ripetuti.push([fileOut.ok[md5].absolutePath, this._settings.in_folder + path.sep + file]);
            }
        }
        return fileOut;
    }

    async #ottieniStatDaFileFlussoM(file) {
        let strutture = this.#loadStruttureFromFlowlookDB();
        let ricetteInFile = await this.#elaboraFileFlussoM(file, this._starts);
        let warn = "";
        if (ricetteInFile.error) {
            console.log("file " + file + " con errori");
            return {errore: true, out: ricetteInFile};
        } else {
            let verificaDateStruttura = this.#checkMeseAnnoStruttura(Object.values(ricetteInFile.ricette))
            ricetteInFile.codiceStruttura = verificaDateStruttura.codiceStruttura;
            ricetteInFile.idDistretto = strutture[verificaDateStruttura.codiceStruttura]?.idDistretto.toString() ?? ricetteInFile.datiDaFile.idDistretto;
            ricetteInFile.annoPrevalente = verificaDateStruttura.meseAnnoPrevalente.substr(2, 4);
            ricetteInFile.mesePrevalente = verificaDateStruttura.meseAnnoPrevalente.substr(0, 2);
            ricetteInFile.date = _.omitBy(verificaDateStruttura.date, _.isNil);
            if (!strutture.hasOwnProperty(verificaDateStruttura.codiceStruttura)) {
                console.log("STRUTTURA " + verificaDateStruttura.codiceStruttura + " non presente sul FLOWLOOK")
                warn = "STRUTTURA " + verificaDateStruttura.codiceStruttura + " non presente sul FLOWLOOK"
            }
            return {errore: false, warning: (warn === "" ? false : warn), out: ricetteInFile}
        }
    }

    #calcolaDifferenzeDaTs (dati) {
        if (dati.hasOwnProperty("controlloTs") && dati.controlloTs.error === false) {
            return {
                differenzaTotaleNetto: parseFloat((dati.controlloTs.out.netto_mese_totale - dati.totaleNetto).toFixed(2)),
                differenzaTotale: parseFloat((dati.controlloTs.out.importo_totale - dati.totaleLordo).toFixed(2)),
                differenzaTicket: parseFloat((dati.controlloTs.out.ticket_totale - dati.totaleTicket).toFixed(2)),
                differenzaPrestazioni: dati.controlloTs.out.numeroPrestazioni - dati.numPrestazioni,
                differenzaRicette: dati.controlloTs.out.numero_ricette - dati.numeroRicette
            }
        }
    }

    async #scriviFlussoMSuCartella(fileElaborati, controlloTs, scriviStats = true) {
        common.creaCartellaSeNonEsisteSvuotalaSeEsiste(this._settings.out_folder);
        for (let chiave in fileElaborati) {
            let file = fileElaborati[chiave]
            let anno = file.datiDaFile?.anno ?? file.annoPrevalente;
            let mese = file.datiDaFile?.mese ?? file.mesePrevalente;
            if (Object.keys(controlloTs).length > 0) {
                fileElaborati[chiave].controlloTs = controlloTs[file.codiceStruttura + "-" + mese + anno];
                fileElaborati[chiave].differenze = this.#calcolaDifferenzeDaTs(fileElaborati[chiave])
            }
            if (!fs.existsSync(this._settings.out_folder + path.sep + anno)) {
                fs.mkdirSync(this._settings.out_folder + path.sep + anno);
            }
            if (!fs.existsSync(this._settings.out_folder + path.sep + anno + path.sep + mese)) {
                fs.mkdirSync(this._settings.out_folder + path.sep + anno + path.sep + mese);
            }
            let fname = this._settings.out_folder + path.sep + anno + path.sep + mese + path.sep + (file.idDistretto === undefined ? "X" : file.idDistretto) + file.codiceStruttura.substr(0, 4) + mese + anno.substr(2, 2) + "M.txt";
            fs.copyFileSync(file.absolutePath, fname);
            fileElaborati[chiave].tempPath = fname;
        }
        if (scriviStats)
            await this.scriviStatsFlussoM(fileElaborati)
    }

    #replacer(key, value) {
        if (value instanceof Map) {
            return {
                dataType: 'Map',
                value: Array.from(value.entries()), // or with spread: value: [...value]
            };
        } else {
            return value;
        }
    }

    async generaReportDaStats(salvaFileHtml = true, salvaFileExcel = true) {
        let idDistretti = Object.keys(this._settings.datiStruttureRegione.distretti);
        let strutture = this.#loadStruttureFromFlowlookDB();
        let files = common.getAllFilesRecursive(this._settings.out_folder, '.mstats');
        const table = {
            name: '',
            ref: 'A2',
            headerRow: true,
            totalsRow: true,
            columns: [
                {name: 'Id', key: 'id',totalsRowLabel: 'Totali:' },
                {name: 'Nome', key: 'nome'},
                {name: 'Distretto', key: 'distretto'},
                {name: 'Mese', key: 'mese'},
                {name: 'Anno', key: 'anno'},
                {name: 'N.Righe.M', key: 'nRigheM',totalsRowFunction: 'sum'},
                {name: 'N.Ricette.M', key: 'nRicetteM',totalsRowFunction: 'sum'},
                {name: 'N.Prest.M', key: 'nPrestM',totalsRowFunction: 'sum',},
                {name: 'TOT.NETTO.M', key: 'totNetto',totalsRowFunction: 'sum', style: { numFmt: '#,##0.00" €";[Red]\-#,##0.00" €"', width: 18 }},
                {name: 'TOT.TICKET.M', key: 'totTicketM', totalsRowFunction: 'sum', style: { numFmt: '#,##0.00" €";[Red]\-#,##0.00" €"' }},
                {name: 'TOT.LORDO.M', key: 'totLordoM', totalsRowFunction: 'sum', style: { numFmt: '#,##0.00" €";[Red]\-#,##0.00" €"' }},
                {name: 'TipoDati.TS', key: 'tipoDatiTS'},
                {name: 'N.Ricette.TS', key: 'nRicetteTS', totalsRowFunction: 'sum'},
                {name: 'N.Prest.TS', key: 'nPrestTS', totalsRowFunction: 'sum'},
                {name: 'TOT.NETTO.TS', key: 'totNettoTS', totalsRowFunction: 'sum', style: { numFmt: '#,##0.00" €";[Red]\-#,##0.00" €"' }},
                {name: 'TOT.TICKET.TS', key: 'totTicketTS', totalsRowFunction: 'sum', style: { numFmt: '#,##0.00" €";[Red]\-#,##0.00" €"' }},
                {name: 'TOT.LORDO.TS', key: 'totLordoTS', totalsRowFunction: 'sum', style: { numFmt: '#,##0.00" €";[Red]\-#,##0.00" €"' }},
                {name: 'Data Verifica TS', key: 'dataVerificaTS',width: 25, style: {numFmt: 'DD/MM/YYYY HH:MM' } },
                {name: 'Diff.N.Ricette', key: 'diffNRicette', totalsRowFunction: 'sum', style: { numFmt: '#0;[Red]\-#0' }},
                {name: 'Diff.N.Prest', key: 'diffNPrest', totalsRowFunction: 'sum', style: { numFmt: '#0;[Red]\-#0' }},
                {name: 'Diff.Netto', key: 'diffNetto', totalsRowFunction: 'sum', style: { numFmt: '#,##0.00" €";[Red]\-#,##0.00" €"' }},
                {name: 'Diff.Ticket', key: 'diffTicket', totalsRowFunction: 'sum', style: { numFmt: '#,##0.00" €";[Red]\-#,##0.00" €"' }},
                {name: 'Diff.Lordo', key: 'diffLordo', totalsRowFunction: 'sum', style: { numFmt: '#,##0.00" €";[Red]\-#,##0.00" €"' }},
            ],
            rows: [ ],
        };
        let data = [];
        for (let file of files) {
            let rawdata = fs.readFileSync(file);
            let dati = JSON.parse(rawdata);
            data.push(dati)
        }
        const workbook = new ExcelJS.Workbook();
        let sheets = []
        for (let distretto of idDistretti) {
            let nomeFile;
            let filteredData = []
            let gridData = [];
            if (distretto !== "") {
                filteredData = data.filter(p => p.idDistretto.toString() === distretto.toString())
                nomeFile = this._settings.datiStruttureRegione.distretti[distretto].toUpperCase();
            } else {
                filteredData = filteredData.sort(p => p.idDistretto)
                nomeFile = "out"
            }
            if (filteredData.length > 0) {
                for (let struttureFile of filteredData) {
                    gridData.push(
                        [
                            struttureFile.codiceStruttura,
                            strutture[struttureFile.codiceStruttura].denominazione.toUpperCase(),
                            this._settings.datiStruttureRegione.distretti[struttureFile.idDistretto],
                            (struttureFile.datiDaFile?.mese ?? struttureFile.mesePrevalente),
                            (struttureFile.datiDaFile?.anno ?? struttureFile.annoPrevalente),
                            struttureFile.numeroRighe,
                            struttureFile.numeroRicette,
                            struttureFile.numPrestazioni,
                            struttureFile.totaleNetto,
                            struttureFile.totaleTicket,
                            struttureFile.totaleLordo,
                            struttureFile.controlloTs?.out.is_definitivo === true ? "COMPLETI" : (struttureFile.hasOwnProperty("controlloTs") ? "INCOMPLETI" : "NON PRESENTI"),
                            struttureFile.controlloTs?.out.numero_ricette ?? "-",
                            struttureFile.controlloTs?.out.numeroPrestazioni ?? "-",
                            struttureFile.controlloTs?.out.netto_mese_totale ?? "-",
                            struttureFile.controlloTs?.out.ticket_totale ?? "-",
                            struttureFile.controlloTs?.out.importo_totale ?? "-",
                            struttureFile.controlloTs?.out.dataOra ? moment(struttureFile.controlloTs?.out.dataOra,"YYYY/MM/DD-HH:mm:ss").toDate() : "-",
                            struttureFile.differenze?.differenzaRicette ?? "-",
                            struttureFile.differenze?.differenzaPrestazioni ?? "-",
                            struttureFile.differenze?.differenzaTotaleNetto ?? "-",
                            struttureFile.differenze?.differenzaTicket ?? "-",
                            struttureFile.differenze?.differenzaTotale ?? "-",
                        ]
                    )
                }
                if (salvaFileHtml) {
                    const __dirname = path.resolve();
                    let rawdata = fs.readFileSync(path.resolve(__dirname, "src/grid/flussoM-mese.html")).toLocaleString();
                    rawdata = rawdata.replace("[xxx]", JSON.stringify(gridData));
                    rawdata = rawdata.replace("<h1></h1>",
                        "<h1>Distretto di " + this._settings.datiStruttureRegione.distretti[distretto].toUpperCase() + "</h1>"
                    )
                    fs.writeFileSync(this._settings.out_folder + path.sep + nomeFile + ".html", rawdata);
                }
                if (salvaFileExcel) {
                    let tempWorkBook = new ExcelJS.Workbook();
                    let tempSheet = tempWorkBook.addWorksheet(this._settings.datiStruttureRegione.distretti[distretto].toUpperCase() , {properties: {defaultColWidth: 15,showGridLines:true}});
                    sheets[this._settings.datiStruttureRegione.distretti[distretto].toUpperCase()] = workbook.addWorksheet(this._settings.datiStruttureRegione.distretti[distretto].toUpperCase(), {properties: {defaultColWidth: 15}});
                    let tempTable = {...table};
                    tempTable.rows = []
                    for (let dato of gridData)
                        tempTable.rows.push(dato);
                    tempTable.name = this._settings.datiStruttureRegione.distretti[distretto].toUpperCase();
                    [tempSheet,sheets[this._settings.datiStruttureRegione.distretti[distretto].toUpperCase()]].forEach((wk) =>
                    {
                        wk.addTable(tempTable)

                        wk.getColumn(2).width = 50;
                        [18,12,3].forEach(i => wk.getColumn(i).width = 20);
                        [1,3,4,5,12,18].forEach(i => wk.getColumn(i).alignment = { vertical: 'middle', horizontal: 'center' });

                        wk.getRow(2).alignment = { vertical: 'middle', horizontal: 'center' };
                        wk.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
                        for (let i = 1; i<=wk.rowCount; i++) {
                            let font = (i <3 || i === wk.rowCount) ? (i <3 ? '424242' : "BDBDBD") : "000000"
                            let bg = (i <3 || i === wk.rowCount) ? (i <3 ? 'BDBDBD' : "424242") : ((i % 2 === 0) ? "EEEEEE" : "D6D6D6")
                            wk.getRow(i).font = {bold: (i === 1 || i === wk.rowCount), color: {'argb': font}};
                            wk.getRow(i).fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: {'argb': bg},
                            };
                        }
                        wk.mergeCells('A1:C1');
                        wk.getCell('A1').value = "DATI STRUTTURA"
                        wk.mergeCells('D1:E1');
                        wk.getCell('D1').value = "MESE/ANNO"
                        wk.mergeCells('F1:K1');
                        wk.getCell('F1').value = "DATI DA FLUSSO M"
                        wk.mergeCells('L1:R1');
                        wk.getCell('L1').value = "DATI DA SITO SOGEI TESSERA SANITARIA"
                        wk.mergeCells('S1:W1');
                        wk.getCell('S1').value = "DIFFERENZE"
                    })
                    await tempWorkBook.xlsx.writeFile(this._settings.out_folder + path.sep + nomeFile + ".xlsx" )
                }
            }
        }
        await workbook.xlsx.writeFile(this._settings.out_folder + path.sep + "CONSEGNE_GLOBALI" + ".xlsx");
    }

    scriviStatsFlussoM (fileData,sovrascrivi=true, ext = ".mstats") {
        for (let file in fileData) {
            let md5 = file
            let dirName = path.dirname(fileData[file].tempPath)
            if (!fs.existsSync(dirName + path.sep + this._settings.stat_folder_name))
                fs.mkdirSync(dirName + path.sep + this._settings.stat_folder_name);
            if (sovrascrivi || !fs.existsSync(dirName + path.sep + this._settings.stat_folder_name + path.sep + md5 + ext))
                fs.writeFileSync(dirName + path.sep + this._settings.stat_folder_name + path.sep + md5 + ext, JSON.stringify(_.omit(fileData[file], ["absolutePath", "nomeFile", "tempPath"]), this.#replacer, "\t"), 'utf8');
        }
    }

    async trovaRicetteDuplicate(folder, scriviFileDifferenze, divisiPerTipologia = null, includiComunqueRicetteDuplicateNellaDivisione = false) {
        let cartellaTipologia;
        if (divisiPerTipologia !== null) {
            cartellaTipologia = folder  + path.sep + "SUDDIVISI_" + divisiPerTipologia;
            common.creaCartellaSeNonEsisteSvuotalaSeEsiste(cartellaTipologia);
        }
        let lunghezzaRiga = common.verificaLunghezzaRiga(this._starts);

        const calcolaMeseAnnoPrestazioni = (righeRicetta) =>
        {
            let annoMese = {}
            let data99 = "";
            for (let riga of righeRicetta)
            {
                if (riga.dataErog && riga.dataErog.isValid()) {
                    let anno = riga.dataErog.year().toString();
                    let mese = (riga.dataErog.month() +1) <10 ? ("0" + (riga.dataErog.month() +1).toString()) : (riga.dataErog.month() +1).toString()
                    if (riga.progrRicetta === "99")
                        data99 = anno + mese;
                    else {
                        if (annoMese.hasOwnProperty(anno + mese))
                            annoMese[anno + mese] += 1;
                        else
                            annoMese[anno + mese] = 1;
                    }
                }
                else if (riga.progrRicetta !== "99")
                    return "XXXXXX";
            }
            if (Object.keys(annoMese).length === 1)
                return Object.keys(annoMese)[0];
            else if (data99 !== "")
                return data99;
            else
                return "XXXXXX";
        }

        let db = new loki('index.db');
        let ricetteTable = db.addCollection('ricette', {
            unique: ['id'],
            indices: ['id']
        });
        let duplicati = db.addCollection('duplicati');
        let allFiles = common.getAllFilesRecursive(folder, this._settings.extensions);
        let logger = {}
        if (scriviFileDifferenze) {
            logger["loggerNoDuplicati"] = fs.createWriteStream(folder + path.sep + "no_duplicati.txt", {
                flags: 'a+' // 'a' means appending (old data will be preserved)
            })
            logger["loggerDuplicati"] = fs.createWriteStream(folder + path.sep + "solo_duplicati.txt", {
                flags: 'a+' // 'a' means appending (old data will be preserved)
            })
        }
        let numFile = 0;
        let numDuplicati = 0;
        for (let file of allFiles) {
            console.log("[" + ++numFile + " di " + allFiles.length + "] [DUPL: " + numDuplicati + "] - Elaboro " + file +  " ...");
            const fileStream = fs.createReadStream(file);
            const fileSizeInMB = (fs.statSync(file).size / 1000000).toFixed(2);
            const rl = readline.createInterface({input: fileStream, crlfDelay: Infinity});
            let i = 0;
            let ricettaTemp = [];
            let ricettaTempString = "";
            let error = null;
            for await (const line of rl) {
                if (line.length !== lunghezzaRiga) {
                    error = i;
                    break;
                } else {
                    let t = common.mRowToJson(line, this._starts);
                    ricettaTempString+= (line + "\n");
                    ricettaTemp.push(t);
                    if (t.progrRicetta === "99") {
                        let duplicata = false;
                         try {
                             ricetteTable.insert({id:t.ricettaID, file: file, line: i});
                         }
                         catch (ex) {
                             numDuplicati++;
                             duplicata = true;
                             if (scriviFileDifferenze)
                                 logger["loggerDuplicati"].write(ricettaTempString)
                             let duplicato = duplicati.findOne({id: t.ricettaID});
                             if (!duplicato) {
                                 let primo = ricetteTable.findOne({id: t.ricettaID});
                                 duplicati.insert({ id: t.ricettaID, info: [ {file: primo.file, line: primo.line} , { file: file, line: i  } ] })
                             }
                             else {
                                 duplicato.info.push({file: file, line: i})
                                 duplicati.update(duplicato)
                             }
                         }
                         if (!duplicata || includiComunqueRicetteDuplicateNellaDivisione) {
                             if (scriviFileDifferenze)
                                 logger["loggerNoDuplicati"].write(ricettaTempString)
                             if (divisiPerTipologia && scriviFileDifferenze) {
                                 let key = "";
                                 switch (divisiPerTipologia) {
                                     case FlussoM.PER_STRUTTURA:
                                         key = t.arseID;
                                         break;
                                     case FlussoM.PER_STRUTTURA_ANNO_MESE:
                                         key = t.arseID + "-" + calcolaMeseAnnoPrestazioni(ricettaTemp);
                                 }
                                 if (!logger.hasOwnProperty(key))
                                     logger[key] = fs.createWriteStream(cartellaTipologia + path.sep + key + ".txt", {
                                         flags: 'a+' // 'a' means appending (old data will be preserved)
                                     })
                                 logger[key].write(ricettaTempString);
                             }
                         }
                        ricettaTemp = [];
                        ricettaTempString = "";
                    }
                    if (++i % 100000 === 0) {
                        console.log("[" + numFile + " di " + allFiles.length + "] [DUPL: " + numDuplicati + "] [" + ((i * lunghezzaRiga) / 1000000).toFixed(2) + " mb su " + fileSizeInMB + "] - Elaboro " + file +  " ...");
                    }
                }
            }

        }
        if (scriviFileDifferenze)
            for (let loggerKey in logger)
                logger[loggerKey].end();
        let duplicatiObj =  duplicati.find({});
        let duplicatiJson = {}
        duplicatiObj.forEach((duplicato) => {
            duplicatiJson[duplicato.id] = duplicato.info;
        })
        if (scriviFileDifferenze)
            fs.writeFileSync(folder + path.sep + "duplicatiSTAT.json", JSON.stringify(duplicatiJson, this.#replacer, "\t"), 'utf8')
        return {
            numDuplicati: numDuplicati,
            stats: duplicatiJson
        };
    }

    async unisciFilePerCartella(inFolder = this._settings.in_folder,outFolder = this._settings.out_folder)
    {
        let files = fs.readdirSync(inFolder)

        for (const file of files) {
            if (fs.statSync(inFolder + path.sep + file).isDirectory()) {
                await this.unisciFileTxt(inFolder + path.sep + file,outFolder,file + ".txt");
            }
        }
    }

    async unisciFileTxt(inFolder = this._settings.in_folder, outFolder = this._settings.out_folder,nomeFile = "") {
        let errors = [];
        let allFiles = common.getAllFilesRecursive(inFolder, this._settings.extensions);
        if (!fs.existsSync(outFolder)){
            fs.mkdirSync(outFolder, { recursive: true });
        }
        let lunghezzaRiga = common.verificaLunghezzaRiga(this._starts);
        const outputFile =nomeFile === "" ? (outFolder + path.sep + '190205_000_XXXX_XX_M_AL_20XX_XX_XX.TXT') : outFolder + path.sep + nomeFile;
        var logger = fs.createWriteStream(outputFile, {
            flags: 'a' // 'a' means appending (old data will be preserved)
        })
        var writeLine = (line) => logger.write(`${line}\n`);
        for (var file of allFiles) {
            const fileStream = fs.createReadStream(file);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            let nLine = 0;
            for await (const line of rl) {
                writeLine(line);
                // Each line in input.txt will be successively available here as `line`.
                nLine++;
                if (line.length !== lunghezzaRiga) {
                    console.log("file: " + file);
                    console.log('length: ' + line.length);
                    console.log('nLine: ' + nLine);
                    errors.push({file: file, lunghezza: line.length, linea: nLine})
                }
            }
        }
        logger.end();
        if (errors.length === 0) {
            //verifica
            console.log("verifica.. ");
            errors = [...errors, ...await this.#processLineByLine(outputFile, lunghezzaRiga)]
            if (errors.length === 0)
                console.log("verifica ok");
            else {
                console.log("ERRORI");
                console.table(errors);
            }
        }
        return {error: errors.length !== 0, errors: errors}
    }

    async inviaMailAiDistretti(distretti, meseAnno= "",mailGlobale= "",nomeFileCompleto = "CONSEGNE_GLOBALI") {
        let errors = []
        for (let idDistretto in distretti) {
            console.log(this._settings.datiStruttureRegione.recapitiDistretti[idDistretto] + distretti[idDistretto].toUpperCase());
            let out = await common.inviaMail(
                this._settings.impostazioniMail,
                [...this._settings.datiStruttureRegione.recapitiDistretti[idDistretto], "roberto.dedomenico@asp.messina.it"],
                "Risultato Elaborazione FLUSSO M distretto di " + distretti[idDistretto].toUpperCase() +" " + meseAnno,
                "Salve, per quanto di competenza e per le opportune verifiche,<br /> si invia in allegato il risultato dell'elaborazione delle consegne del FlussoM per il mese " + (meseAnno !=="" ? ("di " + meseAnno) : "corrente.") + " .<br />" +
                "<br /><br >" +
                    "Distinti Saluti.<br />" +
                    "<i><b>De Domenico Roberto</b><br />" +
                    "Referente Flusso M</i>" +
                "<br />",
                [this._settings.out_folder + path.sep + distretti[idDistretto].toUpperCase() +".xlsx",this._settings.out_folder + path.sep + distretti[idDistretto].toUpperCase() +".html"]
            );
            if (!out.error)
                console.log(out.messageId);
            else
                errors.push(out.errorTxt);
        }
        if (mailGlobale !== "")
        {
            let out = await common.inviaMail(
                this._settings.impostazioniMail,
                [mailGlobale, "roberto.dedomenico@asp.messina.it"],
                "Risultato Elaborazione FLUSSO M " + meseAnno,
                "Salve,<br /> si invia in allegato il risultato dell'elaborazione delle consegne del FlussoM per il mese " + (meseAnno !== "" ? ("di " + meseAnno) : "corrente.") + " .<br />" +
                "<br /><br >" +
                "Distinti Saluti.<br />" +
                "<i><b>De Domenico Roberto</b><br />" +
                "Referente Flusso M</i>" +
                "<br />",
                [this._settings.out_folder + path.sep + nomeFileCompleto +".xlsx"]
            );
            if (!out.error)
                console.log(out.messageId);
            else
                errors.push(out.errorTxt);
        }
        return {error: errors.length === 0, errors:errors};
    }

    async eseguiElaborazioneCompletaFlussoMDaCartella(scriviSuCartella, controllaSuTs, generaStats, bloccaConWarning=true, bloccaConDuplicati = false, controllaDuplicatiAnno = true, generaReportHtml = true, generaReportExcel=true) {
        let ris = await this.elaboraFlussi();
        let duplicati
        if (ris.errori.length === 0)
            duplicati = await this.trovaRicetteDuplicate(controllaDuplicatiAnno ? path.dirname(this._settings.in_folder) : this._settings.in_folder,false);
        if (ris.errori.length === 0 && (duplicati.numDuplicati === 0 || !bloccaConDuplicati) && (ris.warning.length == 0 || !bloccaConWarning)) {
            let strutturePerControlloTS = {};
            for (let value of Object.values(ris.ok))
                strutturePerControlloTS[value.codiceStruttura + "-" + (value.datiDaFile?.mese ?? value.mesePrevalente) + (value.datiDaFile?.anno ?? value.annoPrevalente)] =
                    {
                        mese: (value.datiDaFile?.mese ?? value.mesePrevalente),
                        anno: (value.datiDaFile?.anno ?? value.annoPrevalente),
                        codiceRegione: this._settings.codiceRegione,
                        codiceAsl: this._settings.codiceAzienda,
                        codiceStruttura: value.codiceStruttura
                    };
            let outTS = []
            if (controllaSuTs) {
                const verificaTS = new DatiStruttureProgettoTs(this._settings)
                outTS = await verificaTS.ottieniInformazioniStrutture(strutturePerControlloTS);
            }
            if (scriviSuCartella)
                await this.#scriviFlussoMSuCartella(ris.ok, outTS);
            if (generaStats) {
                await this.generaReportDaStats(generaReportHtml, generaReportExcel);
            }
            //controllo post
            console.log("Elaborazione completata, di seguito i warning trovati")
            console.table(this.verificaErroriDaStats(this._settings.out_folder))
            console.table(ris.warning)
            console.log("Duplicati: " + duplicati?.numDuplicati ?? "Controllo non effettuato");
            console.table(duplicati?.stats || "Controllo non effettuato");
            return true;
        } else if (ris.errori.length>0) {
            console.log("Interrotto. Errori rilevati")
            console.table(ris.errori);
            console.log("Warning rilevati")
            console.table(ris.warning);
            console.log("Duplicati: " + duplicati?.numDuplicati ?? "Controllo non effettuato");
            console.table(duplicati?.stats || "Controllo non effettuato");
            return false;
        }
        else {
            console.log("Warning rilevati")
            console.table(ris.warning);
            return false;
        }
    }

    verificaErroriDaStats (filePath) {
        let errors = [];
        let files = common.getAllFilesRecursive(filePath, '.mstats');

        for (let file of files) {
            let rawdata = fs.readFileSync(file);
            let dati = JSON.parse(rawdata);
            let key;
            try {
                key = dati.idDistretto + dati.codiceStruttura.substring(0, 4) + (!dati.hasOwnProperty("datiDaFile") ? (dati.datiDaFile.mese + dati.datiDaFile.anno.substring(0, 2)) : (dati.mesePrevalente + dati.annoPrevalente)) + "M";
            } catch (ex) {
                console.log(ex);
            }
            if (dati.hasOwnProperty("datiDaFile")) {
                let error = "";
                try {
                    if (dati.datiDaFile!== null) {
                        if (dati.datiDaFile?.idDistretto?.toString() !== dati.idDistretto.toString())
                            error = "idDistretto";
                        if ((dati.datiDaFile?.codStruttura + "00") !== dati.codiceStruttura)
                            error += " codStruttura";
                        if (dati.datiDaFile?.mese !== dati.mesePrevalente || dati.datiDaFile.anno !== dati.annoPrevalente)
                            error += " data"
                        if (error !== "")
                            errors.push({
                                error: true,
                                chiave: key,
                                tipoErrore: "Nome file differente dal contenuto",
                                dettagli: error.trim(),
                                mstatFile: file
                            })
                    }
                    else
                        errors.push({
                            error: true,
                            chiave: key,
                            tipoErrore: "datiDaFile non presente",
                            dettagli: "",
                            mstatFile: file
                        })
                } catch (ex) {
                    errors.push({
                        error: true,
                        chiave: key,
                        tipoErrore: "Altro errore",
                        dettagli: ex,
                        mstatFile: file
                    })
                }
            }
        }
        return errors;
    }

    async verificaCorrettezzaFileMInCartella(pathCartella) {
        let lunghezzaRiga = common.verificaLunghezzaRiga(this._starts);
        let errors = [];
        let allFiles = common.getAllFilesRecursive(pathCartella, this._settings.extensions);
        for (var file of allFiles) {
            console.log("processing " + file + "...");
            errors = [...errors, ...await this.#processLineByLine(file, lunghezzaRiga)]
        }
        console.log("FINE");
        console.log(errors);
    }

    async calcolaVolumiFlussoM(pathCartella = this._settings.out_folder, listaStrutture = [], listaPrestazioni = [], escludiStrutture=false, escludiPrestazioni = false) {

        const buffer = fs.readFileSync(this.settings.flowlookDBFilePath);
        const reader = new MDBReader(buffer);

        const branche = reader.getTable(this._settings.flowlookDBTableBranche).getData();
        //const prestazioni = reader.getTable(this._settings.flowlookDBTableNomenclatore).getData()
        const prestazioniBranche = reader.getTable(this._settings.flowLookDBCatalogoUnicoRegionalePrestazioneBranca).getData()
        const catalogoUnico = reader.getTable(this._settings.flowlookDBTableCatalogoUnicoRegionale).getData()
        const tabellaStrutture = reader.getTable(this._settings.flowlookDBTableSTS11).getData().filter( p => p["CodiceAzienda"] === this._settings.codiceAzienda)

        let prestazioniBrancheMap = {}
        let catalogoMap = {}
        let brancheMap = {}
        let tabellaStruttureMap = {}

        tabellaStrutture.forEach(s => tabellaStruttureMap[s["CodiceStruttura"]] = s["DenominazioneStruttura"]);

        branche.forEach(b => brancheMap[b["IdBranca"]] = b["Descrizione"]);

        prestazioniBranche.forEach(p=> {
            if (!prestazioniBrancheMap.hasOwnProperty(p['CodicePrestazione']))
                prestazioniBrancheMap[p['CodicePrestazione']] = []
            prestazioniBrancheMap[p['CodicePrestazione']].push(parseInt(p['CodiceBranca'].toString()));
            }
        )
        catalogoUnico.forEach(p=> {
            catalogoMap[p['CodicePrestazione']] = {descrizione: p['nuova descrizione integrata dal 01/06/2015'] ?? p['Descrizione Prestazione'], tariffa: parseFloat(p['Tariffa_TXT'].toString().replace(',','.')) }

            catalogoMap[p['CodicePrestazione']].branche = {toArray : [], toMap:[]}

            for (let i = 1;i<5; i++)
            {
                if (p['Branca ' + i.toString()] !== "" && p['Branca ' + i.toString()]) {
                    catalogoMap[p['CodicePrestazione']].branche.toArray.push(parseInt(p['Branca ' + i.toString()].toString()))
                    catalogoMap[p['CodicePrestazione']].branche.toMap.push({id: parseInt(p['Branca ' + i.toString()].toString()), descrizione:p['Descrizione Branca ' + i.toString()]})
                }
                else break;
            }

        })

        let risultato = {}
        let totale = 0;

        let allFiles = common.getAllFilesRecursive(pathCartella, this._settings.extensions);
        for (const file of allFiles) {
            console.log(file);
            totale+= await this.#iniziaElaborazione(file,risultato,listaStrutture,listaPrestazioni, escludiStrutture, escludiPrestazioni);
        }
        let problemi = this.#risolviProblemiPrestazioni(risultato);
        console.log("Risoluzione problemi prestazioni " + (!problemi.errore ? "OK" : "CON ERRORI"))
        if (problemi.errore) {
            console.log("Errori:")
            console.log(problemi.nonTrovati)
        }
        console.log("Ricette totali elaborate " + totale);

        const workbook = new ExcelJS.Workbook();
        let sheet1 = workbook.addWorksheet("VOLUMI TOTALI");
        let sheet2 = workbook.addWorksheet("VOLUMI per IDPREST");

        sheet1.columns = [
            {header: 'Progressivo', key: 'progressivo'},
            {header: 'Cod. Branca', key: 'idBranca'},
            {header: 'DescrizioneBranca', key: 'descrizioneBranca'},
            {header: 'CodStruttura', key: 'codStruttura'},
            {header: 'Den. Struttura', key: 'denomStruttura'},
            {header: 'CodPrestazione', key: 'codPrest'},
            {header: 'Descr. Prestazione', key: 'descPrest'},
            {header: '1°Accesso', key: 'primoAccesso'},
            {header: 'Altri Accessi', key: 'altriAccessi'},
            {header: 'Totale', key: 'totaleAccessi'}
        ];

        sheet2.columns = [
            {header: 'Cod. Branca', key: 'idBranca'},
            {header: 'DescrizioneBranca', key: 'descrizioneBranca'},
            {header: 'CodPrestazione', key: 'codPrest'},
            {header: 'Descr. Prestazione', key: 'descPrest'},
            {header: '1°Accesso', key: 'primoAccesso'},
            {header: 'Altri Accessi', key: 'altriAccessi'},
            {header: 'Totale', key: 'totaleAccessi'}
        ];

        let perPrestazione = {}
        for (let branca in risultato)
            if (branca !== "erroriBranche" && branca !== "erroriPrezzi") {
                for (let prest in risultato[branca])
                    for (let strutID in risultato[branca][prest]) {
                        if (!perPrestazione.hasOwnProperty(prest))
                            perPrestazione[prest] = {
                                primoAccesso: 0,
                                altriAccessi: 0,
                                totaleAccessi:0,
                                idBranca: parseInt(branca),
                                descrizioneBranca: brancheMap[branca],
                                descPrest: catalogoMap[prest].descrizione,
                                codPrest: prest,
                        }
                        perPrestazione[prest] = {
                            idBranca: perPrestazione[prest].idBranca,
                            descrizioneBranca: perPrestazione[prest].descrizioneBranca,
                            descPrest: perPrestazione[prest].descPrest,
                            codPrest: perPrestazione[prest].codPrest,
                            primoAccesso: perPrestazione[prest].primoAccesso + risultato[branca][prest][strutID].primiAccessi,
                            altriAccessi: perPrestazione[prest].altriAccessi + (risultato[branca][prest][strutID].count - risultato[branca][prest][strutID].primiAccessi),
                            totaleAccessi: perPrestazione[prest].totaleAccessi + risultato[branca][prest][strutID].count
                        }
                        sheet1.insertRow(2,
                            {
                                progressivo: "x",
                                idBranca: parseInt(branca),
                                descrizioneBranca: brancheMap[branca],
                                codStruttura: strutID,
                                denomStruttura: tabellaStruttureMap[strutID],
                                codPrest: prest,
                                descPrest: catalogoMap[prest].descrizione,
                                primoAccesso: risultato[branca][prest][strutID].primiAccessi,
                                altriAccessi: risultato[branca][prest][strutID].count - risultato[branca][prest][strutID].primiAccessi,
                                totaleAccessi: risultato[branca][prest][strutID].count
                            });
                    }
            }
        for (let prest in perPrestazione)
        {
            sheet2.insertRow(2,
                {
                    idBranca: perPrestazione[prest].idBranca,
                    descrizioneBranca: perPrestazione[prest].descrizioneBranca,
                    codPrest: perPrestazione[prest].codPrest,
                    descPrest: perPrestazione[prest].descPrest,
                    primoAccesso: perPrestazione[prest].primoAccesso,
                    altriAccessi: perPrestazione[prest].altriAccessi,
                    totaleAccessi: perPrestazione[prest].totaleAccessi,
                });

        }

        await workbook.xlsx.writeFile(this._settings.out_folder + path.sep + "VOLUMI.xlsx");
        console.log("File " + this._settings.out_folder + path.sep + "VOLUMI.xlsx salvato")

    }




    #includePrest (elencoPrestazioni, prest, invert = false) {
        for (let p of elencoPrestazioni)
            if (prest.startsWith(p) && !invert)
                return p;
            else if (p.startsWith(prest) && invert)
                return p;
        return false;
    }

    #contaPrestazioni (riga, outt, filterStrutt, filterPrest,escludiSt,escludiPrs) {
        for (const prestazione of riga.prestazioni) {
            if (
                ((filterPrest.length > 0 && this.#includePrest(filterPrest,prestazione.prestID) !== escludiPrs) || filterPrest.length === 0) &&
                ((filterStrutt.length >0 && filterStrutt.includes(prestazione.arseID)) !== escludiSt || filterStrutt.length ===0) &&
                ( prestazione.prestID !== "897" && prestazione.prestID !=="8901" )
            ) {

                if (!prestazioniBrancheMap[prestazione.prestID].includes(prestazione.brancaID)) {
                    if (!outt.hasOwnProperty("erroriBranche"))
                        outt.erroriBranche = []
                    outt.erroriBranche.push(prestazione)
                    prestazione.brancaID = prestazioniBrancheMap[prestazione.prestID];
                }
                if (parseFloat((catalogoMap[prestazione.prestID].tariffa * prestazione.quant).toFixed(2)) !== prestazione.totale)
                {
                    if (!outt.hasOwnProperty("erroriPrezzi"))
                        outt.erroriPrezzi = []
                    outt.erroriPrezzi.push({prezzoSegnato: riga.totale, prezzoCorretto: (catalogoMap[prestazione.prestID].tariffa * riga.quant)})
                }

                const isPrimoAccesso = riga.riga99.tipoAccesso === "1" ? prestazione.quant : 0;
                const isSecondoAccesso = riga.riga99.tipoAccesso === "0" ? prestazione.quant : 0;
                const erroreAccesso = riga.riga99.tipoAccesso === "" ? prestazione.quant : 0;

                if (!outt.hasOwnProperty(prestazione.brancaID))
                    outt[prestazione.brancaID] = {}
                if (!outt[prestazione.brancaID].hasOwnProperty(prestazione.prestID))
                    outt[prestazione.brancaID][prestazione.prestID] = {}
                if (outt[prestazione.brancaID][prestazione.prestID].hasOwnProperty(prestazione.arseID))
                    outt[prestazione.brancaID][prestazione.prestID][prestazione.arseID] = {
                        count: outt[prestazione.brancaID][prestazione.prestID][prestazione.arseID].count + 1,
                        primiAccessi: outt[prestazione.brancaID][prestazione.prestID][prestazione.arseID].primiAccessi + isPrimoAccesso,
                        altriAccessi: outt[prestazione.brancaID][prestazione.prestID][prestazione.arseID].altriAccessi + isSecondoAccesso,
                        erroriAccesso: outt[prestazione.brancaID][prestazione.prestID][prestazione.arseID].erroriAccesso + erroreAccesso
                    }
                else
                    outt[prestazione.brancaID][prestazione.prestID][prestazione.arseID] = {
                        count: prestazione.quant,
                        primiAccessi: isPrimoAccesso,
                        altriAccessi: isSecondoAccesso,
                        erroriAccesso: erroreAccesso
                    }
            }
            else if (prestazione.prestID === "897" || prestazione.prestID ==="8901")
            {
                prestazione.tipoAccesso = riga.riga99.tipoAccesso;
                if (!outt.hasOwnProperty("xxx"))
                    outt["xxx"] = {};
                if (!outt["xxx"].hasOwnProperty(prestazione.prestID))
                    outt["xxx"][prestazione.prestID] = []
                outt["xxx"][prestazione.prestID].push(prestazione);
            }
        }
    }



    async #iniziaElaborazione (filePath, out, struttureFilter, prestazioniFilter, escludiStr, escludiPrest) {
        const fileStream = fs.createReadStream(filePath);

        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        var i = 0;
        var ricettaTemp = [];
        for await (const line of rl) {
            var t =  common.mRowToJson(line, this._starts);
            ricettaTemp.push(t);

            if (t.progrRicetta === "99") {
                let rt = this.#buildRicetteFromMRows(ricettaTemp);
                this.#contaPrestazioni(rt, out,struttureFilter, prestazioniFilter,escludiStr,escludiPrest);
                ricettaTemp = [];
                i++;
            }
        }
        console.log("ricette elaborate nel file nel file:" + i);
        return i;
    };


    #risolviProblemiPrestazioni (risultato) {
        let keysPrest = []
        for (let key in risultato)
            for (let key2 in risultato[key])
                for (let key3 in risultato[key][key2])
                    keysPrest.push(key3 + "-" + key2 + "-" +key)
        let nonTrovati = [];
        for (let keyD of Object.values(risultato["xxx"]))
            for (let ricD of keyD) {
                let risP = this.#includePrest(keysPrest, ricD.arseID + "-" + ricD.prestID,true);
                if (risP) {
                    let vals = risP.split("-");
                    const isPrimoAccesso = ricD.tipoAccesso === "1" ? ricD.quant : 0;
                    const isSecondoAccesso = ricD.tipoAccesso === "0" ? ricD.quant : 0;
                    const erroreAccesso = ricD.tipoAccesso === "" ? ricD.quant : 0;
                    // 0-> id struttura, 1-> prest, 2 -> branca
                    risultato[vals[2]][vals[1]][vals[0]] = {
                        count: risultato[vals[2]][vals[1]][vals[0]].count + 1,
                        primiAccessi: risultato[vals[2]][vals[1]][vals[0]].primiAccessi + isPrimoAccesso,
                        altriAccessi: risultato[vals[2]][vals[1]][vals[0]].altriAccessi + isSecondoAccesso,
                        erroriAccesso: risultato[vals[2]][vals[1]][vals[0]].erroriAccesso + erroreAccesso
                    }
                }
                else nonTrovati.push(ricD)
            }
        delete risultato["xxx"];
        if (nonTrovati.length === 0) {
            return {errore: false}
        }
        else
            return {errore: true, nonTrovati: nonTrovati}
    }


    async generaFileExcelPerAnno(nomeFile, anno, cosaGenerare = [FlussoM.PER_STRUTTURA_ANNO_MESE, FlussoM.TAB_CONSEGNE_PER_CONTENUTO, FlussoM.TAB_CONSEGNE_PER_NOME_FILE, FlussoM.TAB_DIFFERENZE_CONTENUTO_NOMEFILE] ) {
        const strutture = this.#loadStruttureFromFlowlookDB();
        let files = common.getAllFilesRecursive(this._settings.out_folder, '.mstats');
        let data = [];
        for (let file of files) {
            let rawdata = fs.readFileSync(file);
            let dati = JSON.parse(rawdata);
            data.push(dati)
        }

        const workbook = new ExcelJS.Workbook();
        let sheets = [];
        for (let sheet of cosaGenerare) {
            sheets[sheet] = workbook.addWorksheet(sheet);
            if (sheet === FlussoM.PER_STRUTTURA_ANNO_MESE ||
                sheet === FlussoM.TAB_CONSEGNE_PER_NOME_FILE ||
                sheet === FlussoM.TAB_CONSEGNE_PER_CONTENUTO ||
                sheet === FlussoM.TAB_DIFFERENZE_CONTENUTO_NOMEFILE
            )
                sheets[sheet].columns = [
                    {header: 'Id', key: 'id'},
                    {header: 'Distretto', key: 'distretto'},
                    {header: 'Descrizione', key: 'descrizione'},
                    {header: 'Gennaio', key: '01'},
                    {header: 'Febbraio', key: '02'},
                    {header: 'Marzo', key: '03'},
                    {header: 'Aprile', key: '04'},
                    {header: 'Maggio', key: '05'},
                    {header: 'Giugno', key: '06'},
                    {header: 'Luglio', key: '07'},
                    {header: 'Agosto', key: '08'},
                    {header: 'Settembre', key: '09'},
                    {header: 'Ottobre', key: '10'},
                    {header: 'Novembre', key: '11'},
                    {header: 'Dicembre', key: '12'}
                ];
        }

        //const cell = worksheet.getCell('C3');
        //cell.value = new Date(1968, 5, 1);

        let error = [];
        let outData = {}
        for (let file of data) {
            let anno = file.annoPrevalente ?? file.datiDaFile?.anno;
            let mese = file.mesePrevalente ?? file.datiDaFile?.mese;
            if (anno === null || mese == null)
                error.push({tipo: "Mese anno non validi", file: file});
            else {
                for (let tab of cosaGenerare) {
                    anno = tab === FlussoM.TAB_CONSEGNE_PER_NOME_FILE ? (file.datiDaFile?.anno ?? anno) : anno;
                    mese = tab === FlussoM.TAB_CONSEGNE_PER_NOME_FILE ? (file.datiDaFile?.mese ?? mese) : mese;
                    if (!outData.hasOwnProperty(tab)) outData[tab] = {}
                    switch (tab) {
                        case FlussoM.PER_STRUTTURA_ANNO_MESE:
                        case FlussoM.TAB_CONSEGNE_PER_NOME_FILE:
                        case FlussoM.TAB_CONSEGNE_PER_CONTENUTO:
                        case FlussoM.TAB_DIFFERENZE_CONTENUTO_NOMEFILE:
                            if (anno === anno.toString()) {
                                if (!outData[tab].hasOwnProperty(file.codiceStruttura))
                                    outData[tab][file.codiceStruttura] = {
                                        id: file.codiceStruttura,
                                        descrizione: strutture[file.codiceStruttura].denominazione,
                                        distretto: this.settings.datiStruttureRegione.distretti[file.idDistretto]
                                    }
                                if (!outData[tab][file.codiceStruttura].hasOwnProperty(mese)) {
                                    if (tab === FlussoM.PER_STRUTTURA_ANNO_MESE)
                                        outData[tab][file.codiceStruttura][mese] = file.totaleNetto;
                                    else if (tab === FlussoM.TAB_CONSEGNE_PER_NOME_FILE)
                                        outData[tab][file.codiceStruttura][mese] = file.datiDaFile.idDistretto+ file.datiDaFile.codStruttura + file.datiDaFile.mese + file.datiDaFile.anno;
                                    else if (tab === FlussoM.TAB_CONSEGNE_PER_CONTENUTO)
                                        outData[tab][file.codiceStruttura][mese] = file.datiDaFile.idDistretto+ file.datiDaFile.codStruttura + mese + anno;
                                    else if (tab === FlussoM.TAB_DIFFERENZE_CONTENUTO_NOMEFILE)
                                        outData[tab][file.codiceStruttura][mese] = (file.datiDaFile?.mese === file.mesePrevalente) && (file.datiDaFile?.anno === file.annoPrevalente) ? "OK": "*NO*"
                                } else {
                                    if (FlussoM.PER_STRUTTURA_ANNO_MESE)
                                        error.push({tipo: "File Duplicato nel mese", file: file});
                                    else if (FlussoM.TAB_CONSEGNE_PER_NOME_FILE)
                                        outData[tab][file.codiceStruttura][mese]+= " - " + file.datiDaFile.idDistretto+ file.datiDaFile.codStruttura + file.datiDaFile.mese + file.datiDaFile.anno;
                                    else if (tab === FlussoM.TAB_CONSEGNE_PER_CONTENUTO)
                                        outData[tab][file.codiceStruttura][mese]+= " - " + file.datiDaFile.idDistretto+ file.datiDaFile.codStruttura + mese + anno;
                                    else if (tab === FlussoM.TAB_DIFFERENZE_CONTENUTO_NOMEFILE)
                                        outData[tab][file.codiceStruttura][mese]+= " - " + (file.datiDaFile?.mese === file.mesePrevalente) && (file.datiDaFile?.anno === file.annoPrevalente) ? "OK": "*NO*"
                                }
                            } else if (!anno)
                                error.push({tipo: "Anno non elaborato", file: file});
                            break;

                    }
                }
            }
        }
        for (let tab of cosaGenerare) {
            for (let dato in outData[tab]) {
                sheets[tab].insertRow(2, outData[tab][dato]);
            }
        }

        await workbook.xlsx.writeFile(this._settings.out_folder + path.sep + nomeFile);
        console.log(error)
    }


    async generaReportPrestazioni(anno,strutture = []) {
        //let strutture = this.#loadStruttureFromFlowlookDB();
        let files = common.getAllFilesRecursive(this._settings.out_folder, '.mstats');
        let tabs = {
            1: '1 - Gennaio', 2: '2 - Febbraio', 3: '3 - Marzo', 4: '4 - Aprile', 5: '5 - Maggio', 6:'6 - Giugno',
            7: '7 - Luglio', 8: '8 - Agosto', 9: '9 - Settembre', 10: '10 - Ottobre', 11: '11 - Novembre', 12: '12 - Dicembre'
        }
        let data = [];
        for (let file of files) {
            let rawdata = fs.readFileSync(file);
            let dati = JSON.parse(rawdata);
            data.push(dati)
        }

        const workbook = new ExcelJS.Workbook();
        let sheets = [];

        for (let sheet of Object.values(tabs)) {
            sheets[sheet] = workbook.addWorksheet(sheet);
                sheets[sheet].columns = [
                    {header: 'Id Struttura', key: 'id'},
                    {header: 'Prestazione', key: 'idPrest'},
                    {header: 'Branca', key: 'idBranca'},
                    {header: 'totale', key: 'totalePrest'},
                    {header: 'importo', key: 'importo'},
                ];
        }

        //const cell = worksheet.getCell('C3');
        //cell.value = new Date(1968, 5, 1);

        let error = [];
        let outData = {}
        let prestazioniMap = {}
        for (let file of data) {
            if (prestazioniMap.hasOwnProperty(file.codiceStruttura))
                prestazioniMap[file.codiceStruttura] ={}
            const validKeys = Object.keys(file.prestazioni).filter(k => k.startsWith(anno.toString()));
            for (let key of validKeys)
            {
                const prestMese = null;
                // da continuare
            }
            console.log(file);
        }


        for (let tab of Object.values(tabs)) {
            for (let dato in outData[tab]) {
                sheets[tab].insertRow(2, outData[tab][dato]);
            }
        }

        await workbook.xlsx.writeFile(this._settings.out_folder + path.sep + nomeFile);
        console.log(error)
    }

}
