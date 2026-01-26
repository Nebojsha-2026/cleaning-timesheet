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
        document.getElementById('entryForm').addEventListener('submit', handleAddEntry);
        document.getElementById('timesheetForm').addEventListener('submit', handleGenerateTimesheet);
      
        // Setup location input listener
        document.getElementById('location').addEventListener('input', handleLocationInput);
        document.getElementById('location').addEventListener('change', handleLocationSelection);
        
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

// Final log
console.log('🎉 Main script loaded');

