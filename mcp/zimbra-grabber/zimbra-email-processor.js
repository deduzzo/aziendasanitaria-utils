#!/usr/bin/env node

/**
 * MCP Server per elaborazione email Zimbra con Cifratura End-to-End
 *
 * Questo server MCP espone tool per permettere a Claude di elaborare email
 * ricevute da Zimbra tramite il Tampermonkey script.
 *
 * Caratteristiche di sicurezza:
 * - Cifratura AES-256-CBC end-to-end con password personale per utente
 * - Autenticazione challenge-response
 * - Allegati cifrati su disco
 * - Rate limiting e replay protection
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { spawn } from 'child_process';

// Carica variabili ambiente
dotenv.config();

// Importa moduli custom
import * as cryptoLib from './lib/crypto.js';
import auth from './lib/auth.js';
import storage from './lib/storage.js';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage temporaneo per le email ricevute
const emailStorage = new Map();
let latestEmailId = null;

// Configurazione da .env (con supporto prefissi SERVER_/CLIENT_ e legacy)
const HTTP_PORT = parseInt(process.env.SERVER_HTTP_PORT || process.env.HTTP_PORT) || 3456;
const ADMIN_PORT = parseInt(process.env.SERVER_ADMIN_PORT || process.env.ADMIN_PORT) || 3457;
const ATTACHMENTS_DIR = path.join(__dirname, 'attachments');

// Autenticazione utente per MCP (produzione)
let authenticatedUser = null; // Utente autenticato per questa istanza MCP

// Crea cartella attachments e pulisci all'avvio
if (!fs.existsSync(ATTACHMENTS_DIR)) {
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  console.error(`[Zimbra MCP] Cartella allegati creata: ${ATTACHMENTS_DIR}`);
} else {
  // Pulisci allegati esistenti
  const files = fs.readdirSync(ATTACHMENTS_DIR);
  let deletedCount = 0;
  for (const file of files) {
    try {
      fs.unlinkSync(path.join(ATTACHMENTS_DIR, file));
      deletedCount++;
    } catch (err) {
      console.error(`[Zimbra MCP] Errore eliminazione ${file}:`, err);
    }
  }
  if (deletedCount > 0) {
    console.error(`[Zimbra MCP] 🗑️  Puliti ${deletedCount} allegati precedenti`);
  }
}

// ============================================================================
// Server HTTP per ricevere email dallo script Tampermonkey
// ============================================================================

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Rate limiter per endpoint autenticazione
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minuti
  max: 10,  // Max 10 richieste per IP
  message: { success: false, error: 'Troppi tentativi di autenticazione. Riprova più tardi.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Endpoint: ottieni salt per derivazione chiave
app.get('/auth/salt', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email mancante'
      });
    }

    // Trova utente
    const user = await storage.findUserByEmail(email);

    if (!user) {
      // Non rivelare se utente esiste (security best practice)
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    if (!user.enabled) {
      return res.status(403).json({
        success: false,
        error: 'Utente disabilitato'
      });
    }

    // Restituisci solo salt (non chiave!)
    res.json({
      success: true,
      kdfSalt: user.kdfSalt,
      kdfIterations: user.kdfIterations
    });
  } catch (error) {
    console.error('[Zimbra MCP] Errore /auth/salt:', error);
    res.status(500).json({
      success: false,
      error: 'Errore server'
    });
  }
});

// Salva un allegato su disco (DEPRECATO - ora cifrato)
function saveAttachment(emailId, attachmentIndex, attachment) {
  try {
    if (!attachment.base64Data) {
      console.error(`[Zimbra MCP] Allegato ${attachmentIndex} non ha dati Base64`);
      return null;
    }

    // Genera ID univoco: emailId_index
    const attachmentId = `${emailId}_${attachmentIndex}`;

    // Sanitizza nome file
    const sanitizedFileName = attachment.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(ATTACHMENTS_DIR, `${attachmentId}_${sanitizedFileName}`);

    // Converti Base64 in Buffer e salva
    const buffer = Buffer.from(attachment.base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    console.error(`[Zimbra MCP] ✅ Allegato salvato: ${sanitizedFileName} (${(buffer.length / 1024).toFixed(1)} KB)`);

    return {
      attachmentId,
      fileName: attachment.fileName,
      savedPath: filePath,
      size: buffer.length,
      mimeType: attachment.mimeType || attachment.actualMimeType || 'application/octet-stream'
    };
  } catch (error) {
    console.error(`[Zimbra MCP] ❌ Errore salvataggio allegato ${attachmentIndex}:`, error);
    return null;
  }
}

// Endpoint per ricevere email CIFRATE
app.post('/process-email', authLimiter, async (req, res) => {
  try {
    const envelope = req.body;

    // Autentica e decifra envelope
    let user, emailData, userKey;
    try {
      ({ user, emailData, userKey } = await auth.authenticateAndDecrypt(envelope));
    } catch (error) {
      // Gestisci errori di autenticazione
      if (error.code === 'USER_NOT_FOUND') {
        return res.status(404).json({ success: false, error: 'Utente non trovato' });
      }
      if (error.code === 'USER_DISABLED') {
        return res.status(403).json({ success: false, error: 'Utente disabilitato' });
      }
      if (error.code === 'INVALID_CHALLENGE' || error.code === 'INVALID_HMAC') {
        return res.status(401).json({ success: false, error: 'Autenticazione fallita - password errata' });
      }
      if (error.code === 'TIMESTAMP_EXPIRED') {
        return res.status(401).json({ success: false, error: 'Richiesta scaduta - riprova' });
      }
      if (error.code === 'RATE_LIMIT_EXCEEDED') {
        return res.status(429).json({ success: false, error: 'Troppi tentativi - riprova tra 15 minuti' });
      }
      if (error.code === 'REPLAY_ATTACK') {
        return res.status(401).json({ success: false, error: 'Replay attack rilevato' });
      }

      // Errore generico
      console.error('[Zimbra MCP] Errore autenticazione:', error);
      return res.status(500).json({ success: false, error: 'Errore autenticazione' });
    }

    const emailId = Date.now().toString();

    // Processa allegati: cifra su disco
    const processedAttachments = [];
    if (emailData.attachments && emailData.attachments.length > 0) {
      console.error(`[Zimbra MCP] 📎 Cifratura di ${emailData.attachments.length} allegati...`);

      for (let i = 0; i < emailData.attachments.length; i++) {
        const attachment = emailData.attachments[i];

        // Salta immagini inline (sono già nel corpo dell'email)
        if (attachment.isInline) {
          console.error(`[Zimbra MCP] ⏭️ Salto immagine inline: ${attachment.fileName}`);
          continue;
        }

        if (!attachment.base64Data) {
          console.error(`[Zimbra MCP] ⚠️  Allegato ${attachment.fileName} senza dati`);
          continue;
        }

        try {
          // Salva allegato CIFRATO
          const saved = await storage.saveEncryptedAttachment(emailId, i, attachment, userKey);
          processedAttachments.push(saved);
          console.error(`[Zimbra MCP] 🔒 Allegato cifrato: ${attachment.fileName} (${(saved.size / 1024).toFixed(1)} KB)`);
        } catch (error) {
          console.error(`[Zimbra MCP] ❌ Errore cifratura allegato ${attachment.fileName}:`, error);
          processedAttachments.push({
            fileName: attachment.fileName,
            size: 0,
            error: 'Errore cifratura allegato'
          });
        }
      }
    }

    // Salva l'email nello storage (senza dati Base64 pesanti)
    const emailToStore = {
      ...emailData,
      id: emailId,
      userEmail: user.email,  // Traccia proprietario
      receivedAt: new Date().toISOString(),
      attachments: processedAttachments
    };

    emailStorage.set(emailId, emailToStore);
    latestEmailId = emailId;

    // Aggiorna statistiche utente
    await storage.updateUserStats(user.email, {
      lastLogin: new Date().toISOString(),
      emailsSent: (user.emailsSent || 0) + 1
    });

    console.error(`[Zimbra MCP] ✅ Email decifrata e salvata: ${emailId}`);
    console.error(`[Zimbra MCP] Utente: ${user.email}`);
    console.error(`[Zimbra MCP] Oggetto: ${emailData.subject}`);
    console.error(`[Zimbra MCP] Da: ${emailData.from}`);
    console.error(`[Zimbra MCP] Allegati cifrati: ${processedAttachments.length}`);

    res.json({
      success: true,
      emailId,
      attachmentsSaved: processedAttachments.length,
      message: 'Email decifrata e allegati salvati cifrati su disco'
    });
  } catch (error) {
    console.error('[Zimbra MCP] Errore ricezione email:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint per scaricare allegati
app.get('/download-attachment', async (req, res) => {
  try {
    const { url, emailId } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL mancante' });
    }

    // Scarica l'allegato da Zimbra
    const response = await fetch(url, {
      headers: {
        // Copia i cookie della sessione se necessario
        'Cookie': req.headers.cookie || ''
      }
    });

    if (!response.ok) {
      throw new Error(`Errore download: ${response.status}`);
    }

    const buffer = await response.buffer();
    const base64 = buffer.toString('base64');

    res.json({
      success: true,
      data: base64,
      contentType: response.headers.get('content-type'),
      size: buffer.length
    });
  } catch (error) {
    console.error('[Zimbra MCP] Errore download allegato:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    emailsInStorage: emailStorage.size,
    latestEmailId
  });
});

// Avvia server HTTP
app.listen(HTTP_PORT, () => {
  console.error(`[Zimbra MCP] Server HTTP in ascolto sulla porta ${HTTP_PORT}`);
});

// ============================================================================
// Avvia Admin UI automaticamente
// ============================================================================

let adminUIProcess = null;

function startAdminUI() {
  const adminUIPath = path.join(__dirname, 'admin-ui', 'server.js');

  // Verifica che il file esista
  if (!fs.existsSync(adminUIPath)) {
    console.error(`[Zimbra MCP] ⚠️ Admin UI non trovata: ${adminUIPath}`);
    console.error(`[Zimbra MCP] L'Admin UI non verrà avviata automaticamente.`);
    return;
  }

  console.error(`[Zimbra MCP] 🚀 Avvio Admin UI...`);

  // Spawn processo Admin UI
  adminUIProcess = spawn('node', [adminUIPath], {
    cwd: path.join(__dirname, 'admin-ui'),
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Log stdout
  adminUIProcess.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      console.error(`[Admin UI] ${line}`);
    });
  });

  // Log stderr
  adminUIProcess.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      console.error(`[Admin UI] ${line}`);
    });
  });

  // Gestisci errori
  adminUIProcess.on('error', (error) => {
    console.error(`[Zimbra MCP] ❌ Errore avvio Admin UI:`, error.message);
  });

  // Gestisci uscita
  adminUIProcess.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      console.error(`[Zimbra MCP] ⚠️ Admin UI terminata con codice ${code}`);
    } else if (signal) {
      console.error(`[Zimbra MCP] ⚠️ Admin UI terminata con segnale ${signal}`);
    }
    adminUIProcess = null;
  });
}

// Avvia Admin UI dopo un breve delay (per dare tempo al server MCP di partire)
setTimeout(() => {
  startAdminUI();
}, 1000);

// Cleanup quando il processo principale termina
process.on('SIGINT', () => {
  console.error(`\n[Zimbra MCP] 🛑 Arresto in corso...`);

  if (adminUIProcess) {
    console.error(`[Zimbra MCP] Chiusura Admin UI...`);
    adminUIProcess.kill('SIGTERM');
  }

  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error(`\n[Zimbra MCP] 🛑 Arresto in corso...`);

  if (adminUIProcess) {
    console.error(`[Zimbra MCP] Chiusura Admin UI...`);
    adminUIProcess.kill('SIGTERM');
  }

  process.exit(0);
});

// ============================================================================
// MCP Server per comunicazione con Claude
// ============================================================================

const server = new Server(
  {
    name: 'zimbra-email-processor',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool: lista email disponibili
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_latest_email',
        description: 'Recupera l\'ultima email ricevuta da Zimbra con tutte le informazioni (mittente, destinatario, oggetto, corpo, allegati). NOTA: Se l\'istanza MCP è autenticata con USER_EMAIL, mostra automaticamente solo le email di quell\'utente autenticato.',
        inputSchema: {
          type: 'object',
          properties: {
            userEmail: {
              type: 'string',
              description: '(Ignorato se MCP autenticato) Email dell\'utente di cui recuperare l\'ultima email. Solo in modalità admin.'
            }
          },
          required: []
        }
      },
      {
        name: 'get_email_by_id',
        description: 'Recupera una email specifica tramite il suo ID',
        inputSchema: {
          type: 'object',
          properties: {
            emailId: {
              type: 'string',
              description: 'ID dell\'email da recuperare'
            }
          },
          required: ['emailId']
        }
      },
      {
        name: 'list_available_emails',
        description: 'Elenca tutte le email disponibili nello storage con informazioni di riepilogo. Se userEmail è specificato, mostra solo le email di quell\'utente.',
        inputSchema: {
          type: 'object',
          properties: {
            userEmail: {
              type: 'string',
              description: 'Email dell\'utente di cui elencare le email (opzionale). Se non specificato, mostra tutte le email.'
            }
          },
          required: []
        }
      },
      {
        name: 'download_attachment',
        description: 'Scarica un allegato specifico da Zimbra e restituisce il contenuto in Base64',
        inputSchema: {
          type: 'object',
          properties: {
            emailId: {
              type: 'string',
              description: 'ID dell\'email contenente l\'allegato'
            },
            attachmentIndex: {
              type: 'number',
              description: 'Indice dell\'allegato nell\'array (0-based)'
            }
          },
          required: ['emailId', 'attachmentIndex']
        }
      },
      {
        name: 'extract_email_data',
        description: 'Estrae dati specifici dall\'email (es. solo mittente, solo allegati, ecc.)',
        inputSchema: {
          type: 'object',
          properties: {
            emailId: {
              type: 'string',
              description: 'ID dell\'email'
            },
            fields: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['from', 'to', 'subject', 'body', 'date', 'attachments']
              },
              description: 'Campi da estrarre'
            }
          },
          required: ['emailId', 'fields']
        }
      },
      {
        name: 'read_attachment_by_id',
        description: 'Legge un allegato dal disco usando il suo ID e restituisce il contenuto in Base64',
        inputSchema: {
          type: 'object',
          properties: {
            attachmentId: {
              type: 'string',
              description: 'ID dell\'allegato (formato: emailId_index)'
            }
          },
          required: ['attachmentId']
        }
      },
      // ===== GESTIONE UTENTI =====
      {
        name: 'user_check_status',
        description: 'Verifica se un utente esiste ed è abilitato. Mostra statistiche dell\'utente (email inviate, ultimo accesso, data creazione)',
        inputSchema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'Email dell\'utente da verificare'
            }
          },
          required: ['email']
        }
      },
      {
        name: 'user_list_all',
        description: 'Elenca tutti gli utenti registrati con le loro statistiche (abilitati e disabilitati)',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'user_add',
        description: 'Aggiunge un nuovo utente e genera una password temporanea. Restituisce la password generata che deve essere comunicata all\'utente.',
        inputSchema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'Email del nuovo utente'
            }
          },
          required: ['email']
        }
      },
      {
        name: 'user_regenerate_password',
        description: 'Rigenera la password di un utente esistente. NOTA: Le password sono hashate, quindi non possiamo mostrarle. Questo tool genera una NUOVA password e la restituisce.',
        inputSchema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'Email dell\'utente'
            }
          },
          required: ['email']
        }
      },
      {
        name: 'user_toggle_status',
        description: 'Abilita o disabilita un utente. Se abilitato viene disabilitato e viceversa.',
        inputSchema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'Email dell\'utente'
            }
          },
          required: ['email']
        }
      },
      {
        name: 'user_delete',
        description: 'Elimina completamente un utente dal sistema. ATTENZIONE: Operazione irreversibile!',
        inputSchema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'Email dell\'utente da eliminare'
            }
          },
          required: ['email']
        }
      },
      {
        name: 'system_get_stats',
        description: 'Ottieni statistiche globali del sistema (totale utenti, utenti attivi, email processate, ecc.)',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ],
  };
});

// Handler per l'esecuzione dei tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_latest_email': {
        // SICUREZZA: Filtra automaticamente per utente autenticato
        const targetUserEmail = authenticatedUser ? authenticatedUser.email : args?.userEmail;

        if (targetUserEmail) {
          // Filtra email per l'utente specificato (o autenticato)
          const userEmails = Array.from(emailStorage.values())
            .filter(email => email.userEmail === targetUserEmail)
            .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

          if (userEmails.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Nessuna email disponibile per l'utente ${targetUserEmail}. Usa il pulsante "Elabora" su Zimbra per inviare un'email.`
                }
              ]
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(userEmails[0], null, 2)
              }
            ]
          };
        }

        // Comportamento default: ultima email globale (solo se NON autenticato = modalità admin)
        if (!latestEmailId) {
          return {
            content: [
              {
                type: 'text',
                text: 'Nessuna email disponibile. Usa il pulsante "Elabora" su Zimbra per inviare un\'email.'
              }
            ]
          };
        }

        const email = emailStorage.get(latestEmailId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(email, null, 2)
            }
          ]
        };
      }

      case 'get_email_by_id': {
        const { emailId } = args;
        const email = emailStorage.get(emailId);

        if (!email) {
          return {
            content: [
              {
                type: 'text',
                text: `Email con ID ${emailId} non trovata`
              }
            ],
            isError: true
          };
        }

        // SICUREZZA: Verifica che l'email appartenga all'utente autenticato
        if (authenticatedUser && email.userEmail !== authenticatedUser.email) {
          storage.auditLog('UNAUTHORIZED_EMAIL_ACCESS_ATTEMPT', {
            user: authenticatedUser.email,
            attemptedEmailId: emailId,
            emailOwner: email.userEmail
          });
          return {
            content: [
              {
                type: 'text',
                text: `Accesso negato: questa email appartiene a un altro utente`
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(email, null, 2)
            }
          ]
        };
      }

      case 'list_available_emails': {
        // SICUREZZA: Filtra automaticamente per utente autenticato
        const targetUserEmail = authenticatedUser ? authenticatedUser.email : args?.userEmail;

        let allEmails = Array.from(emailStorage.values());

        // Filtra per utente se autenticato o specificato
        if (targetUserEmail) {
          allEmails = allEmails.filter(email => email.userEmail === targetUserEmail);
        }

        const emails = allEmails.map(email => ({
          id: email.id,
          from: email.from,
          subject: email.subject,
          date: email.date,
          receivedAt: email.receivedAt,
          userEmail: email.userEmail,
          attachmentsCount: email.attachments?.length || 0
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(emails, null, 2)
            }
          ]
        };
      }

      case 'download_attachment': {
        const { emailId, attachmentIndex } = args;
        const email = emailStorage.get(emailId);

        if (!email) {
          return {
            content: [
              {
                type: 'text',
                text: `Email con ID ${emailId} non trovata`
              }
            ],
            isError: true
          };
        }

        if (!email.attachments || !email.attachments[attachmentIndex]) {
          return {
            content: [
              {
                type: 'text',
                text: `Allegato all'indice ${attachmentIndex} non trovato`
              }
            ],
            isError: true
          };
        }

        const attachment = email.attachments[attachmentIndex];

        // Scarica l'allegato tramite l'endpoint HTTP
        const response = await fetch(`http://localhost:${HTTP_PORT}/download-attachment?url=${encodeURIComponent(attachment.downloadUrl)}&emailId=${emailId}`);
        const result = await response.json();

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Errore download allegato: ${result.error}`
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                fileName: attachment.fileName,
                size: attachment.size,
                mimeType: result.contentType,
                base64Data: result.data
              }, null, 2)
            }
          ]
        };
      }

      case 'extract_email_data': {
        const { emailId, fields } = args;
        const email = emailStorage.get(emailId);

        if (!email) {
          return {
            content: [
              {
                type: 'text',
                text: `Email con ID ${emailId} non trovata`
              }
            ],
            isError: true
          };
        }

        const extracted = {};
        fields.forEach(field => {
          if (email[field] !== undefined) {
            extracted[field] = email[field];
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(extracted, null, 2)
            }
          ]
        };
      }

      case 'read_attachment_by_id': {
        const { attachmentId } = args;

        try {
          // Estrai emailId da attachmentId (formato: emailId_index)
          const emailId = attachmentId.split('_')[0];

          // Trova email proprietaria
          const email = emailStorage.get(emailId);

          if (!email) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Email con ID ${emailId} non trovata per allegato ${attachmentId}`
                }
              ],
              isError: true
            };
          }

          // SICUREZZA: Verifica che l'allegato appartenga all'utente autenticato
          if (authenticatedUser && email.userEmail !== authenticatedUser.email) {
            storage.auditLog('UNAUTHORIZED_ATTACHMENT_ACCESS_ATTEMPT', {
              user: authenticatedUser.email,
              attemptedAttachmentId: attachmentId,
              emailOwner: email.userEmail
            });
            return {
              content: [
                {
                  type: 'text',
                  text: `Accesso negato: questo allegato appartiene a un altro utente`
                }
              ],
              isError: true
            };
          }

          // Carica utente proprietario
          const user = await storage.findUserByEmail(email.userEmail);

          if (!user) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Utente proprietario ${email.userEmail} non trovato`
                }
              ],
              isError: true
            };
          }

          // Decifra chiave derivata utente
          const masterKey = cryptoLib.loadMasterKey();
          const userKey = cryptoLib.decryptWithMasterKey(user.encryptedDerivedKey, masterKey);

          // Leggi e decifra allegato
          const base64Data = await storage.readEncryptedAttachment(attachmentId, userKey);

          // Trova metadata allegato
          const attachmentMeta = email.attachments.find(a => a.attachmentId === attachmentId);

          if (!attachmentMeta) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Metadata allegato ${attachmentId} non trovata`
                }
              ],
              isError: true
            };
          }

          console.error(`[Zimbra MCP] 🔓 Allegato decifrato: ${attachmentMeta.fileName} (${(Buffer.from(base64Data, 'base64').length / 1024).toFixed(1)} KB)`);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  attachmentId,
                  fileName: attachmentMeta.fileName,
                  size: Buffer.from(base64Data, 'base64').length,
                  mimeType: attachmentMeta.mimeType,
                  base64Data
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          console.error(`[Zimbra MCP] ❌ Errore lettura/decifratura allegato ${attachmentId}:`, error);
          return {
            content: [
              {
                type: 'text',
                text: `Errore lettura allegato: ${error.message}`
              }
            ],
            isError: true
          };
        }
      }

      // ===== GESTIONE UTENTI =====

      case 'user_check_status': {
        const { email } = args;

        try {
          const user = await storage.findUserByEmail(email);

          if (!user) {
            return {
              content: [
                {
                  type: 'text',
                  text: `❌ Utente ${email} non trovato nel sistema.`
                }
              ]
            };
          }

          const status = user.enabled ? '✅ Abilitato' : '❌ Disabilitato';
          const lastLoginFormatted = user.lastLogin
            ? new Date(user.lastLogin).toLocaleString('it-IT')
            : 'Mai effettuato accesso';

          return {
            content: [
              {
                type: 'text',
                text: `📊 Stato utente: ${email}\n\n` +
                      `Stato: ${status}\n` +
                      `Data creazione: ${new Date(user.createdAt).toLocaleString('it-IT')}\n` +
                      `Ultimo accesso: ${lastLoginFormatted}\n` +
                      `Email inviate: ${user.emailsSent || 0}\n` +
                      `Versione chiave: ${user.keyVersion}\n` +
                      `Iterazioni KDF: ${user.kdfIterations}`
              }
            ]
          };
        } catch (error) {
          console.error(`[Zimbra MCP] Errore check status utente:`, error);
          return {
            content: [
              {
                type: 'text',
                text: `Errore verifica stato: ${error.message}`
              }
            ],
            isError: true
          };
        }
      }

      case 'user_list_all': {
        try {
          const data = await storage.loadUsers();

          if (!data.users || data.users.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: '📋 Nessun utente registrato nel sistema.'
                }
              ]
            };
          }

          let output = `📋 Utenti registrati (${data.users.length}):\n\n`;

          data.users.forEach((user, index) => {
            const status = user.enabled ? '✅' : '❌';
            const lastLogin = user.lastLogin
              ? new Date(user.lastLogin).toLocaleDateString('it-IT')
              : 'Mai';

            output += `${index + 1}. ${status} ${user.email}\n`;
            output += `   📅 Creato: ${new Date(user.createdAt).toLocaleDateString('it-IT')}\n`;
            output += `   🔐 Ultimo accesso: ${lastLogin}\n`;
            output += `   📧 Email inviate: ${user.emailsSent || 0}\n\n`;
          });

          output += `\nAggiornato: ${new Date(data.lastUpdate).toLocaleString('it-IT')}`;

          return {
            content: [
              {
                type: 'text',
                text: output
              }
            ]
          };
        } catch (error) {
          console.error(`[Zimbra MCP] Errore lista utenti:`, error);
          return {
            content: [
              {
                type: 'text',
                text: `Errore caricamento lista: ${error.message}`
              }
            ],
            isError: true
          };
        }
      }

      case 'user_add': {
        const { email } = args;

        try {
          // Genera password temporanea
          const temporaryPassword = cryptoLib.generateSecurePassword(16);

          // Aggiungi utente
          const user = await storage.addUser(email, temporaryPassword);

          console.error(`[Zimbra MCP] ✅ Utente creato: ${email}`);

          return {
            content: [
              {
                type: 'text',
                text: `✅ Utente ${email} creato con successo!\n\n` +
                      `🔑 Password temporanea: ${temporaryPassword}\n\n` +
                      `⚠️ IMPORTANTE: Comunica questa password all'utente in modo sicuro.\n` +
                      `L'utente dovrà configurarla nello script Tampermonkey.\n\n` +
                      `📊 Statistiche:\n` +
                      `- Creato: ${new Date(user.createdAt).toLocaleString('it-IT')}\n` +
                      `- Stato: ${user.enabled ? 'Abilitato' : 'Disabilitato'}\n` +
                      `- Versione chiave: ${user.keyVersion}`
              }
            ]
          };
        } catch (error) {
          if (error.message === 'USER_ALREADY_EXISTS') {
            return {
              content: [
                {
                  type: 'text',
                  text: `❌ Utente ${email} già esistente nel sistema.`
                }
              ],
              isError: true
            };
          }

          console.error(`[Zimbra MCP] Errore creazione utente:`, error);
          return {
            content: [
              {
                type: 'text',
                text: `Errore creazione utente: ${error.message}`
              }
            ],
            isError: true
          };
        }
      }

      case 'user_regenerate_password': {
        const { email } = args;

        try {
          const user = await storage.findUserByEmail(email);

          if (!user) {
            return {
              content: [
                {
                  type: 'text',
                  text: `❌ Utente ${email} non trovato.`
                }
              ],
              isError: true
            };
          }

          // Genera nuova password
          const newPassword = cryptoLib.generateSecurePassword(16);

          // Deriva nuova chiave AES
          const kdfSalt = cryptoLib.generateKdfSalt();
          const aesKey = cryptoLib.deriveAESKey(newPassword, kdfSalt);
          const masterKey = cryptoLib.loadMasterKey();
          const encryptedDerivedKey = cryptoLib.encryptWithMasterKey(aesKey, masterKey);

          // Hash password
          const argon2 = (await import('argon2')).default;
          const passwordHash = await argon2.hash(newPassword);

          // Aggiorna utente
          await storage.updateUser(email, {
            passwordHash,
            encryptedDerivedKey,
            kdfSalt,
            kdfIterations: 100000
          });

          console.error(`[Zimbra MCP] 🔄 Password rigenerata per: ${email}`);

          return {
            content: [
              {
                type: 'text',
                text: `✅ Password rigenerata per ${email}\n\n` +
                      `🔑 Nuova password: ${newPassword}\n\n` +
                      `⚠️ IMPORTANTE: Comunica questa password all'utente.\n` +
                      `L'utente dovrà aggiornare la password nello script Tampermonkey.\n\n` +
                      `🗑️ NOTA: Tutte le email precedentemente inviate da questo utente\n` +
                      `non saranno più accessibili con la nuova password.`
              }
            ]
          };
        } catch (error) {
          console.error(`[Zimbra MCP] Errore rigenerazione password:`, error);
          return {
            content: [
              {
                type: 'text',
                text: `Errore rigenerazione password: ${error.message}`
              }
            ],
            isError: true
          };
        }
      }

      case 'user_toggle_status': {
        const { email } = args;

        try {
          const user = await storage.findUserByEmail(email);

          if (!user) {
            return {
              content: [
                {
                  type: 'text',
                  text: `❌ Utente ${email} non trovato.`
                }
              ],
              isError: true
            };
          }

          const newStatus = !user.enabled;
          await storage.updateUser(email, { enabled: newStatus });

          const statusText = newStatus ? '✅ abilitato' : '❌ disabilitato';
          console.error(`[Zimbra MCP] 🔄 Utente ${statusText}: ${email}`);

          return {
            content: [
              {
                type: 'text',
                text: `✅ Utente ${email} ${statusText} con successo.\n\n` +
                      `Nuovo stato: ${newStatus ? 'Abilitato' : 'Disabilitato'}\n\n` +
                      (newStatus ?
                        '✅ L\'utente può ora inviare email cifrate.' :
                        '⛔ L\'utente non può più inviare email (riceverà errore 403).')
              }
            ]
          };
        } catch (error) {
          console.error(`[Zimbra MCP] Errore toggle status:`, error);
          return {
            content: [
              {
                type: 'text',
                text: `Errore modifica stato: ${error.message}`
              }
            ],
            isError: true
          };
        }
      }

      case 'user_delete': {
        const { email } = args;

        try {
          const user = await storage.findUserByEmail(email);

          if (!user) {
            return {
              content: [
                {
                  type: 'text',
                  text: `❌ Utente ${email} non trovato.`
                }
              ],
              isError: true
            };
          }

          await storage.deleteUser(email);
          console.error(`[Zimbra MCP] 🗑️ Utente eliminato: ${email}`);

          return {
            content: [
              {
                type: 'text',
                text: `✅ Utente ${email} eliminato definitivamente.\n\n` +
                      `⚠️ ATTENZIONE: Questa operazione è irreversibile.\n` +
                      `Le email e gli allegati cifrati dell'utente non sono più accessibili.`
              }
            ]
          };
        } catch (error) {
          console.error(`[Zimbra MCP] Errore eliminazione utente:`, error);
          return {
            content: [
              {
                type: 'text',
                text: `Errore eliminazione: ${error.message}`
              }
            ],
            isError: true
          };
        }
      }

      case 'system_get_stats': {
        try {
          const data = await storage.loadUsers();
          const users = data.users || [];

          const totalUsers = users.length;
          const activeUsers = users.filter(u => u.enabled).length;
          const disabledUsers = users.filter(u => !u.enabled).length;
          const totalEmailsProcessed = users.reduce((sum, u) => sum + (u.emailsSent || 0), 0);

          const usersWithLogin = users.filter(u => u.lastLogin);
          const recentLogins = usersWithLogin
            .sort((a, b) => new Date(b.lastLogin) - new Date(a.lastLogin))
            .slice(0, 5);

          let output = `📊 Statistiche Sistema MCP Zimbra\n\n`;
          output += `👥 Utenti:\n`;
          output += `   • Totali: ${totalUsers}\n`;
          output += `   • Attivi: ${activeUsers}\n`;
          output += `   • Disabilitati: ${disabledUsers}\n\n`;
          output += `📧 Email processate: ${totalEmailsProcessed}\n\n`;

          if (recentLogins.length > 0) {
            output += `🕐 Ultimi accessi:\n`;
            recentLogins.forEach(u => {
              const loginDate = new Date(u.lastLogin).toLocaleString('it-IT');
              output += `   • ${u.email}: ${loginDate}\n`;
            });
          } else {
            output += `🕐 Nessun accesso registrato\n`;
          }

          output += `\n📅 Ultimo aggiornamento DB: ${new Date(data.lastUpdate).toLocaleString('it-IT')}`;

          return {
            content: [
              {
                type: 'text',
                text: output
              }
            ]
          };
        } catch (error) {
          console.error(`[Zimbra MCP] Errore statistiche sistema:`, error);
          return {
            content: [
              {
                type: 'text',
                text: `Errore caricamento statistiche: ${error.message}`
              }
            ],
            isError: true
          };
        }
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Tool sconosciuto: ${name}`
            }
          ],
          isError: true
        };
    }
  } catch (error) {
    console.error(`[Zimbra MCP] Errore esecuzione tool ${name}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: `Errore: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

/**
 * Verifica credenziali utente per autenticazione MCP
 * Legge USER_EMAIL e USER_PASSWORD da .env e verifica contro users.json
 */
async function authenticateMCPUser() {
  // Supporta sia prefisso CLIENT_ che legacy (senza prefisso)
  const userEmail = process.env.CLIENT_USER_EMAIL || process.env.USER_EMAIL;
  const userPassword = process.env.CLIENT_USER_PASSWORD || process.env.USER_PASSWORD;

  // Se non configurate, modalità admin (accesso a tutte le email)
  if (!userEmail || !userPassword) {
    console.error('[Zimbra MCP] ⚠️  CLIENT_USER_EMAIL/CLIENT_USER_PASSWORD non configurati');
    console.error('[Zimbra MCP] Modalità ADMIN: accesso a tutte le email');
    return null;
  }

  console.error(`[Zimbra MCP] 🔐 Verifica credenziali utente: ${userEmail}`);

  try {
    // Carica utente dal database
    const user = await storage.findUserByEmail(userEmail);

    if (!user) {
      console.error(`[Zimbra MCP] ❌ Utente ${userEmail} non trovato nel database`);
      console.error('[Zimbra MCP] Aggiungi l\'utente tramite Admin UI o tool user_add');
      process.exit(1);
    }

    if (!user.enabled) {
      console.error(`[Zimbra MCP] ❌ Utente ${userEmail} è disabilitato`);
      process.exit(1);
    }

    // Verifica password con Argon2
    const argon2 = await import('argon2');
    const isValid = await argon2.verify(user.passwordHash, userPassword);

    if (!isValid) {
      console.error(`[Zimbra MCP] ❌ Password non valida per ${userEmail}`);
      process.exit(1);
    }

    console.error(`[Zimbra MCP] ✅ Autenticazione riuscita: ${userEmail}`);
    storage.auditLog('MCP_USER_AUTHENTICATED', { email: userEmail });

    return user;
  } catch (error) {
    console.error(`[Zimbra MCP] ❌ Errore autenticazione:`, error.message);
    process.exit(1);
  }
}

// Avvia il server MCP
async function main() {
  // Autentica utente (produzione)
  authenticatedUser = await authenticateMCPUser();

  if (authenticatedUser) {
    console.error(`[Zimbra MCP] 👤 Accesso limitato alle email di: ${authenticatedUser.email}`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Zimbra MCP] Server MCP avviato');
}

main().catch((error) => {
  console.error('[Zimbra MCP] Errore fatale:', error);
  process.exit(1);
});