import {struttureDistrettiMap, distretti, comuniDistretti} from './struttureDistrettiDB.js';

export const settings = {
    extensions: ['.txt'],
    ts_username: "",
    ts_password: "",
    in_folder: "d:\\Dati\\Desktop\\prova",
    out_folder: "d:\\Dati\\Desktop\\outFolder",
    stat_folder_name: ".stats",
    flowlookDBFilePath: "C:\\Program Files (x86)\\FlowLook\\FlowLook.mdb",
    flowlookDBTable: "tSTS11",
    codiceRegione: "190",
    codiceAzienda: "205",
    distretti: distretti,
    struttureDistrettiMap: struttureDistrettiMap,
    comuniDistretti: comuniDistretti,
}