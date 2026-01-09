/**
 * Admin UI Frontend - Logica applicazione
 *
 * Gestisce:
 * - Fetch dati utenti e statistiche
 * - Rendering tabella utenti
 * - Modal (aggiungi utente, password generata)
 * - Toast notifications
 * - Azioni CRUD utenti
 */

// ===========================================================================
// TOAST NOTIFICATIONS
// ===========================================================================

const ToastManager = {
  container: null,

  init() {
    this.container = document.getElementById('toast-container');
  },

  show(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    this.container.appendChild(toast);

    // Auto-remove dopo 4 secondi
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  success(message) {
    this.show(message, 'success');
  },

  error(message) {
    this.show(message, 'error');
  }
};

// ===========================================================================
// API CLIENT
// ===========================================================================

const API = {
  /**
   * Fetch con autenticazione Basic Auth
   */
  async request(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Errore HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  async getUsers() {
    return await this.request('/api/users');
  },

  async getStats() {
    return await this.request('/api/stats');
  },

  async createUser(email) {
    return await this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  async toggleUser(email) {
    return await this.request(`/api/users/${encodeURIComponent(email)}/toggle`, {
      method: 'PUT'
    });
  },

  async deleteUser(email) {
    return await this.request(`/api/users/${encodeURIComponent(email)}`, {
      method: 'DELETE'
    });
  }
};

// ===========================================================================
// UI MANAGER
// ===========================================================================

const UI = {
  /**
   * Carica e mostra statistiche
   */
  async loadStats() {
    try {
      const { stats } = await API.getStats();

      document.getElementById('stat-total').textContent = stats.totalUsers;
      document.getElementById('stat-active').textContent = stats.activeUsers;
      document.getElementById('stat-disabled').textContent = stats.disabledUsers;
      document.getElementById('stat-emails').textContent = stats.totalEmailsProcessed;
    } catch (error) {
      ToastManager.error('Errore caricamento statistiche');
      console.error(error);
    }
  },

  /**
   * Carica e mostra tabella utenti
   */
  async loadUsers() {
    try {
      const tbody = document.getElementById('users-tbody');
      tbody.innerHTML = '<tr><td colspan="6" class="loading">Caricamento...</td></tr>';

      const { users } = await API.getUsers();

      if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Nessun utente registrato</td></tr>';
        return;
      }

      tbody.innerHTML = users.map(user => `
        <tr>
          <td>${this.escapeHtml(user.email)}</td>
          <td>
            <span class="badge ${user.enabled ? 'badge-enabled' : 'badge-disabled'}">
              ${user.enabled ? '✅ Abilitato' : '❌ Disabilitato'}
            </span>
          </td>
          <td>${this.formatDate(user.createdAt)}</td>
          <td>${user.lastLogin ? this.formatDate(user.lastLogin) : '-'}</td>
          <td>${user.emailsSent || 0}</td>
          <td>
            <button
              class="btn btn-small btn-secondary"
              onclick="UI.toggleUser('${this.escapeHtml(user.email)}')"
            >
              ${user.enabled ? '🚫 Disabilita' : '✅ Abilita'}
            </button>
            <button
              class="btn btn-small btn-danger"
              onclick="UI.deleteUser('${this.escapeHtml(user.email)}')"
            >
              🗑️ Elimina
            </button>
          </td>
        </tr>
      `).join('');
    } catch (error) {
      ToastManager.error('Errore caricamento utenti');
      console.error(error);
    }
  },

  /**
   * Abilita/Disabilita utente
   */
  async toggleUser(email) {
    if (!confirm(`Sicuro di voler cambiare lo stato dell'utente ${email}?`)) {
      return;
    }

    try {
      const { message } = await API.toggleUser(email);
      ToastManager.success(message);
      await this.loadUsers();
      await this.loadStats();
    } catch (error) {
      ToastManager.error('Errore modifica utente: ' + error.message);
    }
  },

  /**
   * Elimina utente
   */
  async deleteUser(email) {
    if (!confirm(`⚠️ ATTENZIONE!\n\nSei sicuro di voler eliminare l'utente ${email}?\n\nQuesta azione è irreversibile!`)) {
      return;
    }

    try {
      const { message } = await API.deleteUser(email);
      ToastManager.success(message);
      await this.loadUsers();
      await this.loadStats();
    } catch (error) {
      ToastManager.error('Errore eliminazione utente: ' + error.message);
    }
  },

  /**
   * Mostra modal aggiungi utente
   */
  showAddUserModal() {
    const modal = document.getElementById('modal-add-user');
    modal.classList.add('active');
    document.getElementById('input-email').focus();
  },

  /**
   * Nascondi modal aggiungi utente
   */
  hideAddUserModal() {
    const modal = document.getElementById('modal-add-user');
    modal.classList.remove('active');
    document.getElementById('form-add-user').reset();
  },

  /**
   * Mostra modal password generata
   */
  showPasswordModal(email, password) {
    document.getElementById('created-email').textContent = email;
    document.getElementById('temp-password').textContent = password;

    const modal = document.getElementById('modal-password');
    modal.classList.add('active');
  },

  /**
   * Nascondi modal password
   */
  hidePasswordModal() {
    const modal = document.getElementById('modal-password');
    modal.classList.remove('active');
  },

  /**
   * Copia password negli appunti
   */
  async copyPassword() {
    const password = document.getElementById('temp-password').textContent;

    try {
      await navigator.clipboard.writeText(password);
      ToastManager.success('Password copiata negli appunti!');
    } catch (error) {
      ToastManager.error('Errore copia password');
    }
  },

  /**
   * Aggiorna tutto
   */
  async refresh() {
    await Promise.all([
      this.loadStats(),
      this.loadUsers()
    ]);
    ToastManager.success('Dati aggiornati');
  },

  /**
   * Utility: formatta data
   */
  formatDate(isoString) {
    if (!isoString) return '-';

    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Adesso';
    if (diffMins < 60) return `${diffMins} min fa`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} ore fa`;

    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  /**
   * Utility: escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// ===========================================================================
// EVENT HANDLERS
// ===========================================================================

document.getElementById('btn-add-user').addEventListener('click', () => {
  UI.showAddUserModal();
});

document.getElementById('btn-cancel-add').addEventListener('click', () => {
  UI.hideAddUserModal();
});

document.getElementById('btn-refresh').addEventListener('click', () => {
  UI.refresh();
});

document.getElementById('btn-close-password').addEventListener('click', () => {
  UI.hidePasswordModal();
});

document.getElementById('btn-copy-password').addEventListener('click', () => {
  UI.copyPassword();
});

// Form submit: aggiungi utente
document.getElementById('form-add-user').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('input-email').value.trim();

  if (!email || !email.includes('@')) {
    ToastManager.error('Inserisci un\'email valida');
    return;
  }

  try {
    const { user } = await API.createUser(email);

    UI.hideAddUserModal();
    UI.showPasswordModal(user.email, user.temporaryPassword);

    await UI.loadUsers();
    await UI.loadStats();
  } catch (error) {
    ToastManager.error('Errore creazione utente: ' + error.message);
  }
});

// Click fuori modal per chiudere
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

// ===========================================================================
// INIT
// ===========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Admin UI] Inizializzazione...');

  ToastManager.init();

  // Carica dati iniziali
  await UI.loadStats();
  await UI.loadUsers();

  console.log('[Admin UI] Pronto!');
});

// Auto-refresh ogni 30 secondi (solo stats)
setInterval(async () => {
  await UI.loadStats();
}, 30000);
