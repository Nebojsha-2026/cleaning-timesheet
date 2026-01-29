// modules/cancel-shifts.js
console.log('🛑 Cancel Shifts module loaded');

function cs_getSupabase() {
    return window.supabaseClient || window.supabaseClient;
}

function cs_now() {
    return new Date();
}

function cs_shiftStart(shift_date, start_time) {
    const t = (start_time || '00:00').slice(0, 5);
    return new Date(`${shift_date}T${t}:00`);
}

async function cs_getMyProfile() {
    const supabase = window.supabaseClient;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not logged in');

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('company_id, role')
        .eq('id', user.id)
        .single();

    if (error) throw new Error(error.message);
    return { user, profile };
}

async function cs_createNotification({ company_id, user_id, target_role, title, message, link }) {
    const supabase = window.supabaseClient;

    const { error } = await supabase.from('notifications').insert([{
        company_id,
        user_id: user_id || null,
        target_role: target_role || null,
        title: title || 'Notification',
        message,
        link: link || null,
        is_read: false
    }]);

    if (error) console.warn('Notification insert failed:', error.message);
}

async function cancelShiftAsManager(shiftId) {
    const supabase = window.supabaseClient;
    const { profile } = await cs_getMyProfile();
    if (profile.role !== 'manager') throw new Error('Not manager');

    const { data: shift, error } = await supabase
        .from('shifts')
        .select('id, company_id, shift_date, start_time, status, staff_id, recurring_shift_id, locations(name), staff(user_id,name,email)')
        .eq('id', shiftId)
        .single();

    if (error) throw new Error(error.message);

    const start = cs_shiftStart(shift.shift_date, shift.start_time);
    const diffHours = (start.getTime() - cs_now().getTime()) / (1000 * 60 * 60);

    if (diffHours < 1) throw new Error('Manager can cancel only up to 1 hour before start time.');
    if (['cancelled', 'completed'].includes((shift.status || '').toLowerCase())) {
        throw new Error('Shift is already cancelled/completed.');
    }

    const { error: uerr } = await supabase
        .from('shifts')
        .update({ status: 'cancelled' })
        .eq('id', shiftId);

    if (uerr) throw new Error(uerr.message);

    const locName = shift.locations?.name || 'Location';
    const recurringText = shift.recurring_shift_id ? ' (Recurring)' : '';
    const msg = `Shift cancelled by manager${recurringText}: ${locName} on ${shift.shift_date} at ${shift.start_time}.`;

    await cs_createNotification({
        company_id: shift.company_id,
        target_role: 'manager',
        title: 'Shift Cancelled',
        message: msg,
        link: 'manager.html'
    });

    const employeeUserId = shift.staff?.user_id || null;
    if (employeeUserId) {
        await cs_createNotification({
            company_id: shift.company_id,
            user_id: employeeUserId,
            title: 'Shift Cancelled',
            message: msg,
            link: 'employee.html'
        });
    }

    return true;
}

async function cancelShiftAsEmployee(shiftId) {
    const supabase = window.supabaseClient;
    const { profile } = await cs_getMyProfile();
    if (profile.role !== 'employee') throw new Error('Not employee');

    const { data: shift, error } = await supabase
        .from('shifts')
        .select('id, company_id, shift_date, start_time, status, recurring_shift_id, locations(name)')
        .eq('id', shiftId)
        .single();

    if (error) throw new Error(error.message);

    const start = cs_shiftStart(shift.shift_date, shift.start_time);
    const diffHours = (start.getTime() - cs_now().getTime()) / (1000 * 60 * 60);

    if (diffHours < 3) throw new Error('You can cancel only up to 3 hours before start time.');
    if (['in_progress', 'completed', 'cancelled'].includes((shift.status || '').toLowerCase())) {
        throw new Error('Shift is already started/completed/cancelled.');
    }

    const { error: uerr } = await supabase
        .from('shifts')
        .update({ status: 'cancelled' })
        .eq('id', shiftId);

    if (uerr) throw new Error(uerr.message);

    const locName = shift.locations?.name || 'Location';
    const recurringText = shift.recurring_shift_id ? ' (Recurring)' : '';
    const msg = `Shift cancelled by employee${recurringText}: ${locName} on ${shift.shift_date} at ${shift.start_time}.`;

    await cs_createNotification({
        company_id: shift.company_id,
        target_role: 'manager',
        title: 'Shift Cancelled',
        message: msg,
        link: 'manager.html'
    });

    return true;
}

// Expose for other modules
window.cancelShiftAsEmployee = cancelShiftAsEmployee;
window.cancelShiftAsManager = cancelShiftAsManager;

/**
 * ✅ IMPORTANT FIX:
 * Wait until loadManagerUpcomingShifts exists, then override it.
 */
function cs_waitFor(fnName, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const timer = setInterval(() => {
            if (typeof window[fnName] === 'function') {
                clearInterval(timer);
                resolve(window[fnName]);
                return;
            }
            if (Date.now() - start > timeoutMs) {
                clearInterval(timer);
                reject(new Error(`${fnName} not found after ${timeoutMs}ms`));
            }
        }, 200);
    });
}

async function cs_overrideManagerUpcoming() {
    const path = window.location.pathname.toLowerCase();
    if (!path.includes('manager.html')) return;

    let original;
    try {
        original = await cs_waitFor('loadManagerUpcomingShifts');
    } catch (e) {
        console.warn('Manager shift override skipped:', e.message);
        return;
    }

    window.loadManagerUpcomingShifts = async function () {
        const supabase = window.supabaseClient;
        const shiftsList = document.getElementById('upcomingShiftsList');
        if (!shiftsList) return;

        try {
            const companyId =
                window.currentCompanyId ||
                localStorage.getItem('cleaning_timesheet_company_id') ||
                localStorage.getItem('company_id');

            const { data: shifts, error } = await supabase
                .from('shifts')
                .select(`id, company_id, shift_date, start_time, duration, status, staff_id, recurring_shift_id, notes,
                         locations(name), staff(user_id,name,email)`)
                .eq('company_id', companyId)
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
                    </div>
                `;
                return;
            }

            shiftsList.innerHTML = shifts.map(shift => {
                const loc = shift.locations?.name || 'Unknown location';
                const isOffered = !shift.staff_id;
                const status = (shift.status || 'pending').toLowerCase();

                const start = cs_shiftStart(shift.shift_date, shift.start_time);
                const diffHours = (start.getTime() - cs_now().getTime()) / (1000 * 60 * 60);
                const canCancel = diffHours >= 1 && !['cancelled','completed'].includes(status);

                return `
                    <div class="shift-item" data-shift-id="${shift.id}">
                        <div class="shift-info">
                            <h4>
                                ${escapeHtml(loc)}
                                ${shift.recurring_shift_id ? `<span class="offer-badge">RECURRING</span>` : ''}
                                <span class="shift-status ${isOffered ? 'status-offered' : getShiftStatusClass(shift.status)}">
                                    ${isOffered ? 'offered' : (shift.status || 'pending').replace('_',' ')}
                                </span>
                            </h4>
                            <p>
                                <i class="far fa-calendar"></i> ${formatDate(shift.shift_date)}
                                • <i class="far fa-clock"></i> ${formatTime(shift.start_time)}
                                • ${shift.duration || 0} hours
                            </p>
                            <p><i class="fas fa-user"></i> ${isOffered ? 'Offered' : escapeHtml(shift.staff?.name || shift.staff?.email || 'Employee')}</p>

                            ${canCancel ? `
                                <div class="shift-actions-employee" style="margin-top:12px;">
                                    <button class="btn btn-sm btn-danger manager-cancel-btn" data-id="${shift.id}">
                                        <i class="fas fa-ban"></i> Cancel Shift
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            shiftsList.querySelectorAll('.manager-cancel-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    try {
                        if (!confirm('Cancel this shift?')) return;
                        await window.cancelShiftAsManager(id);
                        showMessage('✅ Shift cancelled', 'success');
                        await window.loadManagerUpcomingShifts();
                    } catch (e) {
                        showMessage('❌ ' + (e.message || 'Cancel failed'), 'error');
                    }
                });
            });

        } catch (err) {
            console.error('Manager shifts override error:', err);
            // fallback
            try { await original(); } catch (_) {}
        }
    };

    console.log('✅ Manager upcoming shifts overridden (recurring + cancel enabled)');
}

cs_overrideManagerUpcoming().catch(() => {});
