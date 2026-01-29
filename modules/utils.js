// modules/utils.js
console.log('🧰 Utils module loading...');

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
    const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(dateInput || '');
  }
}

// Format time for display
function formatTime(timeString) {
  if (!timeString) return '';
  const t = String(timeString).slice(0, 5);
  const [hh, mm] = t.split(':');
  const hour = parseInt(hh || '0', 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${mm || '00'} ${ampm}`;
}

// Global toast message
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

  // Basic colors
  if (type === 'success') container.style.background = '#d4edda';
  else if (type === 'error') container.style.background = '#f8d7da';
  else container.style.background = '#d1ecf1';

  document.body.appendChild(container);

  setTimeout(() => {
    if (container && container.parentNode) container.remove();
  }, 3500);
}

// Proper closeModal (module-safe)
function closeModal() {
  const modal = document.querySelector('.modal');
  if (modal) modal.remove();
}

// Modal system
function showModal(contentHtml) {
  // close any existing modal first
  closeModal();

  const modal = document.createElement('div');
  modal.className = 'modal';

  // Allow passing either a full modal-content wrapper OR just inner html
  const isAlreadyWrapped = String(contentHtml || '').includes('modal-content');
  modal.innerHTML = isAlreadyWrapped ? contentHtml : `<div class="modal-content">${contentHtml}</div>`;

  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  // Optional container (if you add one later)
  const modalsContainer = document.getElementById('modalsContainer');
  if (modalsContainer) modalsContainer.appendChild(modal);
  else document.body.appendChild(modal);
}

// Email validation helper
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email || '').trim());
}

// Connection status UI helper (safe if elements missing)
function updateConnectionStatus(isConnected) {
  const statusDiv = document.getElementById('connectionStatus');
  if (statusDiv) {
    statusDiv.innerHTML = isConnected
      ? '<i class="fas fa-wifi"></i><span>Connected</span>'
      : '<i class="fas fa-wifi"></i><span>Disconnected</span>';
    statusDiv.style.color = isConnected ? '#28a745' : '#dc3545';
  }

  const apiStatus = document.getElementById('apiStatus');
  if (apiStatus) {
    apiStatus.textContent = isConnected ? 'Connected' : 'Disconnected';
    apiStatus.style.color = isConnected ? '#28a745' : '#dc3545';
  }

  const lastUpdated = document.getElementById('lastUpdated');
  if (lastUpdated) lastUpdated.textContent = new Date().toLocaleTimeString();
}

// Test database connection (expects window.supabaseClient already exists)
async function testConnection() {
  try {
    console.log('🔌 Testing Supabase connection...');
    if (!window.supabaseClient) throw new Error('Supabase client not initialized');

    const { error } = await window.supabaseClient
      .from('locations')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;

    console.log('✅ Database connection successful');
    updateConnectionStatus(true);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    updateConnectionStatus(false);
    showMessage('Cannot connect to database: ' + (error?.message || error), 'error');
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* ✅ Export to window (CRITICAL because script.js is NOT a module)     */
/* ------------------------------------------------------------------ */
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.showMessage = showMessage;
window.showModal = showModal;
window.closeModal = closeModal;
window.validateEmail = validateEmail;
window.updateConnectionStatus = updateConnectionStatus;
window.testConnection = testConnection;

console.log('✅ Utils module loaded');
