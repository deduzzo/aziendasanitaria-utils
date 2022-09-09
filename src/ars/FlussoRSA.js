import moment from 'moment';
import path  from 'path';
import readline from 'readline';
import md5File from 'md5-file';
import fs from 'fs';
import {common} from "../common.js";
import _ from 'lodash';
import MDBReader from "mdb-reader";
import {DatiStruttureProgettoTs} from "../m/DatiStruttureProgettoTs.js";
import ExcelJS from "exceljs"
import loki from 'lokijs';

export class FlussoRSA {
    /**
     * @param {ImpostazioniFlussoRSA} settings - Settings
     */
    constructor(settings, starts = this._startsFlussoRSAv1) {
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
        dataDimissione : {id: 25, length: 8, type: "int", required: true},
        tariffaRSA: {id: 26, length: 6, type: "double", required: true},
        tariffaACaricoUtente: {id: 27, length: 6, type: "double", required: true},
        quotaRiscossa: {id: 28, length: 8, type: "double", required: true},
    };


}
