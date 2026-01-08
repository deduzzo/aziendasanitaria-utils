#!/usr/bin/env node

/**
 * MCP Server per elaborazione email Zimbra
 *
 * Questo server MCP espone tool per permettere a Claude di elaborare email
 * ricevute da Zimbra tramite il Tampermonkey script.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage temporaneo per le email ricevute
const emailStorage = new Map();
let latestEmailId = null;

// Configurazione
const HTTP_PORT = 3456;
const ATTACHMENTS_DIR = path.join(__dirname, 'attachments');

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

// Salva un allegato su disco
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

// Endpoint per ricevere email
app.post('/process-email', async (req, res) => {
  try {
    const emailData = req.body;
    const emailId = Date.now().toString();

    // Processa allegati: salva su disco e sostituisci Base64 con ID
    const processedAttachments = [];
    if (emailData.attachments && emailData.attachments.length > 0) {
      console.error(`[Zimbra MCP] 📎 Salvataggio di ${emailData.attachments.length} allegati...`);

      for (let i = 0; i < emailData.attachments.length; i++) {
        const attachment = emailData.attachments[i];

        // Salta immagini inline (sono già nel corpo dell'email)
        if (attachment.isInline) {
          console.error(`[Zimbra MCP] ⏭️ Salto immagine inline: ${attachment.fileName}`);
          continue;
        }

        const saved = saveAttachment(emailId, i, attachment);
        if (saved) {
          processedAttachments.push(saved);
        } else {
          // Mantieni info dell'allegato anche se non salvato
          processedAttachments.push({
            fileName: attachment.fileName,
            size: attachment.size,
            error: 'Impossibile salvare allegato'
          });
        }
      }
    }

    // Salva l'email nello storage (senza dati Base64 pesanti)
    const emailToStore = {
      ...emailData,
      id: emailId,
      receivedAt: new Date().toISOString(),
      attachments: processedAttachments  // Sostituisci con versione leggera
    };

    emailStorage.set(emailId, emailToStore);
    latestEmailId = emailId;

    console.error(`[Zimbra MCP] ✅ Email ricevuta: ${emailId}`);
    console.error(`[Zimbra MCP] Oggetto: ${emailData.subject}`);
    console.error(`[Zimbra MCP] Da: ${emailData.from}`);
    console.error(`[Zimbra MCP] Allegati salvati: ${processedAttachments.length}`);

    res.json({
      success: true,
      emailId,
      attachmentsSaved: processedAttachments.length,
      message: 'Email ricevuta e allegati salvati su disco',
      response: 'Email ricevuta correttamente. Claude può ora elaborarla tramite gli strumenti MCP.'
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
        description: 'Recupera l\'ultima email ricevuta da Zimbra con tutte le informazioni (mittente, destinatario, oggetto, corpo, allegati)',
        inputSchema: {
          type: 'object',
          properties: {},
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
        description: 'Elenca tutte le email disponibili nello storage con informazioni di riepilogo',
        inputSchema: {
          type: 'object',
          properties: {},
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
        const emails = Array.from(emailStorage.values()).map(email => ({
          id: email.id,
          from: email.from,
          subject: email.subject,
          date: email.date,
          receivedAt: email.receivedAt,
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

        // Cerca il file nella cartella attachments che inizia con l'ID
        try {
          const files = fs.readdirSync(ATTACHMENTS_DIR);
          const matchingFile = files.find(file => file.startsWith(attachmentId + '_'));

          if (!matchingFile) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Allegato con ID ${attachmentId} non trovato su disco`
                }
              ],
              isError: true
            };
          }

          const filePath = path.join(ATTACHMENTS_DIR, matchingFile);
          const buffer = fs.readFileSync(filePath);
          const base64Data = buffer.toString('base64');

          // Estrai nome file originale (rimuovi il prefixo ID)
          const originalFileName = matchingFile.replace(new RegExp(`^${attachmentId}_`), '');

          // Determina MIME type dall'estensione
          const ext = path.extname(originalFileName).toLowerCase();
          const mimeTypes = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.xml': 'application/xml',
            '.txt': 'text/plain',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif'
          };
          const mimeType = mimeTypes[ext] || 'application/octet-stream';

          console.error(`[Zimbra MCP] 📄 Letto allegato: ${originalFileName} (${(buffer.length / 1024).toFixed(1)} KB)`);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  attachmentId,
                  fileName: originalFileName,
                  size: buffer.length,
                  mimeType,
                  base64Data
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          console.error(`[Zimbra MCP] ❌ Errore lettura allegato ${attachmentId}:`, error);
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

// Avvia il server MCP
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Zimbra MCP] Server MCP avviato');
}

main().catch((error) => {
  console.error('[Zimbra MCP] Errore fatale:', error);
  process.exit(1);
});