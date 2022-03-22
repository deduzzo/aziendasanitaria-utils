export class ImpostazioniFlussoARSFAR {

    /**
     * @param {String} codiceAzienda Codice Azienda (es. "205" per Messina)
     * @param {String} codiceRegione Codice Regione (es. "190" per Sicilia)
     * @param {String} in_folder Path assoluto della cartella che contiene i flussi da analizzare
     * @param {String} out_folder Path assoluto della cartella in cui si salveranno i dati dell'elaborazione (ATTENZIONE: la cartella verrà cancellata se esiste)
     */
    constructor(codiceAzienda, codiceRegione, in_folder, out_folder) {
        this._codiceAzienda = codiceAzienda;
        this._codiceRegione = codiceRegione;
        this._in_folder = in_folder;
        this._out_folder = out_folder;
        this._extensions = ['.xml'];
        this._att = "eve";
        this._pic = "acc";
        this._stat_folder_name = ".stats";
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

    get extensions() {
        return this._extensions;
    }

    set extensions(value) {
        this._extensions = value;
    }

    get stat_folder_name() {
        return this._stat_folder_name;
    }

    set stat_folder_name(value) {
        this._stat_folder_name = value;
    }

    get att() {
        return this._att;
    }

    set att(value) {
        this._att = value;
    }

    get pic() {
        return this._pic;
    }

    set pic(value) {
        this._pic = value;
    }
}