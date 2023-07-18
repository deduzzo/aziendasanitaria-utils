import {FlussoM} from "./src/m/FlussoM.js";
import {FlussoSIAD} from "./src/siad/FlussoSIAD.js";
import {FlussoHOSPICE} from "./src/hospice/FlussoHOSPICE.js";
import {FlussoARSFAR} from "./src/ars-far/FlussoARSFAR.js"
import {FlussoRSA} from "./src/rsa/FlussoRSA.js";
import {StruttureDistrettiPerProvincia} from "./src/config/StruttureDistrettiPerProvincia.js";
import {ImpostazioniFlussoHOSPICE} from "./src/config/ImpostazioniFlussoHOSPICE.js";
import {ImpostazioniMail} from "./src/config/ImpostazioniMail.js";
import {ImpostazioniFlussoARSFAR} from "./src/config/ImpostazioniFlussoARSFAR.js";
import {ImpostazioniFlussoM} from "./src/config/ImpostazioniFlussoM.js";
import {ImpostazioniFlussoRSA} from "./src/config/ImpostazioniFlussoRSA.js";
import {Decessi} from "./src/narTsServices/Decessi.js";
import * as Messina from "./src/config/sicilia/messina.js"
import {MediciDiBase} from "./src/narTsServices/MediciDiBase.js";
import {ImpostazioniServiziTerzi} from "./src/config/ImpostazioniServiziTerzi.js";

export const flussiRegioneSicilia = {DisabiliGravissimi: Decessi, FlussoM, FlussoSIAD, FlussoHOSPICE, FlussoARSFAR, FlussoRSA, ImpostazioniFlussoHOSPICE,ImpostazioniFlussoARSFAR, ImpostazioniFlussoM, ImpostazioniFlussoRSA,
    ImpostazioniMail,StruttureDistrettiPerProvincia, Messina,MediciDiBase,Decessi,ImpostazioniServiziTerzi }