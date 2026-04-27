# Cambio Medico su NAR2 — Specifica tecnica delle chiamate API

> Documento di riferimento per implementare un client (anche automatico) della procedura di **cambio medico di base / pediatra** sul portale NAR2 della Regione Sicilia.
>
> Tutte le chiamate sono autenticate con Bearer token JWT ottenuto via `POST /api/login`. Il flusso è derivato dall'osservazione del traffico reale del portale operatore (`/operatore/pazienti/{pz_id}/medico/scelta-medico`) e validato end-to-end.

---

## 1. Indice rapido

1. [Panoramica del flusso](#2-panoramica-del-flusso)
2. [Autenticazione e base URL](#3-autenticazione-e-base-url)
3. [Step 1 — Recupero assistito](#4-step-1--recupero-assistito)
4. [Step 2 — Scelta medico attiva (per la revoca)](#5-step-2--scelta-medico-attiva-per-la-revoca)
5. [Step 3 — Situazioni assistenziali ammesse](#6-step-3--situazioni-assistenziali-ammesse)
6. [Step 4 — Categorie cittadino ammesse](#7-step-4--categorie-cittadino-ammesse-opzionale)
7. [Step 5 — Ambiti di domicilio](#8-step-5--ambiti-di-domicilio)
8. [Step 6 — Medici disponibili nell'ambito](#9-step-6--medici-disponibili-nellambito)
9. [Step 7 — Submit cambio medico](#10-step-7--submit-cambio-medico-finale)
10. [Cataloghi e costanti](#11-cataloghi-e-costanti)
11. [Mapping payload completo](#12-mapping-payload-completo)
12. [Casi particolari e edge cases](#13-casi-particolari-ed-edge-cases)
13. [Esempio end-to-end completo](#14-esempio-end-to-end-completo-pseudocodice)

---

## 2. Panoramica del flusso

Il cambio medico richiede **una sola POST finale** verso `/pazienti/sceltaMedico`, ma il payload va costruito raccogliendo informazioni da diversi endpoint di lettura:

```
┌───────────────────────────────────────────────────────────────┐
│ 1. POST /login                                 → JWT token    │
├───────────────────────────────────────────────────────────────┤
│ 2. GET  /pazienti?codiceFiscale=…              → pz_id        │
│ 3. GET  /pazienti/{pz_id}                       → dati + storico│
├───────────────────────────────────────────────────────────────┤
│ 4. GET  /getOnlySitAss/{pz_id}/null/{az}/M/{eta}             │
│         → situazioni assistenziali ammesse (sa_id, motivi)    │
│ 5. GET  /ambitoDomTable?…                       → ambiti     │
│ 6. GET  /mediciByAmbitoTable?…                  → medici     │
├───────────────────────────────────────────────────────────────┤
│ 7. POST /pazienti/sceltaMedico   { data, dett_pazientemedico, │
│                                    revoca_scelta_precedente } │
│         → pm_id, pm_r_medico (id rapporto)                    │
└───────────────────────────────────────────────────────────────┘
```

**Tutti i passi 2–6 servono solo a costruire il payload del passo 7.** Se si conoscono già `pz_id`, `pm_id` corrente, `ambito`, `pf_id` medico, `eta`, `sa_id`, `motivo_op`, si può saltare direttamente alla POST.

---

## 3. Autenticazione e base URL

- **Base URL**: `https://nar2.regione.sicilia.it/services/index.php/api`
- **Header per tutte le chiamate API**: `Authorization: Bearer <jwt>` + `Content-Type: application/json` (per POST)
- Il token contiene claims: `sub` (utente), `active_azienda` (es. `"ME"`), `active_ufficio`, `active_role`, `iat`, `exp`. La validità è di circa **8 ore** (`exp - iat ≈ 28800`).
- **Convenzione di risposta**:
  - La maggior parte degli endpoint ritorna `{status: "true"|"false", result: <data>, count, sogei, not_pf_id}`.
  - **ATTENZIONE**: alcuni endpoint (`getOnlySitAss`, `getSCIDBySAID`) ritornano **direttamente l'array** senza envelope. La classe `Nar2` lo gestisce con il flag `rawResponse: true` di `#getDataFromUrlIdOrParams`.
  - Quando `status === "false"` o appare la stringa `"token is invalid"`, occorre riautenticarsi (vedi § 3.3 — non esiste refresh).

### 3.1 Login legacy (username/password)

```
POST /login
Content-Type: application/json
Body: {"username": "...", "password": "..."}
→ Response: {"accessToken": "<jwt>"}
```

JWT con `iss: "https://nar2.regione.sicilia.it/services/index.php/api/login"`. Disponibile per gli **account operatore** ASP. Da verificare nel tempo se rimarrà attivo dopo il rollout SPID; al 2026-04 funziona regolarmente.

### 3.2 Login via SPID/CIE (Identity Provider WSO2 Regione Sicilia)

Flusso reale:

1. L'utente apre `https://nar2.regione.sicilia.it/` e clicca **Entra con SPID** o **Entra con CIE**.
2. Il browser viene reindirizzato a WSO2 (Identity Provider regionale).
3. SPID/CIE autentica l'utente (OTP, app SPID, NFC+PIN, ecc.).
4. WSO2 reindirizza al portale via:
   ```
   GET https://nar2.regione.sicilia.it/auth/login?from=WSO2&token=<JWT>
   ```
5. Il browser estrae `<JWT>` dalla query string e lo usa come `Authorization: Bearer ...` per le successive API.

**Caratteristiche del JWT post-SPID** (verificate empiricamente):

- **Stessa struttura del legacy**, stessi claims (`sub`, `active_azienda`, `active_role`, `active_ufficio`).
- Unica differenza: `iss: "https://nar2.regione.sicilia.it/services/logincallback"` (vs `/services/index.php/api/login`).
- Stesso TTL (8h).
- **Tutte le API REST `/services/index.php/api/...` accettano questo JWT senza distinzione dal legacy** (testato su endpoint sensibili come `/utenti/getUffrolsByUsersAndSociety`).

**Conseguenza per l'automazione**: se il login legacy venisse disattivato, basta intercettare il JWT dalla URL del callback dopo un login manuale SPID e usarlo come token Bearer per ~8h. Nessuna modifica logica al codice di consumo delle API.

### 3.3 Niente refresh token

Il portale **non espone** alcun endpoint di refresh/rinnovo:

- `GET /api/auth/getPermissionToken` → ritorna i **permessi** dell'utente (es. `inserimento_pazienti:true`), NON un nuovo token.
- `POST /api/getMenuOfUsersToken` → ritorna le **voci di menu** accessibili.
- `POST /api/auth/changeRoleTemp {azienda, ufficio}` → cambia ruolo/ufficio attivo (utile se l'utente ha più uffici come `UffOperatore`/`UffPagheME`); plausibilmente rilascia un nuovo JWT con i nuovi claims, ma richiede un token già valido.
- Stringhe `refreshToken`/`refresh_token`/`renewToken` non presenti nel bundle JS del portale.

→ Alla scadenza del JWT, **riautenticazione completa** (nuovo `POST /login` o nuovo flusso SPID). Pattern equivalente a OAuth2 `client_credentials`, NON a `authorization_code` con silent refresh.

### 3.4 Endpoint citati ma non sempre necessari

Dopo il login il portale Angular chiama in sequenza una serie di endpoint di sessione/permessi che la classe `Nar2` **non riproduce** (non sono necessari per le operazioni anagrafiche/cambio medico):

- `GET /api/user`
- `GET /api/utenti/getUffrolsByUsersAndSociety/{user}/{az}` → uffici e ruoli
- `GET /api/utenti/getRoleByOffice/{user}/{az}/{ufficio_id}`
- `POST /api/getMenuOfUsersToken {id_user}` → voci di menu
- `GET /api/auth/getPermissionToken` → permessi
- `GET /api/getAslByProvincia/{prov}`, `GET /api/getRegionByAzienda/{az}`, `GET /api/getParamsData/{az}/{cat_citt}` → dropdown geografici/parametri

Sono replicabili ma utili solo se si vuole costruire una vera sessione utente (UI). Per chiamate API "headless" basta il `Authorization: Bearer`.

---

## 4. Step 1 — Recupero assistito

### 4.1 Ricerca per codice fiscale

```
GET /pazienti?codiceFiscale={CF}
Authorization: Bearer {token}
```

**Risposta** (estratto):
```json
{
  "status": "true",
  "result": [
    { "pz_id": 1128286, "pz_cfis": "DDMRRT86A03F158E",
      "pz_cogn": "DE DOMENICO", "pz_nome": "ROBERTO",
      "pz_dt_nas": "1986-01-03 00:00:00", "pz_sesso": "M",
      "pz_cap_res": "98168", "pz_ind_res": "VIA ..." }
  ]
}
```

Estrarre `pz_id` (univoco se la ricerca ritorna 1 risultato).

### 4.2 Dati completi assistito

```
GET /pazienti/{pz_id}
Authorization: Bearer {token}
```

**Campi rilevanti per il cambio medico**:

| Campo | Tipo | Note |
|-------|------|------|
| `pz_id` | int | id paziente — usato come `pm_paz` |
| `pz_dt_nas` | string | calcola `eta` (anni interi alla data scelta) |
| `pz_com_res` | string | codice comune residenza — usato per cercare ambiti |
| `pz_categoria_citt` | string | id categoria cittadino — passato a `mediciByAmbito` |
| `comune_domicilio._azienda[0].az_azie` | string | sigla azienda (es. `"ME"`) — per la maggior parte delle URL |
| `storico_medici[]` | array | storico scelte (vedi § 5) |
| `medico` | object | dati anagrafici del medico attuale (alias del primo storico attivo) |

---

## 5. Step 2 — Scelta medico attiva (per la revoca)

La scelta medico **attualmente in essere** non è un campo top-level: si trova **dentro `storico_medici[]`** filtrando per:

```js
storico_medici.find(s => s.pm_fstato === "A" && !s.pm_dt_disable)
```

Esempio di elemento:
```json
{
  "pm_paz": 1128286,
  "pm_id": 36968471,            // ← serve come revoca_id
  "pm_medico": 12594,           // pf_id del medico attuale
  "pm_r_medico": "66153",       // ri_id del rapporto attivo
  "pm_dt_enable": "2026-04-26 00:00:00",
  "pm_dt_disable": null,
  "pm_fstato": "A",
  "pm_mot_scelta": "90000000025",
  "dett_pazientemedico": { "dm_ambito_dom": "140", "dm_situazione_ass": "4", ... },
  "medico": { "pf_id": 12594, "pf_cfis": "...", "pf_cognome": "MARINO", ... }
}
```

> ⚠️ NON usare `result.sceltaMedico.pm_id` (in quel campo NAR2 colloca solo i **cataloghi** `sitAss_`, `tipoOperazioni_`, `motiviOperazione_`, NON la scelta corrente).

Se l'assistito non ha alcun medico attivo (rara: prima iscrizione), si invierà la POST **senza** il blocco `revoca_scelta_precedente`.

---

## 6. Step 3 — Situazioni assistenziali ammesse

```
GET /getOnlySitAss/{pz_id}/{pm_id|null}/{az_id}/{tipo_med}/{eta}
Authorization: Bearer {token}
```

| Path param | Valore |
|------------|--------|
| `pz_id` | id paziente |
| `pm_id` | `null` (stringa) per nuova scelta, oppure il `pm_id` corrente |
| `az_id` | sigla azienda (es. `"ME"`) |
| `tipo_med` | `"M"` MMG, `"P"` Pediatra |
| `eta` | età paziente (anni interi) |

**Risposta**: array di `<situazione>` (NON wrappata):
```json
[
  {
    "sa_id": "4", "sa_cod": "13",
    "sa_desc": "Cambio medico nell ASL (residente)",
    "sa_posizione_assiste": "90000000079",
    "motivo_op": [{
      "eg_id": "90000000025", "eg_cod": "A04",
      "eg_desc1": "Cambio medico",
      "gentgen": [{ "gt_id2": "39100000036", … }, { "gt_id2": "39100000038", … }]
    }],
    "pos_ass": { … },
    "cat_citt": [ { "sc_id": "44", "sc_categoria_citt": "..." }, … ]
  },
  …
]
```

**Output essenziali**:
- `sa_id` → diventa `dm_situazione_ass` nel payload
- `motivo_op[0].eg_id` → diventa `pm_mot_scelta` e `dm_motivo_scelta` (motivo della scelta)
- `motivo_op[0].gentgen.find(g => g.gt_id2 === "39100000036").gt_id2` → `dm_tipoop_scelta` (sempre `"39100000036"` per "Scelta")
- Per la revoca della scelta precedente: `dm_tipoop_revoca = "39100000038"`

### Mapping `sa_cod` → significato

| `sa_cod` | `sa_id` | Descrizione | Motivo associato |
|----------|---------|-------------|------------------|
| `13` | `4` | Cambio medico nell'ASL (residente) | A04 — `90000000025` |
| `17` | `5` | Cambio per ricong.fam. MMG | A06 — `90000000027` |
| `18` | `6` | Cambio medico nella regione (residente) | A04 — `90000000025` |
| `19` | `7` | Cambio in regione ricong.fam. MMG | A06 — `90000000027` |
| `29` | `26` | Iscrizione in elenco separato | A07 — `90000000028` |
| `31` | `28` | Cambio medico in deroga territoriale | A19 — `90000000140` |

> Il default per il "cambio medico standard" tra residenti della stessa ASL è **`sa_cod=13`**.

---

## 7. Step 4 — Categorie cittadino ammesse (opzionale)

```
GET /getSCIDBySAID/{sa_id}
```

Risposta: array di stringhe (sc_id), es. `["44","43","66","132","131"]`. Serve solo come validazione (incrocia con `pz_categoria_citt`); **non viene messo nel payload**.

---

## 8. Step 5 — Ambiti di domicilio

### 8.1 Lookup tabellare

```
GET /ambitoDomTable?situazione_assistenziale={4}&azienda={pz_com_res}&tipo=90000000038
```

| Param | Note |
|-------|------|
| `situazione_assistenziale` | numerico — usa il **codice numerico legacy** (4 = residente in regione). Per il cambio medico standard: `4`. |
| `azienda` | il **codice comune di residenza** del paziente (`pz_com_res`, NON la sigla `"ME"`) |
| `tipo` | `"90000000038"` per ambito MMG, `"90000000040"` per distretto |

Risposta:
```json
{
  "status": "true",
  "result": [
    { "sr_id": "140", "sr_az": "ME", "sr_codice": "20502M03",
      "sr_desc": "MESSINA CITTA' - AMBITO 3",
      "tipi_strutture": { "tipo": { "eg_desc1": "Ambito della medicina di base" } } },
    …
  ]
}
```

Il valore `sr_id` finirà nel payload come `dm_ambito_dom` (e tipicamente anche `dm_ambito_scelta`).

> **Distinzione ambiti MMG vs Pediatri**: nel `sr_desc` gli ambiti MMG hanno cifre nel codice, quelli pediatrici no. Si può ulteriormente filtrare con `getMediciByAmbito({tipoMedico: "P"})`.

### 8.2 Autocomplete (alternativa)

```
GET /ambitoDomScelta?start=0&autocomplete=true&searchKey={mess}&azienda={83}&tipo=90000000038&showAzienda=false
```

Stessa struttura di risposta, filtrata per `searchKey`.

---

## 9. Step 6 — Medici disponibili nell'ambito

```
GET /mediciByAmbitoTable?
    ambito=140&
    tipo_medico=M&
    dataScelta=2026-04-26&
    start=0&length=0&pagination=yes&
    sit_ass=4&
    cat_citt=90000000052&
    check_first_doctor=true&
    not_search_after=null&
    idPaziente=1128286
```

| Param | Valore |
|-------|--------|
| `ambito` | `sr_id` ambito di scelta |
| `tipo_medico` | `"M"` o `"P"` |
| `dataScelta` | `YYYY-MM-DD`, tipicamente la data corrente |
| `sit_ass` | id situazione assistenziale numerico (4 per il cambio standard) |
| `cat_citt` | `pz_categoria_citt` dal paziente |
| `idPaziente` | `pz_id` |

**Risposta** — ogni elemento dell'array è una struttura **flat compatta**:

```json
{
  "pf_id": 10193,
  "pf_nome": "ELIO MARIA",
  "pf_cognome": "ADAMO",
  "codice_reg": "...",                      // codice regionale del medico
  "massimale": 1500,                         // massimale convenzionale
  "scelte": 1234,                            // scelte attive correnti
  "carico": 1234,                            // carico totale
  "temporanei": 0,
  "medico_massimalista": false,              // true se ha raggiunto/superato il massimale
  "rapporto_individuale_attivo": true,
  "deroga": null
}
```

> Se servono CF, telefono, email, ENPAM: chiamare in aggiunta `GET /medici/{pf_id}` (struttura ricca con `rapporto_individuale[].dett_medico`).

### 9.1 Variante autocomplete (con dati estesi)

```
GET /mediciByAmbito?start=0&autocomplete=true&searchKey={ros}&azienda=ME&tipo=M&dataScelta=2026-04-26&situazioneAss=4&ambito=140&idPaziente=1128286
```

Restituisce la struttura **completa**: `pf_cfis`, `rapporto_individuale[0].ri_id`, `dett_medico.dm_creg`, `dm_codenpam`, `ambito`, `massimali[]`.

---

## 10. Step 7 — Submit cambio medico finale

```
POST /pazienti/sceltaMedico
Authorization: Bearer {token}
Content-Type: application/json
```

### 10.1 Payload completo

```json
{
  "data": {
    "pm_paz": 1128286,
    "pm_fstato": "A",
    "pm_medico": 10193,
    "pm_dt_scad": null,
    "pm_dt_enable": "2026-04-26",
    "pm_mot_scelta": "90000000025"
  },
  "dett_pazientemedico": {
    "dm_ambito_dom": "140",
    "dm_situazione_ass": "4",
    "dm_eta_scelta": 40,
    "dm_ambito_scelta": "140",
    "dm_motivo_scelta": "90000000025",
    "dm_tipoop_scelta": "39100000036",
    "dm_dt_fine_proroga_ped": null,
    "dm_motivo_pror_scad_ped": null
  },
  "revoca_scelta_precedente": {
    "pm_dt_disable": "2026-04-25",
    "dm_dt_ins_revoca": "2026-04-26",
    "dm_motivo_revoca": "90000000025",
    "dm_tipoop_revoca": "39100000038",
    "revoca_id": 36968471
  }
}
```

### 10.2 Risposta

```json
{
  "status": true,
  "result": {
    "pm_paz": 1128286,
    "pm_fstato": "A",
    "pm_medico": 10193,
    "pm_dt_scad": null,
    "pm_dt_enable": "2026-04-26",
    "pm_mot_scelta": "90000000025",
    "pm_id": 36968473,                  // ← id della NUOVA scelta
    "pm_dt_ins": "2026-04-26 22:29:59",
    "pm_ut_ins": "roberto.dedomenico",
    "pm_r_medico": "66066"              // id del rapporto medico-paziente
  },
  "count": null, "sogei": null, "not_pf_id": null
}
```

### 10.3 Verifica post-submit

Dopo il submit, il portale ricarica i dati paziente con:

```
GET /PazienteMedico/{pz_id}/{pm_id_nuova}/{az_id}/null/null
GET /getOnlySitAss/{pz_id}/{pm_id_nuova}/{az_id}/M/{eta}
```

Non sono obbligatorie ma utili a confermare che la scelta sia stata persistita.

---

## 11. Cataloghi e costanti

### 11.1 Motivi operazione (`pm_mot_scelta`, `dm_motivo_scelta`, `dm_motivo_revoca`)

| Codice | ID | Descrizione |
|--------|----|-------------|
| `A04` | `90000000025` | **Cambio medico** (default) |
| `A06` | `90000000027` | Ricongiungimento familiare |
| `A07` | `90000000028` | Deroga al massimale |
| `A19` | `90000000140` | Deroga territoriale |
| `01` | `90000000073` | Cambio residenza in regione |
| —    | `90000000029` | Motivo revoca (interno) |

### 11.2 Tipi operazione (`dm_tipoop_scelta`, `dm_tipoop_revoca`)

| Codice | ID | Significato |
|--------|----|-------------|
| `1` | `39100000036` | **Scelta** (variazione del medico) |
| `2` | `39100000037` | Nuova iscrizione |
| `3` | `39100000038` | **Revoca** |

### 11.3 Tipo struttura (per `/ambitoDomTable?tipo=`)

- `90000000038` → Ambito della medicina di base
- `90000000040` → Distretto

### 11.4 Categorie medico

- MMG: `90000000045`
- Pediatra: `90000000046`

### 11.5 Tipo medico (`tipo_medico`)

- `M` = MMG
- `P` = Pediatra

---

## 12. Mapping payload completo

Tabella completa di **dove leggere** ogni campo del payload finale:

### `data` (oggetto principale paziente_medico)

| Campo | Origine | Note |
|-------|---------|------|
| `pm_paz` | `pazienti/{cf} → pz_id` | int |
| `pm_fstato` | costante `"A"` | sempre attivo |
| `pm_medico` | scelta utente, `pf_id` da `mediciByAmbitoTable` | int |
| `pm_dt_scad` | `null` | (riempito automaticamente dal server) |
| `pm_dt_enable` | data corrente `YYYY-MM-DD` | data scelta |
| `pm_mot_scelta` | `getOnlySitAss → motivo_op[0].eg_id` | tipicamente `"90000000025"` |

### `dett_pazientemedico`

| Campo | Origine | Note |
|-------|---------|------|
| `dm_ambito_dom` | `ambitoDomTable → sr_id` per il `pz_com_res` | string |
| `dm_situazione_ass` | `getOnlySitAss → sa_id` | string (es. `"4"`) |
| `dm_eta_scelta` | `floor((today - pz_dt_nas)/365.25)` | int |
| `dm_ambito_scelta` | scelta utente | tipicamente == `dm_ambito_dom` |
| `dm_motivo_scelta` | uguale a `pm_mot_scelta` | string |
| `dm_tipoop_scelta` | costante `"39100000036"` | string |
| `dm_dt_fine_proroga_ped` | `null` per MMG | YYYY-MM-DD per pediatra in proroga |
| `dm_motivo_pror_scad_ped` | `null` per MMG | id motivo proroga per pediatra |

### `revoca_scelta_precedente` *(omettere se nessuna scelta attiva)*

| Campo | Origine | Note |
|-------|---------|------|
| `pm_dt_disable` | data revoca, tipicamente `dataScelta - 1 day` | YYYY-MM-DD |
| `dm_dt_ins_revoca` | data corrente | YYYY-MM-DD |
| `dm_motivo_revoca` | uguale a `pm_mot_scelta` (es. A04) | string |
| `dm_tipoop_revoca` | costante `"39100000038"` | tipo operazione 3 = revoca |
| `revoca_id` | `storico_medici.find(pm_fstato='A' && !pm_dt_disable).pm_id` | int |

---

## 13. Casi particolari ed edge cases

### 13.1 Prima iscrizione (nessun medico attivo)
- `storico_medici` non contiene scelte attive → **omettere** `revoca_scelta_precedente` dal payload.
- `dm_tipoop_scelta` può diventare `"39100000037"` (Nuova iscrizione) per certe situazioni.

### 13.2 Pediatri (`tipo_medico = "P"`)
- I parametri `dm_dt_fine_proroga_ped` e `dm_motivo_pror_scad_ped` possono essere valorizzati per la proroga oltre il 14° anno.
- L'età-soglia normale è 14 anni; con proroga fino a 16.

### 13.3 Situazioni in deroga (sa_cod 31, 19, 17)
- Richiedono `motivo_op` differenti (A06, A19): leggere obbligatoriamente da `getOnlySitAss` invece di hard-codare.
- Per la deroga territoriale (sa_cod 31): `dm_motivo_scelta = "90000000140"` (A19), `dm_tipoop_scelta = "39100000037"` (Nuova iscrizione, NON Scelta).

### 13.4 Errori comuni

| Sintomo | Causa probabile | Fix |
|---------|-----------------|-----|
| `status: false` con "token is invalid" | JWT scaduto o formato Bearer sbagliato | rifare `POST /login` |
| HTTP 500 senza body | `pm_medico` non è un `pf_id` valido o non è in quell'ambito | verificare con `getMediciByAmbito` |
| `status: false` "situazione non ammessa" | `sa_id` non in `getOnlySitAss` per quel paziente | passare un `sa_cod` ammesso |
| `revoca_id` errato → submit ok ma scelta non revoca la precedente | usato `pf_id` o id sbagliato invece di `pm_id` | filtrare `storico_medici` per `pm_fstato='A'` |

### 13.5 Date e fusi
- Tutte le date nel payload sono **`YYYY-MM-DD`** (no orario) e in **fuso locale italiano**.
- `pm_dt_enable` rappresenta il giorno di **inizio validità** della nuova scelta.
- `pm_dt_disable` della revoca deve precedere `pm_dt_enable` della nuova scelta (default: `dataScelta - 1`).

### 13.6 Idempotenza e duplicati
- L'endpoint NON è idempotente: ogni POST genera un `pm_id` nuovo.
- Per evitare doppia scelta in caso di rete instabile: dopo errore, leggere `storico_medici` e verificare se la scelta è stata già persistita prima di ritentare.

---

## 14. Esempio end-to-end completo (pseudocodice)

```js
// 0. AUTENTICAZIONE
const { accessToken } = await POST("/login", { username, password });
const headers = { Authorization: `Bearer ${accessToken}` };

// 1. PAZIENTE
const [paz] = (await GET("/pazienti?codiceFiscale=" + cf, { headers })).result;
const dati = (await GET(`/pazienti/${paz.pz_id}`, { headers })).result;
const eta = Math.floor((Date.now() - new Date(dati.pz_dt_nas)) / (365.25*24*3600*1000));
const azId = dati.comune_domicilio._azienda[0].az_azie;

// 2. SCELTA ATTIVA (per la revoca)
const sceltaAttiva = (dati.storico_medici || [])
    .find(s => s.pm_fstato === "A" && !s.pm_dt_disable);

// 3. SITUAZIONI AMMESSE
const sitAmmesse = await GET(
    `/getOnlySitAss/${paz.pz_id}/${sceltaAttiva?.pm_id ?? "null"}/${azId}/M/${eta}`,
    { headers }
); // ARRAY NUDO!
const situazione = sitAmmesse.find(s => s.sa_cod === "13"); // cambio nell'ASL

// 4. AMBITI
const ambiti = (await GET(
    `/ambitoDomTable?situazione_assistenziale=4&azienda=${dati.pz_com_res}&tipo=90000000038`,
    { headers }
)).result;
const ambito = ambiti[0]; // o scelto dall'utente

// 5. MEDICI
const medici = (await GET(
    `/mediciByAmbitoTable?ambito=${ambito.sr_id}&tipo_medico=M&dataScelta=${today}&start=0&length=0&pagination=yes&sit_ass=${situazione.sa_id}&cat_citt=${dati.pz_categoria_citt}&check_first_doctor=true&not_search_after=null&idPaziente=${paz.pz_id}`,
    { headers }
)).result;
const medicoScelto = medici.find(m => !m.medico_massimalista); // primo libero

// 6. PAYLOAD
const motivo = situazione.motivo_op[0].eg_id;
const payload = {
    data: {
        pm_paz: paz.pz_id, pm_fstato: "A",
        pm_medico: medicoScelto.pf_id,
        pm_dt_scad: null,
        pm_dt_enable: today, pm_mot_scelta: motivo
    },
    dett_pazientemedico: {
        dm_ambito_dom: ambito.sr_id, dm_situazione_ass: situazione.sa_id,
        dm_eta_scelta: eta,
        dm_ambito_scelta: ambito.sr_id,
        dm_motivo_scelta: motivo, dm_tipoop_scelta: "39100000036",
        dm_dt_fine_proroga_ped: null, dm_motivo_pror_scad_ped: null
    }
};
if (sceltaAttiva) {
    payload.revoca_scelta_precedente = {
        pm_dt_disable: yesterday,
        dm_dt_ins_revoca: today,
        dm_motivo_revoca: motivo,
        dm_tipoop_revoca: "39100000038",
        revoca_id: sceltaAttiva.pm_id
    };
}

// 7. SUBMIT
const out = await POST("/pazienti/sceltaMedico", payload, { headers });
// out.result.pm_id contiene l'id della nuova scelta
```

---

## Appendice A — Riferimento implementazione di riferimento

Vedere `src/narTsServices/Nar2.js` in questo repository:
- Costanti URL, cataloghi, codici motivi/situazioni: righe 8–48
- `aggiornaCambioMedico(cf, idMedico, config)`: implementazione completa con `dryRun: true` di default
- `getSituazioniAssistenzialiAmmesse`, `getCategorieCittadinoBySituazione`, `searchAmbitiAutocomplete`, `searchMediciByAmbitoAutocomplete`
- Helper privati: `#getDataFromUrlIdOrParams` (con flag `rawResponse` per gli endpoint senza envelope), `#postDataToUrl`

Script di test interattivo: `test-cambio-medico.js` (root del progetto). Esegue tutti i passi 1–7 con dry-run di default.

## Appendice B — Stato dell'implementazione e cosa correggere/completare

> **Per istanze Claude o sviluppatori che riprenderanno questo lavoro**: leggere questo file `CAMBIO_MEDICO_NAR2.md` come **fonte unica di verità** sulle API. Il codice esistente in `Nar2.js` è già funzionante end-to-end (testato con submit reale che ha generato `pm_id: 36968473`), ma queste sono le aree su cui può essere utile lavorare:

### Coperto e funzionante

- ✅ Login legacy con username/password + retry e cache token in-process
- ✅ Recupero assistito (CF, pz_id, anagrafica, storico_medici)
- ✅ Lettura situazioni assistenziali ammesse (`getOnlySitAss`) con array nudo
- ✅ Lettura ambiti di domicilio (`ambitoDomTable`) e medici (`mediciByAmbitoTable`)
- ✅ Costruzione e POST del payload `/pazienti/sceltaMedico` con auto-detect ambito/scelta corrente/motivo
- ✅ Gestione del `revoca_scelta_precedente` con lookup del `pm_id` corrente da `storico_medici[*].pm_fstato='A' && pm_dt_disable=null`
- ✅ Override completo di tutti i parametri (situazione, motivo, tipo op, date, ambiti)
- ✅ Modalità `dryRun: true` per test sicuri

### Possibili miglioramenti

1. **Validazione preventiva**: prima della POST, validare che il medico scelto sia effettivamente nell'ambito di scelta (`getMediciByAmbito` con `pf_id` matching) per evitare HTTP 500 su `pf_id` invalido.
2. **Caso "nuova iscrizione"** (no medico precedente): testare empiricamente con un caso reale; il payload omette `revoca_scelta_precedente` ma `dm_tipoop_scelta` potrebbe dover diventare `"39100000037"` (Nuova iscrizione) invece di `"39100000036"` (Scelta).
3. **Pediatri con proroga**: i campi `dm_dt_fine_proroga_ped` / `dm_motivo_pror_scad_ped` sono cablati a `null` per MMG e accettano valori arbitrari per Pediatra; non ho verificato i motivi proroga ammessi (probabilmente da `getOnlySitAss` quando `tipo_med="P"`).
4. **Situazioni in deroga** (sa_cod 31, 19, 17): la logica corrente prende `motivo_op[0].eg_id` come motivo. Per le deroghe esiste solo un motivo per situazione, ma è bene confermarlo con casi reali.
5. **Refresh proattivo del token**: aggiungere check su `exp` del JWT decodificato per rinnovare a T-10min (evita 401 in mezzo a job lunghi).
6. **Rinnovo token via SPID**: vedi § 3.2-3.3 — non c'è refresh, serve riautenticazione. Per uso automatizzato si potrebbe implementare un "token broker" (userscript Tampermonkey o estensione che intercetta il JWT dal callback `?token=`).
7. **Single-flight lock distribuito**: il `getToken` ha `#tokenPromise` in-process; se si esegue il client da più worker, serve lock su Redis/file.
8. **Helper di alto livello**: `cambiaMedicoPerCF(cf, codRegMedico)` che fa lookup `pf_id` da `codice_reg` automaticamente, così il chiamante non deve preoccuparsi degli id interni NAR2.

### Endpoint NON ancora wrappati (per riferimento)

- `GET /motiviOperazioneFromMotivoRevoca/{tipo_op_id}` — motivi compatibili con un dato tipo operazione (utile per dropdown revoca)
- `POST /api/auth/changeRoleTemp {azienda, ufficio}` — cambia ruolo/ufficio attivo dell'operatore (utile se ha più uffici)
- `GET /api/auth/getPermissionToken` — permessi dell'utente corrente (utile come health-check del token)

## Appendice C — Per l'altra istanza Claude / nuovo sviluppatore

Per riprendere/correggere l'implementazione del cambio medico, **questo singolo file `docs/CAMBIO_MEDICO_NAR2.md`** è autosufficiente: contiene endpoint, payload, cataloghi, edge case, esempio pseudocodice. In aggiunta:

- Il codice da modificare/correggere è interamente in `src/narTsServices/Nar2.js`
- Lo script di test manuale è `test-cambio-medico.js` — esegue tutti gli step con dry-run e (su conferma esplicita `INVIA`) submit reale
- Le credenziali NAR2 sono in `config/config.json` (NON in git, vedi `.gitignore`); chiedere all'utente proprietario del repo se serve replicarle
- Per intercettare il traffico reale del portale durante eventuali debug: usare Chrome DevTools MCP con `list_network_requests` e `get_network_request` come fatto in questa sessione
