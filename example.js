import {flussiRegioneSicilia} from "./index.js";
import {settings} from "./src/config/config.js";

(async () => {
    //await flussiRegioneSicilia.flussoM.eseguiElaborazioneCompletaFlussoMDaCartella( true,true,true);
    await flussiRegioneSicilia.flussoM.unisciFileTxt(settings.out_folder, "c:\\PROVACARATTERI");
})();

