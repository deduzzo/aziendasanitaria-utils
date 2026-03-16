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

const distrettiByKeyword = {
    "messina" : distretti[1],
    "taormina": distretti[3],
    "milazzo": distretti[4],
    "lipari": distretti[5],
    "barcellona": distretti[6],
    "patti": distretti[7],
    "mistretta": distretti[8],
    "agata": distretti[9]
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
    "083049": 4, "083064": 4, "083098": 4, "083104": 4, "083077": 4,
    "083041": 5,
    "083005": 6, "083106": 6, "083028": 6,
    "083033": 7, "083007": 7, "083066": 7, "083095": 7, "083039": 7,
    "083052": 8, "083091": 8,
    "083001": 9, "083060": 9, "083009": 9, "083084": 9, "083099": 9, "083010": 9, "083078":9, "083011": 9, "083014": 9, "083108":9
}

const comuniList = [
    // Distretto 1 - Messina
    { comune: "MESSINA", catastale: "F158", distretto: 1 },
    { comune: "ROCCALUMERA", catastale: "H418", distretto: 1 },
    { comune: "FURCI SICULO", catastale: "D824", distretto: 1 },
    { comune: "PAGLIARA", catastale: "G234", distretto: 1 },
    { comune: "MANDANICI", catastale: "E876", distretto: 1 },
    { comune: "NIZZA DI SICILIA", catastale: "F901", distretto: 1 },
    { comune: "FIUMEDINISI", catastale: "D622", distretto: 1 },
    { comune: "ALI'", catastale: "A194", distretto: 1 },
    { comune: "ALI' TERME", catastale: "A201", distretto: 1 },
    { comune: "ITALA", catastale: "E374", distretto: 1 },
    { comune: "SCALETTA ZANCLEA", catastale: "I492", distretto: 1 },
    { comune: "VILLAFRANCA TIRRENA", catastale: "L950", distretto: 1 },
    { comune: "SAPONARA", catastale: "I420", distretto: 1 },
    { comune: "ROMETTA", catastale: "H519", distretto: 1 },
    // Distretto 3 - Taormina
    { comune: "SANT'ALESSIO SICULO", catastale: "I215", distretto: 3 },
    { comune: "LIMINA", catastale: "E594", distretto: 3 },
    { comune: "FORZA D'AGRO'", catastale: "D733", distretto: 3 },
    { comune: "ANTILLO", catastale: "A313", distretto: 3 },
    { comune: "SANTA TERESA DI RIVA", catastale: "I311", distretto: 3 },
    { comune: "SAVOCA", catastale: "I477", distretto: 3 },
    { comune: "CASALVECCHIO SICULO", catastale: "B918", distretto: 3 },
    { comune: "ROCCAFIORITA", catastale: "H405", distretto: 3 },
    { comune: "TAORMINA", catastale: "L042", distretto: 3 },
    { comune: "CASTELMOLA", catastale: "C210", distretto: 3 },
    { comune: "LETOJANNI", catastale: "E555", distretto: 3 },
    { comune: "GALLODORO", catastale: "D885", distretto: 3 },
    { comune: "MONGIUFFI MELIA", catastale: "F368", distretto: 3 },
    { comune: "GIARDINI-NAXOS", catastale: "E014", distretto: 3 },
    { comune: "GAGGI", catastale: "D844", distretto: 3 },
    { comune: "GRANITI", catastale: "E142", distretto: 3 },
    { comune: "SANTA DOMENICA VITTORIA", catastale: "I184", distretto: 3 },
    { comune: "MOTTA CAMASTRA", catastale: "F772", distretto: 3 },
    { comune: "FRANCAVILLA DI SICILIA", catastale: "D765", distretto: 3 },
    { comune: "MALVAGNA", catastale: "E869", distretto: 3 },
    { comune: "MOIO ALCANTARA", catastale: "F277", distretto: 3 },
    { comune: "ROCCELLA VALDEMONE", catastale: "H455", distretto: 3 },
    { comune: "CESARO'", catastale: "C568", distretto: 3 },
    { comune: "SAN TEODORO", catastale: "I328", distretto: 3 },
    // Distretto 4 - Milazzo
    { comune: "MILAZZO", catastale: "F206", distretto: 4 },
    { comune: "PACE DEL MELA", catastale: "G209", distretto: 4 },
    { comune: "SAN FILIPPO DEL MELA", catastale: "H842", distretto: 4 },
    { comune: "SANTA LUCIA DEL MELA", catastale: "I220", distretto: 4 },
    { comune: "VALDINA", catastale: "L561", distretto: 4 },
    { comune: "SPADAFORA", catastale: "I881", distretto: 4 },
    { comune: "VENETICO", catastale: "L735", distretto: 4 },
    { comune: "TORREGROTTA", catastale: "L271", distretto: 4 },
    { comune: "ROCCAVALDINA", catastale: "H380", distretto: 4 },
    { comune: "MONFORTE SAN GIORGIO", catastale: "F359", distretto: 4 },
    { comune: "CONDRO'", catastale: "C956", distretto: 4 },
    { comune: "GUALTIERI SICAMINO'", catastale: "E233", distretto: 4 },
    { comune: "SAN PIER NICETO", catastale: "I084", distretto: 4 },
    // Distretto 5 - Lipari
    { comune: "LIPARI", catastale: "E606", distretto: 5 },
    { comune: "LENI", catastale: "E523", distretto: 5 },
    { comune: "MALFA", catastale: "E855", distretto: 5 },
    { comune: "SANTA MARINA SALINA", catastale: "I254", distretto: 5 },
    // Distretto 6 - Barcellona
    { comune: "BARCELLONA POZZO DI GOTTO", catastale: "A638", distretto: 6 },
    { comune: "MERI'", catastale: "F147", distretto: 6 },
    { comune: "CASTROREALE", catastale: "C347", distretto: 6 },
    { comune: "MONTALBANO ELICONA", catastale: "F400", distretto: 6 },
    { comune: "FURNARI", catastale: "D825", distretto: 6 },
    { comune: "FALCONE", catastale: "D474", distretto: 6 },
    { comune: "TRIPI", catastale: "L431", distretto: 6 },
    { comune: "BASICO'", catastale: "A698", distretto: 6 },
    { comune: "NOVARA DI SICILIA", catastale: "F951", distretto: 6 },
    { comune: "FONDACHELLI-FANTINA", catastale: "D661", distretto: 6 },
    { comune: "TERME VIGLIATORE", catastale: "M210", distretto: 6 },
    { comune: "RODI' MILICI", catastale: "H479", distretto: 6 },
    { comune: "MAZZARRA' SANT'ANDREA", catastale: "F066", distretto: 6 },
    // Distretto 7 - Patti
    { comune: "PATTI", catastale: "G377", distretto: 7 },
    { comune: "OLIVERI", catastale: "G036", distretto: 7 },
    { comune: "MONTAGNAREALE", catastale: "F395", distretto: 7 },
    { comune: "SANT'ANGELO DI BROLO", catastale: "I283", distretto: 7 },
    { comune: "PIRAINO", catastale: "G699", distretto: 7 },
    { comune: "GIOIOSA MAREA", catastale: "E043", distretto: 7 },
    { comune: "SAN PIERO PATTI", catastale: "I086", distretto: 7 },
    { comune: "FLORESTA", catastale: "D635", distretto: 7 },
    { comune: "RACCUJA", catastale: "H151", distretto: 7 },
    { comune: "LIBRIZZI", catastale: "E571", distretto: 7 },
    { comune: "BROLO", catastale: "B198", distretto: 7 },
    { comune: "SINAGRA", catastale: "I747", distretto: 7 },
    { comune: "FICARRA", catastale: "D569", distretto: 7 },
    { comune: "UCRIA", catastale: "L482", distretto: 7 },
    // Distretto 8 - Mistretta
    { comune: "MISTRETTA", catastale: "F251", distretto: 8 },
    { comune: "REITANO", catastale: "H228", distretto: 8 },
    { comune: "CASTEL DI LUCIO", catastale: "C094", distretto: 8 },
    { comune: "PETTINEO", catastale: "G522", distretto: 8 },
    { comune: "SANTO STEFANO DI CAMASTRA", catastale: "I370", distretto: 8 },
    { comune: "TUSA", catastale: "L478", distretto: 8 },
    { comune: "MOTTA D'AFFERMO", catastale: "F773", distretto: 8 },
    // Distretto 9 - Sant'Agata di Militello
    { comune: "SANT'AGATA DI MILITELLO", catastale: "I199", distretto: 9 },
    { comune: "MILITELLO ROSMARINO", catastale: "F210", distretto: 9 },
    { comune: "ALCARA LI FUSI", catastale: "A177", distretto: 9 },
    { comune: "SAN MARCO D'ALUNZIO", catastale: "H982", distretto: 9 },
    { comune: "TORRENOVA", catastale: "M286", distretto: 9 },
    { comune: "ACQUEDOLCI", catastale: "M211", distretto: 9 },
    { comune: "SAN FRATELLO", catastale: "H850", distretto: 9 },
    { comune: "CARONIA", catastale: "B804", distretto: 9 },
    { comune: "CAPO D'ORLANDO", catastale: "B666", distretto: 9 },
    { comune: "CASTELL'UMBERTO", catastale: "C051", distretto: 9 },
    { comune: "CAPRI LEONE", catastale: "B695", distretto: 9 },
    { comune: "NASO", catastale: "F848", distretto: 9 },
    { comune: "SAN SALVATORE DI FITALIA", catastale: "I147", distretto: 9 },
    { comune: "LONGI", catastale: "E674", distretto: 9 },
    { comune: "MIRTO", catastale: "F242", distretto: 9 },
    { comune: "TORTORICI", catastale: "L308", distretto: 9 },
    { comune: "GALATI MAMERTINO", catastale: "D861", distretto: 9 },
    { comune: "FRAZZANO'", catastale: "D793", distretto: 9 },
]

function getDistrettoByComune(comune) {
    const found = comuniList.find(c => c.comune.toUpperCase() === comune.toUpperCase())
    return found ? found.distretto : null
}

function getDistrettoByCatastale(catastale) {
    const found = comuniList.find(c => c.catastale.toUpperCase() === catastale.toUpperCase())
    return found ? found.distretto : null
}

const struttureDistrettiMap = {
}

const listaPrestazioniVolumi = ["897","8901","8913","9502","8926","87371","87372","8741","88011","88012","88013","88014","88015","88016",
    "8703","88381","88382","88385","88911","88912","88954","88955","8893","88714","88723","88735","88741","88751","88761",
    "88731","88732","8878","88772","4523","4542","4524","4513","4516","8952","8950","8941","8944","95411","89371","89372",
    "9511","93081"]

export {struttureDistrettiMap,distretti,comuniDistretti, recapitiDistretti, listaPrestazioniVolumi, distrettiByKeyword, comuniList, getDistrettoByComune, getDistrettoByCatastale}