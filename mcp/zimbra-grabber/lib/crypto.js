/**
 * Modulo Crypto - Funzioni di cifratura e sicurezza
 *
 * Fornisce tutte le primitive crittografiche per il sistema:
 * - Derivazione chiavi AES da password (PBKDF2)
 * - Cifratura/decifratura AES-256-CBC
 * - Gestione master key per proteggere chiavi derivate
 * - HMAC per integrità
 * - Generazione password sicure
 */

import crypto from 'crypto';
import dotenv from 'dotenv';

// Carica variabili ambiente
dotenv.config();

/**
 * Carica e valida la master encryption key da .env
 *
 * @returns {Buffer} Master key (32 byte)
 * @throws {Error} Se master key non configurata o invalida
 */
export function loadMasterKey() {
  // Supporta sia prefisso SERVER_ che legacy (senza prefisso)
  const key = process.env.SERVER_MASTER_ENCRYPTION_KEY || process.env.MASTER_ENCRYPTION_KEY;

  if (!key) {
    throw new Error('SERVER_MASTER_ENCRYPTION_KEY o MASTER_ENCRYPTION_KEY non configurata nel file .env');
  }

  // Decodifica da base64
  const decoded = Buffer.from(key, 'base64');

  // Verifica lunghezza (deve essere 32 byte per AES-256)
  if (decoded.length !== 32) {
    throw new Error('MASTER_ENCRYPTION_KEY deve essere 32 byte (256 bit). Genera con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
  }

  return decoded;
}

/**
 * Deriva una chiave AES-256 da password usando PBKDF2
 *
 * @param {string} password - Password utente
 * @param {string} kdfSalt - Salt in formato base64
 * @param {number} iterations - Numero iterazioni PBKDF2 (default: 100000)
 * @returns {Buffer} Chiave AES derivata (32 byte)
 */
export function deriveAESKey(password, kdfSalt, iterations = 100000) {
  return crypto.pbkdf2Sync(
    password,
    Buffer.from(kdfSalt, 'base64'),
    iterations,
    32,  // 256 bit per AES-256
    'sha256'
  );
}

/**
 * Cifra dati con la master key
 * Formato output: [IV 16 byte][Dati cifrati]
 *
 * @param {Buffer} data - Dati da cifrare
 * @param {Buffer} masterKey - Master encryption key
 * @returns {string} Dati cifrati in base64
 */
export function encryptWithMasterKey(data, masterKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', masterKey, iv);

  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final()
  ]);

  // Concatena IV + encrypted e converti in base64
  return Buffer.concat([iv, encrypted]).toString('base64');
}

/**
 * Decifra dati cifrati con la master key
 *
 * @param {string} encryptedBase64 - Dati cifrati in base64
 * @param {Buffer} masterKey - Master encryption key
 * @returns {Buffer} Dati decifrati
 */
export function decryptWithMasterKey(encryptedBase64, masterKey) {
  const data = Buffer.from(encryptedBase64, 'base64');

  // Estrai IV (primi 16 byte)
  const iv = data.subarray(0, 16);
  const encrypted = data.subarray(16);

  const decipher = crypto.createDecipheriv('aes-256-cbc', masterKey, iv);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
}

/**
 * Cifra dati con AES-256-CBC
 *
 * @param {Buffer|string} plaintext - Dati in chiaro
 * @param {Buffer} key - Chiave AES (32 byte)
 * @param {Buffer} iv - Initialization Vector (16 byte)
 * @returns {Buffer} Dati cifrati
 */
export function encryptAES(plaintext, key, iv) {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  // Converti string a Buffer se necessario
  const data = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;

  return Buffer.concat([
    cipher.update(data),
    cipher.final()
  ]);
}

/**
 * Decifra dati con AES-256-CBC
 *
 * @param {Buffer} encrypted - Dati cifrati
 * @param {Buffer} key - Chiave AES (32 byte)
 * @param {Buffer} iv - Initialization Vector (16 byte)
 * @returns {Buffer} Dati decifrati
 */
export function decryptAES(encrypted, key, iv) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
}

/**
 * Calcola HMAC-SHA256 per verificare integrità
 *
 * @param {Buffer|string} data - Dati da firmare
 * @param {Buffer} key - Chiave HMAC
 * @returns {string} HMAC in formato hex
 */
export function calculateHMAC(data, key) {
  return crypto.createHmac('sha256', key)
    .update(data)
    .digest('hex');
}

/**
 * Confronto timing-safe per proteggere da timing attacks
 * Wrapper per crypto.timingSafeEqual con gestione lunghezze diverse
 *
 * @param {string|Buffer} a - Primo valore
 * @param {string|Buffer} b - Secondo valore
 * @returns {boolean} true se uguali
 */
export function timingSafeEqual(a, b) {
  const bufA = typeof a === 'string' ? Buffer.from(a, 'utf8') : a;
  const bufB = typeof b === 'string' ? Buffer.from(b, 'utf8') : b;

  // Se lunghezze diverse, usa comparison fake per evitare leak lunghezza
  if (bufA.length !== bufB.length) {
    // Esegui comunque una comparazione per timing costante
    crypto.timingSafeEqual(
      Buffer.alloc(32),
      Buffer.alloc(32)
    );
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Genera un salt PBKDF2 casuale
 *
 * @returns {string} Salt in formato base64 (32 byte)
 */
export function generateKdfSalt() {
  return crypto.randomBytes(32).toString('base64');
}

/**
 * Genera una password sicura casuale
 *
 * @param {number} length - Lunghezza password (default: 16)
 * @returns {string} Password generata
 */
export function generateSecurePassword(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const bytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }

  return password;
}

/**
 * Genera un IV (Initialization Vector) casuale per AES
 *
 * @returns {Buffer} IV (16 byte)
 */
export function generateIV() {
  return crypto.randomBytes(16);
}

export default {
  loadMasterKey,
  deriveAESKey,
  encryptWithMasterKey,
  decryptWithMasterKey,
  encryptAES,
  decryptAES,
  calculateHMAC,
  timingSafeEqual,
  generateKdfSalt,
  generateSecurePassword,
  generateIV
};
