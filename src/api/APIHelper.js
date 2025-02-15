import moment from "moment";
import _ from "lodash";
import {Assistito} from "../classi/Assistito.js";

export default class APIHelper {
    static GET_TOKEN = "/api/v1/login/get-token";
    static NUOVI_ASSISTITI = "/api/v1/anagrafica/nuovi-assistiti";
    static RICERCA_ASSISTITO = "/api/v1/anagrafica/ricerca-assistito";

    #token = '';
    #tokenExpiration = null;

    /**
     * Crea una nuova istanza di APIHelper
     * @param {string} baseurl - L'URL base per le chiamate API
     * @param {Object} [loginData] - Dati di accesso per l'autenticazione
     * @param {string} [loginData.user=''] - Nome utente
     * @param {string} [loginData.password=''] - Password
     * @param {string} [loginData.scopi=''] - Scopi dell'autenticazione
     * @param {string} [loginData.ambito=''] - Ambito dell'autenticazione
     */
    constructor(baseurl, loginData = {user: '', password: '', scopi: '', ambito: ''}) {
        this.baseurl = baseurl;
        this.loginData = loginData;
    }


    /**
     * Ottiene un token di autenticazione dal server utilizzando le credenziali fornite
     * @returns {Promise<string>} Il token di autenticazione ottenuto
     * @throws {Error} Se la richiesta del token fallisce
     */
    async getToken() {
        const params = new URLSearchParams({
            login: this.loginData.user,
            password: this.loginData.password,
            scopi: this.loginData.scopi,
            ambito: this.loginData.ambito
        });
        const response = await fetch(`${this.baseurl}${APIHelper.GET_TOKEN}?${params}`, {
            method: 'POST',
            headers: {
                'accept': 'application/json'
            }
        });
        if (response.ok) {
            const data = await response.json();
            this.#token = data.data.token;
            this.#tokenExpiration = moment(data.data.expireDate, "YYYY-MM-DD HH:mm:ss");
            return data.data;
        } else {
            const res = await response.json();
            throw new Error("Errore nella richiesta del token: " + res.message);
        }
    }


    /**
     * Invia una richiesta per inserire nuovi assistiti nel sistema
     * @param {Object|Object[]} assistiti - Un singolo assistito o un array di assistiti da inserire
     * @returns {Promise<Object>} Risposta JSON dal server
     * @throws {Error} Se la richiesta fallisce dopo il tentativo di rinnovo del token
     */
    async nuoviAssistiti(assistiti) {
        if (!this.#token || !this.#tokenExpiration || moment().isAfter(this.#tokenExpiration))
            await this.getToken();
        if (!Array.isArray(assistiti))
            assistiti = [assistiti];
        let assistitiOk = [];
        for (let assistito of assistiti) {
            let temp = (new Assistito()).dati({fromAssistitoObject: assistito, dateToUnix: true});
            temp = _.omit(temp, ['eta', 'inVita']);
            assistitiOk.push(temp);
        }
        const response = await fetch(`${this.baseurl}${APIHelper.NUOVI_ASSISTITI}`, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Authorization': `Bearer ${this.#token}`
            },
            body: JSON.stringify({assistiti: assistitiOk})
        });
        if (response.status === 401) {
            await this.getToken();
            return await this.nuoviAssistiti(assistitiOk);
        } else {
            const res = await response.json();
            return res;
        }
    }

}
