# MCP Servers

Questa cartella contiene i server MCP (Model Context Protocol) personalizzati per estendere le capacità di Claude.

## 📁 Struttura

Ogni server MCP è organizzato in una sottocartella dedicata con le proprie dipendenze e configurazione.

```
mcp/
├── README.md                    # Questo file
└── zimbra-grabber/              # Server per elaborazione email Zimbra
    ├── zimbra-email-processor.js
    ├── package.json
    ├── README.md
    └── claude_desktop_config.example.json
```

## 🚀 Server Disponibili

### zimbra-grabber

Server MCP per elaborare email e allegati da Zimbra con Claude.

**Funzionalità:**
- Estrae contenuto email (mittente, destinatario, oggetto, corpo)
- Gestisce allegati con download on-demand
- Integrazione tramite script Tampermonkey

**Documentazione:**
- Setup completo: [../ZIMBRA_INTEGRATION.md](../ZIMBRA_INTEGRATION.md)
- Dettagli tecnici: [zimbra-grabber/README.md](zimbra-grabber/README.md)

**Installazione rapida:**
```bash
cd zimbra-grabber
npm install
```

## 🔧 Aggiungere un Nuovo Server MCP

Per aggiungere un nuovo server MCP:

1. Crea una nuova cartella in `mcp/`:
```bash
mkdir mcp/nome-server
cd mcp/nome-server
```

2. Inizializza il progetto:
```bash
npm init -y
```

3. Installa l'SDK MCP:
```bash
npm install @modelcontextprotocol/sdk
```

4. Crea il file principale del server (es. `server.js`) usando l'SDK MCP

5. Aggiungi la configurazione a Claude Desktop in `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "nome-server": {
      "command": "node",
      "args": ["/percorso/completo/a/mcp/nome-server/server.js"]
    }
  }
}
```

6. Aggiorna questo README con la documentazione del nuovo server

## 📚 Risorse

- [MCP SDK Documentation](https://modelcontextprotocol.io/)
- [Claude Desktop Configuration](https://docs.anthropic.com/claude/docs/desktop-integration)
- Esempi di server MCP: [GitHub - modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)

## 🔒 Best Practices

- **Isolamento**: Ogni server ha le proprie dipendenze (cartella `node_modules` dedicata)
- **Documentazione**: Ogni server deve avere un README.md con:
  - Descrizione delle funzionalità
  - Istruzioni di installazione
  - Esempi di utilizzo
  - Tool disponibili
- **Configurazione**: Fornire sempre un file `claude_desktop_config.example.json`
- **Logging**: Usare `console.error()` per i log (stdout è riservato alla comunicazione MCP)
- **Errori**: Gestire sempre gli errori e restituire messaggi chiari

## 🧪 Testing

Per testare un server MCP:

1. Configura il server in `claude_desktop_config.json`
2. Riavvia Claude Desktop completamente
3. Verifica che il server sia caricato nel menu "Developer" > "MCP Servers"
4. Prova a usare i tool del server con un prompt

## 🐛 Debug

Per vedere i log di un server MCP:

1. **Durante sviluppo**: Esegui il server manualmente
```bash
cd mcp/nome-server
npm start
```

2. **In Claude Desktop**: Apri "Developer" > "MCP Logs" per vedere errori di comunicazione

3. **Test standalone**: Usa l'MCP Inspector
```bash
npx @modelcontextprotocol/inspector node mcp/nome-server/server.js
```

## 📝 Note

- I server MCP comunicano con Claude tramite stdio (stdin/stdout)
- Ogni server gira in un processo separato
- I server vengono avviati automaticamente da Claude Desktop
- Le modifiche ai server richiedono il riavvio di Claude Desktop
