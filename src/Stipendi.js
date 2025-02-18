import {utils} from "./Utils.js";

class Stipendi {

    static async getDataFromCedoliniConvenzionati(path) {
        let datiAssistiti = {};
        const splitPagina = "ASP MESSINA - ";
        const datiCed = await utils.getHtmlFromPdf(path);
        let pagine = datiCed.split(splitPagina);
        for (let pagina of pagine) {
            let righe = pagina.split("\n");
            let datiMedicoTrovati = false;
            for (let riga of righe.slice(15)) {
                riga = riga.trim();
                // codice the first 4 digit of the riga
                const codice = riga.substring(0, 4);
                // first tab is the first 52 char
                const tab1 = riga.substring(0, 52);
                const descrizione = tab1.replace(codice, "").trim();
                console.log(descrizione);
            }
        }
        console.log("fine");
    }
}

export default Stipendi;
