import * as slint from "slint-ui";
import {ImpostazioniServiziTerzi} from "./src/config/ImpostazioniServiziTerzi.js";
import configData from './config/config.json' with { type: 'json' };
import {Nar2} from "./src/narTsServices/Nar2.js";
import {utils} from "./src/Utils.js";
import { spawn } from "child_process";


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

        let _alertTimeout = null;
        const showAlert = (message, type = "info", durationMs = 3000) => {
            // Imposta contenuto e mostra
            mainWindow.alert_type = type;  // Usa la notazione con bracket per accedere alla property con trattino
            mainWindow.alert_message = message;
            mainWindow.alert_visibile = true;
            // Auto-hide dopo qualche secondo
            if (_alertTimeout) {
                clearTimeout(_alertTimeout);
            }
            if (durationMs && durationMs > 0) {
                _alertTimeout = setTimeout(() => {
                    mainWindow.alert_visibile = false;
                }, durationMs);
            }
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

        // Copia negli appunti il JSON di paziente_data (sempre, anche se vuoto)
        mainWindow.copia_json = async () => {
            try {
                const data = mainWindow.paziente_data ?? {};
                const jsonText = JSON.stringify(data, null, 2);

                if (process.platform === "win32") {
                    const proc = spawn("clip");
                    let hadError = false;
                    proc.stdin.on("error", (e) => {
                        hadError = true;
                        showAlert("Errore nella copia negli appunti: " + e.message, "error");
                    });
                    proc.on("error", (e) => {
                        hadError = true;
                        showAlert("Errore nell'esecuzione di clip: " + e.message, "error");
                    });
                    proc.on("close", (code) => {
                        if (!hadError && code === 0) {
                            showAlert("JSON copiato negli appunti.", "success");
                        } else if (!hadError) {
                            showAlert("Impossibile copiare negli appunti (codice: " + code + ")", "error");
                        }
                    });
                    proc.stdin.end(jsonText);
                } else {
                    // Fallback basico per altri OS (non garantito se utility non presenti)
                    showAlert("Copia negli appunti supportata attualmente solo su Windows.", "warning");
                }
            } catch (err) {
                showAlert("Errore inaspettato durante la copia: " + (err?.message ?? String(err)), "error");
            }
        };

        // Copia negli appunti il solo Codice Fiscale del paziente
        mainWindow.copia_cf = async () => {
            try {
                const cf = mainWindow.paziente_data?.cf ?? "";
                if (!cf) {
                    showAlert("Nessun CF da copiare", "warning");
                    return;
                }
                if (process.platform === "win32") {
                    const proc = spawn("clip");
                    let hadError = false;
                    proc.stdin.on("error", (e) => {
                        hadError = true;
                        showAlert("Errore nella copia negli appunti: " + e.message, "error");
                    });
                    proc.on("error", (e) => {
                        hadError = true;
                        showAlert("Errore nell'esecuzione di clip: " + e.message, "error");
                    });
                    proc.on("close", (code) => {
                        if (!hadError && code === 0) {
                            showAlert("CF copiato negli appunti.", "success");
                        } else if (!hadError) {
                            showAlert("Impossibile copiare negli appunti (codice: " + code + ")", "error");
                        }
                    });
                    proc.stdin.end(cf);
                } else {
                    showAlert("Copia negli appunti supportata attualmente solo su Windows.", "warning");
                }
            } catch (err) {
                showAlert("Errore inaspettato durante la copia: " + (err?.message ?? String(err)), "error");
            }
        };

        mainWindow.show();
        await slint.runEventLoop();
    } catch (error) {
        console.error("Errore durante l'inizializzazione:", error);
    }
}

main().catch(console.error);
