// Configuration
const CONFIG = {
    SUPABASE_URL: 'https://hqmtigcjyqckqdzepcdu.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw',
    DEFAULT_HOURLY_RATE: 23,
    CURRENCY: 'AUD',
    VERSION: '1.2.0'
};

// Global variables
let supabase;
let currentEntryMode = 'daily';
let selectedDaysOfWeek = [];
let selectedMonthDays = [];
let appLocations = [];

// Initialize App
document.addEventListener('DOMContentLoaded', async function() {
    console.log('✅ DOM Ready');
    
    // Modern Supabase client initialization
    if (!window.supabase) {
        console.error('❌ Supabase global not found.');
        throw new Error('Supabase not loaded');
    }
    
    const { createClient } = window.supabase;
    supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    window.supabaseClient = supabase;
    window.CONFIG = CONFIG;
    
    console.log('✅ Supabase client initialized');
    
    // Initialize the app
    await initializeApp();
});

async function initializeApp() {
    console.log('📱 Initializing app...');
  
    try {
        // Set today's date for shift scheduling
        const today = new Date();
        document.getElementById('currentDate').textContent = formatDate(today);

        // Set default dates for shift scheduler
        document.getElementById('shiftDate').value = today.toISOString().split('T')[0];
        document.getElementById('recurringStartDate').value = today.toISOString().split('T')[0];

        // Set timesheet dates (last week)
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        document.getElementById('startDate').value = lastWeek.toISOString().split('T')[0];
        document.getElementById('endDate').value = today.toISOString().split('T')[0];
      
        // Setup form handlers
        document.getElementById('singleShiftForm').addEventListener('submit', handleAddSingleShift);
        document.getElementById('recurringShiftForm').addEventListener('submit', handleAddRecurringShift);
        document.getElementById('timesheetForm').addEventListener('submit', handleGenerateTimesheet);

        // Setup location input listener
        document.getElementById('shiftLocation').addEventListener('input', handleLocationInput);
        document.getElementById('recurringLocation').addEventListener('input', handleLocationInput);
        
        // Setup email notification checkbox
        const emailCheckbox = document.getElementById('sendEmail');
        if (emailCheckbox) {
            emailCheckbox.addEventListener('change', handleEmailCheckbox);
            handleEmailCheckbox({ target: emailCheckbox });
        }
        
        // Setup timesheet period selector
        document.getElementById('timesheetPeriod').addEventListener('change', handleTimesheetPeriodChange);
        
        // Setup entry mode selector
        document.getElementById('entryMode').addEventListener('change', handleEntryModeChange);
        
        // Initialize entry mode UI
        initializeEntryModeUI();
        
        // Setup custom dates button
        document.getElementById('customDatesBtn').addEventListener('click', showCustomDatesPopup);

        // Initialize shift buttons
        initializeShiftButtons();
        
        // Setup recurrence pattern change listener
        const recurrencePattern = document.getElementById('recurrencePattern');
        if (recurrencePattern) {
            recurrencePattern.addEventListener('change', function() {
                const customDaysSection = document.getElementById('customDaysSection');
                if (this.value === 'custom') {
                    customDaysSection.style.display = 'block';
                } else {
                    customDaysSection.style.display = 'none';
                }
            });
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
                await loadStats();
                await loadLocations();
                await loadRecentEntries();
                await loadStaff(); // Load staff members
                await loadUpcomingShifts(); // Load upcoming shifts
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

// ============================================
// SHIFT BUTTON INITIALIZATION
// ============================================

function initializeShiftButtons() {
    const singleShiftBtn = document.getElementById('singleShiftBtn');
    const recurringShiftBtn = document.getElementById('recurringShiftBtn');
    
    if (singleShiftBtn && recurringShiftBtn) {
        singleShiftBtn.addEventListener('click', function() {
            document.getElementById('singleShiftForm').style.display = 'block';
            document.getElementById('recurringShiftForm').style.display = 'none';
            this.style.background = '#667eea';
            this.style.color = 'white';
            recurringShiftBtn.style.background = '#f8f9fa';
            recurringShiftBtn.style.color = '#333';
        });
        
        recurringShiftBtn.addEventListener('click', function() {
            document.getElementById('singleShiftForm').style.display = 'none';
            document.getElementById('recurringShiftForm').style.display = 'block';
            this.style.background = '#667eea';
            this.style.color = 'white';
            singleShiftBtn.style.background = '#f8f9fa';
            singleShiftBtn.style.color = '#333';
        });
    }
}

// ============================================
// ACTION BUTTONS
// ============================================

window.refreshData = async function() {
    console.log('🔄 Refreshing data...');
    showMessage('Refreshing data...', 'info');
    await loadStats();
    await loadRecentEntries();
    await loadLocations();
    await loadStaff();
    await loadUpcomingShifts();
    showMessage('✅ Data refreshed!', 'success');
};

window.generateTimesheet = function() {
    document.getElementById('timesheetForm').scrollIntoView({ behavior: 'smooth' });
};

window.exportData = function() { 
    alert('Export feature coming soon!'); 
};

window.showSettings = function() { 
    // Open settings modal
    const html = `
        <div class="modal-content">
            <h2>Settings</h2>
            <div style="margin-bottom: 20px;">
                <h3>Staff Management</h3>
                <button onclick="viewStaff()" class="btn" style="width: 100%; margin-bottom: 10px;">
                    <i class="fas fa-users"></i> Manage Staff
                </button>
            </div>
            <div style="margin-bottom: 20px;">
                <h3>Shift Management</h3>
                <button onclick="viewShiftCalendar()" class="btn" style="width: 100%; margin-bottom: 10px;">
                    <i class="fas fa-calendar-alt"></i> Shift Calendar
                </button>
            </div>
            <div>
                <button onclick="closeModal()" class="btn" style="width: 100%;">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        </div>
    `;
    showModal(html);
};

window.showHelp = function() { 
    alert('Help documentation coming soon!'); 
};

// Final log
console.log('🎉 Main script loaded');
