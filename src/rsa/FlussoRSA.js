import moment from 'moment';
import path  from 'path';
import readline from 'readline';
import md5File from 'md5-file';
import fs from 'fs';
import {common} from "../common.js";
import _ from 'lodash';

export class FlussoRSA {
    /**
     * @param {ImpostazioniFlussoRSA} settings - Settings
     */
    constructor(settings, starts = this._startsFlussoRSAv1) {
        this._settings = settings;
        this._starts = starts
    }

    static  tipoStrutturaProvenienza = {
        1: "Abitazione",
        2: "Struttura Protetta socio-sanitaria",
        3: "Struttura Sociale",
        4: "Struttura Ospedaliera",
        5: "Struttura di Riabilitazione",
        6: "Altra Struttura della stessa ASL chiusa amministrativamente",
        7: "Apertura amministrativa per riassetto territoriale ASL",
        9: "Altro"
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


    _startsFlussoRSAv1 = {
        regione: {id: 1, length: 3, type: "string", required: true},
        asID: {id: 2, length: 3, type: "string", required: true}, // codice azienda sanitaria
        arseID: {id: 3, length: 6, type: "string", required: true}, // codice regionale struttura erogatrice STS11
        tipoStruttura : {id: 4, length: 1, type: "int", required: true},
        tipoAssist : {id: 5, length: 1, type: "int", required: true},
        anno : {id: 6, length: 4, type: "int", required: true},
        numeroScheda : {id: 7, length: 6, type: "string", required: true},
        meseCompetenza : {id: 8, length: 2, type: "int", required: true},
        cognome: {id: 9, length: 30, type: "string", required: false}, // cognome assistito
        nome: {id: 10, length: 20, type: "string", required: false}, // nome assistito
        cf: {id: 11, length: 16, type: "string", required: true}, // codice fiscale
        sesso: {id: 12, length: 1, type: "string", required: false}, // sesso utente
        dataNascita: {id: 13, length: 8, type: "date", required: false}, // data Nascita Utente
        comRes: {id: 14, length: 6, type: "string", required: true}, // comune di residenza utente
        aspRes: {id: 15, length: 3, type: "string", required: true}, // Azienda Sanitaria provinciale di residenza
        cittadinanza : {id: 16, length: 3, type: "string", required: true},
        provenienzaAssistito: {id: 17, length: 1, type: "int", required: true},
        dataIngresso: {id: 18, length: 8, type: "date", required: true},
        regime : {id: 19, length: 1, type: "int", required: true},
        giornateAssistenza: {id: 20, length: 3, type: "int", required: true},
        diagnosiPrincipale : {id: 21, length: 5, type: "string", required: true},
        numeroAutorizzazione : {id: 22, length: 6, type: "string", required: true},
        dataAutorizzazione : {id: 23, length: 8, type: "date", required: true},
        modalitaDimissione : {id: 24, length: 1, type: "int", required: false},
        dataDimissione : {id: 25, length: 8, type: "date", required: true},
        tariffaRSA: {id: 26, length: 6, type: "double", required: true},
        tariffaACaricoUtente: {id: 27, length: 6, type: "double", required: true},
        quotaRiscossa: {id: 28, length: 8, type: "double", required: true},
    };


    async calcolaDatiPerRelazione(fromDate,filePath =this._settings.in_folder,){
        fromDate = moment(fromDate, "DDMMYYYY");
        let files = common.getAllFilesRecursive(filePath, ".txt", "RSA")
        var i = 0;
        let rows = []
        let ricoverati = [];
        let totaleRicoveri={totale: 0,uomini: 0, donne: 0};
        let provenienzaRicoverati = {}
        let etaRicoverati ={ tutti: {},maggiori90: 0,tra80e90: 0, minori80:0}
        let giorniDegenza = {totale: 0, perAssistito:{}};
        let assistitiSpese = {} // {cf: "XXXXXX",spesa:x,....}
        let lunghezzaRiga = common.verificaLunghezzaRiga(this._starts);
        let error = null;
        for (let file of files) {
            console.log("Elaboro " + file + " ...");
            const fileStream = fs.createReadStream(file);

            const rl = readline.createInterface({input: fileStream, crlfDelay: Infinity});
            for await (const line of rl) {
                if (line.length !== lunghezzaRiga) {
                    error = i;
                    break;
                } else {
                    var t = common.mRowToJson(line, this._starts);
                    rows.push(t);
                    let sesso = t.sesso === "2" ? "F" : "M"
                    let eta =  new Date().getFullYear() - t.dataNascita.get('year');
                    if (!provenienzaRicoverati.hasOwnProperty(t.provenienzaAssistito))
                        provenienzaRicoverati[t.provenienzaAssistito] = 1;
                    else
                        provenienzaRicoverati[t.provenienzaAssistito] = provenienzaRicoverati[t.provenienzaAssistito] +1;
                    if (!ricoverati.hasOwnProperty(t.cf + "_" + t.dataIngresso.format("DD/MM/yyyy"))) {
                        ricoverati.push(t.cf + "_" + t.dataIngresso.format("DD/MM/yyyy"));
                        totaleRicoveri = {totale: totaleRicoveri.totale +1,uomini: sesso === "M" ? totaleRicoveri.uomini +1 : totaleRicoveri.uomini,donne: sesso === "F" ? totaleRicoveri.donne +1 : totaleRicoveri.donne }
                        if (!etaRicoverati.tutti.hasOwnProperty(eta))
                            etaRicoverati.tutti[eta] = 1;
                        else
                            etaRicoverati.tutti[eta] = etaRicoverati.tutti[eta] +1
                        if (eta<80)
                            etaRicoverati.minori80 = etaRicoverati.minori80 +1;
                        else if (eta>90)
                            etaRicoverati.maggiori90 = etaRicoverati.maggiori90 +1;
                        else
                            etaRicoverati.tra80e90 = etaRicoverati.tra80e90 +1;
                    }
                    if (!isNaN(t.dataDimissione) && t.dataDimissione !== "") {
                        let dateToTest = t.dataIngresso.isSameOrBefore(fromDate) ? fromDate : t.dataIngresso
                        giorniDegenza.totale = giorniDegenza.totale + t.dataDimissione.diff(dateToTest,'days')
                        if (giorniDegenza.perAssistito.hasOwnProperty(t.cf))
                            giorniDegenza.perAssistito[t.cf] = giorniDegenza.perAssistito[t.cf] + t.dataDimissione.diff(dateToTest,'days')
                        else
                            giorniDegenza.perAssistito[t.cf] = t.dataDimissione.diff(dateToTest,'days')
                    }
                }
            }
            i++;
        }
        const addString = (accumulator, a) => {
            return accumulator + parseInt(a);
        }

        totaleRicoveri['percUomini'] =  (totaleRicoveri.uomini * 100) /totaleRicoveri.totale;
        totaleRicoveri['percDonne'] =  (totaleRicoveri.donne * 100) /totaleRicoveri.totale;
        let etaMedia = 0;
        Object.keys(etaRicoverati.tutti).forEach( key => {etaMedia+= etaRicoverati.tutti[key] * key})
        etaMedia = etaMedia / Object.values(etaRicoverati.tutti).reduce(addString,0);
        let degenzaMedia =  Object.values(giorniDegenza.perAssistito).reduce(addString,0) / Object.values(giorniDegenza.perAssistito).length;
        return {
             'giorniDegenzaTotali': giorniDegenza.totale,
            'totaleRicoveri': totaleRicoveri,
            'provenienzaRicoverati': provenienzaRicoverati,
            'etaRicoverati': etaRicoverati,
            'etaMedia': etaMedia,
            'degenzaMedia': degenzaMedia
        };
    }

    async #elaboraFileFlussoRSA(filePath) {
        console.log("Elaboro " + filePath + " ...");
        const fileStream = fs.createReadStream(filePath);

        const rl = readline.createInterface({input: fileStream, crlfDelay: Infinity});
        var i = 0;
        let rows = []
        let dimissioni = {};
        let pazienti = {};
        let lunghezzaRiga = common.verificaLunghezzaRiga(this._starts);
        let error = null;
        for await (const line of rl) {
            if (line.length !== lunghezzaRiga) {
                error = i;
                break;
            } else {
                var t = common.mRowToJson(line, this._starts);
                rows.push(t);
                if (!isNaN(t.dataDimissione)) {
                    if (!dimissioni.hasOwnProperty(t.cf)) {
                        dimissioni[t.cf] = 1;
                    } else
                        dimissioni[t.cf] = dimissioni[t.cf] + 1;
                }
                if (!pazienti.hasOwnProperty(t.cf))
                    pazienti[t.cf] = [t];
                else
                    pazienti[t.cf].push(t);
                i++;
            }
        }
        if (error === null) {
            return {
                nomeFile: path.basename(filePath),
                datiDaFile: rows,
                absolutePath: filePath,
                hash: md5File.sync(filePath),
                numeroDimissioni: Object.keys(dimissioni).length,
                dimissioni: dimissioni,
                numeroPazienti:  Object.keys(pazienti).length,
                pazienti: pazienti,
                numeroRighe: i,
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



    async elaboraDegenti() {
        let files = common.getAllFilesRecursive(this._settings.in_folder, ".txt", "RSA")
        console.log(files.length)
        for (let file of files) {
            let out = await this.#elaboraFileFlussoRSA(file)
            console.log(out);
        }
    }


}
