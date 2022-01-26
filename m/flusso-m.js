var moment = require('moment');
const fs = require('fs');

const _startsV10082012 = {
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

const _mRowToJson = (row,starts) => {
  var obj = {}
  let from = 0;
  for (let key in starts)
  {
    obj[key] = row.substr(from, starts[key].lenght).trim();
    if (starts[key].type == "date")
      obj[key] = moment(obj[key], "DDMMYYYY");
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
    ricetta.totaleCorretto = totPrestazioniCalcolate.toFixed(2) - ricetta.totale - ricetta.totaleTicket;
    return ricetta;
  }
  else
  {
    return null;
  }

};

const getFilesContent =  async (filePath,incProgress,setForReport1, setForReport2) => {
  console.log(filePath);
  const fileStream = fs.createReadStream(filePath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  // Note: we use the crlfDelay option to recognize all instances of CR LF
  // ('\r\n') in input.txt as a single line break.
  var i = 0;
  var ricette = {};
  var ricettaTemp = [];
  var keyStrutture = Object.keys(flussiUtils.struttureRiferimento);
  var keyPrest = Object.keys(flussiUtils.prestRiferimento);
  //prima parte, caricamento tutte le ricette utili
  for await (const line of rl) {
    if (i%10000 === 0)
      incProgress(10000);
    // Each line in input.txt will be successively available here as `line`.
    //console.log(`Line from file: ${line}`);
    // todo: controllo dimensione riga
    var t = flussiUtils.mRowToJson(line);
    ricettaTemp.push(t);

    if (t.progrRicetta === "99")
    {
      var rt = flussiUtils.buildRicetteFromMRows(ricettaTemp);
      if (rt.prestazioni.filter((p) => keyStrutture.includes(p.arseID) && keyPrest.includes(p.prestID.trim())).length >0) {
        //ricerca duplicati
        //if (Object.keys(ricette).includes(rt.id))
        //  console.log("ricetta" + rt.id + " duplicata!!")
        ricette[rt.id] = rt;
      }
      ricettaTemp = [];
      i++;
    }
    i++;
    //if (i>900000)
    //  break;

  }
  incProgress(i%30000);
  console.log("numRicette:" + Object.values(ricette).length)
  console.log(ricette)
  console.log("elaborati:" + i);
  var noOk = Object.values(ricette).filter((p) => p.totaleCorretto !== 0);
  console.log("NoOk:" + noOk.length);
  var chiaviValide = flussiUtils.elabora(Object.values(ricette),Object.keys(flussiUtils.prestRiferimento),setForReport1,setForReport2);
  /*  check[prop] = {};
      check[prop].count = 1;
      check[prop].numRicette = 1;
      check[prop].ricette = {}
      check[prop].ricette[ricetta.id] = ricetta;*/

  return chiaviValide;
};
const getAllFilesInFolder = (folder) => {
  var files = fs.readdirSync(folder);
  var filesList = files.filter(function(e){
    return path.extname(e).toLowerCase() === '.txt'
  });
  return filesList;
}


module.exports = {



}
