import * as xml2js from 'xml2js'
import fs from 'fs';
import reader from 'xlsx';
import path, {parse} from "path";

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
    generaFlussoRettifica(pathFile,folderOut,codRegione, codASL)
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

}