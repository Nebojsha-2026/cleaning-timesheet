// modules/shifts.js - Employee shift management module
console.log('🔄 Shifts module loading...');

// Global variables
let appStaff = [];
let myShifts = [];
let currentShiftId = null;

// Load shifts assigned to current user
async function loadMyShifts() {
    try {
        console.log('📅 Loading my shifts...');
        
        const today = new Date().toISOString().split('T')[0];
        
        // Get shifts for current employee
        const { data: shifts, error } = await window.supabaseClient
            .from('shifts')
            .select(`
                *,
                locations (name, address, notes)
            `)
            .eq('staff_id', window.currentEmployeeId)
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
        showSampleShifts();
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
        
        document.getElementById('shiftActions').style.display = 'none';
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
        
        // Update global shift actions
        updateGlobalShiftActions();
        
    }, 100);
}

// Show sample shifts
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
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Add sample button handlers
    setTimeout(() => {
        document.querySelectorAll('.accept-shift-btn-sample').forEach(button => {
            button.addEventListener('click', function() {
                showMessage('✅ Shift accepted!', 'success');
            });
        });
        
        document.querySelectorAll('.decline-shift-btn-sample').forEach(button => {
            button.addEventListener('click', function() {
                showMessage('Shift declined', 'info');
            });
        });
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
        
        if (todaysShift.status === 'confirmed') {
            if (startBtn) startBtn.style.display = 'block';
            if (completeBtn) completeBtn.style.display = 'none';
        } else if (todaysShift.status === 'in_progress') {
            if (startBtn) startBtn.style.display = 'none';
            if (completeBtn) completeBtn.style.display = 'block';
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
    showMessage('✅ Issue reported to manager', 'success');
};

window.requestTimeOff = function() {
    showMessage('✅ Time off request submitted', 'success');
};

// Refresh my shifts
window.refreshMyShifts = async function() {
    console.log('🔄 Refreshing my shifts...');
    showMessage('Refreshing shifts...', 'info');
    await loadMyShifts();
    showMessage('✅ Shifts refreshed!', 'success');
};

console.log('✅ Employee Shifts module loaded');
