// Entries module - handles all entry-related operations

// Load recent entries
async function loadRecentEntries() {
    try {
        console.log('📋 Loading recent entries...');
      
        const { data: entries, error } = await window.supabaseClient
            .from('entries')
            .select(`
                *,
                locations (name, hourly_rate)
            `)
            .order('created_at', { ascending: false })
            .limit(10);
      
        if (error) throw error;
      
        updateEntriesDisplay(entries);
        console.log('✅ Entries loaded:', entries?.length || 0);
      
    } catch (error) {
        console.error('❌ Error loading entries:', error);
    }
}

// Update entries display
function updateEntriesDisplay(entries) {
    const entriesList = document.getElementById('entriesList');
  
    if (!entries || entries.length === 0) {
        entriesList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <p>No entries yet. Add your first entry above!</p>
            </div>
        `;
        return;
    }
  
    let html = '';
    entries.forEach(entry => {
        const locationName = entry.locations?.name || 'Unknown Location';
        const rate = entry.locations?.hourly_rate || window.CONFIG.DEFAULT_HOURLY_RATE;
        const earnings = (entry.hours * rate).toFixed(2);
        const notes = entry.notes ? entry.notes.replace(/'/g, "\\'") : '';
      
        html += `
            <div class="entry-item" data-entry-id="${entry.id}">
                <div class="entry-info">
                    <h4>${escapeHtml(locationName)}</h4>
                    <p>${formatDate(entry.work_date)} • ${escapeHtml(notes)}</p>
                </div>
                <div class="entry-stats">
                    <div class="entry-hours">${entry.hours} hrs @ $${rate}</div>
                    <div class="entry-earnings">$${earnings}</div>
                </div>
                <div class="entry-actions">
                    <button class="btn-icon edit-entry" data-id="${entry.id}" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon delete-entry" data-id="${entry.id}" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    });
  
    entriesList.innerHTML = html;
    
    // Add event listeners to the buttons
    setTimeout(() => {
        document.querySelectorAll('.edit-entry').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                editEntry(id);
            });
        });
        
        document.querySelectorAll('.delete-entry').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                deleteEntry(id);
            });
        });
    }, 100);
}

// Handle location input to show/hide rate field
async function handleLocationInput(event) {
    const locationName = event.target.value.trim();
    const rateGroup = document.getElementById('rateGroup');
    const rateInput = document.getElementById('rate');
  
    if (!locationName) {
        rateGroup.style.display = 'none';
        return;
    }
  
    // Check if location exists
    const { data: existing, error } = await window.supabaseClient
        .from('locations')
        .select('id, hourly_rate')
        .eq('name', locationName)
        .eq('is_active', true)
        .single();
  
    if (error && error.code !== 'PGRST116') console.error(error);
  
    if (existing) {
        rateGroup.style.display = 'none';
    } else {
        rateGroup.style.display = 'block';
        rateInput.value = '';
    }
}

// Handle location selection from dropdown to auto-fill hours
async function handleLocationSelection(event) {
    const locationName = event.target.value.trim();
    
    if (!locationName) return;
    
    // Try to find the location in our loaded locations
    if (window.appLocations) {
        const location = window.appLocations.find(loc => loc.name === locationName);
        
        if (location) {
            // Auto-fill the hours field with the location's default hours
            if (currentEntryMode === 'daily') {
                document.getElementById('hours').value = location.default_hours;
            }
            
            // Also hide the rate group since this is an existing location
            document.getElementById('rateGroup').style.display = 'none';
        }
    }
}

// Handle email checkbox change
function handleEmailCheckbox(event) {
    let emailGroup = document.getElementById('emailGroup');
    
    if (!emailGroup) {
        const checkbox = event.target;
        const formGroup = checkbox.closest('.form-group');
        
        const emailHtml = `
            <div class="form-group" id="emailGroup" style="display: none;">
                <label for="emailAddress"><i class="fas fa-envelope"></i> Email Address</label>
                <input type="email" id="emailAddress" placeholder="your@email.com">
            </div>
        `;
        
        formGroup.insertAdjacentHTML('afterend', emailHtml);
        emailGroup = document.getElementById('emailGroup');
    }
    
    emailGroup.style.display = event.target.checked ? 'block' : 'none';
    
    if (!event.target.checked) {
        const emailInput = document.getElementById('emailAddress');
        if (emailInput) {
            emailInput.value = '';
        }
    }
}

// Handle timesheet period change
function handleTimesheetPeriodChange(event) {
    const period = event.target.value;
    const customDatesDiv = document.getElementById('customDatesSection');
    const autoDatesDiv = document.getElementById('autoDatesSection');
    const today = new Date();
    
    if (period === 'custom') {
        customDatesDiv.style.display = 'block';
        autoDatesDiv.style.display = 'none';
    } else {
        customDatesDiv.style.display = 'none';
        autoDatesDiv.style.display = 'block';
        
        let startDate, endDate;
        
        switch(period) {
            case 'weekly':
                startDate = getStartOfWeek(today);
                endDate = getEndOfWeek(today);
                break;
            case 'fortnightly':
                startDate = getStartOfFortnight(today);
                endDate = getEndOfFortnight(today);
                break;
            case 'monthly':
                startDate = getStartOfMonth(today);
                endDate = getEndOfMonth(today);
                break;
            default:
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 7);
                endDate = today;
        }
        
        document.getElementById('autoStartDate').textContent = formatDate(startDate);
        document.getElementById('autoEndDate').textContent = formatDate(endDate);
        
        document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
        document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
    }
}

// Show custom dates popup
function showCustomDatesPopup() {
    const html = `
        <div class="modal-content">
            <h2>Select Custom Dates</h2>
            <form id="customDatesForm">
                <div class="form-group">
                    <label for="customStartDate">Start Date</label>
                    <input type="date" id="customStartDate" required>
                </div>
                <div class="form-group">
                    <label for="customEndDate">End Date</label>
                    <input type="date" id="customEndDate" required>
                </div>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button type="submit" class="btn btn-primary" style="flex:1;">
                        <i class="fas fa-check"></i> Apply Dates
                    </button>
                    <button type="button" class="btn cancel-btn" style="flex:1; background:#6c757d; color:white;">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    
    showModal(html);
    
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    
    document.getElementById('customStartDate').value = lastWeek.toISOString().split('T')[0];
    document.getElementById('customEndDate').value = today.toISOString().split('T')[0];
    
    document.getElementById('customDatesForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const startDate = document.getElementById('customStartDate').value;
        const endDate = document.getElementById('customEndDate').value;
        
        document.getElementById('startDate').value = startDate;
        document.getElementById('endDate').value = endDate;
        
        document.getElementById('autoStartDate').textContent = formatDate(startDate);
        document.getElementById('autoEndDate').textContent = formatDate(endDate);
        
        closeModal();
        showMessage('✅ Custom dates applied!', 'success');
    });
    
    document.querySelector('.cancel-btn').addEventListener('click', closeModal);
}

// Initialize entry mode UI
function initializeEntryModeUI() {
    handleEntryModeChange({ target: { value: 'daily' } });
}

// Handle entry mode change
function handleEntryModeChange(event) {
    const mode = event.target.value;
    currentEntryMode = mode;
    
    document.getElementById('dailyEntrySection').style.display = 'none';
    document.getElementById('weeklyEntrySection').style.display = 'none';
    document.getElementById('monthlyEntrySection').style.display = 'none';
    
    switch(mode) {
        case 'daily':
            document.getElementById('dailyEntrySection').style.display = 'block';
            break;
        case 'weekly':
            document.getElementById('weeklyEntrySection').style.display = 'block';
            generateWeekDaySelection();
            break;
        case 'monthly':
            document.getElementById('monthlyEntrySection').style.display = 'block';
            generateMonthSelection();
            break;
    }
}

// Generate week day selection
function generateWeekDaySelection() {
    const container = document.getElementById('weekDaysContainer');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    let html = '<div class="days-selection">';
    days.forEach((day, index) => {
        html += `
            <div class="day-selector" data-day="${index}">
                <input type="checkbox" id="day${index}" class="day-checkbox">
                <label for="day${index}" class="day-label">${day}</label>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
    
    document.querySelectorAll('.day-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const dayIndex = parseInt(this.closest('.day-selector').getAttribute('data-day'));
            if (this.checked) {
                if (!selectedDaysOfWeek.includes(dayIndex)) {
                    selectedDaysOfWeek.push(dayIndex);
                }
            } else {
                selectedDaysOfWeek = selectedDaysOfWeek.filter(d => d !== dayIndex);
            }
            updateWeeklyHoursDisplay();
        });
    });
    
    selectedDaysOfWeek = [];
    updateWeeklyHoursDisplay();
}

// Update weekly hours display
function updateWeeklyHoursDisplay() {
    const container = document.getElementById('weeklyHoursContainer');
    
    if (selectedDaysOfWeek.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Select days above to enter hours</p>';
        return;
    }
    
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    let html = '<div class="weekly-hours-grid">';
    
    selectedDaysOfWeek.forEach(dayIndex => {
        html += `
            <div class="form-group">
                <label for="hoursDay${dayIndex}">${days[dayIndex]} Hours</label>
                <input type="number" id="hoursDay${dayIndex}" class="weekly-hour-input" min="0.5" max="24" step="0.5" value="2.0" required>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Generate month selection
function generateMonthSelection() {
    const container = document.getElementById('monthSelectionContainer');
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    let html = '<div class="form-group">';
    html += '<label for="selectedMonth">Select Month</label>';
    html += '<select id="selectedMonth" class="month-selector">';
    
    const today = new Date();
    const currentYear = today.getFullYear();
    
    for (let i = 0; i < 12; i++) {
        const monthIndex = (today.getMonth() + i) % 12;
        const year = currentYear + Math.floor((today.getMonth() + i) / 12);
        html += `<option value="${year}-${monthIndex + 1}">${months[monthIndex]} ${year}</option>`;
    }
    
    html += '</select>';
    html += '</div>';
    html += '<div id="monthDaysContainer" style="margin-top: 15px;"></div>';
    
    container.innerHTML = html;
    
    document.getElementById('selectedMonth').addEventListener('change', generateMonthDays);
    generateMonthDays();
}

// Generate month days calendar
function generateMonthDays() {
    const container = document.getElementById('monthDaysContainer');
    const selectedMonth = document.getElementById('selectedMonth').value;
    const [year, month] = selectedMonth.split('-').map(Number);
    
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month - 1, 1).getDay();
    const firstDayMondayBased = firstDay === 0 ? 6 : firstDay - 1;
    
    let html = '<div class="month-calendar">';
    html += '<div class="month-header">';
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    days.forEach(day => {
        html += `<div class="month-day-header">${day}</div>`;
    });
    html += '</div>';
    
    html += '<div class="month-days-grid">';
    
    for (let i = 0; i < firstDayMondayBased; i++) {
        html += '<div class="month-day-empty"></div>';
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dayOfWeek = (firstDayMondayBased + day - 1) % 7;
        html += `
            <div class="month-day-selector ${dayOfWeek >= 5 ? 'weekend' : ''}" data-day="${day}">
                <input type="checkbox" id="monthDay${day}" class="month-day-checkbox">
                <label for="monthDay${day}" class="month-day-label">${day}</label>
            </div>
        `;
    }
    
    html += '</div></div>';
    
    container.innerHTML = html;
    
    document.querySelectorAll('.month-day-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const day = parseInt(this.closest('.month-day-selector').getAttribute('data-day'));
            if (this.checked) {
                if (!selectedMonthDays.includes(day)) {
                    selectedMonthDays.push(day);
                }
            } else {
                selectedMonthDays = selectedMonthDays.filter(d => d !== day);
            }
            updateMonthlyHoursDisplay(year, month);
        });
    });
    
    selectedMonthDays = [];
    updateMonthlyHoursDisplay(year, month);
}

// Update monthly hours display
function updateMonthlyHoursDisplay(year, month) {
    const container = document.getElementById('monthlyHoursContainer');
    
    if (selectedMonthDays.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Select days above to enter hours</p>';
        return;
    }
    
    let html = '<div class="monthly-hours-section">';
    html += '<h4 style="margin-bottom: 15px;">Hours for Selected Days</h4>';
    html += '<div class="monthly-hours-grid">';
    
    selectedMonthDays.sort((a, b) => a - b).forEach(day => {
        const date = new Date(year, month - 1, day);
        const dayName = date.toLocaleDateString('en-AU', { weekday: 'short' });
        
        html += `
            <div class="form-group">
                <label for="hoursMonthDay${day}">${dayName} ${day}/${month}/${year}</label>
                <input type="number" id="hoursMonthDay${day}" class="monthly-hour-input" min="0.5" max="24" step="0.5" value="2.0" required>
            </div>
        `;
    });
    
    html += '</div></div>';
    container.innerHTML = html;
}

// Form Handler (add entry)
async function handleAddEntry(event) {
    event.preventDefault();
  
    const button = event.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
  
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    button.disabled = true;
  
    try {
        const locationName = document.getElementById('location').value.trim();
        const notes = document.getElementById('notes').value.trim();
        const rate = parseFloat(document.getElementById('rate').value) || window.CONFIG.DEFAULT_HOURLY_RATE;
        
        if (!locationName) throw new Error('Please enter a location');
        
        console.log('📝 Adding entry in mode:', currentEntryMode);
        
        let locationId = await findOrCreateLocation(locationName, 2.0, rate);
        let entriesToAdd = [];
        
        switch(currentEntryMode) {
            case 'daily':
                const hours = parseFloat(document.getElementById('hours').value);
                const date = document.getElementById('date').value;
                
                if (!hours || !date) throw new Error('Please fill in all required fields');
                if (hours <= 0 || hours > 24) throw new Error('Hours must be between 0.5 and 24');
                
                entriesToAdd.push({
                    location_id: locationId,
                    hours,
                    work_date: date,
                    notes
                });
                break;
                
            case 'weekly':
                if (selectedDaysOfWeek.length === 0) {
                    throw new Error('Please select at least one day of the week');
                }
                
                const weekDate = document.getElementById('weekDate').value;
                if (!weekDate) throw new Error('Please select a week start date');
                
                const weekStart = new Date(weekDate);
                
                selectedDaysOfWeek.forEach(dayIndex => {
                    const dayDate = new Date(weekStart);
                    dayDate.setDate(weekStart.getDate() + dayIndex);
                    
                    const dayHours = parseFloat(document.getElementById(`hoursDay${dayIndex}`).value);
                    if (dayHours <= 0 || dayHours > 24) {
                        throw new Error(`Hours for day ${dayIndex + 1} must be between 0.5 and 24`);
                    }
                    
                    entriesToAdd.push({
                        location_id: locationId,
                        hours: dayHours,
                        work_date: dayDate.toISOString().split('T')[0],
                        notes
                    });
                });
                break;
                
            case 'monthly':
                if (selectedMonthDays.length === 0) {
                    throw new Error('Please select at least one day of the month');
                }
                
                const selectedMonth = document.getElementById('selectedMonth').value;
                const [year, month] = selectedMonth.split('-').map(Number);
                
                selectedMonthDays.forEach(day => {
                    const dayHours = parseFloat(document.getElementById(`hoursMonthDay${day}`).value);
                    if (dayHours <= 0 || dayHours > 24) {
                        throw new Error(`Hours for day ${day} must be between 0.5 and 24`);
                    }
                    
                    entriesToAdd.push({
                        location_id: locationId,
                        hours: dayHours,
                        work_date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
                        notes
                    });
                });
                break;
        }
        
        if (entriesToAdd.length === 0) {
            throw new Error('No entries to add');
        }
        
        console.log('📝 Adding entries:', entriesToAdd);
      
        const { data, error } = await window.supabaseClient
            .from('entries')
            .insert(entriesToAdd)
            .select();
      
        if (error) throw error;
      
        showMessage(`✅ ${entriesToAdd.length} entry(ies) added successfully!`, 'success');
      
        // Clear form
        document.getElementById('location').value = '';
        document.getElementById('notes').value = '';
        document.getElementById('rateGroup').style.display = 'none';
        
        if (currentEntryMode === 'daily') {
            document.getElementById('hours').value = '2.0';
        } else if (currentEntryMode === 'weekly') {
            selectedDaysOfWeek = [];
            updateWeeklyHoursDisplay();
        } else if (currentEntryMode === 'monthly') {
            selectedMonthDays = [];
            updateMonthlyHoursDisplay();
        }
      
        await loadStats();
        await loadRecentEntries();
        await loadLocations();
      
    } catch (error) {
        console.error('❌ Add entry error:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

console.log('✅ Entries module loaded');
