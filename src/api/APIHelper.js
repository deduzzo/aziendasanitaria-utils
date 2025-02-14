import moment from "moment";
import _ from "lodash";
import {Assistito} from "../classi/Assistito.js";

export default class APIHelper {
    static GET_TOKEN = "/api/v1/login/get-token";
    static NUOVO_ASSISTITO = "/api/v1/anagrafica/nuovo-assistito";
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
            throw new Error("Errore nella richiesta del token");
        }
    }

    async nuovoAssistito(assistito) {
        if (!this.#token || !this.#tokenExpiration || moment().isAfter(this.#tokenExpiration)) {
            await this.getToken();
            let temp = (new Assistito()).dati({fromAssistitoObject: assistito, dateToUnix: true, omitNull: true});
            temp = _.omit(temp, ['eta', 'inVita']);
            const response = await fetch(`${this.baseurl}${APIHelper.NUOVO_ASSISTITO}`, {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${this.#token}`
                },
                body: JSON.stringify({assistito: temp})
            });
            if (response.status === 401) {
                await this.getToken();
                return await this.nuovoAssistito(assistito);
            } else {
                return (await response.json());
            }
        }
    }


}
