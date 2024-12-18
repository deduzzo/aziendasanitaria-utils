import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readConfig = () => {
    try {
        const configPath = join(__dirname, '../config/config.json');
        const configFile = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configFile);
    } catch (error) {
        console.error('Errore nella lettura del file di configurazione:', error);
        throw error;
    }
};

const configData = readConfig();
export default configData;