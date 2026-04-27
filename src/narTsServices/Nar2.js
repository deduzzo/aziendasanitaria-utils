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
    static SCELTA_MEDICO_URL = "https://nar2.regione.sicilia.it/services/index.php/api/pazienti/sceltaMedico";
    static GET_ONLY_SIT_ASS = "https://nar2.regione.sicilia.it/services/index.php/api/getOnlySitAss/{pz_id}/{pm_id}/{az_id}/{tipo_med}/{eta}";
    static GET_SCID_BY_SAID = "https://nar2.regione.sicilia.it/services/index.php/api/getSCIDBySAID/{sa_id}";
    static AMBITO_DOM_SCELTA_AUTOCOMPLETE = "https://nar2.regione.sicilia.it/services/index.php/api/ambitoDomScelta";
    static MEDICI_BY_AMBITO_AUTOCOMPLETE = "https://nar2.regione.sicilia.it/services/index.php/api/mediciByAmbito";
    static MEDICO_DI_BASE = "M";
    static PEDIATRA = "P";

    static CAT_PEDIATRI = "90000000046";
    static CAT_MMG = "90000000045";
    static TIPO_AMBITI = "90000000038";

    // Motivi e tipi operazione (estratti dai cataloghi NAR2)
    static MOTIVO_CAMBIO_MEDICO = "90000000025";          // A04 - Cambio medico
    static MOTIVO_RICONG_FAMILIARE = "90000000027";       // A06 - Ricongiungimento familiare
    static MOTIVO_DEROGA_TERRITORIALE = "90000000140";    // A19 - Deroga territoriale
    static MOTIVO_CAMBIO_RES_REGIONE = "90000000073";     // 01 - Cambio residenza in regione
    static MOTIVO_REVOCA_PER_CAMBIO = "90000000029";      // motivo revoca standard
    static TIPO_OP_SCELTA = "39100000036";                // 1 - Scelta (variazione del medico)
    static TIPO_OP_NUOVA_ISCRIZIONE = "39100000037";      // 2 - Nuova iscrizione
    static TIPO_OP_REVOCA = "39100000038";                // 3 - Revoca

    // Codici situazione assistenziale (sa_cod) → mappabili tramite getOnlySitAss
    static SIT_ASS_CAMBIO_MEDICO_REGIONE = "19";          // Cambio in regione ricong. fam.
    static SIT_ASS_CAMBIO_DEROGA = "31";                  // Cambio medico in deroga territoriale
    static SIT_ASS_CAMBIO_NELL_ASL = "13";                // Cambio medico nell'ASL (residente) — DEFAULT
    static SIT_ASS_CAMBIO_NELLA_REGIONE = "18";           // Cambio medico nella regione (residente)
    static SIT_ASS_CAMBIO_RICONG_FAM = "17";              // Cambio per ricong.fam. MMG
    static SIT_ASS_ISCRIZIONE_ELENCO_SEPARATO = "29";     // Iscrizione elenco separato

    static PARAMS = {
        CODICE_FISCALE: 'codiceFiscale',
        NOME: 'nome',
        COGNOME: 'cognome',
        DATA_NASCITA: 'dataNascita',
        AZIENDA: 'azienda',
        CATEGORIA: 'categoria',
        SESSO: 'sesso',
        CITTADINANZA: 'cittadinanza',
        INTERVALLO_ETA: 'intervallo_eta',
        INTERVALLO_DECESSO: 'intervallo_decesso',
        INTERVALLO_INSERIMENTO: 'intervallo_inserimento',
        INTERVALLO_MODIFICA: 'intervallo_modifica',
        ASL: 'asl',
        ASL_ASSISTENZA: 'asl_assistenza',
        DISTRETTO_ASSISTENZA: 'distretto_assistenza',
        NUMERO_TESSERA_SANITARIA: 'numeroTesseraSanitaria',
        SCADENZA_TESSERA_SANITARIA: 'scadenzaTesseraSanitaria',
        PROVINCIA: 'provincia',
        PROVINCIA_RESIDENZA: 'provincia_residenza',
        COMUNE_RESIDENZA: 'comune_residenza',
        COMUNE: 'comune',
        PROVINCIA_NASCITA: 'provincia_nascita',
        PROVINCIA_DOMICILIO: 'provincia_domiclio',
        COMUNE_DOMICILIO: 'comune_domicilio',
        STATE: 'state',
        STP: 'stp',
        START: 'start',
        LENGTH: 'length',
        PAGINATION: 'pagination'
    };

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


    /**
     * Recupera le situazioni assistenziali ammesse per un paziente, comprensive di
     * motivi/tipi operazione validi (catalogo `motivo_op` + `gentgen`).
     *
     * Endpoint: GET /getOnlySitAss/{pz_id}/{pm_id|null}/{az_id}/{tipo_med}/{eta}
     *
     * @param {string} codFiscale - Codice fiscale dell'assistito.
     * @param {Object} [config={}]
     * @param {string|number|null} [config.pmId=null] - pm_id scelta corrente; null per nuova scelta.
     * @param {string} [config.tipoMedico="M"] - "M" MMG o "P" Pediatra.
     * @returns {Promise<{ok:boolean, data:Array|null}>}
     */
    async getSituazioniAssistenzialiAmmesse(codFiscale, config = {}) {
        const {pmId = null, tipoMedico = Nar2.MEDICO_DI_BASE} = config;
        const dati = await this.getDatiAssistitoNar2FromCf(codFiscale);
        if (!dati || !dati.ok) return {ok: false, data: null};
        const fullData = dati.fullData.data;
        const eta = moment().diff(moment(fullData.pz_dt_nas, "YYYY-MM-DD HH:mm:ss"), "years");
        const azId = fullData.comune_domicilio?._azienda?.[0]?.az_azie ?? "ME";
        const data = await this.#getDataFromUrlIdOrParams(Nar2.GET_ONLY_SIT_ASS, {
            replaceFromUrl: {
                pz_id: fullData.pz_id,
                pm_id: pmId,
                az_id: azId,
                tipo_med: tipoMedico,
                eta: eta
            },
            rawResponse: true // endpoint restituisce direttamente un array
        });
        return data;
    }

    /**
     * Restituisce le categorie cittadino (sc_id) ammesse per una data situazione assistenziale.
     *
     * Endpoint: GET /getSCIDBySAID/{sa_id}
     *
     * @param {string|number} saId - sa_id della situazione assistenziale.
     * @returns {Promise<{ok:boolean, data:string[]|null}>}
     */
    async getCategorieCittadinoBySituazione(saId) {
        return await this.#getDataFromUrlIdOrParams(Nar2.GET_SCID_BY_SAID, {
            replaceFromUrl: {sa_id: saId},
            rawResponse: true // restituisce direttamente un array di sc_id
        });
    }

    /**
     * Ricerca ambiti via autocomplete.
     *
     * Endpoint: GET /ambitoDomScelta?searchKey=...&azienda=...&tipo=...
     *
     * @param {string} searchKey - Stringa di ricerca (es. "mess").
     * @param {Object} [config={}]
     * @param {string|number} [config.azienda] - Codice azienda/comune (es. pz_com_res).
     * @param {string} [config.tipo=Nar2.TIPO_AMBITI] - Tipo struttura.
     * @param {boolean} [config.showAzienda=false]
     * @returns {Promise<{ok:boolean, data:Array|null}>}
     */
    async searchAmbitiAutocomplete(searchKey, config = {}) {
        const {azienda, tipo = Nar2.TIPO_AMBITI, showAzienda = false} = config;
        return await this.#getDataFromUrlIdOrParams(Nar2.AMBITO_DOM_SCELTA_AUTOCOMPLETE, {
            getParams: {
                start: 0,
                autocomplete: true,
                searchKey,
                azienda,
                tipo,
                showAzienda
            }
        });
    }

    /**
     * Ricerca medici per ambito via autocomplete (variante della `getMediciByAmbito`).
     *
     * Endpoint: GET /mediciByAmbito?searchKey=...&ambito=...&tipo=M&...
     *
     * @param {string|number} idAmbito
     * @param {string} codFiscaleAssistito
     * @param {string} searchKey - Stringa di ricerca (es. "ros" per "rossi").
     * @param {Object} [config={}]
     * @param {string} [config.tipoMedico="M"]
     * @param {string} [config.dataScelta=oggi]
     * @param {number} [config.sitAssistenziale=4]
     * @returns {Promise<{ok:boolean, data:Array|null}>}
     */
    async searchMediciByAmbitoAutocomplete(idAmbito, codFiscaleAssistito, searchKey, config = {}) {
        const {
            tipoMedico = Nar2.MEDICO_DI_BASE,
            dataScelta = moment().format("YYYY-MM-DD"),
            sitAssistenziale = 4
        } = config;
        const fullData = (await this.getDatiAssistitoNar2FromCf(codFiscaleAssistito)).fullData.data;
        const azienda = fullData.comune_domicilio?._azienda?.[0]?.az_azie ?? "ME";
        return await this.#getDataFromUrlIdOrParams(Nar2.MEDICI_BY_AMBITO_AUTOCOMPLETE, {
            getParams: {
                start: 0,
                autocomplete: true,
                searchKey,
                azienda,
                tipo: tipoMedico,
                dataScelta,
                situazioneAss: sitAssistenziale,
                ambito: idAmbito,
                idPaziente: fullData.pz_id
            }
        });
    }

    /**
     * Costruisce e (opzionalmente) invia la richiesta di cambio medico al NAR2.
     *
     * Endpoint finale: POST /pazienti/sceltaMedico
     *
     * Flusso:
     *  1. Recupera dati assistito (pz_id, pz_com_res, età, comune domicilio).
     *  2. Recupera la scelta medico attiva (per costruire `revoca_scelta_precedente`).
     *  3. Recupera le situazioni assistenziali ammesse e seleziona quella richiesta
     *     (default: `13` = "Cambio medico nell'ASL"); da qui estrae motivo e tipo operazione.
     *  4. Costruisce il payload `{data, dett_pazientemedico, [revoca_scelta_precedente]}`.
     *  5. Se `dryRun=true` ritorna il payload senza inviarlo (per ispezione/test sicuro).
     *  6. Altrimenti POST `/pazienti/sceltaMedico` e ritorna la risposta del server.
     *
     * Tutti i parametri sono override opzionali: se non specificati vengono dedotti
     * automaticamente dai dati e dai cataloghi NAR2.
     *
     * @param {string} codFiscale - Codice fiscale dell'assistito.
     * @param {string|number} idMedico - `pf_id` del medico scelto (campo `pf_id` da `getMediciByAmbito`).
     * @param {Object} [config={}]
     * @param {boolean} [config.dryRun=true] - DEFAULT TRUE: ritorna payload senza inviare. Impostare a false per inviare davvero.
     * @param {string} [config.tipoMedico="M"] - "M" MMG, "P" Pediatra.
     * @param {string} [config.dataScelta=oggi] - Data scelta (YYYY-MM-DD).
     * @param {string} [config.dataRevoca=ieri] - Data disabilitazione scelta precedente (YYYY-MM-DD).
     * @param {string} [config.dataInsRevoca=oggi] - Data inserimento revoca (YYYY-MM-DD).
     * @param {string|number} [config.idAmbitoScelta] - Override sr_id ambito di scelta (default = ambito di domicilio).
     * @param {string|number} [config.idAmbitoDomicilio] - Override sr_id ambito di domicilio (default: ricavato da getAmbitiDomicilioAssistito).
     * @param {string} [config.codiceSituazioneAssistenziale="13"] - sa_cod (vedi costanti SIT_ASS_*).
     * @param {string|number} [config.idSituazioneAssistenziale] - Override diretto del sa_id (bypassa la lookup per sa_cod).
     * @param {string} [config.motivoScelta] - Override pm_mot_scelta/dm_motivo_scelta (default: dedotto dalla situazione).
     * @param {string} [config.tipoOperazioneScelta] - Override dm_tipoop_scelta (default: dedotto dalla situazione).
     * @param {string} [config.motivoRevoca] - Override dm_motivo_revoca (default: stesso motivo della scelta).
     * @param {string} [config.tipoOperazioneRevoca=TIPO_OP_REVOCA] - dm_tipoop_revoca.
     * @param {boolean} [config.forzaSenzaRevoca=false] - Se true non aggiunge revoca anche se esiste medico precedente.
     * @param {string} [config.dataFineProrogaPed=null] - Solo pediatri.
     * @param {string} [config.motivoProrogaPed=null] - Solo pediatri.
     * @returns {Promise<{ok:boolean, dryRun:boolean, payload:Object, response:Object|null, error?:string}>}
     */
    async aggiornaCambioMedico(codFiscale, idMedico, config = {}) {
        const {
            dryRun = true,
            tipoMedico = Nar2.MEDICO_DI_BASE,
            dataScelta = moment().format("YYYY-MM-DD"),
            dataRevoca = moment().subtract(1, "day").format("YYYY-MM-DD"),
            dataInsRevoca = moment().format("YYYY-MM-DD"),
            idAmbitoScelta = null,
            idAmbitoDomicilio = null,
            codiceSituazioneAssistenziale = Nar2.SIT_ASS_CAMBIO_NELL_ASL,
            idSituazioneAssistenziale = null,
            motivoScelta = null,
            tipoOperazioneScelta = null,
            motivoRevoca = null,
            tipoOperazioneRevoca = Nar2.TIPO_OP_REVOCA,
            forzaSenzaRevoca = false,
            dataFineProrogaPed = null,
            motivoProrogaPed = null
        } = config;

        // 1) Dati assistito
        const datiAssistito = await this.getDatiAssistitoNar2FromCf(codFiscale);
        if (!datiAssistito || !datiAssistito.ok) {
            return {ok: false, dryRun, payload: null, response: null, error: "Assistito non trovato su NAR2"};
        }
        const fullData = datiAssistito.fullData.data;
        const pzId = fullData.pz_id;
        const eta = moment().diff(moment(fullData.pz_dt_nas, "YYYY-MM-DD HH:mm:ss"), "years");
        const azId = fullData.comune_domicilio?._azienda?.[0]?.az_azie ?? "ME";

        // 2) Ambito di domicilio (se non fornito): lo ricavo dai dati paziente o dal catalogo ambiti
        let ambitoDom = idAmbitoDomicilio;
        if (!ambitoDom) {
            const dettStorico = fullData.storico_medici?.[0]?.dett_pazientemedico;
            ambitoDom = dettStorico?.dm_ambito_dom ?? null;
            if (!ambitoDom) {
                // fallback: prendo il primo ambito MMG/Pediatra dalla lista
                const ambitiRes = await this.getAmbitiDomicilioAssistito(codFiscale, {dividiAmbitiMMGPediatri: true});
                if (ambitiRes?.ok) {
                    const lista = tipoMedico === Nar2.PEDIATRA ? ambitiRes.data.ambiti.pediatri : ambitiRes.data.ambiti.mmg;
                    ambitoDom = lista?.[0]?.sr_id ?? null;
                }
            }
        }
        if (!ambitoDom) {
            return {ok: false, dryRun, payload: null, response: null, error: "Impossibile determinare l'ambito di domicilio"};
        }
        const ambitoScelta = idAmbitoScelta ?? ambitoDom;

        // 3) Scelta medico corrente (per revoca_scelta_precedente)
        // La scelta attiva si trova in storico_medici[*] con pm_fstato="A" e pm_dt_disable=null
        let revocaPrecedente = null;
        if (!forzaSenzaRevoca) {
            const storico = Array.isArray(fullData.storico_medici) ? fullData.storico_medici : [];
            const sceltaAttiva = storico.find(s => s?.pm_fstato === "A" && !s?.pm_dt_disable);
            const pmIdCorrente = sceltaAttiva?.pm_id ?? null;
            if (pmIdCorrente) {
                revocaPrecedente = {
                    pm_dt_disable: dataRevoca,
                    dm_dt_ins_revoca: dataInsRevoca,
                    dm_motivo_revoca: motivoRevoca, // popolato sotto se null
                    dm_tipoop_revoca: tipoOperazioneRevoca,
                    revoca_id: typeof pmIdCorrente === "string" ? parseInt(pmIdCorrente, 10) : pmIdCorrente
                };
            }
        }

        // 4) Situazione assistenziale + motivo + tipo operazione (dal catalogo)
        const sitAmmesse = await this.getSituazioniAssistenzialiAmmesse(codFiscale, {tipoMedico});
        if (!sitAmmesse || !sitAmmesse.ok || !Array.isArray(sitAmmesse.data)) {
            return {ok: false, dryRun, payload: null, response: null, error: "Impossibile recuperare situazioni assistenziali ammesse"};
        }
        let situazioneScelta;
        if (idSituazioneAssistenziale) {
            situazioneScelta = sitAmmesse.data.find(s => s.sa_id?.toString() === idSituazioneAssistenziale.toString());
        } else {
            situazioneScelta = sitAmmesse.data.find(s => s.sa_cod?.toString() === codiceSituazioneAssistenziale.toString());
        }
        if (!situazioneScelta) {
            return {
                ok: false, dryRun, payload: null, response: null,
                error: `Situazione assistenziale non ammessa per questo paziente (cercata: sa_cod=${codiceSituazioneAssistenziale}, sa_id=${idSituazioneAssistenziale}). Ammesse: ${sitAmmesse.data.map(s => s.sa_cod).join(", ")}`
            };
        }
        const motivoOp = situazioneScelta.motivo_op?.[0];
        const motivoFromSit = motivoOp?.eg_id ?? null;
        const tipoOpFromSit = motivoOp?.gentgen?.find(g => g.gt_id2 === Nar2.TIPO_OP_SCELTA)?.gt_id2 ?? Nar2.TIPO_OP_SCELTA;

        const motivoFinale = motivoScelta ?? motivoFromSit;
        const tipoOpFinale = tipoOperazioneScelta ?? tipoOpFromSit;
        if (!motivoFinale) {
            return {ok: false, dryRun, payload: null, response: null, error: "Impossibile determinare il motivo della scelta"};
        }

        // Allinea il motivo revoca se non specificato
        if (revocaPrecedente && !revocaPrecedente.dm_motivo_revoca) {
            revocaPrecedente.dm_motivo_revoca = motivoFinale;
        }

        // 5) Payload
        const payload = {
            data: {
                pm_paz: pzId,
                pm_fstato: "A",
                pm_medico: typeof idMedico === "string" ? parseInt(idMedico, 10) : idMedico,
                pm_dt_scad: null,
                pm_dt_enable: dataScelta,
                pm_mot_scelta: motivoFinale
            },
            dett_pazientemedico: {
                dm_ambito_dom: ambitoDom?.toString(),
                dm_situazione_ass: situazioneScelta.sa_id?.toString(),
                dm_eta_scelta: eta,
                dm_ambito_scelta: ambitoScelta?.toString(),
                dm_motivo_scelta: motivoFinale,
                dm_tipoop_scelta: tipoOpFinale,
                dm_dt_fine_proroga_ped: tipoMedico === Nar2.PEDIATRA ? dataFineProrogaPed : null,
                dm_motivo_pror_scad_ped: tipoMedico === Nar2.PEDIATRA ? motivoProrogaPed : null
            }
        };
        if (revocaPrecedente) payload.revoca_scelta_precedente = revocaPrecedente;

        // 6) Dry-run: ritorna senza inviare
        if (dryRun) {
            return {ok: true, dryRun: true, payload, response: null};
        }

        // 7) Submit
        const result = await this.#postDataToUrl(Nar2.SCELTA_MEDICO_URL, payload);
        return {
            ok: result.ok,
            dryRun: false,
            payload,
            response: result.fullResponse,
            data: result.data,
            error: result.ok ? undefined : "Errore durante la POST /pazienti/sceltaMedico"
        };
    }

    async getSituazioniAssistenziali(codFiscaleAssistito, includeFullData = true) {
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
                let out = {
                    ok: true,
                    data: {
                        situazioni: data.data.sceltaMedico.sitAss_,
                    }
                };
                if (includeFullData)
                    out.data.fullData = data.data;
                return out;
            } else return {ok: false, data: null};
        } catch (e) {
            return {ok: false, data: null};
        }
    }


    /**
     * Retrieves the ambiti (areas) and distretto (district) of an assistito (assisted person) based on their codice fiscale (tax code).
     *
     * @param {string} codFiscale - The codice fiscale (tax code) of the assistito.
     * @param {Object} [config={}] - Optional configuration object.
     * @param {number} [config.situazioneAssistenziale=4] - The assistential situation, default is 4 (domiciled and resident in the region).
     * @return {Promise<Object>} A promise resolving to an object containing:
     *                           - `assistito`: The general assistito data.
     *                           - `ambiti`: An array of ambiti objects (areas).
     *                           - `distretto`: The associated distretto object (district), if available.
     */
    async getAmbitiDomicilioAssistito(codFiscale, config = {}) {
        let {
            situazioneAssistenziale = 4, // domiciliato e residente in regione
            dividiAmbitiMMGPediatri = true, // se true divide ambiti e distretto
        } = config;

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
        if (data && data.ok === true) {
            let out = {
                ambiti: dividiAmbitiMMGPediatri ? {pediatri: [], mmg: []} : [],
                distretto: null
            };
            for (let elemento of data.data) {
                for (const elemento of data.data) {
                    const desc = (elemento?.tipi_strutture?.tipo?.eg_desc1 || "").toLowerCase();
                    if (desc.includes("ambito")) {
                        if (dividiAmbitiMMGPediatri) {
                            if (/\d/.test(elemento.sr_desc)) out.ambiti.mmg.push(elemento);
                            else out.ambiti.pediatri.push(elemento);
                        } else {
                            out.ambiti.push(elemento);
                        }
                    } else if (desc.includes("distretto")) {
                        out.distretto = elemento;
                    }
                }
                return {ok: true, data: out};
            }
        }
        return {ok: false, data: null};
    }


    /**
     * Retrieves doctors by region/area (ambito) with optional filtering.
     *
     * @param {string|number} idAmbito - The ID of the region/area to search doctors in
     * @param {Object} codFiscale - Codice fiscale data of the assistito
     * @param {string} tipoMedico - Type of doctor to search for ("M" for general practitioners, "P" for pediatricians)
     * @param {Object} [config={}] - Configuration options
     * @param {string} [config.dataScelta=current date] - The date to check doctor availability (YYYY-MM-DD)
     * @param {number} [config.sitAssistenziale=4] - Assistance situation code (4 = resident and domiciled in region)
     * @returns {Promise<Object>} Promise object representing the doctors list with pagination info
     */
    async getMediciByAmbito(idAmbito, codFiscale, tipoMedico, config = {}) {
        //https://nar2.regione.sicilia.it/services/index.php/api/mediciByAmbitoTable?ambito=140&tipo_medico=M&dataScelta=2025-09-26&start=0&length=0&pagination=yes&sit_ass=4&cat_citt=90000000052&check_first_doctor=true&not_search_after=null&idPaziente=1128286
        //ambito=140&tipo_medico=P&dataScelta=2025-09-01&pagination=yes&sit_ass=4&cat_citt=90000000052&check_fisrt_doctor=true&idPaziente=1128286
        const {
            dataScelta = moment().format("YYYY-MM-DD"),
            sitAssistenziale = 4, // domiciliato e residente in regione

        } = config;
        const fullAssistitoData = (await this.getDatiAssistitoNar2FromCf(codFiscale)).fullData.data;
        let getParams = {
            ambito: idAmbito,
            tipo_medico: tipoMedico,
            dataScelta: dataScelta,
            start: 0,
            length: 0,
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
            let out = {liberi: [], massimalisti: []}
            for (let riga of data.data) {
                if (riga.medico_massimalista)
                    out.massimalisti.push(riga);
                else
                    out.liberi.push(riga);
            }
            return {ok: true, data: out};
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
                medici = medici.filter(m => m.cod_regionale !== null && m.codice_fiscale !== null);
            if (nascondiCessati)
                medici = medici.filter(m => m && (m.fine_rapporto === null || typeof m.fine_rapporto === "undefined"));

            return {ok: true, data: medici};
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
            try {
                if (!fallback) {
                    datiIdAssistito = await this.getAssistitiFromParams({codiceFiscale: codiceFiscale},true);
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
                    if (datiIdAssistito.status === 200 && datiIdAssistito.data?.data?.hasOwnProperty('nar2'))
                        datiAssistito = {ok: true, data: datiIdAssistito.data.data.nar2.result};
                    else {
                        datiAssistito = {ok: false, data: datiIdAssistito.data};
                        console.log(`[getDatiAssistitoNar2FromCf] Risposta fallback non valida - status: ${datiIdAssistito.status}, hasData: ${!!datiIdAssistito.data?.data}, hasNar2: ${!!datiIdAssistito.data?.data?.nar2}`);
                    }
                }
            } catch (e) {
                console.log("[getDatiAssistitoNar2FromCf] Eccezione durante recupero Nar2:", e.message);
            }
            if (datiAssistito && datiAssistito.ok) break;
            else console.log("[getDatiAssistitoNar2FromCf] Errore Nar2, tentativi rimanenti:" + (retry - i));
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
            console.log(`[getDatiAssistitoNar2FromCf] Nar2 fallito dopo ${retry} tentativi per CF: ${codiceFiscale?.substring(0, 6)}***`);
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
    /**
     * Esegue una POST autenticata gestendo retry e rinnovo token.
     *
     * @param {string} url - URL completo o template con placeholder `{key}`.
     * @param {Object} body - Payload JSON da inviare nel body.
     * @param {Object} [config={}]
     * @param {Object} [config.replaceFromUrl] - Sostituzioni nei placeholder URL.
     * @param {Object} [config.getParams] - Eventuali query params.
     * @returns {Promise<{ok:boolean, data:any, fullResponse:Object|null}>}
     */
    async #postDataToUrl(url, body, config = {}) {
        const {replaceFromUrl = null, getParams = null} = config;

        let finalUrl = url;
        if (getParams) {
            const queryParams = new URLSearchParams();
            for (const [key, value] of Object.entries(getParams)) queryParams.append(key, value);
            finalUrl = `${url}?${queryParams.toString()}`;
        }
        if (replaceFromUrl && typeof replaceFromUrl === "object") {
            for (const [key, value] of Object.entries(replaceFromUrl))
                finalUrl = finalUrl.replace(`{${key}}`, (value === null || typeof value === "undefined") ? "null" : value.toString());
        }

        let out = {ok: false, data: null, fullResponse: null};
        for (let i = 0; i < this._maxRetry && !out.ok; i++) {
            try {
                await this.getToken();
                const response = await axios.post(finalUrl, body, {
                    headers: {
                        Authorization: `Bearer ${Nar2.#token}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (!response?.data?.status || response.data.status.toString() !== "true" ||
                    response.data.status.toString().toLowerCase().includes("token is invalid")) {
                    await this.getToken({newToken: true});
                } else {
                    out = {ok: true, data: response.data.result, fullResponse: response.data};
                }
            } catch (e) {
                console.log(`[#postDataToUrl] Errore POST ${finalUrl}: ${e.message}`);
                await this.getToken({newToken: true});
            }
        }
        return out;
    }

    async #getDataFromUrlIdOrParams(url, config = {}) {
        const {
            urlId = null,
            params = null,
            getParams = null,
            replaceFromUrl = null,
            rawResponse = false, // se true, accetta risposte non incapsulate in {status, result}
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
                finalUrl = finalUrl.replace(`{${key}}`, (value === null || typeof value === "undefined") ? "null" : value.toString());
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

                // Caso 1: risposta raw (array nudo o oggetto senza envelope)
                if (rawResponse) {
                    // se contiene un messaggio "token is invalid" rinnovo
                    const asStr = typeof response?.data === "string" ? response.data : JSON.stringify(response?.data ?? "");
                    if (asStr.toLowerCase().includes("token is invalid")) {
                        await this.getToken({newToken: true});
                    } else {
                        ok = true;
                        out = {ok: true, data: response.data};
                    }
                } else if (!response?.data?.status || response.data.status.toString() !== "true" ||
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
        return await this.#getDataFromUrlIdOrParams(Nar2.GET_ASSISTITO_NAR_FROM_ID, {urlId: id});
    }

    async getMedicoFromId(id) {
        return await this.#getDataFromUrlIdOrParams(Nar2.GET_DATI_MEDICO_FROM_ID, {urlId: id});
    }

    async getNumAssistitiMedico(id) {
        return await this.#getDataFromUrlIdOrParams(Nar2.GET_NUM_ASSISTITI_MEDICO, {urlId: id});
    }

/**
     * Recupera gli assistiti tramite l'endpoint `pazienti`.
     *
     * Tutti i nomi dei parametri query sono esposti come costanti statiche in `Nar2.PARAMS`
     * e possono essere usati direttamente in chiamata per evitare stringhe hard-coded:
     *   this.getAssistitiFromParams({ [Nar2.PARAMS.CODICE_FISCALE]: 'RSSMRA80A01H501U', [Nar2.PARAMS.START]: 0 })
     *
     * Parametri disponibili (chiavi query):
     * - CODICE_FISCALE: 'codiceFiscale'
     * - NOME: 'nome'
     * - COGNOME: 'cognome'
     * - DATA_NASCITA: 'dataNascita' formato YYYY-MM-DD
     * - AZIENDA: 'azienda'
     * - CATEGORIA: 'categoria'
     * - SESSO: 'sesso'
     * - CITTADINANZA: 'cittadinanza'
     * - INTERVALLO_ETA: 'intervallo_eta' (oggetto -> verrà serializzato JSON)
     * - INTERVALLO_DECESSO: 'intervallo_decesso' (oggetto -> serializzato)
     * - INTERVALLO_INSERIMENTO: 'intervallo_inserimento' (oggetto -> serializzato)
     * - INTERVALLO_MODIFICA: 'intervallo_modifica' (oggetto -> serializzato)
     * - ASL: 'asl'
     * - ASL_ASSISTENZA: 'asl_assistenza'
     * - DISTRETTO_ASSISTENZA: 'distretto_assistenza'
     * - NUMERO_TESSERA_SANITARIA: 'numeroTesseraSanitaria'
     * - SCADENZA_TESSERA_SANITARIA: 'scadenzaTesseraSanitaria'
     * - PROVINCIA: 'provincia'
     * - PROVINCIA_RESIDENZA: 'provincia_residenza'
     * - COMUNE_RESIDENZA: 'comune_residenza'
     * - COMUNE: 'comune'
     * - PROVINCIA_NASCITA: 'provincia_nascita'
     * - PROVINCIA_DOMICILIO: 'provincia_domiclio'
     * - COMUNE_DOMICILIO: 'comune_domicilio'
     * - STATE: 'state'
     * - STP: 'stp'
     * - START: 'start'
     * - LENGTH: 'length'
     * - PAGINATION: 'pagination'
     *
     * Nota: per i parametri complessi (es. `INTERVALLO_ETA`) passare un oggetto:
     *   { [Nar2.PARAMS.INTERVALLO_ETA]: { intervallo_da: null, intervallo_a: null } }
     * Verrà serializzato automaticamente in JSON prima dell'invio.
     *
     * @param {Object} params - Mappa chiave/valore dei parametri query; si consiglia l'uso di `Nar2.PARAMS`.
     * @returns {Promise<Object>} Oggetto { ok: boolean, data: [...] } come ritornato da `#getDataFromUrlIdOrParams`.
     */
    async getAssistitiFromParams(params = {}, fulldata = false) {
        // Serializza in JSON eventuali parametri complessi (oggetti)
        const preparedParams = {};
        for (const [key, value] of Object.entries(params || {})) {
            if (value === null || typeof value === 'undefined' || value === '') {
                preparedParams[key] = value;
            } else if (typeof value === 'object') {
                try {
                    preparedParams[key] = JSON.stringify(value);
                } catch (e) {
                    preparedParams[key] = value;
                }
            } else {
                preparedParams[key] = value;
            }
        }
        const result = await this.#getDataFromUrlIdOrParams(Nar2.GET_ASSISTITI_NAR, {
            getParams: preparedParams
        });

        // Ripuliamo l'output mantenendo solo i campi essenziali
        if (result && result.ok && result.data && Array.isArray(result.data)) {
            if (!fulldata)
                result.data = result.data.map(assistito => {
                    return {
                        nome: assistito.pz_nome,
                        cognome: assistito.pz_cogn,
                        codiceFiscale: assistito.pz_cfis,
                        dataNascita: new moment(assistito.pz_dt_nas, "YYYY-MM-DD HH:mm:ss").format("DD/MM/YYYY"),
                        sesso: assistito.pz_sesso,
                        capResidenza: assistito.pz_cap_res,
                        indirizzoResidenza: assistito.pz_ind_res,
                    };
                });
            else
                return result;
        }

        return result;
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
            const results = await Promise.allSettled([
                this.getDatiAssistitoFromCfSuSogeiNew(cf, assistito, fallback),
                this.getDatiAssistitoNar2FromCf(cf, assistito, fallback)
            ]);
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    const source = index === 0 ? 'Sogei' : 'Nar2';
                    console.log(`[getDatiAssistitoCompleti] ${source} fallito:`, result.reason?.message || result.reason);
                }
            });
        } else {
            if (sogei) await this.getDatiAssistitoFromCfSuSogeiNew(cf, assistito, fallback).catch(e => console.log('[getDatiAssistitoCompleti] Sogei fallito:', e.message));
            if (nar2) await this.getDatiAssistitoNar2FromCf(cf, assistito, fallback).catch(e => console.log('[getDatiAssistitoCompleti] Nar2 fallito:', e.message));
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
                    out.data = {status: out.data?.data?.sogei?.status || false, data: out.data?.data?.sogei?.data};
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
                console.log(`[getDatiAssistitoFromCfSuSogeiNew] Errore tentativo Sogei:`, e.message);
                await this.getToken({fallback});
            }
        }
        if (!ok) {
            console.log(`[getDatiAssistitoFromCfSuSogeiNew] Sogei fallito dopo ${this._maxRetry} tentativi per CF: ${cf?.substring(0, 6)}***`);
            return {
                ok: false,
                fullData: null,
                data: assistito
            };
        }
    }



}
