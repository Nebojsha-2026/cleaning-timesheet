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

    try {
        await loadCompanyBranding();
        await initializeDashboard();
    } catch (err) {
        console.error('Initialization failed:', err);
        showMessage('Failed to initialize dashboard. Check console.', 'error');
    }

    // Hide loading screen
    document.getElementById('loadingScreen').style.display = 'none';
    document.querySelector('.container').style.display = 'block';

    // Setup form handlers
    setupCompanySettingsForm();
});

// Load and apply company branding
async function loadCompanyBranding() {
    try {
        if (!currentCompanyId) {
            console.warn('No company ID in localStorage – skipping branding load');
            showMessage('No company selected yet (settings will use defaults)', 'info');
            return;
        }

        console.log('Loading branding for company ID:', currentCompanyId);

        const { data: company, error } = await supabase
            .from('companies')
            .select('name, custom_title, primary_color, secondary_color, logo_url')
            .eq('id', currentCompanyId)
            .single();

        if (error) throw error;
        if (!company) {
            console.warn('No company row found for ID:', currentCompanyId);
            showMessage('Company data not found – using defaults', 'info');
            return;
        }

        const title = company.custom_title || 'Cleaning Timesheet';
        document.getElementById('appTitle').textContent = title;
        document.getElementById('footerCompany').textContent = `${company.name || 'Company'} Timesheet Manager • Powered by Supabase`;
        document.getElementById('currentCompanyName').textContent = company.name || 'My Company';

        if (company.logo_url) {
            const logo = document.getElementById('companyLogo');
            logo.src = company.logo_url;
            logo.style.display = 'inline-block';
            console.log('Logo loaded from:', company.logo_url);
        } else {
            document.getElementById('companyLogo').style.display = 'none';
        }

        if (company.primary_color) {
            document.documentElement.style.setProperty('--primary-color', company.primary_color);
            console.log('Primary color applied:', company.primary_color);
        }
        if (company.secondary_color) {
            document.documentElement.style.setProperty('--secondary-color', company.secondary_color);
            console.log('Secondary color applied:', company.secondary_color);
        }

        showMessage('Company branding loaded: ' + title, 'success');

    } catch (err) {
        console.error('Branding load failed:', err.message);
        showMessage('Failed to load branding: ' + (err.message || 'Unknown error'), 'error');
    }
}

// Initialize dashboard content
async function initializeDashboard() {
    console.log('Initializing manager dashboard...');

    const connected = await testConnection();
    if (!connected) {
        showMessage('Connection issues detected – some features limited', 'error');
    }

    const today = new Date();
    document.getElementById('currentDate').textContent = formatDate(today);

    // Placeholder stats – replace with real queries later
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

    try {
        const { data: company, error } = await supabase
            .from('companies')
            .select('custom_title, primary_color, secondary_color, default_pay_frequency')
            .eq('id', currentCompanyId)
            .single();

        if (error) {
            console.warn('Settings load query failed:', error.message);
            return;
        }

        if (!company) return;

        document.getElementById('companyTitle').value = company.custom_title || 'Cleaning Timesheet';
        document.getElementById('primaryColor').value = company.primary_color || '#667eea';
        document.getElementById('secondaryColor').value = company.secondary_color || '#764ba2';
        document.getElementById('defaultPayFrequency').value = company.default_pay_frequency || 'weekly';

        console.log('Form loaded with:', company);
    } catch (err) {
        console.error('Settings load error:', err);
    }
}

// Save company settings – with REAL logo upload to Supabase Storage
async function saveCompanySettings() {
    if (!currentCompanyId) {
        showMessage('No company selected – cannot save settings', 'error');
        return;
    }

    const title = document.getElementById('companyTitle').value.trim();
    const primary = document.getElementById('primaryColor').value;
    const secondary = document.getElementById('secondaryColor').value;
    const payFreq = document.getElementById('defaultPayFrequency').value;
    const file = document.getElementById('logoUpload').files[0];

    let logoUrl = null;

    try {
        if (file) {
            showMessage('Uploading logo...', 'info');

            const fileExt = file.name.split('.').pop();
            const fileName = `${currentCompanyId}-${Date.now()}.${fileExt}`;
            const filePath = `logos/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('company-logos')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('company-logos')
                .getPublicUrl(filePath);

            logoUrl = publicUrlData.publicUrl;
            console.log('Logo uploaded to:', logoUrl);

            showMessage('Logo uploaded successfully!', 'success');
        }

        const updates = {
            custom_title: title || 'Cleaning Timesheet',
            primary_color: primary,
            secondary_color: secondary,
            default_pay_frequency: payFreq,
            ...(logoUrl && { logo_url: logoUrl })
        };

        const { error: updateError } = await supabase
            .from('companies')
            .update(updates)
            .eq('id', currentCompanyId);

        if (updateError) throw updateError;

        showMessage('Company settings saved! Reloading to apply changes...', 'success');

        // Reload page to show new logo + branding
        setTimeout(() => location.reload(), 1500);

    } catch (err) {
        console.error('Save failed:', err);
        showMessage('Error saving settings: ' + (err.message || 'Unknown error'), 'error');
    }
}

// Preview button handler
function previewBrandingChanges() {
    const primary = document.getElementById('primaryColor').value;
    const secondary = document.getElementById('secondaryColor').value;
    const title = document.getElementById('companyTitle').value.trim() || 'Cleaning Timesheet';

    document.documentElement.style.setProperty('--primary-color', primary);
    document.documentElement.style.setProperty('--secondary-color', secondary);
    document.getElementById('appTitle').textContent = title;

    showMessage('Preview applied! Click "Save Settings" to keep changes.', 'info');
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
