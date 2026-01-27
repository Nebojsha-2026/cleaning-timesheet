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
let currentEmployeeId = null;

// Initialize App
document.addEventListener('DOMContentLoaded', async function() {
    console.log('✅ DOM Ready');
    
    if (!window.supabase) {
        console.error('❌ Supabase global not found.');
        throw new Error('Supabase not loaded');
    }
    
    const { createClient } = window.supabase;
    supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    window.supabaseClient = supabase;
    window.CONFIG = CONFIG;
    
    console.log('✅ Supabase client initialized');
    
    // Initialize auth if available
    if (typeof auth !== 'undefined' && typeof auth.initializeAuth === 'function') {
        console.log('🔐 Initializing authentication system...');
        setTimeout(() => {
            auth.initializeAuth();
            
            // Check if user is authenticated
            if (auth.isAuthenticated()) {
                const user = auth.getCurrentUser();
                const role = auth.getUserRole();
                console.log(`👤 User authenticated: ${user?.email}, Role: ${role}`);
                
                // Redirect based on role
                if (role === 'manager' && !window.location.href.includes('manager.html')) {
                    console.log('🔄 Redirecting manager to manager dashboard...');
                    window.location.href = 'manager.html';
                    return;
                }
                
                if (role === 'employee' && window.location.href.includes('auth/')) {
                    console.log('🔄 Redirecting employee to dashboard...');
                    window.location.href = 'index.html';
                    return;
                }
            } else {
                // If not authenticated and not on auth pages, redirect to login
                if (!window.location.href.includes('auth/') && 
                    !window.location.href.includes('login') &&
                    !window.location.href.includes('register')) {
                    console.log('🔄 Not authenticated, but staying on current page for now');
                    // Don't redirect yet - we'll handle this later
                }
            }
        }, 500);
    }
    
    currentEmployeeId = await getCurrentEmployeeId();
    
    await initializeApp();
});

// Get current employee ID
async function getCurrentEmployeeId() {
    try {
        // For demo - get first employee
        const { data: staff, error } = await supabase
            .from('staff')
            .select('id')
            .eq('role', 'employee')
            .limit(1);
        
        if (error) throw error;
        
        if (staff && staff.length > 0) {
            console.log('👤 Current employee ID:', staff[0].id);
            return staff[0].id;
        }
        
        return null;
    } catch (error) {
        console.error('❌ Error getting employee ID:', error);
        return null;
    }
}

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
      
        // Setup timesheet form
        const timesheetForm = document.getElementById('timesheetForm');
        if (timesheetForm) {
            timesheetForm.addEventListener('submit', handleGenerateTimesheet);
        }

        // Setup email notification checkbox
        const emailCheckbox = document.getElementById('sendEmail');
        if (emailCheckbox) {
            emailCheckbox.addEventListener('change', handleEmailCheckbox);
            handleEmailCheckbox({ target: emailCheckbox });
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
          
            // Load data
            setTimeout(async () => {
                await loadStats();
                await loadLocations();
                
                try {
                    if (typeof loadMyShifts === 'function') {
                        await loadMyShifts();
                    }
                    
                    if (typeof loadPastShifts === 'function') {
                        await loadPastShifts();
                    }
                    
                    if (typeof loadTimesheetPeriods === 'function') {
                        await loadTimesheetPeriods();
                    }
                } catch (error) {
                    console.log('⚠️ Could not load data:', error.message);
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
// PAST SHIFTS FUNCTIONS
// ============================================

// Load past shifts for employee view
async function loadPastShifts() {
    try {
        console.log('📋 Loading past shifts...');
        
        const today = new Date().toISOString().split('T')[0];
        
        const { data: shifts, error } = await window.supabaseClient
            .from('shifts')
            .select(`
                *,
                locations (name, address, hourly_rate)
            `)
            .eq('staff_id', currentEmployeeId)
            .lt('shift_date', today)
            .in('status', ['completed', 'cancelled'])
            .order('shift_date', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        updatePastShiftsDisplay(shifts || []);
        console.log('✅ Past shifts loaded:', shifts?.length || 0);
        
    } catch (error) {
        console.error('❌ Error loading past shifts:', error);
        showSamplePastShifts();
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
        const statusClass = getShiftStatusClass(shift.status);
        const rate = shift.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE;
        const earnings = shift.actual_duration ? (shift.actual_duration * rate).toFixed(2) : (shift.duration * rate).toFixed(2);
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
                    ${shift.status === 'completed' ? `
                        <p style="color: #28a745; font-weight: bold; margin-top: 5px;">
                            <i class="fas fa-money-bill-wave"></i> Earned: $${earnings}
                        </p>
                    ` : ''}
                    ${shift.notes ? `<p style="color: #666; font-size: 0.9rem; margin-top: 5px;">
                        <i class="fas fa-sticky-note"></i> ${escapeHtml(shift.notes)}
                    </p>` : ''}
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
    
    // Add event listeners
    setTimeout(() => {
        document.querySelectorAll('.view-shift-details').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                viewShiftDetails(id);
            });
        });
    }, 100);
}

// Show sample past shifts
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
        }
    ];
    
    let html = '<div style="margin-bottom: 15px; color: #666; font-size: 0.9rem; text-align: center;">📋 Showing sample past shifts</div>';
    
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
                staff!shifts_staff_id_fkey (name, email)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        const locationName = shift.locations?.name || 'Unknown Location';
        const rate = shift.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE;
        const earnings = shift.actual_duration ? (shift.actual_duration * rate).toFixed(2) : (shift.duration * rate).toFixed(2);
        const hours = shift.actual_duration || shift.duration;

        const html = `
            <div class="modal-content">
                <h2><i class="fas fa-info-circle"></i> Shift Details</h2>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="margin-top: 0; color: #667eea;">${escapeHtml(locationName)}</h3>
                    
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
                
                ${shift.status === 'completed' ? `
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
                ` : ''}
                
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

// ============================================
// STATISTICS FUNCTIONS
// ============================================

async function loadStats() {
    try {
        console.log('📊 Loading statistics...');
      
        // Get completed shifts count
        const { count: completedShifts, error: shiftsError } = await window.supabaseClient
            .from('shifts')
            .select('*', { count: 'exact', head: true })
            .eq('staff_id', currentEmployeeId)
            .eq('status', 'completed');
      
        if (shiftsError) throw shiftsError;
      
        const { count: totalLocations, error: locationsError } = await window.supabaseClient
            .from('locations')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);
      
        if (locationsError) throw locationsError;
      
        const { count: totalTimesheets, error: timesheetsError } = await window.supabaseClient
            .from('timesheets')
            .select('*', { count: 'exact', head: true });
      
        if (timesheetsError) throw timesheetsError;
      
        // Calculate total earnings
        const { data: completedShiftsData, error: earningsError } = await window.supabaseClient
            .from('shifts')
            .select(`
                duration,
                actual_duration,
                locations (hourly_rate)
            `)
            .eq('staff_id', currentEmployeeId)
            .eq('status', 'completed');
      
        if (earningsError) throw earningsError;
      
        const totalEarnings = completedShiftsData.reduce((sum, shift) => {
            const rate = shift.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE;
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
// TIMESHEET PERIOD SELECTION FUNCTIONS
// ============================================

async function loadTimesheetPeriods() {
    try {
        console.log('📅 Loading available timesheet periods...');
        
        // First check if columns exist
        const { data: employee, error } = await window.supabaseClient
            .from('staff')
            .select('*')
            .eq('id', currentEmployeeId)
            .single();
        
        if (error) {
            console.log('⚠️ Using default periods');
            const defaultPeriods = [
                { id: 'weekly', label: 'Weekly', icon: 'calendar-week', enabled: true, description: 'Mon-Sun' },
                { id: 'fortnightly', label: 'Fortnightly', icon: 'calendar-alt', enabled: true, description: '2 weeks' },
                { id: 'monthly', label: 'Monthly', icon: 'calendar', enabled: true, description: 'Month' },
                { id: 'custom', label: 'Custom', icon: 'calendar-day', enabled: true, description: 'Pick dates' }
            ];
            renderPeriodSelectionBlocks(defaultPeriods);
            return;
        }
        
        // Check for timesheet settings columns
        const hasWeekly = employee.timesheet_weekly !== undefined;
        
        let availablePeriods;
        if (hasWeekly) {
            availablePeriods = [
                { 
                    id: 'weekly', 
                    label: 'Weekly', 
                    icon: 'calendar-week', 
                    enabled: employee.timesheet_weekly !== false, 
                    description: 'Mon-Sun' 
                },
                { 
                    id: 'fortnightly', 
                    label: 'Fortnightly', 
                    icon: 'calendar-alt', 
                    enabled: employee.timesheet_fortnightly !== false, 
                    description: '2 weeks' 
                },
                { 
                    id: 'monthly', 
                    label: 'Monthly', 
                    icon: 'calendar', 
                    enabled: employee.timesheet_monthly !== false, 
                    description: 'Month' 
                },
                { 
                    id: 'custom', 
                    label: 'Custom', 
                    icon: 'calendar-day', 
                    enabled: employee.timesheet_custom !== false, 
                    description: 'Pick dates' 
                }
            ];
        } else {
            // Default to all enabled
            availablePeriods = [
                { id: 'weekly', label: 'Weekly', icon: 'calendar-week', enabled: true, description: 'Mon-Sun' },
                { id: 'fortnightly', label: 'Fortnightly', icon: 'calendar-alt', enabled: true, description: '2 weeks' },
                { id: 'monthly', label: 'Monthly', icon: 'calendar', enabled: true, description: 'Month' },
                { id: 'custom', label: 'Custom', icon: 'calendar-day', enabled: true, description: 'Pick dates' }
            ];
        }
        
        const enabledPeriods = availablePeriods.filter(period => period.enabled);
        console.log('📅 Available periods:', enabledPeriods.map(p => p.label));
        renderPeriodSelectionBlocks(enabledPeriods);
        
    } catch (error) {
        console.error('❌ Error loading timesheet periods:', error);
        const defaultPeriods = [
            { id: 'weekly', label: 'Weekly', icon: 'calendar-week', enabled: true, description: 'Mon-Sun' },
            { id: 'fortnightly', label: 'Fortnightly', icon: 'calendar-alt', enabled: true, description: '2 weeks' },
            { id: 'monthly', label: 'Monthly', icon: 'calendar', enabled: true, description: 'Month' },
            { id: 'custom', label: 'Custom', icon: 'calendar-day', enabled: true, description: 'Pick dates' }
        ];
        renderPeriodSelectionBlocks(defaultPeriods);
    }
}

function renderPeriodSelectionBlocks(periods) {
    const container = document.getElementById('periodSelectionBlocks');
    if (!container) return;
    
    if (!periods || periods.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #666;">
                <i class="fas fa-calendar-times" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <p>No timesheet periods available.</p>
            </div>
        `;
        return;
    }
    
    // If only one period is available
    if (periods.length === 1) {
        const period = periods[0];
        container.innerHTML = `
            <div class="single-period-option" data-period="${period.id}">
                <i class="fas fa-${period.icon}" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <div style="font-weight: bold; font-size: 1.1rem;">${period.label}</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">${period.description}</div>
            </div>
        `;
        
        setTimeout(() => {
            selectPeriod(period.id);
            const singleOption = document.querySelector('.single-period-option');
            if (singleOption) {
                singleOption.addEventListener('click', function() {
                    selectPeriod(period.id);
                });
            }
        }, 100);
        
        return;
    }
    
    // Multiple periods available
    let html = '';
    periods.forEach(period => {
        html += `
            <div class="period-block ${period.enabled ? '' : 'disabled'}" 
                 data-period="${period.id}" 
                 onclick="${period.enabled ? `selectPeriod('${period.id}')` : ''}">
                <div class="period-icon">
                    <i class="fas fa-${period.icon}"></i>
                </div>
                <div class="period-label">${period.label}</div>
                <div class="period-description">${period.description}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Auto-select first enabled period
    const firstEnabled = periods.find(p => p.enabled);
    if (firstEnabled) {
        setTimeout(() => {
            selectPeriod(firstEnabled.id);
        }, 100);
    }
}

function selectPeriod(periodId) {
    console.log('📅 Selected period:', periodId);
    
    document.querySelectorAll('.period-block').forEach(block => {
        block.classList.remove('selected');
        if (block.getAttribute('data-period') === periodId) {
            block.classList.add('selected');
        }
    });
    
    const singleOption = document.querySelector('.single-period-option');
    if (singleOption && singleOption.getAttribute('data-period') === periodId) {
        singleOption.classList.add('selected');
    }
    
    document.getElementById('timesheetPeriod').value = periodId;
    handlePeriodSelection(periodId);
}

function handlePeriodSelection(periodId) {
    const customDatesDiv = document.getElementById('customDatesSection');
    const autoDatesDiv = document.getElementById('autoDatesSection');
    const today = new Date();
    
    if (periodId === 'custom') {
        customDatesDiv.style.display = 'block';
        autoDatesDiv.style.display = 'none';
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
    } else {
        customDatesDiv.style.display = 'none';
        autoDatesDiv.style.display = 'block';
        
        let startDate, endDate;
        
        switch(periodId) {
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
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 7);
                endDate = today;
        }
        
        document.getElementById('autoStartDate').textContent = formatDate(startDate);
        document.getElementById('autoEndDate').textContent = formatDate(endDate);
        document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
        document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
    }
    
    showMessage(`✅ Selected: ${periodId}`, 'success', 1500);
}

// ============================================
// ACTION BUTTONS
// ============================================

window.refreshData = async function() {
    console.log('🔄 Refreshing data...');
    showMessage('Refreshing data...', 'info');
    await loadStats();
    if (typeof loadMyShifts === 'function') await loadMyShifts();
    await loadPastShifts();
    await loadLocations();
    await loadTimesheetPeriods();
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
    const html = `
        <div class="modal-content">
            <h2><i class="fas fa-cog"></i> Employee Settings</h2>
            
            <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h3 style="margin-top: 0; color: #667eea;">
                    <i class="fas fa-user-circle"></i> My Account
                </h3>
                <button onclick="viewMyProfile()" class="btn" style="width: 100%; margin-bottom: 10px; background: #667eea; color: white;">
                    <i class="fas fa-user-edit"></i> View My Profile
                </button>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #667eea; margin-bottom: 15px;">
                    <i class="fas fa-calendar-alt"></i> Shift Management
                </h3>
                <button onclick="refreshMyShifts()" class="btn" style="width: 100%; margin-bottom: 10px;">
                    <i class="fas fa-sync-alt"></i> Refresh My Shifts
                </button>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #667eea; margin-bottom: 15px;">
                    <i class="fas fa-life-ring"></i> Support & Help
                </h3>
                <button onclick="reportIssue()" class="btn" style="width: 100%; margin-bottom: 10px; background: #ffc107; color: #212529;">
                    <i class="fas fa-exclamation-triangle"></i> Report Issue
                </button>
            </div>
            
            <div style="border-top: 1px solid #e9ecef; padding-top: 15px;">
                <button onclick="closeModal()" class="btn" style="width: 100%; background: #6c757d; color: white;">
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

window.viewMyProfile = async function() {
    try {
        const { data: employee, error } = await window.supabaseClient
            .from('staff')
            .select('*')
            .eq('id', currentEmployeeId)
            .single();
        
        if (error) throw error;
        
        const html = `
            <div class="modal-content">
                <h2><i class="fas fa-user-circle"></i> My Profile</h2>
                <div style="text-align: center; margin: 20px 0;">
                    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 2.5rem; margin-bottom: 15px;">
                        <i class="fas fa-user"></i>
                    </div>
                    <h3 style="margin: 10px 0 5px 0;">${escapeHtml(employee.name)}</h3>
                    <p style="color: #666; margin-bottom: 20px;">Cleaning Staff</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <div class="info-item">
                        <i class="fas fa-envelope"></i>
                        <div>
                            <strong>Email:</strong>
                            <span>${employee.email || 'Not provided'}</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-phone"></i>
                        <div>
                            <strong>Phone:</strong>
                            <span>${employee.phone || 'Not provided'}</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-money-bill"></i>
                        <div>
                            <strong>Hourly Rate:</strong>
                            <span>$${employee.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE} AUD</span>
                        </div>
                    </div>
                </div>
                
                <button onclick="closeModal()" class="btn" style="width: 100%;">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        `;
        
        showModal(html);
        
    } catch (error) {
        console.error('❌ Error loading profile:', error);
        showMessage('❌ Error loading profile: ' + error.message, 'error');
    }
};

// Helper functions
function getShiftStatusClass(status) {
    switch(status) {
        case 'confirmed': return 'confirmed';
        case 'in_progress': return 'in-progress';
        case 'completed': return 'completed';
        case 'cancelled': return 'cancelled';
        default: return 'pending';
    }
}

function formatTime(timeString) {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

// TEST FUNCTION - Remove this later
window.createTestManager = async function() {
    console.log('🧪 Creating test manager account...');
    
    const email = `testmanager${Date.now()}@test.com`;
    const companyName = `Test Company ${Date.now()}`;
    
    if (!window.auth || !window.auth.registerManager) {
        console.error('❌ Auth module not loaded');
        alert('Auth module not loaded. Check console for errors.');
        return;
    }
    
    const result = await auth.registerManager(email, 'test123', companyName);
    
    if (result.success) {
        console.log('✅ Test manager created:', result.user.email);
        console.log('Company:', result.company.name);
        alert(`Test manager created!\nEmail: ${email}\nPassword: test123\nCompany: ${companyName}`);
        
        // Refresh to log in
        window.location.reload();
    } else {
        console.error('❌ Failed to create test manager:', result.error);
        alert('Error: ' + result.error);
    }
};

console.log('🎉 Main');


