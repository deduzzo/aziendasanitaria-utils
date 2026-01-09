/**
 * Modulo Storage - Gestione persistenza dati
 *
 * Gestisce:
 * - Database JSON utenti (config/users.json)
 * - Allegati cifrati su disco (attachments/)
 * - Audit logging per sicurezza
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import argon2 from 'argon2';
import * as cryptoLib from './crypto.js';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Percorsi file
const USERS_FILE = path.join(__dirname, '../config/users.json');
const ATTACHMENTS_DIR = path.join(__dirname, '../attachments');

/**
 * Carica il database utenti da disco
 *
 * @returns {Promise<Object>} Oggetto database con {version, users[]}
 */
export async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File non esiste, crea database vuoto
      const empty = {
        version: '1.0',
        masterKeyVersion: 'v1',
        lastUpdate: new Date().toISOString(),
        users: []
      };
      await saveUsers(empty);
      return empty;
    }
    throw error;
  }
}

/**
 * Salva il database utenti su disco
 *
 * @param {Object} usersData - Oggetto database completo
 */
export async function saveUsers(usersData) {
  usersData.lastUpdate = new Date().toISOString();
  await fs.writeFile(USERS_FILE, JSON.stringify(usersData, null, 2));
}

/**
 * Cerca un utente per email (case-insensitive)
 *
 * @param {string} email - Email da cercare
 * @returns {Promise<Object|null>} Oggetto utente o null se non trovato
 */
export async function findUserByEmail(email) {
  const data = await loadUsers();
  return data.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Aggiunge un nuovo utente al database
 *
 * @param {string} email - Email utente
 * @param {string} password - Password temporanea
 * @returns {Promise<Object>} Oggetto utente creato
 * @throws {Error} Se utente già esiste
 */
export async function addUser(email, password) {
  const data = await loadUsers();

  // Verifica se utente già esiste
  if (data.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('USER_ALREADY_EXISTS');
  }

  // Genera salt PBKDF2 univoco
  const kdfSalt = cryptoLib.generateKdfSalt();

  // Deriva chiave AES da password
  const aesKey = cryptoLib.deriveAESKey(password, kdfSalt);

  // Cifra la chiave derivata con master key
  const masterKey = cryptoLib.loadMasterKey();
  const encryptedDerivedKey = cryptoLib.encryptWithMasterKey(aesKey, masterKey);

  // Hash password con Argon2id (per cambio password futuro)
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,  // 64 MB
    timeCost: 3,
    parallelism: 1
  });

  // Crea oggetto utente
  const user = {
    email,
    passwordHash,
    encryptedDerivedKey,
    kdfSalt,
    kdfIterations: 100000,
    keyVersion: 'v1',
    enabled: true,
    createdAt: new Date().toISOString(),
    lastLogin: null,
    emailsSent: 0
  };

  data.users.push(user);
  await saveUsers(data);

  auditLog('USER_CREATED', { email });

  return user;
}

/**
 * Aggiorna un utente esistente
 *
 * @param {string} email - Email utente
 * @param {Object} updates - Campi da aggiornare
 * @returns {Promise<Object>} Utente aggiornato
 * @throws {Error} Se utente non trovato
 */
export async function updateUser(email, updates) {
  const data = await loadUsers();
  const userIndex = data.users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

  if (userIndex === -1) {
    throw new Error('USER_NOT_FOUND');
  }

  // Merge updates
  data.users[userIndex] = {
    ...data.users[userIndex],
    ...updates
  };

  await saveUsers(data);

  return data.users[userIndex];
}

/**
 * Elimina un utente dal database
 *
 * @param {string} email - Email utente da eliminare
 */
export async function deleteUser(email) {
  const data = await loadUsers();
  const originalLength = data.users.length;

  data.users = data.users.filter(u => u.email.toLowerCase() !== email.toLowerCase());

  if (data.users.length === originalLength) {
    throw new Error('USER_NOT_FOUND');
  }

  await saveUsers(data);
  auditLog('USER_DELETED', { email });
}

/**
 * Aggiorna statistiche utente (lastLogin, emailsSent)
 *
 * @param {string} email - Email utente
 * @param {Object} stats - Statistiche da aggiornare
 * @returns {Promise<Object>} Utente aggiornato
 */
export async function updateUserStats(email, stats) {
  return await updateUser(email, stats);
}

/**
 * Salva un allegato cifrato su disco
 * Formato file: [IV 16 byte][Dati cifrati AES-256-CBC]
 *
 * @param {string} emailId - ID email
 * @param {number} index - Indice allegato
 * @param {Object} attachment - Oggetto allegato con {fileName, base64Data, mimeType}
 * @param {Buffer} userKey - Chiave AES utente
 * @returns {Promise<Object>} Metadata allegato salvato
 */
export async function saveEncryptedAttachment(emailId, index, attachment, userKey) {
  // Genera IV casuale
  const iv = cryptoLib.generateIV();

  // Decodifica Base64 → Buffer
  const attachmentBuffer = Buffer.from(attachment.base64Data, 'base64');

  // Cifra con AES-256-CBC
  const encrypted = cryptoLib.encryptAES(attachmentBuffer, userKey, iv);

  // Nome file cifrato
  const fileName = `${emailId}_${index}_encrypted.bin`;
  const filePath = path.join(ATTACHMENTS_DIR, fileName);

  // Salva: [IV (16 byte)][Encrypted Data]
  const fileContent = Buffer.concat([iv, encrypted]);
  await fs.writeFile(filePath, fileContent);

  auditLog('ATTACHMENT_ENCRYPTED', {
    emailId,
    fileName: attachment.fileName,
    size: encrypted.length
  });

  return {
    attachmentId: `${emailId}_${index}`,
    fileName: attachment.fileName,
    savedPath: filePath,
    size: encrypted.length,
    mimeType: attachment.mimeType || 'application/octet-stream',
    encrypted: true
  };
}

/**
 * Legge e decifra un allegato dal disco
 *
 * @param {string} attachmentId - ID allegato (formato: emailId_index)
 * @param {Buffer} userKey - Chiave AES utente
 * @returns {Promise<string>} Contenuto allegato in base64
 * @throws {Error} Se allegato non trovato
 */
export async function readEncryptedAttachment(attachmentId, userKey) {
  // Cerca file che inizia con attachmentId
  const files = await fs.readdir(ATTACHMENTS_DIR);
  const matchingFile = files.find(f => f.startsWith(attachmentId + '_'));

  if (!matchingFile) {
    throw new Error('ATTACHMENT_NOT_FOUND');
  }

  const filePath = path.join(ATTACHMENTS_DIR, matchingFile);
  const fileContent = await fs.readFile(filePath);

  // Estrai IV (primi 16 byte)
  const iv = fileContent.subarray(0, 16);
  const encrypted = fileContent.subarray(16);

  // Decifra
  const decrypted = cryptoLib.decryptAES(encrypted, userKey, iv);

  auditLog('ATTACHMENT_DECRYPTED', {
    attachmentId,
    size: decrypted.length
  });

  return decrypted.toString('base64');
}

/**
 * Ottieni statistiche globali sistema
 *
 * @returns {Promise<Object>} Statistiche
 */
export async function getGlobalStats() {
  const data = await loadUsers();

  const totalUsers = data.users.length;
  const activeUsers = data.users.filter(u => u.enabled).length;
  const disabledUsers = totalUsers - activeUsers;
  const totalEmailsProcessed = data.users.reduce((sum, u) => sum + (u.emailsSent || 0), 0);

  // Email ultime 24h (da lastLogin)
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const emailsLast24h = data.users
    .filter(u => u.lastLogin && new Date(u.lastLogin) > yesterday)
    .reduce((sum, u) => {
      // Approssimazione: conta tutte le email degli utenti attivi nelle ultime 24h
      return sum + (u.emailsSent || 0);
    }, 0);

  return {
    totalUsers,
    activeUsers,
    disabledUsers,
    totalEmailsProcessed,
    emailsLast24h,
    averageEmailsPerUser: totalUsers > 0 ? (totalEmailsProcessed / totalUsers).toFixed(1) : 0
  };
}

/**
 * Audit logging per eventi di sicurezza
 *
 * @param {string} event - Nome evento
 * @param {Object} data - Dati evento
 */
export function auditLog(event, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...data
  };

  // Log su stderr (non interferisce con stdio MCP)
  console.error(`[AUDIT] ${event}:`, JSON.stringify(data));

  // TODO: In futuro si potrebbe salvare su file audit.log
  // fs.appendFile('audit.log', JSON.stringify(entry) + '\n');
}

export default {
  loadUsers,
  saveUsers,
  findUserByEmail,
  addUser,
  updateUser,
  deleteUser,
  updateUserStats,
  saveEncryptedAttachment,
  readEncryptedAttachment,
  getGlobalStats,
  auditLog
};
