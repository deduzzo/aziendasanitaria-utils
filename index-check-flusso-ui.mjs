import * as slint from "slint-ui";
import {ImpostazioniServiziTerzi} from "./src/config/ImpostazioniServiziTerzi.js";
import {flussiRegioneSicilia as FlussiRegioneSicilia} from "./index.js";
import {StruttureDistrettiPerProvincia} from "./src/config/StruttureDistrettiPerProvincia.js";

import configData from './config/config.json' assert { type: 'json' };
import {struttureDistrettiMap, distretti, comuniDistretti} from "./src/config/sicilia/messina.js";
import {utils} from "./src/Utils.js";
import fs from "fs";
import path from "path";
import moment from "moment";


const dbFile = "siad.mpdb";


async function main() {
    try {
        const ui = await slint.loadFile("ui/check-flusso.slint");
        const mainWindow = new ui.MainWindow();

        // Dati di prova ristrutturati
        let xmlData = {data: {}, errors: [], duplicati: {}};
        let ministeroData = {};
        let allData = {tutti: {}, over65: {}, pic: {}, attivita: {}};
        let altri = {}

        let cfSelezionato = null;
        let currentCfList = [];
        let id_list = [];
        let prestazioni_list = [];

        mainWindow.path_input = utils.getWorkingPath();

        const showAlert = (message, type = "info") => {
            mainWindow.alert_type = type;  // Usa la notazione con bracket per accedere alla property con trattino
            mainWindow.alert_message = message;
            mainWindow.alert_visible = true;
        }

/*        // STATISTICHE FLUSSO XML
            in-out property <int> xml-assistiti: 0;
            in-out property <int> xml-over65: 0;
            in-out property <int> xml-pic: 0;
            in-out property <int> xml-attivita: 0;

                // STATISTICHE DATI VALIDI MINISTERO
            in-out property <int> min-assistiti: 0;
            in-out property <int> min-over65: 0;
            in-out property <int> min-pic: 0;
            in-out property <int> min-attivita: 0;

                // STATISTICHE TOTALI
            in-out property <int> tot-assistiti: 0;
            in-out property <int> tot-over65: 0;
            in-out property <int> tot-pic: 0;
            in-out property <int> tot-attivita: 0;*/
        const aggiornaStatistiche = () => {
            allData = {tutti: {}, over65: {}, pic: {}, attivita: {}};
            const allCfMinistero = Object.keys(ministeroData.mappaDatiMinistero.allCfTrattati);
            const allCfXml = Object.keys(xmlData.data);
            const allAltri = Object.keys(altri);
            let allTotali = {};
            for (let cf of [...allCfMinistero, ...allCfXml, ...allAltri]) {
                allTotali[cf] = cf;
            }
            for (let cf of Object.keys(allTotali)) {
                allData.tutti[cf] = cf;
                const vivo = ministeroData.fromTS.out.vivi.hasOwnProperty(cf) ? ministeroData.fromTS.out.vivi[cf] : null;
                const morto = ministeroData.fromTS.out.morti.hasOwnProperty(cf) ? ministeroData.fromTS.out.morti[cf] : null;
                const altro = altri.hasOwnProperty(cf) ? altri[cf] : null;
                let eta = null;
                if (vivo)
                    eta = moment().diff(moment(vivo.dataNascita, "DD/MM/YYYY"), 'years');
                else if (morto)
                    eta = moment(morto.dataNascita,"DD/MM/YYYY").diff(moment(morto.dataDecesso, "DD/MM/YYYY"), 'years');
                else if (altro)
                    eta = moment().diff(moment(altro), 'years');
                else
                    eta = utils.getAgeFromCF(cf);
                if (eta >= 65) {
                    allData.over65[cf] = cf;
                }
            }



            mainWindow.xml_assistiti = Object.keys(xmlData.data).length;
            mainWindow.xml_over65 = 0; // TODO
            mainWindow.xml_pic = 0;
            mainWindow.xml_attivita = 0;

            mainWindow.min_assistiti = Object.keys(ministeroData.mappaDatiMinistero.allCfTrattati).length;
            mainWindow.min_over65 = 0;
            mainWindow.min_pic = 0;
            mainWindow.min_attivita = 0;

            mainWindow.tot_assistiti = Object.keys(allData.tutti).length;
            mainWindow.tot_over65 =Object.keys(allData.over65).length;
            mainWindow.tot_pic = 0;
            mainWindow.tot_attivita = 0;
        }

        mainWindow.close_alert = () => {
            mainWindow.alert_visible = false;
        };

        // Gestione ricerca per codice fiscale
        mainWindow.filtra_cf = () => {
            const cf = mainWindow.cf_filter.toUpperCase();
            console.log("Cercando CF:", cf);
            currentCfList = Object.keys(xmlData.data).filter((key) => key.includes(cf)).sort();
            mainWindow.cf_list = currentCfList;
            console.log("CF trovati:", mainWindow.cf_list.length);

            mainWindow.prestazioni_list = [];
            mainWindow.xml_content = "";
        };

        mainWindow.carica_dati_from_path = async () => {
            let struttureMessina = new StruttureDistrettiPerProvincia(distretti, comuniDistretti, struttureDistrettiMap);
            let impostazioniServizi = new ImpostazioniServiziTerzi(configData);
            const siad = new FlussiRegioneSicilia.FlussoSIAD(struttureMessina, impostazioniServizi);
            const filesT1 = utils.getAllFilesRecursive(mainWindow.path_input, ".xml", "AA_SIAD_AP");
            const filesT2 = utils.getAllFilesRecursive(mainWindow.path_input, ".xml", "AA_SIAD_AA");
            const fileAltri = fs.existsSync(mainWindow.path_input + path.sep + "altri.xlsx") ?
                await utils.getObjectFromFileExcel(mainWindow.path_input + path.sep + "altri.xlsx") : [];

            if (fs.existsSync(mainWindow.path_input) && fs.existsSync(mainWindow.path_input + path.sep + dbFile)) {
                ministeroData = await utils.leggiOggettoMP(mainWindow.path_input + path.sep + dbFile);
            }
            if (fileAltri.length > 0) {
                for (let riga of fileAltri) {
                    altri[riga.cf] = riga.data_nascita;
                }
            }
            if (filesT1.length === 1 && filesT2.length === 1) {
                let result = siad.creaMappaTracciati(filesT1[0], filesT2[0]);
                xmlData = result;
                currentCfList = Object.keys(xmlData.data).sort();
                mainWindow.cf_list = currentCfList;
                mainWindow.is_loading = false;  // Ripristina lo stato normale
                aggiornaStatistiche();
            } else {
                showAlert("Errore: i file T1 e T2 non sono presenti o non sono univoci", "error");
                mainWindow.is_loading = false;  // Ripristina lo stato se i file non sono validi
            }
        };

        mainWindow.seleziona_id = (index) => {
            console.log("ads");
            const idSelezionato = id_list[index];
            console.log("Lista ID corrente:", idSelezionato);
            prestazioni_list = Object.keys(xmlData.data[cfSelezionato][idSelezionato].prestazioni).sort();
            mainWindow.prestazioni_list = prestazioni_list;
            mainWindow.xml_content = JSON.stringify(xmlData.data[cfSelezionato][idSelezionato].xmlT1);
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

            id_list = Object.keys(xmlData.data[cfSelezionato]).sort();
            if (id_list.length === 0) {
                console.log("Dati non trovati per CF o ID");
                return;
            }

            console.log("Dati trovati per ID:", id_list.length);
            prestazioni_list = [];

            // Aggiorna l'interfaccia
            mainWindow.id_list = id_list;
            mainWindow.prestazioni_list = [];
            //mainWindow.xml_content = JSON.stringify(xmlData.data[cf][selectedId].xmlT1);
        };

        mainWindow.show();
        await slint.runEventLoop();
    } catch (error) {
        console.error("Errore durante l'inizializzazione:", error);
    }
}

main().catch(console.error);