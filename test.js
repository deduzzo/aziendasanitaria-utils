import {ImpostazioniFlussoM} from "./src/config/ImpostazioniFlussoM.js";
import {struttureDistrettiMap, distretti, comuniDistretti} from "./src/config/sicilia/messina.js"
import {StruttureDistrettiPerProvincia} from "./src/config/StruttureDistrettiPerProvincia.js";
import {ImpostazioniServiziTerzi} from "./src/config/ImpostazioniServiziTerzi.js";
import {Assistiti} from "./src/narTsServices/Assistiti.js";
import {distrettiByKeyword} from "./src/config/sicilia/messina.js";
import path from "path";
import knex from "knex";
import moment from "moment";
import {Medici} from "./src/narTsServices/Medici.js";
import {utils} from "./src/Utils.js";
import {Procedure} from "./src/Procedure.js";
import DBHelper from "./src/db/DBHelper.js";
import {flussiRegioneSicilia} from "./index.js";
import config from './src/config.js';
import winston from "winston";
import {FlussoSIAD} from "./src/siad/FlussoSIAD.js";
import { Client } from "@gradio/client";

(async () => {
    //await flussiRegioneSicilia.flussoM.eseguiElaborazioneCompletaFlussoMDaCartella( true,true,true);
    //await flussiRegioneSicilia.flussoM.unisciFileTxt(settings.out_folder, "c:\\PROVACARATTERI");

    let struttureMessina = new StruttureDistrettiPerProvincia(distretti, comuniDistretti, struttureDistrettiMap)
    let impostazioniMessina = new ImpostazioniFlussoM(
        "205",
        "190",
        "/Users/deduzzo/Desktop/prova",
        "/Users/deduzzo/Desktop/outFolder",
        "/Users/deduzzo/Downloads/FlowLook/FlowLook/FlowLook.mdb",
        struttureMessina
    );

    const impostazioniEsterni = new ImpostazioniServiziTerzi(config);

    const connData = {
        host: 'localhost',
        user: 'root',
        password: 'root',
        database: 'disabili_prod'
    };
    const db = knex({
        client: 'mysql',
        connection: connData
    });
    const estraiCodiciFiscali = async () => {
        try {
            return await db('istanza')
                .innerJoin('anagrafica', 'istanza.id_anagrafica_disabile', 'anagrafica.id')
                .select('anagrafica.codice_fiscale').where('istanza.attivo', true);
        } catch (error) {
            console.error("Si è verificato un errore:", error);
            throw error;
        }
    }

    const aggiornaDatiAnagraficaDaNar = async (dati) => {
        let i = 0;
        for (let dato of dati) {
            try {
                let anagrafica = await db('anagrafica').select("id").where('codice_fiscale', dato.cf).first();
                // convert dato.data_nascita from format dd/mm/yyyy to yyyy-mm-dd

                if (anagrafica) {
                    // update anagrafica
                    let dataNascita = moment(dato.data_nascita, "DD/MM/YYYY");
                    await db('anagrafica').where('id', anagrafica.id).update({
                        nome: dato.nome,
                        cognome: dato.cognome,
                        data_nascita: dataNascita.isValid() ? dataNascita.format("YYYY-MM-DD") : null,
                        comune_nascita: dato.comune_nascita,
                        indirizzo_residenza: dato.indirizzo
                    });
                }
                i++;
            } catch (error) {
                console.error("Si è verificato un errore:", error);
                throw error;
            }
        }
        console.log("aggiornati " + i + " dati OK");
    }

    const assistiti = new Assistiti(impostazioniEsterni);
    const flussoSiad = new flussiRegioneSicilia.FlussoSIAD(impostazioniMessina, impostazioniEsterni);

/*
    const client = await Client.connect("black-forest-labs/FLUX.1-dev");
    const result = await client.predict("/infer", {
        prompt: "Hello!!",
        seed: 0,
        randomize_seed: true,
        width: 256,
        height: 256,
        guidance_scale: 1,
        num_inference_steps: 1,
    });
*/

    //let out1 = await flussoSiad.importaTracciato2ChiaviValideAssessorato("/Users/deduzzo/Downloads/ChiaviValide_SIAD_AP2_Prestazioni_Sanitarie.xlsx");
    //let out2 = await flussoSiad.importaTracciato1ChiaviValideAssessorato("/Users/deduzzo/Downloads/ChiaviValide_SIAD_AA2_Anagrafica_Assistenza_Domiciliare.xlsx");

    /*    await flussoSiad.creaMappaChiaviValideAssessorato(
            "/Users/deduzzo/Downloads/ChiaviValide_SIAD_AA2_Anagrafica_Assistenza_Domiciliare.xlsx",
            "/Users/deduzzo/Downloads/ChiaviValide_SIAD_AP2_Prestazioni_Sanitarie.xlsx",
            2024
        )*/

    let nomeFile = "/Users/deduzzo/Library/CloudStorage/GoogleDrive-info@robertodedomenico.it/Drive condivisi/LAVORO ASP/flussi/SIAD/IMPORTAZIONE MAGGIOLI/DATI INVIATI A DITTA/OTTOBRE/ADI_ADISICILIA2_202410_tracciato1_out.xlsx";
    //let res = await flussoSiad.generaMappaPICT1("/Users/deduzzo/Library/CloudStorage/GoogleDrive-info@robertodedomenico.it/Drive condivisi/LAVORO ASP/flussi/SIAD/INVII/2024/DATI ASTER//PER MESE//");




/*    await Procedure.eseguiVerifichePeriodicheDecedutiAssistitiMedici(
        impostazioniEsterni,
        "/Users/deduzzo/Library/CloudStorage/GoogleDrive-info@robertodedomenico.it/Drive condivisi/LAVORO ASP/Personale Convenzionato/ELENCO MEDICI COMPLETO/ELENCO-TUTTI-2025-02-13.xlsx",
        distrettiByKeyword,
        "31/01/2025",
        {
            workingPath: "/Users/deduzzo/Library/CloudStorage/GoogleDrive-info@robertodedomenico.it/Drive condivisi/LAVORO ASP/Personale Convenzionato/RECUPERI MORTI/RECUPERI PERIODICI/2025-02"
        });*/


    //await flussoSiad.statisticheFLS21('/Users/deduzzo/Library/CloudStorage/GoogleDrive-info@robertodedomenico.it/Drive condivisi/LAVORO ASP/flussi/SIAD/INVII/2024/INVII DEFINITIVI/MIEI/anno ignorando maggioli pseudo completo (da correggere per eventuali scarti)',
    //process.exit(0);
    //Drive condivisi\\LAVORO ASP\\flussi\\SIAD\\INVII\\2023-2024 pulito\\",
    let res = await flussoSiad.generaFlussoRettificaScarti(
        2024,
        "/Users/deduzzo/Library/CloudStorage/GoogleDrive-info@robertodedomenico.it/Drive condivisi/LAVORO ASP/flussi/SIAD/INVII/2022-2023-2024 pulito/",
        "/Users/deduzzo/Library/CloudStorage/GoogleDrive-info@robertodedomenico.it/Drive condivisi/LAVORO ASP/flussi/SIAD/IMPORTAZIONE MAGGIOLI/DATI INVIATI A DITTA/",
        '/Users/deduzzo/Library/CloudStorage/GoogleDrive-info@robertodedomenico.it/Drive condivisi/LAVORO ASP/flussi/SIAD/INVII/2024/INVII DEFINITIVI/MIEI/situazione post anno/CHIAVI VALIDE MINISTERO 19-03-2025/',
        "/Users/deduzzo/Library/CloudStorage/GoogleDrive-info@robertodedomenico.it/Drive condivisi/LAVORO ASP/flussi/SIAD/JSON PORTALE PIC/adi_pic_2025_01_08.json",
    )
    //let data = await utils.getObjectFromFileExcel(nomeFile);
    //let out = flussoSiad.generaRigheTracciato1ConDefault("/Users/deduzzo/Desktop/outFolder", data, nomeFile, 2024, 3);


    // LISTA ASSISTITI SU TS
    //let medici = new Medici(impostazioniEsterni);
    //let out = await medici.getAssistitiDaTs("PRSNNN56B22F158D");

    // DECESSI DISABILI
    /* let cfDisabili = await estraiCodiciFiscali();
     let cfDisabiliArray = [];
     cfDisabili.map((item) => cfDisabiliArray.push(item.codice_fiscale));
     await Common.scriviOggettoSuFile(process.cwd() + path.sep + "export/cfestratti.json", cfDisabiliArray);*/

    //DECESSI
    /*let out = await decessi.verificaAssititiInVita(cfDisabili);
    //download path
    await Common.scriviOggettoSuNuovoFileExcel(process.cwd() + path.sep + "export/morti.xlsx", Object.values(out.out.morti));
    await Common.scriviOggettoSuFileTxt(process.cwd() + path.sep + "export/non-trovati.txt", out.out.nonTrovati);

    // AGGIORNAMENTO DATI
    let nonTrovatiGlobal =[];
    console.log("TOTALI: " + cfDisabiliArray.length);
    for (let i = 0; i< cfDisabiliArray.length; i+=50) {
        let out = await assistiti.verificaAssititiInVita(cfDisabiliArray.slice(i,i+50),null,false);
        //await aggiornaDatiAnagraficaDaNar([...Object.values(out.out.vivi), ...Object.values(out.out.morti)]);
        nonTrovatiGlobal = [...nonTrovatiGlobal, ...out.out.nonTrovati];
        await Common.scriviOggettoSuFile(process.cwd() + path.sep + "export/dati_" + i + ".json", out.out.morti);
    }
    //let out = await assistiti.verificaAssititiInVita(cfDisabiliArray,null,true);
    //await aggiornaDatiAnagraficaDaNar([...Object.values(out.out.vivi), ...Object.values(out.out.morti)]);
    //await Common.scriviOggettoSuNuovoFileExcel(process.cwd() + path.sep + "export/dati.xlsx", {'vivi':Object.values(out.out.vivi), 'morti': Object.values(out.out.morti) });
    await Common.scriviOggettoSuFile(process.cwd() + path.sep + "export/non-trovati_dati.txt", nonTrovatiGlobal);
    // write the array out.out to the file export/res.json in Json Format
    //await Common.scriviOggettoSuFileTxt(process.cwd() + path.sep + "export/res.json", out.out);

    console.log("aggiornamento ok");*/
    /*
        const medici = new Medici(impostazioniEsterni);
        let out = await medici.stampaCedolino("314505",6,2019,6,2019,2010,1,2023,6);
    */

    //let nar = new Nar(impostazioniEsterni);
    //let out = await nar.doLogin(Nar.NAR);
    //let ts = new Ts(impostazioniEsterni);
    //let out = await ts.doLogin();

    //let medici = new flussiRegioneSicilia.MediciDiBase(impostazioniEsterni);
    //await medici.getPffAssistitiMedici([{cognome: "PARISI", nome: "ANTONINO FRANCESCO"}]);


    //const flussoM = new flussiRegioneSicilia.FlussoM(impostazioniMessina);
    //let files = await flussoM.elaboraFlussi();
    //console.log(files.ripetuti);
    //await flussoM.eseguiElaborazioneCompletaFlussoMDaCartella(true,false,true)
    //await flussoM.trovaRicetteDuplicate(flussoM.settings.in_folder,true)
    //flussoM.verificaErroriDaStats(flussoM.settings.out_folder)
    //flussoM.generaGridJSTable();
    //await flussoM.generaFileExcelPerAnno("prova.xlsx",2022);
    //flussoM.trovaRicetteDuplicateDaPath(flussoM.settings.in_folder);
    //let out = await flussoM.generaFileExcelPerAnno("prova.xlsx", 2021);
    //console.log(out);


    // DIFFERENZE NAR TS

    /*    let medici = new Medici(impostazioniEsterni, true);
        let allAssistiti = await medici.getAssistitiDaListaPDF("/Users/deduzzo/Downloads/report_802951_30112023_18010300.pdf");
        await Utils.scriviOggettoSuFile(process.cwd() + path.sep + "export/assistitiNar.json", allAssistiti);
        let datiMediciPediatriCompleto = await Utils.getObjectFromFileExcel("/Users/deduzzo/Library/CloudStorage/GoogleDrive-info@robertodedomenico.it/Drive condivisi/LAVORO ASP/Personale Convenzionato/ELENCO MEDICI COMPLETO/elenco-1-12-2023.xlsx");
        let codToCfMap = {};
        for (let dato of datiMediciPediatriCompleto) {
            codToCfMap[dato['codice regionale'].toString()] = dato['Codice fiscale'];
        }
        let temp = await Medici.getElencoAssistitiParallels(Object.values(codToCfMap), impostazioniEsterni, 20);
        await Utils.scriviOggettoSuFile(process.cwd() + path.sep + "export/assistitiTs.json", temp);*/


    /*    // VERIFICA DIFFERENZE
        let assistitiNar = await Utils.leggiOggettoDaFileJSON(process.cwd() + path.sep + "export/assistitiNar.json");
        let assistitiTs = await Utils.leggiOggettoDaFileJSON(process.cwd() + path.sep + "export/assistitiTs.json");
        let differenze = medici.getAllDifferenzeAnagrafiche(assistitiNar, assistitiTs,codToCfMap);
        await Utils.scriviOggettoSuFile(process.cwd() + path.sep + "export/differenze.json", differenze);*/

    /*    let anni = ['2013', '2014', '2015', '2016', '2017', '2018', '2019'];
        for (let anno of anni) {

            await Procedure.getControlliEsenzione(
                "/Users/deduzzo/Downloads/ListaControlliAutocertificazioni_"+ anno +".xlsx",
                "Protocollo",
                "Esenzione",
                anno,
                ["E01", "E02", "E03", "E04"],
                impostazioniEsterni,
                await utils.getWorkingPath(),
                20,
                10,
                true,
                false
            );*/
    /* const connDataEsenzioni = {
         host: 'localhost',
         user: 'root',
         password: 'root',
         database: 'esenzioni'
     };

     await Procedure.generaDbMysqlDaFilePrestazioni(
         "/Users/deduzzo/Downloads/esenzioni/"+ anno +".json",
         connDataEsenzioni,
         anno,
         false
     );



 }*/
    //let prova = await assistiti.controlliEsenzioneAssistito(["MTANTN52C60G699A"], "E02", "2013", 1, true, true);

    //CREA DATABASE ASSISTITI
    /*    await Procedure.creaDatabaseAssistitiNarTs(
            impostazioniEsterni,
            "/Users/deduzzo/Library/CloudStorage/GoogleDrive-info@robertodedomenico.it/Drive condivisi/LAVORO ASP/Personale Convenzionato/ELENCO MEDICI COMPLETO/ELENCO-TUTTI-2024-09-18.xlsx",
            distrettiByKeyword,
            //{toFile: true, fileName: "assistitiNarTs.sql"},
            DBHelper.connectionData('localhost', 'root', 'root', 'assistiti_nar_ts'),
            "/Users/deduzzo/Library/CloudStorage/GoogleDrive-info@robertodedomenico.it/Drive condivisi/LAVORO ASP/Personale Convenzionato/DB NAR-TS/20240910",
            true
        )*/

    // FLUSSO SIAD
    //await Procedure.analizzaMensilitaMedico("320415", impostazioniServizi, 1, 2019, 12, 2019,true);
    //await Procedure.verificaDecessiDaFileExcel("G:\\Drive condivisi\\LAVORO ASP\\flussi\\SIAD\\IMPORTAZIONE MAGGIOLI\\TRACCIATI RICEVUTI EXCEL\\SIAD DITTE\\7 - LUGLIO\\ANTEA\\controllo\\sostituti.xlsx", impostazioniServizi, "cfOk",true,false);




    /* await Procedure.getDifferenzeAssistitiNarTs(
         "/Users/deduzzo/Library/CloudStorage/GoogleDrive-info@robertodedomenico.it/Drive condivisi/LAVORO ASP/Personale Convenzionato/RECUPERI MORTI/RECUPERI PERIODICI/01-2024/report_809904_25012024_11453900.pdf",
         "/Users/deduzzo/Library/CloudStorage/GoogleDrive-info@robertodedomenico.it/Drive condivisi/LAVORO ASP/Personale Convenzionato/ELENCO MEDICI COMPLETO/ELENCO-TUTTI-2024-01-27.xltx",
         impostazioniEsterni,
         distrettiByKeyword,
         false,
         await utils.getWorkingPath(),
         20,
         false,
     );*/
    process.exit(0);

})();
