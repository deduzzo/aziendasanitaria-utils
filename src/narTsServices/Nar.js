import puppeteer from "puppeteer";

export class Nar {
    /**
     *
     * @param {ImpostazioniServiziTerzi} impostazioni
     */
    constructor(impostazioni) {
        this._impostazioni = impostazioni;
        this._browser = null;
        this._logged = false;
        this._workingPage = null;
        this._type = Nar.NAR;
        this._retry = 5;
    }

    static PAGHE = 0;
    static NAR = 1;

    get type() {
        return this._type;
    }

    set type(value) {
        this._type = value;
    }

    get logged() {
        return this._logged;
    }

    get browser() {
        return this._browser;
    }

    async getWorkingPage() {
        if (!this.logged)
            await this.doLogin()
        if (!this.logged)
            return null;
        else
            return this._workingPage;
    }

    async doLogin() {
        let retry = this._retry
        while (!this._logged && retry > 0) {
            if (this._type === Nar.PAGHE || this._type === Nar.NAR) {
                try {
                    this._browser = await puppeteer.launch({headless: false});
                    const page = (await this._browser.pages())[0];
                    await page.goto('https://nar.regione.sicilia.it/NAR/');
                    await page.type("#loginform > div > input:nth-child(2)", this._impostazioni.nar_username);
                    await page.type("#loginform > div > input:nth-child(7)", this._impostazioni.nar_password);
                    await page.click("#loginform > div > div > div:nth-child(1) > input");
                    const newTarget = await this._browser.waitForTarget(target => target.opener() === page.target());
                    await page.close();
                    //get the new page object:
                    const newPage = await newTarget.page();
                    await newPage.goto('https://nar.regione.sicilia.it/NAR/mainLogin.do');
                    await newPage.waitForSelector("select[name='ufficio@Controller']");
                    //await newPage.waitForSelector("#oCMenu_fill");
                    await newPage.type("select[name='ufficio@Controller']", (this._type === Nar.NAR ? "UffOpSce" : "UffPag"));
                    await newPage.waitForTimeout(2000);
                    await newPage.click("input[name='BTN_CONFIRM']");
                    await newPage.waitForSelector("#oCMenubbar_0");
                    this._workingPage = newPage;
                    this._logged = true;
                } catch (e) {
                    this._logged = false;
                    await this._browser.close();
                    retry--;
                }
            } else this._logged = false;
        }
        return this._logged;
    }

    async doLogout() {
        if (this._logged) {
            this._logged = false;
            await this._browser.close();
            return true;
        } else return false;
    }


}