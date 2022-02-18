import {struttureDistrettiMap, distretti, comuniDistretti} from './struttureDistrettiDB.js';

export class Settings {
    constructor(codiceAzienda, codiceRegione, in_folder, out_folder, flowlookDBFilePath) {
        this._extensions = ['.txt'];
        this._ts_username = ""
        this._ts_password = ""
        this._in_folder = "d:\\Dati\\Desktop\\prova";
        this._out_folder = "d:\\Dati\\Desktop\\outFolder";
        this._stat_folder_name = ".stats";
        this._flowlookDBFilePath = "C:\\Program Files (x86)\\FlowLook\\FlowLook.mdb";
        this._flowlookDBTable = "tSTS11";
        this._codiceRegione = "190";
        this._codiceAzienda = "205";
        this._distretti = distretti;
        this._struttureDistrettiMap = struttureDistrettiMap;
        this._comuniDistretti= comuniDistretti;
    }

    get extensions() {
        return this._extensions;
    }

    set extensions(value) {
        this._extensions = value;
    }

    get ts_username() {
        return this._ts_username;
    }

    set ts_username(value) {
        this._ts_username = value;
    }

    get ts_password() {
        return this._ts_password;
    }

    set ts_password(value) {
        this._ts_password = value;
    }

    get in_folder() {
        return this._in_folder;
    }

    set in_folder(value) {
        this._in_folder = value;
    }

    get out_folder() {
        return this._out_folder;
    }

    set out_folder(value) {
        this._out_folder = value;
    }

    get stat_folder_name() {
        return this._stat_folder_name;
    }

    set stat_folder_name(value) {
        this._stat_folder_name = value;
    }

    get flowlookDBFilePath() {
        return this._flowlookDBFilePath;
    }

    set flowlookDBFilePath(value) {
        this._flowlookDBFilePath = value;
    }

    get flowlookDBTable() {
        return this._flowlookDBTable;
    }

    set flowlookDBTable(value) {
        this._flowlookDBTable = value;
    }

    get codiceRegione() {
        return this._codiceRegione;
    }

    set codiceRegione(value) {
        this._codiceRegione = value;
    }

    get codiceAzienda() {
        return this._codiceAzienda;
    }

    set codiceAzienda(value) {
        this._codiceAzienda = value;
    }

    get distretti() {
        return this._distretti;
    }

    set distretti(value) {
        this._distretti = value;
    }

    get struttureDistrettiMap() {
        return this._struttureDistrettiMap;
    }

    set struttureDistrettiMap(value) {
        this._struttureDistrettiMap = value;
    }

    get comuniDistretti() {
        return this._comuniDistretti;
    }

    set comuniDistretti(value) {
        this._comuniDistretti = value;
    }
}