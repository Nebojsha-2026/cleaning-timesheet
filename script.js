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
        // Set today's date
        const today = new Date();
        document.getElementById('currentDate').textContent = formatDate(today);

        // Set default dates for timesheet generator
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        if (startDateInput) startDateInput.value = lastWeek.toISOString().split('T')[0];
        if (endDateInput) endDateInput.value = today.toISOString().split('T')[0];
      
        // Setup form handlers - ONLY TIMESHEET FORM (no shift forms for employees)
        const timesheetForm = document.getElementById('timesheetForm');
        
        console.log('Checking forms:', {
            timesheetForm: !!timesheetForm
        });
        
        if (timesheetForm) {
            console.log('✅ Adding listener to timesheetForm');
            timesheetForm.addEventListener('submit', handleGenerateTimesheet);
        }

        // Setup email notification checkbox
        const emailCheckbox = document.getElementById('sendEmail');
        if (emailCheckbox) {
            emailCheckbox.addEventListener('change', handleEmailCheckbox);
            handleEmailCheckbox({ target: emailCheckbox });
        }
        
        // Setup timesheet period selector
        const timesheetPeriod = document.getElementById('timesheetPeriod');
        if (timesheetPeriod) {
            timesheetPeriod.addEventListener('change', handleTimesheetPeriodChange);
        }
        
        // Setup entry mode selector (for work entries, not shifts)
        const entryMode = document.getElementById('entryMode');
        if (entryMode) {
           entryMode.addEventListener('change', handleEntryModeChange);
       }
        
        // Initialize entry mode UI (with error handling)
        try {
            if (typeof initializeEntryModeUI === 'function') {
               initializeEntryModeUI();
          } else {
                console.log('ℹ️ initializeEntryModeUI function not found - skipping');
         }
        } catch (error) {
            console.log('⚠️ Error initializing entry mode UI:', error.message);
            // Don't crash the app - this is non-critical
        }
        
        // Setup custom dates button
        const customDatesBtn = document.getElementById('customDatesBtn');
        if (customDatesBtn) {
            customDatesBtn.addEventListener('click', showCustomDatesPopup);
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
                
                // Load employee shifts
                try {
                    if (typeof loadMyShifts === 'function') {
                        await loadMyShifts(); // Upcoming shifts
                    } else {
                        console.log('⚠️ loadMyShifts function not found - shifts.js might not be loaded');
                    }
                    
                    if (typeof loadPastShifts === 'function') {
                        await loadPastShifts(); // Past shifts
                    }
                } catch (error) {
                    console.log('⚠️ Could not load shifts:', error.message);
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
// PAST SHIFTS FUNCTIONS (Employee View)
// ============================================

// Load past shifts for employee view
async function loadPastShifts() {
    try {
        console.log('📋 Loading past shifts...');
        
        const today = new Date().toISOString().split('T')[0];
        
        // For now, get all completed shifts (in real app, filter by logged-in user and status)
        const { data: shifts, error } = await window.supabaseClient
            .from('shifts')
            .select(`
                *,
                locations (name, address, notes),
                staff (name, email)
            `)
            .lt('shift_date', today)
            .order('shift_date', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        updatePastShiftsDisplay(shifts || []);
        console.log('✅ Past shifts loaded:', shifts?.length || 0);
        
    } catch (error) {
        console.error('❌ Error loading past shifts:', error);
        
        // If table doesn't exist yet, show sample data
        if (error.message.includes('does not exist')) {
            console.log('⚠️ Shifts table not created yet, showing sample data');
            showSamplePastShifts();
        }
    }
}

// Update past shifts display
function updatePastShiftsDisplay(shifts) {
    const container = document.getElementById('pastShiftsList');
    if (!container) return;
    
    if (!shifts || shifts.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-history" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <p>No past shifts found.</p>
                <p style="font-size: 0.9rem;">Completed shifts will appear here.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    shifts.forEach(shift => {
        const locationName = shift.locations?.name || 'Unknown Location';
        const staffName = shift.staff?.name || 'Manager';
        const statusClass = getShiftStatusClass(shift.status);
        const earnings = shift.actual_duration ? (shift.actual_duration * 23).toFixed(2) : (shift.duration * 23).toFixed(2);
        const hours = shift.actual_duration || shift.duration;
        
        html += `
            <div class="shift-item completed-shift" data-shift-id="${shift.id}">
                <div class="shift-info">
                    <h4>${escapeHtml(locationName)} 
                        <span class="shift-status ${statusClass}">${shift.status}</span>
                    </h4>
                    <p>
                        <i class="far fa-calendar"></i> ${formatDate(shift.shift_date)} 
                        • <i class="far fa-clock"></i> ${formatTime(shift.start_time)} 
                        • ${hours} hours
                    </p>
                    <p style="color: #28a745; font-weight: bold; margin-top: 5px;">
                        <i class="fas fa-money-bill-wave"></i> Earned: $${earnings}
                    </p>
                    <p style="color: #666; font-size: 0.9rem; margin-top: 5px;">
                        <i class="fas fa-user-tie"></i> Assigned by: ${escapeHtml(staffName)}
                        ${shift.notes ? `<br><i class="fas fa-sticky-note"></i> ${escapeHtml(shift.notes)}` : ''}
                    </p>
                </div>
                <div class="shift-actions-employee">
                    <button class="btn btn-sm btn-info view-shift-details" data-id="${shift.id}">
                        <i class="fas fa-eye"></i> Details
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Add event listeners for view details buttons
    setTimeout(() => {
        document.querySelectorAll('.view-shift-details').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                viewShiftDetails(id);
            });
        });
    }, 100);
}

// Show sample past shifts (for demo)
function showSamplePastShifts() {
    const container = document.getElementById('pastShiftsList');
    if (!container) return;
    
    const sampleShifts = [
        {
            id: 'past1',
            location_name: 'Main Office',
            shift_date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
            start_time: '09:00',
            duration: 3,
            actual_duration: 3.5,
            status: 'completed',
            notes: 'Regular cleaning - all floors',
            earnings: 80.50
        },
        {
            id: 'past2',
            location_name: 'Private Residence',
            shift_date: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0],
            start_time: '14:00',
            duration: 2,
            actual_duration: 2.0,
            status: 'completed',
            notes: 'Spring cleaning requested',
            earnings: 46.00
        },
        {
            id: 'past3',
            location_name: 'Business Center',
            shift_date: new Date(Date.now() - 86400000 * 7).toISOString().split('T')[0],
            start_time: '10:00',
            duration: 4,
            actual_duration: 3.75,
            status: 'completed',
            notes: 'Deep cleaning after renovation',
            earnings: 86.25
        }
    ];
    
    let html = '<div style="margin-bottom: 15px; color: #666; font-size: 0.9rem; text-align: center;">📋 Showing sample past shifts (database not set up yet)</div>';
    
    sampleShifts.forEach(shift => {
        const statusClass = getShiftStatusClass(shift.status);
        
        html += `
            <div class="shift-item completed-shift">
                <div class="shift-info">
                    <h4>${escapeHtml(shift.location_name)} 
                        <span class="shift-status ${statusClass}">${shift.status}</span>
                    </h4>
                    <p>
                        <i class="far fa-calendar"></i> ${formatDate(shift.shift_date)} 
                        • <i class="far fa-clock"></i> ${formatTime(shift.start_time)} 
                        • ${shift.actual_duration} hours
                    </p>
                    <p style="color: #28a745; font-weight: bold; margin-top: 5px;">
                        <i class="fas fa-money-bill-wave"></i> Earned: $${shift.earnings}
                    </p>
                    <p style="color: #666; font-size: 0.9rem; margin-top: 5px;">
                        <i class="fas fa-sticky-note"></i> ${escapeHtml(shift.notes)}
                    </p>
                </div>
                <div class="shift-actions-employee">
                    <button class="btn btn-sm btn-info" onclick="showMessage('Shift details would show here', 'info')">
                        <i class="fas fa-eye"></i> Details
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// View shift details
async function viewShiftDetails(id) {
    try {
        const { data: shift, error } = await window.supabaseClient
            .from('shifts')
            .select(`
                *,
                locations (name, address, hourly_rate),
                staff (name, email)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        const locationName = shift.locations?.name || 'Unknown Location';
        const address = shift.locations?.address || 'No address provided';
        const rate = shift.locations?.hourly_rate || 23;
        const staffName = shift.staff?.name || 'Manager';
        const earnings = shift.actual_duration ? (shift.actual_duration * rate).toFixed(2) : (shift.duration * rate).toFixed(2);
        const hours = shift.actual_duration || shift.duration;

        const html = `
            <div class="modal-content">
                <h2><i class="fas fa-info-circle"></i> Shift Details</h2>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="margin-top: 0; color: #667eea;">${escapeHtml(locationName)}</h3>
                    <p style="color: #666; margin-bottom: 15px;">${escapeHtml(address)}</p>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div>
                            <strong>Date:</strong><br>
                            ${formatDate(shift.shift_date)}
                        </div>
                        <div style="text-align: right;">
                            <strong>Status:</strong><br>
                            <span class="shift-status ${getShiftStatusClass(shift.status)}">${shift.status}</span>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <strong>Scheduled:</strong><br>
                            ${formatTime(shift.start_time)} for ${shift.duration} hours
                        </div>
                        <div style="text-align: right;">
                            <strong>Actual:</strong><br>
                            ${shift.actual_start_time ? formatTime(shift.actual_start_time) : 'N/A'} for ${hours} hours
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #333; margin-bottom: 10px;">Earnings Breakdown</h4>
                    <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span>Hours worked:</span>
                            <strong>${hours} hrs</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span>Hourly rate:</span>
                            <strong>$${rate}/hr</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 1.2rem; color: #28a745; font-weight: bold; padding-top: 10px; border-top: 2px solid #e0e0e0;">
                            <span>Total earnings:</span>
                            <strong>$${earnings}</strong>
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #333; margin-bottom: 10px;">Shift Information</h4>
                    <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px;">
                        <div style="margin-bottom: 10px;">
                            <strong><i class="fas fa-user-tie"></i> Assigned by:</strong><br>
                            ${escapeHtml(staffName)}
                        </div>
                        ${shift.confirmed_at ? `
                            <div style="margin-bottom: 10px;">
                                <strong><i class="fas fa-check-circle"></i> Accepted on:</strong><br>
                                ${formatDate(shift.confirmed_at)}
                            </div>
                        ` : ''}
                        ${shift.completed_at ? `
                            <div style="margin-bottom: 10px;">
                                <strong><i class="fas fa-flag-checkered"></i> Completed on:</strong><br>
                                ${formatDate(shift.completed_at)}
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                ${shift.notes ? `
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #333; margin-bottom: 10px;">Notes</h4>
                        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px;">
                            ${escapeHtml(shift.notes)}
                        </div>
                    </div>
                ` : ''}
                
                <button onclick="closeModal()" class="btn" style="width: 100%;">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        `;
        
        showModal(html);
        
    } catch (error) {
        console.error('❌ Error viewing shift details:', error);
        showMessage('❌ Error loading shift details: ' + error.message, 'error');
    }
}

// Get CSS class for shift status
function getShiftStatusClass(status) {
    switch(status) {
        case 'confirmed': return 'confirmed';
        case 'in_progress': return 'in-progress';
        case 'completed': return 'completed';
        case 'cancelled': return 'cancelled';
        default: return 'pending';
    }
}

// Format time for display
function formatTime(timeString) {
    if (!timeString) return '';
    
    // Convert "14:30" to "2:30 PM"
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    
    return `${displayHour}:${minutes} ${ampm}`;
}

// Load statistics for employee view (shows completed shifts)
async function loadStats() {
    try {
        console.log('📊 Loading statistics...');
      
        // Get completed shifts count instead of entries
        const { count: completedShifts, error: shiftsError } = await window.supabaseClient
            .from('shifts')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'completed');
      
        if (shiftsError) throw shiftsError;
      
        const { count: totalLocations, error: locationsError } = await window.supabaseClient
            .from('locations')
            .select('*', { count: 'exact', head: true });
      
        if (locationsError) throw locationsError;
      
        const { count: totalTimesheets, error: timesheetsError } = await window.supabaseClient
            .from('timesheets')
            .select('*', { count: 'exact', head: true });
      
        if (timesheetsError) throw timesheetsError;
      
        // Calculate total earnings from completed shifts
        const { data: completedShiftsData, error: earningsError } = await window.supabaseClient
            .from('shifts')
            .select(`
                duration,
                actual_duration,
                locations (hourly_rate)
            `)
            .eq('status', 'completed');
      
        if (earningsError) throw earningsError;
      
        const totalEarnings = completedShiftsData.reduce((sum, shift) => {
            const rate = shift.locations?.hourly_rate || window.CONFIG.DEFAULT_HOURLY_RATE;
            const hours = shift.actual_duration || shift.duration;
            return sum + (parseFloat(hours) * rate);
        }, 0).toFixed(2);
      
        updateStatsDisplay({
            completedShifts: completedShifts || 0,
            totalLocations: totalLocations || 0,
            totalTimesheets: totalTimesheets || 0,
            totalEarnings: totalEarnings
        });
      
        console.log('✅ Statistics loaded');
      
    } catch (error) {
        console.error('❌ Error loading statistics:', error);
    }
}

// Update stats display with completed shifts
function updateStatsDisplay(stats) {
    document.querySelectorAll('.stat-card')[0].innerHTML = `
        <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
        <div class="stat-info">
            <h3>Completed Shifts</h3>
            <div class="stat-value">${stats.completedShifts}</div>
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

// ============================================
// ACTION BUTTONS
// ============================================

window.refreshData = async function() {
    console.log('🔄 Refreshing data...');
    showMessage('Refreshing data...', 'info');
    await loadStats();
    await loadMyShifts();
    await loadPastShifts();
    await loadLocations();
    showMessage('✅ Data refreshed!', 'success');
};

window.refreshPastShifts = async function() {
    console.log('🔄 Refreshing past shifts...');
    showMessage('Refreshing past shifts...', 'info');
    await loadPastShifts();
    showMessage('✅ Past shifts refreshed!', 'success');
};

window.generateTimesheet = function() {
    document.getElementById('timesheetForm').scrollIntoView({ behavior: 'smooth' });
};

window.showSettings = function() { 
    // Open settings modal for employee
    const html = `
        <div class="modal-content">
            <h2><i class="fas fa-cog"></i> Employee Settings</h2>
            
            <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h3 style="margin-top: 0; color: #667eea;">
                    <i class="fas fa-user-circle"></i> My Account
                </h3>
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                    <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem;">
                        <i class="fas fa-user"></i>
                    </div>
                    <div>
                        <h4 style="margin: 0 0 5px 0;">Employee Profile</h4>
                        <p style="margin: 0; color: #666; font-size: 0.9rem;">View and update your information</p>
                    </div>
                </div>
                <button onclick="viewMyProfile()" class="btn" style="width: 100%; margin-bottom: 10px; background: #667eea; color: white;">
                    <i class="fas fa-user-edit"></i> Edit My Profile
                </button>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #667eea; margin-bottom: 15px;">
                    <i class="fas fa-calendar-alt"></i> Shift Management
                </h3>
                <button onclick="refreshMyShifts()" class="btn" style="width: 100%; margin-bottom: 10px;">
                    <i class="fas fa-sync-alt"></i> Refresh My Shifts
                </button>
                <button onclick="viewShiftCalendar()" class="btn" style="width: 100%; margin-bottom: 10px;">
                    <i class="fas fa-calendar-week"></i> View Shift Calendar
                </button>
                <button onclick="requestTimeOff()" class="btn" style="width: 100%; margin-bottom: 10px;">
                    <i class="fas fa-calendar-times"></i> Request Time Off
                </button>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #667eea; margin-bottom: 15px;">
                    <i class="fas fa-life-ring"></i> Support & Help
                </h3>
                <button onclick="reportIssue()" class="btn" style="width: 100%; margin-bottom: 10px; background: #ffc107; color: #212529;">
                    <i class="fas fa-exclamation-triangle"></i> Report Issue
                </button>
                <button onclick="showHelp()" class="btn" style="width: 100%; margin-bottom: 10px;">
                    <i class="fas fa-question-circle"></i> Help & Documentation
                </button>
                <button onclick="contactSupport()" class="btn" style="width: 100%; margin-bottom: 10px;">
                    <i class="fas fa-headset"></i> Contact Support
                </button>
            </div>
            
            <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h3 style="color: #667eea; margin-top: 0; margin-bottom: 15px;">
                    <i class="fas fa-chart-line"></i> Performance
                </h3>
                <button onclick="viewMyTimesheets()" class="btn" style="width: 100%; margin-bottom: 10px;">
                    <i class="fas fa-file-invoice"></i> My Timesheets
                </button>
                <button onclick="viewMyEarnings()" class="btn" style="width: 100%; margin-bottom: 10px;">
                    <i class="fas fa-money-bill-wave"></i> View Earnings
                </button>
            </div>
            
            <div style="border-top: 1px solid #e9ecef; padding-top: 15px;">
                <div style="display: flex; gap: 10px;">
                    <button onclick="exportMyData()" class="btn" style="flex: 1;">
                        <i class="fas fa-download"></i> Export Data
                    </button>
                    <button onclick="closeModal()" class="btn" style="flex: 1; background: #6c757d; color: white;">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            </div>
        </div>
    `;
    showModal(html);
};

window.showHelp = function() { 
    alert('Help documentation coming soon!'); 
};

// ============================================
// EMPLOYEE PROFILE & SETTINGS FUNCTIONS
// ============================================

window.viewMyProfile = function() {
    const html = `
        <div class="modal-content">
            <h2><i class="fas fa-user-circle"></i> My Profile</h2>
            <div style="text-align: center; margin: 20px 0;">
                <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 2.5rem; margin-bottom: 15px;">
                    <i class="fas fa-user"></i>
                </div>
                <h3 style="margin: 10px 0 5px 0;">Employee Name</h3>
                <p style="color: #666; margin-bottom: 20px;">Cleaning Staff</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div class="info-item">
                    <i class="fas fa-envelope"></i>
                    <div>
                        <strong>Email:</strong>
                        <span>employee@example.com</span>
                    </div>
                </div>
                <div class="info-item">
                    <i class="fas fa-phone"></i>
                    <div>
                        <strong>Phone:</strong>
                        <span>+1 (555) 123-4567</span>
                    </div>
                </div>
                <div class="info-item">
                    <i class="fas fa-money-bill"></i>
                    <div>
                        <strong>Hourly Rate:</strong>
                        <span>$23.00 AUD</span>
                    </div>
                </div>
                <div class="info-item">
                    <i class="fas fa-calendar"></i>
                    <div>
                        <strong>Member Since:</strong>
                        <span>${formatDate(new Date())}</span>
                    </div>
                </div>
            </div>
            
            <p style="text-align: center; color: #666; font-size: 0.9rem; margin-bottom: 20px;">
                Contact your manager to update personal information
            </p>
            
            <button onclick="closeModal()" class="btn" style="width: 100%;">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;
    showModal(html);
};

window.viewShiftCalendar = function() {
    const html = `
        <div class="modal-content">
            <h2><i class="fas fa-calendar-alt"></i> My Shift Calendar</h2>
            
            <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                        <strong>Current Month:</strong>
                        <div>${new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</div>
                    </div>
                    <div style="text-align: right;">
                        <strong>Shifts This Month:</strong>
                        <div>Loading...</div>
                    </div>
                </div>
                <button onclick="refreshMyShifts()" class="btn" style="width: 100%;">
                    <i class="fas fa-sync-alt"></i> Refresh Calendar
                </button>
            </div>
            
            <div style="text-align: center; padding: 40px 20px;">
                <i class="fas fa-calendar" style="font-size: 3rem; color: #667eea; opacity: 0.7; margin-bottom: 15px;"></i>
                <h3>Calendar View</h3>
                <p style="color: #666; margin-bottom: 20px;">
                    Full calendar view will be available in the next update.
                </p>
                <p style="color: #666; font-size: 0.9rem;">
                    For now, use the "My Upcoming Shifts" section on the main page.
                </p>
            </div>
            
            <button onclick="closeModal()" class="btn" style="width: 100%;">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;
    showModal(html);
};

window.viewMyTimesheets = function() {
    const html = `
        <div class="modal-content">
            <h2><i class="fas fa-file-invoice"></i> My Timesheets</h2>
            <div style="text-align: center; padding: 40px 20px;">
                <i class="fas fa-file-invoice-dollar" style="font-size: 3rem; color: #28a745; opacity: 0.7; margin-bottom: 15px;"></i>
                <h3>Timesheet History</h3>
                <p style="color: #666; margin-bottom: 20px;">
                    View all your generated timesheets and earnings history.
                </p>
                <button onclick="viewTimesheets()" class="btn btn-success" style="padding: 12px 30px; margin-bottom: 15px;">
                    <i class="fas fa-folder-open"></i> View All Timesheets
                </button>
                <p style="color: #666; font-size: 0.9rem;">
                    Generate new timesheets from the main page.
                </p>
            </div>
            <button onclick="closeModal()" class="btn" style="width: 100%;">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;
    showModal(html);
};

window.viewMyEarnings = function() {
    const html = `
        <div class="modal-content">
            <h2><i class="fas fa-money-bill-wave"></i> My Earnings</h2>
            
            <div style="margin-bottom: 20px; padding: 20px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border-radius: 8px;">
                <div style="text-align: center;">
                    <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 5px;">$0.00</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">Total Earnings (This Month)</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: bold; color: #667eea;">0</div>
                    <div style="font-size: 0.8rem; color: #666;">Shifts This Month</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: bold; color: #28a745;">0 hrs</div>
                    <div style="font-size: 0.8rem; color: #666;">Total Hours</div>
                </div>
            </div>
            
            <div style="text-align: center; color: #666; font-size: 0.9rem; margin-bottom: 20px;">
                <i class="fas fa-info-circle"></i> Earnings data will populate as you complete shifts
            </div>
            
            <button onclick="closeModal()" class="btn" style="width: 100%;">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;
    showModal(html);
};

window.contactSupport = function() {
    const html = `
        <div class="modal-content">
            <h2><i class="fas fa-headset"></i> Contact Support</h2>
            
            <div style="margin-bottom: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                <h3 style="margin-top: 0; color: #667eea;">Need Help?</h3>
                <p style="color: #666; margin-bottom: 15px;">
                    Our support team is here to help you with any questions or issues.
                </p>
                
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #333; margin-bottom: 8px;">Support Hours:</h4>
                    <p style="color: #666; margin: 0;">Monday - Friday: 9:00 AM - 5:00 PM</p>
                    <p style="color: #666; margin: 0;">Weekends: Emergency support only</p>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #333; margin-bottom: 8px;">Contact Methods:</h4>
                    <div class="info-item">
                        <i class="fas fa-envelope"></i>
                        <div>
                            <strong>Email:</strong>
                            <span>support@cleaningcompany.com</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-phone"></i>
                        <div>
                            <strong>Phone:</strong>
                            <span>(555) 123-HELP</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="border-top: 1px solid #e9ecef; padding-top: 15px;">
                <p style="color: #666; font-size: 0.9rem; text-align: center;">
                    For urgent shift-related issues, use the "Report Issue" button.
                </p>
            </div>
            
            <button onclick="closeModal()" class="btn" style="width: 100%; margin-top: 15px;">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;
    showModal(html);
};

window.exportMyData = function() {
    showMessage('📊 Preparing your data export...', 'info');
    
    setTimeout(() => {
        const html = `
            <div class="modal-content">
                <h2><i class="fas fa-download"></i> Export My Data</h2>
                
                <div style="margin-bottom: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                    <h3 style="margin-top: 0; color: #667eea;">Select Data to Export</h3>
                    
                    <div style="margin-bottom: 15px;">
                        <label class="checkbox">
                            <input type="checkbox" id="exportShifts" checked>
                            <span>Shift History</span>
                        </label>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label class="checkbox">
                            <input type="checkbox" id="exportTimesheets" checked>
                            <span>Timesheets</span>
                        </label>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label class="checkbox">
                            <input type="checkbox" id="exportEarnings">
                            <span>Earnings Report</span>
                        </label>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label class="checkbox">
                            <input type="checkbox" id="exportProfile">
                            <span>Profile Information</span>
                        </label>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #333; margin-bottom: 10px;">Export Format</h4>
                    <select id="exportFormat" class="form-control" style="margin-bottom: 10px;">
                        <option value="csv">CSV (Spreadsheet)</option>
                        <option value="pdf">PDF Document</option>
                        <option value="json">JSON (Raw Data)</option>
                    </select>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="generateExport()" class="btn btn-success" style="flex: 1;">
                        <i class="fas fa-file-export"></i> Generate Export
                    </button>
                    <button onclick="closeModal()" class="btn" style="flex: 1;">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </div>
        `;
        
        showModal(html);
        
        setTimeout(() => {
            const generateBtn = document.querySelector('.btn-success');
            if (generateBtn) {
                generateBtn.addEventListener('click', function() {
                    const format = document.getElementById('exportFormat').value;
                    showMessage(`✅ Export generated in ${format.toUpperCase()} format. Download will start shortly.`, 'success');
                    setTimeout(closeModal, 2000);
                });
            }
        }, 100);
        
    }, 1000);
};

// Helper function for export modal
window.generateExport = function() {
    // This would be implemented to actually generate the export
    showMessage('✅ Export generated successfully!', 'success');
    closeModal();
};

// Final log
console.log('🎉 Main script loaded (Employee Version)');
