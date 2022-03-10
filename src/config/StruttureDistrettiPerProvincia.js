export class StruttureDistrettiPerProvincia {
    /**
     * @param {Object} distretti Distretti {idChiave: "Descrizione"}
     * @param {Object} comuniDistretti Comuni associati per ogni distretto {idDistretto: "codCatastaleComune"} da trovare su FlowLook
     * @param {Object} struttureDistrettiMap Eventuali strutture con dati diversi da quelli standard {"stsStruttura": idDistretto}
     * @param {Object} recapitiDistretti Array contenente le e-mail per ogni distretto
     */
    constructor(distretti,comuniDistretti, struttureDistrettiMap, recapitiDistretti) {
        this._distretti = distretti;
        this._comuniDistretti = comuniDistretti;
        this._struttureDistrettiMap = struttureDistrettiMap;
        this._recapitiDistretti = recapitiDistretti;
    }

    get distretti() {
        return this._distretti;
    }

    set distretti(value) {
        this._distretti = value;
    }

    get comuniDistretti() {
        return this._comuniDistretti;
    }

    set comuniDistretti(value) {
        this._comuniDistretti = value;
    }

    get struttureDistrettiMap() {
        return this._struttureDistrettiMap;
    }

    set struttureDistrettiMap(value) {
        this._struttureDistrettiMap = value;
    }

    get recapitiDistretti() {
        return this._recapitiDistretti;
    }

    set recapitiDistretti(value) {
        this._recapitiDistretti = value;
    }
}

