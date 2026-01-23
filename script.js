// Configuration
const CONFIG = {
    SUPABASE_URL: 'https://hqmtigcjyqckqdzepcdu.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw',
    DEFAULT_HOURLY_RATE: 23,
    CURRENCY: 'AUD',
    VERSION: '1.1.0'
};

// Modern Supabase client initialization (CDN/UMD style)
if (!window.supabase) {
    console.error('❌ Supabase global not found. Check your <script> tag for https://cdn.jsdelivr.net/npm/@supabase/supabase-js');
    throw new Error('Supabase not loaded');
}
const { createClient } = window.supabase;
const supabase = createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_KEY
);
console.log('✅ Supabase client initialized (modern way)');
console.log('🚀 Cleaning Timesheet App Starting...');
console.log('📡 Supabase URL:', CONFIG.SUPABASE_URL);

// Wait for all modules to load
let modulesLoaded = 0;
const totalModules = 4; // utils, entries, locations, timesheets

function checkModulesLoaded() {
    modulesLoaded++;
    if (modulesLoaded === totalModules) {
        console.log('✅ All modules loaded, initializing app...');
        initializeApp();
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM Ready');
    // Check if modules are already loaded (they might load before DOM)
    if (modulesLoaded === totalModules) {
        initializeApp();
    }
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
      
        // Setup form handlers - check if functions exist
        if (typeof handleAddEntry !== 'undefined') {
            document.getElementById('entryForm').addEventListener('submit', handleAddEntry);
        } else {
            console.error('❌ handleAddEntry not defined');
        }
        
        if (typeof handleGenerateTimesheet !== 'undefined') {
            document.getElementById('timesheetForm').addEventListener('submit', handleGenerateTimesheet);
        } else {
            console.error('❌ handleGenerateTimesheet not defined');
        }
      
        // Setup location input listener for auto-fill and rate field
        if (typeof handleLocationInput !== 'undefined') {
            document.getElementById('location').addEventListener('input', handleLocationInput);
            document.getElementById('location').addEventListener('change', handleLocationSelection);
        }
        
        // Setup email notification checkbox
        const emailCheckbox = document.getElementById('sendEmail');
        if (emailCheckbox && typeof handleEmailCheckbox !== 'undefined') {
            emailCheckbox.addEventListener('change', handleEmailCheckbox);
            // Initialize email field visibility
            handleEmailCheckbox({ target: emailCheckbox });
        }
      
        // Test connection
        const connected = await testConnection();
      
        if (connected) {
            console.log('✅ Connected to Supabase');
            updateConnectionStatus(true);
          
            // Show main interface
            document.getElementById('loadingScreen').style.display = 'none';
            document.querySelector('.container').style.display = 'block';
            console.log('✨ Dashboard ready');
          
            // Load data in background
            setTimeout(async () => {
                if (typeof loadStats !== 'undefined') await loadStats();
                if (typeof loadLocations !== 'undefined') await loadLocations();
                if (typeof loadRecentEntries !== 'undefined') await loadRecentEntries();
            }, 500);
          
        } else {
            console.error('❌ Database connection failed');
            showError('Cannot connect to database. Please try again later.');
        }
      
    } catch (error) {
        console.error('💥 Init error:', error);
        showError('Error loading app: ' + error.message);
    }
}

// Test database connection
async function testConnection() {
    try {
        console.log('🔌 Testing Supabase connection...');
        const { data, error } = await supabase.from('locations').select('count', { count: 'exact', head: true });
      
        if (error) throw error;
      
        console.log('✅ Database connection successful');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        return false;
    }
}

// Load statistics - this should be in entries.js, but keep fallback here
async function loadStats() {
    try {
        console.log('📊 Loading statistics...');
      
        const { count: totalEntries, error: entriesError } = await supabase
            .from('entries')
            .select('*', { count: 'exact', head: true });
      
        if (entriesError) throw entriesError;
      
        const { count: totalLocations, error: locationsError } = await supabase
            .from('locations')
            .select('*', { count: 'exact', head: true });
      
        if (locationsError) throw locationsError;
      
        const { count: totalTimesheets, error: timesheetsError } = await supabase
            .from('timesheets')
            .select('*', { count: 'exact', head: true });
      
        if (timesheetsError) throw timesheetsError;
      
        const { data: earningsData, error: earningsError } = await supabase
            .from('entries')
            .select(`
                hours,
                locations (hourly_rate)
            `);
      
        if (earningsError) throw earningsError;
      
        const totalEarnings = earningsData.reduce((sum, entry) => {
            const rate = entry.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE;
            return sum + (parseFloat(entry.hours) * rate);
        }, 0).toFixed(2);
      
        updateStatsDisplay({
            totalEntries: totalEntries || 0,
            totalLocations: totalLocations || 0,
            totalTimesheets: totalTimesheets || 0,
            totalEarnings: totalEarnings
        });
      
        console.log('✅ Statistics loaded');
      
    } catch (error) {
        console.error('❌ Error loading statistics:', error);
    }
}

// Update UI functions
function updateStatsDisplay(stats) {
    document.querySelectorAll('.stat-card')[0].innerHTML = `
        <div class="stat-icon"><i class="fas fa-list"></i></div>
        <div class="stat-info">
            <h3>Total Entries</h3>
            <div class="stat-value">${stats.totalEntries}</div>
        </div>
    `;
  
    document.querySelectorAll('.stat-card')[1].innerHTML = `
        <div class="stat-icon"><i class="fas fa-map-marker-alt"></i></div>
        <div class="stat-info">
            <h3>Locations</h3>
            <div class="stat-value">${stats.totalLocations}</div>
        </div>
    `;
  
    document.querySelectorAll('.stat-card')[2].innerHTML = `
        <div class="stat-icon"><i class="fas fa-file-invoice-dollar"></i></div>
        <div class="stat-info">
            <h3>Timesheets</h3>
            <div class="stat-value">${stats.totalTimesheets}</div>
        </div>
    `;
  
    document.querySelectorAll('.stat-card')[3].innerHTML = `
        <div class="stat-icon"><i class="fas fa-money-bill-wave"></i></div>
        <div class="stat-info">
            <h3>Total Earned</h3>
            <div class="stat-value">$${stats.totalEarnings}</div>
        </div>
    `;
  
    document.querySelectorAll('.stat-card').forEach(card => card.classList.remove('loading'));
}

// Action buttons placeholders
window.refreshData = async function() {
    console.log('🔄 Refreshing data...');
    showMessage('Refreshing data...', 'info');
    if (typeof loadStats !== 'undefined') await loadStats();
    if (typeof loadRecentEntries !== 'undefined') await loadRecentEntries();
    if (typeof loadLocations !== 'undefined') await loadLocations();
    showMessage('✅ Data refreshed!', 'success');
};

window.generateTimesheet = function() {
    document.getElementById('timesheetForm').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('startDate').focus();
};

window.exportData = function() { alert('Export coming soon!'); };
window.showSettings = function() { alert('Settings coming soon!'); };
window.showHelp = function() { alert('Help coming soon!'); };

// Final log
console.log('🎉 Main script loaded successfully');

// Signal that this module is loaded
if (typeof checkModulesLoaded !== 'undefined') {
    checkModulesLoaded();
}
