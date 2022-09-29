const distretti = {
    1: "Messina",
    3: "Taormina",
    4: "Milazzo",
    5: "Lipari",
    6: "Barcellona",
    7: "Patti",
    8: "Mistretta",
    9: "S.Agata"
}

const recapitiDistretti =
    {
        1: ["convest.menord@asp.messina.it","distretto.mesud@asp.messina.it"],
        3: ["distretto.taormina@asp.messina.it","specialistica.taormina@asp.messina.it"],
        4: ["distretto.milazzo@asp.messina.it", "rosangela.basile@asp.messina.it"],
        5: ["distretto.lipari@asp.messina.it"],
        6: ["distretto.barcellona@asp.messina.it"],
        7: ["distretto.patti@asp.messina.it","g.catania@asp.messina.it"],
        8: ["distretto.mistretta@asp.messina.it"],
        9: ["distretto.sagata@asp.messina.it"]
    }

const comuniDistretti = {
    "083027": 1, "083048": 1, "083072": 1, "083076": 1, "083094": 1, "083105": 1, "083061": 1,
    "083032": 3, "083090": 3, "083089": 3, "083097": 3, "083017": 3,
    "083049": 4, "083064": 4, "083098": 4,
    "083041": 5,
    "083005": 6, "083106": 6, "083028": 6,
    "083033": 7, "083007": 7, "083066": 7, "083095": 7,
    "083052": 8, "083091": 8,
    "083001": 9, "083060": 9, "083009": 9, "083084": 9, "083099": 9, "083010": 9, "083078":9, "083011": 9, "083014": 9
}

const struttureDistrettiMap = {
}

const listaPrestazioniVolumi = ["897","8901","8913","9502","8926","87371","87372","8741","88011","88012","88013","88014","88015","88016",
    "8703","88381","88382","88385","88911","88912","88954","88955","8893","88714","88723","88735","88741","88751","88761",
    "88731","88732","8878","88772","4523","4542","4524","4513","4516","8952","8950","8941","8944","95411","89371","89372",
    "9511","93081"]

export {struttureDistrettiMap,distretti,comuniDistretti, recapitiDistretti, listaPrestazioniVolumi}