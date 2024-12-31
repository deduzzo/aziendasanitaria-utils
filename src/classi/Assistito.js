import moment from "moment";

export const DATI = {
    CF: "cf",
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
    MMG_NOMINATIVO_COMPLETO: "MMGNominativoCompleto",
    MMG_NOME: "MMGNome",
    MMG_COGNOME: "MMGCognome",
    MMG_CF: "MMGCf",
    MMG_DATA_SCELTA: "MMGDataScelta",
    MMG_DATA_REVOCA: "MMGDataRevoca",
    DATA_DECESSO: "dataDecesso"
};

// Funzione per creare un oggetto con tutte le costanti inizializzate a null
const createEmptyState = () => {
    return {
        [DATI.CF]: null,
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
        [DATI.MMG_NOMINATIVO_COMPLETO]: null,
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

    constructor() {
        this.#dataFromNar = createEmptyState();
        this.#dataFromNar2 = createEmptyState();
        this.#dataFromTs = createEmptyState();
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

    // Metodo helper per implementare la logica di fallback
    #getDatoConFallback(campo) {
        return this.#dataFromTs[campo] ?? this.#dataFromNar2[campo] ?? this.#dataFromNar[campo];
    }

    // [... resto dei getter per ogni campo rimane invariato ...]
    get cf() {
        return this.#getDatoConFallback(DATI.CF);
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

    get mmgNominativoCompleto() {
        return this.#getDatoConFallback(DATI.MMG_NOMINATIVO_COMPLETO);
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
        if (this.dataDecesso || atDate) {
            return moment(atDate ?? this.dataDecesso, "DD/MM/YYYY").diff(moment(this.dataNascita, "DD/MM/YYYY"), 'years');
        } else {
            return moment().diff(moment(this.dataNascita, "DD/MM/YYYY"), 'years');
        }
    }

    getDati() {
        return {
            ...Object.values(DATI).reduce((acc, key) => {
                acc[key] = this.#getDatoConFallback(key);
                return acc;
            }, {}),
            inVita: this.inVita,
            eta: this.eta()
        };
    }
}