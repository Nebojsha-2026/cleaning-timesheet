// Configuration
const CONFIG = {
    SUPABASE_URL: 'https://hqmtigcjyqckqdzepcdu.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw',
    DEFAULT_HOURLY_RATE: 23,
    CURRENCY: 'AUD',
    VERSION: '1.3.0'
};

// Global variables
let supabase;
let currentEntryMode = 'daily';
let selectedDaysOfWeek = [];
let selectedMonthDays = [];
let appLocations = [];
let currentEmployeeId = null;
let currentCompanyId = null;
let currentUserRole = null;
const STORAGE_KEYS = {
    token: 'cleaning_timesheet_token',
    role: 'cleaning_timesheet_role',
    company: 'cleaning_timesheet_company'
};

// Initialize App
document.addEventListener('DOMContentLoaded', async function() {
    console.log('✅ DOM Ready');

    const { createClient } = window.supabase;
    supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    window.supabaseClient = supabase;
    window.CONFIG = CONFIG;

    // Load role and company from localStorage
    currentUserRole = localStorage.getItem(STORAGE_KEYS.role) || 'employee';
    currentCompanyId = localStorage.getItem(STORAGE_KEYS.company) ||
        localStorage.getItem('cleaning_timesheet_company_id') ||
        null;

    console.log('Detected role:', currentUserRole);
    console.log('Detected company ID:', currentCompanyId);

    // Check if user is authenticated
    const token = localStorage.getItem(STORAGE_KEYS.token);
    const isAuthenticated = !!token;

    // If not authenticated and on dashboard page, redirect to login
    const isDashboardPage = window.location.pathname.includes('manager.html') || 
                          window.location.pathname.includes('employee.html');
    
    const isAuthPage = window.location.pathname.includes('login.html') || 
                      window.location.pathname.includes('register.html');

    if (!isAuthenticated && isDashboardPage) {
        console.log('Not authenticated, redirecting to login');
        window.location.href = 'login.html';
        return;
    }

    if (isAuthenticated && isAuthPage) {
        // Already logged in, redirect to appropriate dashboard
        if (currentUserRole === 'manager') {
            window.location.href = 'manager.html';
        } else {
            window.location.href = 'employee.html';
        }
        return;
    }

    // Initialize dashboard if on dashboard page
    if (isDashboardPage) {
        try {
            await loadCompanyBranding();
            await initializeDashboard();
        } catch (err) {
            console.error('Dashboard initialization failed:', err);
            showMessage('Dashboard failed to load some features', 'error');
        }
    } else {
        // On login/register pages - just hide loading
        const loading = document.getElementById('loadingScreen');
        if (loading) loading.style.display = 'none';

        const container = document.querySelector('.container');
        if (container) container.style.display = 'block';
    }

    // Setup settings form only if it exists
    setupCompanySettingsForm();
});

// Load and apply company branding
async function loadCompanyBranding() {
    try {
        if (!currentCompanyId) {
            console.warn('No company ID – using defaults');
            return;
        }

        console.log('Loading branding for company:', currentCompanyId);

        const { data: company, error } = await supabase
            .from('companies')
            .select('name, custom_title, primary_color, secondary_color, logo_url')
            .eq('id', currentCompanyId)
            .single();

        if (error) {
            console.warn('Company not found or error:', error.message);
            return;
        }

        if (!company) {
            console.warn('Company not found');
            return;
        }

        // Apply branding
        const title = company.custom_title || 'Cleaning Timesheet';
        
        // Update app title
        const appTitle = document.getElementById('appTitle');
        if (appTitle) {
            const icon = appTitle.querySelector('i');
            if (icon) {
                appTitle.innerHTML = `<i class="${icon.className}"></i> ${title}`;
            } else {
                appTitle.textContent = title;
            }
        }

        // Update footer
        const footer = document.getElementById('footerCompany');
        if (footer) footer.textContent = `${company.name || 'Company'} Timesheet Manager • Powered by Supabase`;

        // Update company name in header
        const companyNameEl = document.getElementById('currentCompanyName');
        if (companyNameEl) companyNameEl.textContent = company.name || 'My Company';

        // Update logo
        if (company.logo_url) {
            const logo = document.getElementById('companyLogo');
            if (logo) {
                logo.src = company.logo_url;
                logo.style.display = 'inline-block';
            }
        }

        // Update colors
        if (company.primary_color) {
            document.documentElement.style.setProperty('--primary-color', company.primary_color);
        }
        if (company.secondary_color) {
            document.documentElement.style.setProperty('--secondary-color', company.secondary_color);
        }

        console.log('✅ Branding applied:', title);

    } catch (err) {
        console.error('❌ Branding load failed:', err);
    }
}

// Initialize dashboard content
async function initializeDashboard() {
    console.log('Initializing dashboard...');

    // Set current date
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        const today = new Date();
        dateEl.textContent = formatDate(today);
    }

    // Test connection
    const connected = await testConnection();
    if (!connected) {
        showMessage('Connection issues – limited functionality', 'error');
    }

    // Hide loading screen and show container
    const loading = document.getElementById('loadingScreen');
    const container = document.querySelector('.container');
    
    if (loading) loading.style.display = 'none';
    if (container) container.style.display = 'block';

    // Load initial data based on user role
    if (currentUserRole === 'manager') {
        await loadManagerDashboard();
    } else {
        await loadEmployeeDashboard();
    }

    showMessage('Dashboard loaded!', 'success');
}

async function loadManagerDashboard() {
    console.log('Loading manager dashboard...');
    
    // Load stats
    try {
        // Get employee count
        const { count: employeeCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', currentCompanyId)
            .eq('role', 'employee');

        // Get upcoming shifts count
        const { count: shiftCount } = await supabase
            .from('shifts')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', currentCompanyId)
            .gte('shift_date', new Date().toISOString().split('T')[0])
            .in('status', ['pending', 'confirmed']);

        // Get scheduled hours (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: shifts, error: shiftsError } = await supabase
            .from('shifts')
            .select('duration')
            .eq('company_id', currentCompanyId)
            .gte('shift_date', thirtyDaysAgo.toISOString().split('T')[0])
            .in('status', ['confirmed', 'completed']);

        let totalHours = 0;
        if (!shiftsError && shifts) {
            totalHours = shifts.reduce((sum, shift) => sum + (parseFloat(shift.duration) || 0), 0);
        }

        // Get pending invites
        const { count: invitesCount } = await supabase
            .from('invitations')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', currentCompanyId)
            .eq('accepted', false);

        // Update UI
        const employeesEl = document.getElementById('statEmployees');
        if (employeesEl) employeesEl.textContent = employeeCount || 0;

        const shiftsEl = document.getElementById('statUpcomingShifts');
        if (shiftsEl) shiftsEl.textContent = shiftCount || 0;

        const hoursEl = document.getElementById('statHours');
        if (hoursEl) hoursEl.textContent = totalHours.toFixed(1);

        const invitesEl = document.getElementById('statPendingInvites');
        if (invitesEl) invitesEl.textContent = invitesCount || 0;

        // Load upcoming shifts list
        await loadManagerUpcomingShifts();

    } catch (err) {
        console.error('Error loading manager stats:', err);
    }
}

async function loadManagerUpcomingShifts() {
    try {
        const shiftsList = document.getElementById('upcomingShiftsList');
        if (!shiftsList) return;

        const { data: shifts, error } = await supabase
            .from('shifts')
            .select(`
                *,
                locations (name),
                staff (name, email)
            `)
            .eq('company_id', currentCompanyId)
            .gte('shift_date', new Date().toISOString().split('T')[0])
            .order('shift_date', { ascending: true })
            .order('start_time', { ascending: true })
            .limit(10);

        if (error) throw error;

        if (!shifts || shifts.length === 0) {
            shiftsList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-calendar" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p>No upcoming shifts scheduled.</p>
                    <p style="font-size: 0.9rem;">Create your first shift using the "Create Shift" button.</p>
                </div>
            `;
            return;
        }

        let html = '';
        shifts.forEach(shift => {
            const locationName = shift.locations?.name || 'Unknown Location';
            const staffName = shift.staff?.name || shift.staff?.email || 'Unassigned';
            const statusClass = getShiftStatusClass ? getShiftStatusClass(shift.status) : 'status-pending';
            
            html += `
                <div class="shift-item">
                    <div class="shift-info">
                        <h4>${escapeHtml(locationName)} 
                            <span class="shift-status ${statusClass}">${shift.status.replace('_', ' ')}</span>
                        </h4>
                        <p>
                            <i class="far fa-calendar"></i> ${formatDate(shift.shift_date)} 
                            • <i class="far fa-clock"></i> ${formatTime(shift.start_time)} 
                            • ${shift.duration} hours
                            • <i class="fas fa-user"></i> ${escapeHtml(staffName)}
                        </p>
                        ${shift.notes ? `<p style="color: #666; font-size: 0.9rem; margin-top: 5px;">
                            <i class="fas fa-sticky-note"></i> ${escapeHtml(shift.notes)}
                        </p>` : ''}
                    </div>
                </div>
            `;
        });

        shiftsList.innerHTML = html;

    } catch (err) {
        console.error('Error loading manager shifts:', err);
    }
}

async function loadEmployeeDashboard() {
    console.log('Loading employee dashboard...');
    
    try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user?.id) {
            currentEmployeeId = user.id;
            
            // Update stats
            await updateEmployeeStats();
            
            // Load shifts if function exists
            if (typeof loadMyShifts === 'function') {
                await loadMyShifts();
            }
            
            // Load past shifts if function exists
            if (typeof loadPastShifts === 'function') {
                await loadPastShifts();
            }
            
            // Load locations if function exists
            if (typeof loadLocations === 'function') {
                await loadLocations();
            }
            
            // Setup timesheet form
            setupTimesheetForm();
        }
    } catch (err) {
        console.error('Error loading employee data:', err);
    }
}

async function updateEmployeeStats() {
    try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // Get staff record
        const { data: staff, error: staffError } = await supabase
            .from('staff')
            .select('id, hourly_rate')
            .eq('user_id', user.id)
            .single();
        
        if (staffError) {
            console.warn('No staff record found:', staffError.message);
            return;
        }
        
        // Get completed shifts count and earnings
        const { data: completedShifts, error: shiftsError } = await supabase
            .from('shifts')
            .select('duration, locations(hourly_rate)')
            .eq('staff_id', staff.id)
            .eq('status', 'completed');

        let completedCount = 0;
        let totalEarnings = 0;
        
        if (!shiftsError && completedShifts) {
            completedCount = completedShifts.length;
            completedShifts.forEach(shift => {
                const rate = shift.locations?.hourly_rate || staff.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE;
                const hours = parseFloat(shift.duration) || 0;
                totalEarnings += hours * rate;
            });
        }

        // Get locations count
        const { count: locationCount } = await supabase
            .from('locations')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        // Get timesheets count
        const { count: timesheetCount } = await supabase
            .from('timesheets')
            .select('*', { count: 'exact', head: true })
            .eq('staff_id', staff.id);

        // Update UI elements if they exist
        const statsCards = document.querySelectorAll('.stat-card');
        if (statsCards.length >= 4) {
            statsCards[0].innerHTML = `
                <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                <div class="stat-info">
                    <h3>Completed Shifts</h3>
                    <div class="stat-value">${completedCount || 0}</div>
                </div>
            `;

            statsCards[1].innerHTML = `
                <div class="stat-icon"><i class="fas fa-map-marker-alt"></i></div>
                <div class="stat-info">
                    <h3>Locations</h3>
                    <div class="stat-value">${locationCount || 0}</div>
                </div>
            `;

            statsCards[2].innerHTML = `
                <div class="stat-icon"><i class="fas fa-file-invoice-dollar"></i></div>
                <div class="stat-info">
                    <h3>Timesheets</h3>
                    <div class="stat-value">${timesheetCount || 0}</div>
                </div>
            `;

            statsCards[3].innerHTML = `
                <div class="stat-icon"><i class="fas fa-money-bill-wave"></i></div>
                <div class="stat-info">
                    <h3>Total Earned</h3>
                    <div class="stat-value">$${totalEarnings.toFixed(2)}</div>
                </div>
            `;

            // Remove loading class
            statsCards.forEach(card => card.classList.remove('loading'));
        }
    } catch (err) {
        console.error('Error updating employee stats:', err);
    }
}

function setupTimesheetForm() {
    const form = document.getElementById('timesheetForm');
    if (!form) return;

    // Load available periods
    loadTimesheetPeriods();

    // Setup email checkbox
    const emailCheckbox = document.getElementById('sendEmail');
    if (emailCheckbox) {
        emailCheckbox.addEventListener('change', function() {
            const emailGroup = document.getElementById('emailGroup');
            if (emailGroup) {
                emailGroup.style.display = this.checked ? 'block' : 'none';
            }
        });
    }

    // Setup custom dates button
    const customDatesBtn = document.getElementById('customDatesBtn');
    if (customDatesBtn) {
        customDatesBtn.addEventListener('click', showCustomDatesPopup);
    }

    // Handle form submission
    form.addEventListener('submit', handleGenerateTimesheet);
}

... (rest of file continues exactly as in repo)
