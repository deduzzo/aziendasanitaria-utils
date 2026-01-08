# Zimbra Email Processor - MCP Server

Server MCP per elaborare email da Zimbra con Claude tramite Tampermonkey.

## Funzionamento

Il sistema è composto da due parti:

1. **Script Tampermonkey** (`../tampermonkey/zimbra-elabora.js`): Aggiunge un pulsante "Elabora" su Zimbra che estrae il contenuto dell'email e lo invia al server MCP
2. **MCP Server** (questo server): Riceve le email e le rende disponibili a Claude tramite tool MCP

## Installazione

1. Installa le dipendenze:
```bash
cd mcp
npm install
```

2. Configura Claude Desktop per usare questo server MCP. Aggiungi al file di configurazione di Claude (`claude_desktop_config.json`):

**Su macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Su Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "zimbra-email-processor": {
      "command": "node",
      "args": ["/percorso/completo/a/aziendasanitaria-utils/mcp/zimbra-email-processor.js"]
    }
  }
}
```

3. Riavvia Claude Desktop

4. Installa lo script Tampermonkey:
   - Apri Tampermonkey nel tuo browser
   - Crea un nuovo script
   - Copia il contenuto di `../tampermonkey/zimbra-elabora.js`
   - Salva

## Utilizzo

1. Apri Zimbra e visualizza un'email
2. Clicca sul pulsante "Elabora" nella toolbar (accanto a "Rispondi")
3. L'email verrà inviata al server MCP
4. Apri Claude Desktop e chiedi di elaborare l'email:
   - "Mostrami l'ultima email ricevuta"
   - "Riassumi l'ultima email"
   - "Estrai i dati importanti dall'email"
   - "Scarica il primo allegato"

## Tool MCP disponibili

### `get_latest_email`
Recupera l'ultima email ricevuta da Zimbra con tutte le informazioni.

### `get_email_by_id`
Recupera una email specifica tramite il suo ID.

**Parametri:**
- `emailId` (string): ID dell'email

### `list_available_emails`
Elenca tutte le email disponibili nello storage.

### `download_attachment` ⚠️ DEPRECATO
Scarica un allegato specifico da Zimbra e restituisce il contenuto in Base64.

**Nota**: Questo tool è deprecato. Usa `read_attachment_by_id` invece.

**Parametri:**
- `emailId` (string): ID dell'email
- `attachmentIndex` (number): Indice dell'allegato (0-based)

### `read_attachment_by_id` ✨ RACCOMANDATO
Legge un allegato dal disco usando il suo ID univoco e restituisce il contenuto in Base64.

Gli allegati vengono salvati automaticamente su disco quando l'email viene inviata al server, quindi questo è il modo più efficiente per accedere agli allegati.

**Parametri:**
- `attachmentId` (string): ID dell'allegato (formato: `emailId_index`, es. `1736331234567_0`)

**Esempio di utilizzo:**
```javascript
// Ottieni l'email
const email = await get_latest_email();

// Ogni allegato ha un attachmentId
console.log(email.attachments[0].attachmentId); // "1736331234567_0"

// Leggi l'allegato usando l'ID
const attachment = await read_attachment_by_id({
  attachmentId: "1736331234567_0"
});
```

### `extract_email_data`
Estrae campi specifici dall'email.

**Parametri:**
- `emailId` (string): ID dell'email
- `fields` (array): Campi da estrarre (`from`, `to`, `subject`, `body`, `date`, `attachments`)

## Struttura dati email

```json
{
  "id": "1736331234567",
  "from": "mittente@example.com",
  "to": "destinatario@example.com",
  "subject": "Oggetto dell'email",
  "body": "Corpo del messaggio...",
  "date": "8 gennaio 2026 12:08",
  "attachments": [
    {
      "attachmentId": "1736331234567_0",
      "fileName": "documento.pdf",
      "savedPath": "/path/to/attachments/1736331234567_0_documento.pdf",
      "size": 153600,
      "mimeType": "application/pdf"
    },
    {
      "attachmentId": "1736331234567_1",
      "fileName": "report.xlsx",
      "savedPath": "/path/to/attachments/1736331234567_1_report.xlsx",
      "size": 45120,
      "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
  ],
  "receivedAt": "2026-01-08T11:08:23.456Z"
}
```

### 💾 Sistema di Storage Allegati

- **Formato ID**: `{emailId}_{index}` (es. `1736331234567_0`)
- **Nome file su disco**: `{attachmentId}_{nomeFileSanitizzato}` (es. `1736331234567_0_documento.pdf`)
- **Cartella**: `mcp/zimbra-grabber/attachments/`
- **Pulizia automatica**: Tutti gli allegati vengono cancellati all'avvio del server MCP
- **Vantaggio**: Evita di tenere dati Base64 pesanti in memoria, rendendo le conversazioni con Claude più leggere

**Nota**: Gli allegati inline (immagini nel corpo dell'email) non vengono salvati su disco perché sono già inclusi nell'HTML del corpo del messaggio.

## Porte utilizzate

- **3456**: Server HTTP per ricevere email dallo script Tampermonkey
- **stdio**: Server MCP per comunicazione con Claude

## Debug

Per vedere i log del server:
```bash
cd mcp
npm start
```

I log vengono scritti su stderr per non interferire con la comunicazione MCP su stdio.

## Note di sicurezza

- Il server HTTP accetta richieste solo da localhost (porta 3456)
- Le email sono salvate in memoria e vengono perse al riavvio del server
- Gli allegati vengono salvati su disco nella cartella `attachments/` e cancellati automaticamente all'avvio del server
- Gli allegati vengono scaricati nel browser (che ha l'autenticazione Zimbra) e inviati al server come Base64
- Non vengono salvate credenziali o cookie di Zimbra sul server MCP
- Il server MCP comunica con Claude Desktop tramite stdio (non espone API pubbliche)
