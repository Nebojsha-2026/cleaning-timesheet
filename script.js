(async function () {
    // Configuration
    const CONFIG = {
        SUPABASE_URL: 'https://hqmtigcjyqckqdzepcdu.supabase.co',
        SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw',
        DEFAULT_HOURLY_RATE: 23,
        CURRENCY: 'AUD',
        VERSION: '1.3.1'
    };

    // Global variables (scoped inside this IIFE to avoid collisions with modules/auth.js)
    let supabase;
    let currentEntryMode = 'daily';
    let selectedDaysOfWeek = [];
    let selectedMonthDays = [];
    let appLocations = [];
    let currentEmployeeId = null;
    let currentCompanyId = null;
    let currentUserRole = null;

    // ✅ Storage keys aligned with modules/auth.js
    const STORAGE_KEYS = {
        token: 'cleaning_timesheet_token',
        role: 'cleaning_timesheet_role',
        company: 'cleaning_timesheet_company_id'
    };

    // ---------- Helpers ----------
    function safeStatusText(status) {
        const s = String(status || 'pending');
        return s.replace('_', ' ');
    }

    function shiftStartDateTime(shift_date, start_time) {
        const t = (start_time || '00:00').slice(0, 5);
        return new Date(`${shift_date}T${t}:00`);
    }

    function canManagerCancelShift(shift) {
        const status = String(shift.status || '').toLowerCase();
        if (['cancelled', 'completed'].includes(status)) return false;

        if (!shift.shift_date || !shift.start_time) return false;
        const start = shiftStartDateTime(shift.shift_date, shift.start_time);
        const diffHours = (start.getTime() - new Date().getTime()) / (1000 * 60 * 60);
        return diffHours >= 1;
    }

    async function doManagerCancel(shiftId) {
        // Use cancel module if present (adds notifications + checks)
        if (typeof window.cancelShiftAsManager === 'function') {
            await window.cancelShiftAsManager(shiftId);
            return;
        }

        // Fallback: just cancel in DB
        const { error } = await supabase
            .from('shifts')
            .update({ status: 'cancelled' })
            .eq('id', shiftId);

        if (error) throw error;
    }

    // ---------- Dropdown Menu Controller ----------
    function setupUserMenuDropdown() {
        // Supports BOTH HTML styles:
        //  - button.menu-btn + div.dropdown
        //  - button.user-menu-button + div.user-menu-dropdown
        const menuRoot = document.querySelector('.user-menu');
        if (!menuRoot) return;

        const btn =
            menuRoot.querySelector('.menu-btn') ||
            menuRoot.querySelector('.user-menu-button');

        const dropdown =
            menuRoot.querySelector('.dropdown') ||
            menuRoot.querySelector('.user-menu-dropdown');

        if (!btn || !dropdown) {
            console.warn('⚠️ User menu exists but missing button or dropdown element.');
            return;
        }

        const OPEN_CLASS = 'open';

        const closeMenu = () => dropdown.classList.remove(OPEN_CLASS);
        const openMenu = () => dropdown.classList.add(OPEN_CLASS);
        const toggleMenu = () => dropdown.classList.toggle(OPEN_CLASS);

        // Prevent duplicate handlers if script reloaded
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleMenu();
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!menuRoot.contains(e.target)) closeMenu();
        });

        // Close on ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeMenu();
        });

        // Close when selecting any item
        dropdown.addEventListener('click', (e) => {
            const target = e.target.closest('a,button');
            if (target) closeMenu();
        });

        console.log('✅ User menu dropdown wired');
    }

    // Initialize App
    document.addEventListener('DOMContentLoaded', async function () {
        console.log('✅ DOM Ready');

        // ✅ Reuse existing Supabase client to avoid duplicate GoTrue instances
        if (window.supabaseClient && window.supabaseClient.auth) {
            supabase = window.supabaseClient;
        } else {
            const { createClient } = window.supabase;
            supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
            window.supabaseClient = supabase;
        }

        // Make CONFIG available globally for modules that expect it
        window.CONFIG = CONFIG;

        // Hook dropdown menu (manager + employee)
        setupUserMenuDropdown();

        // Load role and company from localStorage
        currentUserRole = localStorage.getItem(STORAGE_KEYS.role) || 'employee';
        currentCompanyId =
            localStorage.getItem(STORAGE_KEYS.company) ||
            // Back-compat fallback (older key)
            localStorage.getItem('cleaning_timesheet_company') ||
            null;

        console.log('Detected role:', currentUserRole);
        console.log('Detected company ID:', currentCompanyId);

        // ✅ Auth check must use Supabase session (NOT localStorage token)
const isDashboardPage =
  window.location.pathname.includes('manager.html') ||
  window.location.pathname.includes('employee.html');

const isAuthPage =
  window.location.pathname.includes('login.html') ||
  window.location.pathname.includes('register.html');

let sessionUser = null;

try {
  const { data: { session } } = await supabase.auth.getSession();
  sessionUser = session?.user || null;

  // Keep your legacy localStorage token in sync (so older code still works)
  const accessToken = session?.access_token || '';
  if (accessToken) localStorage.setItem(STORAGE_KEYS.token, accessToken);
  else localStorage.removeItem(STORAGE_KEYS.token);

} catch (e) {
  console.warn('Session check failed:', e?.message || e);
}

const isAuthenticated = !!sessionUser;

if (!isAuthenticated && isDashboardPage) {
  console.log('Not authenticated (no Supabase session), redirecting to login');
  window.location.href = 'login.html';
  return;
}

if (isAuthenticated && isAuthPage) {
  // Already logged in, redirect to appropriate dashboard
  currentUserRole = localStorage.getItem(STORAGE_KEYS.role) || 'employee';
  window.location.href = (currentUserRole === 'manager') ? 'manager.html' : 'employee.html';
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
                if (typeof window.showMessage === 'function') {
                    window.showMessage('Dashboard failed to load some features', 'error');
                } else {
                    alert('Dashboard failed to load some features');
                }
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

        console.log('🎉 Script loaded');
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
            if (typeof window.showMessage === 'function') {
                window.showMessage('Connection issues – limited functionality', 'error');
            }
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

        if (typeof window.showMessage === 'function') {
            window.showMessage('Dashboard loaded!', 'success');
        }
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
                    id, company_id, shift_date, start_time, duration, status, notes, staff_id, recurring_shift_id,
                    locations (name),
                    staff (name, email)
                `)
                .eq('company_id', currentCompanyId)
                .gte('shift_date', new Date().toISOString().split('T')[0])
                .in('status', ['confirmed', 'pending'])
                .order('shift_date', { ascending: true })
                .order('start_time', { ascending: true })
                .limit(5);
            
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

                const isOffered = !shift.staff_id;
                if (!isOffered && String(shift.status || '').toLowerCase() !== 'confirmed') return;
                const staffName = isOffered ? 'Offered' : (shift.staff?.name || shift.staff?.email || 'Unassigned');
                
                const statusClass = (typeof getShiftStatusClass === 'function')
                    ? getShiftStatusClass(isOffered ? 'pending' : shift.status)
                    : 'status-pending';

               const statusText = isOffered ? 'offered' : safeStatusText(shift.status);

                const recurringBadge = shift.recurring_shift_id
                    ? `<span class="offer-badge">RECURRING</span>`
                    : '';

                const cancelBtn = canManagerCancelShift(shift)
                    ? `<div class="shift-actions-employee" style="margin-top:12px;">
                           <button class="btn btn-sm btn-danger manager-cancel-btn" data-id="${shift.id}">
                               <i class="fas fa-ban"></i> Cancel Shift
                           </button>
                       </div>`
                    : '';

                html += `
                    <div class="shift-item" data-shift-id="${shift.id}">
                        <div class="shift-info">
                        
                            <h4>${escapeHtml(locationName)} 
                                ${recurringBadge}
                                <span class="shift-status ${statusClass}">${statusText}</span>
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
                            ${cancelBtn}
                        </div>
                    </div>
                `;
            });

            shiftsList.innerHTML = html || `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-calendar" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p>No upcoming confirmed or offered shifts.</p>
                    <p style="font-size: 0.9rem;">Create your first shift using the "Create Shift" button.</p>
                </div>
            `;
            
            // Hook cancel buttons
            shiftsList.querySelectorAll('.manager-cancel-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    try {
                        if (!confirm('Cancel this shift?')) return;
                        await doManagerCancel(id);
                        if (typeof window.showMessage === 'function') {
                            window.showMessage('✅ Shift cancelled', 'success');
                        }
                        await loadManagerDashboard(); // refresh stats + hours + list
                    } catch (e) {
                        console.error(e);
                        if (typeof window.showMessage === 'function') {
                            window.showMessage('❌ ' + (e.message || 'Cancel failed'), 'error');
                        }
                    }
                });
            });

        } catch (err) {
            console.error('Error loading manager shifts:', err);
        }
    }

    // ✅ Expose for modules/manager-shifts.js to call after creating a shift
    window.loadManagerUpcomingShifts = loadManagerUpcomingShifts;

    async function loadEmployeeDashboard() {
        console.log('Loading employee dashboard...');

        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (user?.id) {
                currentEmployeeId = user.id;

                 if (typeof updateEmployeeStats === 'function') {
                    await updateEmployeeStats();
                }

                if (typeof loadMyShifts === 'function') await loadMyShifts();
                if (typeof loadPastShifts === 'function') await loadPastShifts();
                if (typeof loadLocations === 'function') await loadLocations();

                setupTimesheetForm();
            }
        } catch (err) {
            console.error('Error loading employee dashboard:', err);
        }
    }

    function setupTimesheetForm() {
        const form = document.getElementById('timesheetForm');
        if (!form) return;

        const periodHidden = document.getElementById('timesheetPeriod');
        if (!periodHidden) {
            return;
        }

        loadTimesheetPeriods();

        setupAutoDateRange();
        updatePayFrequency();
        updateAutoDates();

        const periodSelect = document.getElementById('timesheetPeriod');
        periodSelect.addEventListener('change', () => {
            updateAutoDates();
            toggleCustomDates();
        });

        const customDatesBtn = document.getElementById('customDatesBtn');
        if (customDatesBtn) {
            customDatesBtn.addEventListener('click', showCustomDatesPopup);
        }

        const sendEmailCheckbox = document.getElementById('sendEmail');
        if (sendEmailCheckbox) {
            sendEmailCheckbox.addEventListener('change', function () {
                const emailBox = document.getElementById('emailBox');
                emailBox.style.display = this.checked ? 'block' : 'none';
            });
        }

        form.addEventListener('submit', handleGenerateTimesheet);
    }

    function setupAutoDateRange() {
        const autoStart = document.getElementById('autoStartDate');
        const autoEnd = document.getElementById('autoEndDate');

        if (autoStart && autoEnd) {
            const today = new Date();
            const startDate = getStartOfWeek(today);
            const endDate = getEndOfWeek(today);

            autoStart.textContent = formatDate(startDate);
            autoEnd.textContent = formatDate(endDate);
        }
    }

    async function updatePayFrequency() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: staff } = await supabase
                .from('staff')
                .select('pay_frequency')
                .eq('user_id', user.id)
                .single();

            const freq = staff?.pay_frequency || 'weekly';
            const payFrequencyEl = document.getElementById('payFrequency');
            if (payFrequencyEl) payFrequencyEl.textContent = freq.charAt(0).toUpperCase() + freq.slice(1);
        } catch (err) {
            console.error('Error loading pay frequency:', err);
        }
    }

    function updateAutoDates() {
        const period = document.getElementById('timesheetPeriod')?.value || 'weekly';
        const today = new Date();
        let startDate, endDate;

        switch (period) {
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

        const startDateEl = document.getElementById('autoStartDate');
        const endDateEl = document.getElementById('autoEndDate');
        const startInput = document.getElementById('startDate');
        const endInput = document.getElementById('endDate');

        if (startDateEl) startDateEl.textContent = formatDate(startDate);
        if (endDateEl) endDateEl.textContent = formatDate(endDate);
        if (startInput) startInput.value = startDate.toISOString().split('T')[0];
        if (endInput) endInput.value = endDate.toISOString().split('T')[0];
    }

    function toggleCustomDates() {
        const period = document.getElementById('timesheetPeriod').value;
        const customBtn = document.getElementById('customDatesBtn');

        if (period === 'custom') {
            customBtn.style.display = 'inline-block';
        } else {
            customBtn.style.display = 'none';
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

        if (typeof window.showModal === 'function') {
            window.showModal(html);
        } else {
            alert('Modal system not loaded (utils.js).');
            return;
        }

        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);

        const startInput = document.getElementById('customStartDate');
        const endInput = document.getElementById('customEndDate');

        if (startInput) startInput.value = lastWeek.toISOString().split('T')[0];
        if (endInput) endInput.value = today.toISOString().split('T')[0];

        document.getElementById('customDatesForm').addEventListener('submit', function (e) {
            e.preventDefault();

            const startDate = document.getElementById('customStartDate').value;
            const endDate = document.getElementById('customEndDate').value;

            document.getElementById('startDate').value = startDate;
            document.getElementById('endDate').value = endDate;

            const startDateEl = document.getElementById('autoStartDate');
            const endDateEl = document.getElementById('autoEndDate');

            if (startDateEl) startDateEl.textContent = formatDate(startDate);
            if (endDateEl) endDateEl.textContent = formatDate(endDate);

            if (typeof window.closeModal === 'function') window.closeModal();
            if (typeof window.showMessage === 'function') window.showMessage('✅ Custom dates applied!', 'success');
        });

        document.querySelector('.cancel-btn').addEventListener('click', () => {
            if (typeof window.closeModal === 'function') window.closeModal();
        });
    }

    async function handleGenerateTimesheet(event) {
        event.preventDefault();

        const button = event.target.querySelector('button[type="submit"]');
        const originalText = button.innerHTML;

        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        button.disabled = true;

        try {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const sendEmail = document.getElementById('sendEmail')?.checked || false;
            const emailAddress = sendEmail ? document.getElementById('emailAddress')?.value.trim() : null;

            if (!startDate || !endDate) throw new Error('Please select start and end dates');
            if (sendEmail && (!emailAddress || !validateEmail(emailAddress))) throw new Error('Please enter a valid email address');

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not found');

            const { data: staff, error: staffError } = await supabase
                .from('staff')
                .select('id, company_id, hourly_rate, pay_frequency')
                .eq('user_id', user.id)
                .single();

            if (staffError || !staff) throw new Error('Staff record not found');

            const { data: entries, error: entriesError } = await supabase
                .from('entries')
                .select('*')
                .eq('staff_id', staff.id)
                .gte('work_date', startDate)
                .lte('work_date', endDate);

            if (entriesError) throw new Error('Failed to load entries');

            const totalHours = entries.reduce((sum, entry) => sum + (parseFloat(entry.hours) || 0), 0);
            const totalEarnings = totalHours * (parseFloat(staff.hourly_rate) || CONFIG.DEFAULT_HOURLY_RATE);

            const refNumber = `TS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            const { error: insertError } = await supabase
                .from('timesheets')
                .insert({
                    company_id: staff.company_id,
                    staff_id: staff.id,
                    ref_number: refNumber,
                    start_date: startDate,
                    end_date: endDate,
                    total_hours: totalHours,
                    total_earnings: totalEarnings,
                    status: 'generated',
                    email_address: emailAddress,
                    email_sent: false
                });

            if (insertError) throw new Error('Failed to save timesheet');

            if (typeof window.showMessage === 'function') window.showMessage(`✅ Timesheet ${refNumber} generated!`, 'success');

            button.innerHTML = originalText;
            button.disabled = false;

        } catch (error) {
            console.error(error);
            if (typeof window.showMessage === 'function') window.showMessage('❌ Error: ' + error.message, 'error');
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    async function testConnection() {
        try {
            const { error } = await supabase.from('companies').select('id').limit(1);
            if (error) throw error;
            updateConnectionStatus(true);
            return true;
        } catch (err) {
            console.warn('Connection test failed:', err.message);
            updateConnectionStatus(false);
            return false;
        }
    }

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
            if (typeof window.showMessage === 'function') window.showMessage('No company selected – cannot save', 'error');
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
            if (typeof window.showMessage === 'function') window.showMessage('Save failed: ' + error.message, 'error');
            return;
        }

        if (typeof window.showMessage === 'function') window.showMessage('Settings saved!', 'success');
        await loadCompanyBranding();
    }

    function getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    function getEndOfWeek(date) {
        const start = getStartOfWeek(date);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return end;
    }

    function getStartOfFortnight(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
        return new Date(d.setDate(diff));
    }

    function getEndOfFortnight(date) {
        const start = getStartOfFortnight(date);
        const end = new Date(start);
        end.setDate(start.getDate() + 13);
        return end;
    }

    function getStartOfMonth(date) {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    function getEndOfMonth(date) {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0);
    }

    function formatDate(dateString) {
        try {
            if (typeof dateString === 'string' && dateString.includes('-')) {
                const [year, month, day] = dateString.split('-');
                const date = new Date(year, month - 1, day);
                return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
            } else if (dateString instanceof Date) {
                return dateString.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
            }
            return dateString;
        } catch {
            return dateString;
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

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // ✅ Action functions (exposed) — only define placeholders if NOT already defined by modules
    if (typeof window.showInviteEmployeeModal !== 'function') {
        window.showInviteEmployeeModal = function () {
            if (typeof window.showMessage === 'function') window.showMessage('Invite employee – coming soon', 'info');
        };
    }

    if (typeof window.showCreateShiftModal !== 'function') {
        window.showCreateShiftModal = function () {
            if (typeof window.showMessage === 'function') window.showMessage('Create shift – coming soon', 'info');
        };
    }

    if (typeof window.viewAllTimesheets !== 'function') {
        window.viewAllTimesheets = function () {
            if (typeof viewTimesheets === 'function') {
                viewTimesheets();
            } else {
                if (typeof window.showMessage === 'function') window.showMessage('Timesheets – coming soon', 'info');
            }
        };
    }

    if (typeof window.showCompanySettings !== 'function') {
        window.showCompanySettings = function () {
            const card = document.getElementById('companySettingsCard');
            if (card) {
                card.style.display = 'block';
                card.scrollIntoView({ behavior: 'smooth' });
            }
        };
    }

    if (typeof window.refreshShifts !== 'function') {
        window.refreshShifts = async function () {
            if (typeof window.showMessage === 'function') window.showMessage('Refreshing shifts...', 'info');

            if (currentUserRole === 'manager') {
                await loadManagerDashboard();
            } else {
                if (typeof refreshMyShifts === 'function') await refreshMyShifts();
                if (typeof refreshPastShifts === 'function') await refreshPastShifts();
            }

            if (typeof window.showMessage === 'function') window.showMessage('✅ Shifts refreshed!', 'success');
        };
    }

    if (typeof window.generateTimesheet !== 'function') {
        window.generateTimesheet = function () {
            const form = document.getElementById('timesheetForm');
            if (form) form.scrollIntoView({ behavior: 'smooth' });
        };
    }

    if (typeof window.viewLocations !== 'function') {
        window.viewLocations = function () {
            if (typeof viewLocations === 'function') {
                viewLocations();
            } else {
                if (typeof window.showMessage === 'function') window.showMessage('Locations – coming soon', 'info');
            }
        };
    }

   window.showSettings = function () {
        if (typeof window.showModal !== 'function') {
            if (typeof window.showCompanySettings === 'function') {
                window.showCompanySettings();
            } else if (typeof window.showMessage === 'function') {
                window.showMessage('Settings modal not available yet.', 'info');
            }
            return;
        }

        const settingsCard = document.getElementById('companySettingsCard');
        const settingsForm = document.getElementById('companySettingsForm');

        if (!settingsCard || !settingsForm) {
            if (typeof window.showMessage === 'function') {
                window.showMessage('Company settings are not available yet.', 'info');
            }
            return;
        }

        const originalParent = settingsForm.parentElement;
        const placeholder = document.createElement('div');
        placeholder.dataset.settingsPlaceholder = 'true';
        originalParent.insertBefore(placeholder, settingsForm);

        window.showModal(`
            <div class="modal-content">
                <h2><i class="fas fa-building"></i> Company Settings</h2>
                <p style="color:#64748b; margin-top:6px;">
                    Update branding, colors, and default pay settings for your company.
                </p>
                <div id="settingsModalBody" style="margin-top:16px;"></div>
                <div style="margin-top:20px;">
                    <button type="button" class="btn" onclick="closeModal()" style="width:100%; background:#6c757d; color:white;">
                        Close
                    </button>
                </div>
            </div>
        `);

        const modalBody = document.getElementById('settingsModalBody');
        if (modalBody) modalBody.appendChild(settingsForm);

        const restoreForm = () => {
            const target = document.querySelector('[data-settings-placeholder="true"]');
            if (target) {
                target.replaceWith(settingsForm);
            } else if (originalParent) {
                originalParent.appendChild(settingsForm);
            }
        };

        const existingClose = window.closeModal;
        window.closeModal = function () {
            restoreForm();
            if (typeof existingClose === 'function') {
                existingClose();
            }
            window.closeModal = existingClose;
        };
    };

    window.showHelp = function () {
        if (typeof window.showModal !== 'function') {
            alert('Help modal not available (utils.js).');
            return;
        }

        const helpHtml = `
            <div class="modal-content">
                <h2><i class="fas fa-life-ring"></i> Manager Help</h2>
                <p style="color:#64748b; margin-top:6px;">
                    Here are a few quick ways to keep your team moving.
                </p>
                <div class="summary-list" style="margin-top:16px;">
                    <div class="summary-item">
                        <div>
                            <p class="summary-title">Invite staff quickly</p>
                            <p class="summary-meta">Generate invite links and onboard cleaners in minutes.</p>
                        </div>
                        <button class="btn btn-outline" onclick="showInviteEmployeeModal()">Invite</button>
                    </div>
                    <div class="summary-item">
                        <div>
                            <p class="summary-title">Create or edit shifts</p>
                            <p class="summary-meta">Assign shifts and adjust pay or hours before approval.</p>
                        </div>
                        <button class="btn btn-outline" onclick="showEditShiftsModal()">Edit shifts</button>
                    </div>
                    <div class="summary-item">
                        <div>
                            <p class="summary-title">Stay on top of payroll</p>
                            <p class="summary-meta">Review timesheets and approve payments on time.</p>
                        </div>
                        <button class="btn btn-outline" onclick="viewAllTimesheets()">View</button>
                    </div>
                </div>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button type="button" class="btn btn-primary" onclick="showCompanySettings()" style="flex:1;">
                        <i class="fas fa-cog"></i> Company settings
                    </button>
                    <button type="button" class="btn" onclick="closeModal()" style="flex:1; background:#6c757d; color:white;">
                        Close
                    </button>
                </div>
            </div>
        `;

        window.showModal(helpHtml);
    };

    window.showEmployeesModal = async function () {
        if (typeof window.showModal !== 'function') {
            alert('Modal system not loaded (utils.js).');
            return;
        }

        window.showModal(`
            <div class="modal-content">
                <h2><i class="fas fa-user-friends"></i> Employees</h2>
                <p style="color:#64748b; margin-top:6px;">
                    Active and invited employees linked to your company.
                </p>
                <div id="employeesList" class="summary-list" style="margin-top:16px;">
                    <div class="loading-simple" style="padding:20px 0;">
                        <div class="spinner-small"></div>
                        Loading employees...
                    </div>
                </div>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button type="button" class="btn btn-primary" onclick="showInviteEmployeeModal()" style="flex:1;">
                        <i class="fas fa-user-plus"></i> Invite employee
                    </button>
                    <button type="button" class="btn" onclick="closeModal()" style="flex:1; background:#6c757d; color:white;">
                        Close
                    </button>
                </div>
            </div>
        `);

        if (!supabase) {
            window.showMessage?.('Supabase not ready yet.', 'error');
            return;
        }

        if (!currentCompanyId) {
            window.showMessage?.('No company selected for this account.', 'error');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('staff')
                .select('id, name, email, role, is_active, pay_frequency, hourly_rate')
                .eq('company_id', currentCompanyId)
                .order('name', { ascending: true });

            if (error) throw error;

            const list = document.getElementById('employeesList');
            if (!list) return;

            if (!data || data.length === 0) {
                list.innerHTML = `
                    <div class="summary-item">
                        <div>
                            <p class="summary-title">No employees yet</p>
                            <p class="summary-meta">Invite your first employee to get started.</p>
                        </div>
                    </div>
                `;
                return;
            }

            list.innerHTML = data
                .map((employee) => {
                    const name = employee.name || employee.email || 'Unnamed employee';
                    const email = employee.email ? ` • ${employee.email}` : '';
                    const role = employee.role ? employee.role : 'employee';
                    const status = employee.is_active === false ? 'Inactive' : 'Active';
                    const pay = employee.pay_frequency ? ` • ${employee.pay_frequency}` : '';
                    const rate = employee.hourly_rate ? ` • $${employee.hourly_rate}/hr` : '';

                    return `
                        <div class="summary-item">
                            <div>
                                <p class="summary-title">${name}</p>
                                <p class="summary-meta">${role}${email}${pay}${rate}</p>
                            </div>
                            <span class="pill ${employee.is_active === false ? 'pill-warning' : 'pill-success'}">
                                ${status}
                            </span>
                        </div>
                    `;
                })
                .join('');
        } catch (err) {
            console.error(err);
            const list = document.getElementById('employeesList');
            if (list) {
                list.innerHTML = `
                    <div class="summary-item">
                        <div>
                            <p class="summary-title">Unable to load employees</p>
                            <p class="summary-meta">${err.message || 'Please try again later.'}</p>
                        </div>
                    </div>
                `;
            }
        }
    };

    window.showEditShiftsModal = function () {
        if (typeof window.showModal !== 'function') {
            alert('Modal system not loaded (utils.js).');
            return;
        }

        const editHtml = `
            <div class="modal-content">
                <h2><i class="fas fa-pen-to-square"></i> Edit Shifts</h2>
                <p style="color:#64748b; margin-top:6px;">
                    Soon you will be able to update times, rates, and assignments from one screen.
                </p>
                <div class="summary-list" style="margin-top:16px;">
                    <div class="summary-item">
                        <div>
                            <p class="summary-title">Update shift details</p>
                            <p class="summary-meta">Change start times, hours, or pay rates.</p>
                        </div>
                    </div>
                    <div class="summary-item">
                        <div>
                            <p class="summary-title">Assign & unassign employees</p>
                            <p class="summary-meta">Move shifts between team members with ease.</p>
                        </div>
                    </div>
                    <div class="summary-item">
                        <div>
                            <p class="summary-title">Track approvals</p>
                            <p class="summary-meta">See who has confirmed or declined assignments.</p>
                        </div>
                    </div>
                </div>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button type="button" class="btn btn-primary" onclick="showCreateShiftModal()" style="flex:1;">
                        <i class="fas fa-plus-circle"></i> Create shift
                    </button>
                    <button type="button" class="btn" onclick="closeModal()" style="flex:1; background:#6c757d; color:white;">
                        Close
                    </button>
                </div>
            </div>
        `;

        window.showModal(editHtml);
    };

    window.showAllShiftsModal = async function () {
        if (typeof window.showModal !== 'function') {
            alert('Modal system not loaded (utils.js).');
            return;
        }

        window.showModal(`
            <div class="modal-content">
                <h2><i class="fas fa-clipboard-list"></i> All Shifts</h2>
                <p style="color:#64748b; margin-top:6px;">
                    Showing confirmed, offered, and cancelled shifts from the past 30 days.
                </p>
                <div id="allShiftsList" style="margin-top:16px;">
                    <div class="loading-simple" style="padding:20px 0;">
                        <div class="spinner-small"></div>
                        Loading shifts...
                    </div>
                </div>
                <div style="margin-top:20px;">
                    <button type="button" class="btn" onclick="closeModal()" style="width:100%; background:#6c757d; color:white;">
                        Close
                    </button>
                </div>
            </div>
        `);

        if (!supabase) {
            window.showMessage?.('Supabase not ready yet.', 'error');
            return;
        }

        if (!currentCompanyId) {
            window.showMessage?.('No company selected for this account.', 'error');
            return;
        }

        try {
            const since = new Date();
            since.setDate(since.getDate() - 30);

            const { data: shifts, error } = await supabase
                .from('shifts')
                .select(`
                    id, company_id, shift_date, start_time, duration, status, notes, staff_id, recurring_shift_id,
                    locations (name),
                    staff (name, email)
                `)
                .eq('company_id', currentCompanyId)
                .gte('shift_date', since.toISOString().split('T')[0])
                .in('status', ['confirmed', 'pending', 'cancelled'])
                .order('shift_date', { ascending: false })
                .order('start_time', { ascending: false });

            if (error) throw error;

            const list = document.getElementById('allShiftsList');
            if (!list) return;

            if (!shifts || shifts.length === 0) {
                list.innerHTML = `
                    <div style="text-align:center; color:#666; padding:20px 0;">
                        No shifts found in the last 30 days.
                    </div>
                `;
                return;
            }

            list.innerHTML = shifts.map((shift) => {
                const locationName = shift.locations?.name || 'Unknown Location';
                const isOffered = !shift.staff_id;
                const staffName = isOffered ? 'Offered' : (shift.staff?.name || shift.staff?.email || 'Unassigned');
                const status = isOffered ? 'offered' : safeStatusText(shift.status);
                const statusClass = (typeof getShiftStatusClass === 'function')
                    ? getShiftStatusClass(isOffered ? 'pending' : shift.status)
                    : 'status-pending';
                const recurringBadge = shift.recurring_shift_id
                    ? `<span class="offer-badge">RECURRING</span>`
                    : '';

                return `
                    <div class="shift-item">
                        <div class="shift-info">
                            <h4>${escapeHtml(locationName)}
                                ${recurringBadge}
                                <span class="shift-status ${statusClass}">${status}</span>
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
            }).join('');
        } catch (err) {
            console.error(err);
            const list = document.getElementById('allShiftsList');
            if (list) {
                list.innerHTML = `
                    <div style="text-align:center; color:#666; padding:20px 0;">
                        Unable to load shifts. ${err.message || ''}
                    </div>
                `;
            }
        }
    };

    window.safeLogout = function () {
        if (window.auth && typeof window.auth.logout === 'function') {
            window.auth.logout();
        } else {
            localStorage.clear();
            window.location.href = 'login.html';
        }
    };
})();






