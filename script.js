// Configuration
const CONFIG = {
    SUPABASE_URL: 'https://hqmtigcjyqckqdzepcdu.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw',
    HOURLY_RATE: 23,
    CURRENCY: 'AUD',
    VERSION: '1.0.0'
};

console.log('🚀 Cleaning Timesheet App Starting...');

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM Ready');
    initializeApp();
});

async function initializeApp() {
    console.log('📱 Initializing app...');
    
    try {
        // Set today's date
        const today = new Date();
        document.getElementById('date').value = today.toISOString().split('T')[0];
        document.getElementById('currentDate').textContent = formatDate(today);
        
        // Set timesheet dates (last week)
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        document.getElementById('startDate').value = lastWeek.toISOString().split('T')[0];
        document.getElementById('endDate').value = today.toISOString().split('T')[0];
        
        // Setup form handlers
        document.getElementById('entryForm').addEventListener('submit', handleAddEntry);
        document.getElementById('timesheetForm').addEventListener('submit', handleGenerateTimesheet);
        
        // Test connection
        const connected = await testConnection();
        
        if (connected) {
            console.log('✅ Connected to API');
            updateConnectionStatus(true);
            
            // Load initial data
            await loadStats();
            await loadRecentEntries();
            
            // Show main interface
            setTimeout(() => {
                document.getElementById('loadingScreen').style.display = 'none';
                document.querySelector('.container').style.display = 'block';
                console.log('✨ Dashboard ready');
            }, 1000);
            
        } else {
            console.error('❌ API connection failed');
            showError('Cannot connect to server. Please check your internet connection.');
        }
        
    } catch (error) {
        console.error('💥 Init error:', error);
        showError('Error loading app: ' + error.message);
    }
}

// API Functions
async function callAPI(params = {}) {
    try {
        params.apiKey = CONFIG.API_KEY;
        const url = `${CONFIG.API_URL}?${new URLSearchParams(params)}`;
        
        console.log('🌐 API Call:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

async function testConnection() {
    try {
        console.log('🔌 Testing connection...');
        const data = await callAPI({ path: 'test' });
        console.log('✅ Connection test:', data);
        return true;
    } catch (error) {
        console.error('❌ Connection failed:', error);
        return false;
    }
}

async function loadStats() {
    try {
        console.log('📊 Loading stats...');
        const data = await callAPI({ path: 'stats' });
        
        if (data.success && data.stats) {
            const stats = data.stats;
            
            // Update stat cards
            document.querySelectorAll('.stat-card')[0].innerHTML = `
                <div class="stat-icon"><i class="fas fa-list"></i></div>
                <div class="stat-info">
                    <h3>Total Entries</h3>
                    <div class="stat-value">${stats.totalEntries || 0}</div>
                </div>
            `;
            
            document.querySelectorAll('.stat-card')[1].innerHTML = `
                <div class="stat-icon"><i class="fas fa-map-marker-alt"></i></div>
                <div class="stat-info">
                    <h3>Locations</h3>
                    <div class="stat-value">${stats.totalLocations || 0}</div>
                </div>
            `;
            
            document.querySelectorAll('.stat-card')[2].innerHTML = `
                <div class="stat-icon"><i class="fas fa-file-invoice-dollar"></i></div>
                <div class="stat-info">
                    <h3>Timesheets</h3>
                    <div class="stat-value">${stats.totalTimesheets || 0}</div>
                </div>
            `;
            
            // Remove loading class
            document.querySelectorAll('.stat-card').forEach(card => {
                card.classList.remove('loading');
            });
            
            console.log('✅ Stats loaded');
        }
        
    } catch (error) {
        console.error('❌ Error loading stats:', error);
    }
}

async function loadRecentEntries() {
    try {
        console.log('📋 Loading entries...');
        const data = await callAPI({ 
            path: 'entries', 
            action: 'recent', 
            count: 5 
        });
        
        if (data.success && data.entries) {
            const entriesList = document.getElementById('entriesList');
            let html = '';
            
            data.entries.forEach(entry => {
                html += `
                    <div class="entry-item">
                        <div class="entry-info">
                            <h4>${entry.location || 'Unknown'}</h4>
                            <p>${formatDate(entry.date)}</p>
                        </div>
                        <div class="entry-stats">
                            <div class="entry-hours">${entry.hours} hrs</div>
                            <div class="entry-earnings">$${entry.earnings?.toFixed(2) || '0.00'}</div>
                        </div>
                    </div>
                `;
            });
            
            entriesList.innerHTML = html || '<p>No entries yet</p>';
            console.log('✅ Entries loaded:', data.entries.length);
        }
        
    } catch (error) {
        console.error('❌ Error loading entries:', error);
    }
}

// Form Handlers
async function handleAddEntry(event) {
    event.preventDefault();
    
    const button = event.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
    
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    button.disabled = true;
    
    try {
        const location = document.getElementById('location').value.trim();
        const hours = document.getElementById('hours').value;
        const date = document.getElementById('date').value;
        
        if (!location || !hours || !date) {
            throw new Error('Please fill all fields');
        }
        
        console.log('📝 Adding entry:', { location, hours, date });
        
        const result = await callAPI({
            path: 'entries',
            action: 'add',
            location: location,
            hours: hours,
            date: date
        });
        
        if (result.success) {
            showMessage('✅ Entry added successfully!', 'success');
            
            // Clear form
            document.getElementById('location').value = '';
            document.getElementById('notes').value = '';
            
            // Refresh data
            await loadStats();
            await loadRecentEntries();
            
        } else {
            throw new Error(result.error || 'Failed to add entry');
        }
        
    } catch (error) {
        console.error('❌ Add entry error:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

async function handleGenerateTimesheet(event) {
    event.preventDefault();
    
    const button = event.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
    
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    button.disabled = true;
    
    try {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const sendEmail = document.getElementById('sendEmail').checked;
        
        if (!startDate || !endDate) {
            throw new Error('Please select dates');
        }
        
        console.log('📄 Generating timesheet:', { startDate, endDate });
        
        const result = await callAPI({
            path: 'timesheets',
            action: 'generate',
            startDate: startDate,
            endDate: endDate,
            sendEmail: sendEmail
        });
        
        if (result.success) {
            showMessage(`✅ Timesheet ${result.refNumber} generated!`, 'success');
            await loadStats(); // Refresh stats
            
            // Show success modal
            alert(`Timesheet ${result.refNumber} generated successfully!\n\n` +
                  `Period: ${formatDate(startDate)} to ${formatDate(endDate)}\n` +
                  `Total Hours: ${result.totalHours}\n` +
                  `Total Earnings: $${result.totalEarnings}`);
                  
        } else {
            throw new Error(result.error || 'Failed to generate timesheet');
        }
        
    } catch (error) {
        console.error('❌ Timesheet error:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// UI Functions
function showMessage(text, type = 'info') {
    const messageDiv = document.getElementById('formMessage');
    if (!messageDiv) return;
    
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
}

function showError(message) {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div style="text-align: center; color: white; padding: 40px;">
                <div style="font-size: 4rem;">⚠️</div>
                <h2 style="margin: 20px 0;">Application Error</h2>
                <p style="font-size: 1.2rem; margin-bottom: 20px;">${message}</p>
                <button onclick="location.reload()" style="padding: 10px 20px; background: white; color: #667eea; border: none; border-radius: 5px; font-size: 1rem; cursor: pointer;">
                    Retry
                </button>
                <div style="margin-top: 20px; font-size: 0.9rem; opacity: 0.8;">
                    <p>Check console (F12) for details</p>
                </div>
            </div>
        `;
    }
}

function updateConnectionStatus(connected) {
    const statusDiv = document.getElementById('connectionStatus');
    if (!statusDiv) return;
    
    if (connected) {
        statusDiv.innerHTML = '<i class="fas fa-wifi"></i><span>Connected</span>';
        statusDiv.style.color = '#28a745';
    } else {
        statusDiv.innerHTML = '<i class="fas fa-wifi-slash"></i><span>Disconnected</span>';
        statusDiv.style.color = '#dc3545';
    }
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    } catch {
        return dateString;
    }
}

// Action Buttons
window.refreshData = function() {
    console.log('🔄 Refreshing data...');
    showMessage('Refreshing data...', 'info');
    loadStats();
    loadRecentEntries();
    setTimeout(() => showMessage('Data refreshed!', 'success'), 1000);
};

window.generateTimesheet = function() {
    document.getElementById('timesheetForm').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('startDate').focus();
};

window.exportData = function() {
    alert('Export feature coming soon!');
};


console.log('🎉 Script loaded successfully');
