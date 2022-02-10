import moment from 'moment';
import path  from 'path';
import readline from 'readline';
import md5File from 'md5-file';
import fs from 'fs';
import {common} from "./common.js";
import _ from 'lodash';
import reader from "xlsx";
import MDBReader from "mdb-reader";
import {progettoTSFlussoM} from "./ottieniDatiStruttureProgettoTs.js";
import {settings} from "./config/config.js";
import { Grid } from "gridjs";

const DENOMINAZIONE_COL = "Denominazione";
const CODICE_STRUTTURA_COL = "Sts11"
const DISTRETTO_COL = "Distretto"


const _startsFlussoMV10082012 = {
    regione: {id:1, lenght:3,type: "string", required: true},
    asID: {id:2, lenght:3, type: "string", required: true}, // codice azienda sanitaria
    arseID: {id:3, lenght:6, type: "string", required: true}, // codice regionale struttura erogatrice STS11
    brancaID: {id:4, lenght:2, type: "string", required: true}, // codice branca STS21
    mpID: {id:5, lenght:16, type: "string", required: true}, // codice medico prescrittore
    cognome: {id:6, lenght:30, type: "string", required: false}, // cognome utente
    nome: {id:7, lenght:20, type: "string", required: false}, // nome utente
    cf: {id:8, lenght:16, type: "string", required: true}, // codice fiscale
    sesso: {id:9, lenght:1, type: "string", required: false}, // sesso utente
    dataNascita: {id:10, lenght:8, type: "date", required: false}, // data Nascita Utente
    comRes: {id:11, lenght:6, type: "string", required: true}, // comune di residenza utente
    aspRes: {id:12, lenght:3, type: "string", required: true}, // Azienda Sanitaria provinciale di residenza
    dataPren: {id:13, lenght:8, type: "date", required: true}, // Data di Prenotazione, solo su riga 99
    ricettaID: {id:14, lenght:16, type: "string", required: true}, // Numero ricetta
    progrRicetta: {id:15, lenght:2, type: "string", required: true}, // Progressivo riga per ricetta
    diagnosi: {id:16, lenght:5, type: "string", required: false}, // codifica ICD9CM
    dataErog: {id:17, lenght:8, type: "date", required: true}, // Data erogazione, in caso di ciclo si riporta chisura ciclo
    nomID: {id:18, lenght:1, type: "string", required: true}, // codifica nomenclatore
    prestID: {id:19, lenght:7, type: "string", required: true}, // codice prestazione secondo nomenclatore
    quant: {id:20, lenght:3, type: "string", required: true}, // quantità
    ticket: {id:21, lenght:2, type: "string", required: true}, // posizione utente nei confronti del ticket
    esenzione: {id:22, lenght:6, type: "string", required: true}, // codice esenzione
    importoTicket: {id:23, lenght:7, type: "string", required: true}, // importo ticket
    totale: {id:24, lenght:8, type: "string", required: true}, // importo totale
    posContabile: {id:25, lenght:1, type: "string", required: true}, // posizione contabile
    recordID: {id:26, lenght:20, type: "string", required: true}, // identificativo Record
    CRIL: {id:27, lenght:8, type: "string", required: true}, // centro di rilevazione regionale CRIL
    op: {id:28, lenght:1, type: "string", required: true}, // onere prestazione
    tipoAccesso: {id:29, lenght:1, type: "string", required: true}, // tipo accesso, se è primo accesso o meno 0->altro 1-> primo accesso
    tempoMax: {id:30, lenght:1, type: "string", required: true}, // garanzia tempi massimi
    classePrior: {id:31, lenght:1, type: "string", required: true}, // Classe priorità
    vuoto: {id:32, lenght:2, type: "string", required: false}, // campo vuoto
};

const _mRowToJson = (row,starts ) => {
    var obj = {}
    let from = 0;
    for (let key in starts)
    {
        obj[key] = row.substr(from, starts[key].lenght).trim();
        if (starts[key].type === "date") {
            if (moment(obj[key], "DDMMYYYY").isValid())
                obj[key] = moment(obj[key], "DDMMYYYY");
        }
        from+= starts[key].lenght;
    }
    return obj;
};

const _buildRicetteFromMRows = (rows) =>
{
    let ricetta = {}
    let riga99 = rows.filter((p) => p.progrRicetta === "99")[0];
    let prestazioni = rows.filter((p) => p.progrRicetta !== "99");
    var totPrestazioniCalcolate = prestazioni.reduce(function(tot, arr) {
        // return the sum with previous value
        return tot +  parseFloat(arr.totale.replace(',','.'));
        // set initial value as 0
    },0);

    if (riga99 != null)
    {
        ricetta.id = riga99.ricettaID;
        ricetta.dataPren = moment(riga99.dataPren, "MM-DD-YYYY");
        ricetta.prestazioni = prestazioni;
        ricetta.codiceStruttura = riga99.arseID;
        ricetta.cf = riga99.cf;
        ricetta.riga99 = riga99;
        ricetta.numPrestazioni = rows.length -1;
        ricetta.totale = parseFloat(riga99.totale.replace(',','.'));
        ricetta.totaleTicket = parseFloat(riga99.importoTicket.replace(',','.'));
        ricetta.totaleCorretto = parseFloat(totPrestazioniCalcolate.toFixed(2)) - ricetta.totale - ricetta.totaleTicket;
        ricetta.totalePrestazioniCalcolate = parseFloat(totPrestazioniCalcolate.toFixed(2));
        return ricetta;
    }
    else
    {
        return null;
    }

};

const _creaMappaStruttureFromFileExcel = (pathFileStrutture, distretti) =>
{
    let mappaStrutture = {}
    const file = reader.readFile(pathFileStrutture);

    let data = [];

    const sheets = file.SheetNames;
    for (let i = 0; i < sheets.length; i++) {
        const temp = reader.utils.sheet_to_json(
            file.Sheets[file.SheetNames[i]]);
        temp.forEach((res) => {
            data.push(res);
        });
    }

    for (let i = 0; i < data.length; i++) {
        mappaStrutture[data[i][CODICE_STRUTTURA_COL]] = {denominazione: data[i][DENOMINAZIONE_COL].trim(), distretto: data[i][DISTRETTO_COL], idDistretto:distretti[data[i][DISTRETTO_COL]]}
    }
    return mappaStrutture
}

const _checkMeseAnnoStruttura = (ricette)  => {
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
            try
            {
                key99 = (ricetta.riga99.dataErog.month() + 1).toString() + ricetta.riga99.dataErog.year().toString()
                if (key99.length === 5) key99 = "0" + key99;
                if (ricetta.riga99.posContabile === "2" || ricetta.riga99.posContabile === "3") {
                    if (!dateFuoriPeriodoDiCompetenza.hasOwnProperty(key99))
                        dateFuoriPeriodoDiCompetenza[key99] = 1
                    else
                        dateFuoriPeriodoDiCompetenza[key99] = dateFuoriPeriodoDiCompetenza[key99] + 1;
                }
                else { // se non c'è lo consideriamo nel periodo di competenza
                    if (key99 !== "122021")
                        console.log("bau");
                    if (!dateRiga99.hasOwnProperty(key99))
                        dateRiga99[key99] = 1
                    else
                        dateRiga99[key99] = dateRiga99[key99] + 1;
                }
                //controllo codice struttura
                if (codiceStruttura !== "error")
                    if (codiceStruttura !== ricetta.riga99.arseID)
                        codiceStruttura = "error";
            }
            catch (ex) {
                dateMancanti99.push(ricetta.riga99);
            }
        }
        else
            dateMancanti99.push(ricetta.riga99);
        for (let prestazione of ricetta.prestazioni)
        {
            if (prestazione.dataErog) {
                try {
                    let key = (prestazione.dataErog.month() + 1).toString() + prestazione.dataErog.year().toString()
                    if (key.length === 5) key = "0" + key;
                    if (prestazione.posContabile === "2" || prestazione.posContabile === "3") {
                        if (!dateFuoriPeriodoDiCompetenza.hasOwnProperty(key))
                            dateFuoriPeriodoDiCompetenza[key] = 1
                        else
                            dateFuoriPeriodoDiCompetenza[key] = dateFuoriPeriodoDiCompetenza[key] + 1;
                    }
                    else { // se non c'è lo consideriamo nel periodo di competenza
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
                }
                catch (ex) { datePrestazioniMancanti.push(prestazione); }
            }
        }
    }
    let out = {date: [], risultato: {}}
    let totale = 0
    for(let key99 of Object.keys(dateRiga99))
    {
        if (out.date.hasOwnProperty(key99))
            out.date[key99].count = out.date[key99].count + dateRiga99[key99];
        else
            out.date[key99] = {count: dateRiga99[key99] }
        totale += dateRiga99[key99];
    }
    for(let key of Object.keys(datePrestazioni))
    {
        if (out.date.hasOwnProperty(key))
            out.date[key].count = out.date[key].count + datePrestazioni[key];
        else
            out.date[key] = {count: datePrestazioni[key]}
        totale += datePrestazioni[key];
    }
    for(let keyFuori of Object.keys(dateFuoriPeriodoDiCompetenza))
    {
        if (out.date.hasOwnProperty(keyFuori))
            out.date[keyFuori].count = out.date[keyFuori].count + dateFuoriPeriodoDiCompetenza[keyFuori];
        else
            out.date[keyFuori] = {count: dateFuoriPeriodoDiCompetenza[keyFuori]}
        totale += dateFuoriPeriodoDiCompetenza[keyFuori];
    }
    let chiaveDataPrevalente = null
    for(let key of Object.keys(out.date))
    {
        if (chiaveDataPrevalente === null)
            chiaveDataPrevalente = key;
        out.date[key].percentuale = ((out.date[key].count *100) / totale).toFixed(2);
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


const _processLineByLine = async (filePath, lunghezzaRiga) => {
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

const _verificaLunghezzaRiga = (starts) =>
{
    let lunghezza = 0;
    for (let val of Object.values(starts))
        lunghezza+= val.lenght;
    return lunghezza;
}


const _elaboraFileFlussoM = async (filePath, starts) => {
    console.log("Elaboro " + filePath+ " ...");
    const fileStream = fs.createReadStream(filePath);

    const rl = readline.createInterface({input: fileStream, crlfDelay: Infinity });
    var i = 0;
    var ricette = {};
    var ricettaTemp = [];
    let totale = {
        totale:0,
        ticket:0,
        totalePrestazioni:0,
        totalePrestazioniCalcolate: 0
    }
    let lunghezzaRiga = _verificaLunghezzaRiga(starts);
    let error = null;
    for await (const line of rl) {
        if (line.length !== lunghezzaRiga) {
            error = i;
            break;
        }
        else {
            var t = _mRowToJson(line, starts);
            ricettaTemp.push(t);
            if (t.progrRicetta === "99") {
                var rt = _buildRicetteFromMRows(ricettaTemp);
                //TODO: filtro?
                ricette[rt.id] = rt;
                totale.totalePrestazioniCalcolate = totale.totalePrestazioniCalcolate + rt.totalePrestazioniCalcolate;
                totale.totalePrestazioni = totale.totalePrestazioni + rt.numPrestazioni;
                totale.totale = totale.totale + rt.totale;
                totale.ticket = totale.ticket + rt.totaleTicket;
                ricettaTemp = [];
            }
            i++;
        }
    }
    if (error === null) {
        let totaleNetto = parseFloat(totale.totale.toFixed(2));
        let totaleTicket = parseFloat(totale.ticket.toFixed(2));
        let datiDaFile = _controllaNomeFileFlussoM(path.basename(filePath));
        return {
            nomeFile: path.basename(filePath),
            datiDaFile: datiDaFile,
            absolutePath: filePath,
            hash: md5File.sync(filePath),
            totaleNetto: totaleNetto,
            totaleLordo: parseFloat((totaleNetto + totaleTicket).toFixed(2)),
            totaleTicket: totaleTicket,
            totalePrestazioni: totale.totalePrestazioni,
            totaleLordoPrestazioniCalcolate: parseFloat(totale.totalePrestazioniCalcolate.toFixed(2)),
            numeroRighe: i,
            numeroRicette: Object.values(ricette).length,
            ricette: ricette,
            nonOk: Object.values(ricette).filter((p) => p.totaleCorretto !== 0)
        }
    }
    else
        return {
            error: true,
            rowError: i,
            nomeFile: path.basename(filePath),
            absolutePath: filePath,
            hash: md5File.sync(filePath)
        }
};

const _controllaNomeFileFlussoM = (nome) =>{
    try {
        if (nome.length !== 14 || nome.toLowerCase().substring(nome.length - 5, nome.length) !== "m.txt")
            return null;
        return {
            idDistretto: nome.substring(0, 1),
            codStruttura: nome.substring(1, 5),
            mese: nome.substring(5, 7),
            anno: "20" + nome.substring(7, 9),
        }
    } catch (ex) { return null;}
}


const loadStruttureFromFlowlookDB = (pathFileFlowLookDB, tabellaStrutture, codiceRegione, codiceAzienda) =>
{
    const buffer = fs.readFileSync(pathFileFlowLookDB);
    const reader = new MDBReader(buffer);

    const strutture = reader.getTable(tabellaStrutture).getData();
    let struttureFiltrate = strutture.filter(p=> p["CodiceAzienda"] === codiceAzienda && p["CodiceRegione"] === codiceRegione);
    let mancanti = []
    let struttureOut = {}
    struttureFiltrate.forEach(p=>
    {
        if (settings.comuniDistretti.hasOwnProperty(p["CodiceComune"])) {
            struttureOut[p['CodiceStruttura']] = {
                codiceRegione: p['CodiceRegione'],
                codiceAzienda: p['CodiceAzienda'],
                denominazione: p['DenominazioneStruttura'],
                codiceComune: p['CodiceComune'],
                idDistretto: settings.comuniDistretti[p["CodiceComune"]],
                dataUltimoAggiornamento: moment(p['DataAggiornamento'], 'DD/MM/YYYY')
            };
        }
        else
            mancanti.push(p);
    })
    return struttureOut;
}

const elaboraFlussi = async (pathCartella,strutture, starts=_startsFlussoMV10082012) => {

    let fileOut = {ripetuti: [], ok:{}, errori:[]}
    //1- ottieni tutti i file txt della cartella
    let allFiles = common.getAllFilesRecursive(pathCartella,settings.extensions);
    let numFiles = allFiles.length;
    var progress = 0;
    // 2- elaborazione
    for(var file of allFiles) {
        let md5 = md5File.sync(file);
        if (!fileOut.ok.hasOwnProperty(md5)) {
            let ricetta = await _ottieniStatDaFileFlussoM(file,strutture)
            if (!ricetta.errore)
                fileOut.ok[ricetta.out.hash] = _.omit(ricetta.out, ["ricette", "nonOk"])
            else
                fileOut.errori.push(ricetta.out)
            console.log("elaborazione: " + ++progress + " di " + numFiles)
        }
        else {
            console.log("elaborazione: " + ++progress + " di " + numFiles + "\n File già presente")
            fileOut.ripetuti.push([fileOut.ok[md5].absolutePath,pathCartella + path.sep + file]);
        }
    }
    return fileOut;
}

const _ottieniStatDaFileFlussoM = async (file, strutture, starts=_startsFlussoMV10082012) => {
    let ricetteInFile = await _elaboraFileFlussoM(file,starts);
    if (ricetteInFile.error)
    {
        console.log("file " + file + " con errori");
        return { errore: true, out: ricetteInFile};
    }
    else {
        let verificaDateStruttura = _checkMeseAnnoStruttura(Object.values(ricetteInFile.ricette))
        ricetteInFile.codiceStruttura = verificaDateStruttura.codiceStruttura;
        ricetteInFile.idDistretto = strutture[verificaDateStruttura.codiceStruttura].idDistretto;
        ricetteInFile.annoPrevalente = verificaDateStruttura.meseAnnoPrevalente.substr(2, 4);
        ricetteInFile.mesePrevalente = verificaDateStruttura.meseAnnoPrevalente.substr(0, 2);
        ricetteInFile.date = _.omitBy(verificaDateStruttura.date, _.isNil);
        return {errore: false, out: ricetteInFile}
    }
}

const verificaCorrettezzaFileMInCartella = async (pathCartella, starts=_startsFlussoMV10082012) => {
    let lunghezzaRiga = _verificaLunghezzaRiga(starts);
    let errors = [];
    let allFiles = common.getAllFilesRecursive(pathCartella, settings.extensions);
    for (var file of allFiles) {
        console.log("processing " + file + "...");
        errors = [...errors, ...await _processLineByLine(file, lunghezzaRiga)]
    }
    console.log("FINE");
    console.log(errors);
}

const _calcolaDifferenzeDaTs = (dati) => {
    if (dati.hasOwnProperty("controlloTs") && dati.controlloTs.error === false)
    {
        return {
            differenzaTotaleNetto: (dati.controlloTs.out.netto_mese_totale - dati.totaleNetto).toFixed(2),
            differenzaTotale: (dati.controlloTs.out.importo_totale - dati.totaleLordo).toFixed(2),
            differenzaTicket: (dati.controlloTs.out.ticket_totale - dati.totaleTicket).toFixed(2),
            differenzaPrestazioni: dati.controlloTs.out.numeroPrestazioni - dati.totalePrestazioni,
            differenzaRicette: dati.controlloTs.out.numero_ricette - dati.numeroRicette
        }
    }
};

const scriviFlussoMSuCartella = async (fileElaborati, controlloTs, strutture, scriviStats = true) => {
    fs.rmSync(settings.out_folder, {recursive: true, force: true});
    fs.mkdirSync(settings.out_folder);
    for (let chiave in fileElaborati) {
        let file = fileElaborati[chiave]
        let anno = file.datiDaFile?.anno ?? file.annoPrevalente;
        let mese = file.datiDaFile?.mese ?? file.mesePrevalente;
        fileElaborati[chiave].controlloTs = controlloTs[file.codiceStruttura + "-" + mese + anno];
        fileElaborati[chiave].differenze = _calcolaDifferenzeDaTs(fileElaborati[chiave])
        if (!fs.existsSync(settings.out_folder + path.sep + anno)) {
            fs.mkdirSync(settings.out_folder + path.sep + anno);
        }
        if (!fs.existsSync(settings.out_folder + path.sep + anno + path.sep + mese)) {
            fs.mkdirSync(settings.out_folder + path.sep + anno + path.sep + mese);
        }
        let fname = settings.out_folder + path.sep + anno + path.sep + mese + path.sep + (file.idDistretto === undefined ? "X" : file.idDistretto) + file.codiceStruttura.substr(0, 4) + mese + anno.substr(2, 2) + "M.txt";
        fs.copyFileSync(file.absolutePath, fname);
        fileElaborati[chiave].tempPath = fname;
    }
    if (scriviStats)
        await _scriviStatsFlussoM(fileElaborati, strutture)
}

function _replacer(key, value) {
    if(value instanceof Map) {
        return {
            dataType: 'Map',
            value: Array.from(value.entries()), // or with spread: value: [...value]
        };
    } else {
        return value;
    }
}

const generaHtmlDaFileStats =  (pathFile, strutture, idDistretto = null, salvaSuFile= true, nomeFile="out.html") =>
{
    let out =
        "<html><head>" +
        "<style type=\"text/css\">" +
        "td { font-size: 12px;}" +
        "th { font-size: 14px;}" +
        ".red {" +
        "    color: yellow;\n" +
        "    background-color: red;\n" +
        "    font-weight: bold;" +
        " }" +
        ".green {" +
        "    color: yellow;\n" +
        "    background-color: green;\n" +
        "    font-weight: bold;" +
        " }" +
        ".blue {" +
        "    color: yellow;\n" +
        "    background-color: blue;\n" +
        "    font-weight: bold;" +
        " }" +
        "</style>" +
        "</head><body>" +

        "<table border='1'" +
        "<tr>" +
        "<th rowspan='2'>ID Struttura</th>" +
        "<th rowspan='2'>Nome</th>" +
        "<th rowspan='2'>Mese</th>" +
        "<th rowspan='2'>Anno</th>" +
        "<th colspan='6'>DATI FILE FLUSSO M</th>" +
        "<th colspan='6'>DATI DA PROGETTO TS</th>" +
        "<th colspan='5'>DIFFERENZE</th>" +
        "</tr>"+
        "<tr>" +
        "<th>N° Righe</th>" +
        "<th>N° Ricette</th>" +
        "<th>N° Prestazioni</th>" +
        "<th>Totale Netto</th>" +
        "<th>Totale Ticket</th>" +
        "<th>Totale Lordo</th>" +
        "<th>N° Ricette</th>" +
        "<th>N° Prestazioni</th>" +
        "<th>Totale Netto</th>" +
        "<th>Totale Ticket</th>" +
        "<th>Totale Lordo</th>" +
        "<th>Data Ora Verifica</th>" +
        "<th>Diff. Ricette</th>" +
        "<th>Diff. N° Prestazioni</th>" +
        "<th>Diff. Netto</th>" +
        "<th>Diff. Ticket</th>" +
        "<th>Diff. Lordo</th>" +
        "</tr>";
    let files = common.getAllFilesRecursive(pathFile,'.mstats');
    let data = [];
    for (let file of files) {
        let rawdata = fs.readFileSync(file);
        let dati = JSON.parse(rawdata);
        data.push(dati)
    }
    if (idDistretto !== null)
    {
        data = data.filter(p => p.idDistretto === idDistretto)
        for (let struttureFile of data)
        {
            out += "<tr>" +
                "<td>" + struttureFile.codiceStruttura + "</td>" +
                "<td>" + strutture[struttureFile.codiceStruttura].denominazione.toUpperCase() + "</td>" +
                "<td>" + (struttureFile.datiDaFile?.mese ?? struttureFile.mesePrevalente)  + "</td>" +
                "<td>" + (struttureFile.datiDaFile?.anno ?? struttureFile.annoPrevalente) + "</td>"+
                "<td>" + struttureFile.numeroRighe + "</td>" +
                "<td>" + struttureFile.numeroRicette + "</td>" +
                "<td>" + struttureFile.totalePrestazioni + "</td>" +
                "<td>" + struttureFile.totaleNetto + "</td>" +
                "<td>" + struttureFile.totaleTicket + "</td>" +
                "<td>" + struttureFile.totaleLordo + "</td>" +
                (!struttureFile.controlloTs.error ? (
                    "<td>" + struttureFile.controlloTs.out.numero_ricette + "</td>" +
                    "<td>" + struttureFile.controlloTs.out.numeroPrestazioni + "</td>" +
                    "<td>" + struttureFile.controlloTs.out.netto_mese_totale + "</td>" +
                    "<td>" + struttureFile.controlloTs.out.ticket_totale + "</td>" +
                    "<td>" + struttureFile.controlloTs.out.importo_totale + "</td>" +
                    "<td>" + struttureFile.controlloTs.out.dataOra + "</td>"
                ) : "<td colspan='5'>Dati non disponibili</td>") +
                (struttureFile.differenze !== null ? (
                    "<td class='red'>" + struttureFile.differenze.differenzaRicette + "</td>" +
                    "<td>" + struttureFile.differenze.differenzaPrestazioni + "</td>" +
                    "<td>" + struttureFile.differenze.differenzaTotaleNetto + "</td>" +
                    "<td>" + struttureFile.differenze.differenzaTicket + "</td>" +
                    "<td>" + struttureFile.differenze.differenzaTotale + "</td>"
                ) : ("<td colspan='4'>Dati non disponibili</td>")) +
                "</tr>";
        }
        out += "</table></body></html>";
        if (salvaSuFile)
        {
            fs.writeFileSync(pathFile + path.sep + nomeFile , out);
        }
    }
}

/*const generaHtmlUsandoGrid =  (pathFile, strutture, idDistretto = null, salvaSuFile= true, nomeFile="out.html") => {
    const grid = new Grid({
        columns: ['Name', 'Email', 'Phone Number'],
        data: [
            ['John', 'john@example.com', '(353) 01 222 3333'],
            ['Mark', 'mark@gmail.com',   '(01) 22 888 4444']
        ]
    });
    grid.render(el);
}*/

const _scriviStatsFlussoM = async (fileData,sovrascrivi=true, ext = ".mstats") => {
    for (let file in fileData) {
        let md5 = file
        let dirName = path.dirname(fileData[file].tempPath)
        if (!fs.existsSync(dirName + path.sep + settings.stat_folder_name))
            fs.mkdirSync(dirName + path.sep + settings.stat_folder_name);
        if (sovrascrivi || !fs.existsSync(dirName + path.sep + settings.stat_folder_name + path.sep + md5 + ext))
            fs.writeFileSync(dirName + path.sep + settings.stat_folder_name + path.sep + md5 + ext, JSON.stringify(_.omit(fileData[file], ["absolutePath", "nomeFile","tempPath"]), _replacer, "\t"), 'utf8');
    }
}


const _aggiornaStatsFlussoM = async (fileArray, strutture, elaborazione= {},sovrascrivi=true, ext = ".mstats") => {
    for (let file of fileArray) {
        let md5 = md5File.sync(file);
        let dirName = path.dirname(file)
        if (!fs.existsSync(dirName + path.sep + settings.stat_folder_name))
            fs.mkdirSync(dirName + path.sep + settings.stat_folder_name);
        if (!elaborazione)
            elaborazione = await _ottieniStatDaFileFlussoM(file, strutture);
        if (elaborazione.errore)
        {
            if (sovrascrivi || !fs.existsSync(dirName + path.sep + settings.stat_folder_name + path.sep + md5+ ext))
                fs.writeFileSync(dirName + path.sep + settings.stat_folder_name + path.sep + md5+ ext, JSON.stringify(_.omit(out.out, ["ricette", "nonOk", "absolutePath", "nomeFile"]), null, "\t"), 'utf8');
        }
    }
}

export const flussoM = {elaboraFlussi, verificaCorrettezzaFileMInCartella,loadStruttureFromFlowlookDB, progettoTSFlussoM, scriviFlussoMSuCartella, generaHtmlDaFileStats}

