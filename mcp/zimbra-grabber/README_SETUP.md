# MCP Zimbra - Sistema Cifratura End-to-End

Sistema completo di cifratura end-to-end e gestione utenti per l'elaborazione email di Zimbra tramite MCP.

## 🚀 Quick Start

### 1. Setup Server MCP

```bash
cd /Users/deduzzo/dev/aziendasanitaria-utils/mcp/zimbra-grabber

# Verifica che .env esista con MASTER_ENCRYPTION_KEY
cat .env

# Avvia il server MCP (porta 3456)
node zimbra-email-processor.js
```

### 2. Setup Admin UI

In un nuovo terminale:

```bash
cd /Users/deduzzo/dev/aziendasanitaria-utils/mcp/zimbra-grabber/admin-ui

# Avvia l'Admin UI (porta 3457)
node server.js
```

Accedi a: http://localhost:3457

**Credenziali Admin:**
- Username: `admin`
- Password: `changeme123` (o quello impostato in `.env`)

### 3. Crea Primo Utente

1. Apri Admin UI: http://localhost:3457
2. Clicca **"➕ Aggiungi Utente"**
3. Inserisci email: `test@asp.messina.it`
4. Il sistema genererà una password temporanea (esempio: `Abc123Xyz789!@#$`)
5. **COPIA LA PASSWORD** - sarà necessaria per configurare Tampermonkey

### 4. Configura Tampermonkey

1. Apri Zimbra nel browser
2. Assicurati che lo script Tampermonkey sia attivo
3. Apri un'email qualsiasi
4. Vedrai due nuovi pulsanti nella toolbar:
   - **✦ Elabora** (arancione) - Invia email cifrata
   - **⚙️** (grigio) - Impostazioni

5. Clicca sul pulsante **⚙️ Impostazioni**
6. Nel modal inserisci:
   - **Email**: `test@asp.messina.it`
   - **Password**: `Abc123Xyz789!@#$` (quella generata dall'Admin UI)
7. Clicca **"💾 Salva Credenziali"**

### 5. Test Invio Email Cifrata

1. Seleziona un'email in Zimbra
2. Clicca **✦ Elabora**
3. Verifica nella console del browser:
   - Derivazione chiave PBKDF2
   - Cifratura payload AES-256-CBC
   - Calcolo HMAC
   - Invio envelope cifrato
4. Verifica toast verde: **"✅ Email inviata a Claude!"**
5. Verifica console server MCP:
   ```
   [Zimbra MCP] 🔐 Autenticazione riuscita: test@asp.messina.it
   [Zimbra MCP] 📧 Email processata: msg_1736437200000
   [Zimbra MCP] 💾 Allegato cifrato: documento.pdf
   ```

### 6. Test Lettura Email con Claude

Apri Claude Desktop e prova:

```
Recupera l'ultima email da Zimbra
```

Claude userà i tool MCP per leggere l'email decifrata.

### 7. Test Gestione Utenti con Claude

Prova questi prompt:

```
L'utente test@asp.messina.it è abilitato?
```

```
Mostrami tutti gli utenti registrati nel sistema MCP Zimbra
```

```
Crea un nuovo utente con email mario.rossi@asp.messina.it
```

```
Genera una nuova password per l'utente test@asp.messina.it
```

```
Mostrami le statistiche del sistema
```

---

## 📊 Architettura

### Flusso Dati

```
[Utente] → [Tampermonkey Script]
              ↓ (Password personale)
         [Deriva chiave AES con PBKDF2]
              ↓
         [Cifra email con AES-256-CBC]
              ↓
         [Calcola HMAC-SHA256]
              ↓
         [Invia envelope cifrato via HTTPS]
              ↓
    [MCP Server :3456]
              ↓ (Verifica HMAC + Challenge)
         [Decifra con chiave utente]
              ↓
    [Storage cifrato su disco]
              ↓
    [Claude Desktop via MCP tools]
```

### Componenti

**1. Server MCP (`zimbra-email-processor.js`)**
- Porta: 3456
- Endpoint: `/process-email`, `/auth/salt`
- 13 MCP Tools:
  - 6 tools email (get_latest_email, read_attachment_by_id, etc.)
  - 7 tools gestione utenti (user_add, user_check_status, etc.)

**2. Admin UI (`admin-ui/server.js`)**
- Porta: 3457
- API REST con Basic Auth
- Frontend vanilla HTML/CSS/JS

**3. Tampermonkey Script (`zimbra-elabora.js`)**
- Buttons: ✦ Elabora + ⚙️ Impostazioni
- Crypto: Web Crypto API (PBKDF2, AES-CBC, HMAC)
- Storage: GM_setValue/GM_getValue

**4. Database (`config/users.json`)**
```json
{
  "users": [
    {
      "email": "test@asp.it",
      "passwordHash": "$argon2id$v=19$...",
      "encryptedDerivedKey": "base64...",
      "kdfSalt": "base64...",
      "enabled": true,
      "emailsSent": 5
    }
  ]
}
```

---

## 🔐 Sicurezza

### Protezioni Implementate

✅ **Cifratura End-to-End**: Payload cifrato AES-256-CBC
✅ **HMAC Integrity**: Anti-tampering
✅ **Challenge-Response**: Autenticazione senza password in chiaro
✅ **Rate Limiting**: Max 10 tentativi/15min per utente
✅ **Replay Protection**: Timestamp + challenge cache (TTL 5min)
✅ **Timing-Safe Comparison**: Anti timing-attack
✅ **Master Key Encryption**: Chiavi derivate cifrate con master key
✅ **Allegati Cifrati**: Protezione dati sensibili su disco
✅ **Audit Logging**: Tracciamento eventi sicurezza

### Formato Envelope Cifrato

```javascript
{
  "userEmail": "test@asp.it",
  "encryptedPayload": "base64_aes_encrypted_email_data",
  "encryptedChallenge": "base64_aes_encrypted_challenge",
  "iv": "base64_random_16bytes",
  "hmac": "hex_sha256_hmac",
  "timestamp": 1736437200000,
  "version": "v1"
}
```

---

## 🛠️ Tools MCP Disponibili

### Tools Email (6)

1. **get_latest_email** - Recupera ultima email
2. **get_email_by_id** - Recupera email specifica
3. **list_available_emails** - Elenca tutte le email
4. **download_attachment** - Scarica allegato
5. **extract_email_data** - Estrae campi specifici
6. **read_attachment_by_id** - Legge allegato cifrato

### Tools Gestione Utenti (7)

1. **user_check_status** - Verifica stato utente
   ```
   Esempio: L'utente test@asp.it è abilitato?
   ```

2. **user_list_all** - Elenca tutti gli utenti
   ```
   Esempio: Mostrami tutti gli utenti
   ```

3. **user_add** - Crea nuovo utente
   ```
   Esempio: Crea utente mario.rossi@asp.it
   ```

4. **user_regenerate_password** - Genera nuova password
   ```
   Esempio: Rigenera password per test@asp.it
   ```

5. **user_toggle_status** - Abilita/disabilita utente
   ```
   Esempio: Disabilita l'utente test@asp.it
   ```

6. **user_delete** - Elimina utente
   ```
   Esempio: Elimina l'utente test@asp.it
   ```

7. **system_get_stats** - Statistiche sistema
   ```
   Esempio: Mostrami le statistiche del sistema
   ```

---

## 🧪 Test Completi

### Test 1: Setup Utente
```bash
# Admin UI
1. Crea utente: test@asp.it
2. Copia password temporanea: Abc123XyzDEF!@#

# Tampermonkey
3. Clicca ⚙️ Impostazioni
4. Inserisci email + password
5. Salva

✅ Verifica: Toast verde "Credenziali salvate"
```

### Test 2: Invio Email Cifrata
```bash
1. Seleziona email in Zimbra
2. Clicca ✦ Elabora
3. Verifica console browser (cifratura)
4. Verifica console server (decifratura)

✅ Verifica: Email in emailStorage + allegati cifrati in attachments/
```

### Test 3: Lettura Email con Claude
```
Prompt: Recupera l'ultima email da Zimbra
```

✅ Verifica: Claude mostra email decifrata con allegati

### Test 4: Toast Stacking
```bash
1. Invia 5 email rapidamente (clicca ✦ Elabora 5 volte)
2. Verifica toast si impilano verticalmente
3. Verifica non si sovrappongono
4. Verifica spariscono dopo 4 secondi
```

✅ Verifica: Stack ordinato senza sovrapposizioni

### Test 5: Disabilita Utente
```bash
# Admin UI
1. Clicca "🚫 Disabilita" su test@asp.it

# Tampermonkey
2. Prova inviare altra email

✅ Verifica: Errore 403 + Toast rosso "Utente disabilitato"
```

### Test 6: Gestione Utenti con Claude
```
Prompt: Crea utente nuovo@asp.it
```

✅ Verifica: Claude crea utente e mostra password

```
Prompt: L'utente nuovo@asp.it è abilitato?
```

✅ Verifica: Claude mostra stato utente

---

## 🐛 Troubleshooting

### Server MCP non parte

**Errore:** `MASTER_ENCRYPTION_KEY not set`

**Soluzione:**
```bash
# Verifica .env
cat .env

# Se manca, genera nuova chiave
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Aggiungi a .env
echo "MASTER_ENCRYPTION_KEY=tua_chiave_base64_qui" >> .env
```

### Admin UI - Errore 401

**Problema:** Credenziali non valide

**Soluzione:**
```bash
# Verifica .env
grep ADMIN .env

# Se mancano, aggiungi:
echo "ADMIN_USER=admin" >> .env
echo "ADMIN_PASSWORD=changeme123" >> .env
```

### Tampermonkey - Errore "Password non configurata"

**Soluzione:**
1. Clicca ⚙️ Impostazioni
2. Inserisci email e password (quella dall'Admin UI)
3. Salva

### Email non decifrata - "Invalid HMAC"

**Cause possibili:**
- Password errata nel Tampermonkey
- Utente disabilitato
- Chiave master cambiata

**Soluzione:**
1. Verifica password in Tampermonkey (⚙️)
2. Verifica utente abilitato (Admin UI)
3. Rigenera password (Admin UI o Claude)

---

## 📝 Configurazione `.env`

```bash
# Master Key per cifrare chiavi derivate utenti
# GENERA CON: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
MASTER_ENCRYPTION_KEY=tFEg0mFuWH9vn9BeibsRIr62F2/UKElmlnu9veQYqRo=

# Credenziali Admin UI
ADMIN_USER=admin
ADMIN_PASSWORD=changeme123

# Porte
HTTP_PORT=3456
ADMIN_PORT=3457
```

---

## 🔄 Workflow Completo

### Onboarding Nuovo Utente

1. **Admin crea utente** (Admin UI o Claude)
   ```
   Claude: Crea utente mario.rossi@asp.it
   ```

2. **Admin comunica password** (email, chat sicura)
   ```
   Password temporanea: Abc123XyzDEF!@#
   ```

3. **Utente configura Tampermonkey**
   - Clicca ⚙️
   - Inserisce email + password
   - Salva

4. **Utente testa invio**
   - Seleziona email
   - Clicca ✦ Elabora
   - Verifica toast verde

5. **Claude processa email**
   - Legge email cifrata
   - Decifra con chiave utente
   - Mostra contenuto

### Disabilita Utente Compromesso

1. **Admin disabilita** (Admin UI o Claude)
   ```
   Claude: Disabilita utente test@asp.it
   ```

2. **Verifica blocco**
   - Utente prova inviare email
   - Riceve errore 403
   - Toast rosso: "Utente disabilitato"

3. **Riabilita dopo verifica**
   ```
   Claude: Abilita utente test@asp.it
   ```

---

## 🎯 Prossimi Passi

### Funzionalità Future

- [ ] **Reset password utente** - Flow cambio password
- [ ] **Rotazione master key** - Re-encryption automatica
- [ ] **2FA per Admin UI** - Google Authenticator
- [ ] **Backup automatico** - users.json su S3/GCS
- [ ] **Metrics dashboard** - Email/ora, errori rate
- [ ] **Email notifications** - Alert su eventi critici
- [ ] **Multi-tenant** - Separazione dati per organizzazione

### Miglioramenti Sicurezza

- [ ] **HTTPS obbligatorio** - Certificato Let's Encrypt
- [ ] **HSM per master key** - Hardware Security Module
- [ ] **Key rotation schedule** - Rotazione automatica ogni 90gg
- [ ] **Audit log export** - SIEM integration
- [ ] **Intrusion detection** - Rate limit avanzato

---

## 📞 Supporto

Per problemi o domande:
1. Controlla questa guida
2. Verifica console browser (F12)
3. Verifica console server MCP
4. Controlla logs Admin UI

---

**Versione:** 2.0
**Data:** 2026-01-09
**Autore:** Claude Sonnet 4.5 + Roberto De Domenico
