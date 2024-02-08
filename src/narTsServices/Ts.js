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
        this._retry = 5;
    }


    get logged() {
        return this._logged;
    }

    async getWorkingPage(visibile = false) {
        if (!this.logged)
            await this.doLogin(visibile)
        if (!this.logged)
            return null;
        else
            return this._workingPage;
    }

    async doLogin(visibile = false) {
        let retry = this._retry
        while (!this._logged && retry > 0) {
            this._browser = null;
            this._browser = await puppeteer.launch({headless: !visibile});
            const page = (await this._browser.pages())[0];
            try {
                await page.goto('https://sistemats4.sanita.finanze.it/simossHome/login.jsp');
                await page.type("#j_username", this._impostazioni.ts_username);
                await page.type("#j_password", this._impostazioni.ts_password);
                await page.click("#login > fieldset > input:nth-child(11)");
                await page.waitForSelector('#dettaglio_utente')
                this._workingPage = page;
                this._logged = true;
            } catch (e) {
                console.log(e);
                this._logged = false;
                await this._browser.close();
                this._browser = null;
                retry--;
            }
        }
        return this.logged;
    }

    async doLogout() {
        this._logged = false;
        if (this._logged) {
            await this._browser.close();
            this._browser = null;
            return true;
        } else return false;
    }


}