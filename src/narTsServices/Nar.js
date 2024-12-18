import path from "path";
import puppeteer from 'puppeteer-extra';
import puppeteerExtra from 'puppeteer-extra';
import userPreferences from 'puppeteer-extra-plugin-user-preferences';
import * as os from "os";
import fs from "fs";
import {existsSync} from "fs";
import moment from "moment";
import * as Util from "util";
import {utils as Utils} from "../Utils.js";


export class Nar {
    /**
     *
     * @param {ImpostazioniServiziTerzi} impostazioni
     * @param visible
     * @param workingPath string
     * @param batchProcess
     */
    constructor(impostazioni,visible = false, workingPath = null,batchProcess = false,type = Nar.NAR) {
        this._impostazioni = impostazioni;
        this._browser = null;
        this._logged = false;
        this._workingPage = null;
        this._visible = visible;
        this._type = type;
        this._retry = 5;
        // working path for download,a temporary folder so temp dir
        this._downloadPath = path.join(os.tmpdir(), 'nar_' + Date.now());
        this._workingPath = workingPath ?? Utils.getWorkingPath()
        this._batchProcess = batchProcess;
        // create the folder if it does not exist async
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

    get batchProcess() {
        return this._batchProcess;
    }

    set batchProcess(value) {
        this._batchProcess = value;
    }

    async getWorkingPage(visible = null) {
        if (visible !== null)
            this._visible = visible;
        if (!this._logged)
            await this.doLogin();
        if (!this._logged)
            return null;
        else
            return this._workingPage;
    }

    getDownloadPath() {
        return this._downloadPath;
    }

    getWorkingPath() {
        return this._workingPath;
    }


    async doLogin() {

        await fs.promises.mkdir(this._downloadPath, {recursive: true});
        let retry = this._retry
        while (!this._logged && retry > 0) {
            if (this._type === Nar.PAGHE || this._type === Nar.NAR) {
                try {
                    puppeteerExtra.use(
                        userPreferences({
                            userPrefs: {
                                profile: {
                                    default_content_settings: {popups: 0, "multiple-automatic-downloads": 1},
                                    default_content_setting_values: {'automatic_downloads': 1},
                                },
                                download: {
                                    prompt_for_download: false,
                                    directory_upgrade: true,
                                    default_directory: this._downloadPath,
                                    extensions_to_open: 'applications/pdf',
                                },
                                plugins: {
                                    always_open_pdf_externally: true,
                                    plugins_disabled: ['Chrome PDF Viewer'],
                                },
                            },
                        })
                    );
                    this._browser = await puppeteer.launch({
                        headless: !this._visible,
                        defaultViewport: {width: 1920, height: 1080},
                        args: ['--window-size=1920,1080']
                    });
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
                    await newPage.goto("https://nar.regione.sicilia.it/NAR/mainMenu.do?ACTION=RELOG");

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
                    if (this._browser)
                        await this._browser.close();
                    retry--;
                }
            } else this._logged = false;
        }
        return this._logged;
    }

    async doLogout(closeBrowser = true) {
        if (this._logged) {
            this._logged = false;
            await this._browser.close();
            this._browser = null;
            return true;
        } else return false;
    }


}