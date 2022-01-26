var f = require('./index');

let path = "D:\\DATI\\Desktop\\prova";

const test =  async () => {

    let ris = await f.flussoM.elaboraFlussi(path);
    console.log(ris);

}

test();