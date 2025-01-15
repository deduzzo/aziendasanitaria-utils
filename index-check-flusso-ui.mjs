import * as slint from "slint-ui";
import { createRequire } from 'module';
import {ImpostazioniServiziTerzi} from "./src/config/ImpostazioniServiziTerzi.js";
import {flussiRegioneSicilia as FlussiRegioneSicilia} from "./index.js";
import {StruttureDistrettiPerProvincia} from "./src/config/StruttureDistrettiPerProvincia.js";
const require = createRequire(import.meta.url);
const configData = require('./config/config.json');
import {struttureDistrettiMap, distretti, comuniDistretti} from "./src/config/sicilia/messina.js";
import {utils} from "./src/Utils.js";

async function main() {
    try {
        const ui = await slint.loadFile("ui/check-flusso.slint");
        const mainWindow = new ui.MainWindow();

        // Dati di prova ristrutturati
        let mockData = {data: {}, errors: [], duplicati: {}};
        /* = {
            "RSSMRA80A01H501U": {
                "ID001": {
                    prestazioni: [
                        {
                            nome: "Visita Cardiologica",
                            data: "2024-01-15"
                        },
                        {
                            nome: "ECG",
                            data: "2024-01-16"
                        }
                    ],
                    xml: '<prestazione>\n  <id>ID001</id>\n  <prestazioni>\n    <prestazione>\n      <tipo>Visita Cardiologica</tipo>\n      <data>2024-01-15</data>\n      <medico>Dr. Bianchi</medico>\n    </prestazione>\n    <prestazione>\n      <tipo>ECG</tipo>\n      <data>2024-01-16</data>\n      <medico>Dr. Bianchi</medico>\n    </prestazione>\n  </prestazioni>\n</prestazione>'
                },
                "ID002": {
                    prestazioni: [
                        {
                            nome: "Visita Ortopedica",
                            data: "2024-01-20"
                        }
                    ],
                    xml: '<prestazione>\n  <id>ID002</id>\n  <prestazioni>\n    <prestazione>\n      <tipo>Visita Ortopedica</tipo>\n      <data>2024-01-20</data>\n      <medico>Dr. Verdi</medico>\n    </prestazione>\n  </prestazioni>\n</prestazione>'
                }
            }
        };*/

        let currentIdList = [];
        let currentCfList = [];
        mainWindow.path_input = "/Users/deduzzo/flussi_sanitari_wp/20250113/test";

        // Gestione ricerca per codice fiscale
        mainWindow.filtra_cf = () => {
            const cf = mainWindow.cf_filter.toUpperCase();
            console.log("Cercando CF:", cf);
            mainWindow.cf_list =

            if (mockData.data[cf]) {
                console.log("CF trovato");
                currentIdList = Object.keys(mockData.data[cf]);
                console.log("Lista ID:", currentIdList);
                mainWindow.id_list = currentIdList;
            } else {
                console.log("CF non trovato");
                currentIdList = [];
                mainWindow.id_list = [];
            }
            mainWindow.prestazioni_list = [];
            mainWindow.xml_content = "";
        };

        mainWindow.carica_dati_from_path = () => {
            let struttureMessina = new StruttureDistrettiPerProvincia(distretti, comuniDistretti, struttureDistrettiMap)
            let impostazioniServizi = new ImpostazioniServiziTerzi(configData);
            const siad = new FlussiRegioneSicilia.FlussoSIAD(struttureMessina,impostazioniServizi);
            const filesT1 = utils.getAllFilesRecursive(mainWindow.path_input, ".xml","AA_SIAD_AP");
            const filesT2 = utils.getAllFilesRecursive(mainWindow.path_input, ".xml","AA_SIAD_AA");
            if (filesT1.length === 1 && filesT2.length === 1) {
                mockData = siad.creaMappaTracciati(filesT1[0],filesT2[0]);
            }
            mainWindow.cf_list = Object.keys(mockData.data).sort();
        };

        // Gestione selezione ID
        mainWindow.seleziona_id = (index) => {
            console.log("Indice selezionato:", index);
            console.log("Lista ID corrente:", currentIdList);

            if (index < 0 || index >= currentIdList.length) {
                console.log("Indice non valido");
                return;
            }

            const selectedId = currentIdList[index];
            console.log("ID selezionato:", selectedId);


            const cf = mainWindow.cf_input.toUpperCase();
            if (mockData.data[cf][selectedId].prestazioni.length === 0) {
                console.log("Dati non trovati per CF o ID");
                return;
            }

            const idData = Object.keys(mockData.data[cf][selectedId].prestazioni);
            console.log("Dati trovati per ID:", selectedId);

/*            // Formatta le prestazioni
            const prestazioniFormattate = idData.prestazioni.map(
                p => `${p.nome} (${p.data})`
            );*/

            // Aggiorna l'interfaccia
            mainWindow.prestazioni_list = idData;
            mainWindow.xml_content = JSON.stringify(mockData.data[cf][selectedId].xmlT1);

            console.log("Prestazioni caricate:", idData.length);
        };

        mainWindow.show();
        await slint.runEventLoop();
    } catch (error) {
        console.error("Errore durante l'inizializzazione:", error);
    }
}

main().catch(console.error);