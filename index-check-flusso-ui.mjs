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

        let cfSelezionato = null;
        let currentCfList = [];
        let id_list = [];
        let prestazioni_list = [];
        mainWindow.path_input = "C:\\Users\\roberto.dedomenico\\flussi_sanitari_wp\\20250115";

        // Gestione ricerca per codice fiscale
        mainWindow.filtra_cf = () => {
            const cf = mainWindow.cf_filter.toUpperCase();
            console.log("Cercando CF:", cf);
            currentCfList = Object.keys(mockData.data).filter((key) => key.includes(cf)).sort();
            mainWindow.cf_list = currentCfList;
            console.log("CF trovati:", mainWindow.cf_list.length);

            mainWindow.prestazioni_list = [];
            mainWindow.xml_content = "";
        };

        mainWindow.carica_dati_from_path = () => {
            let struttureMessina = new StruttureDistrettiPerProvincia(distretti, comuniDistretti, struttureDistrettiMap);
            let impostazioniServizi = new ImpostazioniServiziTerzi(configData);
            const siad = new FlussiRegioneSicilia.FlussoSIAD(struttureMessina, impostazioniServizi);
            const filesT1 = utils.getAllFilesRecursive(mainWindow.path_input, ".xml", "AA_SIAD_AP");
            const filesT2 = utils.getAllFilesRecursive(mainWindow.path_input, ".xml", "AA_SIAD_AA");

            if (filesT1.length === 1 && filesT2.length === 1) {
                Promise.resolve()
                    .then(() => siad.creaMappaTracciati(filesT1[0], filesT2[0]))
                    .then((result) => {
                        mockData = result;
                        currentCfList = Object.keys(mockData.data).sort();
                        mainWindow.cf_list = currentCfList;
                        mainWindow.is_loading = false;  // Ripristina lo stato normale
                    })
                    .catch((error) => {
                        console.error('Errore durante il caricamento:', error);
                        mainWindow.is_loading = false;  // Ripristina lo stato anche in caso di errore
                    });
            } else {
                mainWindow.is_loading = false;  // Ripristina lo stato se i file non sono validi
            }
        };

        mainWindow.seleziona_id = (index) => {
            console.log("ads");
            const idSelezionato = id_list[index];
            console.log("Lista ID corrente:", idSelezionato);
            prestazioni_list = Object.keys(mockData.data[cfSelezionato][idSelezionato].prestazioni).sort();
            mainWindow.prestazioni_list = prestazioni_list;
            mainWindow.xml_content = JSON.stringify(mockData.data[cfSelezionato][idSelezionato].xmlT1);
        }

        // Gestione selezione CF
        mainWindow.seleziona_cf = (index) => {
            console.log("Indice selezionato:", index);
            console.log("Lista ID corrente:", currentCfList);

            if (index < 0 || index >= currentCfList.length) {
                console.log("Indice non valido");
                return;
            }

            cfSelezionato = currentCfList[index];
            console.log("ID selezionato:", cfSelezionato);

            id_list = Object.keys(mockData.data[cfSelezionato]).sort();
            if (id_list.length === 0) {
                console.log("Dati non trovati per CF o ID");
                return;
            }

            console.log("Dati trovati per ID:", id_list.length);

/*            // Formatta le prestazioni
            const prestazioniFormattate = idData.prestazioni.map(
                p => `${p.nome} (${p.data})`
            );*/

            // Aggiorna l'interfaccia
            mainWindow.id_list = id_list;
            //mainWindow.xml_content = JSON.stringify(mockData.data[cf][selectedId].xmlT1);
        };

        mainWindow.show();
        await slint.runEventLoop();
    } catch (error) {
        console.error("Errore durante l'inizializzazione:", error);
    }
}

main().catch(console.error);