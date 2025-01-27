import sqlite3 from 'sqlite3';

export default class DBHelper{

    static connectionData(host,user,pass,db) {
        return {
            host: host,
            user: user,
            password: pass,
            database: db
        };
    }
    constructor(pathDB) {
        this._pathDB = pathDB;
    }

    get pathDB() {
        return this._pathDB;
    }

    set pathDB(value) {
        this._pathDB = value;
    }

    aggiungiRigheInDB(righe)
    {
        const db = new sqlite3.Database(this._pathDB);
    }
}
