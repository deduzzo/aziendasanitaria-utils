export class ImpostazioniFlussoM {

    /**
     * @param {String} codiceAzienda Codice Azienda (es. "205" per Messina)
     * @param {String} codiceRegione Codice Regione (es. "190" per Sicilia)
     * @param {String} in_folder Path assoluto della cartella che contiene i flussi da analizzare
     * @param {String} out_folder Path assoluto della cartella in cui si salveranno i dati dell'elaborazione (ATTENZIONE: la cartella verrà cancellata se esiste)
     * @param {String} flowlookDBFilePath Path assoluto del file Flowlook.mdb
     * @param {StruttureDistrettiPerProvincia} datiStruttureRegione Istanza della classe ImpostazioneFlusso
     * @param {ImpostazioniMail} impostazioniMail Impostazioni mail
     */
    constructor(codiceAzienda, codiceRegione, in_folder, out_folder, flowlookDBFilePath, datiStruttureRegione, impostazioniMail) {
        this._codiceAzienda = codiceAzienda;
        this._codiceRegione = codiceRegione;
        this._in_folder = in_folder;
        this._out_folder = out_folder;
        this._flowlookDBFilePath = flowlookDBFilePath;
        this._datiStruttureRegione = datiStruttureRegione;
        this._impostazioniMail = impostazioniMail;

        this._extensions = ['.txt'];
        this._ts_username = ""
        this._ts_password = ""
        this._stat_folder_name = ".stats";
        this._flowlookDBTable = "tSTS11";
    }


    get codiceAzienda() {
        return this._codiceAzienda;
    }

    set codiceAzienda(value) {
        this._codiceAzienda = value;
    }

    get codiceRegione() {
        return this._codiceRegione;
    }

    set codiceRegione(value) {
        this._codiceRegione = value;
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

    get flowlookDBFilePath() {
        return this._flowlookDBFilePath;
    }

    set flowlookDBFilePath(value) {
        this._flowlookDBFilePath = value;
    }

    get datiStruttureRegione() {
        return this._datiStruttureRegione;
    }

    set datiStruttureRegione(value) {
        this._datiStruttureRegione = value;
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

    get stat_folder_name() {
        return this._stat_folder_name;
    }

    set stat_folder_name(value) {
        this._stat_folder_name = value;
    }

    get flowlookDBTable() {
        return this._flowlookDBTable;
    }

    set flowlookDBTable(value) {
        this._flowlookDBTable = value;
    }

    get impostazioniMail() {
        return this._impostazioniMail;
    }

    set impostazioniMail(value) {
        this._impostazioniMail = value;
    }
}