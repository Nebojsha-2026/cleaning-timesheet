// modules/shifts.js - Shift scheduling module
console.log('🔄 Shifts module loading...');

// Global variables for shifts
let appStaff = [];

// Load staff members
async function loadStaff() {
    try {
        console.log('👥 Loading staff...');
      
        const { data: staff, error } = await window.supabaseClient
            .from('staff')
            .select('*')
            .order('name');
      
        if (error) throw error;
      
        appStaff = staff || [];
        console.log('✅ Staff loaded:', appStaff.length);
      
        // Update staff dropdown if exists
        updateStaffDropdown();
      
        return appStaff;
      
    } catch (error) {
        console.error('❌ Error loading staff:', error);
        return [];
    }
}

// Update staff dropdown in shift forms
function updateStaffDropdown() {
    const staffSelect = document.getElementById('shiftStaff');
    if (!staffSelect) return;
    
    staffSelect.innerHTML = '<option value="">Select staff member...</option>';
    
    appStaff.forEach(staff => {
        if (staff.is_active) {
            const option = document.createElement('option');
            option.value = staff.id;
            option.textContent = `${staff.name} (${staff.role})`;
            staffSelect.appendChild(option);
        }
    });
}

// Handle single shift submission
async function handleAddSingleShift(event) {
    event.preventDefault();
    
    const button = event.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
    
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scheduling...';
    button.disabled = true;
    
    try {
        const locationName = document.getElementById('shiftLocation').value.trim();
        const date = document.getElementById('shiftDate').value;
        const startTime = document.getElementById('shiftStartTime').value;
        const duration = parseFloat(document.getElementById('shiftDuration').value);
        const rate = parseFloat(document.getElementById('shiftRate').value);
        const notes = document.getElementById('shiftNotes').value.trim();
        const confirmed = document.getElementById('shiftConfirmed').checked;
        const staffId = document.getElementById('shiftStaff')?.value;
        
        if (!locationName || !date || !startTime || !duration) {
            throw new Error('Please fill in all required fields');
        }
        
        // Find or create location
        const locationId = await findOrCreateLocation(locationName, duration, rate);
        
        // Create shift object
        const shiftData = {
            location_id: locationId,
            staff_id: staffId || null,
            shift_date: date,
            start_time: startTime,
            duration: duration,
            notes: notes,
            status: confirmed ? 'confirmed' : 'pending'
        };
        
        // Insert into database
        const { data: shift, error } = await window.supabaseClient
            .from('shifts')
            .insert([shiftData])
            .select()
            .single();
        
        if (error) throw error;
        
        showMessage(`✅ Shift scheduled for ${formatDate(date)} at ${startTime}`, 'success');
        
        // Clear form
        document.getElementById('shiftLocation').value = '';
        document.getElementById('shiftNotes').value = '';
        document.getElementById('shiftConfirmed').checked = false;
        
        // Load upcoming shifts
        await loadUpcomingShifts();
        
    } catch (error) {
        console.error('❌ Shift scheduling error:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Handle recurring shift submission
async function handleAddRecurringShift(event) {
    event.preventDefault();
    
    const button = event.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
    
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scheduling...';
    button.disabled = true;
    
    try {
        const locationName = document.getElementById('recurringLocation').value.trim();
        const startDate = document.getElementById('recurringStartDate').value;
        const endDate = document.getElementById('recurringEndDate').value;
        const pattern = document.getElementById('recurrencePattern').value;
        const startTime = document.getElementById('recurringStartTime').value;
        const duration = parseFloat(document.getElementById('recurringDuration').value);
        const rate = parseFloat(document.getElementById('recurringRate').value);
        const notes = document.getElementById('recurringNotes').value.trim();
        const staffId = document.getElementById('recurringStaff')?.value;
        
        if (!locationName || !startDate || !startTime || !duration) {
            throw new Error('Please fill in all required fields');
        }
        
        // Find or create location
        const locationId = await findOrCreateLocation(locationName, duration, rate);
        
        // Get selected days for custom pattern
        let selectedDays = [];
        if (pattern === 'custom') {
            for (let i = 0; i < 7; i++) {
                const checkbox = document.getElementById(`recDay${i}`);
                if (checkbox && checkbox.checked) {
                    selectedDays.push(i);
                }
            }
            if (selectedDays.length === 0) {
                throw new Error('Please select at least one day for custom schedule');
            }
        }
        
        // Create recurring shift object
        const recurringShiftData = {
            location_id: locationId,
            staff_id: staffId || null,
            start_date: startDate,
            end_date: endDate || null,
            pattern: pattern,
            selected_days: selectedDays.length > 0 ? selectedDays : null,
            start_time: startTime,
            duration: duration,
            notes: notes,
            is_active: true
        };
        
        // Insert into database
        const { data: recurringShift, error } = await window.supabaseClient
            .from('recurring_shifts')
            .insert([recurringShiftData])
            .select()
            .single();
        
        if (error) throw error;
        
        // Generate individual shifts from the recurring pattern
        await generateShiftsFromRecurring(recurringShift.id);
        
        showMessage(`✅ Recurring shift scheduled starting ${formatDate(startDate)}`, 'success');
        
        // Clear form
        document.getElementById('recurringLocation').value = '';
        document.getElementById('recurringNotes').value = '';
        
        // Load upcoming shifts
        await loadUpcomingShifts();
        
    } catch (error) {
        console.error('❌ Recurring shift error:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Generate individual shifts from a recurring shift template
async function generateShiftsFromRecurring(recurringShiftId) {
    try {
        // Get the recurring shift details
        const { data: recurringShift, error: rsError } = await window.supabaseClient
            .from('recurring_shifts')
            .select('*')
            .eq('id', recurringShiftId)
            .single();
        
        if (rsError) throw rsError;
        
        const startDate = new Date(recurringShift.start_date);
        const endDate = recurringShift.end_date ? new Date(recurringShift.end_date) : new Date('2100-01-01'); // Far future if no end date
        const today = new Date();
        
        // Generate dates based on pattern
        const dates = generateDatesFromPattern(
            startDate,
            endDate,
            recurringShift.pattern,
            recurringShift.selected_days || []
        );
        
        // Create shifts for each date
        const shiftsToCreate = dates.map(date => ({
            recurring_shift_id: recurringShiftId,
            location_id: recurringShift.location_id,
            staff_id: recurringShift.staff_id,
            shift_date: date.toISOString().split('T')[0],
            start_time: recurringShift.start_time,
            duration: recurringShift.duration,
            status: 'pending',
            notes: recurringShift.notes
        }));
        
        // Insert shifts (skip existing ones)
        for (const shiftData of shiftsToCreate) {
            const { error: shiftError } = await window.supabaseClient
                .from('shifts')
                .insert([shiftData])
                .onConflict('(shift_date, staff_id)')
                .ignore();
            
            if (shiftError) console.warn('Shift creation warning:', shiftError);
        }
        
        console.log(`✅ Generated ${shiftsToCreate.length} shifts from recurring template`);
        
    } catch (error) {
        console.error('❌ Error generating shifts:', error);
        throw error;
    }
}

// Generate dates based on recurrence pattern
function generateDatesFromPattern(startDate, endDate, pattern, selectedDays = []) {
    const dates = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
        let shouldInclude = false;
        const dayOfWeek = current.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const mondayBasedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to 0=Mon, 6=Sun
        
        switch (pattern) {
            case 'daily':
                shouldInclude = true;
                break;
            case 'weekly':
                shouldInclude = (dayOfWeek === 1); // Monday
                break;
            case 'weekdays':
                shouldInclude = (dayOfWeek >= 1 && dayOfWeek <= 5); // Mon-Fri
                break;
            case 'weekends':
                shouldInclude = (dayOfWeek === 0 || dayOfWeek === 6); // Sat-Sun
                break;
            case 'custom':
                shouldInclude = selectedDays.includes(mondayBasedDay);
                break;
        }
        
        if (shouldInclude) {
            dates.push(new Date(current));
        }
        
        // Move to next day
        current.setDate(current.getDate() + 1);
    }
    
    return dates;
}

// Load upcoming shifts
async function loadUpcomingShifts() {
    try {
        console.log('📅 Loading upcoming shifts...');
        
        const today = new Date().toISOString().split('T')[0];
        
        const { data: shifts, error } = await window.supabaseClient
            .from('shifts')
            .select(`
                *,
                locations (name, hourly_rate),
                staff (name, email),
                recurring_shifts (pattern)
            `)
            .gte('shift_date', today)
            .order('shift_date', { ascending: true })
            .order('start_time', { ascending: true })
            .limit(20);
        
        if (error) throw error;
        
        updateUpcomingShiftsDisplay(shifts);
        console.log('✅ Upcoming shifts loaded:', shifts?.length || 0);
        
        return shifts;
        
    } catch (error) {
        console.error('❌ Error loading shifts:', error);
        return [];
    }
}

// Update upcoming shifts display
function updateUpcomingShiftsDisplay(shifts) {
    const container = document.getElementById('upcomingShiftsList');
    if (!container) return;
    
    if (!shifts || shifts.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-calendar" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <p>No upcoming shifts scheduled.</p>
                <p style="font-size: 0.9rem;">Schedule a shift above to get started!</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    shifts.forEach(shift => {
        const locationName = shift.locations?.name || 'Unknown Location';
        const staffName = shift.staff?.name || 'Unassigned';
        const isRecurring = !!shift.recurring_shift_id;
        const statusClass = getStatusClass(shift.status);
        
        html += `
            <div class="shift-item" data-shift-id="${shift.id}">
                <div class="shift-info">
                    <h4>${escapeHtml(locationName)} 
                        <span class="shift-status ${statusClass}">${shift.status}</span>
                        ${isRecurring ? '<span class="recurring-indicator" title="Recurring shift"><i class="fas fa-redo"></i></span>' : ''}
                    </h4>
                    <p>
                        <i class="far fa-calendar"></i> ${formatDate(shift.shift_date)} 
                        • <i class="far fa-clock"></i> ${shift.start_time} 
                        • <i class="fas fa-user"></i> ${escapeHtml(staffName)}
                    </p>
                    <p style="color: #666; font-size: 0.9rem;">
                        ${shift.notes ? escapeHtml(shift.notes) : ''}
                    </p>
                </div>
                <div class="shift-stats">
                    <div class="shift-duration">${shift.duration} hrs</div>
                    <div class="shift-actions">
                        <button class="btn-icon edit-shift" data-id="${shift.id}" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon confirm-shift" data-id="${shift.id}" title="Confirm" ${shift.status === 'confirmed' ? 'disabled' : ''}><i class="fas fa-check"></i></button>
                        <button class="btn-icon delete-shift" data-id="${shift.id}" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Add event listeners
    setTimeout(() => {
        document.querySelectorAll('.edit-shift').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                editShift(id);
            });
        });
        
        document.querySelectorAll('.confirm-shift').forEach(button => {
            button.addEventListener('click', async function() {
                const id = this.getAttribute('data-id');
                await updateShiftStatus(id, 'confirmed');
            });
        });
        
        document.querySelectorAll('.delete-shift').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                deleteShift(id);
            });
        });
    }, 100);
}

// Get CSS class for shift status
function getStatusClass(status) {
    switch(status) {
        case 'confirmed': return 'confirmed';
        case 'in_progress': return 'in-progress';
        case 'completed': return 'completed';
        case 'cancelled': return 'cancelled';
        default: return 'pending';
    }
}

// Update shift status
async function updateShiftStatus(shiftId, status) {
    try {
        const updateData = { status };
        
        if (status === 'confirmed') {
            updateData.confirmed_at = new Date().toISOString();
        } else if (status === 'completed') {
            updateData.completed_at = new Date().toISOString();
        }
        
        const { error } = await window.supabaseClient
            .from('shifts')
            .update(updateData)
            .eq('id', shiftId);
        
        if (error) throw error;
        
        showMessage(`✅ Shift marked as ${status}`, 'success');
        await loadUpcomingShifts();
        
    } catch (error) {
        console.error('❌ Error updating shift:', error);
        showMessage('❌ Error updating shift: ' + error.message, 'error');
    }
}

// Edit shift
async function editShift(id) {
    try {
        const { data: shift, error } = await window.supabaseClient
            .from('shifts')
            .select(`
                *,
                locations (name, hourly_rate),
                staff (id, name)
            `)
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        const locationName = escapeHtml(shift.locations?.name || '');
        const staffId = shift.staff?.id || '';
        const staffName = shift.staff?.name || '';
        
        const html = `
            <div class="modal-content">
                <h2>Edit Shift</h2>
                <form id="editShiftForm">
                    <div class="form-group">
                        <label for="editShiftLocation">Location</label>
                        <input type="text" id="editShiftLocation" value="${locationName}" required>
                    </div>
                    <div class="form-group">
                        <label for="editShiftStaff">Assign to Staff</label>
                        <select id="editShiftStaff" class="form-control">
                            <option value="">Unassigned</option>
                            ${appStaff.map(staff => `
                                <option value="${staff.id}" ${staff.id === staffId ? 'selected' : ''}>
                                    ${escapeHtml(staff.name)} (${staff.role})
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editShiftDate">Date</label>
                            <input type="date" id="editShiftDate" value="${shift.shift_date}" required>
                        </div>
                        <div class="form-group">
                            <label for="editShiftTime">Start Time</label>
                            <input type="time" id="editShiftTime" value="${shift.start_time}" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editShiftDuration">Duration (hours)</label>
                            <input type="number" id="editShiftDuration" value="${shift.duration}" min="0.5" max="24" step="0.5" required>
                        </div>
                        <div class="form-group">
                            <label for="editShiftStatus">Status</label>
                            <select id="editShiftStatus" class="form-control">
                                <option value="pending" ${shift.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="confirmed" ${shift.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                                <option value="in_progress" ${shift.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                                <option value="completed" ${shift.status === 'completed' ? 'selected' : ''}>Completed</option>
                                <option value="cancelled" ${shift.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="editShiftNotes">Notes</label>
                        <textarea id="editShiftNotes" rows="3">${escapeHtml(shift.notes || '')}</textarea>
                    </div>
                    <div style="margin-top:20px; display:flex; gap:10px;">
                        <button type="submit" class="btn btn-primary" style="flex:1;">
                            <i class="fas fa-save"></i> Save Changes
                        </button>
                        <button type="button" class="btn cancel-btn" style="flex:1;">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        showModal(html);
        
        document.getElementById('editShiftForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const locationName = document.getElementById('editShiftLocation').value.trim();
            const staffId = document.getElementById('editShiftStaff').value;
            const date = document.getElementById('editShiftDate').value;
            const time = document.getElementById('editShiftTime').value;
            const duration = parseFloat(document.getElementById('editShiftDuration').value);
            const status = document.getElementById('editShiftStatus').value;
            const notes = document.getElementById('editShiftNotes').value.trim();
            
            // Find or create location
            const locationId = await findOrCreateLocation(locationName, duration, shift.locations?.hourly_rate || window.CONFIG.DEFAULT_HOURLY_RATE);
            
            const updateData = {
                location_id: locationId,
                staff_id: staffId || null,
                shift_date: date,
                start_time: time,
                duration: duration,
                status: status,
                notes: notes
            };
            
            const { error: updateError } = await window.supabaseClient
                .from('shifts')
                .update(updateData)
                .eq('id', id);
            
            if (updateError) throw updateError;
            
            closeModal();
            showMessage('✅ Shift updated!', 'success');
            await loadUpcomingShifts();
        });
        
        document.querySelector('.cancel-btn').addEventListener('click', closeModal);
        
    } catch (error) {
        console.error('❌ Error editing shift:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    }
}

// Delete shift
async function deleteShift(id) {
    const html = `
        <div class="modal-content">
            <h2>Confirm Delete Shift</h2>
            <p style="margin:15px 0;">Are you sure you want to delete this shift?</p>
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button class="btn confirm-delete-btn" data-id="${id}" style="flex:1; background:#dc3545; color:white; border:none;">
                    <i class="fas fa-trash"></i> Yes, Delete
                </button>
                <button class="btn cancel-btn" style="flex:1;">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `;
    
    showModal(html);
    
    document.querySelector('.confirm-delete-btn').addEventListener('click', async function() {
        const shiftId = this.getAttribute('data-id');
        
        try {
            const { error } = await window.supabaseClient
                .from('shifts')
                .delete()
                .eq('id', shiftId);
            
            if (error) throw error;
            
            closeModal();
            showMessage('✅ Shift deleted!', 'success');
            await loadUpcomingShifts();
            
        } catch (error) {
            console.error('❌ Error deleting shift:', error);
            showMessage('❌ Error: ' + error.message, 'error');
        }
    });
    
    document.querySelector('.cancel-btn').addEventListener('click', closeModal);
}

// View all staff
window.viewStaff = async function() {
    try {
        const staff = await loadStaff();
        
        let staffHtml = '';
        if (staff && staff.length > 0) {
            staff.forEach(person => {
                staffHtml += `
                    <div class="staff-item">
                        <div>
                            <h4>${escapeHtml(person.name)}</h4>
                            <p>${person.email} • ${person.role} • $${person.hourly_rate}/hr</p>
                            <p style="color: ${person.is_active ? '#28a745' : '#dc3545'};">
                                ${person.is_active ? 'Active' : 'Inactive'}
                            </p>
                        </div>
                        <div class="staff-actions">
                            <button class="btn-icon edit-staff" data-id="${person.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon delete-staff" data-id="${person.id}" title="Delete" style="color: #dc3545;"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            });
        } else {
            staffHtml = '<p style="text-align:center; padding:20px;">No staff found.</p>';
        }
        
        const html = `
            <div class="modal-content">
                <h2>Manage Staff</h2>
                <div style="margin-bottom: 20px;">
                    <button onclick="addNewStaff()" class="btn btn-primary">
                        <i class="fas fa-user-plus"></i> Add New Staff
                    </button>
                </div>
                <div class="staff-list">
                    ${staffHtml}
                </div>
                <div style="margin-top:20px;">
                    <button onclick="closeModal()" class="btn" style="width:100%;">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            </div>
        `;
        
        showModal(html);
        
        setTimeout(() => {
            document.querySelectorAll('.edit-staff').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    editStaff(id);
                });
            });
            
            document.querySelectorAll('.delete-staff').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    deleteStaff(id);
                });
            });
        }, 100);
        
    } catch (error) {
        console.error('❌ Error loading staff:', error);
        showMessage('❌ Error loading staff: ' + error.message, 'error');
    }
};

// Add new staff member
window.addNewStaff = function() {
    const html = `
        <div class="modal-content">
            <h2>Add New Staff Member</h2>
            <form id="addStaffForm">
                <div class="form-group">
                    <label for="newStaffName">Full Name</label>
                    <input type="text" id="newStaffName" required>
                </div>
                <div class="form-group">
                    <label for="newStaffEmail">Email</label>
                    <input type="email" id="newStaffEmail" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="newStaffRole">Role</label>
                        <select id="newStaffRole" class="form-control">
                            <option value="employee">Employee</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="newStaffRate">Hourly Rate ($)</label>
                        <input type="number" id="newStaffRate" value="23.00" step="0.01" min="1" required>
                    </div>
                </div>
                <div class="form-group">
                    <label class="checkbox">
                        <input type="checkbox" id="newStaffActive" checked>
                        <span>Active</span>
                    </label>
                </div>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button type="submit" class="btn btn-primary" style="flex:1;">
                        <i class="fas fa-save"></i> Add Staff
                    </button>
                    <button type="button" class="btn cancel-btn" style="flex:1;">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    
    showModal(html);
    
    document.getElementById('addStaffForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('newStaffName').value.trim();
        const email = document.getElementById('newStaffEmail').value.trim();
        const role = document.getElementById('newStaffRole').value;
        const rate = parseFloat(document.getElementById('newStaffRate').value);
        const isActive = document.getElementById('newStaffActive').checked;
        
        try {
            const { error } = await window.supabaseClient
                .from('staff')
                .insert([{
                    name,
                    email,
                    role,
                    hourly_rate: rate,
                    is_active: isActive
                }]);
            
            if (error) throw error;
            
            closeModal();
            showMessage('✅ Staff member added!', 'success');
            await loadStaff();
            viewStaff(); // Refresh the staff list
            
        } catch (error) {
            console.error('❌ Error adding staff:', error);
            showMessage('❌ Error: ' + error.message, 'error');
        }
    });
    
    document.querySelector('.cancel-btn').addEventListener('click', closeModal);
};

// Edit staff member
async function editStaff(id) {
    try {
        const { data: staff, error } = await window.supabaseClient
            .from('staff')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        const html = `
            <div class="modal-content">
                <h2>Edit Staff Member</h2>
                <form id="editStaffForm">
                    <div class="form-group">
                        <label for="editStaffName">Full Name</label>
                        <input type="text" id="editStaffName" value="${escapeHtml(staff.name)}" required>
                    </div>
                    <div class="form-group">
                        <label for="editStaffEmail">Email</label>
                        <input type="email" id="editStaffEmail" value="${escapeHtml(staff.email || '')}" required>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editStaffRole">Role</label>
                            <select id="editStaffRole" class="form-control">
                                <option value="employee" ${staff.role === 'employee' ? 'selected' : ''}>Employee</option>
                                <option value="manager" ${staff.role === 'manager' ? 'selected' : ''}>Manager</option>
                                <option value="admin" ${staff.role === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editStaffRate">Hourly Rate ($)</label>
                            <input type="number" id="editStaffRate" value="${staff.hourly_rate}" step="0.01" min="1" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="checkbox">
                            <input type="checkbox" id="editStaffActive" ${staff.is_active ? 'checked' : ''}>
                            <span>Active</span>
                        </label>
                    </div>
                    <div style="margin-top:20px; display:flex; gap:10px;">
                        <button type="submit" class="btn btn-primary" style="flex:1;">
                            <i class="fas fa-save"></i> Save Changes
                        </button>
                        <button type="button" class="btn cancel-btn" style="flex:1;">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        showModal(html);
        
        document.getElementById('editStaffForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('editStaffName').value.trim();
            const email = document.getElementById('editStaffEmail').value.trim();
            const role = document.getElementById('editStaffRole').value;
            const rate = parseFloat(document.getElementById('editStaffRate').value);
            const isActive = document.getElementById('editStaffActive').checked;
            
            const { error: updateError } = await window.supabaseClient
                .from('staff')
                .update({
                    name,
                    email,
                    role,
                    hourly_rate: rate,
                    is_active: isActive,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);
            
            if (updateError) throw updateError;
            
            closeModal();
            showMessage('✅ Staff member updated!', 'success');
            await loadStaff();
            viewStaff(); // Refresh the staff list
            
        });
        
        document.querySelector('.cancel-btn').addEventListener('click', closeModal);
        
    } catch (error) {
        console.error('❌ Error editing staff:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    }
}

// Delete staff member
async function deleteStaff(id) {
    const html = `
        <div class="modal-content">
            <h2>Confirm Delete Staff Member</h2>
            <p style="margin:15px 0;">Are you sure you want to delete this staff member?</p>
            <p style="color:#dc3545; font-weight:bold;">
                Warning: This will remove all their shift assignments!
            </p>
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button class="btn confirm-delete-staff-btn" data-id="${id}" style="flex:1; background:#dc3545; color:white; border:none;">
                    <i class="fas fa-trash"></i> Yes, Delete
                </button>
                <button class="btn cancel-btn" style="flex:1;">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `;
    
    showModal(html);
    
    document.querySelector('.confirm-delete-staff-btn').addEventListener('click', async function() {
        const staffId = this.getAttribute('data-id');
        
        try {
            // First, remove staff from shifts
            const { error: shiftError } = await window.supabaseClient
                .from('shifts')
                .update({ staff_id: null })
                .eq('staff_id', staffId);
            
            if (shiftError) throw shiftError;
            
            // Then delete the staff member
            const { error: staffError } = await window.supabaseClient
                .from('staff')
                .delete()
                .eq('id', staffId);
            
            if (staffError) throw staffError;
            
            closeModal();
            showMessage('✅ Staff member deleted!', 'success');
            await loadStaff();
            viewStaff(); // Refresh the staff list
            
        } catch (error) {
            console.error('❌ Error deleting staff:', error);
            showMessage('❌ Error: ' + error.message, 'error');
        }
    });
    
    document.querySelector('.cancel-btn').addEventListener('click', closeModal);
}

// View shift calendar
window.viewShiftCalendar = function() {
    const html = `
        <div class="modal-content">
            <h2>Shift Calendar</h2>
            <div style="margin-bottom: 15px;">
                <button onclick="viewUpcomingShifts()" class="btn btn-primary">
                    <i class="fas fa-list"></i> List View
                </button>
                <button onclick="viewMonthlyCalendar()" class="btn" style="margin-left: 10px;">
                    <i class="fas fa-calendar-alt"></i> Monthly View
                </button>
            </div>
            <div id="calendarView">
                <!-- Calendar will be loaded here -->
                <p>Loading calendar...</p>
            </div>
            <div style="margin-top:20px;">
                <button onclick="closeModal()" class="btn" style="width:100%;">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        </div>
    `;
    
    showModal(html);
    viewUpcomingShifts(); // Show list view by default
};

// View upcoming shifts in list format
async function viewUpcomingShifts() {
    try {
        const shifts = await loadUpcomingShifts();
        const calendarView = document.getElementById('calendarView');
        
        if (!calendarView) return;
        
        if (!shifts || shifts.length === 0) {
            calendarView.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-calendar" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p>No upcoming shifts scheduled.</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="upcoming-shifts-list">';
        
        // Group shifts by date
        const shiftsByDate = {};
        shifts.forEach(shift => {
            const date = shift.shift_date;
            if (!shiftsByDate[date]) {
                shiftsByDate[date] = [];
            }
            shiftsByDate[date].push(shift);
        });
        
        // Sort dates
        const sortedDates = Object.keys(shiftsByDate).sort();
        
        sortedDates.forEach(date => {
            html += `
                <div class="calendar-day">
                    <h3 style="margin: 20px 0 10px; padding-bottom: 5px; border-bottom: 2px solid #667eea;">
                        ${formatDate(date)}
                    </h3>
            `;
            
            shiftsByDate[date].forEach(shift => {
                const locationName = shift.locations?.name || 'Unknown';
                const staffName = shift.staff?.name || 'Unassigned';
                const statusClass = getStatusClass(shift.status);
                
                html += `
                    <div class="calendar-shift-item">
                        <div>
                            <strong>${shift.start_time} - ${locationName}</strong><br>
                            <span style="color: #666;">${staffName} • ${shift.duration} hrs</span>
                            <span class="shift-status ${statusClass}" style="margin-left: 10px;">${shift.status}</span>
                        </div>
                        <div>
                            <button class="btn-icon" onclick="editShift('${shift.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
        });
        
        html += '</div>';
        calendarView.innerHTML = html;
        
    } catch (error) {
        console.error('❌ Error loading calendar:', error);
        document.getElementById('calendarView').innerHTML = `
            <div style="color: #dc3545; text-align: center; padding: 20px;">
                Error loading calendar: ${error.message}
            </div>
        `;
    }
}

// View monthly calendar
async function viewMonthlyCalendar() {
    const calendarView = document.getElementById('calendarView');
    if (!calendarView) return;
    
    calendarView.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i>
            <p>Loading monthly calendar...</p>
        </div>
    `;
    
    // This would be implemented to show a full calendar view
    // For now, we'll show a simple implementation
    setTimeout(() => {
        calendarView.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <h3>Monthly Calendar View</h3>
                <p>Full calendar implementation coming soon!</p>
                <p>For now, use the list view to see upcoming shifts.</p>
                <button onclick="viewUpcomingShifts()" class="btn btn-primary" style="margin-top: 15px;">
                    <i class="fas fa-list"></i> Back to List View
                </button>
            </div>
        `;
    }, 500);
}

console.log('✅ Shifts module loaded');
