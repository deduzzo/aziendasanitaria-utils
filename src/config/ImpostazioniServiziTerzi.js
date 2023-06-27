export class ImpostazioniServiziTerzi {

    /**

     */
    constructor() {
        this._ts_username = ""
        this._ts_password = ""
        this._nar_username = "";
        this._nar_password = "";
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

    get nar_username() {
        return this._nar_username;
    }

    set nar_username(value) {
        this._nar_username = value;
    }

    get nar_password() {
        return this._nar_password;
    }

    set nar_password(value) {
        this._nar_password = value;
    }

}