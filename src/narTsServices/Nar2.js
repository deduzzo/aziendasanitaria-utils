import axios from "axios";
import {Assistito, DATI} from "../classi/Assistito.js";
import moment from "moment";
import _ from "lodash";
import CryptHelper from "../CryptHelper.js";

export class Nar2 {
    static LOGIN_URL = "https://nar2.regione.sicilia.it/services/index.php/api/login";
    static GET_ASSISTITO_NAR_FROM_ID = "https://nar2.regione.sicilia.it/services/index.php/api/pazienti/{id}";
    static GET_ASSISTITI_NAR = "https://nar2.regione.sicilia.it/services/index.php/api/pazienti";
    static GET_DATI_ASSISTITO_FROM_SOGEI = "https://nar2.regione.sicilia.it/services/index.php/api/sogei/ricercaAssistito";
    static GET_MEDICI = "https://nar2.regione.sicilia.it/services/index.php/api/searchMediciDatatable";
    static GET_DATI_MEDICO_FROM_ID = "https://nar2.regione.sicilia.it/services/index.php/api/medici/{id}";
    static GET_NUM_ASSISTITI_MEDICO = "https://nar2.regione.sicilia.it/services/index.php/api/medici/getNumAssistitiMedico/{id}";
    static GET_WS_FALLBACK_INTERNAL = "https://anagraficaconnector.asp.it1.robertodedomenico.it";

    static #token = null;
    static #tokenPromise = null; // Variabile per la chiamata in corso

    constructor(impostazioniServiziTerzi, crtyptData = {}) {
        this._username = impostazioniServiziTerzi.nar2_username;
        this._password = impostazioniServiziTerzi.nar2_password;
        this._maxRetry = 10;
        this._cryptData = (crtyptData.hasOwnProperty("KEY") && crtyptData.hasOwnProperty("IV"))
            ? crtyptData
            : null;
    }

    /**
     * Ottiene un token di autenticazione.
     *
     * Se una chiamata è già in corso, tutte le altre attendono il suo completamento.
     *
     * @param {Object} [config={}] - Opzioni di configurazione.
     * @param {boolean} [config.newToken=false] - Se true, forza l'ottenimento di un nuovo token.
     * @param {boolean} [config.fallback=false] - Se true, usa il server di fallback.
     * @returns {Promise<string>} - Il token di autenticazione.
     */
    async getToken(config = {}) {
        const {newToken = false, fallback = false} = config;
        // Se non richiediamo un nuovo token e uno è già presente, restituiscilo subito
        if (!newToken && Nar2.#token) {
            return Nar2.#token;
        }
        // Se c'è già una richiesta in corso, attendi il suo completamento
        if (Nar2.#tokenPromise) {
            return await Nar2.#tokenPromise;
        }
        // Altrimenti, crea una nuova promise per ottenere il token
        Nar2.#tokenPromise = (async () => {
            for (let i = 0; i < this._maxRetry; i++) {
                try {
                    if (!fallback) {
                        const out = await axios.post(Nar2.LOGIN_URL, {
                            username: this._username,
                            password: this._password
                        }, {
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });
                        Nar2.#token = out.data.accessToken;
                        return Nar2.#token;
                    } else {
                        const data = {username: this._username, password: this._password, type: "token"};
                        const cripted = CryptHelper.AESEncrypt(
                            JSON.stringify(data),
                            this._cryptData["KEY"],
                            CryptHelper.convertBase64StringToByte(this._cryptData["IV"])
                        );
                        const out = await axios.request({
                            method: "post",
                            url: Nar2.GET_WS_FALLBACK_INTERNAL,
                            data: {d: cripted},
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        });
                        if (out.status === 200 && out.data.error === false) {
                            Nar2.#token = out.data.token;
                            return Nar2.#token;
                        }
                    }
                } catch (e) {
                    console.log("Token non valido, attendo 1 secondo e riprovo");
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    if (i === this._maxRetry - 1) {
                        throw new Error("Errore durante l'ottenimento del token");
                    }
                }
            }
        })();
        try {
            const token = await Nar2.#tokenPromise;
            return token;
        } finally {
            // Resetta la promise in modo che le future chiamate possano eventualmente rinnovare il token
            Nar2.#tokenPromise = null;
        }
    }


    async getDatiAssistitoNar2FromCf(codiceFiscale, assistito = null, fallback = false) {
        // step1, get id assistito from codice fiscale
        if (!assistito)
            assistito = new Assistito();
        let datiAssistito = null;
        let datiIdAssistito;
        const retry = 3;
        for (let i = 0; i < retry; i++) {
            if (!fallback) {
                datiIdAssistito = await this.getAssistitiFromParams({codiceFiscale: codiceFiscale});
                if (datiIdAssistito.ok && datiIdAssistito.data && datiIdAssistito.data.length === 1)
                    datiAssistito = await this.getAssistitoFromId(datiIdAssistito.data[0].pz_id);
            } else {
                await this.getToken({fallback});
                const data = {cf: codiceFiscale, token: Nar2.#token, type: "nar2"};
                const cripted = CryptHelper.AESEncrypt(JSON.stringify(data), this._cryptData["KEY"], CryptHelper.convertBase64StringToByte(this._cryptData["IV"]));
                datiIdAssistito = await axios.request({
                    method: "post",
                    url: Nar2.GET_WS_FALLBACK_INTERNAL,
                    data: {d: cripted},
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });
                if (datiIdAssistito.status === 200 && datiIdAssistito.data.data.hasOwnProperty('nar2'))
                    datiAssistito = {ok: true, data: datiIdAssistito.data.data.nar2.result};
                else datiAssistito = {ok: false, data: datiIdAssistito.data};
            }
            if (datiAssistito && datiAssistito.ok) break;
                else console.log("Errore durante il recupero dei dati assistito da Nar2, tentativi rimanenti:" + (retry - i));
        }
        if (datiAssistito && datiAssistito.ok) {
            try {
                assistito.setNar2(DATI.CF, codiceFiscale.toUpperCase().trim());
                assistito.setNar2(DATI.CF_NORMALIZZATO, datiAssistito.data.pz_cfis);
            } catch (e) {
                console.log(e);
            }
            const comuneNascita = datiAssistito.data.comune_nascita ?? {};
            const comuneResidenza = datiAssistito.data.comune_residenza ?? {};
            const aslAppartenenza = datiAssistito.data.asl_appartenenza ?? {};
            const storicoMedici = datiAssistito.data.storico_medici?.[0]?.dett_pazientemedico ?? {};
            const medico = datiAssistito.data.medico ?? {};
            const rapportoIndividuale = datiAssistito.data.elementi_tabelle_paziente?.storico_medici?.[0]?.medico?.rapporto_individuale?.[0] ?? {};

            assistito.setNar2(DATI.COGNOME, datiAssistito.data.pz_cogn);
            assistito.setNar2(DATI.NOME, datiAssistito.data.pz_nome);
            assistito.setNar2(DATI.SESSO, datiAssistito.data.pz_sesso);
            assistito.setNar2(DATI.CAP_RESIDENZA, datiAssistito.data.pz_cap_res);
            assistito.setNar2(DATI.DATA_NASCITA, moment(datiAssistito.data.pz_dt_nas, "YYYY-MM-DD HH:mm:ss").format("DD/MM/YYYY"));
            assistito.setNar2(DATI.COMUNE_NASCITA, comuneNascita.cm_desc ?? null);
            assistito.setNar2(DATI.COD_COMUNE_NASCITA, comuneNascita.cm_cfis ?? null);
            assistito.setNar2(DATI.COD_ISTAT_COMUNE_NASCITA, comuneNascita.cm_cistat ?? null);
            assistito.setNar2(DATI.PROVINCIA_NASCITA, comuneNascita.provincia?.pr_id ?? null);
            assistito.setNar2(DATI.INDIRIZZO_RESIDENZA, datiAssistito.data.pz_ind_res ?? null);
            assistito.setNar2(DATI.COMUNE_RESIDENZA, comuneResidenza.cm_desc ?? null);
            assistito.setNar2(DATI.COD_COMUNE_RESIDENZA, comuneResidenza.cm_cfis ?? null);
            assistito.setNar2(DATI.COD_ISTAT_COMUNE_RESIDENZA, comuneResidenza.cm_cistat ?? null);
            assistito.setNar2(DATI.ASP, aslAppartenenza ? `${aslAppartenenza.az_codi} - ${aslAppartenenza.az_desc}` : null);
            assistito.setNar2(DATI.SSN_TIPO_ASSISTITO, datiAssistito.data?.categoria_cittadino?.eg_desc1 ?? null);
            assistito.setNar2(DATI.SSN_INIZIO_ASSISTENZA, datiAssistito.data.asl_assistenza?.az_dt_ins ? moment(datiAssistito.data.asl_assistenza.az_dt_ins, "YYYY-MM-DD HH:mm:ss").format("DD/MM/YYYY") : null);
            assistito.setNar2(DATI.SSN_FINE_ASSISTENZA, datiAssistito.data.asl_assistenza?.az_dt_disable ? moment(datiAssistito.data.asl_assistenza.az_dt_disable, "YYYY-MM-DD HH:mm:ss").format("DD/MM/YYYY") : null);
            assistito.setNar2(DATI.SSN_NUMERO_TESSERA, datiAssistito.data.pz_team_id ?? null);
            assistito.setNar2(DATI.MMG_ULTIMA_OPERAZIONE, storicoMedici.tipoop_scelta?.eg_desc1 ?? null);
            assistito.setNar2(DATI.MMG_ULTIMO_STATO, storicoMedici.posizione_ass?.eg_desc1 ?? null);
            assistito.setNar2(DATI.MMG_TIPO, rapportoIndividuale.categoria?.eg_cod ?? null);
            assistito.setNar2(DATI.MMG_COD_REG, rapportoIndividuale.dett_medico?.dm_creg ?? null);
            assistito.setNar2(DATI.MMG_NOME, medico.pf_nome ?? null);
            assistito.setNar2(DATI.MMG_COGNOME, medico.pf_cognome ?? null);
            assistito.setNar2(DATI.MMG_CF, medico.pf_cfis ?? null);
            assistito.setNar2(DATI.MMG_DATA_SCELTA, storicoMedici.dm_dt_ins ? moment(storicoMedici.dm_dt_ins, "YYYY-MM-DD HH:mm:ss").format("DD/MM/YYYY") : null);
            assistito.setNar2(DATI.MMG_DATA_REVOCA, storicoMedici.pm_dt_disable ? moment(storicoMedici.pm_dt_disable, "YYYY-MM-DD HH:mm:ss").format("DD/MM/YYYY") : null);
            assistito.setNar2(DATI.DATA_DECESSO, datiAssistito.data.pz_dt_dec ? moment(datiAssistito.data.pz_dt_dec, "YYYY-MM-DD HH:mm:ss").format("DD/MM/YYYY") : null);
            assistito.okNar2 = true;
            assistito.fullDataNar2 = datiAssistito.data;
            return {
                ok: true,
                data: assistito,
                fullData: datiAssistito
            };
        } else {
            assistito.erroreNar2 = "Nessun assistito trovato con il codice fiscale fornito";
            assistito.okNar2 = false;
            return {ok: false, data: null, fullData: datiIdAssistito};
        }
    }

    async #getDataFromUrlIdOrParams(url, urlId = null, params = null) {
        let out = {ok: false, data: null};
        let ok = false;

        for (let i = 0; i < this._maxRetry && !ok; i++) {
            try {
                await this.getToken();
                let response = null;
                if (urlId)
                    response = await axios.get(url.replace("{id}", urlId.toString()), {
                        headers: {
                            Authorization: `Bearer ${Nar2.#token}`,
                        },
                    });
                else
                    response = await axios.get(url, {
                        headers: {
                            Authorization: `Bearer ${Nar2.#token}`, // Usa token statico
                        },
                        params: params,
                    });

                if (!response?.data?.status || response.data.status.toString() !== "true" ||
                    response.data.status.toString().toLowerCase().includes("token is invalid")) {
                    await this.getToken({newToken: true});
                } else {
                    ok = true;
                    out = {ok: true, data: response.data.result};
                }
            } catch (e) {
                await this.getToken({newToken: true});
            }
        }

        return out;
    }

    async getAssistitoFromId(id) {
        return await this.#getDataFromUrlIdOrParams(Nar2.GET_ASSISTITO_NAR_FROM_ID, id);
    }

    async getMedicoFromId(id) {
        return await this.#getDataFromUrlIdOrParams(Nar2.GET_DATI_MEDICO_FROM_ID, id);
    }

    async getNumAssistitiMedico(id) {
        return await this.#getDataFromUrlIdOrParams(Nar2.GET_NUM_ASSISTITI_MEDICO, id);
    }

    async getAssistitiFromParams(params) {
        // params in uri: codiceFiscale, nome, cognome, dataNascita
        return await this.#getDataFromUrlIdOrParams(Nar2.GET_ASSISTITI_NAR, null, params);
    }

    /**
     * Ottiene i dati completi di un assistito dal codice fiscale.
     *
     * @param {string} cf Codice fiscale dell'assistito
     * @param {Object} [config={}] Opzioni di configurazione
     * @param {boolean} [config.dateToUnix=false] Converte date in formato Unix
     * @param {Assistito} [config.assistito] Oggetto Assistito da aggiornare
     * @param {boolean} [config.sogei=true] Recupera dati da Sogei
     * @param {boolean} [config.nar2=true] Recupera dati da Nar2
     * @param {boolean} [config.fallback=false] Recupera dati da server di fallback
     * @param {boolean} [config.replaceNullWithEmptyString=false] Sostituisce i valori null con stringhe vuote
     * @returns {Assistito} Oggetto Assistito aggiornato
     */
    async getDatiAssistitoCompleti(cf, config = {}) {
        let {
            dateToUnix = false,
            replaceNullWithEmptyString = false,
            assistito = new Assistito({dateToUnix, replaceNullWithEmptyString}),
            sogei = true,
            nar2 = true,
            fallback = false
        } = config;

        await this.getToken({fallback});
        if (sogei && nar2) {
            await Promise.all([
                this.getDatiAssistitoFromCfSuSogeiNew(cf, assistito, fallback),
                this.getDatiAssistitoNar2FromCf(cf, assistito, fallback)
            ]);
        } else {
            if (sogei) await this.getDatiAssistitoFromCfSuSogeiNew(cf, assistito, fallback);
            if (nar2) await this.getDatiAssistitoNar2FromCf(cf, assistito, fallback);
        }

        return assistito;
    }

    async getDatiAssistitoFromCfSuSogeiNew(cf, assistito = null, fallback = false) {
        let ok = false;
        const nullArray = (data) => {
            return Array.isArray(data) && data.length === 0 ? "" : data;
        };

        // Se non viene fornito un oggetto Assistito, ne creiamo uno nuovo
        if (!assistito) {
            assistito = new Assistito();
        }

        for (let i = 0; i < this._maxRetry && !ok; i++) {
            try {
                await this.getToken({fallback});
                let out = null;
                if (!fallback) {
                    out = await axios.post(Nar2.GET_DATI_ASSISTITO_FROM_SOGEI, {
                        codiceFiscale: cf,
                    }, {
                        headers: {
                            Authorization: `Bearer ${Nar2.#token}`, // Usa token statico
                            'Content-Type': 'application/json'
                        }
                    });
                } else {
                    const data = {cf: cf, token: Nar2.#token, type: "sogei"};
                    const cripted = CryptHelper.AESEncrypt(JSON.stringify(data), this._cryptData["KEY"], CryptHelper.convertBase64StringToByte(this._cryptData["IV"]));
                    //out = await axios.post(Nar2.GET_WS_FALLBACK_INTERNAL, { "d": cripted }, {);
                    out = await axios.request({
                        method: "post",
                        url: Nar2.GET_WS_FALLBACK_INTERNAL,
                        data: {d: cripted},
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    })
                    out.data = {status: out.data.data.sogei.status || false, data: out.data.data.sogei.data};
                }

                if (!out.data || out.data === undefined || (fallback && out.data.status.toString().toLowerCase().includes("token is invalid")))
                    await this.getToken({newToken: true, fallback});
                else if (out.data.status.toString() !== "true" && out.data.listaMessaggi.p801descrizioneMessaggio.includes("errato")) {
                    assistito.okTs = false;
                    assistito.erroreTs = out.data.listaMessaggi.p801descrizioneMessaggio;
                    return {
                        ok: true,
                        fullData: out.data,
                        data: assistito
                    };
                } else {
                    ok = true;
                    const deceduto = out.data.data.p801descrizioneCodiceTipoAssistito.toLowerCase().includes("deceduto");
                    const asp = nullArray(out.data.data.p801codiceRegioneResidenzaAsl) + " - " +
                        nullArray(out.data.data.p801descrizioneRegioneResidenzaAsl) + " " +
                        nullArray(out.data.data.p801codiceAslResidenzaAsl) + " - " +
                        nullArray(out.data.data.p801descrizioneAslResidenzaAsl).trim();

                    // Popoliamo i dati in fromTs usando i setter
                    assistito.setTs(DATI.CF, cf.toUpperCase().trim());
                    assistito.setTs(DATI.CF_NORMALIZZATO, nullArray(out.data.data.p801codiceFiscale));
                    assistito.setTs(DATI.COGNOME, nullArray(out.data.data.p801cognome));
                    assistito.setTs(DATI.NOME, nullArray(out.data.data.p801nome));
                    assistito.setTs(DATI.SESSO, nullArray(out.data.data.p801sesso));
                    assistito.setTs(DATI.DATA_NASCITA, nullArray(out.data.data.p801dataNascita));
                    assistito.setTs(DATI.COMUNE_NASCITA, nullArray(out.data.data.p801comuneNascita));
                    assistito.setTs(DATI.COD_COMUNE_NASCITA, nullArray(out.data.data.p801codiceComuneNascita));
                    assistito.setTs(DATI.COD_ISTAT_COMUNE_NASCITA, nullArray(out.data.data.p801codiceistatiComuneNascita));
                    assistito.setTs(DATI.INDIRIZZO_RESIDENZA, nullArray(out.data.data.p801recapitoTessera));
                    assistito.setTs(DATI.COD_COMUNE_RESIDENZA, nullArray(out.data.data.p801codiceComuneResidenza));
                    assistito.setTs(DATI.COD_ISTAT_COMUNE_RESIDENZA, nullArray(out.data.data.p801codiceistatiComuneResidenza));
                    assistito.setTs(DATI.ASP, asp !== " -   - " ? asp : "");
                    assistito.setTs(DATI.MMG_CF, nullArray(out.data.data.p801codiceFiscaleMedico));
                    assistito.setTs(DATI.MMG_COGNOME, nullArray(out.data.data.p801cognomeMedico));
                    assistito.setTs(DATI.MMG_NOME, nullArray(out.data.data.p801nomeMedico));
                    assistito.setTs(DATI.MMG_DATA_SCELTA, nullArray(out.data.data.p801dataAssociazioneMedico));
                    assistito.setTs(DATI.SSN_TIPO_ASSISTITO, nullArray(out.data.data.p801descrizioneCodiceTipoAssistito));
                    assistito.setTs(DATI.SSN_INIZIO_ASSISTENZA, nullArray(out.data.data.p801dataInizioValidita));
                    assistito.setTs(DATI.SSN_FINE_ASSISTENZA, out.data.data.p801dataFineValidita === "31/12/9999" ? "illimitata" : nullArray(out.data.data.p801dataFineValidita));
                    assistito.setTs(DATI.SSN_MOTIVAZIONE_FINE_ASSISTENZA, out.data.data.p801dataFineValidita !== "31/12/9999" ? nullArray(out.data.data.p801motivazioneFineValidita) : null);
                    assistito.setTs(DATI.SSN_NUMERO_TESSERA, nullArray(out.data.data.p801numeroTessera));
                    assistito.setTs(DATI.DATA_DECESSO, deceduto ? nullArray(out.data.data.p801dataDecesso) : null);
                    assistito.okTs = true;
                    assistito.fullDataTs = out.data;
                    out = {
                        ok: true,
                        fullData: out.data,
                        data: assistito
                    };
                }
            } catch (e) {
                await this.getToken({fallback});
            }
        }
        if (!ok)
            return {
                ok: false,
                fullData: null,
                data: assistito
            };
    }


}
