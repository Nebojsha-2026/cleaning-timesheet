// modules/shifts.js - Employee shift management module
console.log('🔄 Shifts module loading (Employee View)...');

// Global variables
let appStaff = [];
let myShifts = [];
let currentShiftId = null;

// Load staff members (for reference)
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
      
        return appStaff;
      
    } catch (error) {
        console.error('❌ Error loading staff:', error);
        return [];
    }
}

// Load shifts assigned to current user
async function loadMyShifts() {
    try {
        console.log('📅 Loading my shifts...');
        
        const today = new Date().toISOString().split('T')[0];
        
        // For now, get all shifts (in real app, filter by logged-in user)
        const { data: shifts, error } = await window.supabaseClient
            .from('shifts')
            .select(`
                *,
                locations (name, address, notes),
                staff (name, email)
            `)
            .gte('shift_date', today)
            .order('shift_date', { ascending: true })
            .order('start_time', { ascending: true })
            .limit(10);
        
        if (error) throw error;
        
        myShifts = shifts || [];
        updateMyShiftsDisplay(myShifts);
        console.log('✅ My shifts loaded:', myShifts.length);
        
        return myShifts;
        
    } catch (error) {
        console.error('❌ Error loading shifts:', error);
        
        // If table doesn't exist yet, show sample data
        if (error.message.includes('does not exist')) {
            console.log('⚠️ Shifts table not created yet, showing sample data');
            showSampleShifts();
        }
        
        return [];
    }
}

// Update my shifts display
function updateMyShiftsDisplay(shifts) {
    const container = document.getElementById('myShiftsList');
    if (!container) return;
    
    if (!shifts || shifts.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-calendar-check" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <p>No upcoming shifts scheduled.</p>
                <p style="font-size: 0.9rem;">Check back later or contact your manager.</p>
            </div>
        `;
        
        // Hide shift actions
        document.getElementById('shiftActions').style.display = 'none';
        return;
    }
    
    let html = '';
    shifts.forEach(shift => {
        const locationName = shift.locations?.name || 'Unknown Location';
        const staffName = shift.staff?.name || 'Manager';
        const statusClass = getShiftStatusClass(shift.status);
        const isToday = shift.shift_date === new Date().toISOString().split('T')[0];
        const canStart = shift.status === 'confirmed' && isToday;
        const canComplete = shift.status === 'in_progress';
        
        html += `
            <div class="shift-item ${isToday ? 'today-shift' : ''}" data-shift-id="${shift.id}">
                <div class="shift-info">
                    <h4>${escapeHtml(locationName)} 
                        <span class="shift-status ${statusClass}">${shift.status}</span>
                        ${isToday ? '<span class="today-badge">TODAY</span>' : ''}
                    </h4>
                    <p>
                        <i class="far fa-calendar"></i> ${formatDate(shift.shift_date)} 
                        • <i class="far fa-clock"></i> ${formatTime(shift.start_time)} 
                        • ${shift.duration} hours
                    </p>
                    <p style="color: #666; font-size: 0.9rem; margin-top: 5px;">
                        <i class="fas fa-user-tie"></i> Assigned by: ${escapeHtml(staffName)}
                        ${shift.notes ? `<br><i class="fas fa-sticky-note"></i> ${escapeHtml(shift.notes)}` : ''}
                    </p>
                </div>
                <div class="shift-actions-employee">
                    ${shift.status === 'pending' ? `
                        <button class="btn btn-sm btn-success accept-shift-btn" data-id="${shift.id}">
                            <i class="fas fa-check"></i> Accept
                        </button>
                        <button class="btn btn-sm btn-danger decline-shift-btn" data-id="${shift.id}">
                            <i class="fas fa-times"></i> Decline
                        </button>
                    ` : ''}
                    
                    ${canStart ? `
                        <button class="btn btn-sm btn-primary start-shift-btn" data-id="${shift.id}">
                            <i class="fas fa-play"></i> Start
                        </button>
                    ` : ''}
                    
                    ${canComplete ? `
                        <button class="btn btn-sm btn-success complete-shift-btn" data-id="${shift.id}">
                            <i class="fas fa-flag-checkered"></i> Complete
                        </button>
                    ` : ''}
                    
                    ${shift.status === 'completed' ? `
                        <span style="color: #28a745; font-weight: bold;">
                            <i class="fas fa-check-circle"></i> Completed
                        </span>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Add event listeners
    setTimeout(() => {
        // Accept shift buttons
        document.querySelectorAll('.accept-shift-btn').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                updateShiftStatus(id, 'confirmed');
            });
        });
        
        // Decline shift buttons
        document.querySelectorAll('.decline-shift-btn').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                declineShift(id);
            });
        });
        
        // Start shift buttons
        document.querySelectorAll('.start-shift-btn').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                startSpecificShift(id);
            });
        });
        
        // Complete shift buttons
        document.querySelectorAll('.complete-shift-btn').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                completeSpecificShift(id);
            });
        });
        
        // Show/hide global shift actions based on today's shifts
        updateGlobalShiftActions();
        
    }, 100);
}

// Show sample shifts (for demo before database is set up)
function showSampleShifts() {
    const container = document.getElementById('myShiftsList');
    if (!container) return;
    
    const sampleShifts = [
        {
            id: 'sample1',
            location_name: 'Main Office',
            shift_date: new Date().toISOString().split('T')[0],
            start_time: '09:00',
            duration: 3,
            status: 'pending',
            notes: 'Regular cleaning - all floors'
        },
        {
            id: 'sample2',
            location_name: 'Private Residence',
            shift_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
            start_time: '14:00',
            duration: 2,
            status: 'confirmed',
            notes: 'Spring cleaning requested'
        }
    ];
    
    let html = '<div style="margin-bottom: 15px; color: #666; font-size: 0.9rem; text-align: center;">📋 Showing sample shifts (database not set up yet)</div>';
    
    sampleShifts.forEach(shift => {
        const statusClass = getShiftStatusClass(shift.status);
        const isToday = shift.shift_date === new Date().toISOString().split('T')[0];
        
        html += `
            <div class="shift-item ${isToday ? 'today-shift' : ''}">
                <div class="shift-info">
                    <h4>${escapeHtml(shift.location_name)} 
                        <span class="shift-status ${statusClass}">${shift.status}</span>
                        ${isToday ? '<span class="today-badge">TODAY</span>' : ''}
                    </h4>
                    <p>
                        <i class="far fa-calendar"></i> ${formatDate(shift.shift_date)} 
                        • <i class="far fa-clock"></i> ${shift.start_time} 
                        • ${shift.duration} hours
                    </p>
                    <p style="color: #666; font-size: 0.9rem; margin-top: 5px;">
                        <i class="fas fa-sticky-note"></i> ${escapeHtml(shift.notes)}
                    </p>
                </div>
                <div class="shift-actions-employee">
                    ${shift.status === 'pending' ? `
                        <button class="btn btn-sm btn-success" onclick="showMessage('Shift accepted! (Sample)', 'success')">
                            <i class="fas fa-check"></i> Accept
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="showMessage('Shift declined! (Sample)', 'info')">
                            <i class="fas fa-times"></i> Decline
                        </button>
                    ` : ''}
                    
                    ${shift.status === 'confirmed' && isToday ? `
                        <button class="btn btn-sm btn-primary" onclick="showMessage('Shift started! (Sample)', 'success')">
                            <i class="fas fa-play"></i> Start
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    html += `
        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 0.9rem;">
            <i class="fas fa-info-circle"></i> Set up database tables to see real shifts
        </div>
    `;
    
    container.innerHTML = html;
}

// Get CSS class for shift status
function getShiftStatusClass(status) {
    switch(status) {
        case 'confirmed': return 'confirmed';
        case 'in_progress': return 'in-progress';
        case 'completed': return 'completed';
        case 'cancelled': return 'cancelled';
        default: return 'pending';
    }
}

// Format time for display
function formatTime(timeString) {
    if (!timeString) return '';
    
    // Convert "14:30" to "2:30 PM"
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    
    return `${displayHour}:${minutes} ${ampm}`;
}

// Update shift status (accept/start/complete)
async function updateShiftStatus(shiftId, status) {
    try {
        const updateData = { status };
        
        if (status === 'confirmed') {
            updateData.confirmed_at = new Date().toISOString();
        } else if (status === 'in_progress') {
            updateData.actual_start_time = new Date().toTimeString().split(' ')[0].substring(0, 5);
        } else if (status === 'completed') {
            updateData.completed_at = new Date().toISOString();
            updateData.actual_end_time = new Date().toTimeString().split(' ')[0].substring(0, 5);
            
            // Calculate actual duration
            const shift = myShifts.find(s => s.id === shiftId);
            if (shift && shift.actual_start_time) {
                const start = new Date(`2000-01-01T${shift.actual_start_time}`);
                const end = new Date(`2000-01-01T${updateData.actual_end_time}`);
                const durationMs = end - start;
                const durationHours = durationMs / (1000 * 60 * 60);
                updateData.actual_duration = durationHours.toFixed(2);
            }
        }
        
        const { error } = await window.supabaseClient
            .from('shifts')
            .update(updateData)
            .eq('id', shiftId);
        
        if (error) throw error;
        
        showMessage(`✅ Shift marked as ${status.replace('_', ' ')}`, 'success');
        await loadMyShifts();
        
    } catch (error) {
        console.error('❌ Error updating shift:', error);
        showMessage('❌ Error updating shift: ' + error.message, 'error');
    }
}

// Decline a shift
async function declineShift(shiftId) {
    const html = `
        <div class="modal-content">
            <h2>Decline Shift</h2>
            <form id="declineShiftForm">
                <div class="form-group">
                    <label for="declineReason">Reason for declining</label>
                    <select id="declineReason" class="form-control" required>
                        <option value="">Select a reason...</option>
                        <option value="unavailable">Not available</option>
                        <option value="sick">Sick/Illness</option>
                        <option value="personal">Personal reasons</option>
                        <option value="transport">Transport issues</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="declineNotes">Additional notes (optional)</label>
                    <textarea id="declineNotes" rows="3" placeholder="Provide more details..."></textarea>
                </div>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button type="submit" class="btn btn-danger" style="flex:1;">
                        <i class="fas fa-times"></i> Decline Shift
                    </button>
                    <button type="button" class="btn cancel-btn" style="flex:1;">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    
    showModal(html);
    
    document.getElementById('declineShiftForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const reason = document.getElementById('declineReason').value;
        const notes = document.getElementById('declineNotes').value.trim();
        
        try {
            const { error } = await window.supabaseClient
                .from('shifts')
                .update({
                    status: 'cancelled',
                    notes: `DECLINED: ${reason}. ${notes ? 'Notes: ' + notes : ''}`
                })
                .eq('id', shiftId);
            
            if (error) throw error;
            
            closeModal();
            showMessage('✅ Shift declined successfully', 'success');
            await loadMyShifts();
            
        } catch (error) {
            console.error('❌ Error declining shift:', error);
            showMessage('❌ Error declining shift: ' + error.message, 'error');
        }
    });
    
    document.querySelector('.cancel-btn').addEventListener('click', closeModal);
}

// Start a specific shift
async function startSpecificShift(shiftId) {
    currentShiftId = shiftId;
    
    // Show confirmation modal
    const html = `
        <div class="modal-content">
            <h2>Start Shift</h2>
            <p>Are you ready to start your shift?</p>
            <p style="color: #666; font-size: 0.9rem;">Starting time will be recorded automatically.</p>
            
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button class="btn btn-primary confirm-start-btn" style="flex:1;">
                    <i class="fas fa-play"></i> Yes, Start Now
                </button>
                <button class="btn cancel-btn" style="flex:1;">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `;
    
    showModal(html);
    
    document.querySelector('.confirm-start-btn').addEventListener('click', async () => {
        await updateShiftStatus(shiftId, 'in_progress');
        closeModal();
    });
    
    document.querySelector('.cancel-btn').addEventListener('click', closeModal);
}

// Complete a specific shift
async function completeSpecificShift(shiftId) {
    const html = `
        <div class="modal-content">
            <h2>Complete Shift</h2>
            <form id="completeShiftForm">
                <div class="form-group">
                    <label for="completionNotes">Completion notes (optional)</label>
                    <textarea id="completionNotes" rows="3" placeholder="Any issues, notes, or feedback..."></textarea>
                </div>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button type="submit" class="btn btn-success" style="flex:1;">
                        <i class="fas fa-check"></i> Mark as Complete
                    </button>
                    <button type="button" class="btn cancel-btn" style="flex:1;">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    
    showModal(html);
    
    document.getElementById('completeShiftForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const notes = document.getElementById('completionNotes').value.trim();
        
        try {
            // First update status
            await updateShiftStatus(shiftId, 'completed');
            
            // Add completion notes if provided
            if (notes) {
                const { error } = await window.supabaseClient
                    .from('shifts')
                    .update({ notes: notes })
                    .eq('id', shiftId);
                
                if (error) throw error;
            }
            
            closeModal();
            
        } catch (error) {
            console.error('❌ Error completing shift:', error);
            showMessage('❌ Error completing shift: ' + error.message, 'error');
        }
    });
    
    document.querySelector('.cancel-btn').addEventListener('click', closeModal);
}

// Update global shift actions (show/hide based on current shifts)
function updateGlobalShiftActions() {
    const shiftActions = document.getElementById('shiftActions');
    if (!shiftActions) return;
    
    const today = new Date().toISOString().split('T')[0];
    const todaysShift = myShifts.find(shift => 
        shift.shift_date === today && 
        (shift.status === 'confirmed' || shift.status === 'in_progress')
    );
    
    if (todaysShift) {
        shiftActions.style.display = 'block';
        currentShiftId = todaysShift.id;
        
        // Update button states
        const startBtn = document.getElementById('startShiftBtn');
        const completeBtn = document.getElementById('completeShiftBtn');
        
        if (todaysShift.status === 'confirmed') {
            startBtn.style.display = 'block';
            completeBtn.style.display = 'none';
        } else if (todaysShift.status === 'in_progress') {
            startBtn.style.display = 'none';
            completeBtn.style.display = 'block';
        }
    } else {
        shiftActions.style.display = 'none';
        currentShiftId = null;
    }
}

// Global shift action functions
window.startShift = function() {
    if (currentShiftId) {
        startSpecificShift(currentShiftId);
    } else {
        showMessage('❌ No active shift found', 'error');
    }
};

window.completeShift = function() {
    if (currentShiftId) {
        completeSpecificShift(currentShiftId);
    } else {
        showMessage('❌ No active shift found', 'error');
    }
};

window.reportIssue = function() {
    const html = `
        <div class="modal-content">
            <h2>Report Issue</h2>
            <form id="issueReportForm">
                <div class="form-group">
                    <label for="issueType">Issue Type</label>
                    <select id="issueType" class="form-control" required>
                        <option value="">Select issue type...</option>
                        <option value="equipment">Equipment Problem</option>
                        <option value="access">Access Issue</option>
                        <option value="safety">Safety Concern</option>
                        <option value="client">Client Issue</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="issueDescription">Description</label>
                    <textarea id="issueDescription" rows="4" required placeholder="Describe the issue in detail..."></textarea>
                </div>
                <div class="form-group">
                    <label class="checkbox">
                        <input type="checkbox" id="urgentIssue">
                        <span>Urgent - requires immediate attention</span>
                    </label>
                </div>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button type="submit" class="btn btn-warning" style="flex:1;">
                        <i class="fas fa-exclamation-triangle"></i> Submit Report
                    </button>
                    <button type="button" class="btn cancel-btn" style="flex:1;">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    
    showModal(html);
    
    document.getElementById('issueReportForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const issueType = document.getElementById('issueType').value;
        const description = document.getElementById('issueDescription').value.trim();
        const urgent = document.getElementById('urgentIssue').checked;
        
        // In a real app, you would save this to a database
        showMessage(`✅ Issue reported ${urgent ? '(URGENT)' : ''}. Manager has been notified.`, 'success');
        closeModal();
    });
    
    document.querySelector('.cancel-btn').addEventListener('click', closeModal);
};

window.requestTimeOff = function() {
    const html = `
        <div class="modal-content">
            <h2>Request Time Off</h2>
            <form id="timeOffForm">
                <div class="form-row">
                    <div class="form-group">
                        <label for="timeOffStart">Start Date</label>
                        <input type="date" id="timeOffStart" required>
                    </div>
                    <div class="form-group">
                        <label for="timeOffEnd">End Date</label>
                        <input type="date" id="timeOffEnd" required>
                    </div>
                </div>
                <div class="form-group">
                    <label for="timeOffReason">Reason</label>
                    <select id="timeOffReason" class="form-control" required>
                        <option value="">Select reason...</option>
                        <option value="vacation">Vacation</option>
                        <option value="sick">Sick Leave</option>
                        <option value="personal">Personal Day</option>
                        <option value="family">Family Emergency</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="timeOffNotes">Additional Details (optional)</label>
                    <textarea id="timeOffNotes" rows="3" placeholder="Provide any additional information..."></textarea>
                </div>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button type="submit" class="btn btn-primary" style="flex:1;">
                        <i class="fas fa-paper-plane"></i> Submit Request
                    </button>
                    <button type="button" class="btn cancel-btn" style="flex:1;">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    
    showModal(html);
    
    // Set default dates (next week)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const endOfNextWeek = new Date(nextWeek);
    endOfNextWeek.setDate(nextWeek.getDate() + 2);
    
    document.getElementById('timeOffStart').value = nextWeek.toISOString().split('T')[0];
    document.getElementById('timeOffEnd').value = endOfNextWeek.toISOString().split('T')[0];
    
    document.getElementById('timeOffForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const startDate = document.getElementById('timeOffStart').value;
        const endDate = document.getElementById('timeOffEnd').value;
        const reason = document.getElementById('timeOffReason').value;
        const notes = document.getElementById('timeOffNotes').value.trim();
        
        // In a real app, you would save this to a database
        showMessage(`✅ Time off request submitted for ${formatDate(startDate)} to ${formatDate(endDate)}.`, 'success');
        closeModal();
    });
    
    document.querySelector('.cancel-btn').addEventListener('click', closeModal);
};

// Refresh my shifts
window.refreshMyShifts = async function() {
    console.log('🔄 Refreshing my shifts...');
    showMessage('Refreshing shifts...', 'info');
    await loadMyShifts();
    showMessage('✅ Shifts refreshed!', 'success');
};

console.log('✅ Employee Shifts module loaded');
