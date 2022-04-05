import {FlussoM} from "./src/m/FlussoM.js";
import {FlussoSIAD} from "./src/siad/FlussoSIAD.js";
import {FlussoHOSPICE} from "./src/hospice/FlussoHOSPICE.js";
import {FlussoARSFAR} from "./src/ars-far/FlussoARSFAR.js"
import {StruttureDistrettiPerProvincia} from "./src/config/StruttureDistrettiPerProvincia.js";
import {ImpostazioniFlussoHOSPICE} from "./src/config/ImpostazioniFlussoHOSPICE.js";
import {ImpostazioniMail} from "./src/config/ImpostazioniMail.js";
import {ImpostazioniFlussoARSFAR} from "./src/config/ImpostazioniFlussoARSFAR.js";
import {ImpostazioniFlussoM} from "./src/config/ImpostazioniFlussoM.js";
import * as Messina from "./src/config/sicilia/messina.js"

export const flussiRegioneSicilia = {FlussoM, FlussoSIAD, FlussoHOSPICE, FlussoARSFAR,ImpostazioniFlussoHOSPICE,ImpostazioniFlussoARSFAR, ImpostazioniFlussoM,
    ImpostazioniMail,StruttureDistrettiPerProvincia, Messina }