// modules/cancel-shifts.js
console.log('🛑 Cancel Shifts module loaded');

function cs_getSupabase() {
    return window.supabaseClient || window.supabase;
}

function cs_now() {
    return new Date();
}

function cs_shiftStart(shift_date, start_time) {
    // shift_date: YYYY-MM-DD, start_time: HH:MM(:SS)
    const t = (start_time || '00:00').slice(0,5);
    return new Date(`${shift_date}T${t}:00`);
}

async function cs_getMyProfile() {
    const supabase = cs_getSupabase();
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
    const supabase = cs_getSupabase();
    try {
        await supabase.from('notifications').insert([{
            company_id,
            user_id: user_id || null,
            target_role: target_role || null,
            title: title || 'Notification',
            message,
            link: link || null
        }]);
    } catch (e) {
        // If table doesn't exist or RLS blocks, ignore for now.
        console.warn('Notification insert skipped:', e?.message || e);
    }
}

async function cs_cancelShiftAsManager(shiftId) {
    const supabase = cs_getSupabase();
    const { profile } = await cs_getMyProfile();
    if (profile.role !== 'manager') throw new Error('Not manager');

    const { data: shift, error } = await supabase
        .from('shifts')
        .select('id, company_id, shift_date, start_time, status, staff_id, locations(name), staff(user_id,name,email)')
        .eq('id', shiftId)
        .single();

    if (error) throw new Error(error.message);

    const start = cs_shiftStart(shift.shift_date, shift.start_time);
    const diffMs = start.getTime() - cs_now().getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
        throw new Error('Manager can cancel only up to 1 hour before start time.');
    }
    if (['cancelled', 'completed'].includes((shift.status || '').toLowerCase())) {
        throw new Error('Shift is already cancelled/completed.');
    }

    const { error: uerr } = await supabase
        .from('shifts')
        .update({ status: 'cancelled' })
        .eq('id', shiftId);

    if (uerr) throw new Error(uerr.message);

    // Notifications
    const locName = shift.locations?.name || 'Location';
    const msg = `Shift cancelled by manager: ${locName} on ${shift.shift_date} at ${shift.start_time}.`;

    // manager notification (company-wide manager feed)
    await cs_createNotification({
        company_id: shift.company_id,
        target_role: 'manager',
        title: 'Shift Cancelled',
        message: msg,
        link: 'manager.html'
    });

    // employee notification if assigned and has user_id
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

async function cs_cancelShiftAsEmployee(shiftId) {
    const supabase = cs_getSupabase();
    const { profile } = await cs_getMyProfile();
    if (profile.role !== 'employee') throw new Error('Not employee');

    const { data: shift, error } = await supabase
        .from('shifts')
        .select('id, company_id, shift_date, start_time, status, staff_id, locations(name)')
        .eq('id', shiftId)
        .single();

    if (error) throw new Error(error.message);

    const start = cs_shiftStart(shift.shift_date, shift.start_time);
    const diffMs = start.getTime() - cs_now().getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 3) {
        throw new Error('You can cancel only up to 3 hours before start time.');
    }
    if (['cancelled', 'completed'].includes((shift.status || '').toLowerCase())) {
        throw new Error('Shift is already cancelled/completed.');
    }

    const { error: uerr } = await supabase
        .from('shifts')
        .update({ status: 'cancelled' })
        .eq('id', shiftId);

    if (uerr) throw new Error(uerr.message);

    const locName = shift.locations?.name || 'Location';
    const msg = `Shift cancelled by employee: ${locName} on ${shift.shift_date} at ${shift.start_time}.`;

    // notify manager feed
    await cs_createNotification({
        company_id: shift.company_id,
        target_role: 'manager',
        title: 'Shift Cancelled',
        message: msg,
        link: 'manager.html'
    });

    return true;
}

// Enhance Employee UI: add Cancel button to upcoming shift cards when allowed
async function cs_enhanceEmployeeCards() {
    const path = window.location.pathname.toLowerCase();
    if (!path.includes('employee.html')) return;

    const cards = Array.from(document.querySelectorAll('.shift-item[data-shift-id]'));
    if (!cards.length) return;

    const ids = cards.map(c => c.getAttribute('data-shift-id')).filter(Boolean);
    if (!ids.length) return;

    const supabase = cs_getSupabase();
    const { data: shifts, error } = await supabase
        .from('shifts')
        .select('id, shift_date, start_time, status')
        .in('id', ids);

    if (error) return;

    const byId = new Map((shifts || []).map(s => [s.id, s]));
    for (const card of cards) {
        const id = card.getAttribute('data-shift-id');
        const shift = byId.get(id);
        if (!shift) continue;

        // already has cancel?
        if (card.querySelector('.cancel-shift-btn')) continue;

        const start = cs_shiftStart(shift.shift_date, shift.start_time);
        const diffHours = (start.getTime() - cs_now().getTime()) / (1000 * 60 * 60);
        const status = (shift.status || '').toLowerCase();

        if (diffHours >= 3 && !['cancelled', 'completed'].includes(status)) {
            const actions = card.querySelector('.shift-actions-employee');
            if (!actions) continue;

            const btn = document.createElement('button');
            btn.className = 'btn btn-sm btn-danger cancel-shift-btn';
            btn.innerHTML = '<i class="fas fa-ban"></i> Cancel';
            btn.addEventListener('click', async () => {
                try {
                    if (!confirm('Cancel this shift?')) return;
                    await cs_cancelShiftAsEmployee(id);
                    window.showMessage?.('✅ Shift cancelled', 'success');
                    if (typeof window.refreshShifts === 'function') await window.refreshShifts();
                } catch (e) {
                    window.showMessage?.('❌ ' + (e.message || 'Cancel failed'), 'error');
                }
            });

            actions.appendChild(btn);
        }
    }
}

// Override Manager upcoming shifts renderer to include Cancel button + Offered badge
async function cs_overrideManagerUpcoming() {
    const path = window.location.pathname.toLowerCase();
    if (!path.includes('manager.html')) return;

    if (typeof window.loadManagerUpcomingShifts !== 'function') return;

    const original = window.loadManagerUpcomingShifts;

    window.loadManagerUpcomingShifts = async function () {
        const supabase = cs_getSupabase();
        const shiftsList = document.getElementById('upcomingShiftsList');
        if (!shiftsList) return;

        try {
            const { data: shifts, error } = await supabase
                .from('shifts')
                .select(`*, locations(name), staff(user_id,name,email)`)
                .eq('company_id', window.currentCompanyId || localStorage.getItem('company_id'))
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

            shiftsList.innerHTML = shifts.map(shift => {
                const loc = shift.locations?.name || 'Unknown location';
                const empName = shift.staff?.name || (shift.staff?.email || null);
                const isOffered = !shift.staff_id; // offered/unassigned
                const status = (shift.status || 'pending').toLowerCase();

                const statusClass =
                    status === 'confirmed' ? 'status-confirmed' :
                    status === 'completed' ? 'status-completed' :
                    status === 'cancelled' ? 'status-cancelled' :
                    status === 'in_progress' ? 'status-in-progress' :
                    'status-pending';

                const start = cs_shiftStart(shift.shift_date, shift.start_time);
                const diffHours = (start.getTime() - cs_now().getTime()) / (1000 * 60 * 60);

                const canCancel = diffHours >= 1 && !['cancelled','completed'].includes(status);

                return `
                    <div class="shift-item" data-shift-id="${shift.id}">
                        <div class="shift-info">
                            <h4>
                                ${escapeHtml(loc)}
                                <span class="shift-status ${isOffered ? 'status-offered' : statusClass}">
                                    ${isOffered ? 'offered' : (shift.status || 'pending').replace('_',' ')}
                                </span>
                            </h4>
                            <p><i class="far fa-calendar"></i> ${formatDate(shift.shift_date)} <i class="far fa-clock"></i> ${formatTime(shift.start_time)} • ${shift.duration || 0} hours</p>
                            <p><i class="fas fa-user"></i> ${isOffered ? '<span class="offer-badge">OFFER</span> Offered' : escapeHtml(empName || 'Employee')}</p>

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

            // hook cancel buttons
            shiftsList.querySelectorAll('.manager-cancel-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    try {
                        if (!confirm('Cancel this shift?')) return;
                        await cs_cancelShiftAsManager(id);
                        window.showMessage?.('✅ Shift cancelled', 'success');
                        await window.loadManagerUpcomingShifts();
                    } catch (e) {
                        window.showMessage?.('❌ ' + (e.message || 'Cancel failed'), 'error');
                    }
                });
            });

        } catch (err) {
            console.error('Manager shifts override error:', err);
            // fallback to original if something unexpected happens
            try { await original(); } catch (_) {}
        }
    };

    console.log('✅ Manager upcoming shifts overridden (cancel enabled)');
}

// Run periodically (simple + reliable)
setInterval(() => {
    cs_enhanceEmployeeCards().catch(() => {});
}, 1500);

cs_overrideManagerUpcoming().catch(() => {});
