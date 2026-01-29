// modules/cancel-shifts.js
// Adds cancel rules + recurring badge support for manager + employee
// Manager: can cancel up to 1 hour before start
// Employee: (module may implement separately) — this file focuses on manager list override + shared helpers

(function () {
  console.log('🛑 Cancel Shifts module loaded');

  function cs_now() {
    return new Date();
  }

  function cs_shiftStart(shift_date, start_time) {
    const t = (start_time || '00:00').slice(0, 5);
    return new Date(`${shift_date}T${t}:00`);
  }

  async function cs_waitFor(fnName, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (typeof window[fnName] === 'function') return window[fnName];
      await new Promise(r => setTimeout(r, 150));
    }
    throw new Error(`${fnName} not found after ${timeoutMs}ms`);
  }

  // Expose cancel actions if not already present (you may already have these elsewhere)
  if (typeof window.cancelShiftAsManager !== 'function') {
    window.cancelShiftAsManager = async function (shiftId) {
      if (!window.supabaseClient) throw new Error('Supabase not initialized');
      const { error } = await window.supabaseClient
        .from('shifts')
        .update({ status: 'cancelled' })
        .eq('id', shiftId);
      if (error) throw error;
    };
  }

  async function refreshManagerStatsAfterChange() {
    // Best: call loadManagerDashboard (recalculates employees, hours, shift count, invites)
    if (typeof window.loadManagerDashboard === 'function') {
      await window.loadManagerDashboard();
      return;
    }

    // Fallback: refresh shifts list only
    if (typeof window.loadManagerUpcomingShifts === 'function') {
      await window.loadManagerUpcomingShifts();
    }
  }

  // Override manager upcoming shifts render once it exists
  (async () => {
    let original;
    try {
      original = await cs_waitFor('loadManagerUpcomingShifts');
    } catch (e) {
      console.warn('cancel-shifts: could not hook manager shifts list:', e.message);
      return;
    }

    window.loadManagerUpcomingShifts = async function () {
      try {
        const shiftsList = document.getElementById('upcomingShiftsList');
        if (!shiftsList) return await original();

        const companyId =
          localStorage.getItem('cleaning_timesheet_company_id') ||
          localStorage.getItem('cleaning_timesheet_company') ||
          null;

        if (!companyId) return await original();

        const { data: shifts, error } = await window.supabaseClient
          .from('shifts')
          .select(`
            id, company_id, shift_date, start_time, duration, status, staff_id, recurring_shift_id,
            locations (name),
            staff (name, email)
          `)
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
              <p style="font-size: 0.9rem;">Create your first shift using the "Create Shift" button.</p>
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

          const canCancel = diffHours >= 1 && !['cancelled', 'completed'].includes(status);

          return `
            <div class="shift-item" data-shift-id="${shift.id}">
              <div class="shift-info">
                <h4>
                  ${window.escapeHtml ? window.escapeHtml(loc) : loc}
                  ${shift.recurring_shift_id ? `<span class="offer-badge">RECURRING</span>` : ''}
                  <span class="shift-status ${isOffered ? 'status-offered' : (window.getShiftStatusClass ? window.getShiftStatusClass(shift.status) : 'status-pending')}">
                    ${isOffered ? 'offered' : String(shift.status || 'pending').replace('_', ' ')}
                  </span>
                </h4>
                <p>
                  <i class="far fa-calendar"></i> ${(window.formatDate ? window.formatDate(shift.shift_date) : shift.shift_date)}
                  • <i class="far fa-clock"></i> ${(window.formatTime ? window.formatTime(shift.start_time) : shift.start_time)}
                  • ${shift.duration || 0} hours
                </p>
                <p><i class="fas fa-user"></i> ${isOffered ? 'Offered' : (window.escapeHtml ? window.escapeHtml(shift.staff?.name || shift.staff?.email || 'Employee') : (shift.staff?.name || shift.staff?.email || 'Employee'))}</p>

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
              window.showMessage?.('✅ Shift cancelled', 'success');

              // ✅ IMPORTANT: refresh stats so hours update too
              await refreshManagerStatsAfterChange();
            } catch (e) {
              window.showMessage?.('❌ ' + (e.message || 'Cancel failed'), 'error');
            }
          });
        });

      } catch (err) {
        console.error('Manager shifts override error:', err);
        try { await original(); } catch (_) {}
      }
    };

    console.log('✅ Manager upcoming shifts overridden (refresh stats after cancel)');
  })();
})();