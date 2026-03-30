<p align="center">
  <img src="https://img.shields.io/badge/Sanit%C3%A0-Regione%20Sicilia-red?style=for-the-badge" alt="Regione Sicilia"/>
</p>

# aziendasanitaria-utils

[![npm version](https://img.shields.io/npm/v/aziendasanitaria-utils.svg?style=flat-square)](https://www.npmjs.com/package/aziendasanitaria-utils)
[![license](https://img.shields.io/npm/l/aziendasanitaria-utils.svg?style=flat-square)](https://github.com/deduzzo/aziendasanitaria-utils/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/aziendasanitaria-utils.svg?style=flat-square)](https://nodejs.org)
[![GitHub last commit](https://img.shields.io/github/last-commit/deduzzo/aziendasanitaria-utils?style=flat-square)](https://github.com/deduzzo/aziendasanitaria-utils/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/deduzzo/aziendasanitaria-utils?style=flat-square)](https://github.com/deduzzo/aziendasanitaria-utils/issues)
[![GitHub stars](https://img.shields.io/github/stars/deduzzo/aziendasanitaria-utils?style=flat-square)](https://github.com/deduzzo/aziendasanitaria-utils/stargazers)
[![ES Modules](https://img.shields.io/badge/module-ESM-brightgreen?style=flat-square)](https://nodejs.org/api/esm.html)

Libreria Node.js per la gestione dei flussi informativi sanitari della Regione Sicilia e l'integrazione con i portali istituzionali (Tessera Sanitaria, NAR/NAR2).

---

## Indice

- [Installazione](#installazione)
- [Quick Start](#quick-start)
- [Architettura](#architettura)
- [Moduli](#moduli)
  - [Flussi Sanitari](#flussi-sanitari)
  - [Servizi NAR / Tessera Sanitaria](#servizi-nar--tessera-sanitaria)
  - [Indicatori](#indicatori)
  - [Configurazione](#configurazione)
- [API Reference](#api-reference)
- [Struttura del Progetto](#struttura-del-progetto)
- [Dipendenze Principali](#dipendenze-principali)
- [Licenza](#licenza)

---

## Installazione

```bash
npm install aziendasanitaria-utils
```

> **Requisiti:** Node.js >= 14.0.0 | ES Modules (`"type": "module"`)

---

## Quick Start

```javascript
import { flussiRegioneSicilia } from "aziendasanitaria-utils";
import { struttureDistrettiMap, distretti, comuniDistretti } from "aziendasanitaria-utils/src/config/sicilia/messina.js";

// Configurazione strutture territoriali
const strutture = new flussiRegioneSicilia.StruttureDistrettiPerProvincia(
    distretti, comuniDistretti, struttureDistrettiMap
);

// Impostazioni Flusso M
const impostazioni = new flussiRegioneSicilia.ImpostazioniFlussoM(
    "205",                          // codice ASL
    "190",                          // codice Regione
    "/path/to/input",               // cartella input
    "/path/to/output",              // cartella output
    "/path/to/FlowLook.mdb",       // database FlowLook
    strutture
);

// Elaborazione
const flussoM = new flussiRegioneSicilia.FlussoM(impostazioni);
```

---

## Architettura

```
aziendasanitaria-utils
|
|-- Flussi Sanitari           Elaborazione file a record fisso (TXT 381 char)
|   |-- FlussoM               Prestazioni specialistiche ambulatoriali
|   |-- FlussoSIAD            Sistema Informativo Assistenza Domiciliare
|   |-- FlussoHOSPICE         Cure palliative
|   |-- FlussoARSFAR          Assistenza Residenziale Semiresidenziale
|   `-- FlussoRSA             Residenze Sanitarie Assistenziali
|
|-- Servizi Esterni           Integrazione con portali istituzionali
|   |-- Ts                    Tessera Sanitaria (HTTP headless + Puppeteer)
|   |-- Nar / Nar2            Nuova Anagrafe Regionale (Puppeteer + REST API)
|   |-- Assistiti             Gestione completa dati assistiti
|   `-- Medici                Gestione dati medici MMG/PLS
|
|-- Indicatori                Calcolo indicatori LEA (D33ZA, D30Z)
|
`-- Config                    Configurazione territoriale e credenziali
```

---

## Moduli

### Flussi Sanitari

#### FlussoM - Prestazioni Specialistiche

Il modulo principale per l'elaborazione del flusso M (prestazioni ambulatoriali).

| Funzionalita | Stato |
|---|:---:|
| Verifica formale record | ✅ |
| Acquisizione dati da DB FlowLook | ✅ |
| Unione file TXT | ✅ |
| Verifica duplicati (anche milioni di record) | ✅ |
| Controllo date, nomi file, distretti | ✅ |
| Elaborazione informazioni finanziarie | ✅ |
| Verifica strutture su portale Sogei/TS | ✅ |
| Calcolo differenze e congruita TS | ✅ |
| Report HTML ed Excel | ✅ |
| Invio report via mail per distretto | ✅ |
| Calcolo volumi | ✅ |

#### FlussoSIAD - Assistenza Domiciliare

| Funzionalita | Stato |
|---|:---:|
| Conteggio prestazioni | ✅ |

#### FlussoHOSPICE - Cure Palliative

| Funzionalita | Stato |
|---|:---:|
| Calcolo giornate di degenza | ✅ |

#### FlussoARSFAR - Assistenza Residenziale

| Funzionalita | Stato |
|---|:---:|
| Calcolo ammissioni | ✅ |

#### FlussoRSA - Residenze Sanitarie

| Funzionalita | Stato |
|---|:---:|
| Elaborazione dati RSA | ✅ |

---

### Servizi NAR / Tessera Sanitaria

#### Ts - Tessera Sanitaria

Integrazione con il portale [SistemaTS](https://sistemats4.sanita.finanze.it) per la verifica e la ricerca di dati sanitari.

**Modalita headless (senza browser)** - usa `axios` + `cheerio`:

```javascript
import { Ts } from "aziendasanitaria-utils/src/narTsServices/Ts.js";
import { ImpostazioniServiziTerzi } from "aziendasanitaria-utils/src/config/ImpostazioniServiziTerzi.js";

const config = new ImpostazioniServiziTerzi({
    ts_username: "CODICE_FISCALE",
    ts_password: "PASSWORD"
});
const ts = new Ts(config);

// Ricerca STP/ENI per codice
const risultato = await ts.ricercaStpPerCodice({
    prefisso: 'STP',       // 'STP' o 'ENI'
    codiceAsl: '205',
    suffissoCodiceStp: '0000001'
});
// => { error: false, data: { codice_stp_eni, cognome, nome, genere, ... } }

// Ricerca STP/ENI per range
const elenco = await ts.ricercaStpPerRange({
    prefisso: 'STP',
    codiceAsl: '205',
    dal: '0000000',
    al: '9999999'
});
// => { error: false, data: [{ codice_stp_eni, cognome, nome, genere, nazionalita }, ...] }

// Ricerca STP/ENI per dati anagrafici
const ricerca = await ts.ricercaStpPerDati({
    prefisso: 'STP',
    codiceAsl: '205',
    cognome: 'ROSSI',
    genere: 'M'
});

// Dettaglio da link nella lista
const dettaglio = await ts.getDettaglioStp(elenco.data[0]._detailLink);

// Parsing file forniture assistiti TS (offline, no login)
const { data, stats } = Ts.getDataFromTSFile("/path/to/file.txt");

ts.closeHttpSession();
```

**Modalita browser** (Puppeteer) - per operazioni legacy:

```javascript
const page = await ts.getWorkingPage(true); // true = visibile
// ... operazioni con Puppeteer
await ts.doLogout();
```

#### Nar2 - Nuova Anagrafe Regionale (REST API)

```javascript
import { Nar2 } from "aziendasanitaria-utils/src/narTsServices/Nar2.js";

const nar2 = new Nar2(impostazioniServiziTerzi);
const token = await nar2.getToken();

// Ricerca assistiti con parametri
const assistiti = await nar2.getAssistitiFromParams({
    [Nar2.PARAMS.COGNOME]: 'ROSSI',
    [Nar2.PARAMS.NOME]: 'MARIO',
    [Nar2.PARAMS.AZIENDA]: '205'
});
```

#### Assistiti - Gestione Dati Assistiti

Orchestratore che combina dati da TS, NAR e NAR2.

```javascript
import { Assistiti } from "aziendasanitaria-utils/src/narTsServices/Assistiti.js";

const assistiti = new Assistiti(configServiziTerzi);
const dati = await assistiti.apriMMGAssistiti(codiceMMG, listaCF);
```

| Funzionalita | Stato |
|---|:---:|
| Verifica data decesso da TS | ✅ |
| Recupero dati da NAR/NAR2 | ✅ |
| Generazione documenti DOCX | ✅ |
| Elaborazione batch parallela | ✅ |

#### Medici - Gestione Dati Medici

```javascript
import { Medici } from "aziendasanitaria-utils/src/narTsServices/Medici.js";

const medici = new Medici(impostazioni, true);
```

| Funzionalita | Stato |
|---|:---:|
| Ricerca medici MMG/PLS | ✅ |
| Integrazione NAR | ✅ |
| Report PDF/Excel | ✅ |

---

### Indicatori

Calcolo degli indicatori LEA (Livelli Essenziali di Assistenza).

| Indicatore | Descrizione |
|---|---|
| **D33ZA** | Identificazione anziani >75 anni con patologie specifiche (da file ARS) |
| **D30Z** | Indicatore composito SIAD/Hospice |

---

### Configurazione

#### ImpostazioniServiziTerzi

Credenziali per i servizi esterni:

```javascript
const config = new ImpostazioniServiziTerzi({
    ts_username: "",    // Codice Fiscale per Tessera Sanitaria
    ts_password: "",    // Password TS
    nar_username: "",   // Username NAR
    nar_password: "",   // Password NAR
    nar2_username: "",  // Username NAR2
    nar2_password: ""   // Password NAR2
});
```

#### StruttureDistrettiPerProvincia

Configurazione territoriale con distretti, comuni e strutture sanitarie. Include configurazione preconfigurata per **Messina**.

```javascript
import { struttureDistrettiMap, distretti, comuniDistretti } from "aziendasanitaria-utils/src/config/sicilia/messina.js";
```

---

## API Reference

### Exports principali

```javascript
import { flussiRegioneSicilia } from "aziendasanitaria-utils";

const {
    // Flussi
    FlussoM,
    FlussoSIAD,
    FlussoHOSPICE,
    FlussoARSFAR,
    FlussoRSA,

    // Configurazione
    ImpostazioniFlussoM,
    ImpostazioniFlussoRSA,
    ImpostazioniFlussoHOSPICE,
    ImpostazioniFlussoARSFAR,
    ImpostazioniMail,
    ImpostazioniServiziTerzi,
    StruttureDistrettiPerProvincia,

    // Servizi
    Assistiti,
    Medici,
    Indicatori,

    // Dati regionali
    Messina
} = flussiRegioneSicilia;
```

### Ts - Metodi STP/ENI (headless)

| Metodo | Parametri | Ritorno |
|---|---|---|
| `ricercaStpPerCodice()` | `{ prefisso, codiceAsl, suffissoCodiceStp }` | `{ error, data, message? }` |
| `ricercaStpPerRange()` | `{ prefisso, codiceAsl, dal, al }` | `{ error, data[], message? }` |
| `ricercaStpPerDati()` | `{ prefisso, codiceAsl, cognome, genere }` | `{ error, data[], message? }` |
| `getDettaglioStp()` | `detailLink` | `{ error, data, message? }` |
| `closeHttpSession()` | - | `void` |
| `Ts.getDataFromTSFile()` | `filePath` | `{ data[], stats }` |

**Campi restituiti (dettaglio singolo):**

| Campo | Esempio |
|---|---|
| `codice_stp_eni` | `STP1902050000001` |
| `cognome` | `ROSSI` |
| `nome` | `MARIO` |
| `genere` | `M` |
| `data_nascita` | `01/01/1990` |
| `nazionalita` | `ROMANIA` |
| `indirizzo` | `VIA ROMA 1` |
| `cap` | `98100` |
| `comune` | `MESSINA` |
| `provincia` | `ME` |
| `medico` | `BIANCHI LUIGI` |
| `asl_ao` | `205 - ASP MESSINA` |
| `regione` | `Sicilia` |
| `tipo_assistito` | `assistito STP` |
| `data_inizio_assistenza` | `01/01/2024` |
| `data_fine_assistenza` | `01/07/2024` |
| `motivazione_fine_assistenza` | `FINE ASSISTENZA (DA PARTE DEL SSN)` |

**Campi restituiti (elenco):**

| Campo | Descrizione |
|---|---|
| `codice_stp_eni` | Codice identificativo |
| `cognome` | Cognome |
| `nome` | Nome |
| `genere` | M/F |
| `nazionalita` | Nazionalita |
| `_detailLink` | Link per `getDettaglioStp()` |

---

## Struttura del Progetto

```
aziendasanitaria-utils/
├── index.js                         # Entry point - export principale
├── package.json
│
├── src/
│   ├── m/
│   │   ├── FlussoM.js               # Flusso M - Prestazioni specialistiche
│   │   └── DatiStruttureProgettoTs.js
│   │
│   ├── siad/
│   │   └── FlussoSIAD.js            # Flusso SIAD - Assistenza domiciliare
│   │
│   ├── hospice/
│   │   └── FlussoHOSPICE.js         # Flusso Hospice
│   │
│   ├── ars-far/
│   │   └── FlussoARSFAR.js          # Flusso ARS ex FAR
│   │
│   ├── rsa/
│   │   └── FlussoRSA.js             # Flusso RSA
│   │
│   ├── narTsServices/
│   │   ├── Ts.js                    # Tessera Sanitaria (HTTP + Puppeteer)
│   │   ├── Nar.js                   # NAR legacy (Puppeteer)
│   │   ├── Nar2.js                  # NAR2 REST API
│   │   ├── Assistiti.js             # Gestione assistiti
│   │   └── Medici.js                # Gestione medici
│   │
│   ├── config/
│   │   ├── ImpostazioniServiziTerzi.js
│   │   ├── ImpostazioniFlussoM.js
│   │   ├── ImpostazioniFlussoSIAD.js
│   │   ├── ImpostazioniFlussoHOSPICE.js
│   │   ├── ImpostazioniFlussoARSFAR.js
│   │   ├── ImpostazioniFlussoRSA.js
│   │   ├── ImpostazioniMail.js
│   │   ├── StruttureDistrettiPerProvincia.js
│   │   └── sicilia/
│   │       └── messina.js           # Config preconfigurata Messina
│   │
│   ├── classi/
│   │   └── Assistito.js             # Classe dati assistito
│   │
│   ├── db/
│   │   ├── DBHelper.js
│   │   └── asp_esenzioni.sql
│   │
│   ├── grid/                        # Template report HTML
│   │
│   ├── Utils.js                     # Utility comuni
│   ├── Indicatori.js                # Indicatori LEA
│   ├── Procedure.js
│   ├── Stipendi.js
│   ├── CryptHelper.js
│   └── api/
│       └── APIHelper.js
│
├── config/
│   └── config_example.json          # Template configurazione
│
└── example.js                       # Esempio di utilizzo
```

---

## Dipendenze Principali

| Categoria | Librerie |
|---|---|
| **HTTP / Scraping** | axios, cheerio, puppeteer, puppeteer-extra |
| **Database** | sqlite3, mysql, knex, mdb-reader, lokijs, ioredis |
| **Documenti** | exceljs, xlsx, docx, pdf-lib, libreoffice-convert |
| **Email** | nodemailer, eml-format, @freiraum/msgreader |
| **Sicurezza** | openpgp, argon2, passport, passport-spid |
| **File** | fs-extra, adm-zip, archiver, unzipper, chokidar |
| **Utilita** | lodash, moment-timezone, xml2js, stream-json, winston |
| **AI** | @google/generative-ai |

---

## Configurazione

Creare un file `config/config.json` partendo dal template:

```json
{
    "ts_username": "",
    "ts_password": "",
    "nar_username": "",
    "nar_password": "",
    "nar2_username": "",
    "nar2_password": ""
}
```

---

## Licenza

[MIT](LICENSE) - Roberto De Domenico
