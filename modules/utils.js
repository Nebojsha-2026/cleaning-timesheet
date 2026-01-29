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
        const date = new Date(dateString);
        return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return dateString;
    }
}

// Format time (e.g. 14:30 → 2:30 PM)
function formatTime(timeString) {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
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

// Show message to user (improved version - works on any page)
function showMessage(text, type = 'info') {
    // Remove any existing message first to avoid stacking
    const existing = document.getElementById('globalMessage');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'globalMessage';
    container.className = `message ${type}`;
    container.textContent = text;

    // Styling
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

    // Colors based on type
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

    // Auto-remove after 5 seconds
    setTimeout(() => {
        container.style.opacity = '0';
        container.style.transition = 'opacity 0.5s';
        setTimeout(() => container.remove(), 500);
    }, 5000);
}

// Update connection status display
function updateConnectionStatus(connected) {
    const statusDiv = document.getElementById('connectionStatus');
    if (statusDiv) {
        statusDiv.innerHTML = connected 
            ? '<i class="fas fa-database"></i><span>Connected</span>'
            : '<i class="fas fa-database"></i><span>Disconnected</span>';
        statusDiv.style.color = connected ? '#28a745' : '#dc3545';
    }
}

// Show error screen
function showError(message) {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div style="text-align:center; color:white; padding:40px;">
                <div style="font-size:4rem;">❌</div>
                <h2 style="margin:20px 0;">Database Error</h2>
                <p style="font-size:1.2rem; margin-bottom:20px;">${message}</p>
                <button onclick="location.reload()" style="padding:10px 20px; background:white; color:#667eea; border:none; border-radius:5px; cursor:pointer;">
                    Try Again
                </button>
            </div>
        `;
    }
}

// Modal Helpers
function showModal(content) {
    closeModal();
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = content;
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    const modalsContainer = document.getElementById('modalsContainer');
    if (modalsContainer) {
        modalsContainer.appendChild(modal);
    } else {
        document.body.appendChild(modal);
    }
}

window.closeModal = function() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
};

// Email validation helper
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Test database connection
async function testConnection() {
    try {
        console.log('🔌 Testing Supabase connection...');
        const { data, error } = await window.supabaseClient.from('locations').select('count', { count: 'exact', head: true });
      
        if (error) throw error;
      
        console.log('✅ Database connection successful');
        updateConnectionStatus(true);
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        updateConnectionStatus(false);
        showError('Cannot connect to database: ' + error.message);
        return false;
    }
}
// --- Ensure utilities are globally accessible (needed by script.js and other modules) ---
window.showMessage = window.showMessage || showMessage;
window.showModal   = window.showModal   || showModal;
window.closeModal  = window.closeModal  || closeModal;

// Optional (handy elsewhere)
window.escapeHtml  = window.escapeHtml  || escapeHtml;

console.log('✅ Utils module loaded');
