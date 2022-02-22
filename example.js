import {flussiRegioneSicilia} from "./index.js";
import {ImpostazioniFlussoM} from "./src/config/ImpostazioniFlussoM.js";
import {struttureDistrettiMap, distretti, comuniDistretti} from "./src/config/sicilia/messina.js"
import {StruttureDistrettiPerProvincia} from "./src/config/StruttureDistrettiPerProvincia.js";

(async () => {
    //await flussiRegioneSicilia.flussoM.eseguiElaborazioneCompletaFlussoMDaCartella( true,true,true);
    //await flussiRegioneSicilia.flussoM.unisciFileTxt(settings.out_folder, "c:\\PROVACARATTERI");

    let struttureMessina = new StruttureDistrettiPerProvincia(distretti,comuniDistretti,struttureDistrettiMap)
    let impostazioniMessina = new ImpostazioniFlussoM(
        "205",
        "190",
        "d:\\Dati\\Desktop\\prova",
        "d:\\Dati\\Desktop\\outFolder",
        "C:\\Program Files (x86)\\FlowLook\\FlowLook.mdb",
        struttureMessina
    );
    impostazioniMessina.ts_username = "";
    impostazioniMessina.ts_password = ""
    const flussoM = new flussiRegioneSicilia.FlussoM(impostazioniMessina);
    //await flussoM.eseguiElaborazioneCompletaFlussoMDaCartella(true,false,true)
    //flussoM.verificaErroriDaStats(flussoM.settings.out_folder)
    //flussoM.generaGridJSTable();
    //await flussoM.generaFileExcelPerAnno("prova.xlsx",2022);
    flussoM.trovaRicetteDuplicateDaPath(flussoM.settings.in_folder);
})();

