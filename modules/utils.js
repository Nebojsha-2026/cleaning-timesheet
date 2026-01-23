// Utility functions shared across modules

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return dateString;
    }
}

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

function updateConnectionStatus(connected) {
    const statusDiv = document.getElementById('connectionStatus');
    if (statusDiv) {
        statusDiv.innerHTML = connected 
            ? '<i class="fas fa-database"></i><span>Connected</span>'
            : '<i class="fas fa-database"></i><span>Disconnected</span>';
        statusDiv.style.color = connected ? '#28a745' : '#dc3545';
    }
}

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
    // Remove any existing modal first
    closeModal();
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = content;
    
    // Add click outside to close
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    const modalsContainer = document.getElementById('modalsContainer');
    if (modalsContainer) {
        modalsContainer.appendChild(modal);
    } else {
        // Fallback: append to body
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

console.log('✅ Utils module loaded');
