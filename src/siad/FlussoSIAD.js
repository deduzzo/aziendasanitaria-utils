import * as xml2js from 'xml2js'
import fs from 'fs';
import reader from 'xlsx';
import path, {parse} from "path";
import moment from 'moment';

// this example reads the file synchronously
// you can read it asynchronously also

export class FlussoSIAD {

    constructor() {

    }

    contaPrestazioni (path) {

        let data = {};
        var totalePreseInCarico = 0;
        var totaleAccessi = 0;
        var totalePalliativa = 0;
        const parser = new xml2js.Parser({ attrkey: "ATTR" });

        fs.readdir(path, (err, files) => {
            files.forEach(file => {
                console.log(file);

                let xml_string = fs.readFileSync(path + file, "utf8");

                parser.parseString(xml_string, function (error, result) {
                    if (error === null) {
                        let assistenze = result['FlsAssDom_2']['Assistenza'];
                        for (var i = 0; i < assistenze.length; i++) {
                            let chiaveAssistito = assistenze[i]['Eventi'][0]['PresaInCarico'][0]['Id_Rec'][0];
                            let assistito = chiaveAssistito.substr(chiaveAssistito.length - 16, chiaveAssistito.length - 1)
                            if (!data.hasOwnProperty(assistito))
                                data[assistito] = {'preseInCarico': 1, 'accessi': 0, 'palliativa': false};
                            else {
                                data[assistito]['preseInCarico'] = data[assistito]['preseInCarico'] + 1;
                            }

                            // accessi

                            let accessi = assistenze[i]['Eventi'][0]['Erogazione'];
                            if (accessi) {
                                for (var k = 0; k < accessi.length; k++) {
                                    if (assistenze[i]['Eventi'][0]['Erogazione'][k].hasOwnProperty('ATTR')) {
                                        if (parseInt(assistenze[i]['Eventi'][0]['Erogazione'][k]['TipoOperatore'][0]) === 5) {
                                            //palliativa?
                                            data[assistito]['palliativa'] = true;
                                        }
                                        //console.log(accessi);
                                        //console.log(assistenze[i]['Eventi'][0]['Erogazione'][k]['ATTR']['numAccessi']);
                                        data[assistito]['accessi'] = data[assistito]['accessi'] + parseInt(assistenze[i]['Eventi'][0]['Erogazione'][k]['ATTR']['numAccessi']);
                                    }
                                }
                            } else {
                                //conclusione?
                                //console.log(assistenze[i]['Eventi'][0]);
                            }
                        }
                    } else {
                        console.log(error);
                    }
                });


            })
            console.log(data);
            var chiavi = Object.keys(data);
            for (var i = 0; i < chiavi.length; i++) {
                //console.log(data[chiavi[i]])
                totalePreseInCarico += data[chiavi[i]]['preseInCarico'];
                totaleAccessi += data[chiavi[i]]['accessi'];
                if (data[chiavi[i]]['palliativa'] === true)
                    totalePalliativa++;
            }
            console.log(Object.keys(data).length);
            console.log(totalePreseInCarico);
            console.log(totaleAccessi);
            console.log(totalePalliativa);
        });
    }

    generaFlussoRettificaChiusure(pathFile,folderOut,codRegione, codASL)
    {
        //objRettifica = [{chiave: xx, pic:xxx, conclusione: xxx, motivazione: xxx} .... ]
        // Reading our test file
        const file = reader.readFile(pathFile);

        let data = [];

        const sheets = file.SheetNames;
        console.log(sheets);

        for (let i = 0; i < sheets.length; i++) {
            const temp = reader.utils.sheet_to_json(
                file.Sheets[file.SheetNames[i]]);
            temp.forEach((res) => {
                data.push(res);
            });
        }
        console.log(data[0]);

        let outData = {};
        for(let dato of data)
        {
            let annoPIC = dato["Anno Presa In Carico"];
            let annoRivalutazione = dato["Ultima Data Rivalutazione "].length >2 ? parseInt(dato["Ultima Data Rivalutazione "].substring(0,4)) : 0;
            let annoUltimaErogazione = dato["Ultima Data Erogazione"].length > 2 ? parseInt(dato["Ultima Data Erogazione"].substring(0,4)) : 0
            let annoFineSospensione = dato.hasOwnProperty("Data Fine Sospensione") ? (dato["Data Fine Sospensione"].length >2 ? parseInt(dato["Data Fine Sospensione"].substring(0,4)): 0): 0;
            let anno = Math.max(annoPIC,annoRivalutazione,annoUltimaErogazione,annoFineSospensione)

            //console.log(dato);
            let tempRiga = {Trasmissione: {$: {"tipo":"I"}},
                Erogatore: {CodiceRegione: codRegione,CodiceASL:codASL},
                Eventi: {
                    PresaInCarico: {
                        $: {"data": dato["Data  Presa In Carico"]},
                        Id_Rec: dato["Id Record"]
                    },
                    Conclusione: {
                        $: {"dataAD": anno + "-12-31"},
                        Motivazione: 99
                    }
                }
            };
            if (!outData.hasOwnProperty(anno))
                outData[anno] = [];
            outData[anno].push(tempRiga);
        }

        var builder = new xml2js.Builder();
        for (let chiave of Object.keys(outData))
        {
            var obj = {FlsAssDom_2: {$: {"xmlns": "http://flussi.mds.it/flsassdom_2"},Assistenza: outData[chiave]}}
            var xml = builder.buildObject(obj);
            fs.writeFileSync(folderOut + path.sep + chiave.toString() + ".xml", xml);
        }

        //console.log(xml);

    }

    generaFlussoRettificaCancellazione(pathFile,folderOut,codRegione, codASL)
    {
        const file = reader.readFile(pathFile);

        let data = [];

        const sheets = file.SheetNames;
        console.log(sheets);

        for (let i = 0; i < sheets.length; i++) {
            const temp = reader.utils.sheet_to_json(
                file.Sheets[file.SheetNames[i]]);
            temp.forEach((res) => {
                data.push(res);
            });
        }
        console.log(data[0]);

        let outData = {};
        for(let dato of data)
        {
            let annoPIC = dato["Anno Presa In Carico"];
            let annoUltimaErogazione = dato["Ultima Data Erogazione"].length > 2 ? dato["Ultima Data Erogazione"].substring(0,4) : "0"
            let mesePic = dato["Data  Presa In Carico"].length > 2 ? dato["Data  Presa In Carico"].substring(5,7) : "0"
            if (mesePic.length === 1) mesePic = "0" + mesePic;
            //console.log(dato);
            let tempRiga = {Trasmissione: {$: {"tipo":"C"}},
                Assistito: {
                    DatiAnagrafici: {
                        CUNI:  dato["Id Record"].substring(16,32),
                        validitaCI: 0,
                        tipologiaCI: 0,
                        AnnoNascita: 1950,
                        Genere: 2,
                        Cittadinanza: "IT",
                        StatoCivile: 1,
                        Residenza: {
                            Regione: codRegione,
                            ASL: codASL,
                            Comune: "000000"
                        },
                    }
                },
                Conviventi: {
                    NucleoFamiliare: 0,
                    AssistenteNonFamiliare: 1,
                },
                Erogatore: {CodiceRegione: codRegione,CodiceASL:codASL},
                Eventi: {
                    PresaInCarico: {
                        $: {"data": dato["Data  Presa In Carico"], "soggettoRichiedente": 2},
                        Id_Rec: dato["Id Record"]
                    },
                    Valutazione: {
                        $: {"data": dato["Data  Presa In Carico"]},
                        Patologia: {
                            Prevalente: "000",
                            Concomitante: "000",
                        },
                        Anatomia: 0,
                        GradoMobilita: 0,
                        Disturbi: {
                            Cognitivi: 0,
                            Comportamentali: 0
                        },
                        SupportoSociale: 0,
                        RischioInfettivo: 0,
                        DrenaggioPosturale: 0,
                        OssigenoTerapia: 0,
                        Ventiloterapia: 0,
                        Tracheostomia: 0,
                        Alimentazione: {
                            Assistita: 0,
                            Enterale: 0,
                            Parenterale: 0
                        },
                        GestioneStomia: 0,
                        ElimiUrinariaIntestinale: 0,
                        AlterRitmoSonnoVeglia: 0,
                        IntEduTerapeutica: 0,
                        CuraUlcereCutanee12Grado: 0,
                        CuraUlcereCutanee34Grado: 0,
                        PrelieviVenosiNonOcc: 0,
                        ECG: 0,
                        Telemetria: 0,
                        TerSottocutIntraMuscInfus: 0,
                        GestioneCatetere: 0,
                        Trasfusioni: 0,
                        ControlloDolore: 0,
                        AssistStatoTerminaleOnc: 0,
                        AssistStatoTerminaleNonOnc: 0,
                        TrattamentiRiab: {
                            Neurologico: 0,
                            Ortopedico: 0,
                            DiMantenimento: 0
                        },
                        SupervisioneContinua: 0,
                        AssistenzaIADL: 0,
                        AssistenzaADL: 0,
                        SupportoCareGiver: 0
                    }
                }
            };
            if (annoUltimaErogazione == "0") {
                if (!outData.hasOwnProperty(annoPIC+ "_" + mesePic))
                    outData[annoPIC+ "_" + mesePic] = [];
                outData[annoPIC+ "_" + mesePic].push(tempRiga);
            }
        }

        var builder = new xml2js.Builder();
        for (let chiave of Object.keys(outData))
        {
            var obj = {FlsAssDom_1: {$: {"xmlns": "http://flussi.mds.it/flsassdom_1"},Assistenza: outData[chiave]}}
            var xml = builder.buildObject(obj);
            fs.writeFileSync(folderOut + path.sep + codRegione + codASL + "_000_" + chiave.substring(0,4) + "_" + chiave.substring(5,7) +"_SIAD_AAD_al_" + moment().date() + "_" + ((moment().month() +1) <10 ? ("0" + (moment().month() +1)) : (moment().month() +1)) + "_" + moment().year() +   ".xml", xml);
        }

        //console.log(xml);

    }

}