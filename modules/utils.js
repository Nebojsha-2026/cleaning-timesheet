// modules/utils.js
// Utility functions shared across modules

// Helper function to escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Format date for display (Australian style)
function formatDate(dateString) {
  try {
    if (dateString instanceof Date) {
      return dateString.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateString;
  }
}

// Format time (e.g. 14:30 → 2:30 PM)
function formatTime(timeString) {
  if (!timeString) return '';
  const [hours, minutes] = String(timeString).split(':');
  const hour = parseInt(hours, 10);
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

// Show message to user
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
  container.style.zIndex = '9999';
  container.style.padding = '12px 24px';
  container.style.borderRadius = '8px';
  container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  container.style.maxWidth = '90%';
  container.style.textAlign = 'center';
  container.style.fontWeight = '500';

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

// Modal helpers (FIXED)
function closeModal() {
  const modal = document.querySelector('.modal');
  if (modal) modal.remove();
}

function showModal(content) {
  closeModal();

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = content;

  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  const modalsContainer = document.getElementById('modalsContainer');
  if (modalsContainer) modalsContainer.appendChild(modal);
  else document.body.appendChild(modal);
}

// Email validation helper
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Export to window so every script can see them (CRITICAL)
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.formatTime = formatTime;

window.getStartOfWeek = getStartOfWeek;
window.getEndOfWeek = getEndOfWeek;
window.getStartOfMonth = getStartOfMonth;
window.getEndOfMonth = getEndOfMonth;

window.showMessage = showMessage;
window.showModal = showModal;
window.closeModal = closeModal;

window.validateEmail = validateEmail;

console.log('✅ Utils module loaded');
