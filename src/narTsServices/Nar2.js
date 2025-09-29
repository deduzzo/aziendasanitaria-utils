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
    static GET_AMBITI_DOMICILIO = "https://nar2.regione.sicilia.it/services/index.php/api/ambitoDomTable";
    static GET_MEDICI_BY_AMBITO = "https://nar2.regione.sicilia.it/services/index.php/api/mediciByAmbitoTable";
    static GET_DATI_MEDICO_FROM_ID = "https://nar2.regione.sicilia.it/services/index.php/api/medici/{id}";
    static GET_NUM_ASSISTITI_MEDICO = "https://nar2.regione.sicilia.it/services/index.php/api/medici/getNumAssistitiMedico/{id}";
    static GET_WS_FALLBACK_INTERNAL = "https://anagraficaconnector.asp.it1.robertodedomenico.it";
    static GET_DATI_PAZIENTEMEDICO = "https://nar2.regione.sicilia.it/services/index.php/api/PazienteMedico/{id}/NaN/{az_id}/{tipo_medico}/null"
    static AGGIORNA_CAMBIO_MEDICO = "https://nar2.regione.sicilia.it/services/index.php/api/pazienti/aggiornaSceltaMedico/{id_cambio_medico}"
    static MEDICO_DI_BASE = "M";
    static PEDIATRA = "P";

    static CAT_PEDIATRI = "90000000046";
    static CAT_MMG = "90000000045";
    static TIPO_AMBITI = "90000000038";

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


    async aggiornaCambioMedico() {
/*        {
            "data": {
            "pm_paz": 1150422,
                "pm_fstato": "A",
                "pm_medico": 13971,
                "pm_dt_scad": null,
                "pm_dt_enable": "2025-03-20",
                "pm_mot_scelta": "90000000025"
        },
            "dett_pazientemedico": {
            "dm_ambito_dom": "140",
                "dm_situazione_ass": "6",
                "dm_eta_scelta": 89,
                "dm_ambito_scelta": "140",
                "dm_motivo_scelta": "90000000025",
                "dm_tipoop_scelta": "39100000036",
                "dm_dt_fine_proroga_ped": null,
                "dm_motivo_pror_scad_ped": null
        },
            "revoca": {
            "pm_dt_disable": "2025-08-17",
                "dm_dt_ins_revoca": "2025-09-08",
                "dm_motivo_revoca": "90000000029",
                "dm_tipoop_revoca": "39100000038",
                "revoca_id": 15182808
        }
        }*/
    }

    async getSituazioniAssistenziali(codFiscaleAssistito) {
        try {
            let dati = await this.getDatiAssistitoNar2FromCf(codFiscaleAssistito);
            const paziente_id = dati.fullData.data.pz_id;
            const tipoMed = "M";
            const az_id = dati.fullData.data.comune_domicilio._azienda[0].az_azie ?? "ME";
            let data = await this.#getDataFromUrlIdOrParams(Nar2.GET_DATI_PAZIENTEMEDICO, {
                replaceFromUrl: {
                    "id": paziente_id,
                    "tipo_medico": tipoMed,
                    "az_id": az_id
                }
            });
            if (data && data.ok === true) {
                return {
                    ok: true,
                    data: data.data.sceltaMedico.sitAss_
                }
            } else return {ok: false, data: null};
        } catch (e) {
            return {ok: false, data: null};
        }
    }

    async getAmbitiDomicilioAssistito(codFiscale,situazioneAssistenziale = 4)  {

        //https://nar2.regione.sicilia.it/services/index.php/api/ambitoDomTable?situazione_assistenziale=4&azienda=83&tipo=90000000038
        // 83 =  "pz_com_res": "83",
        // volendo , tipo= "90000000038" ambito, tipo="90000000040" distretto

        const dati = await this.getDatiAssistitoNar2FromCf(codFiscale);
        let data = await this.#getDataFromUrlIdOrParams(Nar2.GET_AMBITI_DOMICILIO, {
            getParams: {
                situazione_assistenziale: situazioneAssistenziale,
                azienda: dati.fullData.data.pz_com_res
            }
        });
        if (data && data.ok === true){
            // dividi ambiti e distretto
            let out = {assistito: dati.fullData.data, ambiti:[], distretto: null};
            for (let elemento of data.data){
                console.log("ciao");
                if (elemento.tipi_strutture.tipo.eg_desc1.toLowerCase().includes("ambito"))
                    out.ambiti.push(elemento);
             else if (elemento.tipi_strutture.tipo.eg_desc1.toLowerCase().includes("distretto"))
                    out.distretto = elemento;
            }
            return out;
        }



    }


    /**
     * Retrieves doctors by region/area (ambito) with optional filtering.
     *
     * @param {string|number} idAmbito - The ID of the region/area to search doctors in
     * @param {Object} fullAssistitoData - Complete patient data object from NAR2
     * @param {string} tipoMedico - Type of doctor to search for ("M" for general practitioners, "P" for pediatricians)
     * @param {Object} [config={}] - Configuration options
     * @param {string} [config.dataScelta=current date] - The date to check doctor availability (YYYY-MM-DD)
     * @param {number} [config.sitAssistenziale=4] - Assistance situation code (4 = resident and domiciled in region)
     * @returns {Promise<Object>} Promise object representing the doctors list with pagination info
     */
    async getMediciByAmbito(idAmbito, fullAssistitoData, tipoMedico, config = {}) {
        //https://nar2.regione.sicilia.it/services/index.php/api/mediciByAmbitoTable?ambito=140&tipo_medico=M&dataScelta=2025-09-26&start=0&length=0&pagination=yes&sit_ass=4&cat_citt=90000000052&check_first_doctor=true&not_search_after=null&idPaziente=1128286
        //ambito=140&tipo_medico=P&dataScelta=2025-09-01&pagination=yes&sit_ass=4&cat_citt=90000000052&check_fisrt_doctor=true&idPaziente=1128286
        const {
            dataScelta = moment().format("YYYY-MM-DD"),
            sitAssistenziale = 4, // domiciliato e residente in regione

        } = config;
        let getParams = {
            ambito: idAmbito,
            tipo_medico: tipoMedico,
            dataScelta: dataScelta,
            start: 0,
            length:0,
            pagination: "yes",
            sit_ass: sitAssistenziale,
            cat_citt: fullAssistitoData.pz_categoria_citt,
            check_first_doctor: true,
            not_search_after: null,
            idPaziente: fullAssistitoData.pz_id
        }
        const data = await this.#getDataFromUrlIdOrParams(Nar2.GET_MEDICI_BY_AMBITO, {
            getParams
        });
        if (data && data.ok === true) {
            let out = {liberi:[], massimalisti:[]}
            for (let riga of data.data) {
                if (riga.medico_massimalista)
                    out.massimalisti.push(riga);
                else
                    out.liberi.push(riga);
            }
            return {ok:true,data: out};
        }
        return {ok: false, data: []};
    }


    /**
     * Retrieves medical data from the specified NAR2 endpoint.
     *
     * @param {Object} config - Configuration options for the method.
     * @param {boolean} [config.soloAttivi=true] - Flag indicating whether to include only active records.
     * @param {boolean} [config.nascondiCessati=true] - Flag indicating whether to exclude ceased records.
     * @param {boolean} [config.normalizza=true] - Flag indicating whether to normalize the data.
     * @param {boolean} [config.soloPediatri=false] - Flag indicating whether to include only pediatric records.
     * @param {boolean} [config.soloMMG=false] - Flag indicating whether to include only MMG records.
     * @param {string} [config.asl="281"] - The ASL code to filter the records (default is "281" for Messina).
     * @param {string} [config.azienda="ME"] - The company code to filter the records (default is "ME" for Messina).
     *
     * @return {Promise<Object>} A promise that resolves to the retrieved medical data.
     */
    async getMediciFromNar2(config = {}) {
       const {
            soloAttivi = true,
            nascondiCessati = true,
           normalizza = true,
           soloPediatri = false,
           soloMMG = false,
           asl = "281", // messina,
           azienda = "ME", //messina
        } = config;
       let getParams = {
           "tipo_rapporto": "Medico_base",
           "aspOaltro": "ASP",
           "esitoFineConvenzione": "rapporto_disattivato",
           "intervalloVariazione": "modificato",
           "rapportoAttivo": "true",
           "asl": asl,
           "azienda": azienda,
       };
        if ((soloMMG || soloPediatri) && !(soloMMG === true && soloPediatri === true)) {
            if (soloMMG === true)
                getParams.categoriaMedico = Nar2.CAT_MMG;
            else
                getParams.categoriaMedico = Nar2.CAT_PEDIATRI;
        }
        const data = await this.#getDataFromUrlIdOrParams(Nar2.GET_MEDICI, {
            getParams
        });
        if (data && data.ok === true) {
            // Normalizza l'array risultante (può essere direttamente data.data o incapsulato)
            let medici = Array.isArray(data.data) ? data.data
                : (Array.isArray(data.data?.data) ? data.data.data : []);

            // Applica i filtri richiesti
            if (soloAttivi)
                medici = medici.filter(m => m && m.stato === "A");
            if (normalizza)
                medici = medici.filter(m => m.cod_regionale !== null && m.codice_fiscale !== null) ;
            if (nascondiCessati)
                medici = medici.filter(m => m && (m.fine_rapporto === null || typeof m.fine_rapporto === "undefined"));

            return { ok: true, data: medici };
        }
        return data;
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


    /**
     * Fetches data from a given URL, supporting dynamic URL substitution and additional parameters.
     * Handles token retrieval and retries on failures with a specified maximum retry limit.
     *
     * @param {string} url - The base URL for the request. Use "{id}" in the URL for substitution if `urlId` is provided.
     * @param {Object} [config={}] - Configuration options for the request.
     * @param {string|number} [config.urlId=null] - An ID to substitute into the URL if specified.
     * @param {Object} [config.params=null] - Query parameters to include in the request.
     * @param {Object} [config.getParams=null] - Parameters to append as part of the URL query string.
     * @param {Object} [config.replaceFromUrl=null] - Key-value pairs for dynamic URL segment replacement.
     * @return {Promise<Object>} An object containing a boolean `ok` and the fetched `data` in the `result` if successful, or `null` on failure.
     */
    async #getDataFromUrlIdOrParams(url, config = {}) {
        const {
            urlId = null,
            params = null,
            getParams = null,
            replaceFromUrl = null,

        } = config;
        let out = {ok: false, data: null};
        let ok = false;

        // Build URL with get parameters if provided
        let finalUrl = url;
        if (getParams) {
            const queryParams = new URLSearchParams();
            for (const [key, value] of Object.entries(getParams)) {
                queryParams.append(key, value);
            }
            finalUrl = `${url}?${queryParams.toString()}`;
        }
        if (replaceFromUrl && typeof replaceFromUrl === "object") {
            for (const [key, value] of Object.entries(replaceFromUrl))
                finalUrl = finalUrl.replace(`{${key}}`, value.toString());
        }

        for (let i = 0; i < this._maxRetry && !ok; i++) {
            try {
                await this.getToken();
                let response = null;
                if (urlId)
                    response = await axios.get(finalUrl.replace("{id}", urlId.toString()), {
                        headers: {
                            Authorization: `Bearer ${Nar2.#token}`,
                        },
                    });
                else
                    response = await axios.get(finalUrl, {
                        headers: {
                            Authorization: `Bearer ${Nar2.#token}`,
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
        return await this.#getDataFromUrlIdOrParams(Nar2.GET_ASSISTITO_NAR_FROM_ID, {urlId:id});
    }

    async getMedicoFromId(id) {
        return await this.#getDataFromUrlIdOrParams(Nar2.GET_DATI_MEDICO_FROM_ID, {urlId:id});
    }

    async getNumAssistitiMedico(id) {
        return await this.#getDataFromUrlIdOrParams(Nar2.GET_NUM_ASSISTITI_MEDICO, {urlId:id});
    }

    async getAssistitiFromParams(params) {
        // params in uri: codiceFiscale, nome, cognome, dataNascita
        return await this.#getDataFromUrlIdOrParams(Nar2.GET_ASSISTITI_NAR, {params:params});
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

    async revocaAssistito(id) {
        //https://nar2.regione.sicilia.it/services/index.php/api/motiviOperazioneFromMotivoRevoca/39100000038
        //https://nar2.regione.sicilia.it/services/index.php/api/pazienti/aggiornaSceltaMedico/13122455
        // {"data":{"pm_paz":970248,"pm_fstato":"A","pm_medico":10968,"pm_dt_scad":null,"pm_dt_enable":"2022-11-04","pm_mot_scelta":"90000000073"},"dett_pazientemedico":{"dm_ambito_dom":"148","dm_situazione_ass":"6","dm_eta_scelta":74,"dm_ambito_scelta":"148","dm_motivo_scelta":"90000000073","dm_tipoop_scelta":"39100000036","dm_dt_fine_proroga_ped":null,"dm_motivo_pror_scad_ped":null},"revoca":{"pm_dt_disable":"2025-08-29","dm_dt_ins_revoca":"2025-09-03","dm_motivo_revoca":"90000000029","dm_tipoop_revoca":"39100000038","revoca_id":13122455}}
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
