import axios from "axios";

export class Nar2 {

    static LOGIN_URL = "https://nar2.regione.sicilia.it/services/index.php/api/login";
    static GET_ASSISTITO_NAR_FROM_ID = "https://nar2.regione.sicilia.it/services/index.php/api/pazienti/{id}";
    static GET_ASSISTITI_NAR = "https://nar2.regione.sicilia.it/services/index.php/api/pazienti";
    static GET_DATI_ASSISTITO_FROM_SOGEI = "https://nar2.regione.sicilia.it/services/index.php/api/sogei/ricercaAssistito";
    static GET_MEDICI = "https://nar2.regione.sicilia.it/services/index.php/api/searchMediciDatatable"
    static GET_DATI_MEDICO_FROM_ID = "https://nar2.regione.sicilia.it/services/index.php/api/medici/{id}";
    static GET_NUM_ASSISTITI_MEDICO = "https://nar2.regione.sicilia.it/services/index.php/api/medici/getNumAssistitiMedico/{id}"

    constructor(impostazioniServiziTerzi) {
        this._token = null;
        this._username = impostazioniServiziTerzi.nar2_username;
        this._password = impostazioniServiziTerzi.nar2_password;
        this._maxRetry = 10;
    }

    async getToken() {
        let out = null;
        let ok = false;
        for (let i = 0; i < this._maxRetry && !ok; i++) {
            try {
                out = await axios.post(Nar2.LOGIN_URL, {username: this._username, password: this._password});
                this._token = out.data.accessToken;
                ok = true;
            } catch (e) {
            }
        }
    }

    async getMedici() {
        let out = null;
        let ok = false;
        for (let i = 0; i < this._maxRetry && !ok; i++) {
            try {
                out = await axios.get(Nar2.GET_MEDICI, {
                    headers: {
                        Authorization: `Bearer ${this._token}`
                    },
                    // azienda=ME&tipo_rapporto=Medico_base&nome=&cognome=&dataNascitaA=null&dataNascitaDa=null&codiceFiscale=&aspOaltro=ASP&codiceRegionale=&categoriaMedico=null&asl=281&ambito=null&matricola=null&inizioConvenzione=null&fineConvenzione=null&esitoFineConvenzione=rapporto_disattivato&inizioRapporto=null&fineRapporto=null&inizioMassimale=null&fineMassimale=null&ambulatorio=null&formaAssociativa=null&sesso=null&comuneNascita=null&pIVA=null&pIVAComunitaria=null&comuneResidenza=null&stato=null&inizioInserimento=null&fineInserimento=null&intervalloVariazione=modificato&inizioVariazione=null&fineVariazione=null&rapportoAttivo=true&start=0
                    params: {
                        azienda: "ME",
                        tipo_rapporto: "Medico_base",
                        asl: 281,
                        esitoFineConvenzione: "rapporto_attivo",
                        rapportoAttivo: true,
                        start: 0
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

    async #getDataFromId(id,url) {
        // get, use Bearer token
        let out = null;
        let ok = false;
        for (let i = 0; i < this._maxRetry && !ok; i++) {
            try {
                out = await axios.get(url.replace("{id}", id.toString()), {
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

    async getAssistitoFromId(id) {
        return await this.#getDataFromId(id,Nar2.GET_ASSISTITO_NAR_FROM_ID);
    }

    async getMedicoFromId(id) {
        return await this.#getDataFromId(id,Nar2.GET_DATI_MEDICO_FROM_ID);
    }

    async getNumAssistitiMedico(id) {
        return await this.#getDataFromId(id,Nar2.GET_NUM_ASSISTITI_MEDICO);
    }

    async #getDataFromParams(url,params) {
        let out = null;
        let ok = false;
        for (let i = 0; i < this._maxRetry && !ok; i++) {
            try {
                out = await axios.get(url, {
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

    async getAssistitiFromParams(params) {
        // params in uri: codiceFiscale, nome, cognome, dataNascita
        return await this.#getDataFromParams(Nar2.GET_ASSISTITI_NAR,params);
    }

    async getDatiAssistitoFromCfSuSogei(cf) {
        // params in uri: codiceFiscale, nome, cognome, dataNascita
        let out = null;
        let ok = false;
        const nullArray = (data) => {
            // if data is an array, and is array, return null, else return data
            return Array.isArray(data) && data.length === 0 ? "" : data;
        };
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
                    const deceduto = out.data.data.p801descrizioneCodiceTipoAssistito.toLowerCase().includes("deceduto");
                    const asp = nullArray(out.data.data.p801codiceRegioneResidenzaAsl) + " - " + nullArray(out.data.data.p801descrizioneRegioneResidenzaAsl) + " " + nullArray(out.data.data.p801codiceAslResidenzaAsl) + " - " + nullArray(out.data.data.p801descrizioneAslResidenzaAsl).trim();
                    let data = {
                        vivo: !deceduto,
                        cf: nullArray(out.data.data.p801codiceFiscale),
                        cognome: nullArray(out.data.data.p801cognome),
                        nome: nullArray(out.data.data.p801nome),
                        sesso: nullArray(out.data.data.p801sesso),
                        data_nascita: nullArray(out.data.data.p801dataNascita),
                        comune_nascita: nullArray(out.data.data.p801comuneNascita),
                        indirizzo: nullArray(out.data.data.p801recapitoTessera),
                        asp: asp !== " -   - " ? asp : "",
                        mmgCfTs: nullArray(out.data.data.p801codiceFiscaleMedico),
                        mmgCognomeTs: nullArray(out.data.data.p801cognomeMedico),
                        mmgNomeTs: nullArray(out.data.data.p801nomeMedico),
                        mmgDaTs: nullArray(out.data.data.p801dataAssociazioneMedico),
                        tipoAssistitoSSN: nullArray(out.data.data.p801descrizioneCodiceTipoAssistito),
                        inizioAssistenzaSSN: nullArray(out.data.data.p801dataInizioValidita),
                        fineAssistenzaSSN: out.data.data.p801dataFineValidita === "31/12/9999" ? "illimitata" : nullArray(out.data.data.p801dataFineValidita),
                        motivazioneFineAssistenzaSSN: out.data.data.p801dataFineValidita !== "31/12/9999" ? nullArray(out.data.data.p801motivazioneFineValidita) : null,
                        numero_tessera: nullArray(out.data.data.p801numeroTessera),
                        dataDecesso: deceduto ? nullArray(out.data.data.p801dataDecesso) : null
                    }
                    out = { ok: true, fullData: out.data, data };
                }
            } catch (e) {
                await this.getToken();
            }
        }
        if (!ok)
            out = { ok: false, fullData: null, data: null };
        return out;
    }



}