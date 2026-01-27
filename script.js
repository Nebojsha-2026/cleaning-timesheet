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

    // Very basic role/company detection for now
    currentUserRole = localStorage.getItem('cleaning_timesheet_role') || 'manager';
    currentCompanyId = localStorage.getItem('cleaning_timesheet_company_id');

    if (currentUserRole !== 'manager') {
        alert('Access denied. This is the manager dashboard.');
        window.location.href = 'index.html';
        return;
    }

    await loadCompanyBranding();
    await initializeDashboard();

    document.getElementById('loadingScreen').style.display = 'none';
    document.querySelector('.container').style.display = 'block';

    // Load initial stats (placeholders)
    document.getElementById('statEmployees').textContent = '8';
    document.getElementById('statUpcomingShifts').textContent = '14';
    document.getElementById('statHours').textContent = '112';
    document.getElementById('statPendingInvites').textContent = '3';

    // Company settings form handlers
    setupCompanySettingsForm();
});

// Load and apply company branding
async function loadCompanyBranding() {
    try {
        if (!currentCompanyId) return;

        const { data: company, error } = await supabase
            .from('companies')
            .select('name, custom_title, primary_color, secondary_color, logo_url')
            .eq('id', currentCompanyId)
            .single();

        if (error) throw error;
        if (!company) return;

        // Apply to UI
        const title = company.custom_title || 'Cleaning Timesheet';
        document.getElementById('appTitle').textContent = title;
        document.getElementById('footerCompany').textContent = `${company.name || 'Company'} Timesheet Manager • Powered by Supabase`;
        document.getElementById('currentCompanyName').textContent = company.name || 'My Company';

        if (company.logo_url) {
            const logo = document.getElementById('companyLogo');
            logo.src = company.logo_url;
            logo.style.display = 'inline-block';
        }

        // Colors
        if (company.primary_color) {
            document.documentElement.style.setProperty('--primary-color', company.primary_color);
        }
        if (company.secondary_color) {
            document.documentElement.style.setProperty('--secondary-color', company.secondary_color);
        }

    } catch (err) {
        console.error('Could not load company branding', err);
    }
}

// Setup company settings form
function setupCompanySettingsForm() {
    const form = document.getElementById('companySettingsForm');
    if (!form) return;

    // Load current values
    loadCurrentCompanySettings();

    // Logo preview
    document.getElementById('logoUpload').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(ev) {
                document.getElementById('logoPreview').innerHTML = `<img src="${ev.target.result}" style="max-height:80px;">`;
            };
            reader.readAsDataURL(file);
        }
    });

    // Form submit
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveCompanySettings();
    });
}

async function loadCurrentCompanySettings() {
    if (!currentCompanyId) return;

    const { data: company } = await supabase
        .from('companies')
        .select('custom_title, primary_color, secondary_color, default_pay_frequency')
        .eq('id', currentCompanyId)
        .single();

    if (company) {
        document.getElementById('companyTitle').value = company.custom_title || 'Cleaning Timesheet';
        document.getElementById('primaryColor').value = company.primary_color || '#667eea';
        document.getElementById('secondaryColor').value = company.secondary_color || '#764ba2';
        document.getElementById('defaultPayFrequency').value = company.default_pay_frequency || 'weekly';
    }
}

async function saveCompanySettings() {
    const title = document.getElementById('companyTitle').value.trim();
    const primary = document.getElementById('primaryColor').value;
    const secondary = document.getElementById('secondaryColor').value;
    const payFreq = document.getElementById('defaultPayFrequency').value;
    const file = document.getElementById('logoUpload').files[0];

    let logoUrl = null;

    if (file) {
        // In real version → upload to Supabase Storage
        // For now we just show message
        showMessage('Logo upload will be implemented in next step', 'info');
        // Placeholder: pretend we have a URL
        logoUrl = 'https://via.placeholder.com/150x50/667eea/ffffff?text=' + encodeURIComponent(title.substring(0,3));
    }

    const updates = {
        custom_title: title,
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
        showMessage('Error saving settings: ' + error.message, 'error');
        return;
    }

    showMessage('Company settings saved!', 'success');

    // Apply immediately
    await loadCompanyBranding();
}

function previewBrandingChanges() {
    const primary = document.getElementById('primaryColor').value;
    const secondary = document.getElementById('secondaryColor').value;
    const title = document.getElementById('companyTitle').value.trim() || 'Cleaning Timesheet';

    document.documentElement.style.setProperty('--primary-color', primary);
    document.documentElement.style.setProperty('--secondary-color', secondary);
    document.getElementById('appTitle').textContent = title;

    showMessage('Preview applied! Click Save to keep changes.', 'info');
}

// Placeholder functions (to be implemented later)
function showInviteEmployeeModal() { alert('Invite employee modal coming soon'); }
function showCreateShiftModal() { alert('Create shift modal coming soon'); }
function viewAllTimesheets() { alert('All timesheets view coming soon'); }
function showCompanySettings() {
    document.getElementById('companySettingsCard').style.display = 'block';
    document.getElementById('companySettingsCard').scrollIntoView({ behavior: 'smooth' });
}
function refreshShifts() { alert('Refreshing all shifts...'); }

// Reuse your existing showMessage function from utils.js
function showMessage(text, type = 'info') {
    // Your existing implementation or simple alert for now
    alert(`[${type.toUpperCase()}] ${text}`);
}

console.log('🎉 Manager dashboard ready');
