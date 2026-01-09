/**
 * Modulo Auth - Autenticazione e sicurezza
 *
 * Gestisce:
 * - Autenticazione challenge-response
 * - Verifica HMAC per integrità
 * - Rate limiting per protezione brute-force
 * - Replay attack protection
 * - Timing-safe comparisons
 */

import * as cryptoLib from './crypto.js';
import storage from './storage.js';

// Cache per challenge usati (anti-replay)
const usedChallenges = new Set();

// Rate limiting per utente
const userAttempts = new Map();

/**
 * Classe custom per errori di autenticazione
 */
export class AuthError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
    this.name = 'AuthError';
  }
}

/**
 * Autentica e decifra un envelope ricevuto dal client
 *
 * Flusso completo:
 * 1. Valida campi envelope
 * 2. Rate limiting
 * 3. Trova utente
 * 4. Verifica stato enabled
 * 5. Decifra chiave derivata utente
 * 6. Verifica HMAC
 * 7. Verifica timestamp (anti-replay)
 * 8. Decifra e verifica challenge
 * 9. Verifica replay attack
 * 10. Decifra payload email
 *
 * @param {Object} envelope - Envelope cifrato dal client
 * @param {string} envelope.userEmail - Email utente
 * @param {string} envelope.encryptedPayload - Payload cifrato (base64)
 * @param {string} envelope.encryptedChallenge - Challenge cifrato (base64)
 * @param {string} envelope.iv - IV (base64)
 * @param {string} envelope.hmac - HMAC hex
 * @param {number} envelope.timestamp - Timestamp invio (ms)
 * @returns {Promise<Object>} {user, emailData, userKey}
 * @throws {AuthError} Se autenticazione fallisce
 */
export async function authenticateAndDecrypt(envelope) {
  console.error(`\n[Auth] 🔐 ===== INIZIO AUTENTICAZIONE =====`);
  console.error(`[Auth] 📧 Email: ${envelope.userEmail}`);
  console.error(`[Auth] ⏱️  Timestamp: ${envelope.timestamp}`);
  console.error(`[Auth] 📦 Envelope keys:`, Object.keys(envelope));

  // 1. Validazione envelope
  console.error(`[Auth] ✅ Step 1: Validazione campi envelope`);
  if (!envelope.userEmail || !envelope.encryptedPayload || !envelope.iv || !envelope.hmac) {
    console.error(`[Auth] ❌ MISSING_FIELDS: campi obbligatori mancanti`);
    throw new AuthError('MISSING_FIELDS', 'Campi obbligatori mancanti nell\'envelope');
  }

  if (!envelope.encryptedChallenge || !envelope.timestamp) {
    console.error(`[Auth] ❌ MISSING_FIELDS: challenge o timestamp mancante`);
    throw new AuthError('MISSING_FIELDS', 'Challenge o timestamp mancante');
  }
  console.error(`[Auth]    ✓ Tutti i campi presenti`);

  // 2. Rate limiting
  console.error(`[Auth] ✅ Step 2: Rate limiting`);
  if (!checkUserRateLimit(envelope.userEmail)) {
    console.error(`[Auth] ❌ RATE_LIMIT_EXCEEDED`);
    throw new AuthError('RATE_LIMIT_EXCEEDED', 'Troppi tentativi di autenticazione');
  }
  console.error(`[Auth]    ✓ Rate limit OK`);

  // 3. Trova utente nel database
  console.error(`[Auth] ✅ Step 3: Ricerca utente nel database`);
  const user = await storage.findUserByEmail(envelope.userEmail);

  if (!user) {
    console.error(`[Auth] ❌ USER_NOT_FOUND: ${envelope.userEmail}`);
    storage.auditLog('AUTH_FAILED', {
      email: envelope.userEmail,
      reason: 'USER_NOT_FOUND'
    });
    throw new AuthError('USER_NOT_FOUND', 'Utente non trovato');
  }
  console.error(`[Auth]    ✓ Utente trovato: ${user.email}`);

  // 4. Verifica stato enabled
  console.error(`[Auth] ✅ Step 4: Verifica stato enabled`);
  if (!user.enabled) {
    console.error(`[Auth] ❌ USER_DISABLED`);
    storage.auditLog('AUTH_FAILED', {
      email: envelope.userEmail,
      reason: 'USER_DISABLED'
    });
    throw new AuthError('USER_DISABLED', 'Utente disabilitato');
  }
  console.error(`[Auth]    ✓ Utente abilitato`);

  // 5. Decifra chiave derivata utente con master key
  console.error(`[Auth] ✅ Step 5: Decifratura chiave derivata utente`);
  const masterKey = cryptoLib.loadMasterKey();
  let userKey;

  try {
    userKey = cryptoLib.decryptWithMasterKey(user.encryptedDerivedKey, masterKey);
    console.error(`[Auth]    ✓ Chiave utente decifrata (lunghezza: ${userKey.length} bytes)`);
  } catch (error) {
    console.error(`[Auth] ❌ KEY_DECRYPTION_FAILED:`, error.message);
    storage.auditLog('AUTH_ERROR', {
      email: envelope.userEmail,
      reason: 'KEY_DECRYPTION_FAILED',
      error: error.message
    });
    throw new AuthError('INTERNAL_ERROR', 'Errore decifratura chiave utente');
  }

  // 6. Verifica HMAC (protezione tampering)
  console.error(`[Auth] ✅ Step 6: Verifica HMAC`);
  const encPayloadBuffer = Buffer.from(envelope.encryptedPayload, 'base64');
  console.error(`[Auth]    Payload cifrato lunghezza: ${encPayloadBuffer.length} bytes`);

  const calculatedHmac = cryptoLib.calculateHMAC(encPayloadBuffer, userKey);
  console.error(`[Auth]    HMAC calcolato (server): ${calculatedHmac}`);
  console.error(`[Auth]    HMAC ricevuto (client):  ${envelope.hmac}`);
  console.error(`[Auth]    HMAC match: ${calculatedHmac === envelope.hmac}`);

  if (!cryptoLib.timingSafeEqual(Buffer.from(calculatedHmac), Buffer.from(envelope.hmac))) {
    console.error(`[Auth] ❌ INVALID_HMAC: HMAC non corrispondente`);
    storage.auditLog('AUTH_FAILED', {
      email: envelope.userEmail,
      reason: 'INVALID_HMAC'
    });
    throw new AuthError('INVALID_HMAC', 'Verifica HMAC fallita - dati manomessi');
  }

  // 7. Verifica timestamp (anti-replay)
  const now = Date.now();
  const maxAge = 5 * 60 * 1000;  // 5 minuti

  if (now - envelope.timestamp > maxAge) {
    storage.auditLog('AUTH_FAILED', {
      email: envelope.userEmail,
      reason: 'TIMESTAMP_EXPIRED',
      timestamp: envelope.timestamp,
      now
    });
    throw new AuthError('TIMESTAMP_EXPIRED', 'Timestamp troppo vecchio (max 5 minuti)');
  }

  // Timestamp nel futuro (clock skew sospetto)
  if (envelope.timestamp > now + 60000) {  // +1 minuto tolleranza
    storage.auditLog('AUTH_FAILED', {
      email: envelope.userEmail,
      reason: 'TIMESTAMP_FUTURE',
      timestamp: envelope.timestamp,
      now
    });
    throw new AuthError('INVALID_TIMESTAMP', 'Timestamp nel futuro');
  }

  // 8. Decifra e verifica challenge
  const iv = Buffer.from(envelope.iv, 'base64');
  const encChallenge = Buffer.from(envelope.encryptedChallenge, 'base64');

  let decryptedChallenge;
  try {
    decryptedChallenge = cryptoLib.decryptAES(encChallenge, userKey, iv).toString('utf8');
  } catch (error) {
    storage.auditLog('AUTH_FAILED', {
      email: envelope.userEmail,
      reason: 'CHALLENGE_DECRYPTION_FAILED'
    });
    throw new AuthError('INVALID_CHALLENGE', 'Decifratura challenge fallita - password errata');
  }

  // Verifica formato challenge: "${email}:${timestamp}"
  const expectedChallenge = `${envelope.userEmail}:${envelope.timestamp}`;

  if (!cryptoLib.timingSafeEqual(decryptedChallenge, expectedChallenge)) {
    storage.auditLog('AUTH_FAILED', {
      email: envelope.userEmail,
      reason: 'CHALLENGE_MISMATCH'
    });
    throw new AuthError('INVALID_CHALLENGE', 'Challenge non valido - autenticazione fallita');
  }

  // 9. Verifica replay attack
  if (isReplayAttack(decryptedChallenge)) {
    throw new AuthError('REPLAY_ATTACK', 'Replay attack rilevato');
  }

  // 10. Decifra payload email
  let emailData;
  try {
    const decryptedPayload = cryptoLib.decryptAES(encPayloadBuffer, userKey, iv);
    emailData = JSON.parse(decryptedPayload.toString('utf8'));
  } catch (error) {
    storage.auditLog('AUTH_ERROR', {
      email: envelope.userEmail,
      reason: 'PAYLOAD_DECRYPTION_FAILED',
      error: error.message
    });
    throw new AuthError('DECRYPTION_ERROR', 'Decifratura payload fallita');
  }

  // Autenticazione riuscita!
  storage.auditLog('AUTH_SUCCESS', {
    email: envelope.userEmail,
    emailId: emailData.id || 'unknown'
  });

  return { user, emailData, userKey };
}

/**
 * Rate limiting per utente
 * Max 10 tentativi in 15 minuti per email
 *
 * @param {string} email - Email utente
 * @returns {boolean} true se consentito, false se rate limit superato
 */
function checkUserRateLimit(email) {
  const key = email.toLowerCase();
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;  // 15 minuti
  const maxAttempts = 10;

  if (!userAttempts.has(key)) {
    userAttempts.set(key, [now]);
    return true;
  }

  const attempts = userAttempts.get(key);

  // Filtra solo tentativi recenti (ultimi 15 min)
  const recentAttempts = attempts.filter(t => now - t < windowMs);

  if (recentAttempts.length >= maxAttempts) {
    storage.auditLog('RATE_LIMIT_EXCEEDED', {
      email,
      attempts: recentAttempts.length,
      windowMs
    });
    return false;
  }

  // Aggiungi tentativo corrente
  recentAttempts.push(now);
  userAttempts.set(key, recentAttempts);

  return true;
}

/**
 * Verifica replay attack controllando se challenge già usato
 *
 * @param {string} challenge - Challenge da verificare
 * @returns {boolean} true se è replay attack
 */
function isReplayAttack(challenge) {
  if (usedChallenges.has(challenge)) {
    storage.auditLog('REPLAY_ATTACK_DETECTED', {
      challenge: challenge.substring(0, 50) + '...'
    });
    return true;
  }

  // Aggiungi a set challenge usati
  usedChallenges.add(challenge);

  // Auto-pulizia dopo 5 minuti (TTL)
  setTimeout(() => {
    usedChallenges.delete(challenge);
  }, 5 * 60 * 1000);

  return false;
}

/**
 * Reset rate limit per un utente (uso admin)
 *
 * @param {string} email - Email utente
 */
export function resetUserRateLimit(email) {
  const key = email.toLowerCase();
  userAttempts.delete(key);
  storage.auditLog('RATE_LIMIT_RESET', { email });
}

/**
 * Ottieni statistiche rate limiting
 *
 * @returns {Object} Statistiche
 */
export function getRateLimitStats() {
  const stats = {
    totalTrackedUsers: userAttempts.size,
    usedChallenges: usedChallenges.size,
    users: []
  };

  const now = Date.now();
  for (const [email, attempts] of userAttempts.entries()) {
    const recent = attempts.filter(t => now - t < 15 * 60 * 1000);
    if (recent.length > 0) {
      stats.users.push({
        email,
        recentAttempts: recent.length,
        oldestAttempt: new Date(Math.min(...recent)).toISOString()
      });
    }
  }

  return stats;
}

export default {
  authenticateAndDecrypt,
  resetUserRateLimit,
  getRateLimitStats,
  AuthError
};
