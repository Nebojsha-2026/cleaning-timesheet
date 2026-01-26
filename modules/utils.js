// Utility functions shared across modules

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format date for display
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return dateString;
    }
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

// Get start of fortnight (2 weeks from Monday)
function getStartOfFortnight(date = new Date()) {
    return getStartOfWeek(date);
}

// Get end of fortnight (2 weeks from Sunday)
function getEndOfFortnight(date = new Date()) {
    const start = getStartOfFortnight(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 13);
    return end;
}

// Show message to user
function showMessage(text, type = 'info') {
    let messageDiv = document.getElementById('formMessage');
    if (!messageDiv) {
        const form = document.getElementById('entryForm');
        if (form) {
            messageDiv = document.createElement('div');
            messageDiv.id = 'formMessage';
            form.parentNode.insertBefore(messageDiv, form.nextSibling);
        }
    }
    if (messageDiv) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        if (type === 'success' || type === 'info') {
            setTimeout(() => { messageDiv.style.display = 'none'; }, 5000);
        }
    }
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
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        return false;
    }
}

console.log('✅ Utils module loaded');
