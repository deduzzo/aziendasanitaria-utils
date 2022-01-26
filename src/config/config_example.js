//rinominare come config.js
const settings = {
    ts_username: "",
    ts_password: "",
    in_folder: "d:\\Dati\\Desktop\\prova\\",
    out_folder: "d:\\Dati\\Desktop\\outFolder\\",
    flowlookDBFilePath: "C:\\Program Files (x86)\\FlowLook\\FlowLook.mdb",
    flowlookDBTable: "tSTS11",
    codiceRegione: "190",
    codiceAzienda: "205",
    distretti: {
        "Messina": 1,
        "Taormina": 3,
        "Milazzo": 4,
        "Lipari": 5,
        "Barcellona": 6,
        "Patti": 7,
        "S.Agata": 8
    },
    struttureDistrettiMap: {

    }
}

export {settings}