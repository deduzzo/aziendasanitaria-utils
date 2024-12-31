import axios from "axios";
import {Assistito, DATI} from "../classi/Assistito.js";
import moment from "moment";

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
                //console.log(e);
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

    async getDatiAssistitoNar2FromCf(codiceFiscale, assistito = null) {
        // step1, get id assistito from codice fiscale
        if (!assistito)
            assistito = new Assistito();
        let datiIdAssitito = await this.getAssistitiFromParams({codiceFiscale: codiceFiscale});
        if (datiIdAssitito.ok  && datiIdAssitito.data.length === 1)
        {
            let datiAssistito = await this.getAssistitoFromId(datiIdAssitito.data[0].pz_id);
            if (datiAssistito.ok) {
                assistito.setNar2(DATI.CF, datiAssistito.data.pz_cfis);
                assistito.setNar2(DATI.COGNOME, datiAssistito.data.pz_cogn);
                assistito.setNar2(DATI.NOME, datiAssistito.data.pz_nome);
                assistito.setNar2(DATI.SESSO, datiAssistito.data.pz_sesso);
                assistito.setNar2(DATI.CAP_RESIDENZA, datiAssistito.data.pz_cap_res);
                assistito.setNar2(DATI.DATA_NASCITA, moment(datiAssistito.data.pz_dt_nas, "YYYY-MM-DD HH:mm:ss").format("DD/MM/YYYY"));
                assistito.setNar2(DATI.COMUNE_NASCITA, datiAssistito.data.comune_nascita.cm_desc ?? null);
                assistito.setNar2(DATI.COD_COMUNE_NASCITA, datiAssistito.data.comune_nascita.cm_cfis ?? null);
                assistito.setNar2(DATI.COD_ISTAT_COMUNE_NASCITA, datiAssistito.data.comune_nascita.cm_cistat ?? null);
                assistito.setNar2(DATI.PROVINCIA_NASCITA, datiAssistito.data.comune_nascita.provincia.pr_id ?? null);
                assistito.setNar2(DATI.INDIRIZZO_RESIDENZA, datiAssistito.data.pz_ind_res ?? null);
                assistito.setNar2(DATI.COMUNE_RESIDENZA, datiAssistito.data.comune_residenza.cm_desc ?? null);
                assistito.setNar2(DATI.COD_COMUNE_RESIDENZA, datiAssistito.data.comune_residenza.cm_cfis ?? null);
                assistito.setNar2(DATI.COD_ISTAT_COMUNE_RESIDENZA, datiAssistito.data.comune_residenza.cm_cistat ?? null);
                assistito.setNar2(DATI.ASP, datiAssistito.data.hasOwnProperty("asl_appartenenza") ? (datiAssistito.data.asl_appartenenza.az_codi + " - " + datiAssistito.data.asl_appartenenza.az_desc) : null);
                assistito.setNar2(DATI.SSN_TIPO_ASSISTITO, datiAssistito.data.categoria_cittadino.eg_desc1 ?? null);
                assistito.setNar2(DATI.SSN_INIZIO_ASSISTENZA, (datiAssistito.data.hasOwnProperty("asl_assistenza") && datiAssistito.data.asl_assistenza.az_dt_ins !== null) ? moment(datiAssistito.data.asl_assistenza.az_dt_ins, "YYYY-MM-DD HH:mm:ss").format("DD/MM/YYYY") : null);
                assistito.setNar2(DATI.SSN_FINE_ASSISTENZA, (datiAssistito.data.hasOwnProperty("asl_assistenza") && datiAssistito.data.asl_assistenza.az_dt_disable !== null) ? moment(datiAssistito.data.asl_assistenza.az_dt_disable, "YYYY-MM-DD HH:mm:ss").format("DD/MM/YYYY") : null);
                assistito.setNar2(DATI.SSN_NUMERO_TESSERA, datiAssistito.data.pz_team_id ?? null);
                assistito.setNar2(DATI.MMG_ULTIMA_OPERAZIONE, (datiAssistito.data.hasOwnProperty("storico_medici") && datiAssistito.data.storico_medici.length > 0) ? datiAssistito.data.storico_medici[0].dett_pazientemedico.tipoop_scelta.eg_desc1 : null);
                assistito.setNar2(DATI.MMG_ULTIMO_STATO, (datiAssistito.data.hasOwnProperty("storico_medici") && datiAssistito.data.storico_medici.length > 0) ? datiAssistito.data.storico_medici[0].dett_pazientemedico.posizione_ass.eg_desc1 : null);
                assistito.setNar2(DATI.MMG_TIPO, datiAssistito.data.medico.pf_tipo ?? null);
                assistito.setNar2(DATI.MMG_COD_REG, (datiAssistito.data.elementi_tabelle_paziente.hasOwnProperty("storico_medici") && datiAssistito.data.elementi_tabelle_paziente.storico_medici.length > 0) ? datiAssistito.data.elementi_tabelle_paziente.storico_medici[0].medico.rapporto_individuale[0].dett_medico.dm_creg : null);
                assistito.setNar2(DATI.MMG_NOMINATIVO_COMPLETO, datiAssistito.data.medico.pf_ragsoc ?? null);
                assistito.setNar2(DATI.MMG_NOME, datiAssistito.data.medico.pf_nome ?? null);
                assistito.setNar2(DATI.MMG_COGNOME, datiAssistito.data.medico.pf_cognome ?? null);
                assistito.setNar2(DATI.MMG_CF, datiAssistito.data.medico.pf_cfis ?? null);
                assistito.setNar2(DATI.MMG_DATA_SCELTA, (datiAssistito.data.elementi_tabelle_paziente.hasOwnProperty("storico_medici") && datiAssistito.data.elementi_tabelle_paziente.storico_medici.length > 0) ? moment(datiAssistito.data.elementi_tabelle_paziente.storico_medici[0].dett_pazientemedico.dm_dt_ins, "YYYY-MM-DD HH:mm:ss").format("DD/MM/YYYY") : null);
                assistito.setNar2(DATI.MMG_DATA_REVOCA,
                    (datiAssistito.data.elementi_tabelle_paziente.hasOwnProperty("storico_medici") && datiAssistito.data.elementi_tabelle_paziente.storico_medici.length > 0) ?
                        (datiAssistito.data.elementi_tabelle_paziente.storico_medici[0].pm_dt_disable !== null ? moment(datiAssistito.data.elementi_tabelle_paziente.storico_medici[0].pm_dt_disable, "YYYY-MM-DD HH:mm:ss").format("DD/MM/YYYY") : null)
                        : null);
                assistito.setNar2(DATI.DATA_DECESSO, datiAssistito.data.pz_dt_dec !== null ? moment(datiAssistito.data.pz_dt_dec, "YYYY-MM-DD HH:mm:ss").format("DD/MM/YYYY") : null);
                return {
                    ok: true,
                    data: datiAssistito.data
                };
            }
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
                        cod_comune_nascita: nullArray(out.data.data.p801codiceComuneNascita),
                        cod_istat_comune_nascita: nullArray(out.data.data.p801codiceistatiComuneNascita),
                        indirizzo: nullArray(out.data.data.p801recapitoTessera),
                        cod_comune_residenza: nullArray(out.data.data.p801codiceComuneResidenza),
                        cod_istat_comune_residenza: nullArray(out.data.data.p801codiceistatiComuneResidenza),
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
                        data_decesso: deceduto ? nullArray(out.data.data.p801dataDecesso) : null
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

    async getDatiAssistitoFromCfSuSogeiNew(cf, assistito = null) {
        let out = null;
        let ok = false;
        const nullArray = (data) => {
            return Array.isArray(data) && data.length === 0 ? "" : data;
        };

        // Se non viene fornito un oggetto Assistito, ne creiamo uno nuovo
        if (!assistito) {
            assistito = new Assistito();
        }

        for (let i = 0; i < this._maxRetry && !ok; i++) {
            if (this._token === null)
                await this.getToken();
            try {
                out = await axios.post(Nar2.GET_DATI_ASSISTITO_FROM_SOGEI, {
                    codiceFiscale: cf,
                }, {
                    headers: {
                        Authorization: `Bearer ${this._token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (out.data.status.toString() !== "true" && out.data.status.toLowerCase().includes("token is invalid")) {
                    await this.getToken();
                } else {
                    ok = true;
                    const deceduto = out.data.data.p801descrizioneCodiceTipoAssistito.toLowerCase().includes("deceduto");
                    const asp = nullArray(out.data.data.p801codiceRegioneResidenzaAsl) + " - " +
                        nullArray(out.data.data.p801descrizioneRegioneResidenzaAsl) + " " +
                        nullArray(out.data.data.p801codiceAslResidenzaAsl) + " - " +
                        nullArray(out.data.data.p801descrizioneAslResidenzaAsl).trim();

                    // Popoliamo i dati in fromTs usando i setter
                    assistito.setTs(DATI.CF, nullArray(out.data.data.p801codiceFiscale));
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

                    out = {
                        ok: true,
                        fullData: out.data,
                        data: assistito
                    };
                }
            } catch (e) {
                await this.getToken();
            }
        }

        if (!ok) {
            out = {
                ok: false,
                fullData: null,
                data: assistito
            };
        }

        return out;
    }



}