export class StruttureDistrettiPerProvincia {
    /**
     * @param {Object} distretti Distretti {idChiave: "Descrizione"}
     * @param {Object} comuniDistretti Comuni associati per ogni distretto {idDistretto: "codCatastaleComune"} da trovare su FlowLook
     * @param {Object} struttureDistrettiMap Eventuali strutture con dati diversi da quelli standard {"stsStruttura": idDistretto}
     */
    constructor(distretti,comuniDistretti, struttureDistrettiMap) {
        this._distretti = distretti;
        this._comuniDistretti = comuniDistretti;
        this._struttureDistrettiMap = struttureDistrettiMap;
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
}

