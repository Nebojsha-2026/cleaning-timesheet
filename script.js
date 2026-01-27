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

    // Load role and company from localStorage (set by auth.js)
    currentUserRole = localStorage.getItem('cleaning_timesheet_role') || 'employee';
    currentCompanyId = localStorage.getItem('cleaning_timesheet_company_id') || null;

    console.log('Detected role:', currentUserRole);
    console.log('Detected company ID:', currentCompanyId);

    // Only run dashboard-specific code on actual dashboard pages
    const isDashboardPage = window.location.pathname.includes('manager.html') || 
                           window.location.pathname.includes('index.html');

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
            showMessage('No company selected – using default branding', 'info');
            return;
        }

        console.log('Loading branding for company:', currentCompanyId);

        const { data: company, error } = await supabase
            .from('companies')
            .select('name, custom_title, primary_color, secondary_color, logo_url')
            .eq('id', currentCompanyId)
            .single();

        if (error) throw error;
        if (!company) {
            console.warn('Company not found');
            showMessage('Company not found – using defaults', 'info');
            return;
        }

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

// Initialize dashboard content (only called on dashboard pages)
async function initializeDashboard() {
    console.log('Initializing dashboard...');

    const connected = await testConnection();
    if (!connected) {
        showMessage('Connection issues – limited functionality', 'error');
    }

    // Set date - safe check
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        const today = new Date();
        dateEl.textContent = formatDate(today);
    }

    // Stats - safe check
    const employeesEl = document.getElementById('statEmployees');
    if (employeesEl) employeesEl.textContent = '8';

    const shiftsEl = document.getElementById('statUpcomingShifts');
    if (shiftsEl) shiftsEl.textContent = '14';

    const hoursEl = document.getElementById('statHours');
    if (hoursEl) hoursEl.textContent = '112';

    const invitesEl = document.getElementById('statPendingInvites');
    if (invitesEl) invitesEl.textContent = '3';

    showMessage('Dashboard loaded!', 'success');
}

// Company settings form (only if exists)
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

    document.getElementById('companyTitle').value = company.custom_title || 'Cleaning Timesheet';
    document.getElementById('primaryColor').value = company.primary_color || '#667eea';
    document.getElementById('secondaryColor').value = company.secondary_color || '#764ba2';
    document.getElementById('defaultPayFrequency').value = company.default_pay_frequency || 'weekly';
}

async function saveCompanySettings() {
    if (!currentCompanyId) {
        showMessage('No company selected – cannot save', 'error');
        return;
    }

    const title = document.getElementById('companyTitle').value.trim();
    const primary = document.getElementById('primaryColor').value;
    const secondary = document.getElementById('secondaryColor').value;
    const payFreq = document.getElementById('defaultPayFrequency').value;
    const file = document.getElementById('logoUpload').files[0];

    let logoUrl = null;

    if (file) {
        showMessage('Logo upload coming soon – using placeholder', 'info');
        logoUrl = 'https://placehold.co/200x60/' + primary.replace('#','') + '/ffffff/png?text=' + encodeURIComponent(title.substring(0,3));
    }

    const updates = {
        custom_title: title || 'Cleaning Timesheet',
        primary_color: primary,
        secondary_color: secondary,
        default_pay_frequency: payFreq,
        ...(logoUrl && { logo_url: logoUrl })
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
    const primary = document.getElementById('primaryColor').value;
    const secondary = document.getElementById('secondaryColor').value;
    const title = document.getElementById('companyTitle').value.trim() || 'Cleaning Timesheet';

    document.documentElement.style.setProperty('--primary-color', primary);
    document.documentElement.style.setProperty('--secondary-color', secondary);
    const appTitle = document.getElementById('appTitle');
    if (appTitle) appTitle.textContent = title;

    showMessage('Preview applied!', 'info');
}

// Placeholder actions
function showInviteEmployeeModal() { showMessage('Invite employee – coming soon', 'info'); }
function showCreateShiftModal() { showMessage('Create shift – coming soon', 'info'); }
function viewAllTimesheets() { showMessage('Timesheets – coming soon', 'info'); }
function showCompanySettings() {
    const card = document.getElementById('companySettingsCard');
    if (card) {
        card.style.display = 'block';
        card.scrollIntoView({ behavior: 'smooth' });
    }
}
function refreshShifts() { showMessage('Refreshing...', 'info'); }

console.log('🎉 Script loaded');
