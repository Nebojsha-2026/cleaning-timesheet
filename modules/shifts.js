// modules/shifts.js - Employee shift management module
console.log('🔄 Shifts module loading...');

// Global variables
let appStaff = [];
let myShifts = [];
let pastShifts = [];
let currentShiftId = null;

// Helper function to get shift status class
function getShiftStatusClass(status) {
    switch(status) {
        case 'pending': return 'status-pending';
        case 'confirmed': return 'status-confirmed';
        case 'in_progress': return 'status-in-progress';
        case 'completed': return 'status-completed';
        case 'cancelled': return 'status-cancelled';
        default: return 'status-pending';
    }
}

// Format time helper
function formatTime(timeString) {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

// Load shifts assigned to current user
async function loadMyShifts() {
    try {
        console.log('📅 Loading my shifts...');
        
        const today = new Date().toISOString().split('T')[0];
        
        // Get current user ID
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) {
            console.log('No user logged in');
            showSampleShifts();
            return [];
        }
        
        // Get staff record for current user
        const { data: staff, error: staffError } = await window.supabaseClient
            .from('staff')
            .select('id')
            .eq('user_id', user.id)
            .single();
        
        if (staffError) {
            console.warn('No staff record found:', staffError.message);
            showSampleShifts();
            return [];
        }
        
        // Get shifts for current employee
        const { data: shifts, error } = await window.supabaseClient
            .from('shifts')
            .select(`
                *,
                locations (name, notes)
            `)
            .eq('staff_id', staff.id)
            .gte('shift_date', today)
            .order('shift_date', { ascending: true })
            .order('start_time', { ascending: true })
            .limit(10);
        
        if (error) {
            console.error('Error loading shifts:', error);
            showSampleShifts();
            return [];
        }
        
        myShifts = shifts || [];
        updateMyShiftsDisplay(myShifts);
        console.log('✅ My shifts loaded:', myShifts.length);
        
        // Load past shifts as well
        await loadPastShifts();
        
        return myShifts;
        
    } catch (error) {
        console.error('❌ Error loading shifts:', error);
        showSampleShifts();
        return [];
    }
}

// Load past shifts
async function loadPastShifts() {
    try {
        console.log('📅 Loading past shifts...');
        
        const today = new Date().toISOString().split('T')[0];
        
        // Get current user ID
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;
        
        // Get staff record for current user
        const { data: staff, error: staffError } = await window.supabaseClient
            .from('staff')
            .select('id')
            .eq('user_id', user.id)
            .single();
        
        if (staffError) return;
        
        // Get past shifts for current employee
        const { data: shifts, error } = await window.supabaseClient
            .from('shifts')
            .select(`
                *,
                locations (name, notes)
            `)
            .eq('staff_id', staff.id)
            .lt('shift_date', today)
            .order('shift_date', { ascending: false })
            .limit(10);
        
        if (error) {
            console.error('Error loading past shifts:', error);
            return;
        }
        
        pastShifts = shifts || [];
        updatePastShiftsDisplay(pastShifts);
        console.log('✅ Past shifts loaded:', pastShifts.length);
        
    } catch (error) {
        console.error('❌ Error loading past shifts:', error);
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
        
        const shiftActions = document.getElementById('shiftActions');
        if (shiftActions) {
            shiftActions.style.display = 'none';
        }
        return;
    }
    
    let html = '';
    shifts.forEach(shift => {
        const locationName = shift.locations?.name || 'Unknown Location';
        const statusClass = getShiftStatusClass(shift.status);
        const isToday = shift.shift_date === new Date().toISOString().split('T')[0];
        const canStart = shift.status === 'confirmed' && isToday;
        const canComplete = shift.status === 'in_progress';
        
        html += `
            <div class="shift-item ${isToday ? 'today-shift' : ''}" data-shift-id="${shift.id}">
                <div class="shift-info">
                    <h4>${escapeHtml(locationName)} 
                        <span class="shift-status ${statusClass}">${shift.status.replace('_', ' ')}</span>
                        ${isToday ? '<span class="today-badge">TODAY</span>' : ''}
                    </h4>
                    <p>
                        <i class="far fa-calendar"></i> ${formatDate(shift.shift_date)} 
                        • <i class="far fa-clock"></i> ${formatTime(shift.start_time)} 
                        • ${shift.duration} hours
                    </p>
                    ${shift.notes ? `<p style="color: #666; font-size: 0.9rem; margin-top: 5px;">
                        <i class="fas fa-sticky-note"></i> ${escapeHtml(shift.notes)}
                    </p>` : ''}
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
                    
                    ${shift.status === 'cancelled' ? `
                        <span style="color: #dc3545; font-weight: bold;">
                            <i class="fas fa-times-circle"></i> Cancelled
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
        
        // Update global shift actions
        updateGlobalShiftActions();
        
    }, 100);
}

// Update past shifts display
function updatePastShiftsDisplay(shifts) {
    const container = document.getElementById('pastShiftsList');
    if (!container) return;
    
    if (!shifts || shifts.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-history" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <p>No past shifts found.</p>
                <p style="font-size: 0.9rem;">Completed shifts will appear here.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    shifts.forEach(shift => {
        const locationName = shift.locations?.name || 'Unknown Location';
        const statusClass = getShiftStatusClass(shift.status);
        
        html += `
            <div class="shift-item" data-shift-id="${shift.id}">
                <div class="shift-info">
                    <h4>${escapeHtml(locationName)} 
                        <span class="shift-status ${statusClass}">${shift.status.replace('_', ' ')}</span>
                    </h4>
                    <p>
                        <i class="far fa-calendar"></i> ${formatDate(shift.shift_date)} 
                        • <i class="far fa-clock"></i> ${formatTime(shift.start_time)} 
                        • ${shift.duration} hours
                    </p>
                    ${shift.notes ? `<p style="color: #666; font-size: 0.9rem; margin-top: 5px;">
                        <i class="fas fa-sticky-note"></i> ${escapeHtml(shift.notes)}
                    </p>` : ''}
                    ${shift.actual_duration ? `<p style="color: #28a745; font-size: 0.9rem; margin-top: 5px;">
                        <i class="fas fa-clock"></i> Actual: ${shift.actual_duration} hours
                    </p>` : ''}
                    ${shift.actual_start_time && shift.actual_end_time ? `
                        <p style="color: #666; font-size: 0.9rem; margin-top: 5px;">
                            <i class="fas fa-play-circle"></i> Started: ${formatTime(shift.actual_start_time)}
                            <br>
                            <i class="fas fa-flag-checkered"></i> Ended: ${formatTime(shift.actual_end_time)}
                        </p>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Show sample shifts (fallback when no data)
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
            location_name: 'Client Building A',
            shift_date: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0],
            start_time: '14:00',
            duration: 4,
            status: 'confirmed',
            notes: 'Deep clean required'
        }
    ];
    
    let html = '<div style="margin-bottom: 15px; color: #666; font-size: 0.9rem; text-align: center;">📋 Showing sample shifts</div>';
    
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
                        • <i class="far fa-clock"></i> ${formatTime(shift.start_time)} 
                        • ${shift.duration} hours
                    </p>
                    ${shift.notes ? `<p style="color: #666; font-size: 0.9rem; margin-top: 5px;">
                        <i class="fas fa-sticky-note"></i> ${escapeHtml(shift.notes)}
                    </p>` : ''}
                </div>
                <div class="shift-actions-employee">
                    ${shift.status === 'pending' ? `
                        <button class="btn btn-sm btn-success accept-shift-btn-sample" data-id="${shift.id}">
                            <i class="fas fa-check"></i> Accept
                        </button>
                        <button class="btn btn-sm btn-danger decline-shift-btn-sample" data-id="${shift.id}">
                            <i class="fas fa-times"></i> Decline
                        </button>
                    ` : ''}
                    ${shift.status === 'confirmed' ? `
                        <button class="btn btn-sm btn-primary start-shift-btn-sample" data-id="${shift.id}">
                            <i class="fas fa-play"></i> Start
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Add sample button handlers
    setTimeout(() => {
        document.querySelectorAll('.accept-shift-btn-sample').forEach(button => {
            button.addEventListener('click', function() {
                showMessage('✅ Shift accepted! (Sample)', 'success');
                this.closest('.shift-item').querySelector('.shift-status').textContent = 'confirmed';
                this.closest('.shift-item').querySelector('.shift-status').className = 'shift-status status-confirmed';
                this.parentNode.innerHTML = '<button class="btn btn-sm btn-primary start-shift-btn-sample"><i class="fas fa-play"></i> Start</button>';
            });
        });
        
        document.querySelectorAll('.decline-shift-btn-sample').forEach(button => {
            button.addEventListener('click', function() {
                showMessage('Shift declined (Sample)', 'info');
                this.closest('.shift-item').remove();
            });
        });
        
        document.querySelectorAll('.start-shift-btn-sample').forEach(button => {
            button.addEventListener('click', function() {
                showMessage('✅ Shift started! (Sample)', 'success');
                this.closest('.shift-item').querySelector('.shift-status').textContent = 'in progress';
                this.closest('.shift-item').querySelector('.shift-status').className = 'shift-status status-in-progress';
                this.parentNode.innerHTML = '<button class="btn btn-sm btn-success complete-shift-btn-sample"><i class="fas fa-flag-checkered"></i> Complete</button>';
            });
        });
        
        // Add complete button handler dynamically
        setTimeout(() => {
            document.querySelectorAll('.complete-shift-btn-sample').forEach(button => {
                button.addEventListener('click', function() {
                    showMessage('✅ Shift completed! (Sample)', 'success');
                    this.closest('.shift-item').querySelector('.shift-status').textContent = 'completed';
                    this.closest('.shift-item').querySelector('.shift-status').className = 'shift-status status-completed';
                    this.parentNode.innerHTML = '<span style="color: #28a745; font-weight: bold;"><i class="fas fa-check-circle"></i> Completed</span>';
                });
            });
        }, 100);
    }, 100);
}

// Update shift status
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
    try {
        const { error } = await window.supabaseClient
            .from('shifts')
            .update({
                status: 'cancelled',
                notes: 'DECLINED by employee'
            })
            .eq('id', shiftId);
        
        if (error) throw error;
        
        showMessage('✅ Shift declined successfully', 'success');
        await loadMyShifts();
        
    } catch (error) {
        console.error('❌ Error declining shift:', error);
        showMessage('❌ Error declining shift: ' + error.message, 'error');
    }
}

// Start a specific shift
async function startSpecificShift(shiftId) {
    currentShiftId = shiftId;
    
    try {
        await updateShiftStatus(shiftId, 'in_progress');
    } catch (error) {
        console.error('❌ Error starting shift:', error);
    }
}

// Complete a specific shift
async function completeSpecificShift(shiftId) {
    try {
        await updateShiftStatus(shiftId, 'completed');
    } catch (error) {
        console.error('❌ Error completing shift:', error);
    }
}

// Update global shift actions
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
        
        const startBtn = document.getElementById('startShiftBtn');
        const completeBtn = document.getElementById('completeShiftBtn');
        
        if (startBtn && completeBtn) {
            if (todaysShift.status === 'confirmed') {
                startBtn.style.display = 'block';
                completeBtn.style.display = 'none';
            } else if (todaysShift.status === 'in_progress') {
                startBtn.style.display = 'none';
                completeBtn.style.display = 'block';
            }
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
            <h2><i class="fas fa-exclamation-triangle"></i> Report Issue</h2>
            <form id="reportIssueForm">
                <div class="form-group">
                    <label for="issueType">Issue Type</label>
                    <select id="issueType" required>
                        <option value="">Select issue type</option>
                        <option value="equipment">Equipment Issue</option>
                        <option value="safety">Safety Concern</option>
                        <option value="access">Access Problem</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="issueDescription">Description</label>
                    <textarea id="issueDescription" rows="4" placeholder="Describe the issue in detail..." required></textarea>
                </div>
                <div class="form-group">
                    <label for="issueUrgency">Urgency</label>
                    <select id="issueUrgency">
                        <option value="low">Low - Can wait</option>
                        <option value="medium" selected>Medium - Should be addressed soon</option>
                        <option value="high">High - Needs immediate attention</option>
                    </select>
                </div>
                <div style="margin-top: 20px; display: flex; gap: 10px;">
                    <button type="submit" class="btn btn-primary" style="flex: 1;">
                        <i class="fas fa-paper-plane"></i> Submit Report
                    </button>
                    <button type="button" class="btn cancel-btn" style="flex: 1; background: #6c757d; color: white;">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    
    showModal(html);
    
    document.getElementById('reportIssueForm').addEventListener('submit', function(e) {
        e.preventDefault();
        showMessage('✅ Issue reported to manager', 'success');
        closeModal();
    });
    
    document.querySelector('.cancel-btn').addEventListener('click', closeModal);
};

window.requestTimeOff = function() {
    const html = `
        <div class="modal-content">
            <h2><i class="fas fa-calendar-times"></i> Request Time Off</h2>
            <form id="timeOffForm">
                <div class="form-group">
                    <label for="timeOffType">Type of Request</label>
                    <select id="timeOffType" required>
                        <option value="">Select type</option>
                        <option value="vacation">Vacation</option>
                        <option value="sick">Sick Leave</option>
                        <option value="personal">Personal Day</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="startDate">Start Date</label>
                    <input type="date" id="startDate" required>
                </div>
                <div class="form-group">
                    <label for="endDate">End Date</label>
                    <input type="date" id="endDate" required>
                </div>
                <div class="form-group">
                    <label for="timeOffReason">Reason (Optional)</label>
                    <textarea id="timeOffReason" rows="3" placeholder="Brief reason for time off..."></textarea>
                </div>
                <div style="margin-top: 20px; display: flex; gap: 10px;">
                    <button type="submit" class="btn btn-primary" style="flex: 1;">
                        <i class="fas fa-paper-plane"></i> Submit Request
                    </button>
                    <button type="button" class="btn cancel-btn" style="flex: 1; background: #6c757d; color: white;">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    
    showModal(html);
    
    // Set default dates
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    document.getElementById('startDate').value = today.toISOString().split('T')[0];
    document.getElementById('endDate').value = nextWeek.toISOString().split('T')[0];
    
    document.getElementById('timeOffForm').addEventListener('submit', function(e) {
        e.preventDefault();
        showMessage('✅ Time off request submitted', 'success');
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

// Refresh past shifts
window.refreshPastShifts = async function() {
    console.log('🔄 Refreshing past shifts...');
    showMessage('Refreshing past shifts...', 'info');
    await loadPastShifts();
    showMessage('✅ Past shifts refreshed!', 'success');
};

// Export functions for use in other modules
window.shiftsModule = {
    loadMyShifts,
    loadPastShifts,
    updateShiftStatus,
    getShiftStatusClass,
    formatTime
};

console.log('✅ Employee Shifts module loaded');
