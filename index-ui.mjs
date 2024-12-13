import * as slint from "slint-ui";
import { createRequire } from 'module';
import {ImpostazioniServiziTerzi} from "./src/config/ImpostazioniServiziTerzi.js";
const require = createRequire(import.meta.url);
const configData = require('./config/config.json');
import {Nar2} from "./src/narTsServices/Nar2.js";
import {utils} from "./src/Utils.js";


async function main() {
    try {
        const ui = await slint.loadFile("ui/main.slint");
        const mainWindow = new ui.MainWindow();

        mainWindow.cf_input_changed = (value) => {
            // Converti in maiuscolo e aggiorna il valore
            mainWindow.cf_input = value.toUpperCase();
        };


        // Modificato per usare cerca_paziente invece di cercaPaziente
        mainWindow.cerca_paziente = async () => {
            try {
                mainWindow.is_loading = true;

                let impostazioniServizi = new ImpostazioniServiziTerzi(configData);
                let nar2 = new Nar2(impostazioniServizi);
                let data = await nar2.getDatiAssistitoFromCfSuSogei(mainWindow.cf_input);
                if (data.ok) {
                    // Aggiorna l'interfaccia usando gli stessi nomi delle proprietà del file Slint
                    mainWindow.paziente_data = utils.replaceNullWithEmptyString(data.data);
                }
            } catch (error) {
                console.error("Errore durante la ricerca:", error);
            } finally {
                mainWindow.is_loading = false;
            }
        };

        mainWindow.show();
        await slint.runEventLoop();
    } catch (error) {
        console.error("Errore durante l'inizializzazione:", error);
    }
}

main().catch(console.error);