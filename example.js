import {flussiRegioneSicilia} from "./index.js";
import {settings} from "./src/config/config.js";
import {common} from "./src/common.js";

const test1 =  async () => {
    const scriviSuCartella = true
    const controllaSuTs = true
    let strutture = flussiRegioneSicilia.flussoM.loadStruttureFromFlowlookDB(settings.flowlookDBFilePath,settings.flowlookDBTable,settings.codiceRegione, settings.codiceAzienda, settings.struttureDistrettiMap);
    let ris = await flussiRegioneSicilia.flussoM.elaboraFlussi(settings.in_folder,strutture,settings.distretti);
    let strutturePerControlloTS = {};
    for (let value of Object.values(ris.ok))
        strutturePerControlloTS[value.codiceStruttura + "-" + (value.datiDaFile?.mese?? value.mesePrevalente) + (value.datiDaFile?.anno ?? value.annoPrevalente)] =
            {mese: (value.datiDaFile?.mese?? value.mesePrevalente), anno: (value.datiDaFile?.anno ?? value.annoPrevalente), codiceRegione:"190",codiceAsl:"205", codiceStruttura: value.codiceStruttura};
    let outTS = []
    if (controllaSuTs)
        outTS = await flussiRegioneSicilia.flussoM.progettoTSFlussoM.ottieniInformazioniStrutture(strutturePerControlloTS);
    if (scriviSuCartella)
        await flussiRegioneSicilia.flussoM.scriviFlussoMSuCartella(ris.ok,outTS,strutture);
    flussiRegioneSicilia.flussoM.generaHtmlDaFileStats(settings.out_folder, strutture,1);
}

const test2 =  async () => {
    let errors = await flussiRegioneSicilia.flussoM.verificaCorrettezzaFileMInCartella(settings.in_folder)
}
const test3 =  () => {
}

(async () => {
    //await test1()
    let strutture = flussiRegioneSicilia.flussoM.loadStruttureFromFlowlookDB(settings.flowlookDBFilePath,settings.flowlookDBTable,settings.codiceRegione, settings.codiceAzienda, settings.struttureDistrettiMap);
    //flussiRegioneSicilia.flussoM.generaHtmlUsandoGrid(settings.out_folder, strutture,1);
    flussiRegioneSicilia.flussoM.generaGridJSTable(settings.out_folder, strutture,1);
})();

