# Integrazione Zimbra con Claude

Questa integrazione permette di elaborare email e allegati da Zimbra direttamente con Claude.

## 📋 Panoramica

Il sistema è composto da tre componenti:

1. **Script Tampermonkey** - Aggiunge un pulsante "Elabora" nella toolbar di Zimbra
2. **MCP Server** - Server che riceve le email e le rende disponibili a Claude
3. **Claude Desktop** - Interfaccia per interagire con Claude ed elaborare le email

## 🚀 Setup Rapido

### 1. Installa lo Script Tampermonkey

1. Assicurati di avere [Tampermonkey](https://www.tampermonkey.net/) installato nel browser
2. Apri Tampermonkey Dashboard
3. Clicca su "+" per creare un nuovo script
4. Copia il contenuto di `tampermonkey/zimbra-elabora.js`
5. Salva (Cmd+S o Ctrl+S)

### 2. Configura l'MCP Server

Le dipendenze sono già installate. Ora configura Claude Desktop:

**macOS:**
```bash
# Apri il file di configurazione
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
# Apri il file di configurazione
notepad %APPDATA%\Claude\claude_desktop_config.json
```

Aggiungi questa configurazione (sostituisci il percorso con quello corretto):

```json
{
  "mcpServers": {
    "zimbra-email-processor": {
      "command": "node",
      "args": ["/Users/deduzzo/dev/aziendasanitaria-utils/mcp/zimbra-grabber/zimbra-email-processor.js"]
    }
  }
}
```

### 3. Riavvia Claude Desktop

Chiudi completamente Claude Desktop e riaprilo per caricare la configurazione.

## 📝 Come Usare

### Inviare un'email a Claude

1. Apri Zimbra (https://posta.asp.messina.it/)
2. Clicca su un'email per aprirla
3. Vedrai un nuovo pulsante **"Elabora"** nella toolbar, accanto a "Rispondi"
4. Clicca su "Elabora"
5. Vedrai una notifica di conferma

### Elaborare l'email con Claude

Apri Claude Desktop e chiedi:

**Esempi di prompt:**

- 📧 **Visualizza email**:
  ```
  Mostrami l'ultima email ricevuta da Zimbra
  ```

- 📝 **Riassumi**:
  ```
  Riassumi l'ultima email in 3 punti chiave
  ```

- 📎 **Lista allegati**:
  ```
  Quanti allegati ha l'ultima email e quali sono?
  ```

- 💾 **Scarica allegato**:
  ```
  Scarica il primo allegato dell'ultima email
  ```

- 📊 **Estrai dati**:
  ```
  Estrai mittente, oggetto e data dall'ultima email
  ```

- 🔍 **Analisi avanzata**:
  ```
  Analizza l'ultima email e dimmi se ci sono richieste urgenti
  ```

## 🛠️ Tool MCP Disponibili

Claude può usare questi tool automaticamente:

| Tool | Descrizione |
|------|-------------|
| `get_latest_email` | Recupera l'ultima email ricevuta |
| `get_email_by_id` | Recupera una email specifica tramite ID |
| `list_available_emails` | Elenca tutte le email nello storage |
| `download_attachment` | Scarica un allegato in Base64 (deprecato, usa `read_attachment_by_id`) |
| `extract_email_data` | Estrae campi specifici (from, to, subject, body, etc.) |
| `read_attachment_by_id` | Legge un allegato dal disco usando il suo ID univoco |

### 💾 Sistema di Storage Allegati

Gli allegati vengono salvati automaticamente su disco quando invii un'email a Claude:

- **Posizione**: `mcp/zimbra-grabber/attachments/`
- **Formato ID**: `{emailId}_{index}_{nomeFile}`
- **Pulizia**: Tutti gli allegati vengono cancellati automaticamente al riavvio del server MCP
- **Vantaggio**: Le conversazioni con Claude rimangono leggere senza dati Base64 pesanti

Gli allegati inline (immagini nel corpo dell'email) vengono saltati perché già inclusi nell'HTML.

## 🔍 Debug e Troubleshooting

### Verificare che l'MCP Server sia attivo

Apri un terminale e verifica:

```bash
curl http://localhost:3456/health
```

Dovresti vedere:
```json
{
  "status": "ok",
  "emailsInStorage": 0,
  "latestEmailId": null
}
```

### Vedere i log del server

```bash
cd /Users/deduzzo/dev/aziendasanitaria-utils/mcp/zimbra-grabber
npm start
```

### Lo script Tampermonkey non funziona

1. Apri la Console del browser (F12)
2. Cerca messaggi che iniziano con `[Zimbra-Elabora]`
3. Verifica che lo script sia attivo in Tampermonkey

### Il pulsante "Elabora" non appare

1. Assicurati di aver aperto un'email (non solo selezionata nella lista)
2. Ricarica la pagina (F5)
3. Verifica nella console che lo script sia caricato

### Claude non vede le email

1. Verifica che Claude Desktop sia stato riavviato dopo la configurazione
2. Controlla che il percorso nel `claude_desktop_config.json` sia corretto
3. Apri il menu "Developer" in Claude Desktop e verifica i log MCP

## 📂 Struttura File

```
aziendasanitaria-utils/
├── tampermonkey/
│   └── zimbra-elabora.js          # Script da installare in Tampermonkey
├── mcp/
│   └── zimbra-grabber/            # MCP Server per Zimbra
│       ├── zimbra-email-processor.js
│       ├── package.json
│       ├── README.md
│       └── claude_desktop_config.example.json
└── ZIMBRA_INTEGRATION.md          # Questa guida
```

## 🔒 Note di Sicurezza

- Il server MCP gira solo su localhost (non esposto su rete)
- Le email sono salvate temporaneamente in memoria
- Gli allegati vengono salvati su disco in `attachments/` e cancellati all'avvio del server
- Gli allegati vengono scaricati nel browser (con autenticazione Zimbra) prima di essere inviati al server MCP
- Nessuna credenziale o cookie viene salvato dal server MCP
- I dati email in memoria vengono persi al riavvio del server
- Gli allegati su disco vengono automaticamente ripuliti ad ogni avvio del server

## 🎯 Casi d'Uso

### 1. Analisi veloce di email
Ricevi un'email importante e vuoi che Claude la riassuma e identifichi le azioni richieste.

### 2. Estrazione dati strutturati
Email con informazioni (CF, nomi, indirizzi) che vuoi estrarre ed elaborare.

### 3. Elaborazione allegati
Email con documenti PDF o Excel che Claude può leggere ed analizzare.

### 4. Bozze di risposta
Chiedi a Claude di generare una bozza di risposta all'email ricevuta.

## 📞 Supporto

Per problemi o domande, consulta:
- README tecnico: `mcp/zimbra-grabber/README.md`
- Log del server: `npm start` nella cartella `mcp/zimbra-grabber/`
- Console browser per debug Tampermonkey

## 🔄 Aggiornamenti

Per aggiornare il sistema:

1. **Script Tampermonkey**: Modifica `tampermonkey/zimbra-elabora.js` e aggiorna lo script in Tampermonkey
2. **MCP Server**: Modifica `mcp/zimbra-grabber/zimbra-email-processor.js` e riavvia Claude Desktop
