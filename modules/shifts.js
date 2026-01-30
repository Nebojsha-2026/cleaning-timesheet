// modules/shifts.js - Employee shift management module
console.log('🔄 Shifts module loading...');

// Global variables
let appStaff = [];
let myShifts = [];
let pastShifts = [];
let currentShiftId = null;

// Build a JS Date for the shift start (local time)
function getShiftStartDateTime(shift) {
    const dateStr = shift.shift_date; // YYYY-MM-DD
    const timeStr = (shift.start_time || '00:00').slice(0,5); // HH:MM
    return new Date(`${dateStr}T${timeStr}:00`);
}

// Employee cancel rule: can cancel up to 3 hours before start (and only if not started/completed/cancelled)
function canEmployeeCancelShift(shift) {
    const status = (shift.status || '').toLowerCase();
    if (['in_progress', 'completed', 'cancelled'].includes(status)) return false;

    const start = getShiftStartDateTime(shift);
    const diffHours = (start.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    return diffHours >= 3;
}

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

// Initialize shifts module
async function initializeShifts() {
    try {
        console.log('Initializing shifts module...');

        // Wait for auth to be ready
        if (!window.supabaseClient) {
            console.warn('Supabase client not ready, retrying...');
            setTimeout(initializeShifts, 1000);
            return;
        }

        // Load shifts data
        await loadMyShifts();

        // Set up refresh buttons
        setupRefreshButtons();

        console.log('Shifts module initialized successfully');
    } catch (error) {
        console.error('Error initializing shifts:', error);
    }
}

// Load shifts for current employee
async function loadMyShifts() {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) {
            console.log('No authenticated user found');
            return;
        }

        // Get staff record for current user
        const { data: staff, error: staffError } = await window.supabaseClient
            .from('staff')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (staffError || !staff) {
            console.error('Error loading staff record:', staffError);
            showSampleShifts();
            return;
        }

        // Get shifts for current employee
        const today = new Date().toISOString().split('T')[0];
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
        updateUpcomingShiftsDisplay(myShifts);
        updateEmployeeStats(myShifts);

        // Load past shifts (last 30 days)
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 30);
        const pastDateString = pastDate.toISOString().split('T')[0];

        const { data: pastData, error: pastError } = await window.supabaseClient
            .from('shifts')
            .select(`
                *,
                locations (name, notes)
            `)
            .eq('staff_id', staff.id)
            .gte('shift_date', pastDateString)
            .lt('shift_date', today)
            .order('shift_date', { ascending: false })
            .limit(10);

        if (!pastError) {
            pastShifts = pastData || [];
            updatePastShiftsDisplay(pastShifts);
        }

        return myShifts;

    } catch (error) {
        console.error('Error in loadMyShifts:', error);
        showSampleShifts();
        return [];
    }
}

// Show sample shifts when data not available
function showSampleShifts() {
    console.log('Showing sample shifts...');

    const sampleShifts = [
        {
            id: 'sample1',
            shift_date: new Date().toISOString().split('T')[0],
            start_time: '18:00:00',
            duration: 3,
            status: 'confirmed',
            notes: 'General Clean',
            recurring_shift_id: null,
            locations: { name: 'Sample Location' }
        }
    ];

    updateUpcomingShiftsDisplay(sampleShifts);
}

// Update upcoming shifts display
function updateUpcomingShiftsDisplay(shifts) {
    const container = document.getElementById('myShiftsList');
    if (!container) return;

    if (!shifts || shifts.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-calendar" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <p>No upcoming shifts scheduled.</p>
                <p style="font-size: 0.9rem;">Your assigned shifts will appear here.</p>
            </div>
        `;
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
                        ${shift.recurring_shift_id ? '<span class="offer-badge">RECURRING</span>' : ''}
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
                            <i class="fas fa-check-circle"></i> Complete
                        </button>
                    ` : ''}

                    ${canEmployeeCancelShift(shift) ? `
                        <button class="btn btn-sm btn-danger cancel-shift-btn" data-id="${shift.id}">
                            <i class="fas fa-ban"></i> Cancel
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

        // Cancel shift buttons
        document.querySelectorAll('.cancel-shift-btn').forEach(button => {
            button.addEventListener('click', async function() {
                const id = this.getAttribute('data-id');
                try {
                    if (!confirm('Cancel this shift?')) return;

                    if (typeof window.cancelShiftAsEmployee === 'function') {
                        await window.cancelShiftAsEmployee(id);
                    } else {
                        await updateShiftStatus(id, 'cancelled');
                    }

                    showMessage('✅ Shift cancelled', 'success');
                    await loadMyShifts();
                } catch (e) {
                    showMessage('❌ ' + (e.message || 'Cancel failed'), 'error');
                }
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
                        ${shift.recurring_shift_id ? '<span class="offer-badge">RECURRING</span>' : ''}
                        <span class="shift-status ${statusClass}">${shift.status.replace('_', ' ')}</span>
                    </h4>
                    <p>
                        <i class="far fa-calendar"></i> ${formatDate(shift.shift_date)}
                        • <i class="far fa-clock"></i> ${formatTime(shift.start_time)}
                        • ${shift.duration} hours
                    </p>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Update employee stats
function updateEmployeeStats(shifts) {
    try {
        const completedCount = shifts.filter(s => s.status === 'completed').length;
        const totalEarned = shifts
            .filter(s => s.status === 'completed')
            .reduce((sum, s) => sum + (parseFloat(s.total_amount || 0) || 0), 0);

        const completedEl = document.getElementById('completedShifts');
        const earnedEl = document.getElementById('totalEarned');

        if (completedEl) completedEl.textContent = completedCount;
        if (earnedEl) earnedEl.textContent = `$${totalEarned.toFixed(2)}`;
    } catch (e) {
        console.warn('updateEmployeeStats error:', e);
    }
}

// Setup refresh buttons
function setupRefreshButtons() {
    window.refreshShifts = async function () {
        await loadMyShifts();
        showMessage('✅ Shifts refreshed', 'success');
    };

    window.refreshPastShifts = async function () {
        await loadMyShifts();
        showMessage('✅ Past shifts refreshed', 'success');
    };
}

// Update shift status in database
async function updateShiftStatus(shiftId, newStatus) {
    try {
        const updates = { status: newStatus };

        if (newStatus === 'confirmed') {
            updates.confirmed_at = new Date().toISOString();
        }
        if (newStatus === 'completed') {
            updates.completed_at = new Date().toISOString();
        }

        const { error } = await window.supabaseClient
            .from('shifts')
            .update(updates)
            .eq('id', shiftId);

        if (error) throw error;

        await loadMyShifts();
        showMessage(`✅ Shift status updated to ${newStatus}`, 'success');

    } catch (error) {
        console.error('Error updating shift status:', error);
        showMessage('❌ Error updating shift status', 'error');
    }
}

// Decline shift (placeholder)
async function declineShift(shiftId) {
    showMessage('Decline shift – coming soon', 'info');
}

// Start specific shift
async function startSpecificShift(shiftId) {
    try {
        const { error } = await window.supabaseClient
            .from('shifts')
            .update({
                status: 'in_progress',
                actual_start_time: new Date().toTimeString().split(' ')[0]
            })
            .eq('id', shiftId);

        if (error) throw error;

        await loadMyShifts();
        showMessage('✅ Shift started', 'success');

    } catch (error) {
        console.error('Error starting shift:', error);
        showMessage('❌ Error starting shift', 'error');
    }
}

// Complete specific shift
async function completeSpecificShift(shiftId) {
    try {
        const { error } = await window.supabaseClient
            .from('shifts')
            .update({
                status: 'completed',
                actual_end_time: new Date().toTimeString().split(' ')[0],
                completed_at: new Date().toISOString()
            })
            .eq('id', shiftId);

        if (error) throw error;

        await loadMyShifts();
        showMessage('✅ Shift completed', 'success');

    } catch (error) {
        console.error('Error completing shift:', error);
        showMessage('❌ Error completing shift', 'error');
    }
}

// Update global shift actions (placeholder)
function updateGlobalShiftActions() {
    // Keep for later expansion
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeShifts();
});

console.log('✅ Employee Shifts module loaded');
