// Configuration
const CONFIG = {
    SUPABASE_URL: 'https://hqmtigcjyqckqdzepcdu.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw',
    DEFAULT_HOURLY_RATE: 23,
    CURRENCY: 'AUD',
    VERSION: '1.1.0'
};
// Modern Supabase client initialization (CDN/UMD style)
if (!window.supabase) {
    console.error('❌ Supabase global not found. Check your <script> tag for https://cdn.jsdelivr.net/npm/@supabase/supabase-js');
    throw new Error('Supabase not loaded');
}
const { createClient } = window.supabase;
const supabase = createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_KEY
);
console.log('✅ Supabase client initialized (modern way)');
console.log('🚀 Cleaning Timesheet App Starting...');
console.log('📡 Supabase URL:', CONFIG.SUPABASE_URL);
// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM Ready');
    initializeApp();
});
async function initializeApp() {
    console.log('📱 Initializing app...');
   
    try {
        // Set today's date
        const today = new Date();
        document.getElementById('date').value = today.toISOString().split('T')[0];
        document.getElementById('currentDate').textContent = formatDate(today);
       
        // Set timesheet dates (last week)
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        document.getElementById('startDate').value = lastWeek.toISOString().split('T')[0];
        document.getElementById('endDate').value = today.toISOString().split('T')[0];
       
        // Setup form handlers
        document.getElementById('entryForm').addEventListener('submit', handleAddEntry);
        document.getElementById('timesheetForm').addEventListener('submit', handleGenerateTimesheet);
       
        // Setup location input listener for rate field
        document.getElementById('location').addEventListener('input', handleLocationInput);
       
        // Test connection
        const connected = await testConnection();
       
        if (connected) {
            console.log('✅ Connected to Supabase');
            updateConnectionStatus(true);
           
            // Show main interface
            document.getElementById('loadingScreen').style.display = 'none';
            document.querySelector('.container').style.display = 'block';
            console.log('✨ Dashboard ready');
           
            // Load data in background
            setTimeout(async () => {
                await loadStats();
                await loadLocations();
                await loadRecentEntries();
            }, 500);
           
        } else {
            console.error('❌ Database connection failed');
            showError('Cannot connect to database. Please try again later.');
        }
       
    } catch (error) {
        console.error('💥 Init error:', error);
        showError('Error loading app: ' + error.message);
    }
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
    const { data: existing, error } = await supabase
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
        rateInput.value = ''; // Clear for new
    }
}
// Test database connection
async function testConnection() {
    try {
        console.log('🔌 Testing Supabase connection...');
        const { data, error } = await supabase.from('locations').select('count', { count: 'exact', head: true });
       
        if (error) throw error;
       
        console.log('✅ Database connection successful');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        return false;
    }
}
// Load statistics
async function loadStats() {
    try {
        console.log('📊 Loading statistics...');
       
        // Get total entries count
        const { count: totalEntries, error: entriesError } = await supabase
            .from('entries')
            .select('*', { count: 'exact', head: true });
       
        if (entriesError) throw entriesError;
       
        // Get locations count
        const { count: totalLocations, error: locationsError } = await supabase
            .from('locations')
            .select('*', { count: 'exact', head: true });
       
        if (locationsError) throw locationsError;
       
        // Get timesheets count
        const { count: totalTimesheets, error: timesheetsError } = await supabase
            .from('timesheets')
            .select('*', { count: 'exact', head: true });
       
        if (timesheetsError) throw timesheetsError;
       
        // Calculate total earnings (now using per-location rates)
        const { data: earningsData, error: earningsError } = await supabase
            .from('entries')
            .select(`
                hours,
                locations (hourly_rate)
            `);
       
        if (earningsError) throw earningsError;
       
        const totalEarnings = earningsData.reduce((sum, entry) => {
            const rate = entry.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE;
            return sum + (parseFloat(entry.hours) * rate);
        }, 0).toFixed(2);
       
        // Update UI
        updateStatsDisplay({
            totalEntries: totalEntries || 0,
            totalLocations: totalLocations || 0,
            totalTimesheets: totalTimesheets || 0,
            totalEarnings: totalEarnings
        });
       
        console.log('✅ Statistics loaded');
       
    } catch (error) {
        console.error('❌ Error loading statistics:', error);
    }
}
// Load locations for dropdown
async function loadLocations() {
    try {
        console.log('📍 Loading locations...');
       
        const { data: locations, error } = await supabase
            .from('locations')
            .select('*')
            .eq('is_active', true)
            .order('name');
       
        if (error) throw error;
       
        // Update location datalist
        const datalist = document.getElementById('locationList') || createLocationDatalist();
       
        if (locations && locations.length > 0) {
            datalist.innerHTML = locations.map(location =>
                `<option value="${location.name}">${location.name} (${location.default_hours} hrs - $${location.hourly_rate}/hr)</option>`
            ).join('');
           
            // Store locations globally for quick access
            window.appLocations = locations;
        }
       
        console.log('✅ Locations loaded:', locations?.length || 0);
       
    } catch (error) {
        console.error('❌ Error loading locations:', error);
    }
}
function createLocationDatalist() {
    const input = document.getElementById('location');
    const datalist = document.createElement('datalist');
    datalist.id = 'locationList';
    input.setAttribute('list', 'locationList');
    document.body.appendChild(datalist);
    return datalist;
}
// Load recent entries
async function loadRecentEntries() {
    try {
        console.log('📋 Loading recent entries...');
       
        const { data: entries, error } = await supabase
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
// Update UI functions
function updateStatsDisplay(stats) {
    // Update stat cards
    document.querySelectorAll('.stat-card')[0].innerHTML = `
        <div class="stat-icon"><i class="fas fa-list"></i></div>
        <div class="stat-info">
            <h3>Total Entries</h3>
            <div class="stat-value">${stats.totalEntries}</div>
        </div>
    `;
   
    document.querySelectorAll('.stat-card')[1].innerHTML = `
        <div class="stat-icon"><i class="fas fa-map-marker-alt"></i></div>
        <div class="stat-info">
            <h3>Locations</h3>
            <div class="stat-value">${stats.totalLocations}</div>
        </div>
    `;
   
    document.querySelectorAll('.stat-card')[2].innerHTML = `
        <div class="stat-icon"><i class="fas fa-file-invoice-dollar"></i></div>
        <div class="stat-info">
            <h3>Timesheets</h3>
            <div class="stat-value">${stats.totalTimesheets}</div>
        </div>
    `;
   
    document.querySelectorAll('.stat-card')[3].innerHTML = `
        <div class="stat-icon"><i class="fas fa-money-bill-wave"></i></div>
        <div class="stat-info">
            <h3>Total Earned</h3>
            <div class="stat-value">$${stats.totalEarnings}</div>
        </div>
    `;
   
    // Remove loading class
    document.querySelectorAll('.stat-card').forEach(card => {
        card.classList.remove('loading');
    });
}
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
        const rate = entry.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE;
        const earnings = (entry.hours * rate).toFixed(2);
       
        html += `
            <div class="entry-item" data-entry-id="${entry.id}">
                <div class="entry-info">
                    <h4>${locationName}</h4>
                    <p>${formatDate(entry.work_date)} • ${entry.notes || ''}</p>
                </div>
                <div class="entry-stats">
                    <div class="entry-hours">${entry.hours} hrs @ $${rate}</div>
                    <div class="entry-earnings">$${earnings}</div>
                </div>
                <div class="entry-actions">
                    <button onclick="editEntry(${entry.id})" class="btn-icon"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteEntry(${entry.id})" class="btn-icon"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    });
   
    entriesList.innerHTML = html;
}
// Form Handlers
async function handleAddEntry(event) {
    event.preventDefault();
   
    const button = event.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
   
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    button.disabled = true;
   
    try {
        const locationName = document.getElementById('location').value.trim();
        const hours = parseFloat(document.getElementById('hours').value);
        const date = document.getElementById('date').value;
        const notes = document.getElementById('notes').value.trim();
        const rate = parseFloat(document.getElementById('rate').value) || CONFIG.DEFAULT_HOURLY_RATE;
       
        if (!locationName || !hours || !date) {
            throw new Error('Please fill in all required fields');
        }
       
        if (hours <= 0 || hours > 24) {
            throw new Error('Hours must be between 0.5 and 24');
        }
       
        console.log('📝 Adding entry:', { locationName, hours, date, notes, rate });
       
        // Find or create location
        let locationId = await findOrCreateLocation(locationName, hours, rate);
       
        // Insert entry
        const { data, error } = await supabase
            .from('entries')
            .insert([{
                location_id: locationId,
                hours: hours,
                work_date: date,
                notes: notes
            }])
            .select();
       
        if (error) throw error;
       
        showMessage('✅ Entry added successfully!', 'success');
       
        // Clear form
        document.getElementById('location').value = '';
        document.getElementById('notes').value = '';
        document.getElementById('hours').value = '2.0';
        document.getElementById('rateGroup').style.display = 'none';
       
        // Refresh data
        await loadStats();
        await loadRecentEntries();
        await loadLocations(); // Refresh datalist
       
    } catch (error) {
        console.error('❌ Add entry error:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}
async function findOrCreateLocation(name, defaultHours = 2.0, hourlyRate = CONFIG.DEFAULT_HOURLY_RATE) {
    try {
        // Try to find existing location
        const { data: existingLocations, error: findError } = await supabase
            .from('locations')
            .select('id')
            .eq('name', name)
            .eq('is_active', true)
            .limit(1);
       
        if (findError) throw findError;
       
        if (existingLocations && existingLocations.length > 0) {
            return existingLocations[0].id;
        }
       
        // Create new location
        const { data: newLocation, error: createError } = await supabase
            .from('locations')
            .insert([{
                name: name,
                default_hours: defaultHours,
                hourly_rate: hourlyRate,
                is_active: true
            }])
            .select()
            .single();
       
        if (createError) throw createError;
       
        // Refresh locations list
        await loadLocations();
       
        return newLocation.id;
       
    } catch (error) {
        console.error('❌ Location error:', error);
        throw new Error('Could not find or create location');
    }
}
async function handleGenerateTimesheet(event) {
    event.preventDefault();
   
    const button = event.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
   
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    button.disabled = true;
   
    try {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
       
        if (!startDate || !endDate) {
            throw new Error('Please select start and end dates');
        }
       
        console.log('📄 Generating timesheet:', { startDate, endDate });
       
        // Get entries for date range with rates
        const { data: entries, error: entriesError } = await supabase
            .from('entries')
            .select(`
                hours,
                locations (hourly_rate)
            `)
            .gte('work_date', startDate)
            .lte('work_date', endDate);
       
        if (entriesError) throw entriesError;
       
        if (!entries || entries.length === 0) {
            throw new Error('No entries found for selected period');
        }
       
        // Calculate totals
        const totalHours = entries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
        const totalEarnings = entries.reduce((sum, entry) => {
            const rate = entry.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE;
            return sum + (parseFloat(entry.hours) * rate);
        }, 0).toFixed(2);
       
        // Generate reference number
        const refNumber = 'TS' + new Date().getTime().toString().slice(-6);
       
        // Save timesheet
        const { data: timesheet, error: timesheetError } = await supabase
            .from('timesheets')
            .insert([{
                ref_number: refNumber,
                start_date: startDate,
                end_date: endDate,
                total_hours: totalHours,
                total_earnings: totalEarnings
            }])
            .select()
            .single();
       
        if (timesheetError) throw timesheetError;
       
        showMessage(`✅ Timesheet ${refNumber} generated!`, 'success');
       
        // Refresh stats
        await loadStats();
       
        // Show success details
        alert(`Timesheet ${refNumber} generated successfully!\n\n` +
              `Period: ${formatDate(startDate)} to ${formatDate(endDate)}\n` +
              `Total Hours: ${totalHours.toFixed(2)}\n` +
              `Total Earnings: $${totalEarnings}\n` +
              `Entries Included: ${entries.length}`);
       
    } catch (error) {
        console.error('❌ Timesheet error:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}
// Manage Locations
window.viewLocations = async function() {
    try {
        const { data: locations, error } = await supabase
            .from('locations')
            .select('*')
            .eq('is_active', true)
            .order('name');
       
        if (error) throw error;
       
        let html = '<div class="modal-content"><h2>Manage Locations</h2><div class="locations-list">';
        locations.forEach(loc => {
            html += `
                <div class="location-item">
                    <div>
                        <h4>${loc.name}</h4>
                        <p>Default: ${loc.default_hours} hrs @ $${loc.hourly_rate}/hr</p>
                    </div>
                    <div>
                        <button onclick="editLocation(${loc.id})" class="btn-icon"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteLocation(${loc.id})" class="btn-icon"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
        html += '</div><button onclick="closeModal()" class="btn btn-primary">Close</button></div>';
       
        showModal(html);
    } catch (error) {
        showMessage('❌ Error loading locations: ' + error.message, 'error');
    }
};
async function editLocation(id) {
    try {
        const { data: loc, error } = await supabase
            .from('locations')
            .select('*')
            .eq('id', id)
            .single();
       
        if (error) throw error;
       
        let html = `
            <div class="modal-content">
                <h2>Edit Location</h2>
                <form id="editLocationForm">
                    <div class="form-group">
                        <label for="editName">Name</label>
                        <input type="text" id="editName" value="${loc.name}" required>
                    </div>
                    <div class="form-group">
                        <label for="editDefaultHours">Default Hours</label>
                        <input type="number" id="editDefaultHours" value="${loc.default_hours}" step="0.5" required>
                    </div>
                    <div class="form-group">
                        <label for="editRate">Hourly Rate</label>
                        <input type="number" id="editRate" value="${loc.hourly_rate}" step="0.01" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Save</button>
                    <button type="button" onclick="closeModal()" class="btn">Cancel</button>
                </form>
            </div>
        `;
       
        showModal(html);
       
        document.getElementById('editLocationForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('editName').value;
            const defaultHours = parseFloat(document.getElementById('editDefaultHours').value);
            const rate = parseFloat(document.getElementById('editRate').value);
           
            const { error } = await supabase
                .from('locations')
                .update({ name, default_hours: defaultHours, hourly_rate: rate })
                .eq('id', id);
           
            if (error) throw error;
           
            closeModal();
            showMessage('✅ Location updated!', 'success');
            await loadLocations();
            await loadStats();
            await loadRecentEntries();
        });
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    }
};
async function deleteLocation(id) {
    if (!confirm('Delete this location? Entries will remain but location will be inactive.')) return;
   
    try {
        const { error } = await supabase
            .from('locations')
            .update({ is_active: false })
            .eq('id', id);
       
        if (error) throw error;
       
        closeModal();
        showMessage('✅ Location deleted (inactive)', 'success');
        await loadLocations();
        await loadStats();
        await loadRecentEntries();
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    }
};
// Edit/Delete Entries
window.editEntry = async function(id) {
    try {
        const { data: entry, error } = await supabase
            .from('entries')
            .select(`
                *,
                locations (name)
            `)
            .eq('id', id)
            .single();
       
        if (error) throw error;
       
        let html = `
            <div class="modal-content">
                <h2>Edit Entry</h2>
                <form id="editEntryForm">
                    <div class="form-group">
                        <label>Location</label>
                        <input type="text" value="${entry.locations.name}" disabled>
                    </div>
                    <div class="form-group">
                        <label for="editHours">Hours</label>
                        <input type="number" id="editHours" value="${entry.hours}" step="0.5" required>
                    </div>
                    <div class="form-group">
                        <label for="editDate">Date</label>
                        <input type="date" id="editDate" value="${entry.work_date}" required>
                    </div>
                    <div class="form-group">
                        <label for="editNotes">Notes</label>
                        <textarea id="editNotes">${entry.notes || ''}</textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">Save</button>
                    <button type="button" onclick="closeModal()" class="btn">Cancel</button>
                </form>
            </div>
        `;
       
        showModal(html);
       
        document.getElementById('editEntryForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const hours = parseFloat(document.getElementById('editHours').value);
            const date = document.getElementById('editDate').value;
            const notes = document.getElementById('editNotes').value;
           
            const { error } = await supabase
                .from('entries')
                .update({ hours, work_date: date, notes })
                .eq('id', id);
           
            if (error) throw error;
           
            closeModal();
            showMessage('✅ Entry updated!', 'success');
            await loadStats();
            await loadRecentEntries();
        });
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    }
};
window.deleteEntry = async function(id) {
    if (!confirm('Delete this entry?')) return;
   
    try {
        const { error } = await supabase
            .from('entries')
            .delete()
            .eq('id', id);
       
        if (error) throw error;
       
        showMessage('✅ Entry deleted!', 'success');
        await loadStats();
        await loadRecentEntries();
    } catch (error) {
        showMessage('❌ Error: ' + error.message, 'error');
    }
};
// Modal Helpers
function showModal(content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = content;
    document.getElementById('modalsContainer').appendChild(modal);
}
window.closeModal = function() {
    const modal = document.querySelector('.modal');
    if (modal) modal.remove();
};
// Utility functions
function showMessage(text, type = 'info') {
    const messageDiv = document.getElementById('formMessage');
    if (!messageDiv) {
        // Create message div if it doesn't exist
        const form = document.getElementById('entryForm');
        if (form) {
            const newDiv = document.createElement('div');
            newDiv.id = 'formMessage';
            newDiv.className = `message ${type}`;
            newDiv.textContent = text;
            newDiv.style.display = 'block';
            form.parentNode.insertBefore(newDiv, form.nextSibling);
        }
        return;
    }
   
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
   
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
}
function updateConnectionStatus(connected) {
    const statusDiv = document.getElementById('connectionStatus');
    if (!statusDiv) return;
   
    if (connected) {
        statusDiv.innerHTML = '<i class="fas fa-database"></i><span>Connected</span>';
        statusDiv.style.color = '#28a745';
    } else {
        statusDiv.innerHTML = '<i class="fas fa-database"></i><span>Disconnected</span>';
        statusDiv.style.color = '#dc3545';
    }
}
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    } catch {
        return dateString;
    }
}
function showError(message) {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div style="text-align: center; color: white; padding: 40px;">
                <div style="font-size: 4rem;">❌</div>
                <h2 style="margin: 20px 0;">Database Error</h2>
                <p style="font-size: 1.2rem; margin-bottom: 20px;">${message}</p>
                <button onclick="location.reload()" style="padding: 10px 20px; background: white; color: #667eea; border: none; border-radius: 5px; font-size: 1rem; cursor: pointer;">
                    Try Again
                </button>
                <div style="margin-top: 20px; font-size: 0.9rem; opacity: 0.8;">
                    <p>Check browser console (F12) for details</p>
                </div>
            </div>
        `;
    }
}
// Action buttons
window.refreshData = async function() {
    console.log('🔄 Refreshing data...');
    showMessage('Refreshing data...', 'info');
   
    await loadStats();
    await loadRecentEntries();
    await loadLocations();
   
    showMessage('✅ Data refreshed!', 'success');
};
window.generateTimesheet = function() {
    document.getElementById('timesheetForm').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('startDate').focus();
};
window.viewTimesheets = function() {
    alert('View Timesheets feature coming soon!');
};
window.exportData = function() {
    alert('Export feature coming soon!');
};
window.showSettings = function() {
    alert('Settings coming soon!');
};
window.showHelp = function() {
    alert('Help coming soon!');
};
console.log("Script loaded and reached the end! Ready for action.");
console.log('🎉 Script loaded successfully');

