import pdf2html from "pdf2html";

export class MediciDiBase {

    constructor() {

    }

    async getAssistitiByPdf(pdfPath) {
        let out = {}
        const html = await pdf2html.text('D:\\DATI\\Desktop\\outFolder\\test.pdf');
        let ready = false;
        for (let line of html.split("\n")) {
            if (!ready && line.toUpperCase().includes("ASSISTITI IN CARICO AL MEDICO DI BASE"))
                ready = true;
            else if (ready) {
                let assistitoRow = line.split(" ");
                if (assistitoRow.length >= 9) {

                    assistitoRow[3] = assistitoRow[3].replaceAll(assistitoRow[8], "");
                    console.log(assistitoRow);
                    out[assistitoRow[assistitoRow.length-1]] = {
                        nome: assistitoRow[3],
                        cognome: assistitoRow[2],
                        sesso: assistitoRow[assistitoRow.length-5],
                        dataNascita: assistitoRow[assistitoRow.length-4],
                        codiceFiscale: assistitoRow[assistitoRow.length-1],
                        codiceComuneResidenza: assistitoRow[assistitoRow.length-3],
                    }
                    // TODO: GESTIRE PIU' NOMI
                }
            }
        }
        return out;
    }

}
