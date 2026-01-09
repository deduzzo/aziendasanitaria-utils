/**
 * API Routes - Gestione utenti MCP Zimbra
 *
 * Endpoint REST per Admin UI:
 * - GET /api/users - Lista utenti
 * - POST /api/users - Crea utente
 * - PUT /api/users/:email/toggle - Abilita/disabilita
 * - DELETE /api/users/:email - Elimina utente
 * - GET /api/stats - Statistiche globali
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import storage from '../../lib/storage.js';
import * as cryptoLib from '../../lib/crypto.js';

const router = express.Router();

/**
 * GET /api/users
 * Lista tutti gli utenti con statistiche
 */
router.get('/users', async (req, res) => {
  try {
    const data = await storage.loadUsers();

    // Rimuovi dati sensibili (passwordHash, encryptedDerivedKey)
    const users = data.users.map(u => ({
      email: u.email,
      enabled: u.enabled,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin,
      emailsSent: u.emailsSent || 0
    }));

    res.json({
      success: true,
      users,
      total: users.length
    });
  } catch (error) {
    console.error('[Admin API] Errore GET /users:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/users
 * Crea nuovo utente con password temporanea generata
 *
 * Body: { email }
 */
router.post('/users', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Email non valida'
      });
    }

    // Genera password temporanea sicura
    const temporaryPassword = cryptoLib.generateSecurePassword(16);

    // Crea utente
    const user = await storage.addUser(email, temporaryPassword);

    res.json({
      success: true,
      user: {
        email: user.email,
        temporaryPassword,
        enabled: user.enabled,
        createdAt: user.createdAt
      },
      message: 'Utente creato. Comunicare la password temporanea all\'utente in modo sicuro.'
    });
  } catch (error) {
    if (error.message === 'USER_ALREADY_EXISTS') {
      return res.status(409).json({
        success: false,
        error: 'Utente già esistente'
      });
    }

    console.error('[Admin API] Errore POST /users:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/users/:email/toggle
 * Abilita/disabilita utente
 */
router.put('/users/:email/toggle', async (req, res) => {
  try {
    const { email } = req.params;

    const user = await storage.findUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    // Toggle enabled
    const updatedUser = await storage.updateUser(email, {
      enabled: !user.enabled
    });

    storage.auditLog('USER_TOGGLED', {
      email,
      enabled: updatedUser.enabled,
      by: 'admin'
    });

    res.json({
      success: true,
      user: {
        email: updatedUser.email,
        enabled: updatedUser.enabled
      },
      message: `Utente ${updatedUser.enabled ? 'abilitato' : 'disabilitato'}`
    });
  } catch (error) {
    console.error('[Admin API] Errore PUT /users/:email/toggle:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/users/:email
 * Elimina utente
 */
router.delete('/users/:email', async (req, res) => {
  try {
    const { email } = req.params;

    await storage.deleteUser(email);

    res.json({
      success: true,
      message: `Utente ${email} eliminato`
    });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    console.error('[Admin API] Errore DELETE /users/:email:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/stats
 * Statistiche globali sistema
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await storage.getGlobalStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[Admin API] Errore GET /stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
