// modules/utils.js
// Utility functions shared across modules (GLOBAL SAFE)

// Helper function to escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Format date for display (Australian style)
function formatDate(dateInput) {
  try {
    // Accept Date or yyyy-mm-dd strings
    if (dateInput instanceof Date) {
      return dateInput.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const s = String(dateInput || '');
    if (s.includes('-')) {
      const [y, m, d] = s.split('-');
      const dt = new Date(Number(y), Number(m) - 1, Number(d));
      return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return s;
    return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(dateInput || '');
  }
}

// Format time (e.g. 14:30 → 2:30 PM)
function formatTime(timeString) {
  if (!timeString) return '';
  const t = String(timeString).slice(0, 5);
  const [hours, minutes] = t.split(':');
  const hour = parseInt(hours, 10);
  if (Number.isNaN(hour)) return t;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

// Get start of week (Monday)
function getStartOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// Get end of week (Sunday)
function getEndOfWeek(date = new Date()) {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

// Get start of month
function getStartOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// Get end of month
function getEndOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// Show message to user (works on any page)
function showMessage(text, type = 'info') {
  const existing = document.getElementById('globalMessage');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = 'globalMessage';
  container.className = `message ${type}`;
  container.textContent = text;

  container.style.position = 'fixed';
  container.style.top = '20px';
  container.style.left = '50%';
  container.style.transform = 'translateX(-50%)';
  container.style.zIndex = '999999';
  container.style.padding = '12px 24px';
  container.style.borderRadius = '8px';
  container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  container.style.maxWidth = '90%';
  container.style.textAlign = 'center';
  container.style.fontWeight = '600';

  if (type === 'success') {
    container.style.background = '#d4edda';
    container.style.color = '#155724';
    container.style.border = '1px solid #c3e6cb';
  } else if (type === 'error') {
    container.style.background = '#f8d7da';
    container.style.color = '#721c24';
    container.style.border = '1px solid #f5c6cb';
  } else {
    container.style.background = '#fff3cd';
    container.style.color = '#856404';
    container.style.border = '1px solid #ffeeba';
  }

  document.body.appendChild(container);

  setTimeout(() => {
    container.style.opacity = '0';
    container.style.transition = 'opacity 0.5s';
    setTimeout(() => container.remove(), 500);
  }, 5000);
}

// Modal Helpers
function showModal(contentHtml) {
  window.closeModal();

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = contentHtml;

  modal.addEventListener('click', function (e) {
    if (e.target === modal) {
      window.closeModal();
    }
  });

  const modalsContainer = document.getElementById('modalsContainer');
  if (modalsContainer) modalsContainer.appendChild(modal);
  else document.body.appendChild(modal);
}

window.closeModal = function () {
  const modal = document.querySelector('.modal');
  if (modal) modal.remove();
};

// Email validation helper
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email || '').trim());
}

// Connection status helper
function updateConnectionStatus(connected) {
  const statusDiv = document.getElementById('connectionStatus');
  if (!statusDiv) return;

  statusDiv.innerHTML = connected
    ? '<i class="fas fa-wifi"></i><span>Connected</span>'
    : '<i class="fas fa-wifi"></i><span>Disconnected</span>';
  statusDiv.style.color = connected ? '#28a745' : '#dc3545';
}

// Show error screen
function showError(message) {
  const loadingScreen = document.getElementById('loadingScreen');
  if (!loadingScreen) return;

  loadingScreen.innerHTML = `
    <div style="text-align:center; color:white; padding:40px;">
      <div style="font-size:4rem;">❌</div>
      <h2 style="margin:20px 0;">Error</h2>
      <p style="font-size:1.1rem; margin-bottom:20px;">${escapeHtml(message)}</p>
      <button onclick="location.reload()" style="padding:10px 20px; background:white; color:#667eea; border:none; border-radius:8px; cursor:pointer;">
        Try Again
      </button>
    </div>
  `;
}

// OPTIONAL: simple DB ping
async function testConnection() {
  try {
    if (!window.supabaseClient) throw new Error('Supabase client not initialized');
    const { error } = await window.supabaseClient.from('locations').select('id', { head: true, count: 'exact' });
    if (error) throw error;
    updateConnectionStatus(true);
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    updateConnectionStatus(false);
    showError('Cannot connect to database: ' + (err.message || err));
    return false;
  }
}

/* ✅ IMPORTANT: expose helpers globally for non-module scripts and other modules */
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.getStartOfWeek = getStartOfWeek;
window.getEndOfWeek = getEndOfWeek;
window.getStartOfMonth = getStartOfMonth;
window.getEndOfMonth = getEndOfMonth;
window.showMessage = showMessage;
window.showModal = showModal;
window.validateEmail = validateEmail;
window.updateConnectionStatus = updateConnectionStatus;
window.showError = showError;
window.testConnection = testConnection;

console.log('✅ Utils module loaded (globals attached)');