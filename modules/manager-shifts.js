// modules/manager-shifts.js
console.log('🗓️ Manager Shifts module loading...');

function ms_getSupabase() {
    // Ensure global client exists (works even after tab restore / reload ordering)
    if (window.supabaseClient && window.supabaseClient.auth) return window.supabaseClient;

    // Try to create it if Supabase UMD is loaded and CONFIG exists
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        const cfg = window.CONFIG || {};
        if (cfg.SUPABASE_URL && cfg.SUPABASE_KEY) {
            window.supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);
            return window.supabaseClient;
        }
    }

    throw new Error('Supabase client not initialized. Make sure script.js or auth.js creates window.supabaseClient.');
}

async function ms_getManagerProfile() {
    const supabase = ms_getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
const user = session?.user;
if (!user) throw new Error('Not logged in');


    const { data: profile, error } = await supabase
        .from('profiles')
        .select('company_id, role')
        .eq('id', user.id)
        .single();

    if (error) throw new Error('Profile lookup failed: ' + error.message);
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
    const employeeOptions = employees.map(e =>
        `<option value="${e.id}">${ms_escapeHtml(e.name || e.email || 'Employee')}</option>`
    ).join('');

    const employeeCheckboxes = employees.map(e => `
        <label style="display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid #eee; border-radius:10px; margin-bottom:8px;">
            <input type="checkbox" class="offerEmployeeCheckbox" value="${e.id}">
            <span>
                <strong>${ms_escapeHtml(e.name || 'Employee')}</strong>
                <span style="color:#666; font-size:0.9rem;">(${ms_escapeHtml(e.email || '')})</span>
            </span>
        </label>
    `).join('');

    const datalist = (locations || []).map(l =>
        `<option value="${ms_escapeHtml(l.name)}"></option>`
    ).join('');

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
          <input id="msLocationName" list="msLocationList" placeholder="Type a location name..." required />
          <datalist id="msLocationList">${datalist}</datalist>
          <input type="hidden" id="msLocationId" value="" />
          <p style="color:#666; margin-top:6px; font-size:0.9rem;">
            If the location doesn’t exist yet, it will be created automatically when you save the shift.
          </p>
        </div>

        <div class="modal-inline">
          <div class="form-group">
            <label>Shift Date</label>
            <input type="date" id="msDate" value="${todayStr}" required />
          </div>
          <div class="form-group">
            <label>Start Time</label>
            <input type="time" id="msStartTime" value="09:00" required />
          </div>
        </div>

        <div class="modal-inline">
          <div class="form-group">
            <label>Duration (hours)</label>
            <input type="number" id="msDuration" min="0.25" step="0.25" placeholder="e.g. 3" required />
          </div>
          <div class="form-group">
            <label>Rate per hour (AUD)</label>
            <input type="number" id="msRate" min="0" step="0.01" placeholder="e.g. 23.00" required />
          </div>
        </div>

        <div class="form-group">
          <label>Total Amount (AUD)</label>
          <input type="text" id="msTotal" readonly value="$0.00" />
        </div>

        <div class="form-group">
          <label style="display:flex; align-items:center; gap:10px;">
            <input type="checkbox" id="msRecurringEnabled">
            Recurring Shift (Weekly)
          </label>
          <div id="msRecurringBlock" style="display:none; margin-top:10px;">
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i)=>`
                <label style="display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid #eee; border-radius:10px;">
                  <input type="checkbox" class="msDay" value="${i===6?0:i+1}"> ${d}
                </label>
              `).join('')}
            </div>
            <p style="color:#666; margin-top:8px; font-size:0.9rem;">
              This saves the recurring template + creates this first shift.
            </p>
          </div>
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
        </div>

        <div style="margin-top:18px; display:flex; gap:10px; flex-wrap:wrap;">
          <button type="submit" class="btn btn-primary" id="msSubmitBtn" style="flex:1; min-width:220px;">
            <i class="fas fa-save"></i> Create Shift
          </button>
          <button type="button" class="btn" id="msCancelBtn" style="flex:1; min-width:220px; background:#6c757d; color:white;">
            <i class="fas fa-times"></i> Cancel
          </button>
        </div>
      </form>
    </div>
    `;
}

async function ms_findLocationByName(company_id, name) {
    const supabase = ms_getSupabase();
    const trimmed = (name || '').trim();
    if (!trimmed) return null;

    const { data, error } = await supabase
        .from('locations')
        .select('id, name, hourly_rate, default_hours')
        .eq('company_id', company_id)
        .ilike('name', trimmed)
        .limit(1);

    if (error) throw new Error(error.message);
    return (data && data.length > 0) ? data[0] : null;
}

async function ms_createLocation({ company_id, name, hourly_rate, default_hours }) {
    const supabase = ms_getSupabase();
    const payload = {
        company_id,
        name: name.trim(),
        hourly_rate: Number(hourly_rate || 0),
        default_hours: Number(default_hours || 0),
        is_active: true
    };

    const { data, error } = await supabase
        .from('locations')
        .insert([payload])
        .select('id, name, hourly_rate, default_hours')
        .single();

    if (error) throw new Error(error.message);
    return data;
}

async function ms_createRecurringShift({ company_id, location_id, selected_days, start_time, duration, notes }) {
    const supabase = ms_getSupabase();

    const payload = {
        company_id,
        location_id,
        pattern: 'weekly',
        selected_days: selected_days,
        start_time,
        duration: Number(duration),
        notes: notes || null,
        is_active: true
    };

    const { data, error } = await supabase
        .from('recurring_shifts')
        .insert([payload])
        .select('id')
        .single();

    if (error) throw new Error(error.message);
    return data.id;
}

async function ms_createShiftAndOffers({
    company_id,
    location_id,
    recurring_shift_id,
    shift_date,
    start_time,
    duration,
    hourly_rate,
    total_amount,
    notes,
    mode,
    assigned_staff_id,
    offered_staff_ids
}) {
    const supabase = ms_getSupabase();

    const baseShift = {
        company_id,
        location_id,
        recurring_shift_id: recurring_shift_id || null,
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
        baseShift.staff_id = null;
        baseShift.status = 'pending';
    }

    const { data: inserted, error: insErr } = await supabase
        .from('shifts')
        .insert([baseShift])
        .select('id, recurring_shift_id')
        .single();

    if (insErr) throw new Error(insErr.message);

    // NOTE: Offering employees requires shift_offers table - assumed existing from previous steps.
    if (mode === 'offer') {
        if (!offered_staff_ids || offered_staff_ids.length === 0) {
            throw new Error('Please select at least one employee to offer the shift to.');
        }

        const rows = offered_staff_ids.map(staffId => ({
            shift_id: inserted.id,
            company_id,
            staff_id: staffId,
            status: 'offered'
        }));

        const { error: offerErr } = await supabase.from('shift_offers').insert(rows);
        if (offerErr) throw new Error(offerErr.message);
    }

    return inserted.id;
}

window.showCreateShiftModal = async function () {
    try {
        if (window.auth && typeof window.auth.protectRoute === 'function') {
            const ok = await window.auth.protectRoute('manager');
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

        document.getElementById('msCancelBtn')?.addEventListener('click', window.closeModal);

        const durationInput = document.getElementById('msDuration');
        const rateInput = document.getElementById('msRate');
        const totalInput = document.getElementById('msTotal');

        function ms_recalcTotal() {
            const d = Number(durationInput.value || 0);
            const r = Number(rateInput.value || 0);
            totalInput.value = `$${ms_money(d * r)}`;
        }

        durationInput?.addEventListener('input', ms_recalcTotal);
        rateInput?.addEventListener('input', ms_recalcTotal);

        const recurringEnabled = document.getElementById('msRecurringEnabled');
        const recurringBlock = document.getElementById('msRecurringBlock');
        recurringEnabled?.addEventListener('change', () => {
            recurringBlock.style.display = recurringEnabled.checked ? 'block' : 'none';
        });

        const locName = document.getElementById('msLocationName');
        const locIdHidden = document.getElementById('msLocationId');

        const locationsByName = new Map((locations || []).map(l => [String(l.name || '').toLowerCase(), l]));

        locName?.addEventListener('input', () => {
            const key = String(locName.value || '').trim().toLowerCase();
            const match = locationsByName.get(key);

            if (match) {
                locIdHidden.value = match.id;
                if (match.default_hours && (!durationInput.value || Number(durationInput.value) === 0)) {
                    durationInput.value = String(match.default_hours);
                }
                if (match.hourly_rate && (!rateInput.value || Number(rateInput.value) === 0)) {
                    rateInput.value = String(Number(match.hourly_rate).toFixed(2));
                }
                ms_recalcTotal();
            } else {
                locIdHidden.value = '';
            }
        });

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

        const offerAll = document.getElementById('msOfferAll');
        const offerChecks = () => Array.from(document.querySelectorAll('.offerEmployeeCheckbox'));
        offerAll?.addEventListener('change', () => {
            offerChecks().forEach(cb => { cb.checked = offerAll.checked; });
        });
        offerChecks().forEach(cb => cb.addEventListener('change', () => {
            if (!cb.checked) offerAll.checked = false;
        }));

        document.getElementById('createShiftForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('msSubmitBtn');
            const original = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

            try {
                const mode = document.querySelector('input[name="assignType"]:checked')?.value || 'assign';

                const locationName = String(document.getElementById('msLocationName').value || '').trim();
                if (!locationName) throw new Error('Please enter a location name');

                const shift_date = document.getElementById('msDate').value;
                const start_time = document.getElementById('msStartTime').value;
                const duration = Number(document.getElementById('msDuration').value);
                const hourly_rate = Number(document.getElementById('msRate').value);
                const notes = document.getElementById('msNotes').value.trim();

                if (!shift_date) throw new Error('Please select a date');
                if (!start_time) throw new Error('Please select a start time');
                if (!duration || duration <= 0) throw new Error('Duration must be > 0');
                if (hourly_rate < 0) throw new Error('Rate must be >= 0');

                const total_amount = duration * hourly_rate;

                // location_id
                let location_id = document.getElementById('msLocationId').value || '';
                if (!location_id) {
                    const existing = await ms_findLocationByName(company_id, locationName);
                    if (existing?.id) {
                        location_id = existing.id;
                    } else {
                        const created = await ms_createLocation({
                            company_id,
                            name: locationName,
                            hourly_rate,
                            default_hours: duration
                        });
                        location_id = created.id;
                        showMessage(`✅ Location created: ${created.name}`, 'success');
                    }
                }

                // recurring
                let recurring_shift_id = null;
                if (document.getElementById('msRecurringEnabled').checked) {
                    const selected_days = Array.from(document.querySelectorAll('.msDay'))
                        .filter(cb => cb.checked)
                        .map(cb => Number(cb.value));

                    if (!selected_days.length) throw new Error('Select at least one day for recurring shift.');

                    recurring_shift_id = await ms_createRecurringShift({
                        company_id,
                        location_id,
                        selected_days,
                        start_time,
                        duration,
                        notes
                    });
                }

                // assignment
                let assigned_staff_id = null;
                let offered_staff_ids = [];

                if (mode === 'assign') {
                    assigned_staff_id = document.getElementById('msAssignEmployee').value;
                    if (!assigned_staff_id) throw new Error('Please select an employee');
                } else {
                    offered_staff_ids = offerChecks().filter(cb => cb.checked).map(cb => cb.value);
                    if (!offered_staff_ids.length) throw new Error('Select at least one employee');
                }

                const shiftId = await ms_createShiftAndOffers({
                    company_id,
                    location_id,
                    recurring_shift_id,
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

                showMessage('✅ Shift created!', 'success');
                window.closeModal();

                // ✅ refresh manager list immediately (no full page refresh)
                if (typeof window.loadManagerUpcomingShifts === 'function') {
                    await window.loadManagerUpcomingShifts();
                } else if (typeof window.refreshShifts === 'function') {
                    await window.refreshShifts();
                }

                console.log('Shift created:', shiftId, 'Recurring:', !!recurring_shift_id);

            } catch (err) {
                console.error(err);
                showMessage('❌ ' + (err.message || 'Error creating shift'), 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = original;
            }
        });

    } catch (err) {
        console.error(err);
        showMessage('❌ ' + (err.message || 'Could not open create shift'), 'error');
    }
};

console.log('✅ Manager Shifts module loaded');
