(function () {
    // Configuration
    const CONFIG = {
        SUPABASE_URL: 'https://hqmtigcjyqckqdzepcdu.supabase.co',
        SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw',
        DEFAULT_HOURLY_RATE: 23,
        CURRENCY: 'AUD',
        VERSION: '1.3.0'
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

    // Initialize App
    document.addEventListener('DOMContentLoaded', async function () {
        console.log('✅ DOM Ready');

        const { createClient } = window.supabase;
        supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        window.supabaseClient = supabase;
        window.CONFIG = CONFIG;

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
                const statusClass = (typeof getShiftStatusClass === 'function') ? getShiftStatusClass(shift.status) : 'status-pending';

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
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: staff, error: staffError } = await supabase
                .from('staff')
                .select('id, hourly_rate')
                .eq('user_id', user.id)
                .single();

            if (staffError) {
                console.warn('No staff record found:', staffError.message);
                return;
            }

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

            const { count: locationCount } = await supabase
                .from('locations')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true);

            const { count: timesheetCount } = await supabase
                .from('timesheets')
                .select('*', { count: 'exact', head: true })
                .eq('staff_id', staff.id);

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

                statsCards.forEach(card => card.classList.remove('loading'));
            }
        } catch (err) {
            console.error('Error updating employee stats:', err);
        }
    }

    function setupTimesheetForm() {
        const form = document.getElementById('timesheetForm');
        if (!form) return;

        loadTimesheetPeriods();

        const emailCheckbox = document.getElementById('sendEmail');
        if (emailCheckbox) {
            emailCheckbox.addEventListener('change', function () {
                const emailGroup = document.getElementById('emailGroup');
                if (emailGroup) {
                    emailGroup.style.display = this.checked ? 'block' : 'none';
                }
            });
        }

        const customDatesBtn = document.getElementById('customDatesBtn');
        if (customDatesBtn) {
            customDatesBtn.addEventListener('click', showCustomDatesPopup);
        }

        form.addEventListener('submit', handleGenerateTimesheet);
    }

    async function loadTimesheetPeriods() {
        const container = document.getElementById('periodSelectionBlocks');
        if (!container) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: staff } = await supabase
                .from('staff')
                .select('pay_frequency, timesheet_weekly, timesheet_fortnightly, timesheet_monthly, timesheet_custom')
                .eq('user_id', user.id)
                .single();

            const periods = [];

            if (staff?.timesheet_weekly) periods.push({ id: 'weekly', label: 'This Week', icon: 'fa-calendar-week' });
            if (staff?.timesheet_fortnightly) periods.push({ id: 'fortnightly', label: 'Fortnight', icon: 'fa-calendar-alt' });
            if (staff?.timesheet_monthly) periods.push({ id: 'monthly', label: 'This Month', icon: 'fa-calendar' });
            if (staff?.timesheet_custom) periods.push({ id: 'custom', label: 'Custom', icon: 'fa-calendar-day' });

            if (periods.length === 0) {
                periods.push(
                    { id: 'weekly', label: 'This Week', icon: 'fa-calendar-week' },
                    { id: 'fortnightly', label: 'Fortnight', icon: 'fa-calendar-alt' },
                    { id: 'monthly', label: 'This Month', icon: 'fa-calendar' },
                    { id: 'custom', label: 'Custom', icon: 'fa-calendar-day' }
                );
            }

            let html = '';
            periods.forEach(period => {
                html += `
                <div class="period-block" data-period="${period.id}">
                    <i class="fas ${period.icon}"></i>
                    <span>${period.label}</span>
                </div>
            `;
            });

            container.innerHTML = html;

            document.querySelectorAll('.period-block').forEach(block => {
                block.addEventListener('click', function () {
                    const period = this.getAttribute('data-period');
                    selectTimesheetPeriod(period);
                });
            });

            if (periods.length > 0) {
                selectTimesheetPeriod(periods[0].id);
            }

        } catch (err) {
            console.error('Error loading timesheet periods:', err);
            container.innerHTML = '<div class="loading-simple">Error loading periods</div>';
        }
    }

    function selectTimesheetPeriod(period) {
        document.querySelectorAll('.period-block').forEach(block => {
            block.classList.toggle('selected', block.getAttribute('data-period') === period);
        });

        document.getElementById('timesheetPeriod').value = period;

        const customDatesSection = document.getElementById('customDatesSection');
        const autoDatesSection = document.getElementById('autoDatesSection');

        if (period === 'custom') {
            if (customDatesSection) customDatesSection.style.display = 'block';
            if (autoDatesSection) autoDatesSection.style.display = 'none';
        } else {
            if (customDatesSection) customDatesSection.style.display = 'none';
            if (autoDatesSection) autoDatesSection.style.display = 'block';

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

        showModal(html);

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

            closeModal();
            showMessage('✅ Custom dates applied!', 'success');
        });

        document.querySelector('.cancel-btn').addEventListener('click', closeModal);
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
                .select('id')
                .eq('user_id', user.id)
                .single();

            if (staffError) throw new Error('Staff record not found');

            const { data: entries, error: entriesError } = await supabase
                .from('entries')
                .select(`*, locations (name, hourly_rate)`)
                .eq('staff_id', staff.id)
                .gte('work_date', startDate)
                .lte('work_date', endDate)
                .order('work_date', { ascending: true });

            if (entriesError) throw entriesError;
            if (!entries || entries.length === 0) throw new Error('No entries found for selected period');

            const totalHours = entries.reduce((sum, e) => sum + parseFloat(e.hours), 0);
            const totalEarnings = entries.reduce((sum, e) => {
                const rate = e.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE;
                return sum + (parseFloat(e.hours) * rate);
            }, 0);

            const refNumber = 'TS' + new Date().getTime().toString().slice(-8);

            const insertData = {
                company_id: currentCompanyId,
                staff_id: staff.id,
                ref_number: refNumber,
                start_date: startDate,
                end_date: endDate,
                total_hours: totalHours,
                total_earnings: totalEarnings,
                status: 'generated'
            };

            if (sendEmail && emailAddress) {
                insertData.email_address = emailAddress;
                insertData.email_sent = false;
            }

            const { error: tsError } = await supabase.from('timesheets').insert([insertData]);
            if (tsError) throw tsError;

            showMessage(`✅ Timesheet ${refNumber} generated!`, 'success');
            await updateEmployeeStats();

        } catch (error) {
            console.error('❌ Timesheet generation error:', error);
            showMessage('❌ Error: ' + error.message, 'error');
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
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

            const apiStatus = document.getElementById('apiStatus');
            if (apiStatus) {
                apiStatus.textContent = 'Connected';
                apiStatus.style.color = '#28a745';
            }

            const lastUpdated = document.getElementById('lastUpdated');
            if (lastUpdated) lastUpdated.textContent = new Date().toLocaleTimeString();

            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error);

            const statusDiv = document.getElementById('connectionStatus');
            if (statusDiv) {
                statusDiv.innerHTML = '<i class="fas fa-wifi"></i><span>Disconnected</span>';
                statusDiv.style.color = '#dc3545';
            }

            const apiStatus = document.getElementById('apiStatus');
            if (apiStatus) {
                apiStatus.textContent = 'Disconnected';
                apiStatus.style.color = '#dc3545';
            }

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
            showMessage('Invite employee – coming soon', 'info');
        };
    }

    if (typeof window.showCreateShiftModal !== 'function') {
        window.showCreateShiftModal = function () {
            showMessage('Create shift – coming soon', 'info');
        };
    }

    if (typeof window.viewAllTimesheets !== 'function') {
        window.viewAllTimesheets = function () {
            if (typeof viewTimesheets === 'function') {
                viewTimesheets();
            } else {
                showMessage('Timesheets – coming soon', 'info');
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
            showMessage('Refreshing shifts...', 'info');

            if (currentUserRole === 'manager') {
                await loadManagerUpcomingShifts();
            } else {
                if (typeof refreshMyShifts === 'function') await refreshMyShifts();
                if (typeof refreshPastShifts === 'function') await refreshPastShifts();
            }

            showMessage('✅ Shifts refreshed!', 'success');
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
                showMessage('Locations – coming soon', 'info');
            }
        };
    }

    if (typeof window.showSettings !== 'function') {
        window.showSettings = function () {
            showMessage('Settings – coming soon', 'info');
        };
    }

    if (typeof window.showHelp !== 'function') {
        window.showHelp = function () {
            showMessage('Help documentation – coming soon', 'info');
        };
    }

    console.log('🎉 Script loaded');
})();
