import {flussiRegioneSicilia} from "./index.js";
import {ImpostazioniFlussoM} from "./src/config/ImpostazioniFlussoM.js";
import {struttureDistrettiMap, distretti, comuniDistretti} from "./src/config/sicilia/messina.js"
import {StruttureDistrettiPerProvincia} from "./src/config/StruttureDistrettiPerProvincia.js";
import {FlussoM} from "./src/m/FlussoM.js";

(async () => {
    //await flussiRegioneSicilia.flussoM.eseguiElaborazioneCompletaFlussoMDaCartella( true,true,true);
    //await flussiRegioneSicilia.flussoM.unisciFileTxt(settings.out_folder, "c:\\PROVACARATTERI");

    let struttureMessina = new StruttureDistrettiPerProvincia(distretti,comuniDistretti,struttureDistrettiMap)
    let impostazioniMessina = new ImpostazioniFlussoM(
        "205",
        "190",
        "d:\\Dati\\Desktop\\prova\\",
        "d:\\Dati\\Desktop\\outFolder",
        "C:\\Program Files (x86)\\FlowLook\\FlowLook.mdb",
        struttureMessina
    );
    impostazioniMessina.ts_username = "";
    impostazioniMessina.ts_password = ""
    const flussoM = new flussiRegioneSicilia.FlussoM(impostazioniMessina);
})();

