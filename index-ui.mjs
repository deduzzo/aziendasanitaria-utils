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

        const ui = await slint.loadFile("ui/main.slint",{ style: "cosmic" });
        const mainWindow = new ui.MainWindow();
        // change mainWindow theme to cupertino-light

        mainWindow.combo_options = Object.values(searchTypeMapping).map(item => item.text);

        const showAlert = (message, type = "info") => {
            mainWindow.alert_type = type;  // Usa la notazione con bracket per accedere alla property con trattino
            mainWindow.alert_message = message;
            mainWindow.alert_visibile = true;
        }

        mainWindow.close_alert = () => {
            mainWindow.alert_visibile = false;
        };

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
                let data = await nar2.getDatiAssistitoCompleti(mainWindow.cf_input, {replaceNullWithEmptyString: true});
                if (data.ok) {
                    // Aggiorna l'interfaccia usando gli stessi nomi delle proprietà del file Slint
                    mainWindow.paziente_data = data.dati();
                    if (!mainWindow.paziente_data.inVita)
                        showAlert("Il paziente è deceduto", "warning");
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
