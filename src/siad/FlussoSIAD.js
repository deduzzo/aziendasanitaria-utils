import * as xml2js from 'xml2js'
import fs from 'fs';
import reader from 'xlsx';
import path from "path";
import moment from 'moment';
import {utils} from "../Utils.js";

import {Parser, Validator} from '@marketto/codice-fiscale-utils';
import {Assistiti} from "../narTsServices/Assistiti.js";
import _ from "lodash";

const tracciato1 = {
    CUNI: "CUNI",
    validitaCI: "validitaCI",
    tipologiaCI: "tipologiaCI",
    annoNascita: "annoNascita",
    genere: "genere",
    cittadinanza: "cittadinanza",
    statoCivile: "statoCivile",
    responsabilitaGenitoriale: "responsabilitaGenitoriale",
    residenzaRegione: "residenzaRegione",
    residenzaASL: "residenzaASL",
    residenzaComune: "residenzaComune",
    nucleoFamiliare: "nucleoFamiliare",
    assistenteNonFamiliare: "assistenteNonFamiliare",
    codiceRegione: "codiceRegione",
    codiceASL: "codiceASL",
    dataPresaInCarico: "dataPresaInCarico",
    soggetoRichiedente: "soggetoRichiedente",
    tipologiaPic: "tipologiaPic",
    pianificazioneCondivisa: "pianificazioneCondivisa",
    idRecord: "idRecord",
    dataValutazione: "dataValutazione",
    patologiaPrevalente: "patologiaPrevalente",
    patologiaConcomitante: "patologiaConcomitante",
    autonomia: "autonomia",
    gradoMobilita: "gradoMobilita",
    disturbiCognitivi: "disturbiCognitivi",
    disturbiComportamentali: "disturbiComportamentali",
    supportoSociale: "supportoSociale",
    fragilitaFamiliare: "fragilitaFamiliare",
    rischioInfettivo: "rischioInfettivo",
    rischioSanguinamento: "rischioSanguinamento",
    drenaggioPosturale: "drenaggioPosturale",
    ossigenoTerapia: "ossigenoTerapia",
    ventiloterapia: "ventiloterapia",
    tracheostomia: "tracheostomia",
    alimentazioneAssistita: "alimentazioneAssistita",
    alimentazioneEnterale: "alimentazioneEnterale",
    alimentazioneParenterale: "alimentazioneParenterale",
    gestioneStomia: "gestioneStomia",
    eliminazioneUrinariaIntestinale: "eliminazioneUrinariaIntestinale",
    alterazioneRitmoSonnoVeglia: "alterazioneRitmoSonnoVeglia",
    interventiEducativiTerapeutici: "interventiEducativiTerapeutici",
    lesioniCutanee: "lesioniCutanee",
    curaUlcereCutanee12Grado: "curaUlcereCutanee12Grado",
    curaUlcereCutanee34Grado: "curaUlcereCutanee34Grado",
    prelieviVenosiNonOccasionali: "prelieviVenosiNonOcc",
    ecg: "ECG",
    telemetria: "telemetria",
    terSottocutIntraMuscInfus: "terSottocutIntraMuscInfus",
    gestioneCatetere: "gestioneCatetere",
    trasfusioni: "trasfusioni",
    controlloDolore: "controlloDolore",
    appartenenzaRete: "appartenenzaRete",
    tipoRete: "tipoRete",
    curePalliative: "curePalliative",
    segnoSintomoClinico: "segnoSintomoClinico",
    utilStrumentoIdentBisognoCp: "utilStrumentoIdentBisognoCp",
    utilStrumentoValMultidid: "utilStrumentoValMultidid",
    trattamentiRiabilitativiNeurologici: "trattamentiRiabilitativiNeurologici",
    trattamentiRiabilitativiOrtopedici: "trattamentiRiabilitativiOrtopedici",
    trattamentiRiabilitativiDiMantenimento: "trattamentiRiabilitativiDiMantenimento",
    supervisioneContinua: "supervisioneContinua",
    assistenzaIADL: "assistenzaIADL",
    assistenzaADL: "assistenzaADL",
    supportoCareGiver: "supportoCareGiver",
};

const tracciato1Maggioli = {
    0: "Tipo",
    1: "Codice Univoco Non Invertibile (CUNI) – Indicare Codice Fiscale",
    2: "Validità del codice Identificativo dell'assistito",
    3: "Tipologia del codice Identificativo dell'assistito",
    4: "Anno di nascita",
    5: "Genere - Valori ammessi:\n 1 - Maschio\n2 - Femmina",
    6: "Cittadinanza ",
    7: "Stato Civile - I valori ammessi\n1 - celibe/nubile\n2 - coniugato\n3 - separato\n4 - divorziato\n5 - vedovo\n9 - non dichiarato",
    8: "Regione residenza assistito",
    9: "ASL residenza assistito",
    10: "Comune residenza assistito (codice ISTAT)",
    11: "Nucleo Familiare - Indica il numero dei componenti del nucleo\nfamiliare convivente, escluso l’assistito e\nl’eventuale assistente convivente (rientrano nel\nconteggio ad esempio: coniuge/partner\nconvivente, figlio/a, fratello/sorella, nipote,\ngenero/nuora, cognato/a).",
    12: "Assistente Non Familiare - Persona, non appartenente al nucleo familiare\n(es.: badante), che convive con l’assistito (24h):\n1 presente\n2 non presente",
    13: "Codice Regione che eroga il Servizio",
    14: "Codice ASL che eroga il Servizio",
    15: "Data della presa in carico dell’assistito",
    16: "Id Record",
    17: "Soggetto richiedente - I valori ammessi sono i seguenti:\n1. Servizi sociali\n2. MMG/PLS\n3. Ospedale\n4. Ospedale per dimissione protetta\n5. Struttura residenziale extraospedaliera\n6. Utente/familiari anche tramite Punto unico di accesso\n7. Apertura amministrativa per riassetto territoriale ASL\n8. Apertura amministrativa della stessa persona presa in carico\n9. Altro\n10. Hospice\n11. Servizi territoriali/distrettuali\n12. Medico specialista\n13. Ambulatorio cure palliative",
    18: "Tipologia PIC - I valori ammessi sono i seguenti:\n1. Cure domiciliari (DPCM 12 gennaio 2017 art. 22)\n2. UCPDOM",
    19: "Data della valutazione iniziale dell’assistito",
    20: "Cognitivi - I valori ammessi sono i seguenti:\n1. Assenti/lievi\n2. Moderati\n3. Gravi",
    21: "Comportamentali - I valori ammessi sono i seguenti:\n1. Assenti/lievi\n2. Moderati\n3. Gravi",
    22: "Supporto Sociale - I valori ammessi sono:\n1. Presenza\n2. Presenza parziale e/o temporanea\n3. Non presenza",
    23: "Fragilità Familiare - Valore ammessi:\n1. presente\n2. assente\n9. non disponibile *",
    24: "Rischio Infettivo - Valori ammessi:\n1. Si\n2. No",
    25: "Rischio sanguinamento acuto - Valori ammessi:\n1. Si\n2. No\n9. non disponibile *",
    26: "Broncorespirazione / Drenaggio Posturale - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    27: "Ossigeno Terapia - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    28: "Ventiloterapia - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    29: "Tracheostomia - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    30: "Assistita - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    31: "Enterale - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    32: "Parenterale - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    33: "Gestione Stomia - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    34: "Manovre per favorire eliminazione Urinaria Intestinale - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    35: "Assistenza per alterazione Ritmo Sonno /Veglia - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    36: "Interventi Educazione Terapeutica - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    37: "Lesioni della cute da patologe correlate - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    38: "Cura Ulcere Cutanee 1° e 2° Grado - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    39: "Cura Ulcere Cutanee 3° e 4° Grado - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    40: "Prelievi Venosi Non Occasionale - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    41: "ECG - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    42: "Telemetria - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    43: "Terapia Sottocutanea/Intramuscolare/Infusionale - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    44: "Gestione Catetere Centrale - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    45: "Trasfusioni - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    46: "Controllo Dolore - Valore ammessi:\n1. Bisogno presente\n2. Bisogno assente",
    47: "Neurologico in presenza di disabilità - I valori ammessi sono:\n1. Presenza\n2. Presenza parziale e/o temporanea\n3. Non presenza",
    48: "Motorio - I valori ammessi sono:\n1. Presenza\n2. Presenza parziale e/o temporanea\n3. Non presenza",
    49: "Di Mantenimento in presenza di disabilità - I valori ammessi sono:\n1. Presenza\n2. Presenza parziale e/o temporanea\n3. Non presenza",
    50: "Supervisione Continua di utenti con disabilità - I valori ammessi sono:\n1. Presenza\n2. Presenza parziale e/o temporanea\n3. Non presenza",
    51: "Assistenza IADL - I valori ammessi sono:\n1. Presenza\n2. Presenza parziale e/o temporanea\n3. Non presenza",
    52: "Assistenza ADL - I valori ammessi sono:\n1. Presenza\n2. Presenza parziale e/o temporanea\n3. Non presenza",
    53: "Supporto Care Giver - I valori ammessi sono:\n1. Presenza\n2. Presenza parziale e/o temporanea\n3. Non presenza",
    54: "Patologia Prevalente",
    55: "Patologia Concomitante",
    56: "idRecord PIC precedente attiva da chiudere",
    57: "data presa in carico pic precedente da chiudere",
    58: "data chiusura PIC da PAI"
};

const tracciato2Maggioli = {
    0: "Codice Fiscale",
    1: "Tipo",
    2: "Codice Regione che eroga il Servizio",
    3: "Codice ASL che eroga il Servizio",
    4: "Data della presa in carico dell’assistito",
    5: "Id Record",
    6: "Data della rivalutazione iniziale dell’assistito",
    7: "Motivo - I valori ammessi sono: 1. scadenza del periodo previsto 2. variazione nelle condizioni del paziente",
    8: "Conferma Precedente - Valori ammessi 1. Si (in questo caso i campi successivi relativi all’evento “rivalutazione” non devono essere inviati2) 2. No",
    9: "Tipo accesso -  Valori ammessi: 1. programmato Si 2. programmato No 9. non disponibile *",
    10: "Data accesso al domicilio dell’assistito",
    11: "Tipo Operatore che ha effettuato l’accesso  I valori ammessi sono: 1. MMG 2. PLS 3. infermiere 4. medico specialista 5. medico esperto in cure palliative 6. Medico di continuità assistenziale 7. psicologo 8. fisioterapista 9. logopedista 10. OSS 11. dietista 12. assistente sociale del SSN 13. terapista occupazionale 99. altro",
    12: "Tipo Prestazione\nI valori ammessi sono:\n1. Visita domiciliare (comprensiva di valutazione/clinica/funzionale/ sociale e monitoraggio)\n2. Prelievo ematico\n3. Esami strumentali\n4. Trasferimento competenze/educazione del caregiver/colloqui/nursering/addestramento\n5. Supporto psicologico équipes-paziente-famiglia\n6. Terapie iniettive attraverso le diverse vie di somministrazione\n7. Terapia infusionale SC e EV\n8. Emotrasfusione\n9. Paracentesi, Toracentesi e altre manovre invasive,gestione di cateteri spinali o sistemi di neuromodulazione del dolore\n10. Gestione ventilazione meccanica - tracheostomia - sostituzione canula - broncoaspirazione - ossigenoterapia\n11. Gestione nutrizione enterale (SNG PEG)\n12. Gestione nutrizione parenterale - gestione cvc\n13. Gestione cateterismo urinario comprese le derivazioni urinarie\n14. Gestione alvo comprese le enterostomie\n15. Igiene personale e mobilizzazione\n16. Medicazioni semplici\n17. Medicazioni complesse\n18. Fasciature semplici, bendaggi, bendaggi adesivo elastici\n19. Trattamento di rieducazione motoria – respiratoria\n20. Trattamento di rieducazione del linguaggio\n21. Trattamento di rieducazione dei disturbi neuropsicologici\n22. Controllo dolore\n23. Controllo dispnea\n24. Controllo sintomi gastro-enterici (nausea, vomito, ecc.)\n25. Controllo sintomi psico-comportamentali (ansia, angoscia, agitazione,delirium, ecc.)\n26. Sedazione terminale/palliativa\n27. Gestione di quadri clinici complessi (fistole, masse ulcerate, stomie, drenaggi,vaste lesioni cutanee, etc.)\n28. Accudimento del paziente (con autonomia ridotta o assente)\n99. non disponibile *",
    13: "Data sospensione dell’erogazione del servizio",
    14: "Motivazione della sospensione dell’erogazione del servizio - I valori ammessi sono:\n1. ricovero temporaneo in ospedale\n2. allontanamento temporaneo\n3. ricovero temporaneo in struttura residenziale\n4. RICOVERO IN HOSPICE\n9 altro",
    15: "Data AD (conclusione dell’assistenza domiciliare all’assistito)"
}


export class FlussoSIAD {

    /**
     * @param {ImpostazioniFlussoSIAD} settings - Settings
     * @param impostazioniServizi
     */
    constructor(settings, impostazioniServizi = null) {
        this._settings = settings;
        this._impostazioniServizi = impostazioniServizi
    }

    async importaTracciato1ChiaviValideAssessorato(pathFile) {
        return await utils.getObjectFromFileExcel(pathFile, null, true, 13);
    }

    async importaTracciato2ChiaviValideAssessorato(pathFile) {
        return await utils.getObjectFromFileExcel(pathFile, null, true, 15);
    }

    ottieniDatiFromIdPic(idPic) {
        return {
            cf: idPic.substring(16, 32),
            dataInizio: moment(idPic.substring(6, 16), "YYYY-MM-DD"),
            dataFine: idPic.substring(33, 43) !== "" ? moment(idPic.substring(33, 43), "YYYY-MM-DD") : null,
        }
    }

    async creaMappaChiaviValideAssessorato(fileT1, fileT2, anno) {
        let chiaviValideT1 = await this.importaTracciato1ChiaviValideAssessorato(fileT1);
        let chiaviValideT2 = await this.importaTracciato2ChiaviValideAssessorato(fileT2);

        let mappa = {
            allIds: {},
            allCfT1: {},
            allCfNonTrattati: {},
            allCfTrattati: {},
            perCf: {},
            allAperte: {},
            almenoUnaErogazione: {},
            nessunaErogazione: {},
            sovrapposte: {},
            sospese: {},
            errors: [],
            warnings: []
        }

        for (let rigat1 of chiaviValideT1) {
            const annoPicFromMinistero = rigat1["Anno Presa In Carico"];
            if (annoPicFromMinistero === anno) {
                const id = rigat1["Id Record"];
                if (!mappa.allIds.hasOwnProperty(id))
                    mappa.allIds[id] = id;
                else
                    mappa.errors.push({
                        id: id,
                        cf: id.substring(16, 32),
                        msg: "Chiave duplicata"
                    });
                let dataFromId = this.ottieniDatiFromIdPic(id);
                const cf = dataFromId.cf;
                if (!mappa.allCfT1.hasOwnProperty(cf))
                    mappa.allCfT1[cf] = cf;
                const dataInizioPicMinistero = moment(rigat1["Data  Presa In Carico"]);
                const dataFinePicMinistero = rigat1["Data Conclusione"] !== "" ? moment(rigat1["Data Conclusione"]) : null;
                if (dataFromId.dataInizio.format("DD/MM/YYYY") !== dataInizioPicMinistero.format("DD/MM/YYYY")) {
                    mappa.warnings.push({
                        id: id,
                        cf,
                        msg: "Data inizio PIC Ministero diversa da data inizio PIC Id Record"
                    })
                }
                if (annoPicFromMinistero !== anno) {
                    mappa.errors.push({
                        id: id,
                        cf,
                        msg: "Anno PIC Ministero diverso da anno"
                    })
                }
                if (!mappa.perCf.hasOwnProperty(cf))
                    mappa.perCf[cf] = {chiuse: {}, aperte: {}}
                if (dataFinePicMinistero === null) { // pic aperta
                    mappa.perCf[cf].aperte[id] = rigat1;
                    mappa.allAperte[id] = rigat1;
                    if (Object.keys(mappa.perCf[cf].aperte).length > 1)
                        mappa.sovrapposte[cf] = mappa.perCf[cf].aperte;
                }
            }
        }
        for (let rigat2 of chiaviValideT2) {
            const id = rigat2["Id Record"];
            const datiId = this.ottieniDatiFromIdPic(id);
            if (!mappa.allIds.hasOwnProperty(id)) {
                mappa.errors.push({
                    id: id,
                    cf: id.substring(16, 32),
                    msg: "Chiave non presente in tracciato 1"
                })
            }
            const ultimaErogazione = rigat2["Ultima Data Erogazione\n"];
            if (typeof rigat2['Data Conclusione'] === "string" && rigat2['Data Conclusione'].includes("--")) { // aperta
                if (typeof ultimaErogazione === "string" && ultimaErogazione.includes("--")) // nessuna erogazione, dovrebbe essere sospesa
                    mappa.nessunaErogazione[id] = rigat2;
                else {
                    mappa.almenoUnaErogazione[id] = rigat2;
                    if (!mappa.allCfTrattati.hasOwnProperty(datiId.cf))
                        mappa.allCfTrattati[datiId.cf] = datiId.cf;
                }
                if (!(typeof rigat2['Data Inizio Sospensione'] === "string" && rigat2['Data Inizio Sospensione'].includes("--"))
                    && !(typeof rigat2['Data Fine Sospensione'] === "string" && rigat2['Data Fine Sospensione'].includes("--"))) { // sospesa
                    mappa.sospese[id] = rigat2;
                }
            }
        }

        Object.keys(mappa.allAperte).forEach((id) => {
            if (!mappa.almenoUnaErogazione.hasOwnProperty(id) && !mappa.nessunaErogazione.hasOwnProperty(id))
                mappa.nessunaErogazione[id] = mappa.allAperte[id];
        });

        Object.keys(mappa.allCfT1).forEach((cf) => {
            if (!mappa.allCfTrattati.hasOwnProperty(cf))
                mappa.allCfNonTrattati[cf] = cf;

        });
        return mappa;


    }

    contaPrestazioni() {

        let data = {};
        let dataOver65 = {};
        const parser = new xml2js.Parser({attrkey: "ATTR"});

        let files = utils.getAllFilesRecursive(this._settings.in_folder, ".xml", "APS");
        files.forEach(file => {
            console.log(file);

            let xml_string = fs.readFileSync(file, "utf8");
            console.log("file:" + file)
            parser.parseString(xml_string, function (error, result) {
                if (error === null) {
                    let assistenze = result['FlsAssDom_2']['Assistenza'];
                    for (var i = 0; i < assistenze.length; i++) {
                        let chiaveAssistito = assistenze[i]['Eventi'][0]['PresaInCarico'][0]['Id_Rec'][0];
                        let assistito = chiaveAssistito.substr(chiaveAssistito.length - 16, chiaveAssistito.length - 1)
                        let eta = utils.getAgeFromCF(assistito);
                        if (!data.hasOwnProperty(assistito))
                            data[assistito] = {'preseInCarico': 1, 'accessi': 0, 'palliativa': false};
                        else {
                            data[assistito]['preseInCarico'] = data[assistito]['preseInCarico'] + 1;
                        }
                        if (eta >= 65) {
                            if (!dataOver65.hasOwnProperty(assistito))
                                dataOver65[assistito] = {'preseInCarico': 1, 'accessi': 0, 'palliativa': false};
                            else {
                                dataOver65[assistito]['preseInCarico'] = dataOver65[assistito]['preseInCarico'] + 1;
                            }
                        }

                        // accessi

                        let accessi = assistenze[i]['Eventi'][0]['Erogazione'];
                        if (accessi) {
                            for (var k = 0; k < accessi.length; k++) {
                                if (assistenze[i]['Eventi'][0]['Erogazione'][k].hasOwnProperty('ATTR')) {
                                    if (parseInt(assistenze[i]['Eventi'][0]['Erogazione'][k]['TipoOperatore'][0]) === 5) {
                                        //palliativa?
                                        data[assistito]['palliativa'] = true;
                                        if (eta > 65)
                                            dataOver65[assistito]['palliativa'] = true;
                                    }
                                    //console.log(accessi);
                                    //console.log(assistenze[i]['Eventi'][0]['Erogazione'][k]['ATTR']['numAccessi']);
                                    data[assistito]['accessi'] = data[assistito]['accessi'] + parseInt(assistenze[i]['Eventi'][0]['Erogazione'][k]['ATTR']['numAccessi']);
                                    if (eta > 65)
                                        dataOver65[assistito]['accessi'] = dataOver65[assistito]['accessi'] + parseInt(assistenze[i]['Eventi'][0]['Erogazione'][k]['ATTR']['numAccessi']);
                                }
                            }
                        } else {
                            //conclusione?
                            //console.log(assistenze[i]['Eventi'][0]);
                        }
                    }
                } else {
                    console.log(error);
                }
            });


        })
        //console.log(data);
        var chiavi = Object.keys(data);
        var totalePreseInCarico = 0;
        var totalePreseIncaricoAlmenoUnAccesso = 0;
        var totalePalliativa = 0;
        var totaleAccessiPalliativa = 0;
        var totaleAccessiGeriatrica = 0;

        var chiavi65 = Object.keys(dataOver65);
        var totalePreseInCarico65 = 0;
        var totalePreseIncaricoAlmenoUnAccesso65 = 0;
        var totalePalliativa65 = 0;
        var totaleAccessiPalliativa65 = 0;
        var totaleAccessiGeriatrica65 = 0;

        for (var i = 0; i < chiavi.length; i++) {
            //console.log(data[chiavi[i]])
            if (data[chiavi[i]]['accessi'] > 0) {
                totalePreseIncaricoAlmenoUnAccesso++;
                totalePreseInCarico += data[chiavi[i]]['preseInCarico'];
                if (data[chiavi[i]]['palliativa'] === true) {
                    totalePalliativa++;
                    totaleAccessiPalliativa += data[chiavi[i]]['accessi'];
                } else
                    totaleAccessiGeriatrica += data[chiavi[i]]['accessi'];
            }
        }

        for (var i = 0; i < chiavi65.length; i++) {
            if (dataOver65[chiavi65[i]]['accessi'] > 0) {
                totalePreseIncaricoAlmenoUnAccesso65++;
                totalePreseInCarico65 += dataOver65[chiavi65[i]]['preseInCarico'];
                if (dataOver65[chiavi65[i]]['palliativa'] === true) {
                    totalePalliativa65++;
                    totaleAccessiPalliativa65 += dataOver65[chiavi65[i]]['accessi'];
                } else
                    totaleAccessiGeriatrica65 += dataOver65[chiavi65[i]]['accessi'];
            }
        }

        console.log("Totale prese in carico : " + chiavi.length);
        console.log("Totale prese in carico almeno un accesso: " + totalePreseIncaricoAlmenoUnAccesso);
        console.log("Totali geriatrica: " + (totalePreseIncaricoAlmenoUnAccesso - totalePalliativa));
        console.log("Totali palliativa: " + totalePalliativa);
        console.log("Totali accessi: " + (totaleAccessiPalliativa + totaleAccessiGeriatrica));
        console.log("Totali accessi Geriatrica: " + totaleAccessiGeriatrica);
        console.log("Totali accessi Palliativa: " + totaleAccessiPalliativa);

        console.log("Totale prese in carico over 65: " + chiavi65.length);
        console.log("Totale prese in carico almeno un accesso over 65: " + totalePreseIncaricoAlmenoUnAccesso65);
        console.log("Totali geriatrica over 65: " + (totalePreseIncaricoAlmenoUnAccesso65 - totalePalliativa65));
        console.log("Totali palliativa over 65: " + totalePalliativa65);
        console.log("Totali accessi over 65: " + (totaleAccessiPalliativa65 + totaleAccessiGeriatrica65));
        console.log("Totali accessi Geriatrica over 65: " + totaleAccessiGeriatrica65);
        console.log("Totali accessi Palliativa over 65: " + totaleAccessiPalliativa65);
    }

    statisticheChiaviValide(pathFile) {
        let outData = {};
        const nomeFile = "chiavivalidepulito.xls";

        let dataTracciato1 = [];
        const file = reader.readFile(pathFile + path.sep + nomeFile,);
        const sheets = file.SheetNames;
        for (let i = 0; i < sheets.length; i++) {
            console.log(file.SheetNames[i]);
            const temp = reader.utils.sheet_to_json(
                file.Sheets[file.SheetNames[i]]);
            dataTracciato1 = [...dataTracciato1, ...temp]
        }

        let chiaviValide = {}
        let i = 0;
        let quanti = dataTracciato1.length;
        for (let dato of dataTracciato1) {
            if (typeof (dato['Data Conclusione'] === 'number')) {
                if (chiaviValide.hasOwnProperty(dato['Id Record'].substring(16, 32))) {
                    chiaviValide[dato['Id Record'].substring(16, 32)].count = chiaviValide[dato['Id Record'].substring(16, 32)].count + 1
                    chiaviValide[dato['Id Record'].substring(16, 32)].rows.push(dato);
                } else {
                    chiaviValide[dato['Id Record'].substring(16, 32)] = {count: 1, rows: [dato]};
                }
                if (i++ % 1000 === 0)
                    console.log("Elaborazione " + i + " di " + quanti);
            }
        }
        Object.keys(chiaviValide).forEach((chiave) => {
            outData = this.generaRigheChiusura(chiaviValide[chiave].rows, outData);
        })

    }

    generaRigheChiusura(rows, outData) {
        if (rows.length === 1) {
            let dato = rows[0];
            let annoPIC = parseInt(dato["Anno Presa In Carico"]);
            let annoRivalutazione = !dato["Ultima Data Rivalutazione "].startsWith("--") ? parseInt(dato["Ultima Data Rivalutazione "].substring(0, 4)) : annoPIC;
            let annoUltimaErogazione = !dato["Ultima Data Erogazione"].startsWith("--") ? parseInt(dato["Ultima Data Erogazione"].substring(0, 4)) : annoPIC
            let annoFineSospensione = dato.hasOwnProperty("Data Fine Sospensione") ? (!dato["Data Fine Sospensione"].startsWith("--") ? parseInt(dato["Data Fine Sospensione"].substring(0, 4)) : 0) : annoPIC;
            let anno = Math.max(annoPIC, annoRivalutazione, annoUltimaErogazione, annoFineSospensione)
            let tempRiga = {
                Trasmissione: {$: {"tipo": "I"}},
                Erogatore: {CodiceRegione: dato["Codice Regione"], CodiceASL: dato["Codice ASL"]},
                Eventi: {
                    PresaInCarico: {
                        $: {"data": dato["Data  Presa In Carico"]},
                        Id_Rec: dato["Id Record"]
                    },
                    Conclusione: {
                        $: {"dataAD": anno + "-12-31"},
                        Motivazione: 99
                    }
                }
            };
            if (!outData.hasOwnProperty(anno))
                outData[anno] = [];
            outData[anno].push(tempRiga);
        } else {
            console.log(rows);
        }

        return outData;
    }

    generaFlussoRettificaChiusure(pathFile, folderOut, codRegione, codASL) {
        //objRettifica = [{chiave: xx, pic:xxx, conclusione: xxx, motivazione: xxx} .... ]
        // Reading our test file
        const file = reader.readFile(pathFile);

        let data = [];

        const sheets = file.SheetNames;
        console.log(sheets);

        for (let i = 0; i < sheets.length; i++) {
            const temp = reader.utils.sheet_to_json(
                file.Sheets[file.SheetNames[i]]);
            temp.forEach((res) => {
                data.push(res);
            });
        }
        console.log(data[0]);
        let i = 0;
        let k = 0;
        let a2021 = 0;
        let outData = {};
        let chiavi = {}
        for (let dato of data) {
            if (dato["Data Conclusione"].startsWith("--")) {
                let annoPIC = parseInt(dato["Anno Presa In Carico"]);
                let annoRivalutazione = !dato["Ultima Data Rivalutazione "].startsWith("--") ? parseInt(dato["Ultima Data Rivalutazione "].substring(0, 4)) : annoPIC;
                let annoUltimaErogazione = !dato["Ultima Data Erogazione"].startsWith("--") ? parseInt(dato["Ultima Data Erogazione"].substring(0, 4)) : annoPIC
                let annoFineSospensione = dato.hasOwnProperty("Data Fine Sospensione") ? (!dato["Data Fine Sospensione"].startsWith("--") ? parseInt(dato["Data Fine Sospensione"].substring(0, 4)) : 0) : annoPIC;
                let anno = Math.max(annoPIC, annoRivalutazione, annoUltimaErogazione, annoFineSospensione)
                if (anno > 2013 && anno < 2022) {
                    console.log("Elaboro record " + ++i)
                    if (anno === 2021) a2021++;
                    //console.log(dato);
                    let tempRiga = {
                        Trasmissione: {$: {"tipo": "I"}},
                        Erogatore: {CodiceRegione: codRegione, CodiceASL: codASL},
                        Eventi: {
                            PresaInCarico: {
                                $: {"data": dato["Data  Presa In Carico"]},
                                Id_Rec: dato["Id Record"]
                            },
                            Conclusione: {
                                $: {"dataAD": anno + "-12-31"},
                                Motivazione: 99
                            }
                        }
                    };
                    if (!outData.hasOwnProperty(anno))
                        outData[anno] = [];
                    outData[anno].push(tempRiga);
                } else
                    console.log("Record non elaborato " + ++k)
            } else
                console.log("Record non elaborato " + ++k)
        }

        var builder = new xml2js.Builder();
        for (let chiave of Object.keys(outData)) {
            var obj = {FlsAssDom_2: {$: {"xmlns": "http://flussi.mds.it/flsassdom_2"}, Assistenza: outData[chiave]}}
            var xml = builder.buildObject(obj);
            fs.writeFileSync(folderOut + path.sep + codRegione + codASL + "_000_" + chiave.substring(0, 4) + "_12_SIAD_APS_al_" + moment().date() + "_" + ((moment().month() + 1) < 10 ? ("0" + (moment().month() + 1)) : (moment().month() + 1)) + "_" + moment().year() + ".xml", xml);
        }
        console.log("Chiusi: " + i + " - Non elaborati: " + k)
        console.log("2021: " + a2021)
        //console.log(xml);

    }

    async generaMappaPICT1(path) {
        let mappaChiavi = this.creaOggettoAssistitiTracciato1(path);
        let perCf = {};
        for (let chiave in mappaChiavi) {
            let cf = chiave.substring(16, 32);
            if (!perCf.hasOwnProperty(cf))
                perCf[cf] = [];
            perCf[cf].push(chiave);
        }
        console.log("Sono presenti " + Object.keys(perCf).length + " assistiti");

        return {mappa: mappaChiavi, perCf: perCf};
    }

    generaRigheTracciato1ConDefault(folder, datiRaw, nomeFile, anno, trimestre, tipo = "I", codRegione = "190", codASL = "205", datoObbligatorio = "<OBB>") {
        const defaultRiga = {
            Trasmissione: {$: {"tipo": tipo}},
            Assistito: {
                DatiAnagrafici: {
                    CUNI: datoObbligatorio,
                    validitaCI: 0,
                    tipologiaCI: 0,
                    AnnoNascita: datoObbligatorio,
                    Genere: datoObbligatorio,
                    Cittadinanza: "IT",
                    StatoCivile: 9,
                    ResponsabilitaGenitoriale: 3,
                    Residenza: {
                        Regione: codRegione,
                        ASL: codASL,
                        Comune: "083048"
                    },
                }
            },
            Conviventi: {
                NucleoFamiliare: 0,
                AssistenteNonFamiliare: 2,
            },
            Erogatore: {
                CodiceRegione: codRegione,
                CodiceASL: codASL
            },
            Eventi: {
                PresaInCarico: {
                    $: {
                        data: datoObbligatorio,
                        soggettoRichiedente: 9,
                        TipologiaPIC: datoObbligatorio,
                    },
                    Id_Rec: datoObbligatorio,
                },
                Valutazione: {
                    $: {
                        data: datoObbligatorio,
                    },
                    Patologia: {
                        Prevalente: datoObbligatorio,
                        Concomitante: datoObbligatorio,
                    },
                    Autonomia: 2,
                    GradoMobilita: 2,
                    Disturbi: {
                        Cognitivi: 1,
                        Comportamentali: 1,
                    },
                    SupportoSociale: 1,
                    FragilitaFamiliare: 2,
                    RischioInfettivo: 2,
                    RischioSanguinamento: 2,
                    DrenaggioPosturale: 2,
                    OssigenoTerapia: 2,
                    Ventiloterapia: 2,
                    Tracheostomia: 2,
                    Alimentazione: {
                        Assistita: 2,
                        Enterale: 2,
                        Parenterale: 2,
                    },
                    GestioneStomia: 2,
                    ElimiUrinariaIntestinale: 2,
                    AlterRitmoSonnoVeglia: 2,
                    IntEduTerapeutica: 2,
                    LesioniCute: 2,
                    CuraUlcereCutanee12Grado: 2,
                    CuraUlcereCutanee34Grado: 2,
                    PrelieviVenosiNonOcc: 2,
                    ECG: 2,
                    Telemetria: 2,
                    TerSottocutIntraMuscInfus: 2,
                    GestioneCatetere: 2,
                    Trasfusioni: 2,
                    ControlloDolore: 2,
                    TrattamentiRiab: {
                        Neurologico: 2,
                        Motorio: 2,
                        DiMantenimento: 2,
                    },
                    SupervisioneContinua: 2,
                    AssistenzaIADL: 2,
                    AssistenzaADL: 2,
                    SupportoCareGiver: 2,
                }
            }
        }
        let out = [];
        for (let datoRaw of datiRaw) {
            let riga = _.cloneDeep(defaultRiga);
            if (datiRaw[18].toString() === "2") {
                // palliativa
                riga.Erogatore.AppartenenzaRete = 1;
                riga.Erogatore.TipoRete = 1;
                riga.Eventi.PresaInCarico.$.PianificazioneCondivisa = 9;
                riga.Eventi.CurePalliative = 1;
                riga.Valutazione.ValutazioneUCPDOM = {
                    SegnoSintomoClinico: datoObbligatorio,
                    UtilStrumentoIdentBisognoCP: datoObbligatorio,
                    UtilStrumentoValMultid: datoObbligatorio
                }
            }

            for (let chiave of Object.values(tracciato1Maggioli)) {
                const dato = datoRaw[chiave];
                if (dato && dato !== "") {
                    switch (chiave) {
                        case tracciato1Maggioli[1]: //CUNI
                            riga.Assistito.DatiAnagrafici.CUNI = dato;
                            break;
                        case tracciato1Maggioli[4]: //AnnoNascita
                            riga.Assistito.DatiAnagrafici.AnnoNascita = parseInt(dato);
                            break;
                        case tracciato1Maggioli[5]: //Genere
                            riga.Assistito.DatiAnagrafici.Genere = parseInt(dato);
                            break;
                        case tracciato1Maggioli[15]: //Data Presa In Carico
                            riga.Eventi.PresaInCarico.$.data = moment(dato, "DD/MM/YYYY").format("YYYY-MM-DD");
                            break;
                        case tracciato1Maggioli[19]: //data valutazione iniziale
                            riga.Eventi.Valutazione.$.data = moment(dato, "DD/MM/YYYY").format("YYYY-MM-DD");
                            break;
                        case tracciato1Maggioli[18]: //Tipo PIC
                            riga.Eventi.PresaInCarico.$.TipologiaPIC = parseInt(dato);
                            break;
                        case tracciato1Maggioli[54]: //Patologia prevalente
                            riga.Eventi.Valutazione.Patologia.Prevalente = dato;
                            break;
                        case tracciato1Maggioli[55]: //Patologia concomitante
                            riga.Eventi.Valutazione.Patologia.Concomitante = dato;
                            break;
                    }
                }
            }
            riga.Eventi.PresaInCarico.Id_Rec = codRegione + codASL + riga.Eventi.PresaInCarico.$.data + riga.Assistito.DatiAnagrafici.CUNI;
            out.push(riga);
        }

        // ogni dato obbligatorio deve essere valorizzato, verifichiamo che ne sia rimasto qualcuno
        let ris = this.verificaPresenzaDiDatiMancanti(out, nomeFile);
        if (ris.ok) {
            const builder = new xml2js.Builder();
            const obj = {
                FlsAssDom_1: {
                    $: {"xmlns": "http://flussi.mds.it/flsassdom_1"},
                    Assistenza: out
                }
            };
            const xml = builder.buildObject(obj);
            fs.writeFileSync(folder + path.sep + codRegione + codASL + "_000_" + anno.toString() + "_" + trimestre.toString() + "_SIAD_AAD_al_" + moment().date() + "_" + ((moment().month() + 1) < 10 ? ("0" + (moment().month() + 1)) : (moment().month() + 1)) + "_" + moment().year() + ".xml", xml);
            return true;
        } else return false;

    }

    verificaPresenzaDiDatiMancanti(oggetto, id = null, ris = null, datoDaVerificare = "<OBB>") {
        if (!ris)
            ris = {ok: true, fullArray: oggetto, numeFile: id, errore: []};
        if (Array.isArray(oggetto)) {
            for (let dato of oggetto) {
                ris = this.verificaPresenzaDiDatiMancanti(dato, dato.Eventi.PresaInCarico.Id_Rec, ris);
            }
        } else {
            for (let chiave of Object.keys(oggetto)) {
                if (typeof oggetto[chiave] === "object")
                    ris = this.verificaPresenzaDiDatiMancanti(oggetto[chiave], id, ris);
                else if (oggetto[chiave] === datoDaVerificare) {
                    ris.ok = false;
                    ris.errore.push({chiave: chiave, valore: oggetto[chiave], id: id});
                }
            }
        }
        return ris;
    }

    generaFlussoRettificaCancellazione(pathFile, folderOut, codRegione, codASL) {
        const file = reader.readFile(pathFile);

        let data = [];

        const sheets = file.SheetNames;
        console.log(sheets);

        for (let i = 0; i < sheets.length; i++) {
            const temp = reader.utils.sheet_to_json(
                file.Sheets[file.SheetNames[i]]);
            temp.forEach((res) => {
                data.push(res);
            });
        }
        console.log(data[0]);

        let outData = {};
        for (let dato of data) {
            let annoPIC = dato["Anno Presa In Carico"];
            let annoUltimaErogazione = dato["Ultima Data Erogazione"].length > 2 ? dato["Ultima Data Erogazione"].substring(0, 4) : "0"
            let dataConclusione = dato["Data Conclusione"].length > 2 ? dato["Data Conclusione"] : "0"
            let mesePic = dato["Data  Presa In Carico"].length > 2 ? dato["Data  Presa In Carico"].substring(5, 7) : "0"
            if (mesePic.length === 1) mesePic = "0" + mesePic;
            //console.log(dato);
            let tempRiga = {
                Trasmissione: {$: {"tipo": "C"}},
                Assistito: {
                    DatiAnagrafici: {
                        CUNI: dato["Id Record"].substring(16, 32),
                        validitaCI: 0,
                        tipologiaCI: 0,
                        AnnoNascita: 1950,
                        Genere: 2,
                        Cittadinanza: "IT",
                        StatoCivile: 1,
                        Residenza: {
                            Regione: codRegione,
                            ASL: codASL,
                            Comune: "000000"
                        },
                    }
                },
                Conviventi: {
                    NucleoFamiliare: 0,
                    AssistenteNonFamiliare: 1,
                },
                Erogatore: {CodiceRegione: codRegione, CodiceASL: codASL},
                Eventi: {
                    PresaInCarico: {
                        $: {"data": dato["Data  Presa In Carico"], "soggettoRichiedente": 2},
                        Id_Rec: dato["Id Record"]
                    },
                    Valutazione: {
                        $: {"data": dato["Data  Presa In Carico"]},
                        Patologia: {
                            Prevalente: "715",
                            Concomitante: "437",
                        },
                        Autonomia: 2,
                        GradoMobilita: 2,
                        Disturbi: {
                            Cognitivi: 3,
                            Comportamentali: 1
                        },
                        SupportoSociale: 1,
                        RischioInfettivo: 2,
                        DrenaggioPosturale: 2,
                        OssigenoTerapia: 2,
                        Ventiloterapia: 2,
                        Tracheostomia: 2,
                        Alimentazione: {
                            Assistita: 2,
                            Enterale: 2,
                            Parenterale: 2
                        },
                        GestioneStomia: 2,
                        ElimiUrinariaIntestinale: 2,
                        AlterRitmoSonnoVeglia: 2,
                        IntEduTerapeutica: 2,
                        CuraUlcereCutanee12Grado: 2,
                        CuraUlcereCutanee34Grado: 2,
                        PrelieviVenosiNonOcc: 2,
                        ECG: 2,
                        Telemetria: 2,
                        TerSottocutIntraMuscInfus: 2,
                        GestioneCatetere: 2,
                        Trasfusioni: 2,
                        ControlloDolore: 2,
                        AssistStatoTerminaleOnc: 2,
                        AssistStatoTerminaleNonOnc: 2,
                        TrattamentiRiab: {
                            Neurologico: 2,
                            Ortopedico: 2,
                            DiMantenimento: 1
                        },
                        SupervisioneContinua: 2,
                        AssistenzaIADL: 1,
                        AssistenzaADL: 1,
                        SupportoCareGiver: 2
                    }
                }
            };
            if (annoUltimaErogazione === "0") {
                if (!outData.hasOwnProperty(annoPIC + "_" + mesePic))
                    outData[annoPIC + "_" + mesePic] = [];
                outData[annoPIC + "_" + mesePic].push(tempRiga);
            }
        }

        var builder = new xml2js.Builder();
        for (let chiave of Object.keys(outData)) {
            var obj = {FlsAssDom_1: {$: {"xmlns": "http://flussi.mds.it/flsassdom_1"}, Assistenza: outData[chiave]}}
            var xml = builder.buildObject(obj);
            fs.writeFileSync(folderOut + path.sep + codRegione + codASL + "_000_" + chiave.substring(0, 4) + "_" + chiave.substring(5, 7) + "_SIAD_AAD_al_" + moment().date() + "_" + ((moment().month() + 1) < 10 ? ("0" + (moment().month() + 1)) : (moment().month() + 1)) + "_" + moment().year() + ".xml", xml);
        }

        //console.log(xml);

    }

    creaOggettoAssistitiTracciato1(pathFile, filter = "AAD") {
        const parser = new xml2js.Parser({attrkey: "ATTR"});
        let dati = {};
        let files = utils.getAllFilesRecursive(pathFile, ".xml", filter);
        files.forEach(file => {
            let xml_string = fs.readFileSync(file, "utf8");
            parser.parseString(xml_string, function (error, result) {
                if (error === null) {
                    let assistenze = result['FlsAssDom_1']['Assistenza'];
                    console.log("sono presenti " + assistenze.length + " PIC");
                    for (var i = 0; i < assistenze.length; i++) {
                        let assistenza = assistenze[i];
                        let newObj = {};
                        newObj[tracciato1.CUNI] = assistenza['Assistito'][0]['DatiAnagrafici'][0]['CUNI'][0];
                        newObj[tracciato1.validitaCI] = assistenza['Assistito'][0]['DatiAnagrafici'][0]['validitaCI'][0];
                        newObj[tracciato1.tipologiaCI] = assistenza['Assistito'][0]['DatiAnagrafici'][0]['tipologiaCI'][0];
                        newObj[tracciato1.annoNascita] = assistenza['Assistito'][0]['DatiAnagrafici'][0]['AnnoNascita'][0];
                        newObj[tracciato1.genere] = assistenza['Assistito'][0]['DatiAnagrafici'][0]['Genere'][0];
                        newObj[tracciato1.cittadinanza] = assistenza['Assistito'][0]['DatiAnagrafici'][0]['Cittadinanza'][0];
                        newObj[tracciato1.statoCivile] = assistenza['Assistito'][0]['DatiAnagrafici'][0]['StatoCivile'][0];
                        newObj[tracciato1.responsabilitaGenitoriale] = assistenza.hasOwnProperty(assistenza['Assistito'][0]['DatiAnagrafici'][0]['ResponsabilitaGenitoriale']) ? assistenza['Assistito'][0]['DatiAnagrafici'][0]['ResponsabilitaGenitoriale'][0] : null;
                        newObj[tracciato1.residenzaRegione] = assistenza['Assistito'][0]['DatiAnagrafici'][0]['Residenza'][0]['Regione'][0];
                        newObj[tracciato1.residenzaASL] = assistenza['Assistito'][0]['DatiAnagrafici'][0]['Residenza'][0]['ASL'][0];
                        newObj[tracciato1.residenzaComune] = assistenza['Assistito'][0]['DatiAnagrafici'][0]['Residenza'][0]['Comune'][0];
                        newObj[tracciato1.nucleoFamiliare] = assistenza['Conviventi'][0]['NucleoFamiliare'][0];
                        newObj[tracciato1.assistenteNonFamiliare] = assistenza['Conviventi'][0]['AssistenteNonFamiliare'][0];
                        newObj[tracciato1.codiceRegione] = assistenza['Erogatore'][0]['CodiceRegione'][0];
                        newObj[tracciato1.codiceASL] = assistenza['Erogatore'][0]['CodiceASL'][0];
                        newObj[tracciato1.dataPresaInCarico] = assistenza['Eventi'][0]['PresaInCarico'][0]['ATTR']['data'];
                        newObj[tracciato1.soggetoRichiedente] = assistenza['Eventi'][0]['PresaInCarico'][0]['ATTR']['oggettoRichiedente'];
                        newObj[tracciato1.tipologiaPic] = assistenza['Eventi'][0]['PresaInCarico'][0]['ATTR']['TipologiaPIC'];
                        newObj[tracciato1.pianificazioneCondivisa] = assistenza['Eventi'][0]['PresaInCarico'][0]['ATTR']['PianificazioneCondivisa'];
                        newObj[tracciato1.idRecord] = assistenza['Eventi'][0]['PresaInCarico'][0]['Id_Rec'][0];
                        newObj[tracciato1.dataValutazione] = assistenza['Eventi'][0]['Valutazione'][0]['ATTR']['data'];
                        newObj[tracciato1.patologiaPrevalente] = assistenza['Eventi'][0]['Valutazione'][0]['Patologia'][0]['Prevalente'][0];
                        newObj[tracciato1.patologiaConcomitante] = assistenza['Eventi'][0]['Valutazione'][0]['Patologia'][0]['Concomitante'][0];
                        newObj[tracciato1.autonomia] = assistenza.hasOwnProperty(assistenza['Eventi'][0]['Valutazione'][0]['Autonomia']) ? assistenza['Eventi'][0]['Valutazione'][0]['Autonomia'][0] : null;
                        newObj[tracciato1.gradoMobilita] = assistenza.hasOwnProperty(assistenza['Eventi'][0]['Valutazione'][0]['GradoMobilita']) ? assistenza['Eventi'][0]['Valutazione'][0]['GradoMobilita'][0] : null;
                        newObj[tracciato1.disturbiCognitivi] = assistenza['Eventi'][0]['Valutazione'][0]['Disturbi'][0]['Cognitivi'][0];
                        newObj[tracciato1.disturbiComportamentali] = assistenza['Eventi'][0]['Valutazione'][0]['Disturbi'][0]['Comportamentali'][0];
                        newObj[tracciato1.supportoSociale] = assistenza['Eventi'][0]['Valutazione'][0]['SupportoSociale'][0];
                        newObj[tracciato1.fragilitaFamiliare] = assistenza['Eventi'][0]['Valutazione'][0]['FragilitaFamiliare'] ? assistenza['Eventi'][0]['Valutazione'][0]['FragilitaFamiliare'][0] : 2;
                        newObj[tracciato1.rischioInfettivo] = assistenza['Eventi'][0]['Valutazione'][0]['RischioInfettivo'][0];
                        newObj[tracciato1.rischioSanguinamento] = assistenza['Eventi'][0]['Valutazione'][0]['RischioSanguinamento'] ? assistenza['Eventi'][0]['Valutazione'][0]['RischioSanguinamento'][0] : 2;
                        newObj[tracciato1.drenaggioPosturale] = assistenza['Eventi'][0]['Valutazione'][0]['DrenaggioPosturale'][0];
                        newObj[tracciato1.ossigenoTerapia] = assistenza['Eventi'][0]['Valutazione'][0]['OssigenoTerapia'][0];
                        newObj[tracciato1.ventiloterapia] = assistenza['Eventi'][0]['Valutazione'][0]['Ventiloterapia'][0];
                        newObj[tracciato1.tracheostomia] = assistenza['Eventi'][0]['Valutazione'][0]['Tracheostomia'][0];
                        newObj[tracciato1.alimentazioneAssistita] = assistenza['Eventi'][0]['Valutazione'][0]['Alimentazione'][0]['Assistita'][0];
                        newObj[tracciato1.alimentazioneEnterale] = assistenza['Eventi'][0]['Valutazione'][0]['Alimentazione'][0]['Enterale'][0];
                        newObj[tracciato1.alimentazioneParenterale] = assistenza['Eventi'][0]['Valutazione'][0]['Alimentazione'][0]['Parenterale'][0];
                        newObj[tracciato1.gestioneStomia] = assistenza['Eventi'][0]['Valutazione'][0]['GestioneStomia'][0];
                        newObj[tracciato1.eliminazioneUrinariaIntestinale] = assistenza['Eventi'][0]['Valutazione'][0]['ElimiUrinariaIntestinale'][0];
                        newObj[tracciato1.alterazioneRitmoSonnoVeglia] = assistenza['Eventi'][0]['Valutazione'][0]['AlterRitmoSonnoVeglia'][0];
                        newObj[tracciato1.interventiEducativiTerapeutici] = assistenza['Eventi'][0]['Valutazione'][0]['IntEduTerapeutica'][0];
                        newObj[tracciato1.lesioniCutanee] = assistenza['Eventi'][0]['Valutazione'][0]['LesioniCute'] ? assistenza['Eventi'][0]['Valutazione'][0]['LesioniCute'][0] : 3;
                        newObj[tracciato1.curaUlcereCutanee12Grado] = assistenza['Eventi'][0]['Valutazione'][0]['CuraUlcereCutanee12Grado'][0];
                        newObj[tracciato1.curaUlcereCutanee34Grado] = assistenza['Eventi'][0]['Valutazione'][0]['CuraUlcereCutanee34Grado'][0];
                        newObj[tracciato1.prelieviVenosiNonOccasionali] = assistenza['Eventi'][0]['Valutazione'][0]['PrelieviVenosiNonOcc'][0];
                        newObj[tracciato1.ecg] = assistenza['Eventi'][0]['Valutazione'][0]['ECG'][0];
                        newObj[tracciato1.telemetria] = assistenza['Eventi'][0]['Valutazione'][0]['Telemetria'][0];
                        newObj[tracciato1.terSottocutIntraMuscInfus] = assistenza['Eventi'][0]['Valutazione'][0]['TerSottocutIntraMuscInfus'][0];
                        newObj[tracciato1.gestioneCatetere] = assistenza['Eventi'][0]['Valutazione'][0]['GestioneCatetere'][0];
                        newObj[tracciato1.trasfusioni] = assistenza['Eventi'][0]['Valutazione'][0]['Trasfusioni'][0];
                        newObj[tracciato1.controlloDolore] = assistenza['Eventi'][0]['Valutazione'][0]['ControlloDolore'][0];
                        newObj[tracciato1.curePalliative] = assistenza.hasOwnProperty(assistenza['Eventi'][0]['Valutazione'][0]['CurePalliative']) ? assistenza['Eventi'][0]['Valutazione'][0]['CurePalliative'][0] : null;
                        newObj[tracciato1.appartenenzaRete] = assistenza.hasOwnProperty(assistenza['Erogatore'][0]['AppartenenzaRete']) ? assistenza['Erogatore'][0]['AppartenenzaRete'][0] : null;
                        newObj[tracciato1.tipoRete] = assistenza.hasOwnProperty(assistenza['Erogatore'][0]['TipoRete']) ? assistenza['Erogatore'][0]['TipoRete'][0] : null;
                        newObj[tracciato1.pianificazioneCondivisa] = assistenza.hasOwnProperty(assistenza['Eventi'][0]['PresaInCarico'][0]['ATTR']['PianificazioneCondivisa']) ? assistenza['Eventi'][0]['PresaInCarico'][0]['ATTR']['PianificazioneCondivisa'] : null;
                        newObj[tracciato1.trattamentiRiabilitativiNeurologici] = assistenza['Eventi'][0]['Valutazione'][0]['TrattamentiRiab'][0]['Neurologico'][0];
                        newObj[tracciato1.trattamentiRiabilitativiOrtopedici] = assistenza['Eventi'][0]['Valutazione'][0]['TrattamentiRiab'][0]['Motorio'] ? assistenza['Eventi'][0]['Valutazione'][0]['TrattamentiRiab'][0]['Motorio'][0] : 2;
                        newObj[tracciato1.trattamentiRiabilitativiDiMantenimento] = assistenza['Eventi'][0]['Valutazione'][0]['TrattamentiRiab'][0]['DiMantenimento'][0];
                        newObj[tracciato1.segnoSintomoClinico] = assistenza.hasOwnProperty(assistenza['Eventi'][0]['Valutazione'][0]['valutazioneUCPDOM']) && assistenza.hasOwnProperty(assistenza['Eventi'][0]['Valutazione'][0]['valutazioneUCPDOM'][0]['SegnoSintomoClinico']) ? assistenza['Eventi'][0]['Valutazione'][0]['valutazioneUCPDOM'][0]['SegnoSintomoClinico'][0] : null;
                        newObj[tracciato1.utilStrumentoIdentBisognoCp] = assistenza.hasOwnProperty(assistenza['Eventi'][0]['Valutazione'][0]['valutazioneUCPDOM']) && assistenza.hasOwnProperty(assistenza['Eventi'][0]['Valutazione'][0]['valutazioneUCPDOM'][0]['UtilStrumentoIdentBisognoCP']) ? assistenza['Eventi'][0]['Valutazione'][0]['valutazioneUCPDOM'][0]['UtilStrumentoIdentBisognoCP'][0] : null;
                        newObj[tracciato1.utilStrumentoValMultidid] = assistenza.hasOwnProperty(assistenza['Eventi'][0]['Valutazione'][0]['valutazioneUCPDOM']) && assistenza.hasOwnProperty(assistenza['Eventi'][0]['Valutazione'][0]['valutazioneUCPDOM'][0]['UtilStrumentoValMultid']) ? assistenza['Eventi'][0]['Valutazione'][0]['valutazioneUCPDOM'][0]['UtilStrumentoValMultid'][0] : null;
                        newObj[tracciato1.supervisioneContinua] = assistenza['Eventi'][0]['Valutazione'][0]['SupervisioneContinua'][0];
                        newObj[tracciato1.assistenzaIADL] = assistenza['Eventi'][0]['Valutazione'][0]['AssistenzaIADL'][0];
                        newObj[tracciato1.assistenzaADL] = assistenza['Eventi'][0]['Valutazione'][0]['AssistenzaADL'][0];
                        newObj[tracciato1.supportoCareGiver] = assistenza['Eventi'][0]['Valutazione'][0]['SupportoCareGiver'][0];
                        dati[newObj[tracciato1.idRecord]] = newObj;
                    }
                }
            })
        });
        return dati;
    }

    async creaTracciatiDitta(pathTracciato1corrente, pathCartellaIn, pathChiaviValideAttive, pathDatiAnnoPrecedente, pathFilePicPortale, nomeFileTracciato1 = "tracciato1.xlsx", nomeFileTracciato2 = "tracciato2.xlsx", nomeFileMorti = "morti.xlsx", nomeFileVivi = "vivi.xlsx", nomeFileSostituti = "sostituti.xlsx", nomeColonnaCf = "cf", nomecolonnaCfSostituto = "cfOk", colonnaIdRecordChiaviValide = "Id Record", colonnaDataPresaInCaricoChiaviValide = "Data  Presa In Carico", colonnaConclusioneChiaviValide = "Data Conclusione") {
        let datiTracciato1AnnoCorrente = this.creaOggettoAssistitiTracciato1(pathTracciato1corrente);
        let datiAnnoPrecedente = this.creaOggettoAssistitiTracciato1(pathDatiAnnoPrecedente);
        let allChiaviValideAperte = {};
        if (fs.existsSync(pathChiaviValideAttive)) {
            let chiaviValide = await utils.getObjectFromFileExcel(pathChiaviValideAttive);
            for (let chiave of chiaviValide)
                if (typeof chiave[colonnaConclusioneChiaviValide] == "string" && chiave[colonnaConclusioneChiaviValide].includes("--"))
                    allChiaviValideAperte[chiave[colonnaIdRecordChiaviValide]] = chiave;
        }
        let tracciato1Originale = await utils.getObjectFromFileExcel(pathCartellaIn + path.sep + nomeFileTracciato1, 0, false);
        let tracciato2Originale = await utils.getObjectFromFileExcel(pathCartellaIn + path.sep + nomeFileTracciato2, 0, false);
        let picPortale = await utils.leggiOggettoDaFileJSON(pathFilePicPortale);
        let allPicPortaleByCf = {};
        for (let pic of picPortale[2]['data']) {
            if (!allPicPortaleByCf.hasOwnProperty(pic['cf']))
                allPicPortaleByCf[pic['cf']] = [pic];
            else
                allPicPortaleByCf[pic['cf']].push(pic);
        }
        let allFileVivi = utils.getAllFilesRecursive(pathCartellaIn, ".xlsx", nomeFileVivi);
        let allFileMorti = utils.getAllFilesRecursive(pathCartellaIn, ".xlsx", nomeFileMorti);
        let allFileSostituti = utils.getAllFilesRecursive(pathCartellaIn, ".xlsx", nomeFileSostituti);
        let allVivi = {};
        let allMorti = {};
        let allSostituti = {};
        for (let file of allFileVivi) {
            let allViviTemp = await utils.getObjectFromFileExcel(file);
            for (let vivo of allViviTemp) {
                if (!vivo.hasOwnProperty(nomeColonnaCf))
                    throw new Error("Errore in file " + file + " colonna " + nomeColonnaCf + " non presente");
                else
                    allVivi[vivo[nomeColonnaCf]] = vivo;
            }
        }
        for (let file of allFileMorti) {
            let allMortiTemp = await utils.getObjectFromFileExcel(file);
            for (let morto of allMortiTemp) {
                if (!morto.hasOwnProperty(nomeColonnaCf))
                    throw new Error("Errore in file " + file + " colonna " + nomeColonnaCf + " non presente");
                else
                    allMorti[morto[nomeColonnaCf]] = morto;
            }
        }
        for (let file of allFileSostituti) {
            let allSostitutiTemp = await utils.getObjectFromFileExcel(file);
            for (let sostituto of allSostitutiTemp) {
                if (!sostituto.hasOwnProperty(nomecolonnaCfSostituto.trim().replaceAll(" ", "")) || !sostituto.hasOwnProperty(nomeColonnaCf))
                    // error and break
                    throw new Error("Errore in file " + file + " colonna " + nomecolonnaCfSostituto + " o " + nomeColonnaCf + " non presenti");
                else
                    allSostituti[sostituto[nomeColonnaCf].trim().replaceAll(" ", "")] = sostituto[nomecolonnaCfSostituto].trim().replaceAll(" ", "");
            }
        }
        let outTracciato1 = [];
        let rigaHeaderTracciato1 = {}
        for (let i = 0; i < Object.keys(tracciato1Maggioli).length; i++)
            rigaHeaderTracciato1[i] = tracciato1Maggioli[i];
        outTracciato1.push(rigaHeaderTracciato1);
        let cfPreseInCarico = {};

        for (let rigaTracciato1 of tracciato1Originale) {
            if (rigaTracciato1[1] !== "") {
                let chiavi = Object.keys(datiTracciato1AnnoCorrente).filter(key => key.includes(rigaTracciato1[1]));
                let chiaviAnnoPrecedente = Object.keys(datiAnnoPrecedente).filter(key => key.includes(rigaTracciato1[1]));
                let chiaviValideAperte = Object.keys(allChiaviValideAperte).filter(key => key.includes(rigaTracciato1[1]));
                //if (chiavi.length > 0 || chiaviAnnoPrecedente.length > 0) {
                let rigaDatiT1 = (chiavi.length > 0 || chiaviAnnoPrecedente.length > 0) ? (chiavi.length > 0 ? datiTracciato1AnnoCorrente[chiavi[0]] : datiAnnoPrecedente[chiaviAnnoPrecedente[0]]) : {};
                let rigaT1 = {};

                console.log(rigaTracciato1[1])
                let codFiscale = allSostituti.hasOwnProperty(rigaTracciato1[1].trim().replaceAll(" ", "")) ? allSostituti[rigaTracciato1[1].trim().replaceAll(" ", "")] : rigaTracciato1[1].trim().replaceAll(" ", "");
                let dataNascita = allVivi.hasOwnProperty(codFiscale) ? moment(allVivi[codFiscale]['data_nascita'], "DD/MM/YYYY") : (allMorti.hasOwnProperty(codFiscale) ? moment(allMorti[codFiscale]['data_nascita'], "DD/MM/YYYY") : null);
                let annoNascita = dataNascita ? dataNascita.year() : Parser.cfToBirthYear(codFiscale);

                rigaT1[0] = ""; // tipo
                rigaT1[1] = codFiscale;
                rigaT1[2] = ""; // validita ci
                rigaT1[3] = ""; // tipologia ci
                rigaT1[4] = annoNascita
                rigaT1[5] = Parser.cfToGender(codFiscale) === "M" ? "1" : "2";
                rigaT1[6] = rigaDatiT1[tracciato1.cittadinanza] ?? "IT";
                rigaT1[7] = rigaDatiT1[tracciato1.statoCivile] ?? "9";
                rigaT1[8] = rigaDatiT1[tracciato1.residenzaRegione] ?? "190";
                rigaT1[9] = rigaDatiT1[tracciato1.residenzaASL] ?? "205";
                rigaT1[10] = rigaDatiT1[tracciato1.residenzaComune] ?? "083048";
                rigaT1[11] = rigaDatiT1[tracciato1.nucleoFamiliare] ?? "1";
                rigaT1[12] = rigaDatiT1[tracciato1.assistenteNonFamiliare] ?? "2";
                rigaT1[13] = rigaDatiT1[tracciato1.codiceRegione] ?? "190";
                rigaT1[14] = rigaDatiT1[tracciato1.codiceASL] ?? "205";
                let dataPresaInCaricoAster = moment(rigaTracciato1[15], "YYYY-MM-DD");
                rigaT1[15] = dataPresaInCaricoAster.isValid() ? dataPresaInCaricoAster.format("DD/MM/YYYY") : moment(rigaTracciato1[15]).format("DD/MM/YYYY");
                cfPreseInCarico[codFiscale] = rigaT1[15];
                rigaT1[16] = ""; // id record
                rigaT1[17] = rigaDatiT1[tracciato1.soggetoRichiedente] ?? "2";
                rigaT1[18] = rigaTracciato1[18].toString() ?? "1";
                rigaT1[19] = rigaDatiT1[tracciato1.dataValutazione] ? moment(rigaDatiT1[tracciato1.dataValutazione], "YYYY-MM-DD").format("DD/MM/YYYY") : moment(rigaTracciato1[15]).format("DD/MM/YYYY");
                rigaT1[20] = rigaDatiT1[tracciato1.disturbiCognitivi] ?? "1";
                rigaT1[21] = rigaDatiT1[tracciato1.disturbiComportamentali] ?? "1";
                rigaT1[22] = rigaDatiT1[tracciato1.supportoSociale] ?? "3";
                rigaT1[23] = rigaDatiT1[tracciato1.fragilitaFamiliare] ?? "9";
                rigaT1[24] = rigaDatiT1[tracciato1.rischioInfettivo] ?? "2";
                rigaT1[25] = rigaDatiT1[tracciato1.rischioSanguinamento] ?? "9";
                rigaT1[26] = rigaDatiT1[tracciato1.drenaggioPosturale] ?? "2";
                rigaT1[27] = rigaDatiT1[tracciato1.ossigenoTerapia] ?? "2";
                rigaT1[28] = rigaDatiT1[tracciato1.ventiloterapia] ?? "2";
                rigaT1[29] = rigaDatiT1[tracciato1.tracheostomia] ?? "2";
                rigaT1[30] = rigaDatiT1[tracciato1.alimentazioneAssistita] ?? "2";
                rigaT1[31] = rigaDatiT1[tracciato1.alimentazioneEnterale] ?? "2";
                rigaT1[32] = rigaDatiT1[tracciato1.alimentazioneParenterale] ?? "2";
                rigaT1[33] = rigaDatiT1[tracciato1.gestioneStomia] ?? "2";
                rigaT1[34] = rigaDatiT1[tracciato1.eliminazioneUrinariaIntestinale] ?? "2";
                rigaT1[35] = rigaDatiT1[tracciato1.alterazioneRitmoSonnoVeglia] ?? "2";
                rigaT1[36] = rigaDatiT1[tracciato1.interventiEducativiTerapeutici] ?? "2";
                rigaT1[37] = rigaDatiT1[tracciato1.lesioniCutanee] ?? "2";
                rigaT1[38] = rigaDatiT1[tracciato1.curaUlcereCutanee12Grado] ?? "2";
                rigaT1[39] = rigaDatiT1[tracciato1.curaUlcereCutanee34Grado] ?? "2";
                rigaT1[40] = rigaDatiT1[tracciato1.prelieviVenosiNonOccasionali] ?? "2";
                rigaT1[41] = rigaDatiT1[tracciato1.ecg] ?? "2";
                rigaT1[42] = rigaDatiT1[tracciato1.telemetria] ?? "2";
                rigaT1[43] = rigaDatiT1[tracciato1.terSottocutIntraMuscInfus] ?? "2";
                rigaT1[44] = rigaDatiT1[tracciato1.gestioneCatetere] ?? "2";
                rigaT1[45] = rigaDatiT1[tracciato1.trasfusioni] ?? "2";
                rigaT1[46] = rigaDatiT1[tracciato1.controlloDolore] ?? "2";
                rigaT1[47] = rigaDatiT1[tracciato1.trattamentiRiabilitativiNeurologici] ?? "3";
                rigaT1[48] = rigaDatiT1[tracciato1.trattamentiRiabilitativiOrtopedici] ?? "3";
                rigaT1[49] = rigaDatiT1[tracciato1.trattamentiRiabilitativiDiMantenimento] ?? "3";
                rigaT1[50] = rigaDatiT1[tracciato1.supervisioneContinua] ?? "3";
                rigaT1[51] = rigaDatiT1[tracciato1.assistenzaIADL] ?? "3";
                rigaT1[52] = rigaDatiT1[tracciato1.assistenzaADL] ?? "3";
                rigaT1[53] = rigaDatiT1[tracciato1.supportoCareGiver] ?? "3";
                rigaT1[54] = rigaDatiT1[tracciato1.patologiaPrevalente] ?? "";
                rigaT1[55] = rigaDatiT1[tracciato1.patologiaConcomitante] ?? "";
                if (chiaviValideAperte.length > 0) {
                    rigaT1[56] = chiaviValideAperte[0];
                    rigaT1[57] = moment(allChiaviValideAperte[chiaviValideAperte[0]][colonnaDataPresaInCaricoChiaviValide]).format("DD/MM/YYYY");
                } else {
                    rigaT1[56] = "";
                    rigaT1[57] = "";
                }
                let allPicCf = allPicPortaleByCf.hasOwnProperty(rigaTracciato1[1]) ? allPicPortaleByCf[rigaTracciato1[1]] : [];
                // filter by data inizio
                let allPicCfFiltered = allPicCf.filter(pic =>
                    moment(pic['inizio'], 'YYYY-MM-DD').isSameOrBefore(moment(rigaT1[15], 'DD/MM/YYYY'))
                );
                if (allPicCfFiltered.length > 0) {
                    rigaT1[58] = moment(allPicCfFiltered[0]['fine'], 'YYYY-MM-DD').format("DD/MM/YYYY");
                }
                outTracciato1.push(rigaT1);
            }
        }

        await utils.scriviOggettoSuNuovoFileExcel(pathCartellaIn + path.sep + "tracciato1_out.xlsx", outTracciato1, null, false);

        let outTracciato2 = [];
        let rigaHeaderTracciato2 = {}
        for (let i = 0; i < Object.keys(tracciato2Maggioli).length; i++)
            rigaHeaderTracciato2[i] = tracciato2Maggioli[i];
        outTracciato2.push(rigaHeaderTracciato2);

        for (let rigaTracciato2 of tracciato2Originale) {
            if (rigaTracciato2[0] !== "") {
                let rigaT2 = {}
                let codFiscale = allSostituti.hasOwnProperty(rigaTracciato2[0]) ? allSostituti[rigaTracciato2[0]] : rigaTracciato2[0];
                rigaT2[0] = codFiscale;
                rigaT2[1] = ""; // tipo
                rigaT2[2] = "190";
                rigaT2[3] = "205";
                rigaT2[4] = cfPreseInCarico.hasOwnProperty(codFiscale) ? cfPreseInCarico[codFiscale] : moment(rigaTracciato2[4], "DD/MM/YYYY").format("DD/MM/YYYY");
                rigaT2[5] = "";
                rigaT2[6] = rigaTracciato2[6].toString();
                rigaT2[7] = rigaT2[6] !== "" ? (rigaT2[6] !== "" ? rigaT2[6].toString() : "2") : "";
                rigaT2[8] = rigaT2[6] !== "" ? ("1") : "";
                rigaT2[9] = rigaTracciato2[9] !== "" ? rigaTracciato2[9].toString() : "1";
                rigaT2[10] = (typeof rigaTracciato2[10] === "string") ? rigaTracciato2[10].toString() : moment(rigaTracciato2[10]).format("DD/MM/YYYY");
                rigaT2[11] = rigaTracciato2[11].toString(); // tipo operatore
                rigaT2[12] = rigaTracciato2[12] !== "" ? rigaTracciato2[12].toString() : "99";
                rigaT2[13] = (typeof rigaTracciato2[13] === "string") ? rigaTracciato2[13].toString() : moment(rigaTracciato2[13]).format("DD/MM/YYYY");
                rigaT2[14] = rigaTracciato2[14].toString();
                rigaT2[15] = (typeof rigaTracciato2[15] === "string") ? rigaTracciato2[15].toString() : moment(rigaTracciato2[15]).format("DD/MM/YYYY");
                outTracciato2.push(rigaT2);
            }
        }

        await utils.scriviOggettoSuNuovoFileExcel(pathCartellaIn + path.sep + "tracciato2_out.xlsx", outTracciato2, null, false);
    }


    async sviluppaDatiADPDitta(pathCartellaIn, pathChiaviValideAttive, anno, numTrimestre, nomeFileTracciatoADP = "datiADP.xlsx", nomeFileMorti = "morti.xlsx", nomeFileVivi = "vivi.xlsx", nomeFileSostituti = "sostituti.xlsx", nomeColonnaCf = "cf", nomeColonnaAccessiAdp = "numAccessi", nomecolonnaCfSostituto = "cfOk", colonnaIdRecordChiaviValide = "Id Record", colonnaDataPresaInCaricoChiaviValide = "Data  Presa In Carico", colonnaConclusioneChiaviValide = "Data Conclusione") {
        // put int dataInizio the first day of the correct trimester
        let dataInizio = moment("01/01/" + anno, "DD/MM/YYYY").add(numTrimestre * 3 - 3, 'months');
        let dataFine = moment("31/12/" + anno, "DD/MM/YYYY");
        let allChiaviValideAperte = {};
        if (fs.existsSync(pathChiaviValideAttive)) {
            let chiaviValide = await utils.getObjectFromFileExcel(pathChiaviValideAttive);
            for (let chiave of chiaviValide)
                if (typeof chiave[colonnaConclusioneChiaviValide] == "string" && chiave[colonnaConclusioneChiaviValide].includes("--"))
                    allChiaviValideAperte[chiave[colonnaIdRecordChiaviValide]] = chiave;
        }
        let tracciatoADP = await utils.getObjectFromFileExcel(pathCartellaIn + path.sep + nomeFileTracciatoADP, 0, false);

        let allFileVivi = utils.getAllFilesRecursive(pathCartellaIn, ".xlsx", nomeFileVivi);
        let allFileMorti = utils.getAllFilesRecursive(pathCartellaIn, ".xlsx", nomeFileMorti);
        let allFileSostituti = utils.getAllFilesRecursive(pathCartellaIn, ".xlsx", nomeFileSostituti);
        let allVivi = {};
        let allMorti = {};
        let allSostituti = {};
        for (let file of allFileVivi) {
            let allViviTemp = await utils.getObjectFromFileExcel(file);
            for (let vivo of allViviTemp) {
                if (!vivo.hasOwnProperty(nomeColonnaCf))
                    throw new Error("Errore in file " + file + " colonna " + nomeColonnaCf + " non presente");
                else
                    allVivi[vivo[nomeColonnaCf]] = vivo;
            }
        }
        for (let file of allFileMorti) {
            let allMortiTemp = await utils.getObjectFromFileExcel(file);
            for (let morto of allMortiTemp) {
                if (!morto.hasOwnProperty(nomeColonnaCf))
                    throw new Error("Errore in file " + file + " colonna " + nomeColonnaCf + " non presente");
                else
                    allMorti[morto[nomeColonnaCf]] = morto;
            }
        }
        for (let file of allFileSostituti) {
            let allSostitutiTemp = await utils.getObjectFromFileExcel(file);
            for (let sostituto of allSostitutiTemp) {
                if (!sostituto.hasOwnProperty(nomecolonnaCfSostituto.trim().replaceAll(" ", "")) || !sostituto.hasOwnProperty(nomeColonnaCf))
                    // error and break
                    throw new Error("Errore in file " + file + " colonna " + nomecolonnaCfSostituto + " o " + nomeColonnaCf + " non presenti");
                else
                    allSostituti[sostituto[nomeColonnaCf].trim().replaceAll(" ", "")] = sostituto[nomecolonnaCfSostituto].trim().replaceAll(" ", "");
            }
        }
        let outTracciato1 = [];
        let rigaHeaderTracciato1 = {}
        for (let i = 0; i < Object.keys(tracciato1Maggioli).length; i++)
            rigaHeaderTracciato1[i] = tracciato1Maggioli[i];
        outTracciato1.push(rigaHeaderTracciato1);
        let allCf = {};

        for (let rigaAdp of tracciatoADP) {
            if (rigaAdp[1] !== "") {
                let chiaviValideAperte = Object.keys(allChiaviValideAperte).filter(key => key.includes(rigaAdp[0]));

                let codFiscale = allSostituti.hasOwnProperty(rigaAdp[0].trim().replaceAll(" ", "")) ? allSostituti[rigaAdp[0].trim().replaceAll(" ", "")] : rigaAdp[0].trim().replaceAll(" ", "");
                let dataDecesso = allMorti.hasOwnProperty(codFiscale) ? moment(allMorti[codFiscale]['data_decesso'], "DD/MM/YYYY") : null;
                let dataNascita = allVivi.hasOwnProperty(codFiscale) ? moment(allVivi[codFiscale]['data_nascita'], "DD/MM/YYYY") : (allMorti.hasOwnProperty(codFiscale) ? moment(allMorti[codFiscale]['data_nascita'], "DD/MM/YYYY") : null);
                let annoNascita = (dataNascita && dataNascita.isValid()) ? dataNascita.year() : Parser.cfToBirthYear(codFiscale);
                if (dataDecesso !== null)
                    console.log(dataDecesso.format("DD/MM/YYYY"))

                if (!allCf.hasOwnProperty(codFiscale) && (dataDecesso == null || dataDecesso.isSameOrAfter(dataInizio))) {
                    allCf[codFiscale] = rigaAdp[1];
                    let rigaT1 = {};
                    rigaT1[0] = ""; // tipo
                    rigaT1[1] = codFiscale;
                    rigaT1[2] = ""; // validita ci
                    rigaT1[3] = ""; // tipologia ci
                    rigaT1[4] = annoNascita;
                    rigaT1[5] = Parser.cfToGender(codFiscale) === "M" ? "1" : "2";
                    rigaT1[6] = codFiscale.substring(11, 12) !== "Z" ? "IT" : "XX";
                    rigaT1[7] = "9";
                    rigaT1[8] = "190";
                    rigaT1[9] = "205";
                    rigaT1[10] = "083048";
                    rigaT1[11] = "1";
                    rigaT1[12] = "2";
                    rigaT1[13] = "190";
                    rigaT1[14] = "205";
                    rigaT1[15] = dataInizio.format("DD/MM/YYYY");
                    rigaT1[16] = ""; // id record
                    rigaT1[17] = "2";
                    rigaT1[18] = "1";
                    rigaT1[19] = dataInizio.format("DD/MM/YYYY");
                    rigaT1[20] = "1";
                    rigaT1[21] = "1";
                    rigaT1[22] = "3";
                    rigaT1[23] = "9";
                    rigaT1[24] = "2";
                    rigaT1[25] = "9";
                    rigaT1[26] = "2";
                    rigaT1[27] = "2";
                    rigaT1[28] = "2";
                    rigaT1[29] = "2";
                    rigaT1[30] = "2";
                    rigaT1[31] = "2";
                    rigaT1[32] = "2";
                    rigaT1[33] = "2";
                    rigaT1[34] = "2";
                    rigaT1[35] = "2";
                    rigaT1[36] = "2";
                    rigaT1[37] = "2";
                    rigaT1[38] = "2";
                    rigaT1[39] = "2";
                    rigaT1[40] = "2";
                    rigaT1[41] = "2";
                    rigaT1[42] = "2";
                    rigaT1[43] = "2";
                    rigaT1[44] = "2";
                    rigaT1[45] = "2";
                    rigaT1[46] = "2";
                    rigaT1[47] = "3";
                    rigaT1[48] = "3";
                    rigaT1[49] = "3";
                    rigaT1[50] = "3";
                    rigaT1[51] = "3";
                    rigaT1[52] = "3";
                    rigaT1[53] = "3";
                    let patologie = [
                        "401", // ipertensione
                        "413", // angina
                        "427", // tachicardia
                        "715", // artrosi
                        "518", // insufficenza respiratoria
                        "493", // asma
                        "715", // osteortrite
                        "707", // ulcera da decubito
                    ]
                    // put random value of patologie
                    rigaT1[54] = patologie[Math.floor(Math.random() * patologie.length)];
                    rigaT1[55] = "";
                    if (chiaviValideAperte.length > 0) {
                        rigaT1[56] = chiaviValideAperte[0];
                        rigaT1[57] = moment(allChiaviValideAperte[chiaviValideAperte[0]][colonnaDataPresaInCaricoChiaviValide]).format("DD/MM/YYYY");
                    } else {
                        rigaT1[56] = "";
                        rigaT1[57] = "";
                    }
                    rigaT1[58] = allMorti.hasOwnProperty(codFiscale) ? allMorti[codFiscale]['data_decesso'] : "";

                    outTracciato1.push(rigaT1);
                }
            }
        }
        await utils.scriviOggettoSuNuovoFileExcel(pathCartellaIn + path.sep + "tracciato1_out.xlsx", outTracciato1, null, false);


        let outTracciato2 = [];
        let rigaHeaderTracciato2 = {}
        for (let i = 0; i < Object.keys(tracciato2Maggioli).length; i++)
            rigaHeaderTracciato2[i] = tracciato2Maggioli[i];
        outTracciato2.push(rigaHeaderTracciato2);

        let primiMesi = {
            1: 1,
            2: 4,
            3: 7,
            4: 10
        }
        let giorniBase = {
            4: [1, 7, 15, 20],
            2: [1, 15],
            1: [1]
        }

        let allCfKey = Object.keys(allCf);
        for (let k = 0; k < 3; k++)
            for (let codFiscale of allCfKey) {
                for (let i = 0; i < allCf[codFiscale]; i++) {
                    let giorniFrequenza = giorniBase[allCf[codFiscale]];
                    let giorno = giorniFrequenza[i] + Math.floor(Math.random() * 4) + 1;
                    giorno = giorno < 10 ? "0" + giorno : giorno;
                    let mese = (primiMesi[numTrimestre] + k);
                    mese = mese < 10 ? "0" + mese : mese;
                    let data = moment(giorno.toString() + "/" + mese + "/" + anno, "DD/MM/YYYY");
                    let dataDecesso = allMorti.hasOwnProperty(codFiscale) ? moment(allMorti[codFiscale]['data_decesso'], "DD/MM/YYYY") : null;
                    if (dataDecesso == null || dataDecesso.isAfter(data)) {
                        let rigaT2 = {}
                        rigaT2[0] = codFiscale;
                        rigaT2[1] = ""; // tipo
                        rigaT2[2] = "190";
                        rigaT2[3] = "205";
                        rigaT2[4] = dataInizio.format("DD/MM/YYYY");
                        rigaT2[5] = "";
                        rigaT2[6] = ""
                        rigaT2[7] = ""
                        rigaT2[8] = ""
                        rigaT2[9] = "1"
                        rigaT2[10] = data.format("DD/MM/YYYY")// data accesso
                        rigaT2[11] = "1" // tipo operatore
                        rigaT2[12] = "1"; // tipo prestazione
                        rigaT2[13] = ""; // data sospensione
                        rigaT2[14] = ""; //motivo sospensione
                        rigaT2[15] = "";
                        outTracciato2.push(rigaT2);
                    }
                }
            }

        await utils.scriviOggettoSuNuovoFileExcel(pathCartellaIn + path.sep + "tracciato2_out.xlsx", outTracciato2, null, false);


    }

    async verificaNuoviAssistitiDaChiaviValideFileExcel(annoInizioChiaviValide, annoFineChiavi, pathChiaviValide, pathDatiTracciatiExcel = null, annoFile = null, pathAltriCodiciFiscaliDaConsiderare = null, verificaSoloDatiEffettivamenteErogati = false, nomeColonnaAnnoPICMinistero = "Anno Presa In Carico", nomeClonnaIdRecordMinistero = "Id Record", nomeColonnaDataUltimaErogazione = "Ultima Data Erogazione\n", numColonnaCFFileExcelT1 = 1, numColonnaCFFileExcelT2 = 0) {
        let allAssistitiOver65 = {};
        let assistitiOver65PerAnnoTarget = {}
        let allAssistiti = {};
        let allAssistitiPerAnnoOver65 = {};
        let assistitiPerAnno = {};
        for (let anno = annoInizioChiaviValide; anno <= annoFineChiavi; anno++) {
            let allFileChiavi = utils.getAllFilesRecursive(pathChiaviValide, ".xlsx", anno.toString());
            for (let file of allFileChiavi) {
                let allChiaviValide = await utils.getObjectFromFileExcel(file);
                for (let riga of allChiaviValide) {
                    if (riga[nomeColonnaAnnoPICMinistero] >= annoInizioChiaviValide) {
                        let cfFromIdPic = riga[nomeClonnaIdRecordMinistero].substring(riga[nomeClonnaIdRecordMinistero].length - 16);
                        let annoNascita = Parser.cfToBirthYear(cfFromIdPic);
                        if (annoNascita > 2020) annoNascita -= 100;

                        if (Validator.codiceFiscale(cfFromIdPic).valid) {
                            if (!allAssistiti.hasOwnProperty(cfFromIdPic)) {
                                allAssistiti[cfFromIdPic] = 0;
                                if (!assistitiPerAnno.hasOwnProperty(riga[nomeColonnaAnnoPICMinistero]))
                                    assistitiPerAnno[riga[nomeColonnaAnnoPICMinistero]] = 1;
                                else
                                    assistitiPerAnno[riga[nomeColonnaAnnoPICMinistero]]++;
                            }
                            if (!(typeof riga[nomeColonnaDataUltimaErogazione] == "string" && riga[nomeColonnaDataUltimaErogazione].includes("--")) || !verificaSoloDatiEffettivamenteErogati)
                                allAssistiti[cfFromIdPic]++;

                            if ((anno - annoNascita) >= 65) {
                                if (!(typeof riga[nomeColonnaDataUltimaErogazione] == "string" && riga[nomeColonnaDataUltimaErogazione].includes("--")) || !verificaSoloDatiEffettivamenteErogati) {
                                    if (!allAssistitiOver65.hasOwnProperty(cfFromIdPic))
                                        allAssistitiOver65[cfFromIdPic] = 1;
                                    else
                                        allAssistitiOver65[cfFromIdPic]++;
                                    if (allAssistitiOver65[cfFromIdPic] === 1) {
                                        if (!assistitiOver65PerAnnoTarget.hasOwnProperty(riga[nomeColonnaAnnoPICMinistero]))
                                            assistitiOver65PerAnnoTarget[riga[nomeColonnaAnnoPICMinistero]] = 1;
                                        else
                                            assistitiOver65PerAnnoTarget[riga[nomeColonnaAnnoPICMinistero]]++;
                                    }
                                    // allAssistitiOver65
                                    if (!allAssistitiPerAnnoOver65.hasOwnProperty(riga[nomeColonnaAnnoPICMinistero]))
                                        allAssistitiPerAnnoOver65[riga[nomeColonnaAnnoPICMinistero]] = {};
                                    if (allAssistitiPerAnnoOver65[riga[nomeColonnaAnnoPICMinistero]].hasOwnProperty(cfFromIdPic)) {
                                        allAssistitiPerAnnoOver65[riga[nomeColonnaAnnoPICMinistero]][cfFromIdPic]++;
                                    } else
                                        allAssistitiPerAnnoOver65[riga[nomeColonnaAnnoPICMinistero]][cfFromIdPic] = 1;
                                }
                            }
                        }
                    }
                }
            }
        }
        if (pathDatiTracciatiExcel) {
            if (!assistitiOver65PerAnnoTarget.hasOwnProperty(annoFile.toString()))
                assistitiOver65PerAnnoTarget[annoFile.toString()] = 0;
            if (!assistitiPerAnno.hasOwnProperty(annoFile.toString()))
                assistitiPerAnno[annoFile.toString()] = 0;
            let allFilesTracciato1 = utils.getAllFilesRecursive(pathDatiTracciatiExcel, ".xlsx", "tracciato1");
            let nonTrovati = {};
            for (let filet1 of allFilesTracciato1) {
                let t2 = await utils.getObjectFromFileExcel(filet1.substring(0, filet1.length - 10) + "2" + filet1.substring(filet1.length - 9), null, false);
                let t1 = await utils.getObjectFromFileExcel(filet1, null, false);
                for (let riga of t1) {
                    let cf = riga[1];
                    let annoNascita = Parser.cfToBirthYear(cf);
                    if (annoNascita > 2020) annoNascita -= 100;
                    if (Validator.codiceFiscale(cf).valid) {
                        if (!allAssistiti.hasOwnProperty(cf)) {
                            allAssistiti[cf] = 0;
                            assistitiPerAnno[annoFile]++;
                        }
                        if ((annoFile - annoNascita) >= 65) {
                            if (!allAssistitiOver65.hasOwnProperty(cf)) {
                                allAssistitiOver65[cf] = 0;
                            }
                        }
                    }
                }
                for (let riga of t2) {
                    let cf = riga[0];
                    let annoNascita = Parser.cfToBirthYear(cf);
                    if (annoNascita > 2020) annoNascita -= 100;
                    if (allAssistiti.hasOwnProperty(cf) && riga[10] !== "") {
                        allAssistiti[cf]++;
                        if (allAssistiti[cf] === 1)
                            assistitiPerAnno[annoFile]++;
                        if ((annoFile - annoNascita) >= 65) {
                            allAssistitiOver65[cf]++;
                            if (allAssistitiOver65[cf] === 1)
                                assistitiOver65PerAnnoTarget[annoFile]++;
                        }
                    } else {
                        if (!nonTrovati.hasOwnProperty(cf))
                            nonTrovati[cf] = [{file: filet1, riga: riga}];
                        else
                            nonTrovati[cf].push({file: filet1, riga: riga});
                    }
                    if (!allAssistitiPerAnnoOver65.hasOwnProperty(annoFile))
                        allAssistitiPerAnnoOver65[annoFile] = {};
                    if ((annoFile - annoNascita) >= 65) {
                        if (allAssistitiPerAnnoOver65[annoFile].hasOwnProperty(cf))
                            allAssistitiPerAnnoOver65[annoFile][cf]++;
                        else
                            allAssistitiPerAnnoOver65[annoFile][cf] = 1;
                    }
                }
            }
        }
        console.log("ASSISTITI OVER 65 ANNI:")
        console.log("2024: " + Object.keys(allAssistitiPerAnnoOver65[2024]).length)
        console.log("FINE");
    }

    async validaFlussoSiad(pathFlusso, pathChiaviValide, colonnaIdRecord = "Id Record", tracciato1Filter = "AA2", tracciato2Filter = "AP2") {
        let allCfTracciato1 = {};
        let allCfTracciato1Over65 = {};
        let erroriTracciato1 = [];
        let allObjectT1 = this.creaOggettoAssistitiTracciato1(pathFlusso, tracciato1Filter);
        let allSostituti = {}
        let allSostitutiFile = utils.getAllFilesRecursive(pathFlusso, ".xlsx", "sostituti");
        for (let sostitutoFile of allSostitutiFile) {
            let sostituti = await utils.getObjectFromFileExcel(sostitutoFile);
            for (let sostituto of sostituti) {
                allSostituti[sostituto['cf']] = sostituto['cfOk'];
            }
        }
        let allAssistitiChiaviValide = {};
        let allAssistitiChiaviValideOver65 = {};
        let allChiaviValide = utils.getAllFilesRecursive(pathChiaviValide, ".xlsx");
        for (let fileChiaviValide of allChiaviValide) {
            let allChiaviValideTemp = await utils.getObjectFromFileExcel(fileChiaviValide);
            for (let chiave of allChiaviValideTemp) {
                let cfFromIdPic = chiave['Id Record'].substring(chiave[colonnaIdRecord].length - 16);
                let annoNascita = Parser.cfToBirthYear(cfFromIdPic);
                if (annoNascita > 2020) annoNascita -= 100;
                if (!allChiaviValide.hasOwnProperty(cfFromIdPic))
                    allAssistitiChiaviValide[cfFromIdPic] = 1;
                else
                    allAssistitiChiaviValide[cfFromIdPic]++;
                if ((moment().year() - annoNascita) >= 65) {
                    if (!allAssistitiChiaviValideOver65.hasOwnProperty(cfFromIdPic))
                        allAssistitiChiaviValideOver65[cfFromIdPic] = 1;
                    else
                        allAssistitiChiaviValideOver65[cfFromIdPic]++;
                }
            }
        }
        let nuoviAssistiti = {};
        let nuoviAssistitiOver65 = {};
        for (let key of Object.keys(allObjectT1)) {
            // if cf includes something that is different from letter and number add to erroriTracciato1
            let error = false;
            let cfAssistitoFromKey = key.substr(key.length - 16, key.length - 1)
            let cfAssistitoFromT1 = allObjectT1[key].CUNI;
            let sostituto = false;
            if (allSostituti.hasOwnProperty(cfAssistitoFromT1)) {
                cfAssistitoFromT1 = allSostituti[cfAssistitoFromT1];
                sostituto = true;
            }
            if (cfAssistitoFromT1 !== cfAssistitoFromKey && !sostituto) {
                erroriTracciato1.push({errore: "Codice fiscale diverso da key", row: allObjectT1[key]})
                error = true;
            }
            if (!sostituto) {
                let valid = /^[a-zA-Z0-9]*$/.test(cfAssistitoFromKey);
                if (!valid || !Validator.codiceFiscale(cfAssistitoFromKey).valid) {
                    erroriTracciato1.push({errore: "Codice fiscale non valido", row: allObjectT1[key]})
                    error = true;
                }
            } else {
                let valid = /^[a-zA-Z0-9]*$/.test(cfAssistitoFromT1);
                if (!valid || !Validator.codiceFiscale(cfAssistitoFromT1).valid) {
                    erroriTracciato1.push({errore: "Codice fiscale sostituto non valido", row: allObjectT1[key]})
                    error = true;
                }
            }
            if (!error) {
                allCfTracciato1[cfAssistitoFromT1] = null;
                if (!allAssistitiChiaviValide.hasOwnProperty(cfAssistitoFromT1))
                    nuoviAssistiti[cfAssistitoFromT1] = cfAssistitoFromT1;
                let annoNascita = allObjectT1[key].annoNascita;
                let eta = moment().year() - annoNascita;
                if (eta >= 65 && !allAssistitiChiaviValideOver65.hasOwnProperty(cfAssistitoFromT1))
                    nuoviAssistitiOver65[cfAssistitoFromT1] = cfAssistitoFromT1;
                if (eta >= 65)
                    allCfTracciato1Over65[cfAssistitoFromT1] = null;
            }
        }
        // write json of errors
        console.log("nuovi assistiti: " + Object.keys(nuoviAssistiti).length);
        console.log("nuovi assistiti over 65: " + Object.keys(nuoviAssistitiOver65).length);
        console.log("pic Tracciato 1: " + Object.keys(allCfTracciato1).length);
        console.log("pic over 65 Tracciato 1: " + Object.keys(allCfTracciato1Over65).length);
        await utils.scriviOggettoSuFile(pathFlusso + path.sep + "erroriCfTracciato1.json", erroriTracciato1);
        let ris = await Assistiti.verificaAssistitiParallels(this._impostazioniServizi, Object.keys(allCfTracciato1));
        await utils.scriviOggettoSuNuovoFileExcel(pathFlusso + path.sep + "morti.xlsx", ris.out.morti);
        await utils.scriviOggettoSuNuovoFileExcel(pathFlusso + path.sep + "vivi.xlsx", ris.out.vivi);
        await utils.scriviOggettoSuNuovoFileExcel(pathFlusso + path.sep + "nonTrovati.xlsx", ris.out.nonTrovati);
    }
}
