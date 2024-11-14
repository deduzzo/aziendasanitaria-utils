/**
 * @typedef {Object} Config
 * @property {string} ts_username - Username for TS.
 * @property {string} ts_password - Password for TS.
 * @property {string} nar_username - Username for NAR.
 * @property {string} nar_password - Password for NAR.
 * @property {string} nar2_username - Username for NAR2.
 * @property {string} nar2_password - Password for NAR2.
 */

export class ImpostazioniServiziTerzi {

    /**
     * Creates an instance of ImpostazioniServiziTerzi.
     * @param {Config} config - Configurazione parametri servizi
     */
    constructor(config = {}) {
        this._ts_username = config.ts_username || "";
        this._ts_password = config.ts_password || "";
        this._nar_username = config.nar_username || "";
        this._nar_password = config.nar_password || "";
        this._nar2_username = config.nar2_username || "";
        this._nar2_password = config.nar2_password || "";
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

    get nar2_username() {
        return this._nar2_username;
    }

    set nar2_username(value) {
        this._nar2_username = value;
    }

    get nar2_password() {
        return this._nar2_password;
    }

    set nar2_password(value) {
        this._nar2_password = value;
    }

}