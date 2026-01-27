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
        const shiftDateInput = document.getElementById('shiftDate');
        const recurringStartDateInput = document.getElementById('recurringStartDate');
        
        if (shiftDateInput) shiftDateInput.value = today.toISOString().split('T')[0];
        if (recurringStartDateInput) recurringStartDateInput.value = today.toISOString().split('T')[0];

        // Set timesheet dates (last week)
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        if (startDateInput) startDateInput.value = lastWeek.toISOString().split('T')[0];
        if (endDateInput) endDateInput.value = today.toISOString().split('T')[0];
      
        // Setup form handlers - ONLY IF ELEMENTS EXIST
        const singleShiftForm = document.getElementById('singleShiftForm');
        const recurringShiftForm = document.getElementById('recurringShiftForm');
        const timesheetForm = document.getElementById('timesheetForm');
        
        console.log('Checking forms:', {
            singleShiftForm: !!singleShiftForm,
            recurringShiftForm: !!recurringShiftForm,
            timesheetForm: !!timesheetForm
        });
        
        if (singleShiftForm) {
            console.log('✅ Adding listener to singleShiftForm');
            singleShiftForm.addEventListener('submit', handleAddSingleShift);
        }
        
        if (recurringShiftForm) {
            console.log('✅ Adding listener to recurringShiftForm');
            recurringShiftForm.addEventListener('submit', handleAddRecurringShift);
        }
        
        if (timesheetForm) {
            console.log('✅ Adding listener to timesheetForm');
            timesheetForm.addEventListener('submit', handleGenerateTimesheet);
        }

        // Initialize shift buttons
        if (typeof initializeShiftButtons === 'function') {
            initializeShiftButtons();
        }
        
        // Setup recurrence pattern change listener
        const recurrencePattern = document.getElementById('recurrencePattern');
        if (recurrencePattern) {
            recurrencePattern.addEventListener('change', function() {
                const customDaysSection = document.getElementById('customDaysSection');
                if (this.value === 'custom' && customDaysSection) {
                    customDaysSection.style.display = 'block';
                } else if (customDaysSection) {
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
                
                // Load employee shifts (instead of staff management)
                try {
                    await loadMyShifts(); // This is the employee shift loading function
                } catch (error) {
                    console.log('⚠️ Could not load shifts:', error.message);
                    // If function doesn't exist yet, it's OK - we'll add it in shifts.js
                }
                
                // Also try to load staff for reference (optional)
                try {
                    await loadStaff();
                } catch (error) {
                    console.log('⚠️ Could not load staff (tables may not exist yet):', error.message);
                }
                
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



