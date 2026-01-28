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
let currentCompanyId = null;
let currentUserRole = null;

// Initialize App
document.addEventListener('DOMContentLoaded', async function() {
    console.log('✅ DOM Ready');

    const { createClient } = window.supabase;
    supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    window.supabaseClient = supabase;
    window.CONFIG = CONFIG;

    // Load role and company from localStorage
    currentUserRole = localStorage.getItem('cleaning_timesheet_role') || 'employee';
    currentCompanyId = localStorage.getItem('cleaning_timesheet_company_id') || null;

    console.log('Detected role:', currentUserRole);
    console.log('Detected company ID:', currentCompanyId);

    // Check if user is authenticated
    const token = localStorage.getItem('cleaning_timesheet_token');
    const isAuthenticated = !!token;

    // If not authenticated and on dashboard page, redirect to login
    const isDashboardPage = window.location.pathname.includes('manager.html') || 
                          window.location.pathname.includes('index.html');
    
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
            window.location.href = 'index.html';
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
        const appTitle = document.getElementById('appTitle');
        if (appTitle) appTitle.textContent = title;

        const footer = document.getElementById('footerCompany');
        if (footer) footer.textContent = `${company.name || 'Company'} Timesheet Manager • Powered by Supabase`;

        const companyNameEl = document.getElementById('currentCompanyName');
        if (companyNameEl) companyNameEl.textContent = company.name || 'My Company';

        if (company.logo_url) {
            const logo = document.getElementById('companyLogo');
            if (logo) {
                logo.src = company.logo_url;
                logo.style.display = 'inline-block';
            }
        }

        if (company.primary_color) {
            document.documentElement.style.setProperty('--primary-color', company.primary_color);
        }
        if (company.secondary_color) {
            document.documentElement.style.setProperty('--secondary-color', company.secondary_color);
        }

        console.log('Branding applied:', title);

    } catch (err) {
        console.error('Branding load failed:', err);
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
        const { count: employeeCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', currentCompanyId)
            .eq('role', 'employee');

        const { count: shiftCount } = await supabase
            .from('shifts')
            .select('*', { count: 'exact', head: true })
            .gte('shift_date', new Date().toISOString().split('T')[0]);

        // Update UI
        const employeesEl = document.getElementById('statEmployees');
        if (employeesEl) employeesEl.textContent = employeeCount || 0;

        const shiftsEl = document.getElementById('statUpcomingShifts');
        if (shiftsEl) shiftsEl.textContent = shiftCount || 0;

        const hoursEl = document.getElementById('statHours');
        if (hoursEl) hoursEl.textContent = '0'; // Placeholder

        const invitesEl = document.getElementById('statPendingInvites');
        if (invitesEl) invitesEl.textContent = '0'; // Placeholder

    } catch (err) {
        console.error('Error loading manager stats:', err);
    }
}

async function loadEmployeeDashboard() {
    console.log('Loading employee dashboard...');
    
    // Get current user's employee profile
    try {
        const { data: profile } = await supabase.auth.getUser();
        
        if (profile?.user?.id) {
            // Get employee details from profiles table
            const { data: employeeProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', profile.user.id)
                .single();

            if (employeeProfile) {
                currentEmployeeId = employeeProfile.id;
                
                // Update stats
                updateEmployeeStats();
                
                // Load shifts
                if (typeof loadMyShifts === 'function') {
                    await loadMyShifts();
                }
            }
        }
    } catch (err) {
        console.error('Error loading employee data:', err);
    }
}

async function updateEmployeeStats() {
    try {
        // Get completed shifts count
        const { count: completedShifts } = await supabase
            .from('shifts')
            .select('*', { count: 'exact', head: true })
            .eq('staff_id', currentEmployeeId)
            .eq('status', 'completed');

        // Get locations count
        const { count: locationCount } = await supabase
            .from('locations')
            .select('*', { count: 'exact', head: true });

        // Get timesheets count
        const { count: timesheetCount } = await supabase
            .from('timesheets')
            .select('*', { count: 'exact', head: true });

        // Update UI elements if they exist
        const statsCards = document.querySelectorAll('.stat-card');
        if (statsCards.length >= 4) {
            statsCards[0].innerHTML = `
                <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                <div class="stat-info">
                    <h3>Completed Shifts</h3>
                    <div class="stat-value">${completedShifts || 0}</div>
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
                    <div class="stat-value">$0</div>
                </div>
            `;

            // Remove loading class
            statsCards.forEach(card => card.classList.remove('loading'));
        }
    } catch (err) {
        console.error('Error updating employee stats:', err);
    }
}

// Test database connection
async function testConnection() {
    try {
        console.log('🔌 Testing Supabase connection...');
        const { data, error } = await supabase
            .from('locations')
            .select('count', { count: 'exact', head: true });
        
        if (error) throw error;
        
        console.log('✅ Database connection successful');
        
        // Update connection status if element exists
        const statusDiv = document.getElementById('connectionStatus');
        if (statusDiv) {
            statusDiv.innerHTML = '<i class="fas fa-wifi"></i><span>Connected</span>';
            statusDiv.style.color = '#28a745';
        }
        
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        
        const statusDiv = document.getElementById('connectionStatus');
        if (statusDiv) {
            statusDiv.innerHTML = '<i class="fas fa-wifi"></i><span>Disconnected</span>';
            statusDiv.style.color = '#dc3545';
        }
        
        return false;
    }
}

// Company settings form
function setupCompanySettingsForm() {
    const form = document.getElementById('companySettingsForm');
    if (!form) return;

    loadCurrentCompanySettings();

    document.getElementById('logoUpload')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('logoPreview').innerHTML = 
                    `<img src="${ev.target.result}" style="max-height:80px; max-width:100%;">`;
            };
            reader.readAsDataURL(file);
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveCompanySettings();
    });
}

async function loadCurrentCompanySettings() {
    if (!currentCompanyId) return;

    const { data: company, error } = await supabase
        .from('companies')
        .select('custom_title, primary_color, secondary_color, default_pay_frequency')
        .eq('id', currentCompanyId)
        .single();

    if (error || !company) return;

    const titleInput = document.getElementById('companyTitle');
    const primaryColorInput = document.getElementById('primaryColor');
    const secondaryColorInput = document.getElementById('secondaryColor');
    const payFreqSelect = document.getElementById('defaultPayFrequency');

    if (titleInput) titleInput.value = company.custom_title || 'Cleaning Timesheet';
    if (primaryColorInput) primaryColorInput.value = company.primary_color || '#667eea';
    if (secondaryColorInput) secondaryColorInput.value = company.secondary_color || '#764ba2';
    if (payFreqSelect) payFreqSelect.value = company.default_pay_frequency || 'weekly';
}

async function saveCompanySettings() {
    if (!currentCompanyId) {
        showMessage('No company selected – cannot save', 'error');
        return;
    }

    const title = document.getElementById('companyTitle')?.value.trim() || 'Cleaning Timesheet';
    const primary = document.getElementById('primaryColor')?.value || '#667eea';
    const secondary = document.getElementById('secondaryColor')?.value || '#764ba2';
    const payFreq = document.getElementById('defaultPayFrequency')?.value || 'weekly';

    const updates = {
        custom_title: title,
        primary_color: primary,
        secondary_color: secondary,
        default_pay_frequency: payFreq,
        updated_at: new Date().toISOString()
    };

    const { error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', currentCompanyId);

    if (error) {
        showMessage('Save failed: ' + error.message, 'error');
        return;
    }

    showMessage('Settings saved!', 'success');
    await loadCompanyBranding();
}

function previewBrandingChanges() {
    const primary = document.getElementById('primaryColor')?.value || '#667eea';
    const secondary = document.getElementById('secondaryColor')?.value || '#764ba2';
    const title = document.getElementById('companyTitle')?.value.trim() || 'Cleaning Timesheet';

    document.documentElement.style.setProperty('--primary-color', primary);
    document.documentElement.style.setProperty('--secondary-color', secondary);
    
    const appTitle = document.getElementById('appTitle');
    if (appTitle) appTitle.textContent = title;

    showMessage('Preview applied!', 'info');
}

// Placeholder actions
function showInviteEmployeeModal() { 
    showMessage('Invite employee – coming soon', 'info'); 
}

function showCreateShiftModal() { 
    showMessage('Create shift – coming soon', 'info'); 
}

function viewAllTimesheets() { 
    showMessage('Timesheets – coming soon', 'info'); 
}

function showCompanySettings() {
    const card = document.getElementById('companySettingsCard');
    if (card) {
        card.style.display = 'block';
        card.scrollIntoView({ behavior: 'smooth' });
    }
}

function refreshShifts() { 
    showMessage('Refreshing...', 'info'); 
}

console.log('🎉 Script loaded');
