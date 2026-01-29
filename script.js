(function () {
    // Configuration
    const CONFIG = {
        SUPABASE_URL: 'https://hqmtigcjyqckqdzepcdu.supabase.co',
        SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw',
        DEFAULT_HOURLY_RATE: 23,
        CURRENCY: 'AUD',
        VERSION: '1.3.2'
    };

    // Global variables (scoped inside this IIFE to avoid collisions with modules/auth.js)
    let supabase;
    let currentEmployeeId = null;
    let currentCompanyId = null;
    let currentUserRole = null;

    // ✅ Storage keys aligned with modules/auth.js
    const STORAGE_KEYS = {
        token: 'cleaning_timesheet_token',
        role: 'cleaning_timesheet_role',
        company: 'cleaning_timesheet_company_id'
    };

    // ---------- Client init helpers ----------
    async function waitForSupabaseClient(maxMs = 700) {
        const start = Date.now();
        while (Date.now() - start < maxMs) {
            if (window.supabaseClient && window.supabaseClient.auth) return window.supabaseClient;
            await new Promise(r => setTimeout(r, 50));
        }
        return null;
    }

    async function ensureSupabaseClient() {
        // Prefer the shared client created by modules/auth.js
        const existing = await waitForSupabaseClient(700);
        if (existing) return existing;

        // Create only if nothing else created it yet
        if (window.supabaseClient && window.supabaseClient.auth) return window.supabaseClient;

        const { createClient } = window.supabase;
        const client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        window.supabaseClient = client;
        return client;
    }

    // ---------- Menu + Logout ----------
    window.safeLogout = async function () {
        try {
            // Call auth module if present (best)
            if (window.auth && typeof window.auth.logout === 'function') {
                await window.auth.logout();
                return;
            }

            // Fallback logout
            if (window.supabaseClient?.auth) {
                await window.supabaseClient.auth.signOut();
            }

            // Clear storage + redirect
            localStorage.removeItem(STORAGE_KEYS.token);
            localStorage.removeItem(STORAGE_KEYS.role);
            localStorage.removeItem(STORAGE_KEYS.company);
            localStorage.setItem('just_logged_out', '1');

            window.location.href = 'login.html';
        } catch (e) {
            console.error('Logout error:', e);
            // Last-resort redirect
            localStorage.clear();
            window.location.href = 'login.html';
        }
    };

    function setupUserMenu() {
        const menu = document.querySelector('.user-menu');
        if (!menu) return;

        const button = menu.querySelector('.user-menu-button');
        const dropdown = menu.querySelector('.user-menu-dropdown');
        if (!button || !dropdown) return;

        function close() {
            dropdown.classList.remove('open');
        }

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });

        document.addEventListener('click', () => close());
        window.addEventListener('blur', () => close());
    }

    // ---------- Shift helpers ----------
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
        // Prefer cancel module if present (notifications + rules)
        if (typeof window.cancelShiftAsManager === 'function') {
            await window.cancelShiftAsManager(shiftId);
            return;
        }

        const { error } = await supabase
            .from('shifts')
            .update({ status: 'cancelled' })
            .eq('id', shiftId);

        if (error) throw error;
    }

    // Initialize App
    document.addEventListener('DOMContentLoaded', async function () {
        console.log('✅ DOM Ready');

        supabase = await ensureSupabaseClient();
        window.CONFIG = CONFIG;

        setupUserMenu();

        // Load role and company from localStorage
        currentUserRole = localStorage.getItem(STORAGE_KEYS.role) || 'employee';
        currentCompanyId =
            localStorage.getItem(STORAGE_KEYS.company) ||
            localStorage.getItem('cleaning_timesheet_company') ||
            null;

        console.log('Detected role:', currentUserRole);
        console.log('Detected company ID:', currentCompanyId);

        const token = localStorage.getItem(STORAGE_KEYS.token);
        const isAuthenticated = !!token;

        const isDashboardPage =
            window.location.pathname.includes('manager.html') ||
            window.location.pathname.includes('employee.html');

        const isAuthPage =
            window.location.pathname.includes('login.html') ||
            window.location.pathname.includes('register.html');

        if (!isAuthenticated && isDashboardPage) {
            console.log('Not authenticated, redirecting to login');
            window.location.href = 'login.html';
            return;
        }

        if (isAuthenticated && isAuthPage) {
            if (currentUserRole === 'manager') window.location.href = 'manager.html';
            else window.location.href = 'employee.html';
            return;
        }

        if (isDashboardPage) {
            try {
                await loadCompanyBranding();
                await initializeDashboard();
            } catch (err) {
                console.error('Dashboard initialization failed:', err);
                showMessage('Dashboard failed to load some features', 'error');
            }
        } else {
            const loading = document.getElementById('loadingScreen');
            if (loading) loading.style.display = 'none';

            const container = document.querySelector('.container');
            if (container) container.style.display = 'block';
        }

        setupCompanySettingsForm();

        console.log('🎉 Script loaded');
    });

    // Load and apply company branding
    async function loadCompanyBranding() {
        try {
            if (!currentCompanyId) return;

            console.log('Loading branding for company:', currentCompanyId);

            const { data: company, error } = await supabase
                .from('companies')
                .select('name, custom_title, primary_color, secondary_color, logo_url')
                .eq('id', currentCompanyId)
                .single();

            if (error || !company) return;

            const title = company.custom_title || 'Cleaning Timesheet';

            const appTitle = document.getElementById('appTitle');
            if (appTitle) {
                const icon = appTitle.querySelector('i');
                if (icon) appTitle.innerHTML = `<i class="${icon.className}"></i> ${title}`;
                else appTitle.textContent = title;
            }

            const companyNameEl = document.getElementById('currentCompanyName');
            if (companyNameEl) companyNameEl.textContent = company.name || 'My Company';

            if (company.logo_url) {
                const logo = document.getElementById('companyLogo');
                if (logo) {
                    logo.src = company.logo_url;
                    logo.style.display = 'inline-block';
                }
            }

            if (company.primary_color) document.documentElement.style.setProperty('--primary-color', company.primary_color);
            if (company.secondary_color) document.documentElement.style.setProperty('--secondary-color', company.secondary_color);

            console.log('✅ Branding applied:', title);

        } catch (err) {
            console.error('❌ Branding load failed:', err);
        }
    }

    // Initialize dashboard content
    async function initializeDashboard() {
        console.log('Initializing dashboard...');

        const dateEl = document.getElementById('currentDate');
        if (dateEl) dateEl.textContent = formatDate(new Date());

        const connected = await testConnection();
        if (!connected) showMessage('Connection issues – limited functionality', 'error');

        const loading = document.getElementById('loadingScreen');
        const container = document.querySelector('.container');
        if (loading) loading.style.display = 'none';
        if (container) container.style.display = 'block';

        if (currentUserRole === 'manager') {
            await loadManagerDashboard();
        } else {
            await loadEmployeeDashboard();
        }
    }

    async function loadManagerDashboard() {
        try {
            const { count: employeeCount } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', currentCompanyId)
                .eq('role', 'employee');

            const { count: shiftCount } = await supabase
                .from('shifts')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', currentCompanyId)
                .gte('shift_date', new Date().toISOString().split('T')[0])
                .in('status', ['pending', 'confirmed']);

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: shifts } = await supabase
                .from('shifts')
                .select('duration')
                .eq('company_id', currentCompanyId)
                .gte('shift_date', thirtyDaysAgo.toISOString().split('T')[0])
                .in('status', ['confirmed', 'completed']);

            const totalHours = (shifts || []).reduce((sum, s) => sum + (parseFloat(s.duration) || 0), 0);

            const { count: invitesCount } = await supabase
                .from('invitations')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', currentCompanyId)
                .eq('accepted', false);

            const employeesEl = document.getElementById('statEmployees');
            if (employeesEl) employeesEl.textContent = employeeCount || 0;

            const shiftsEl = document.getElementById('statUpcomingShifts');
            if (shiftsEl) shiftsEl.textContent = shiftCount || 0;

            const hoursEl = document.getElementById('statHours');
            if (hoursEl) hoursEl.textContent = totalHours.toFixed(1);

            const invitesEl = document.getElementById('statPendingInvites');
            if (invitesEl) invitesEl.textContent = invitesCount || 0;

            await loadManagerUpcomingShifts();
        } catch (err) {
            console.error('Error loading manager dashboard:', err);
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
                .order('shift_date', { ascending: true })
                .order('start_time', { ascending: true })
                .limit(10);

            if (error) throw error;

            if (!shifts || shifts.length === 0) {
                shiftsList.innerHTML = `
                    <div style="text-align:center; padding:40px; color:#666;">
                        <i class="fas fa-calendar" style="font-size:3rem; margin-bottom:15px; opacity:0.5;"></i>
                        <p>No upcoming shifts scheduled.</p>
                    </div>
                `;
                return;
            }

            let html = '';
            shifts.forEach(shift => {
                const locationName = shift.locations?.name || 'Unknown Location';

                const isOffered = !shift.staff_id;
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
                            ${shift.notes ? `<p style="color:#666; font-size:0.9rem; margin-top:5px;">
                                <i class="fas fa-sticky-note"></i> ${escapeHtml(shift.notes)}
                            </p>` : ''}
                            ${cancelBtn}
                        </div>
                    </div>
                `;
            });

            shiftsList.innerHTML = html;

            // Hook cancel buttons
            shiftsList.querySelectorAll('.manager-cancel-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    try {
                        if (!confirm('Cancel this shift?')) return;

                        await doManagerCancel(id);
                        showMessage('✅ Shift cancelled', 'success');

                        // ✅ refresh list + manager stat cards immediately
                        await loadManagerDashboard();
                    } catch (e) {
                        console.error(e);
                        showMessage('❌ ' + (e.message || 'Cancel failed'), 'error');
                    }
                });
            });

        } catch (err) {
            console.error('Error loading manager shifts:', err);
        }
    }

    // Expose for manager-shifts module
    window.loadManagerUpcomingShifts = loadManagerUpcomingShifts;

    async function loadEmployeeDashboard() {
        console.log('Loading employee dashboard...');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.id) return;

            currentEmployeeId = user.id;

            // IMPORTANT: load shifts first (employee UI)
            if (typeof loadMyShifts === 'function') await loadMyShifts();
            if (typeof loadPastShifts === 'function') await loadPastShifts();

            // Then locations + timesheet UI
            if (typeof loadLocations === 'function') await loadLocations();
            setupTimesheetForm();
        } catch (err) {
            console.error('Error loading employee dashboard:', err);
        }
    }

    function setupTimesheetForm() {
        const form = document.getElementById('timesheetForm');
        if (!form) return;

        if (typeof loadTimesheetPeriods === 'function') {
            // If timesheet module defines it
            loadTimesheetPeriods();
        }

        const emailCheckbox = document.getElementById('sendEmail');
        if (emailCheckbox) {
            emailCheckbox.addEventListener('change', function () {
                const emailGroup = document.getElementById('emailGroup');
                if (emailGroup) emailGroup.style.display = this.checked ? 'block' : 'none';
            });
        }

        form.addEventListener('submit', function(e){
            e.preventDefault();
            if (typeof handleGenerateTimesheet === 'function') return handleGenerateTimesheet(e);
        });
    }

    async function testConnection() {
        try {
            console.log('🔌 Testing Supabase connection...');
            const { error } = await supabase
                .from('locations')
                .select('count', { count: 'exact', head: true });

            if (error) throw error;

            console.log('✅ Database connection successful');

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

    function setupCompanySettingsForm() {
        const form = document.getElementById('companySettingsForm');
        if (!form) return;

        // left as-is (your existing settings module handles this)
    }

    // Utils used by this file (keep simple + safe)
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
})();
