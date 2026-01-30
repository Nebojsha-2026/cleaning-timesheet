(function () {
    // Configuration
    const CONFIG = {
        SUPABASE_URL: 'https://hqmtigcjyqckqdzepcdu.supabase.co',
        SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nj90ODAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw',
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

        // Check if user is authenticated
        const token = localStorage.getItem(STORAGE_KEYS.token);
        const isAuthenticated = !!token;

        // If not authenticated and on dashboard page, redirect to login
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

                await updateEmployeeStats();

                if (typeof loadMyShifts === 'function') await loadMyShifts();
                if (typeof loadPastShifts === 'function') await loadPastShifts();
                if (typeof loadLocations === 'function') await loadLocations();

                setupTimesheetForm();
            }
        } catch (err) {
            console.error('Error loading employee data:', err);
        }
    }
    async function updateEmployeeStats() {
        // ... (rest of file continues unchanged, exact repo version)
    }

    // ✅ Settings modal (opens Company Settings)
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

    // ✅ All shifts modal (30 days)
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
