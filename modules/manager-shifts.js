// modules/manager-shifts.js
console.log('🗓️ Manager Shifts module loading...');

function ms_getSupabase() {
    return window.supabaseClient || window.supabase;
}

async function ms_getManagerProfile() {
    const supabase = ms_getSupabase();
    if (!supabase) throw new Error('Supabase not ready');

    const { data: { user }, error: uerr } = await supabase.auth.getUser();
    if (uerr) throw new Error(uerr.message);
    if (!user) throw new Error('Not logged in');

    const { data: profile, error: perr } = await supabase
        .from('profiles')
        .select('company_id, role')
        .eq('id', user.id)
        .single();

    if (perr) throw new Error('Profile lookup failed: ' + perr.message);
    if (!profile?.company_id) throw new Error('No company linked to your account');
    if (profile.role !== 'manager') throw new Error('Only managers can create shifts');

    return { user_id: user.id, company_id: profile.company_id };
}

function ms_escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function ms_money(n) {
    const x = Number(n || 0);
    return x.toFixed(2);
}

async function ms_loadEmployees(companyId) {
    const supabase = ms_getSupabase();
    const { data, error } = await supabase
        .from('staff')
        .select('id, name, email, is_active')
        .eq('company_id', companyId)
        .eq('role', 'employee')
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

async function ms_loadLocations(companyId) {
    const supabase = ms_getSupabase();
    const { data, error } = await supabase
        .from('locations')
        .select('id, name, hourly_rate, default_hours, is_active')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

function ms_buildCreateShiftModal({ employees, locations }) {
    const locationOptions = locations.map(l =>
        `<option value="${l.id}" data-rate="${l.hourly_rate || 0}" data-hours="${l.default_hours || 0}">
            ${ms_escapeHtml(l.name)} (Rate: $${ms_money(l.hourly_rate || 0)}/hr)
         </option>`
    ).join('');

    const employeeOptions = employees.map(e =>
        `<option value="${e.id}">${ms_escapeHtml(e.name || e.email || 'Employee')}</option>`
    ).join('');

    const employeeCheckboxes = employees.map(e => `
        <label style="display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid #eee; border-radius:8px; margin-bottom:8px;">
            <input type="checkbox" class="offerEmployeeCheckbox" value="${e.id}">
            <span>
                <strong>${ms_escapeHtml(e.name || 'Employee')}</strong>
                <span style="color:#666; font-size:0.9rem;">(${ms_escapeHtml(e.email || '')})</span>
            </span>
        </label>
    `).join('');

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    return `
    <div class="modal-content">
      <h2><i class="fas fa-plus-circle"></i> Create Shift</h2>
      <p style="color:#666; margin-top:6px;">
        Create a shift and either assign directly or offer it to employees.
      </p>

      <form id="createShiftForm" style="margin-top:16px;">
        <div class="form-group">
          <label>Location</label>
          <select id="msLocation" required>
            <option value="">Select location...</option>
            ${locationOptions}
          </select>
        </div>

        <div class="form-group">
          <label>Shift Date</label>
          <input type="date" id="msDate" value="${todayStr}" required />
        </div>

        <div class="form-group">
          <label>Start Time</label>
          <input type="time" id="msStartTime" value="09:00" required />
        </div>

        <div class="form-group">
          <label>Duration (hours)</label>
          <input type="number" id="msDuration" min="0.25" step="0.25" placeholder="e.g. 3" required />
        </div>

        <div class="form-group">
          <label>Rate per hour (AUD)</label>
          <input type="number" id="msRate" min="0" step="0.01" placeholder="e.g. 23.00" required />
        </div>

        <div class="form-group">
          <label>Total Amount (AUD)</label>
          <input type="text" id="msTotal" readonly />
        </div>

        <div class="form-group">
          <label>Notes (optional)</label>
          <textarea id="msNotes" rows="3" placeholder="Optional shift notes..."></textarea>
        </div>

        <div class="form-group">
          <label>Assignment Type</label>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="radio" name="assignType" value="assign" checked>
              Assign to employee
            </label>
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="radio" name="assignType" value="offer">
              Offer to employees
            </label>
          </div>
        </div>

        <div id="msAssignBlock" class="form-group">
          <label>Select Employee</label>
          <select id="msAssignEmployee">
            <option value="">Select employee...</option>
            ${employeeOptions}
          </select>
          <p style="color:#666; margin-top:6px; font-size:0.9rem;">
            Assigned shifts are immediately confirmed.
          </p>
        </div>

        <div id="msOfferBlock" class="form-group" style="display:none;">
          <label>Offer To</label>

          <label style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
            <input type="checkbox" id="msOfferAll">
            Offer to all employees
          </label>

          <div id="msOfferList" style="max-height:220px; overflow:auto; padding-right:6px;">
            ${employeeCheckboxes || '<div style="color:#666;">No employees found yet.</div>'}
          </div>

          <p style="color:#666; margin-top:8px; font-size:0.9rem;">
            First employee to accept gets the shift. You will get a notification.
          </p>
        </div>

        <div style="margin-top:18px; display:flex; gap:10px;">
          <button type="submit" class="btn btn-primary" id="msSubmitBtn" style="flex:1;">
            <i class="fas fa-save"></i> Create Shift
          </button>
          <button type="button" class="btn" id="msCancelBtn" style="flex:1; background:#6c757d; color:white;">
            <i class="fas fa-times"></i> Cancel
          </button>
        </div>
      </form>
    </div>
    `;
}

async function ms_createShiftAndOffers({ company_id, location_id, shift_date, start_time, duration, hourly_rate, total_amount, notes, mode, assigned_staff_id, offered_staff_ids }) {
    const supabase = ms_getSupabase();

    // Insert shift
    const baseShift = {
        company_id,
        location_id,
        shift_date,
        start_time,
        duration: Number(duration),
        hourly_rate: Number(hourly_rate),
        total_amount: Number(total_amount),
        notes: notes || null
    };

    if (mode === 'assign') {
        baseShift.staff_id = assigned_staff_id;
        baseShift.status = 'confirmed';
        baseShift.confirmed_at = new Date().toISOString();
    } else {
        // offered
        baseShift.staff_id = null;
        baseShift.status = 'pending';
    }

    const { data: inserted, error: insErr } = await supabase
        .from('shifts')
        .insert([baseShift])
        .select('id')
        .single();

    if (insErr) throw new Error(insErr.message);
    const shiftId = inserted.id;

    // Insert offers (if offer mode)
    if (mode === 'offer') {
        if (!offered_staff_ids || offered_staff_ids.length === 0) {
            throw new Error('Please select at least one employee to offer the shift to.');
        }

        const rows = offered_staff_ids.map(staffId => ({
            shift_id: shiftId,
            company_id,
            staff_id: staffId,
            status: 'offered'
        }));

        const { error: offerErr } = await supabase
            .from('shift_offers')
            .insert(rows);

        if (offerErr) throw new Error(offerErr.message);
    }

    return shiftId;
}

// Expose function used by manager.html
window.showCreateShiftModal = async function () {
    try {
        if (window.auth && typeof window.auth.protectRoute === 'function') {
            const ok = window.auth.protectRoute('manager');
            if (!ok) return;
        }

        if (typeof window.showModal !== 'function' || typeof window.closeModal !== 'function') {
            alert('Modal system not loaded (utils.js).');
            return;
        }

        const { company_id } = await ms_getManagerProfile();

        const [employees, locations] = await Promise.all([
            ms_loadEmployees(company_id),
            ms_loadLocations(company_id),
        ]);

        window.showModal(ms_buildCreateShiftModal({ employees, locations }));

        const cancelBtn = document.getElementById('msCancelBtn');
        cancelBtn?.addEventListener('click', window.closeModal);

        const locSelect = document.getElementById('msLocation');
        const durationInput = document.getElementById('msDuration');
        const rateInput = document.getElementById('msRate');
        const totalInput = document.getElementById('msTotal');

        // Auto set duration/rate from selected location defaults
        locSelect?.addEventListener('change', () => {
            const opt = locSelect.options[locSelect.selectedIndex];
            const rate = Number(opt?.getAttribute('data-rate') || 0);
            const hours = Number(opt?.getAttribute('data-hours') || 0);

            if (hours && (!durationInput.value || Number(durationInput.value) === 0)) {
                durationInput.value = String(hours);
            }
            if (rate && (!rateInput.value || Number(rateInput.value) === 0)) {
                rateInput.value = String(rate.toFixed(2));
            }
            ms_recalcTotal();
        });

        function ms_recalcTotal() {
            const d = Number(durationInput.value || 0);
            const r = Number(rateInput.value || 0);
            const total = d * r;
            totalInput.value = `$${ms_money(total)}`;
        }

        durationInput?.addEventListener('input', ms_recalcTotal);
        rateInput?.addEventListener('input', ms_recalcTotal);

        // Toggle assign vs offer blocks
        const assignBlock = document.getElementById('msAssignBlock');
        const offerBlock = document.getElementById('msOfferBlock');

        document.querySelectorAll('input[name="assignType"]').forEach(r => {
            r.addEventListener('change', () => {
                const mode = document.querySelector('input[name="assignType"]:checked')?.value;
                if (mode === 'offer') {
                    assignBlock.style.display = 'none';
                    offerBlock.style.display = 'block';
                } else {
                    assignBlock.style.display = 'block';
                    offerBlock.style.display = 'none';
                }
            });
        });

        // Offer to all checkbox
        const offerAll = document.getElementById('msOfferAll');
        const offerChecks = () => Array.from(document.querySelectorAll('.offerEmployeeCheckbox'));
        offerAll?.addEventListener('change', () => {
            offerChecks().forEach(cb => { cb.checked = offerAll.checked; });
        });
        offerChecks().forEach(cb => cb.addEventListener('change', () => {
            if (!cb.checked) offerAll.checked = false;
        }));

        // Pre-fill total once if location default exists
        ms_recalcTotal();

        // Submit
        const form = document.getElementById('createShiftForm');
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('msSubmitBtn');
            const original = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

            try {
                const mode = document.querySelector('input[name="assignType"]:checked')?.value || 'assign';

                const location_id = document.getElementById('msLocation').value;
                const shift_date = document.getElementById('msDate').value;
                const start_time = document.getElementById('msStartTime').value;
                const duration = Number(document.getElementById('msDuration').value);
                const hourly_rate = Number(document.getElementById('msRate').value);
                const notes = document.getElementById('msNotes').value.trim();

                if (!location_id) throw new Error('Please select a location');
                if (!shift_date) throw new Error('Please select a date');
                if (!start_time) throw new Error('Please select a start time');
                if (!duration || duration <= 0) throw new Error('Duration must be > 0');
                if (hourly_rate < 0) throw new Error('Rate must be >= 0');

                const total_amount = duration * hourly_rate;

                let assigned_staff_id = null;
                let offered_staff_ids = [];

                if (mode === 'assign') {
                    assigned_staff_id = document.getElementById('msAssignEmployee').value;
                    if (!assigned_staff_id) throw new Error('Please select an employee to assign the shift to');
                } else {
                    offered_staff_ids = offerChecks().filter(cb => cb.checked).map(cb => cb.value);
                    if (offered_staff_ids.length === 0) throw new Error('Select at least one employee to offer the shift to');
                }

                const shiftId = await ms_createShiftAndOffers({
                    company_id,
                    location_id,
                    shift_date,
                    start_time,
                    duration,
                    hourly_rate,
                    total_amount,
                    notes,
                    mode,
                    assigned_staff_id,
                    offered_staff_ids
                });

                window.showMessage?.('✅ Shift created!', 'success');
                window.closeModal();

                // Refresh manager list if available
                if (typeof window.refreshShifts === 'function') {
                    await window.refreshShifts();
                }

                console.log('Shift created:', shiftId);

            } catch (err) {
                console.error(err);
                window.showMessage?.('❌ ' + (err.message || 'Error creating shift'), 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = original;
            }
        });

    } catch (err) {
        console.error(err);
        window.showMessage?.('❌ ' + (err.message || 'Could not open create shift'), 'error');
    }
};

console.log('✅ Manager Shifts module loaded');
