export class ImpostazioniMail {
    /**
     * @param {String} host Host mail server
     * @param {Number} porta Porta server
     * @param {String} user Username mail server
     * @param {String} password Password mail server
     * @param {String} mittente Email mittente
     */
    constructor(host,porta,user,password,mittente) {
        this._host = host;
        this._porta = porta;
        this._password = password;
        this._mittente = mittente;
        this._user = user;
    }


    get host() {
        return this._host;
    }

    set host(value) {
        this._host = value;
    }

    get porta() {
        return this._porta;
    }

    set porta(value) {
        this._porta = value;
    }

    get user() {
        return this._user;
    }

    set user(value) {
        this._user = value;
    }

    get password() {
        return this._password;
    }

    set password(value) {
        this._password = value;
    }

    get mittente() {
        return this._mittente;
    }

    set mittente(value) {
        this._mittente = value;
    }
}