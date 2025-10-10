import * as slint from "slint-ui";
import {ImpostazioniServiziTerzi} from "./src/config/ImpostazioniServiziTerzi.js";
import configData from './config/config.json' with { type: 'json' };
import {Nar2} from "./src/narTsServices/Nar2.js";
import {utils} from "./src/Utils.js";
import { spawn } from "child_process";
import { WebSocketServer } from "ws";


async function main() {
    try {
        // WebSocket Server Setup
        const wss = new WebSocketServer({ port: 12345 });
        const clients = new Set();

        wss.on('connection', (ws) => {
            clients.add(ws);
            console.log(`Nuovo client connesso. Totale client: ${clients.size}`);

            ws.on('close', () => {
                clients.delete(ws);
                console.log(`Client disconnesso. Totale client: ${clients.size}`);
                if (mainWindow) {
                    mainWindow.ws_connected_clients = clients.size;
                }
            });

            ws.on('error', (error) => {
                console.error('Errore WebSocket:', error);
                clients.delete(ws);
                if (mainWindow) {
                    mainWindow.ws_connected_clients = clients.size;
                }
            });

            if (mainWindow) {
                mainWindow.ws_connected_clients = clients.size;
            }
        });

        wss.on('error', (error) => {
            console.error('Errore server WebSocket:', error);
            if (mainWindow) {
                mainWindow.ws_server_active = false;
            }
        });

        wss.on('listening', () => {
            console.log('Server WebSocket attivo sulla porta 12345');
        });

        const searchTypeMapping = {
            0: { value: "cf", text: "Codice Fiscale" },
            1: { value: "details", text: "Nome Cognome e Data" }
        };

        const ui = await slint.loadFile("ui/main.slint",{ style: "cosmic" });
        const mainWindow = new ui.MainWindow();
        // change mainWindow theme to cupertino-light

        // Initialize WebSocket status
        mainWindow.ws_server_active = true;
        mainWindow.ws_connected_clients = 0;

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

        // Funzione helper per inviare comandi WebSocket strutturati
        const sendWebSocketCommand = (command, data = {}) => {
            if (clients.size === 0) {
                showAlert("Nessun client connesso al server WebSocket", "warning");
                return false;
            }

            const message = JSON.stringify({ command, data });
            let successCount = 0;
            let errorCount = 0;

            clients.forEach((client) => {
                if (client.readyState === 1) { // WebSocket.OPEN
                    try {
                        client.send(message);
                        successCount++;
                    } catch (err) {
                        errorCount++;
                        console.error("Errore nell'invio al client:", err);
                    }
                } else {
                    errorCount++;
                }
            });

            if (errorCount === 0) {
                showAlert(`Comando "${command}" inviato a ${successCount} client`, "success");
            } else {
                showAlert(`Comando inviato a ${successCount} client, ${errorCount} errori`, "warning");
            }
            return true;
        };

        // Invia i dati del paziente a tutti i client WebSocket connessi
        mainWindow.invia_dati_ws = () => {
            try {
                const pazienteData = mainWindow.paziente_data ?? {};
                sendWebSocketCommand("inviaDatiPaziente", pazienteData);
            } catch (err) {
                showAlert("Errore nell'invio dei dati: " + (err?.message ?? String(err)), "error");
            }
        };

        // Apri menu ricerca assistito
        mainWindow.apri_menu_ricerca = () => {
            try {
                sendWebSocketCommand("apriMenuRicercaAssistito");
            } catch (err) {
                showAlert("Errore nell'invio comando: " + (err?.message ?? String(err)), "error");
            }
        };

        // Inserisci CF nella ricerca e clicca OK
        mainWindow.inserisci_ricerca_cf = () => {
            try {
                sendWebSocketCommand("inserisciRicercaCf");
            } catch (err) {
                showAlert("Errore nell'invio comando: " + (err?.message ?? String(err)), "error");
            }
        };

        // Aggiungi nuovo assistito e compila form
        mainWindow.aggiungi_nuovo_assistito = () => {
            try {
                sendWebSocketCommand("aggiungiNuovoAssistito");
            } catch (err) {
                showAlert("Errore nell'invio comando: " + (err?.message ?? String(err)), "error");
            }
        };

        // Salva modifiche
        mainWindow.salva = () => {
            try {
                sendWebSocketCommand("salva");
            } catch (err) {
                showAlert("Errore nell'invio comando: " + (err?.message ?? String(err)), "error");
            }
        };

        // Apri scheda indirizzo
        mainWindow.scheda_indirizzo = () => {
            try {
                sendWebSocketCommand("schedaIndirizzo");
            } catch (err) {
                showAlert("Errore nell'invio comando: " + (err?.message ?? String(err)), "error");
            }
        };

        // Configura metodo di pagamento
        mainWindow.metodo_pagamento = () => {
            try {
                sendWebSocketCommand("metodoPagamento");
            } catch (err) {
                showAlert("Errore nell'invio comando: " + (err?.message ?? String(err)), "error");
            }
        };

        mainWindow.show();
        await slint.runEventLoop();
    } catch (error) {
        console.error("Errore durante l'inizializzazione:", error);
    }
}

main().catch(console.error);
