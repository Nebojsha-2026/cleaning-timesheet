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
    console.log('✅ DOM Ready – Manager version');

    const { createClient } = window.supabase;
    supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    window.supabaseClient = supabase;
    window.CONFIG = CONFIG;

    // Fake auth detection (for testing)
    currentUserRole = localStorage.getItem('cleaning_timesheet_role') || 'manager';
    currentCompanyId = localStorage.getItem('cleaning_timesheet_company_id') || null;

    console.log('Detected role:', currentUserRole);
    console.log('Detected company ID:', currentCompanyId);

    // Temporarily disabled strict role check so page can load for testing
    // if (currentUserRole !== 'manager') {
    //     alert('Access denied. This is the manager dashboard.');
    //     window.location.href = 'index.html';
    //     return;
    // }

    try {
        await loadCompanyBranding();
        await initializeDashboard();
    } catch (err) {
        console.error('Initialization failed:', err);
        showMessage('Failed to initialize dashboard. Check console.', 'error');
    }

    // Hide loading screen regardless (safety net)
    document.getElementById('loadingScreen').style.display = 'none';
    document.querySelector('.container').style.display = 'block';

    // Setup form handlers
    setupCompanySettingsForm();
});

// Load and apply company branding
async function loadCompanyBranding() {
    try {
        if (!currentCompanyId) {
            console.log('No company ID in localStorage → using defaults');
            showMessage('No company selected – using default branding', 'info');
            return;
        }

        const { data: company, error } = await supabase
            .from('companies')
            .select('name, custom_title, primary_color, secondary_color, logo_url')
            .eq('id', currentCompanyId)
            .single();

        if (error) throw error;
        if (!company) {
            console.log('No company found for ID:', currentCompanyId);
            showMessage('Company not found – using defaults', 'info');
            return;
        }

        // Apply title
        const title = company.custom_title || 'Cleaning Timesheet';
        document.getElementById('appTitle').textContent = title;
        document.getElementById('footerCompany').textContent = `${company.name || 'Company'} Timesheet Manager • Powered by Supabase`;
        document.getElementById('currentCompanyName').textContent = company.name || 'My Company';

        // Apply logo if exists
        if (company.logo_url) {
            const logo = document.getElementById('companyLogo');
            logo.src = company.logo_url;
            logo.style.display = 'inline-block';
        }

        // Apply colors
        if (company.primary_color) {
            document.documentElement.style.setProperty('--primary-color', company.primary_color);
        }
        if (company.secondary_color) {
            document.documentElement.style.setProperty('--secondary-color', company.secondary_color);
        }

        console.log('✅ Branding applied:', title, company.primary_color, company.secondary_color);

    } catch (err) {
        console.error('Branding load failed:', err);
        showMessage('Could not load company branding (using defaults)', 'info');
    }
}

// Initialize dashboard content
async function initializeDashboard() {
    console.log('Initializing manager dashboard...');

    // Test connection
    const connected = await testConnection();
    if (!connected) {
        showMessage('Connection issues detected – some features limited', 'error');
    }

    // Set current date
    const today = new Date();
    document.getElementById('currentDate').textContent = formatDate(today);

    // Placeholder stats (replace with real data later)
    document.getElementById('statEmployees').textContent = '8';
    document.getElementById('statUpcomingShifts').textContent = '14';
    document.getElementById('statHours').textContent = '112';
    document.getElementById('statPendingInvites').textContent = '3';

    showMessage('Manager dashboard loaded successfully!', 'success');

    console.log('Dashboard initialization complete');
}

// Company settings form setup
function setupCompanySettingsForm() {
    const form = document.getElementById('companySettingsForm');
    if (!form) {
        console.warn('Company settings form not found');
        return;
    }

    loadCurrentCompanySettings();

    // Logo preview
    document.getElementById('logoUpload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('logoPreview').innerHTML = 
                    `<img src="${ev.target.result}" style="max-height:80px; max-width:100%; border-radius:4px;">`;
            };
            reader.readAsDataURL(file);
        }
    });

    // Submit handler
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveCompanySettings();
    });
}

// Load current company settings into form
async function loadCurrentCompanySettings() {
    if (!currentCompanyId) return;

    const { data: company, error } = await supabase
        .from('companies')
        .select('custom_title, primary_color, secondary_color, default_pay_frequency')
        .eq('id', currentCompanyId)
        .single();

    if (error || !company) {
        console.warn('No company settings found');
        return;
    }

    document.getElementById('companyTitle').value = company.custom_title || 'Cleaning Timesheet';
    document.getElementById('primaryColor').value = company.primary_color || '#667eea';
    document.getElementById('secondaryColor').value = company.secondary_color || '#764ba2';
    document.getElementById('defaultPayFrequency').value = company.default_pay_frequency || 'weekly';
}

// Save company settings
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
        // Placeholder for future real upload
        showMessage('Logo upload coming soon – using placeholder for now', 'info');
        logoUrl = 'https://via.placeholder.com/200x60/667eea/ffffff?text=' + encodeURIComponent(title.substring(0,3));
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
        console.error('Save error:', error);
        return;
    }

    showMessage('Settings saved successfully!', 'success');
    await loadCompanyBranding(); // Re-apply live changes
}

// Preview button handler
function previewBrandingChanges() {
    const primary = document.getElementById('primaryColor').value;
    const secondary = document.getElementById('secondaryColor').value;
    const title = document.getElementById('companyTitle').value.trim() || 'Cleaning Timesheet';

    document.documentElement.style.setProperty('--primary-color', primary);
    document.documentElement.style.setProperty('--secondary-color', secondary);
    document.getElementById('appTitle').textContent = title;

    showMessage('Preview applied! Save to keep changes.', 'info');
}

// Placeholder action functions
function showInviteEmployeeModal() { showMessage('Invite employee modal – coming soon', 'info'); }
function showCreateShiftModal() { showMessage('Create shift modal – coming soon', 'info'); }
function viewAllTimesheets() { showMessage('Timesheets overview – coming soon', 'info'); }
function showCompanySettings() {
    const card = document.getElementById('companySettingsCard');
    if (card) {
        card.style.display = 'block';
        card.scrollIntoView({ behavior: 'smooth' });
    }
}
function refreshShifts() { showMessage('Refreshing shifts...', 'info'); }

console.log('🎉 Manager dashboard script fully loaded');
