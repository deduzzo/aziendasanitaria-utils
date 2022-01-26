const PREST_1 = "88721";
const PREST_2 = "88722";
const PREST_3 = "88723";

var moment = require('moment');


module.exports = {

  prestRiferimento : {
    "88721": 51.65,
    "88722": 60.43,
    "88723": 61.97,
  },

  struttureRiferimento : {
    "402000": "La Madonnina SRL",
    "402900": "Il cuore - Diagn Cardiovasc. Dr. Signorino",
    "403800": "Casa di cura s. camillo",
    "403900": "Casa di cura Villa Egea",
    "404200": "Casa di cura Villa Salus",
    "405300": "Cardio Center SAS",
    "406900": "Cardio Studio SAS",
    "407600": "St. Cardiologico Garufi SAS",
    "408300": "Cardionova SAS",
    "409400": "Studio Card. Rizzo SAS",
    "412600": "Amb Polisp. SS. Annunziata",
    "417900": "E.C.A.S. SAS da Polito e Figli"
  },

  startsV10082012 : {
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
  },

  mRowToJson(row) {
    var obj = {}
    let from = 0;
    for (let key in this.startsV10082012)
    {
      obj[key] = row.substr(from,this.startsV10082012[key].lenght).trim();
      if (this.startsV10082012[key].type == "date")
        obj[key] = moment(obj[key], "DDMMYYYY");
      from+= this.startsV10082012[key].lenght;
    }
    return obj;
  },

  buildRicetteFromMRows(rows)
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
      //if (ricetta.totaleTicket >0) console.log(ricetta);
      /*if (false)
        if (ricetta.totaleCorretto != 0) {
          console.log(ricetta);
          console.log(totPrestazioniCalcolate.toFixed(2));
          console.log(ricetta.totale);
          console.log(ricetta.totaleTicket);
          console.log(ricetta.totaleCorretto);
          console.log("______________")
        }*/
      return ricetta;
    }
    else
    {
      return null;
    }

  },

  elabora(ricette, arrPrestazioni, setForReport1, setForReport2)
  {
/*    ricette.forEach((ricetta) =>
    {
      if (ricetta.prestazioni.filter((p) => arrStrutture.includes(p.arseID) && arrPrestazioni.includes(p.prestID)).length >0)
        ricTemp.push(ricetta);
    });*/
    // abbiamo già tutte le ricette che hanno almeno una prestazione di interesse

    var check = {};
    ricette.forEach((ricetta) =>
    {
      ricetta.prestazioni.forEach((p) =>
      {
        if (moment(p.dataErog).isSameOrAfter(moment("01062015", "DDMMYYYY")) && moment(p.dataErog).isSameOrBefore(moment("31122015", "DDMMYYYY"))) {
          var prop = ricetta.codiceStruttura + "-" + ricetta.cf + "-" + moment(p.dataErog).format("DDMMYYYY");
          if (check.hasOwnProperty(prop) && arrPrestazioni.includes(p.prestID)) {
            if (!check[prop].ricette.hasOwnProperty(ricetta.id)) {
              check[prop].ricette[ricetta.id] = ricetta;
              check[prop].ticket = check[prop].ticket + ricetta.totaleTicket;
              check[prop].totale = check[prop].totale + ricetta.totale;
            }
            else {
              check[prop].ricette[ricetta.id] = ricetta;
            }
            if (check[prop].prestazioni.hasOwnProperty(p.prestID)) {
              check[prop].prestazioni[p.prestID].count = check[prop].prestazioni[p.prestID].count +1;
              check[prop].prestazioni[p.prestID].idRicette.push(ricetta.id);
            } else {
              check[prop].prestazioni[p.prestID] = {count: 1, idRicette: [ricetta.id]};
            }
          } else if (arrPrestazioni.includes(p.prestID)) {
            check[prop] = {};
            check[prop].ricette = {}
            check[prop].ricette[ricetta.id] = ricetta;
            check[prop].prestazioni = {}
            check[prop].prestazioni[p.prestID] = {count: 1, idRicette: [ricetta.id]};
            check[prop].totale = ricetta.totale;
            check[prop].ticket = ricetta.totaleTicket;
          }
        }
      });
    });

    console.log("check")
    console.log(check);

    // calcolo prestazioni >1
    var chiaviValide = {}
    Object.keys(check).forEach((p) =>
    {
      if (Object.keys(check[p].prestazioni).length > 1)
        chiaviValide[p] = check[p];
    });
    console.log("chiavi valide prima recupero")
    console.log(chiaviValide);

    console.log("ricette trovate: "+ Object.values(chiaviValide).length);
    //console.log(ricTemp);

    var chiavi = Object.keys(chiaviValide);

    let recupero = {}
    let uno = 0;
    let due = 0;
    let tre = 0;

    chiavi.forEach(chiave =>
    {
      //todo: controllo se sono più di 1 per prestazione
      let prestazioni = [];
      Object.keys(chiaviValide[chiave].prestazioni).forEach((p=>
      {
        prestazioni.push(p)
      }))
      var struttura = chiave.substring(0,6);
      //console.log(struttura)
        if (!recupero.hasOwnProperty(struttura)) {
          recupero[struttura] = {}
          recupero[struttura].totale = 0;
          recupero[struttura].numPrestazioni = 0;
          recupero[struttura].ticket = chiaviValide[chiave].ticket;

        }
        if (prestazioni.includes(PREST_1) && prestazioni.includes(PREST_2) && prestazioni.includes(PREST_3)) {
          recupero[struttura].totale = recupero[struttura].totale + this.prestRiferimento[PREST_1] + this.prestRiferimento[PREST_2];
          recupero[struttura].numPrestazioni = recupero[struttura].numPrestazioni + 1;
          recupero[struttura].ticket = recupero[struttura].ticket + chiaviValide[chiave].ticket;
          chiaviValide[chiave].rimborso = this.prestRiferimento[PREST_1] + this.prestRiferimento[PREST_2];
          uno++;
        } else if (prestazioni.includes(PREST_2) && prestazioni.includes(PREST_3)) {
          recupero[struttura].totale = recupero[struttura].totale + this.prestRiferimento[PREST_2];
          recupero[struttura].numPrestazioni = recupero[struttura].numPrestazioni + 1;
          recupero[struttura].ticket = recupero[struttura].ticket + chiaviValide[chiave].ticket;
          chiaviValide[chiave].rimborso = this.prestRiferimento[PREST_2];
          due++;
        } else if ((prestazioni.includes(PREST_1) && prestazioni.includes(PREST_2)) ||
          (prestazioni.includes(PREST_1) && prestazioni.includes(PREST_3))) {
          recupero[struttura].totale = recupero[struttura].totale + this.prestRiferimento[PREST_1];
          recupero[struttura].numPrestazioni = recupero[struttura].numPrestazioni + 1;
          recupero[struttura].ticket = recupero[struttura].ticket + chiaviValide[chiave].ticket;
          chiaviValide[chiave].rimborso = this.prestRiferimento[PREST_1];
          tre++;
        }
    })
    console.log("recupero")
    console.log(recupero)
    setForReport2(chiaviValide);
    setForReport1(recupero)
    console.log("chiavi valide dopo recupero")
    console.log(chiaviValide);
    console.log(uno + " " + due + " " + tre)
    return chiaviValide;
  },
  /*
  completaDatiPrestazioni(oggetto,chiave,codiciInteressati)
  {
    let prestazioni = {}
    var prop = ""
    var alert = false;
    Object.values(oggetto[chiave].ricette).forEach(ricetta =>
    {
      ricetta.prestazioni.forEach(prestazione =>
      {
        if (prop === "")
          prop = ricetta.codiceStruttura +"-"+ ricetta.cf + "-" + moment(prestazione.dataErog).format("DDMMYYYY");

        if (codiciInteressati.includes(prestazione.prestID))
          if (prestazioni.hasOwnProperty(prestazione.prestID)) {
            prestazioni[prestazione.prestID].count = prestazioni[prestazione.prestID].count + 1;
            alert = true;
            if (!prestazioni[prestazione.prestID].idRicette.includes(ricetta.id)) {
              prestazioni[prestazione.prestID].idRicette.push(ricetta.id);
              oggetto[chiave].ticket = oggetto[chiave].ticket + ricetta.totaleTicket;
              oggetto[chiave].totale = oggetto[chiave].totale + ricetta.totale;
            }
          }
          else
          {
            prestazioni[prestazione.prestID] = {};
            prestazioni[prestazione.prestID].count = 1;
            prestazioni[prestazione.prestID].idRicette = [ricetta.id];
            oggetto[chiave].ticket = ricetta.totaleTicket;
            oggetto[chiave].totale = ricetta.totale;
          }
      })
    })
    if (alert)
    {
      console.log("alert")
      console.log(oggetto[chiave])
    }
    oggetto[chiave].prest = prestazioni;

}*/

}
