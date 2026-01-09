#!/usr/bin/env node

/**
 * Admin UI Server - Dashboard per gestione utenti MCP Zimbra
 *
 * Server Express che fornisce:
 * - Web UI per gestione utenti (abilita/disabilita, aggiungi, elimina)
 * - API REST autenticate con Basic Auth
 * - Statistiche sistema
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';

// Carica variabili ambiente
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Supporta sia prefisso SERVER_ che legacy (senza prefisso)
const ADMIN_PORT = parseInt(process.env.SERVER_ADMIN_PORT || process.env.ADMIN_PORT) || 3457;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware autenticazione Basic Auth
function basicAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin UI"');
    return res.status(401).json({ error: 'Autenticazione richiesta' });
  }

  // Decode Basic Auth
  const credentials = Buffer.from(authHeader.substring(6), 'base64').toString();
  const [username, password] = credentials.split(':');

  // Verifica credenziali da .env (supporta sia prefisso SERVER_ che legacy)
  const adminUser = process.env.SERVER_ADMIN_USER || process.env.ADMIN_USER || 'admin';
  const adminPassword = process.env.SERVER_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('[Admin UI] SERVER_ADMIN_PASSWORD o ADMIN_PASSWORD non configurata in .env!');
    return res.status(500).json({ error: 'Configurazione server non valida' });
  }

  if (username !== adminUser || password !== adminPassword) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin UI"');
    return res.status(401).json({ error: 'Credenziali non valide' });
  }

  next();
}

// Static files (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// API routes (con autenticazione)
app.use('/api', basicAuth, apiRoutes);

// Serve index.html per root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check (no auth)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MCP Zimbra Admin UI',
    timestamp: new Date().toISOString()
  });
});

// Avvia server
app.listen(ADMIN_PORT, () => {
  const adminUser = process.env.SERVER_ADMIN_USER || process.env.ADMIN_USER || 'admin';
  console.log(`[Admin UI] Server in ascolto su http://localhost:${ADMIN_PORT}`);
  console.log(`[Admin UI] Credenziali: ${adminUser} / ******`);
  console.log(`[Admin UI] Apri http://localhost:${ADMIN_PORT} nel browser`);
});

// Gestione errori
process.on('uncaughtException', (error) => {
  console.error('[Admin UI] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Admin UI] Unhandled rejection:', reason);
  process.exit(1);
});
