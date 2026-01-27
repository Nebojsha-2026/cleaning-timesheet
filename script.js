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
// SHIFT SCHEDULER FUNCTIONS
// ============================================

// Initialize shift buttons
function initializeShiftButtons() {
    document.getElementById('singleShiftBtn').addEventListener('click', function() {
        document.getElementById('singleShiftForm').style.display = 'block';
        document.getElementById('recurringShiftForm').style.display = 'none';
        this.style.background = '#667eea';
        this.style.color = 'white';
        document.getElementById('recurringShiftBtn').style.background = '#f8f9fa';
        document.getElementById('recurringShiftBtn').style.color = '#333';
    });
    
    document.getElementById('recurringShiftBtn').addEventListener('click', function() {
        document.getElementById('singleShiftForm').style.display = 'none';
        document.getElementById('recurringShiftForm').style.display = 'block';
        this.style.background = '#667eea';
        this.style.color = 'white';
        document.getElementById('singleShiftBtn').style.background = '#f8f9fa';
        document.getElementById('singleShiftBtn').style.color = '#333';
    });
}

// Toggle between single and recurring shift views
function toggleShiftView() {
    const singleShiftBtn = document.getElementById('singleShiftBtn');
    const recurringShiftBtn = document.getElementById('recurringShiftBtn');
    const singleForm = document.getElementById('singleShiftForm');
    const recurringForm = document.getElementById('recurringShiftForm');
    
    if (singleForm.style.display === 'none') {
        // Show single shift form
        singleForm.style.display = 'block';
        recurringForm.style.display = 'none';
        singleShiftBtn.style.background = '#667eea';
        singleShiftBtn.style.color = 'white';
        recurringShiftBtn.style.background = '#f8f9fa';
        recurringShiftBtn.style.color = '#333';
    } else {
        // Show recurring shift form
        singleForm.style.display = 'none';
        recurringForm.style.display = 'block';
        recurringShiftBtn.style.background = '#667eea';
        recurringShiftBtn.style.color = 'white';
        singleShiftBtn.style.background = '#f8f9fa';
        singleShiftBtn.style.color = '#333';
    }
}

// Handle recurrence pattern change
document.addEventListener('DOMContentLoaded', function() {
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
});

// Handle single shift submission
async function handleAddSingleShift(event) {
    event.preventDefault();
    
    const button = event.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
    
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scheduling...';
    button.disabled = true;
    
    try {
        const location = document.getElementById('shiftLocation').value.trim();
        const date = document.getElementById('shiftDate').value;
        const startTime = document.getElementById('shiftStartTime').value;
        const duration = parseFloat(document.getElementById('shiftDuration').value);
        const rate = parseFloat(document.getElementById('shiftRate').value);
        const notes = document.getElementById('shiftNotes').value.trim();
        const confirmed = document.getElementById('shiftConfirmed').checked;
        
        if (!location || !date || !startTime || !duration) {
            throw new Error('Please fill in all required fields');
        }
        
        // Create a shift object
        const shift = {
            location,
            date,
            start_time: startTime,
            duration,
            rate,
            notes,
            status: confirmed ? 'confirmed' : 'pending',
            type: 'single',
            created_at: new Date().toISOString()
        };
        
        // For now, just show success message
        // Later we'll save to database
        showMessage(`✅ Shift scheduled for ${formatDate(date)} at ${startTime}`, 'success');
        
        // Clear form
        document.getElementById('shiftLocation').value = '';
        document.getElementById('shiftNotes').value = '';
        document.getElementById('shiftConfirmed').checked = false;
        
    } catch (error) {
        console.error('❌ Shift scheduling error:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Handle recurring shift submission
async function handleAddRecurringShift(event) {
    event.preventDefault();
    
    const button = event.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
    
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scheduling...';
    button.disabled = true;
    
    try {
        const location = document.getElementById('recurringLocation').value.trim();
        const startDate = document.getElementById('recurringStartDate').value;
        const endDate = document.getElementById('recurringEndDate').value;
        const pattern = document.getElementById('recurrencePattern').value;
        const startTime = document.getElementById('recurringStartTime').value;
        const duration = parseFloat(document.getElementById('recurringDuration').value);
        const rate = parseFloat(document.getElementById('recurringRate').value);
        const notes = document.getElementById('recurringNotes').value.trim();
        
        if (!location || !startDate || !startTime || !duration) {
            throw new Error('Please fill in all required fields');
        }
        
        // Get selected days for custom pattern
        let selectedDays = [];
        if (pattern === 'custom') {
            for (let i = 0; i < 7; i++) {
                const checkbox = document.getElementById(`recDay${i}`);
                if (checkbox && checkbox.checked) {
                    selectedDays.push(i);
                }
            }
            if (selectedDays.length === 0) {
                throw new Error('Please select at least one day for custom schedule');
            }
        }
        
        // Create recurring shift pattern
        const recurringShift = {
            location,
            start_date: startDate,
            end_date: endDate || null,
            pattern,
            selected_days: selectedDays,
            start_time: startTime,
            duration,
            rate,
            notes,
            status: 'pending',
            type: 'recurring',
            created_at: new Date().toISOString()
        };
        
        // For now, just show success message
        // Later we'll save to database
        showMessage(`✅ Recurring shift scheduled starting ${formatDate(startDate)}`, 'success');
        
        // Clear form
        document.getElementById('recurringLocation').value = '';
        document.getElementById('recurringNotes').value = '';
        
    } catch (error) {
        console.error('❌ Recurring shift error:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
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
    showMessage('✅ Data refreshed!', 'success');
};

window.generateTimesheet = function() {
    document.getElementById('timesheetForm').scrollIntoView({ behavior: 'smooth' });
};

window.exportData = function() { alert('Export coming soon!'); };
window.showSettings = function() { alert('Settings coming soon!'); };
window.showHelp = function() { alert('Help coming soon!'); };

// Final log
console.log('🎉 Main script loaded');
