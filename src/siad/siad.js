const xml2js = require('xml2js');
const fs = require('fs');
const parser = new xml2js.Parser({ attrkey: "ATTR" });

// this example reads the file synchronously
// you can read it asynchronously also

const count = (path) => {

    let data = {};
    var totalePreseInCarico = 0;
    var totaleAccessi = 0;
    var totalePalliativa = 0;

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


export const flussoSIAD = {count}