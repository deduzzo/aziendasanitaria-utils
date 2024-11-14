import axios from "axios";

export class Nar2 {

    static LOGIN_URL = "https://nar2.regione.sicilia.it/services/index.php/api/login";
    static GET_ASSISTITO_NAR_FROM_ID = "https://nar2.regione.sicilia.it/services/index.php/api/pazienti/{id}";
    static GET_ASSISTITI_NAR = "https://nar2.regione.sicilia.it/services/index.php/api/pazienti";
    static GET_DATI_ASSISTITO_FROM_SOGEI = "https://nar2.regione.sicilia.it/services/index.php/api/sogei/ricercaAssistito";

    constructor(impostazioniServiziTerzi) {
        this._token = null;
        this._username = impostazioniServiziTerzi.nar2_username;
        this._password = impostazioniServiziTerzi.nar2_password;
        this._maxRetry = 5;
    }

    async getToken() {
        let out = null;
        try {
            out = await axios.post(Nar2.LOGIN_URL, {username: this._username, password: this._password});
            this._token = out.data.accessToken;
        }
        catch (e) {
            console.log(e);
        }
    }

    async getDatiAssistitoFromCf(codiceFiscale) {
        // step1, get id assistito from codice fiscale
        let assistito = await this.getAssistitiFromParams({codiceFiscale: codiceFiscale});
        if (assistito.ok  && assistito.data.length === 1)
        {
            let datiAssistito = await this.getAssistitoFromId(assistito.data[0].pz_id);
            if (datiAssistito.ok)
                return {ok: true, data: datiAssistito.data};
        }
        return {ok: false, data: null};
    }

    async getAssistitoFromId(id) {
        // get, use Bearer token
        let out = null;
        let ok = false;
        for (let i = 0; i < this._maxRetry && !ok; i++) {
            try {
                out = await axios.get(Nar2.GET_ASSISTITO_NAR_FROM_ID.replace("{id}", id.toString()), {
                    headers: {
                        Authorization: `Bearer ${this._token}`
                    }
                });
                if (out.data.status.toString() !== "true" && out.data.status.toLowerCase().includes("token is invalid"))
                    await this.getToken();
                else {
                    ok = true;
                    out = { ok: true, data: out.data.result };
                }
            } catch (e) {
                console.log(e);
                out = { ok: false, data: null };
            }
        }
        return out;
    }

    async getAssistitiFromParams(params) {
        // params in uri: codiceFiscale, nome, cognome, dataNascita
        let out = null;
        let ok = false;
        for (let i = 0; i < this._maxRetry && !ok; i++) {
            try {
                out = await axios.get(Nar2.GET_ASSISTITI_NAR, {
                    headers: {
                        Authorization: `Bearer ${this._token}`
                    },
                    params: params
                });
                if (out.data.status.toString() !== "true" && out.data.status.toLowerCase().includes("token is invalid"))
                    await this.getToken();
                else {
                    ok = true;
                    out = { ok: true, data: out.data.result };
                }
            } catch (e) {
                console.log(e);
                out = { ok: false, data: null };
            }
        }
        return out;
    }

    async getDatiAssistitoFromCfSuSogei(cf) {
        // params in uri: codiceFiscale, nome, cognome, dataNascita
        let out = null;
        let ok = false;
        for (let i = 0; i < this._maxRetry && !ok; i++) {
            if (this._token === null)
                await this.getToken();
            try {
                out = await axios.post(Nar2.GET_DATI_ASSISTITO_FROM_SOGEI, {
                    // Payload JSON da inviare
                    codiceFiscale: cf,
                }, {
                    headers: {
                        Authorization: `Bearer ${this._token}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (out.data.status.toString() !== "true" && out.data.status.toLowerCase().includes("token is invalid"))
                    await this.getToken();
                else {
                    ok = true;
                    out = { ok: true, fullData: out.data, deceduto: out.data.data.p801descrizioneCodiceTipoAssistito.toLowerCase().includes("deceduto"), dataDecesso: out.data.data.p801descrizioneCodiceTipoAssistito.toLowerCase().includes("deceduto") ? out.data.data.p801dataDecesso : null };
                }
            } catch (e) {
                console.log(e);
                await this.getToken();
                out = { ok: false, data: null };
            }
        }
        return out;
    }



}