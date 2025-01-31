import {utils} from "../Utils.js";
import moment from "moment-timezone";

moment.tz.setDefault('Europe/Rome');

export const DATI = {
    CF: "cf",
    CF_NORMALIZZATO: "cfNormalizzato",
    COGNOME: "cognome",
    NOME: "nome",
    SESSO: "sesso",
    DATA_NASCITA: "dataNascita",
    COMUNE_NASCITA: "comuneNascita",
    COD_COMUNE_NASCITA: "codComuneNascita",
    COD_ISTAT_COMUNE_NASCITA: "codIstatComuneNascita",
    PROVINCIA_NASCITA: "provinciaNascita",
    INDIRIZZO_RESIDENZA: "indirizzoResidenza",
    CAP_RESIDENZA: "capResidenza",
    COMUNE_RESIDENZA: "comuneResidenza",
    COD_COMUNE_RESIDENZA: "codComuneResidenza",
    COD_ISTAT_COMUNE_RESIDENZA: "codIstatComuneResidenza",
    ASP: "asp",
    SSN_TIPO_ASSISTITO: "ssnTipoAssistito",
    SSN_INIZIO_ASSISTENZA: "ssnInizioAssistenza",
    SSN_FINE_ASSISTENZA: "ssnFineAssistenza",
    SSN_MOTIVAZIONE_FINE_ASSISTENZA: "ssnMotivazioneFineAssistenza",
    SSN_NUMERO_TESSERA: "ssnNumeroTessera",
    MMG_ULTIMA_OPERAZIONE: "MMGUltimaOperazione",
    MMG_ULTIMO_STATO: "MMGUltimoStato",
    MMG_TIPO: "MMGTipo",
    MMG_COD_REG: "MMGCodReg",
    MMG_NOME: "MMGNome",
    MMG_COGNOME: "MMGCognome",
    MMG_CF: "MMGCf",
    MMG_DATA_SCELTA: "MMGDataScelta",
    MMG_DATA_REVOCA: "MMGDataRevoca",
    DATA_DECESSO: "dataDecesso"
};

export const tipoDati = {
    [DATI.CF]: "string",
    [DATI.CF_NORMALIZZATO]: "string",
    [DATI.COGNOME]: "string",
    [DATI.NOME]: "string",
    [DATI.SESSO]: "string",
    [DATI.DATA_NASCITA]: "date",
    [DATI.COMUNE_NASCITA]: "string",
    [DATI.COD_COMUNE_NASCITA]: "string",
    [DATI.COD_ISTAT_COMUNE_NASCITA]: "string",
    [DATI.PROVINCIA_NASCITA]: "string",
    [DATI.INDIRIZZO_RESIDENZA]: "string",
    [DATI.CAP_RESIDENZA]: "string",
    [DATI.COD_COMUNE_RESIDENZA]: "string",
    [DATI.COD_ISTAT_COMUNE_RESIDENZA]: "string",
    [DATI.ASP]: "string",
    [DATI.SSN_TIPO_ASSISTITO]: "string",
    [DATI.SSN_INIZIO_ASSISTENZA]: "date",
    [DATI.SSN_FINE_ASSISTENZA]: "date",
    [DATI.SSN_MOTIVAZIONE_FINE_ASSISTENZA]: "string",
    [DATI.SSN_NUMERO_TESSERA]: "string",
    [DATI.MMG_ULTIMA_OPERAZIONE]: "string",
    [DATI.MMG_ULTIMO_STATO]: "string",
    [DATI.MMG_TIPO]: "string",
    [DATI.MMG_COD_REG]: "string",
    [DATI.MMG_NOME]: "string",
    [DATI.MMG_COGNOME]: "string",
    [DATI.MMG_CF]: "string",
    [DATI.MMG_DATA_SCELTA]: "date",
    [DATI.MMG_DATA_REVOCA]: "date",
    [DATI.DATA_DECESSO]: "date"
}

// Funzione per creare un oggetto con tutte le costanti inizializzate a null
const createEmptyState = () => {
    return {
        [DATI.CF]: null,
        [DATI.CF_NORMALIZZATO]: null,
        [DATI.COGNOME]: null,
        [DATI.NOME]: null,
        [DATI.SESSO]: null,
        [DATI.DATA_NASCITA]: null,
        [DATI.COMUNE_NASCITA]: null,
        [DATI.COD_COMUNE_NASCITA]: null,
        [DATI.COD_ISTAT_COMUNE_NASCITA]: null,
        [DATI.PROVINCIA_NASCITA]: null,
        [DATI.INDIRIZZO_RESIDENZA]: null,
        [DATI.COMUNE_RESIDENZA]: null,
        [DATI.CAP_RESIDENZA]: null,
        [DATI.COD_COMUNE_RESIDENZA]: null,
        [DATI.COD_ISTAT_COMUNE_RESIDENZA]: null,
        [DATI.ASP]: null,
        [DATI.SSN_TIPO_ASSISTITO]: null,
        [DATI.SSN_INIZIO_ASSISTENZA]: null,
        [DATI.SSN_FINE_ASSISTENZA]: null,
        [DATI.SSN_MOTIVAZIONE_FINE_ASSISTENZA]: null,
        [DATI.SSN_NUMERO_TESSERA]: null,
        [DATI.MMG_ULTIMA_OPERAZIONE]: null,
        [DATI.MMG_ULTIMO_STATO]: null,
        [DATI.MMG_TIPO]: null,
        [DATI.MMG_COD_REG]: null,
        [DATI.MMG_NOME]: null,
        [DATI.MMG_COGNOME]: null,
        [DATI.MMG_CF]: null,
        [DATI.MMG_DATA_SCELTA]: null,
        [DATI.MMG_DATA_REVOCA]: null,
        [DATI.DATA_DECESSO]: null
    };
};

export class Assistito {
    #dataFromNar;
    #dataFromNar2;
    #dataFromTs;
    #fullData = {
        Nar: null,
        Nar2: null,
        Ts: null
    };
    #okNar = null;
    #okNar2 = null;
    #okTs = false;
    #erroreNar = null;
    #erroreNar2 = null;
    #erroreTs = null;
    #replaceNullWithEmptyString = false;

    /**
     * Costruttore della classe Assistito.
     *
     * @param {Object} config Configurazione iniziale
     * @param {boolean} [config.replaceNullWithEmptyString=false] Sostituisce i valori null con stringhe vuote
     */
    constructor(config = {}) {
        const {
            replaceNullWithEmptyString = false
        } = config;
        this.#dataFromNar = createEmptyState();
        this.#dataFromNar2 = createEmptyState();
        this.#dataFromTs = createEmptyState();
        this.#replaceNullWithEmptyString = replaceNullWithEmptyString;

    }

    // Metodo helper per validare le chiavi
    #validateKey(key) {
        if (!Object.values(DATI).includes(key)) {
            throw new Error(`Proprietà "${key}" non valida. Usa una delle costanti DATI.`);
        }
        return true;
    }

    // Getter e Setter per dataFromNar
    get fromNar() {
        return {...this.#dataFromNar};
    }

    setNar(key, value) {
        if (this.#validateKey(key)) {
            this.#dataFromNar[key] = value;
        }
    }

    // Getter e Setter per dataFromNar2
    get fromNar2() {
        return {...this.#dataFromNar2};
    }


    setNar2(key, value) {
        if (this.#validateKey(key)) {
            this.#dataFromNar2[key] = value;
        }
    }

    // Getter e Setter per dataFromTs
    get fromTs() {
        return {...this.#dataFromTs};
    }

    setTs(key, value) {
        if (this.#validateKey(key)) {
            this.#dataFromTs[key] = value;
        }
    }

    // Getter e Setter per fullData
    get fullDataNar() {
        return this.#fullData.Nar;
    }

    set fullDataNar(value) {
        this.#fullData.Nar = value;
    }

    get fullDataNar2() {
        return this.#fullData.Nar2;
    }

    set fullDataNar2(value) {
        this.#fullData.Nar2 = value;
    }

    get fullDataTs() {
        return this.#fullData.Ts;
    }

    set fullDataTs(value) {
        this.#fullData.Ts = value;
    }

    #getDatoConFallback(campo) {
        const getValue = (data) => {
            const value = data[campo];
            // Controlla se il valore è una stringa vuota o null/undefined
    return value === '' || value === null || value === undefined || (typeof value === 'number' && isNaN(value)) || (tipoDati[campo] === "date" && typeof value === "string" && value.toLowerCase().includes("illimi")) ? null : value;
        };

        return getValue(this.#dataFromTs) ??
            getValue(this.#dataFromNar2) ??
            getValue(this.#dataFromNar);
    }

    get cf() {
        return this.#getDatoConFallback(DATI.CF);
    }

    get cfNormalizzato() {
        return this.#getDatoConFallback(DATI.CF_NORMALIZZATO);
    }

    get cognome() {
        return this.#getDatoConFallback(DATI.COGNOME);
    }

    get nome() {
        return this.#getDatoConFallback(DATI.NOME);
    }

    get sesso() {
        return this.#getDatoConFallback(DATI.SESSO);
    }

    get dataNascita() {
        return this.#getDatoConFallback(DATI.DATA_NASCITA);
    }

    get comuneNascita() {
        return this.#getDatoConFallback(DATI.COMUNE_NASCITA);
    }

    get codComuneNascita() {
        return this.#getDatoConFallback(DATI.COD_COMUNE_NASCITA);
    }

    get codIstatComuneNascita() {
        return this.#getDatoConFallback(DATI.COD_ISTAT_COMUNE_NASCITA);
    }

    get provinciaNascita() {
        return this.#getDatoConFallback(DATI.PROVINCIA_NASCITA);
    }

    get indirizzoResidenza() {
        return this.#getDatoConFallback(DATI.INDIRIZZO_RESIDENZA);
    }

    get capResidenza() {
        return this.#getDatoConFallback(DATI.CAP_RESIDENZA);
    }

    get comuneResidenza() {
        return this.#getDatoConFallback(DATI.COMUNE_RESIDENZA);
    }

    get codComuneResidenza() {
        return this.#getDatoConFallback(DATI.COD_COMUNE_RESIDENZA);
    }

    get codIstatComuneResidenza() {
        return this.#getDatoConFallback(DATI.COD_ISTAT_COMUNE_RESIDENZA);
    }

    get asp() {
        return this.#getDatoConFallback(DATI.ASP);
    }

    get ssnTipoAssistito() {
        return this.#getDatoConFallback(DATI.SSN_TIPO_ASSISTITO);
    }

    get ssnInizioAssistenza() {
        return this.#getDatoConFallback(DATI.SSN_INIZIO_ASSISTENZA);
    }

    get ssnFineAssistenza() {
        return this.#getDatoConFallback(DATI.SSN_FINE_ASSISTENZA);
    }

    get ssnMotivazioneFineAssistenza() {
        return this.#getDatoConFallback(DATI.SSN_MOTIVAZIONE_FINE_ASSISTENZA);
    }

    get ssnNumeroTessera() {
        return this.#getDatoConFallback(DATI.SSN_NUMERO_TESSERA);
    }

    get mmgUltimaOperazione() {
        return this.#getDatoConFallback(DATI.MMG_ULTIMA_OPERAZIONE);
    }

    get mmgUltimoStato() {
        return this.#getDatoConFallback(DATI.MMG_ULTIMO_STATO);
    }

    get mmgTipo() {
        return this.#getDatoConFallback(DATI.MMG_TIPO);
    }

    get mmgCodReg() {
        return this.#getDatoConFallback(DATI.MMG_COD_REG);
    }

    get mmgNome() {
        return this.#getDatoConFallback(DATI.MMG_NOME);
    }

    get mmgCognome() {
        return this.#getDatoConFallback(DATI.MMG_COGNOME);
    }

    get mmgCf() {
        return this.#getDatoConFallback(DATI.MMG_CF);
    }

    get mmgDataScelta() {
        return this.#getDatoConFallback(DATI.MMG_DATA_SCELTA);
    }

    get mmgDataRevoca() {
        return this.#getDatoConFallback(DATI.MMG_DATA_REVOCA);
    }

    get dataDecesso() {
        return this.#getDatoConFallback(DATI.DATA_DECESSO);
    }

    get inVita() {
        return !this.dataDecesso;
    }


    eta(atDate = null) {
        // using moments and consider the date of death if present
        const dataNascita =  moment(this.dataNascita, "DD/MM/YYYY");
        const dataDecesso = moment(this.dataDecesso, "DD/MM/YYYY");
        const dataRiferimento = atDate ? moment(atDate, "DD/MM/YYYY") : moment();

        if (this.dataDecesso || atDate) {
            return dataRiferimento.diff(dataNascita, 'years');
        } else {
            return moment().diff(dataNascita, 'years');
        }
    }


    /**
     * Restituisce un oggetto con i dati dell'assistito, includendo l'età e lo stato di vita.
     *
     * @param {Object} [options={}] - Opzioni per la generazione dei dati.
     * @param {boolean} [options.dateToUnix=this.#dateToUnix] - Se true, converte le date in formato Unix.
     * @returns {Object} Oggetto contenente i dati dell'assistito.
     */
    dati(options = {}) {
        const { dateToUnix = false } = options;

        let out = {
            ...Object.values(DATI).reduce((acc, key) => {
                let value = this.#getDatoConFallback(key);

                // Converti le date in Unix se richiesto
                if (dateToUnix && tipoDati[key] === "date" && value && value !== "") {
                    value = utils.convertToUnixSeconds(value, 'Europe/Rome');
                }

                acc[key] = value;
                return acc;
            }, {}),
            inVita: this.inVita,
            eta: this.eta()
        }

        return this.#replaceNullWithEmptyString ? utils.replaceNullWithEmptyString(out) : out;
    }

    get okNar() {
        return this.#okNar;
    }

    set okNar(value) {
        this.#okNar = value;
    }

    get okNar2() {
        return this.#okNar2;
    }

    set okNar2(value) {
        this.#okNar2 = value;
    }

    get okTs() {
        return this.#okTs;
    }

    set okTs(value) {
        this.#okTs = value;
    }

    get erroreNar() {
        return this.#erroreNar;
    }

    set erroreNar(value) {
        this.#erroreNar = value;
    }

    get erroreNar2() {
        return this.#erroreNar2;
    }

    set erroreNar2(value) {
        this.#erroreNar2 = value;
    }

    get erroreTs() {
        return this.#erroreTs;
    }

    set erroreTs(value) {
        this.#erroreTs = value;
    }

    get ok() {
        // ritorna true se almeno uno dei tre flussi è ok
        return this.okNar || this.okNar2 || this.okTs;
    }
}
