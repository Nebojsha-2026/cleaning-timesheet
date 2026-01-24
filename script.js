// Configuration
const CONFIG = {
    SUPABASE_URL: 'https://hqmtigcjyqckqdzepcdu.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw',
    DEFAULT_HOURLY_RATE: 23,
    CURRENCY: 'AUD',
    VERSION: '1.2.0'
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

// Global variables for entry mode
let currentEntryMode = 'daily';
let selectedDaysOfWeek = [];
let selectedMonthDays = [];

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
      
        // Setup location input listener for auto-fill and rate field
        document.getElementById('location').addEventListener('input', handleLocationInput);
        document.getElementById('location').addEventListener('change', handleLocationSelection);
        
        // Setup email notification checkbox
        const emailCheckbox = document.getElementById('sendEmail');
        if (emailCheckbox) {
            emailCheckbox.addEventListener('change', handleEmailCheckbox);
            // Initialize email field visibility
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

// ───────────────────────────────────────────────
//   UTILITY FUNCTIONS
// ───────────────────────────────────────────────

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

// Get start of week (Monday)
function getStartOfWeek(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
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
    end.setDate(start.getDate() + 13); // 14 days inclusive
    return end;
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

// ───────────────────────────────────────────────
//   NEW: TIMESHEET PERIOD SELECTION
// ───────────────────────────────────────────────

function handleTimesheetPeriodChange(event) {
    const period = event.target.value;
    const customDatesDiv = document.getElementById('customDatesSection');
    const autoDatesDiv = document.getElementById('autoDatesSection');
    const today = new Date();
    
    if (period === 'custom') {
        customDatesDiv.style.display = 'block';
        autoDatesDiv.style.display = 'none';
    } else {
        customDatesDiv.style.display = 'none';
        autoDatesDiv.style.display = 'block';
        
        let startDate, endDate;
        
        switch(period) {
            case 'weekly':
                startDate = getStartOfWeek(today);
                endDate = getEndOfWeek(today);
                break;
            case 'fortnightly':
                startDate = getStartOfFortnight(today);
                endDate = getEndOfFortnight(today);
                break;
            case 'monthly':
                startDate = getStartOfMonth(today);
                endDate = getEndOfMonth(today);
                break;
            default:
                // Default to last week
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 7);
                endDate = today;
        }
        
        document.getElementById('autoStartDate').textContent = formatDate(startDate);
        document.getElementById('autoEndDate').textContent = formatDate(endDate);
        
        // Store the dates for form submission
        document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
        document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
    }
}

function showCustomDatesPopup() {
    const html = `
        <div class="modal-content">
            <h2>Select Custom Dates</h2>
            <form id="customDatesForm">
                <div class="form-group">
                    <label for="customStartDate">Start Date</label>
                    <input type="date" id="customStartDate" required>
                </div>
                <div class="form-group">
                    <label for="customEndDate">End Date</label>
                    <input type="date" id="customEndDate" required>
                </div>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button type="submit" class="btn btn-primary" style="flex:1;">
                        <i class="fas fa-check"></i> Apply Dates
                    </button>
                    <button type="button" class="btn cancel-btn" style="flex:1; background:#6c757d; color:white;">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    
    showModal(html);
    
    // Set today's date as default
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    
    document.getElementById('customStartDate').value = lastWeek.toISOString().split('T')[0];
    document.getElementById('customEndDate').value = today.toISOString().split('T')[0];
    
    document.getElementById('customDatesForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const startDate = document.getElementById('customStartDate').value;
        const endDate = document.getElementById('customEndDate').value;
        
        // Update the main form
        document.getElementById('startDate').value = startDate;
        document.getElementById('endDate').value = endDate;
        
        // Update display
        document.getElementById('autoStartDate').textContent = formatDate(startDate);
        document.getElementById('autoEndDate').textContent = formatDate(endDate);
        
        closeModal();
        showMessage('✅ Custom dates applied!', 'success');
    });
    
    document.querySelector('.cancel-btn').addEventListener('click', closeModal);
}

// ───────────────────────────────────────────────
//   NEW: ENTRY MODE SELECTION
// ───────────────────────────────────────────────

function initializeEntryModeUI() {
    // Set up daily mode by default
    handleEntryModeChange({ target: { value: 'daily' } });
}

function handleEntryModeChange(event) {
    const mode = event.target.value;
    currentEntryMode = mode;
    
    // Hide all mode sections
    document.getElementById('dailyEntrySection').style.display = 'none';
    document.getElementById('weeklyEntrySection').style.display = 'none';
    document.getElementById('monthlyEntrySection').style.display = 'none';
    
    // Show selected mode section
    switch(mode) {
        case 'daily':
            document.getElementById('dailyEntrySection').style.display = 'block';
            break;
        case 'weekly':
            document.getElementById('weeklyEntrySection').style.display = 'block';
            generateWeekDaySelection();
            break;
        case 'monthly':
            document.getElementById('monthlyEntrySection').style.display = 'block';
            generateMonthSelection();
            break;
    }
}

function generateWeekDaySelection() {
    const container = document.getElementById('weekDaysContainer');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    let html = '<div class="days-selection">';
    days.forEach((day, index) => {
        html += `
            <div class="day-selector" data-day="${index}">
                <input type="checkbox" id="day${index}" class="day-checkbox">
                <label for="day${index}" class="day-label">${day}</label>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
    
    // Add event listeners
    document.querySelectorAll('.day-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const dayIndex = parseInt(this.closest('.day-selector').getAttribute('data-day'));
            if (this.checked) {
                if (!selectedDaysOfWeek.includes(dayIndex)) {
                    selectedDaysOfWeek.push(dayIndex);
                }
            } else {
                selectedDaysOfWeek = selectedDaysOfWeek.filter(d => d !== dayIndex);
            }
            updateWeeklyHoursDisplay();
        });
    });
    
    // Initialize selected days (empty)
    selectedDaysOfWeek = [];
    updateWeeklyHoursDisplay();
}

function updateWeeklyHoursDisplay() {
    const container = document.getElementById('weeklyHoursContainer');
    
    if (selectedDaysOfWeek.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Select days above to enter hours</p>';
        return;
    }
    
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    let html = '<div class="weekly-hours-grid">';
    
    selectedDaysOfWeek.forEach(dayIndex => {
        html += `
            <div class="form-group">
                <label for="hoursDay${dayIndex}">${days[dayIndex]} Hours</label>
                <input type="number" id="hoursDay${dayIndex}" class="weekly-hour-input" min="0.5" max="24" step="0.5" value="2.0" required>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function generateMonthSelection() {
    const container = document.getElementById('monthSelectionContainer');
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    let html = '<div class="form-group">';
    html += '<label for="selectedMonth">Select Month</label>';
    html += '<select id="selectedMonth" class="month-selector">';
    
    const today = new Date();
    const currentYear = today.getFullYear();
    
    for (let i = 0; i < 12; i++) {
        const monthIndex = (today.getMonth() + i) % 12;
        const year = currentYear + Math.floor((today.getMonth() + i) / 12);
        html += `<option value="${year}-${monthIndex + 1}">${months[monthIndex]} ${year}</option>`;
    }
    
    html += '</select>';
    html += '</div>';
    html += '<div id="monthDaysContainer" style="margin-top: 15px;"></div>';
    
    container.innerHTML = html;
    
    // Add event listener for month change
    document.getElementById('selectedMonth').addEventListener('change', generateMonthDays);
    
    // Generate initial month days
    generateMonthDays();
}

function generateMonthDays() {
    const container = document.getElementById('monthDaysContainer');
    const selectedMonth = document.getElementById('selectedMonth').value;
    const [year, month] = selectedMonth.split('-').map(Number);
    
    // Get number of days in month
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Get day of week for first day of month (0 = Sunday, 1 = Monday, etc.)
    const firstDay = new Date(year, month - 1, 1).getDay();
    // Convert to Monday-based week (0 = Monday)
    const firstDayMondayBased = firstDay === 0 ? 6 : firstDay - 1;
    
    let html = '<div class="month-calendar">';
    html += '<div class="month-header">';
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    days.forEach(day => {
        html += `<div class="month-day-header">${day}</div>`;
    });
    html += '</div>';
    
    html += '<div class="month-days-grid">';
    
    // Add empty cells for days before the first day of month
    for (let i = 0; i < firstDayMondayBased; i++) {
        html += '<div class="month-day-empty"></div>';
    }
    
    // Add day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const dayOfWeek = (firstDayMondayBased + day - 1) % 7;
        html += `
            <div class="month-day-selector ${dayOfWeek >= 5 ? 'weekend' : ''}" data-day="${day}">
                <input type="checkbox" id="monthDay${day}" class="month-day-checkbox">
                <label for="monthDay${day}" class="month-day-label">${day}</label>
            </div>
        `;
    }
    
    html += '</div></div>';
    
    container.innerHTML = html;
    
    // Add event listeners for day checkboxes
    document.querySelectorAll('.month-day-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const day = parseInt(this.closest('.month-day-selector').getAttribute('data-day'));
            if (this.checked) {
                if (!selectedMonthDays.includes(day)) {
                    selectedMonthDays.push(day);
                }
            } else {
                selectedMonthDays = selectedMonthDays.filter(d => d !== day);
            }
            updateMonthlyHoursDisplay(year, month);
        });
    });
    
    // Initialize selected days (empty)
    selectedMonthDays = [];
    updateMonthlyHoursDisplay(year, month);
}

function updateMonthlyHoursDisplay(year, month) {
    const container = document.getElementById('monthlyHoursContainer');
    
    if (selectedMonthDays.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Select days above to enter hours</p>';
        return;
    }
    
    let html = '<div class="monthly-hours-section">';
    html += '<h4 style="margin-bottom: 15px;">Hours for Selected Days</h4>';
    html += '<div class="monthly-hours-grid">';
    
    selectedMonthDays.sort((a, b) => a - b).forEach(day => {
        const date = new Date(year, month - 1, day);
        const dayName = date.toLocaleDateString('en-AU', { weekday: 'short' });
        
        html += `
            <div class="form-group">
                <label for="hoursMonthDay${day}">${dayName} ${day}/${month}/${year}</label>
                <input type="number" id="hoursMonthDay${day}" class="monthly-hour-input" min="0.5" max="24" step="0.5" value="2.0" required>
            </div>
        `;
    });
    
    html += '</div></div>';
    container.innerHTML = html;
}

// ───────────────────────────────────────────────
//   UPDATED: HANDLE ADD ENTRY (with new modes)
// ───────────────────────────────────────────────

async function handleAddEntry(event) {
    event.preventDefault();
  
    const button = event.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
  
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    button.disabled = true;
  
    try {
        const locationName = document.getElementById('location').value.trim();
        const notes = document.getElementById('notes').value.trim();
        const rate = parseFloat(document.getElementById('rate').value) || CONFIG.DEFAULT_HOURLY_RATE;
        
        if (!locationName) throw new Error('Please enter a location');
        
        console.log('📝 Adding entry in mode:', currentEntryMode);
        
        let locationId = await findOrCreateLocation(locationName, 2.0, rate);
        let entriesToAdd = [];
        
        switch(currentEntryMode) {
            case 'daily':
                const hours = parseFloat(document.getElementById('hours').value);
                const date = document.getElementById('date').value;
                
                if (!hours || !date) throw new Error('Please fill in all required fields');
                if (hours <= 0 || hours > 24) throw new Error('Hours must be between 0.5 and 24');
                
                entriesToAdd.push({
                    location_id: locationId,
                    hours,
                    work_date: date,
                    notes
                });
                break;
                
            case 'weekly':
                if (selectedDaysOfWeek.length === 0) {
                    throw new Error('Please select at least one day of the week');
                }
                
                const weekDate = document.getElementById('weekDate').value;
                if (!weekDate) throw new Error('Please select a week start date');
                
                const weekStart = new Date(weekDate);
                
                selectedDaysOfWeek.forEach(dayIndex => {
                    const dayDate = new Date(weekStart);
                    dayDate.setDate(weekStart.getDate() + dayIndex);
                    
                    const dayHours = parseFloat(document.getElementById(`hoursDay${dayIndex}`).value);
                    if (dayHours <= 0 || dayHours > 24) {
                        throw new Error(`Hours for day ${dayIndex + 1} must be between 0.5 and 24`);
                    }
                    
                    entriesToAdd.push({
                        location_id: locationId,
                        hours: dayHours,
                        work_date: dayDate.toISOString().split('T')[0],
                        notes
                    });
                });
                break;
                
            case 'monthly':
                if (selectedMonthDays.length === 0) {
                    throw new Error('Please select at least one day of the month');
                }
                
                const selectedMonth = document.getElementById('selectedMonth').value;
                const [year, month] = selectedMonth.split('-').map(Number);
                
                selectedMonthDays.forEach(day => {
                    const dayHours = parseFloat(document.getElementById(`hoursMonthDay${day}`).value);
                    if (dayHours <= 0 || dayHours > 24) {
                        throw new Error(`Hours for day ${day} must be between 0.5 and 24`);
                    }
                    
                    entriesToAdd.push({
                        location_id: locationId,
                        hours: dayHours,
                        work_date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
                        notes
                    });
                });
                break;
        }
        
        if (entriesToAdd.length === 0) {
            throw new Error('No entries to add');
        }
        
        console.log('📝 Adding entries:', entriesToAdd);
      
        const { data, error } = await supabase
            .from('entries')
            .insert(entriesToAdd)
            .select();
      
        if (error) throw error;
      
        showMessage(`✅ ${entriesToAdd.length} entry(ies) added successfully!`, 'success');
      
        // Clear form
        document.getElementById('location').value = '';
        document.getElementById('notes').value = '';
        document.getElementById('rateGroup').style.display = 'none';
        
        if (currentEntryMode === 'daily') {
            document.getElementById('hours').value = '2.0';
        } else if (currentEntryMode === 'weekly') {
            selectedDaysOfWeek = [];
            updateWeeklyHoursDisplay();
        } else if (currentEntryMode === 'monthly') {
            selectedMonthDays = [];
            updateMonthlyHoursDisplay();
        }
      
        await loadStats();
        await loadRecentEntries();
        await loadLocations();
      
    } catch (error) {
        console.error('❌ Add entry error:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// ───────────────────────────────────────────────
//   TEST CONNECTION
// ───────────────────────────────────────────────

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

// ───────────────────────────────────────────────
//   STATISTICS
// ───────────────────────────────────────────────

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

// ───────────────────────────────────────────────
//   LOCATIONS
// ───────────────────────────────────────────────

// Load locations for dropdown
async function loadLocations() {
    try {
        console.log('📍 Loading locations...');
      
        const { data: locations, error } = await supabase
            .from('locations')
            .select('*')
            .eq('is_active', true)
            .order('name');
      
        if (error) throw error;
      
        const datalist = document.getElementById('locationList') || createLocationDatalist();
      
        if (locations && locations.length > 0) {
            datalist.innerHTML = locations.map(location =>
                `<option value="${location.name}">${location.name} (${location.default_hours} hrs - $${location.hourly_rate}/hr)</option>`
            ).join('');
          
            window.appLocations = locations;
        }
      
        console.log('✅ Locations loaded:', locations?.length || 0);
      
    } catch (error) {
        console.error('❌ Error loading locations:', error);
    }
}

function createLocationDatalist() {
    const input = document.getElementById('location');
    const datalist = document.createElement('datalist');
    datalist.id = 'locationList';
    input.setAttribute('list', 'locationList');
    document.body.appendChild(datalist);
    return datalist;
}

// Handle location input to show/hide rate field
async function handleLocationInput(event) {
    const locationName = event.target.value.trim();
    const rateGroup = document.getElementById('rateGroup');
    const rateInput = document.getElementById('rate');
  
    if (!locationName) {
        rateGroup.style.display = 'none';
        return;
    }
  
    // Check if location exists
    const { data: existing, error } = await supabase
        .from('locations')
        .select('id, hourly_rate')
        .eq('name', locationName)
        .eq('is_active', true)
        .single();
  
    if (error && error.code !== 'PGRST116') console.error(error);
  
    if (existing) {
        rateGroup.style.display = 'none';
    } else {
        rateGroup.style.display = 'block';
        rateInput.value = ''; // Clear for new
    }
}

// Handle location selection from dropdown to auto-fill hours
async function handleLocationSelection(event) {
    const locationName = event.target.value.trim();
    
    if (!locationName) return;
    
    // Try to find the location in our loaded locations
    if (window.appLocations) {
        const location = window.appLocations.find(loc => loc.name === locationName);
        
        if (location) {
            // Auto-fill the hours field with the location's default hours
            if (currentEntryMode === 'daily') {
                document.getElementById('hours').value = location.default_hours;
            }
            
            // Also hide the rate group since this is an existing location
            document.getElementById('rateGroup').style.display = 'none';
        }
    }
}

// Handle email checkbox change
function handleEmailCheckbox(event) {
    // First check if emailGroup already exists
    let emailGroup = document.getElementById('emailGroup');
    
    if (!emailGroup) {
        // Create email group if it doesn't exist
        const checkbox = event.target;
        const formGroup = checkbox.closest('.form-group');
        
        const emailHtml = `
            <div class="form-group" id="emailGroup" style="display: none;">
                <label for="emailAddress"><i class="fas fa-envelope"></i> Email Address</label>
                <input type="email" id="emailAddress" placeholder="your@email.com">
            </div>
        `;
        
        formGroup.insertAdjacentHTML('afterend', emailHtml);
        emailGroup = document.getElementById('emailGroup');
    }
    
    // Show/hide based on checkbox state
    emailGroup.style.display = event.target.checked ? 'block' : 'none';
    
    // Clear email field when unchecked
    if (!event.target.checked) {
        const emailInput = document.getElementById('emailAddress');
        if (emailInput) {
            emailInput.value = '';
        }
    }
}

async function findOrCreateLocation(name, defaultHours = 2.0, hourlyRate = CONFIG.DEFAULT_HOURLY_RATE) {
    try {
        const { data: existing, error: findError } = await supabase
            .from('locations')
            .select('id')
            .eq('name', name)
            .eq('is_active', true)
            .limit(1);
      
        if (findError) throw findError;
        if (existing?.length > 0) return existing[0].id;
      
        const { data: newLoc, error: createError } = await supabase
            .from('locations')
            .insert([{ name, default_hours: defaultHours, hourly_rate: hourlyRate, is_active: true }])
            .select()
            .single();
      
        if (createError) throw createError;
      
        await loadLocations();
        return newLoc.id;
      
    } catch (error) {
        console.error('❌ Location error:', error);
        throw new Error('Could not find or create location');
    }
}

// ───────────────────────────────────────────────
//   ENTRIES
// ───────────────────────────────────────────────

// Load recent entries
async function loadRecentEntries() {
    try {
        console.log('📋 Loading recent entries...');
      
        const { data: entries, error } = await supabase
            .from('entries')
            .select(`
                *,
                locations (name, hourly_rate)
            `)
            .order('created_at', { ascending: false })
            .limit(10);
      
        if (error) throw error;
      
        updateEntriesDisplay(entries);
        console.log('✅ Entries loaded:', entries?.length || 0);
      
    } catch (error) {
        console.error('❌ Error loading entries:', error);
    }
}

function updateEntriesDisplay(entries) {
    const entriesList = document.getElementById('entriesList');
  
    if (!entries || entries.length === 0) {
        entriesList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <p>No entries yet. Add your first entry above!</p>
            </div>
        `;
        return;
    }
  
    let html = '';
    entries.forEach(entry => {
        const locationName = entry.locations?.name || 'Unknown Location';
        const rate = entry.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE;
        const earnings = (entry.hours * rate).toFixed(2);
        const notes = entry.notes ? entry.notes.replace(/'/g, "\\'") : '';
      
        html += `
            <div class="entry-item" data-entry-id="${entry.id}">
                <div class="entry-info">
                    <h4>${escapeHtml(locationName)}</h4>
                    <p>${formatDate(entry.work_date)} • ${escapeHtml(notes)}</p>
                </div>
                <div class="entry-stats">
                    <div class="entry-hours">${entry.hours} hrs @ $${rate}</div>
                    <div class="entry-earnings">$${earnings}</div>
                </div>
                <div class="entry-actions">
                    <button class="btn-icon edit-entry" data-id="${entry.id}" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon delete-entry" data-id="${entry.id}" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    });
  
    entriesList.innerHTML = html;
    
    // Add event listeners to the buttons
    setTimeout(() => {
        document.querySelectorAll('.edit-entry').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                editEntry(id);
            });
        });
        
        document.querySelectorAll('.delete-entry').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                deleteEntry(id);
            });
        });
    }, 100);
}

// ───────────────────────────────────────────────
//   EDIT & DELETE ENTRIES (Remaining functions)
// ───────────────────────────────────────────────

window.editEntry = async function(id) {
    console.log("Edit clicked for entry ID:", id);

    try {
        const { data: entry, error } = await supabase
            .from('entries')
            .select(`
                *,
                locations (id, name, hourly_rate)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        // Escape values for HTML
        const locationName = escapeHtml(entry.locations.name);
        const hourlyRate = entry.locations.hourly_rate;
        const hours = entry.hours;
        const workDate = entry.work_date;
        const notes = entry.notes ? escapeHtml(entry.notes) : '';

        const html = `
            <div class="modal-content">
                <h2>Edit Entry</h2>
                <form id="editEntryForm">
                    <div class="form-group">
                        <label for="editLocationName">Location Name</label>
                        <input type="text" id="editLocationName" value="${locationName}" required>
                    </div>
                    <div class="form-group">
                        <label for="editRate">Hourly Rate ($)</label>
                        <input type="number" id="editRate" value="${hourlyRate}" step="0.01" min="1" required>
                    </div>
                    <div class="form-group">
                        <label for="editHours">Hours</label>
                        <input type="number" id="editHours" value="${hours}" step="0.5" min="0.5" max="24" required>
                    </div>
                    <div class="form-group">
                        <label for="editDate">Date</label>
                        <input type="date" id="editDate" value="${workDate}" required>
                    </div>
                    <div class="form-group">
                        <label for="editNotes">Notes (optional)</label>
                        <textarea id="editNotes" rows="2">${notes}</textarea>
                    </div>
                    <div style="margin-top:20px; display:flex; gap:10px;">
                        <button type="submit" class="btn btn-primary" style="flex:1;">
                            <i class="fas fa-save"></i> Save Changes
                        </button>
                        <button type="button" class="btn cancel-btn" style="flex:1; background:#6c757d; color:white;">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                </form>
            </div>
        `;

        showModal(html);
        
        // Add event listeners
        document.getElementById('editEntryForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const newLocName = document.getElementById('editLocationName').value.trim();
            const newRate = parseFloat(document.getElementById('editRate').value);
            const newHours = parseFloat(document.getElementById('editHours').value);
            const newDate = document.getElementById('editDate').value;
            const newNotes = document.getElementById('editNotes').value.trim();

            // Update entry
            const { error: entryErr } = await supabase
                .from('entries')
                .update({ hours: newHours, work_date: newDate, notes: newNotes })
                .eq('id', id);

            if (entryErr) throw entryErr;

            // Update location (name + rate)
            const { error: locErr } = await supabase
                .from('locations')
                .update({ name: newLocName, hourly_rate: newRate })
                .eq('id', entry.locations.id);

            if (locErr) throw locErr;

            closeModal();
            showMessage('✅ Entry & location updated!', 'success');
            await loadStats();
            await loadRecentEntries();
            await loadLocations(); // refresh dropdown if name changed
        });
        
        // Add cancel button listener
        document.querySelector('.cancel-btn').addEventListener('click', closeModal);
        
    } catch (error) {
        console.error("Edit entry error:", error);
        showMessage('❌ Error: ' + error.message, 'error');
    }
};

window.deleteEntry = function(id) {
    console.log("Delete clicked for entry ID:", id);

    // Store the ID in a data attribute on the modal itself
    const html = `
        <div class="modal-content" data-entry-id="${id}">
            <h2>Confirm Delete</h2>
            <p style="margin:15px 0;">Are you sure you want to delete this entry?</p>
            <p style="color:#dc3545; font-weight:bold;">This cannot be undone.</p>
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button class="btn btn-primary confirm-delete-btn" style="flex:1; background:#dc3545; border:none;">
                    <i class="fas fa-trash"></i> Yes, Delete
                </button>
                <button class="btn cancel-btn" style="flex:1;">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `;

    showModal(html);
    
    // Add event listeners after modal is shown
    setTimeout(() => {
        const modalContent = document.querySelector('.modal-content');
        const entryId = modalContent.getAttribute('data-entry-id');
        
        document.querySelector('.confirm-delete-btn').addEventListener('click', async function() {
            console.log("Confirming delete for ID:", entryId);
            
            try {
                const { error } = await supabase
                    .from('entries')
                    .delete()
                    .eq('id', entryId);

                if (error) throw error;

                closeModal();
                showMessage('✅ Entry deleted successfully!', 'success');
                await loadStats();
                await loadRecentEntries();
            } catch (error) {
                console.error("Delete error:", error);
                showMessage('❌ Error deleting entry: ' + error.message, 'error');
            }
        });
        
        document.querySelector('.cancel-btn').addEventListener('click', closeModal);
    }, 100);
};

// ───────────────────────────────────────────────
//   TIMESHEETS (Remaining functions - same as before)
// ───────────────────────────────────────────────

// Generate Timesheet
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
        const emailAddress = sendEmail ? document.getElementById('emailAddress')?.value.trim() : null;
      
        if (!startDate || !endDate) throw new Error('Please select start and end dates');
        if (sendEmail && (!emailAddress || !validateEmail(emailAddress))) {
            throw new Error('Please enter a valid email address');
        }
      
        const { data: entries, error: entriesError } = await supabase
            .from('entries')
            .select(`
                *,
                locations (name, hourly_rate)
            `)
            .gte('work_date', startDate)
            .lte('work_date', endDate)
            .order('work_date', { ascending: true });
      
        if (entriesError) throw entriesError;
        if (!entries?.length) throw new Error('No entries found for selected period');
      
        const totalHours = entries.reduce((sum, e) => sum + parseFloat(e.hours), 0);
        const totalEarnings = entries.reduce((sum, e) => {
            const rate = e.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE;
            return sum + (parseFloat(e.hours) * rate);
        }, 0).toFixed(2);
      
        const refNumber = 'TS' + new Date().getTime().toString().slice(-6);
      
        // Prepare insert data - only include email fields if sending email
        const insertData = {
            ref_number: refNumber, 
            start_date: startDate, 
            end_date: endDate, 
            total_hours: totalHours, 
            total_earnings: totalEarnings
        };
        
        if (sendEmail) {
            insertData.email_sent = true;
            insertData.email_address = emailAddress;
        }
      
        const { data: timesheet, error: tsError } = await supabase
            .from('timesheets')
            .insert([insertData])
            .select()
            .single();
      
        if (tsError) throw tsError;
      
        // Prepare timesheet details for display/email
        const timesheetDetails = {
            refNumber,
            startDate,
            endDate,
            totalHours: totalHours.toFixed(2),
            totalEarnings,
            entriesCount: entries.length,
            entries: entries.map(entry => ({
                date: formatDate(entry.work_date),
                location: entry.locations?.name || 'Unknown',
                hours: entry.hours,
                rate: entry.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE,
                earnings: (entry.hours * (entry.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE)).toFixed(2),
                notes: entry.notes || ''
            }))
        };
      
        showMessage(`✅ Timesheet ${refNumber} generated!`, 'success');
        await loadStats();
      
        // Show timesheet details
        viewTimesheetDetails(timesheetDetails);
      
        // Send email if requested
        if (sendEmail && emailAddress) {
            await sendTimesheetEmail(timesheetDetails, emailAddress);
        }
      
    } catch (error) {
        console.error('❌ Timesheet error:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Send timesheet email - IMPROVED VERSION
async function sendTimesheetEmail(timesheetDetails, emailAddress) {
    try {
        console.log('📧 Sending timesheet to:', emailAddress);
        
        // Create a beautiful email template
        const emailContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
                    .summary { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                    .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
                    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    th { background: #667eea; color: white; padding: 10px; text-align: left; }
                    td { padding: 8px 10px; border-bottom: 1px solid #ddd; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Cleaning Timesheet</h1>
                        <p>Reference: ${timesheetDetails.refNumber}</p>
                    </div>
                    <div class="content">
                        <h2>Timesheet Summary</h2>
                        <div class="summary">
                            <p><strong>Period:</strong> ${formatDate(timesheetDetails.startDate)} to ${formatDate(timesheetDetails.endDate)}</p>
                            <p><strong>Total Hours:</strong> ${timesheetDetails.totalHours} hrs</p>
                            <p><strong>Total Earnings:</strong> $${timesheetDetails.totalEarnings} AUD</p>
                            <p><strong>Number of Entries:</strong> ${timesheetDetails.entriesCount}</p>
                        </div>
                        
                        <h3>Detailed Entries</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Location</th>
                                    <th>Hours</th>
                                    <th>Rate</th>
                                    <th>Earnings</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${timesheetDetails.entries.map(entry => `
                                    <tr>
                                        <td>${entry.date}</td>
                                        <td>${entry.location}</td>
                                        <td>${entry.hours}</td>
                                        <td>$${entry.rate}/hr</td>
                                        <td>$${entry.earnings}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr style="font-weight: bold; background: #f0f0f0;">
                                    <td colspan="2">TOTALS</td>
                                    <td>${timesheetDetails.totalHours}</td>
                                    <td></td>
                                    <td>$${timesheetDetails.totalEarnings}</td>
                                </tr>
                            </tfoot>
                        </table>
                        
                        <p>You can also view and print this timesheet directly from the Cleaning Timesheet Manager app.</p>
                        
                        <div class="footer">
                            <p>This timesheet was generated automatically by Cleaning Timesheet Manager.</p>
                            <p>If you have any questions, please contact us.</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        // For now, we'll simulate email sending and show a preview
        const emailWindow = window.open('', '_blank');
        emailWindow.document.write(emailContent);
        emailWindow.document.close();
        
        // Show success message
        setTimeout(() => {
            showMessage(`📧 Timesheet email preview opened in new tab. In production, this would be sent to ${emailAddress}`, 'success');
        }, 500);
        
        return true;
    } catch (error) {
        console.error('❌ Email error:', error);
        showMessage('⚠️ Could not send email (feature in development)', 'info');
        return false;
    }
}

// View timesheet details - FIXED VERSION
function viewTimesheetDetails(timesheetDetails) {
    let entriesHtml = '';
    timesheetDetails.entries.forEach(entry => {
        entriesHtml += `
            <div style="padding: 10px 0; border-bottom: 1px solid #eee;">
                <div style="display: flex; justify-content: space-between;">
                    <div>
                        <strong>${entry.date}</strong> • ${entry.location}
                        ${entry.notes ? `<br><small>${escapeHtml(entry.notes)}</small>` : ''}
                    </div>
                    <div style="text-align: right;">
                        ${entry.hours} hrs @ $${entry.rate}/hr<br>
                        <strong>$${entry.earnings}</strong>
                    </div>
                </div>
            </div>
        `;
    });
  
    // Create a unique ID for the print button to avoid issues
    const printBtnId = 'printBtn_' + Date.now();
    
    const html = `
        <div class="modal-content">
            <h2>Timesheet ${timesheetDetails.refNumber}</h2>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <div>
                        <strong>Period:</strong><br>
                        ${formatDate(timesheetDetails.startDate)} to ${formatDate(timesheetDetails.endDate)}
                    </div>
                    <div style="text-align: right;">
                        <strong>Total Hours:</strong><br>
                        ${timesheetDetails.totalHours} hrs
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <div>
                        <strong>Total Earnings:</strong><br>
                        $${timesheetDetails.totalEarnings}
                    </div>
                    <div style="text-align: right;">
                        <strong>Entries:</strong><br>
                        ${timesheetDetails.entriesCount}
                    </div>
                </div>
            </div>
            
            <h3>Entries</h3>
            <div style="max-height: 300px; overflow-y: auto; margin-bottom: 20px;">
                ${entriesHtml}
            </div>
            
            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <button id="${printBtnId}" class="btn btn-primary" style="flex:1;">
                    <i class="fas fa-print"></i> Print/Export
                </button>
                <button onclick="closeModal()" class="btn" style="flex:1;">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        </div>
    `;
  
    showModal(html);
    
    // Add event listener after modal is shown
    setTimeout(() => {
        document.getElementById(printBtnId).addEventListener('click', function() {
            printTimesheet(timesheetDetails.refNumber, timesheetDetails);
        });
    }, 100);
}

// Print timesheet - FIXED VERSION
window.printTimesheet = function(refNumber, timesheetDetails) {
    console.log("Printing timesheet:", refNumber);
    
    // Parse the timesheetDetails if it's a string
    if (typeof timesheetDetails === 'string') {
        try {
            timesheetDetails = JSON.parse(timesheetDetails);
        } catch (e) {
            console.error("Failed to parse timesheetDetails:", e);
            showMessage('❌ Error: Could not parse timesheet data', 'error');
            return;
        }
    }
    
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
        showMessage('❌ Please allow pop-ups to print the timesheet', 'error');
        return;
    }
    
    // Calculate subtotals by location
    const locationTotals = {};
    timesheetDetails.entries.forEach(entry => {
        if (!locationTotals[entry.location]) {
            locationTotals[entry.location] = {
                hours: 0,
                earnings: 0
            };
        }
        locationTotals[entry.location].hours += parseFloat(entry.hours);
        locationTotals[entry.location].earnings += parseFloat(entry.earnings);
    });
    
    // Create location summary HTML
    let locationSummaryHtml = '';
    Object.keys(locationTotals).forEach(location => {
        locationSummaryHtml += `
            <tr>
                <td>${escapeHtml(location)}</td>
                <td>${locationTotals[location].hours.toFixed(2)}</td>
                <td>$${locationTotals[location].earnings.toFixed(2)}</td>
            </tr>
        `;
    });
    
    // Create entries table HTML
    let entriesTableHtml = '';
    timesheetDetails.entries.forEach(entry => {
        entriesTableHtml += `
            <tr>
                <td>${entry.date}</td>
                <td>${escapeHtml(entry.location)}</td>
                <td>${entry.hours}</td>
                <td>$${entry.rate}/hr</td>
                <td>$${entry.earnings}</td>
                <td>${escapeHtml(entry.notes || '')}</td>
            </tr>
        `;
    });
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Timesheet ${refNumber} - Cleaning Services</title>
            <style>
                /* Reset and base styles */
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Arial', 'Helvetica', sans-serif; 
                    line-height: 1.6; 
                    color: #333;
                    background: #fff;
                    padding: 20px;
                    max-width: 1000px;
                    margin: 0 auto;
                }
                
                /* Header */
                .header { 
                    border-bottom: 3px solid #667eea;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                
                .company-info h1 { 
                    color: #667eea; 
                    font-size: 28px;
                    margin-bottom: 5px;
                }
                
                .company-info p { 
                    color: #666; 
                    font-size: 14px;
                    margin-bottom: 3px;
                }
                
                .timesheet-info {
                    text-align: right;
                }
                
                .timesheet-info h2 {
                    font-size: 24px;
                    color: #333;
                    margin-bottom: 10px;
                }
                
                .timesheet-meta {
                    font-size: 14px;
                    color: #666;
                }
                
                /* Summary Section */
                .summary-section {
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    padding: 25px;
                    border-radius: 10px;
                    margin-bottom: 30px;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.08);
                }
                
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-top: 15px;
                }
                
                .summary-item {
                    text-align: center;
                    padding: 15px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                }
                
                .summary-item h3 {
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                
                .summary-item .value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #667eea;
                }
                
                .summary-item .value.earnings {
                    color: #28a745;
                }
                
                /* Tables */
                .section-title {
                    font-size: 18px;
                    color: #333;
                    margin: 25px 0 15px 0;
                    padding-bottom: 8px;
                    border-bottom: 2px solid #667eea;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 15px 0 30px 0;
                    font-size: 14px;
                }
                
                table th {
                    background: #667eea;
                    color: white;
                    padding: 12px 15px;
                    text-align: left;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                table td {
                    padding: 12px 15px;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                table tr:hover {
                    background-color: #f8f9fa;
                }
                
                table tr:last-child td {
                    border-bottom: 2px solid #667eea;
                }
                
                /* Total row */
                .total-row {
                    font-weight: bold;
                    background-color: #f8f9fa;
                }
                
                .total-row td {
                    border-top: 2px solid #667eea;
                }
                
                /* Footer */
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    text-align: center;
                    color: #666;
                    font-size: 12px;
                }
                
                /* Print-specific styles */
                @media print {
                    body { padding: 0; }
                    .no-print { display: none !important; }
                    .header { border-bottom: 2px solid #000; }
                    .summary-section { 
                        box-shadow: none; 
                        border: 1px solid #ddd;
                    }
                    table th { 
                        background: #f0f0f0 !important; 
                        color: #000 !important;
                        -webkit-print-color-adjust: exact;
                    }
                    .summary-item { 
                        box-shadow: none; 
                        border: 1px solid #ddd;
                    }
                }
                
                /* Notes section */
                .notes {
                    margin-top: 30px;
                    padding: 15px;
                    background: #fff8e1;
                    border-radius: 8px;
                    border-left: 4px solid #ffc107;
                }
                
                .notes h4 {
                    color: #333;
                    margin-bottom: 10px;
                }
                
                .notes ul {
                    margin-left: 20px;
                }
                
                .notes li {
                    margin-bottom: 5px;
                }
                
                /* Print buttons */
                .print-buttons {
                    text-align: center;
                    margin: 20px 0;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
            </style>
        </head>
        <body>
            <!-- Header -->
            <div class="header">
                <div class="company-info">
                    <h1>Cleaning Timesheet</h1>
                    <p>Professional Cleaning Services</p>
                    <p>Timesheet ID: ${refNumber}</p>
                    <p>Generated: ${formatDate(new Date())}</p>
                </div>
                <div class="timesheet-info">
                    <h2>INVOICE</h2>
                    <div class="timesheet-meta">
                        <p><strong>Period:</strong> ${formatDate(timesheetDetails.startDate)} to ${formatDate(timesheetDetails.endDate)}</p>
                        <p><strong>Status:</strong> Generated</p>
                    </div>
                </div>
            </div>
            
            <!-- Summary Section -->
            <div class="summary-section">
                <h2 style="color: #333; margin-bottom: 15px;">Summary</h2>
                <div class="summary-grid">
                    <div class="summary-item">
                        <h3>Total Hours</h3>
                        <div class="value">${timesheetDetails.totalHours} hrs</div>
                    </div>
                    <div class="summary-item">
                        <h3>Total Earnings</h3>
                        <div class="value earnings">$${timesheetDetails.totalEarnings}</div>
                    </div>
                    <div class="summary-item">
                        <h3>Number of Entries</h3>
                        <div class="value">${timesheetDetails.entriesCount}</div>
                    </div>
                    <div class="summary-item">
                        <h3>Average per Entry</h3>
                        <div class="value">$${(parseFloat(timesheetDetails.totalEarnings) / timesheetDetails.entriesCount).toFixed(2)}</div>
                    </div>
                </div>
            </div>
            
            <!-- Location Summary -->
            <h3 class="section-title">Summary by Location</h3>
            <table>
                <thead>
                    <tr>
                        <th>Location</th>
                        <th>Total Hours</th>
                        <th>Total Earnings</th>
                    </tr>
                </thead>
                <tbody>
                    ${locationSummaryHtml}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td><strong>GRAND TOTAL</strong></td>
                        <td><strong>${timesheetDetails.totalHours} hrs</strong></td>
                        <td><strong>$${timesheetDetails.totalEarnings}</strong></td>
                    </tr>
                </tfoot>
            </table>
            
            <!-- Detailed Entries -->
            <h3 class="section-title">Detailed Entries</h3>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Location</th>
                        <th>Hours</th>
                        <th>Rate</th>
                        <th>Earnings</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    ${entriesTableHtml}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td colspan="2"><strong>TOTALS</strong></td>
                        <td><strong>${timesheetDetails.totalHours}</strong></td>
                        <td></td>
                        <td><strong>$${timesheetDetails.totalEarnings}</strong></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
            
            <!-- Notes -->
            <div class="notes">
                <h4>Notes & Terms</h4>
                <ul>
                    <li>This timesheet covers work completed during the specified period</li>
                    <li>All amounts are in ${CONFIG.CURRENCY}</li>
                    <li>Hourly rate: $${CONFIG.DEFAULT_HOURLY_RATE}/hr (standard)</li>
                    <li>Please contact for any discrepancies within 7 days</li>
                    <li>Payment due within 14 days of receipt</li>
                </ul>
            </div>
            
            <!-- Print Buttons -->
            <div class="print-buttons no-print">
                <button onclick="window.print()" style="padding: 12px 30px; background: #667eea; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin: 10px;">
                    <i class="fas fa-print"></i> Print Timesheet
                </button>
                <button onclick="window.close()" style="padding: 12px 30px; background: #6c757d; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin: 10px;">
                    <i class="fas fa-times"></i> Close Window
                </button>
                <button onclick="saveAsPDF()" style="padding: 12px 30px; background: #28a745; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin: 10px;">
                    <i class="fas fa-download"></i> Save as PDF
                </button>
            </div>
            
            <!-- Footer -->
            <div class="footer">
                <p>Generated by Cleaning Timesheet Manager • ${formatDate(new Date())}</p>
                <p>Thank you for your business!</p>
            </div>
            
            <script>
                function saveAsPDF() {
                    alert('To save as PDF, use the "Print" option and choose "Save as PDF" as your printer.');
                }
                
                // Add page break for printing
                const style = document.createElement('style');
                style.innerHTML = \`
                    @media print {
                        .summary-section, table { break-inside: avoid; }
                        h3.section-title { margin-top: 20px; }
                        .print-buttons { display: none !important; }
                    }
                \`;
                document.head.appendChild(style);
                
                // Focus the window for better UX
                window.focus();
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

// VIEW TIMESHEETS FUNCTIONALITY
window.viewTimesheets = async function() {
    try {
        const { data: timesheets, error } = await supabase
            .from('timesheets')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        let timesheetsHtml = '';
        if (timesheets && timesheets.length > 0) {
            timesheets.forEach(timesheet => {
                const emailStatus = timesheet.email_sent 
                    ? `<span style="color: #28a745;"><i class="fas fa-check-circle"></i> Sent${timesheet.email_address ? ' to ' + timesheet.email_address : ''}</span>`
                    : '<span style="color: #6c757d;"><i class="fas fa-times-circle"></i> Not sent</span>';
                
                timesheetsHtml += `
                    <div class="timesheet-item" style="padding: 15px; border-bottom: 1px solid #eee;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h4 style="margin: 0 0 5px 0;">${timesheet.ref_number}</h4>
                                <p style="margin: 0; color: #666; font-size: 0.9rem;">
                                    ${formatDate(timesheet.start_date)} to ${formatDate(timesheet.end_date)}<br>
                                    ${timesheet.total_hours} hrs • $${timesheet.total_earnings} • ${emailStatus}
                                </p>
                            </div>
                            <div class="timesheet-actions">
                                <button class="btn-icon view-timesheet-btn" data-id="${timesheet.id}" title="View Details">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn-icon delete-timesheet-btn" data-id="${timesheet.id}" title="Delete" style="color: #dc3545;">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            timesheetsHtml = '<p style="text-align:center; padding:20px;">No timesheets generated yet.</p>';
        }

        const html = `
            <div class="modal-content">
                <h2>All Timesheets</h2>
                <div style="max-height: 400px; overflow-y: auto; margin-bottom: 20px;">
                    ${timesheetsHtml}
                </div>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button onclick="closeModal()" class="btn" style="flex:1;">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            </div>
        `;

        showModal(html);
        
        // Add event listeners for buttons
        setTimeout(() => {
            document.querySelectorAll('.view-timesheet-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    viewTimesheetById(id);
                });
            });
            
            document.querySelectorAll('.delete-timesheet-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    deleteTimesheet(id);
                });
            });
        }, 100);
    } catch (error) {
        console.error('❌ Error loading timesheets:', error);
        showMessage('❌ Error loading timesheets: ' + error.message, 'error');
    }
};

// View specific timesheet by ID
async function viewTimesheetById(id) {
    try {
        const { data: timesheet, error: tsError } = await supabase
            .from('timesheets')
            .select('*')
            .eq('id', id)
            .single();

        if (tsError) throw tsError;

        // Get entries for this timesheet period
        const { data: entries, error: entriesError } = await supabase
            .from('entries')
            .select(`
                *,
                locations (name, hourly_rate)
            `)
            .gte('work_date', timesheet.start_date)
            .lte('work_date', timesheet.end_date)
            .order('work_date', { ascending: true });

        if (entriesError) throw entriesError;

        const timesheetDetails = {
            refNumber: timesheet.ref_number,
            startDate: timesheet.start_date,
            endDate: timesheet.end_date,
            totalHours: parseFloat(timesheet.total_hours).toFixed(2),
            totalEarnings: timesheet.total_earnings,
            entriesCount: entries?.length || 0,
            entries: entries?.map(entry => ({
                date: formatDate(entry.work_date),
                location: entry.locations?.name || 'Unknown',
                hours: entry.hours,
                rate: entry.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE,
                earnings: (entry.hours * (entry.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE)).toFixed(2),
                notes: entry.notes || ''
            })) || []
        };

        viewTimesheetDetails(timesheetDetails);
    } catch (error) {
        console.error('❌ Error viewing timesheet:', error);
        showMessage('❌ Error viewing timesheet: ' + error.message, 'error');
    }
}

// Delete timesheet - Fixed null reference error
async function deleteTimesheet(id) {
    console.log("Delete timesheet clicked for ID:", id);

    const html = `
        <div class="modal-content" data-timesheet-id="${id}">
            <h2>Confirm Delete Timesheet</h2>
            <p style="margin:15px 0;">Are you sure you want to delete this timesheet?</p>
            <p style="color:#dc3545; font-weight:bold;">
                Note: This only deletes the timesheet record, not the actual entries.
            </p>
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button class="btn btn-primary confirm-delete-timesheet-btn" style="flex:1; background:#dc3545; border:none;">
                    <i class="fas fa-trash"></i> Yes, Delete Timesheet
                </button>
                <button class="btn cancel-btn" style="flex:1;">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `;

    showModal(html);
    
    // Add event listeners after modal is shown
    setTimeout(() => {
        const modalContent = document.querySelector('.modal-content');
        const timesheetId = modalContent.getAttribute('data-timesheet-id');
        
        document.querySelector('.confirm-delete-timesheet-btn').addEventListener('click', async function() {
            console.log("Confirming delete for timesheet ID:", timesheetId);
            
            try {
                const { error } = await supabase
                    .from('timesheets')
                    .delete()
                    .eq('id', timesheetId);

                if (error) throw error;

                closeModal();
                showMessage('✅ Timesheet deleted successfully!', 'success');
                await loadStats();
                
                // Check if the "All Timesheets" modal is still open before trying to refresh it
                const allTimesheetsModal = document.querySelector('.modal-content h2');
                if (allTimesheetsModal && allTimesheetsModal.textContent === 'All Timesheets') {
                    closeModal();
                    // Re-open the timesheets view
                    setTimeout(() => {
                        viewTimesheets();
                    }, 300);
                }
            } catch (error) {
                console.error("Delete timesheet error:", error);
                showMessage('❌ Error deleting timesheet: ' + error.message, 'error');
            }
        });
        
        document.querySelector('.cancel-btn').addEventListener('click', closeModal);
    }, 100);
};

// ───────────────────────────────────────────────
//   ACTION BUTTONS
// ───────────────────────────────────────────────

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
console.log('🎉 Script loaded successfully');
