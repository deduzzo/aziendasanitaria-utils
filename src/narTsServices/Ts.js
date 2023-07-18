import puppeteer from "puppeteer";

export class Ts {
    /**
     *
     * @param {ImpostazioniServiziTerzi} impostazioni
     */
    constructor(impostazioni) {
        this._impostazioni = impostazioni;
        this._browser = null;
        this._logged = false;
        this._workingPage = null;
    }


    get logged() {
        return this._logged;
    }

    get workingPage() {
        return this._workingPage;
    }

    async doLogin() {
        if (!this._logged) {
            this._browser = await puppeteer.launch({headless: false});
            const page = (await this._browser.pages())[0];
            try {
                await page.goto('https://sistemats4.sanita.finanze.it/simossHome/login.jsp');
                await page.type("#j_username", this._impostazioni.ts_username);
                await page.type("#j_password", this._impostazioni.ts_password);
                await page.click("#login > fieldset > input:nth-child(11)");
                await page.waitForSelector('#dettaglio_utente')
                this._workingPage = page;
            } catch (e) {
                console.log(e);
                this._logged = false;
                return false;
            }
        }
        return true;
    }

    async doLogout() {
        await this._browser.close();
    }


}