import {GoogleGenerativeAI} from "@google/generative-ai";
import config from './src/config.js';
// Sostituisci con la tua chiave API
const API_KEY = config.gemini_api_key;

// Inizializza il modello
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({model: "gemini-pro"});

// Contesto iniziale
const initialContext = `
Sei un assistente query e ti trovi in mezzo tra l'utente e un database mysql, ricevi in inpmput una richiesta di dati in formato discorsico e restituisci la query che soddisfa la richiesta.
a quel punto ti verrà restituito il risultato della query e tu risponderai presentando il risultato in formato discorsivo. Ecco lo schema del DB: CREATE TABLE \`anagrafica\` (
  \`id\` int(11) NOT NULL,
  \`cognome_nome\` varchar(100) DEFAULT NULL,
  \`cognome\` varchar(100) DEFAULT NULL,
  \`nome\` varchar(100) DEFAULT NULL,
  \`codice_fiscale\` varchar(20) NOT NULL,
  \`data_nascita\` date DEFAULT NULL,
  \`comune_nascita\` varchar(100) DEFAULT NULL,
  \`indirizzo_residenza\` varchar(200) DEFAULT NULL,
  \`comune_residenza\` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`anagrafica_altricampi\` (
  \`id\` int(11) NOT NULL,
  \`id_anagrafica\` int(11) DEFAULT NULL,
  \`id_tipologia\` int(11) DEFAULT NULL,
  \`valore\` text DEFAULT NULL,
  \`data_inserimento\` datetime DEFAULT NULL,
  \`valido\` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`auth_assignment\` (
  \`item_name\` varchar(64) NOT NULL,
  \`user_id\` varchar(64) NOT NULL,
  \`created_at\` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;







CREATE TABLE \`auth_item\` (
  \`name\` varchar(64) NOT NULL,
  \`type\` smallint(6) NOT NULL,
  \`description\` text DEFAULT NULL,
  \`rule_name\` varchar(64) DEFAULT NULL,
  \`data\` blob DEFAULT NULL,
  \`created_at\` int(11) DEFAULT NULL,
  \`updated_at\` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;







CREATE TABLE \`auth_item_child\` (
  \`parent\` varchar(64) NOT NULL,
  \`child\` varchar(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;







CREATE TABLE \`auth_rule\` (
  \`name\` varchar(64) NOT NULL,
  \`data\` blob DEFAULT NULL,
  \`created_at\` int(11) DEFAULT NULL,
  \`updated_at\` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;







CREATE TABLE \`codice_esterno\` (
  \`id\` int(11) NOT NULL,
  \`id_servizio_esterno\` int(11) DEFAULT NULL,
  \`id_tipologia\` int(11) DEFAULT NULL,
  \`id_chiave_esterna\` int(11) DEFAULT NULL,
  \`valore\` varchar(100) DEFAULT NULL,
  \`attivo\` tinyint(1) DEFAULT 1,
  \`legame_json\` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`conto\` (
  \`id\` int(11) NOT NULL,
  \`iban\` varchar(40) NOT NULL,
  \`intestatario\` varchar(200) DEFAULT NULL,
  \`note\` text DEFAULT NULL,
  \`attivo\` bit(1) NOT NULL DEFAULT b'1',
  \`validato\` bit(1) NOT NULL DEFAULT b'1',
  \`data_validazione\` datetime DEFAULT NULL,
  \`id_istanza\` int(11) DEFAULT NULL,
  \`data_disattivazione\` datetime DEFAULT NULL,
  \`data_creazione\` datetime DEFAULT NULL,
  \`data_modifica\` datetime DEFAULT NULL,
  \`id_utente_creazione\` int(11) DEFAULT NULL,
  \`id_utente_modifica\` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`conto_cessionario\` (
  \`id\` int(11) NOT NULL,
  \`id_conto\` int(11) DEFAULT NULL,
  \`id_cessionario\` int(11) DEFAULT NULL,
  \`attivo\` int(11) NOT NULL DEFAULT 1,
  \`data_disattivazione\` int(11) DEFAULT NULL,
  \`note\` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`decreto\` (
  \`id\` int(11) NOT NULL,
  \`descrizione_atto\` varchar(100) DEFAULT NULL,
  \`data\` date DEFAULT NULL,
  \`importo\` double DEFAULT NULL,
  \`dal\` date DEFAULT NULL,
  \`al\` date DEFAULT NULL,
  \`inclusi_minorenni\` tinyint(1) DEFAULT 1,
  \`inclusi_maggiorenni\` tinyint(1) DEFAULT 1,
  \`nome_file\` varchar(100) DEFAULT NULL,
  \`note\` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`decreto_gruppi\` (
  \`id_gruppo\` int(11) NOT NULL,
  \`id_decreto\` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`determina\` (
  \`id\` int(11) NOT NULL,
  \`numero\` varchar(10) DEFAULT NULL,
  \`pagamenti_da\` date DEFAULT NULL,
  \`pagamenti_a\` date DEFAULT NULL,
  \`data\` date DEFAULT NULL,
  \`importo\` double DEFAULT NULL,
  \`deceduti\` bit(1) NOT NULL DEFAULT b'0',
  \`storico\` bit(1) NOT NULL DEFAULT b'0',
  \`non_ordinaria\` bit(1) NOT NULL DEFAULT b'0',
  \`descrizione\` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`determina_gruppo_pagamento\` (
  \`id\` int(11) NOT NULL,
  \`id_determina\` int(11) DEFAULT NULL,
  \`id_gruppo\` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`distretto\` (
  \`id\` int(11) NOT NULL,
  \`nome\` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`documento\` (
  \`id\` int(11) NOT NULL,
  \`id_tipologia\` int(11) NOT NULL,
  \`data\` int(11) DEFAULT NULL,
  \`id_istanza\` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`gruppo\` (
  \`id\` int(11) NOT NULL,
  \`data_termine_istanze\` date DEFAULT NULL,
  \`data_inizio_beneficio\` date DEFAULT NULL,
  \`descrizione_gruppo\` varchar(10) DEFAULT NULL,
  \`descrizione_gruppo_old\` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`gruppo_pagamento\` (
  \`id\` int(11) NOT NULL,
  \`data\` date DEFAULT NULL,
  \`descrizione\` text DEFAULT NULL,
  \`progressivo\` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`isee\` (
  \`id\` int(11) NOT NULL,
  \`importo\` double DEFAULT NULL,
  \`maggiore_25mila\` bit(1) NOT NULL,
  \`data_presentazione\` date DEFAULT NULL,
  \`anno_riferimento\` int(11) DEFAULT NULL,
  \`data_scadenza\` date DEFAULT NULL,
  \`valido\` bit(1) NOT NULL DEFAULT b'1',
  \`verificato\` bit(1) NOT NULL DEFAULT b'1',
  \`valido_fino_a\` date DEFAULT NULL,
  \`id_istanza\` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`istanza\` (
  \`id\` int(11) NOT NULL,
  \`data_inserimento\` date DEFAULT NULL,
  \`riconosciuto\` bit(1) NOT NULL DEFAULT b'0',
  \`classe_disabilita\` text DEFAULT NULL,
  \`data_riconoscimento\` date DEFAULT NULL,
  \`patto_di_cura\` bit(1) NOT NULL DEFAULT b'0',
  \`data_firma_patto\` date DEFAULT NULL,
  \`attivo\` bit(1) NOT NULL DEFAULT b'0',
  \`data_decesso\` date DEFAULT NULL,
  \`liquidazione_decesso_completata\` bit(1) DEFAULT b'0',
  \`data_liquidazione_decesso\` date DEFAULT NULL,
  \`chiuso\` bit(1) NOT NULL DEFAULT b'0',
  \`rinuncia\` bit(1) NOT NULL DEFAULT b'0',
  \`data_chiusura\` date DEFAULT NULL,
  \`nota_chiusura\` text DEFAULT NULL,
  \`rawdata_json\` text DEFAULT NULL,
  \`note\` text DEFAULT NULL,
  \`id_anagrafica_disabile\` int(11) NOT NULL,
  \`id_distretto\` int(11) NOT NULL,
  \`id_gruppo\` int(11) NOT NULL,
  \`id_caregiver\` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;


CREATE TABLE \`log\` (
  \`id\` int(11) NOT NULL,
  \`id_esterno\` int(11) DEFAULT NULL,
  \`id_tipologia_record\` int(11) DEFAULT NULL,
  \`id_tipo_azione\` int(11) DEFAULT NULL,
  \`vecchio_valore\` text DEFAULT NULL,
  \`id_utente\` int(11) DEFAULT NULL,
  \`data_modifica\` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`migration\` (
  \`version\` varchar(180) NOT NULL,
  \`apply_time\` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`movimento\` (
  \`id\` int(11) NOT NULL,
  \`importo\` double NOT NULL,
  \`is_movimento_bancario\` bit(1) NOT NULL DEFAULT b'0',
  \`data\` date DEFAULT NULL,
  \`periodo_da\` date DEFAULT NULL,
  \`periodo_a\` date DEFAULT NULL,
  \`tornato_indietro\` bit(1) NOT NULL DEFAULT b'0',
  \`data_invio_notifica\` int(11) DEFAULT NULL,
  \`data_incasso\` int(11) DEFAULT NULL,
  \`id_recupero\` int(11) DEFAULT NULL,
  \`num_rata\` int(11) DEFAULT NULL,
  \`contabilizzare\` bit(1) NOT NULL DEFAULT b'1',
  \`escludi_contabilita\` bit(1) DEFAULT b'0',
  \`note\` text DEFAULT NULL,
  \`id_gruppo_pagamento\` int(11) DEFAULT NULL,
  \`id_determina\` int(11) DEFAULT NULL,
  \`id_conto\` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`recupero\` (
  \`id\` int(11) NOT NULL,
  \`importo\` double DEFAULT NULL,
  \`chiuso\` bit(1) NOT NULL DEFAULT b'0',
  \`annullato\` bit(1) NOT NULL DEFAULT b'0',
  \`data_annullamento\` date DEFAULT NULL,
  \`rateizzato\` bit(1) NOT NULL DEFAULT b'0',
  \`num_rate\` int(11) DEFAULT NULL,
  \`importo_rata\` double DEFAULT NULL,
  \`note\` text DEFAULT NULL,
  \`data_creazione\` datetime DEFAULT NULL,
  \`data_modifica\` datetime DEFAULT NULL,
  \`chiusura_decesso\` bit(1) NOT NULL DEFAULT b'0',
  \`id_istanza\` int(11) DEFAULT NULL,
  \`id_recupero_collegato\` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;



CREATE TABLE \`residenza\` (
  \`id\` int(11) NOT NULL,
  \`indirizzo\` varchar(200) NOT NULL,
  \`comune_residenza\` varchar(100) DEFAULT NULL,
  \`cap\` int(11) DEFAULT NULL,
  \`attivo\` tinyint(1) NOT NULL DEFAULT 1,
  \`id_anagrafica\` int(11) NOT NULL,
  \`data_inserimento\` int(11) NOT NULL,
  \`data_disattivazione\` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`ricovero\` (
  \`id\` int(11) NOT NULL,
  \`da\` date DEFAULT NULL,
  \`a\` date DEFAULT NULL,
  \`cod_struttura\` varchar(100) DEFAULT NULL,
  \`descr_struttura\` varchar(100) DEFAULT NULL,
  \`contabilizzare\` bit(1) NOT NULL DEFAULT b'1',
  \`note\` text DEFAULT NULL,
  \`id_istanza\` int(11) DEFAULT NULL,
  \`id_determina\` int(11) DEFAULT NULL,
  \`id_recupero\` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`servizi_esterni\` (
  \`id\` int(11) NOT NULL,
  \`descrizione\` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`tipologia_dati_azioni\` (
  \`id\` int(11) NOT NULL,
  \`tipo\` varchar(50) NOT NULL,
  \`categoria\` varchar(100) DEFAULT NULL,
  \`tipologia\` varchar(100) DEFAULT NULL COMMENT 'tipologia',
  \`descrizione\` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;







CREATE TABLE \`user\` (
  \`id\` int(11) NOT NULL,
  \`username\` varchar(255) NOT NULL,
  \`auth_key\` varchar(32) NOT NULL,
  \`password_hash\` varchar(255) NOT NULL,
  \`password_reset_token\` varchar(255) DEFAULT NULL,
  \`email\` varchar(255) NOT NULL,
  \`attivo\` tinyint(1) NOT NULL DEFAULT 1,
  \`created_at\` datetime NOT NULL,
  \`updated_at\` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;



Il  db gestisce le domande di sussidio di disabilità gravissima per l'ASP di Messina


`;

async function askQuestion(question) {
    try {
        // Costruisci il prompt completo con contesto e domanda
        const prompt = `${initialContext}\n\nDomanda: ${question}\n\nRisposta:`;

        // Genera la risposta
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log(`\nDomanda: ${question}`);
        console.log(`Risposta: ${text}`);
    } catch (error) {
        console.error("Errore:", error);
    }
}

// Esempi di domande
async function main() {
    await askQuestion("c'è qualcuno di nome Mario che ha un istanza attiva?");
}

main();