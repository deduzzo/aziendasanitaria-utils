import * as slint from "slint-ui";
import {ImpostazioniServiziTerzi} from "./src/config/ImpostazioniServiziTerzi.js";
import configData from './config/config.json' with { type: 'json' };
import {Nar2} from "./src/narTsServices/Nar2.js";
import {utils} from "./src/Utils.js";


async function main() {
    try {

        const searchTypeMapping = {
            0: { value: "cf", text: "Codice Fiscale" },
            1: { value: "details", text: "Nome Cognome e Data" }
        };

        const ui = await slint.loadFile("ui/main.slint");
        const mainWindow = new ui.MainWindow();

        mainWindow.combo_options = Object.values(searchTypeMapping).map(item => item.text);

        // Gestione del cambio tipo ricerca
        mainWindow.on_search_type_changed = (index) => {
            console.log(index);
            const selectedType = searchTypeMapping[index];
            mainWindow.search_type = selectedType.value;

            // Resettiamo i campi appropriati
            if (selectedType.value === "cf") {
                mainWindow.reset_cf_fields();
            } else {
                mainWindow.reset_detail_fields();
            }
        };

        mainWindow.cf_input_changed = (value) => {
            // Converti in maiuscolo e aggiorna il valore
            mainWindow.cf_input = value.toUpperCase();
        };

        mainWindow.reset_cf_fields = () => {
            mainWindow.cf_input = "";
        };

        mainWindow.reset_detail_fields = () => {
            mainWindow.nome = "";
            mainWindow.cognome = "";
            mainWindow.data_nascita = "";
        };

        mainWindow.cf_input_changed = (value) => {
            mainWindow.cf_input = value.toUpperCase();
        };


        // Modificato per usare cerca_paziente invece di cercaPaziente
        mainWindow.cerca_paziente = async () => {
            try {
                mainWindow.is_loading = true;

                let impostazioniServizi = new ImpostazioniServiziTerzi(configData);
                let nar2 = new Nar2(impostazioniServizi);
                let data = await nar2.getDatiAssistitoCompleti(mainWindow.cf_input,{dateToUnix:true,replaceNullWithEmptyString:true});
                if (data.ok) {
                    // Aggiorna l'interfaccia usando gli stessi nomi delle proprietà del file Slint
                    mainWindow.paziente_data = data.dati();
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
