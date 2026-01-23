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
      
        const { count: totalEntries, error: entriesError } = await supabase
            .from('entries')
            .select('*', { count: 'exact', head: true });
      
        if (entriesError) throw entriesError;
      
        const { count: totalLocations, error: locationsError } = await supabase
            .from('locations')
            .select('*', { count: 'exact', head: true });
      
        if (locationsError) throw locationsError;
      
        const { count: totalTimesheets, error: timesheetsError } = await supabase
            .from('timesheets')
            .select('*', { count: 'exact', head: true });
      
        if (timesheetsError) throw timesheetsError;
      
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
      
        const datalist = document.getElementById('locationList') || createLocationDatalist();
      
        if (locations && locations.length > 0) {
            datalist.innerHTML = locations.map(location =>
                `<option value="${location.name}">${location.name} (${location.default_hours} hrs - $${location.hourly_rate}/hr)</option>`
            ).join('');
          
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
  
    document.querySelectorAll('.stat-card').forEach(card => card.classList.remove('loading'));
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

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Form Handlers (add entry)
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
      
        if (!locationName || !hours || !date) throw new Error('Please fill in all required fields');
        if (hours <= 0 || hours > 24) throw new Error('Hours must be between 0.5 and 24');
      
        console.log('📝 Adding entry:', { locationName, hours, date, notes, rate });
      
        let locationId = await findOrCreateLocation(locationName, hours, rate);
      
        const { data, error } = await supabase
            .from('entries')
            .insert([{ location_id: locationId, hours, work_date: date, notes }])
            .select();
      
        if (error) throw error;
      
        showMessage('✅ Entry added successfully!', 'success');
      
        document.getElementById('location').value = '';
        document.getElementById('notes').value = '';
        document.getElementById('hours').value = '2.0';
        document.getElementById('rateGroup').style.display = 'none';
      
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

async function findOrCreateLocation(name, defaultHours = 2.0, hourlyRate = CONFIG.DEFAULT_HOURLY_RATE) {
    try {
        const { data: existing, error: findError } = await supabase
            .from('locations')
            .select('id')
            .eq('name', name)
            .eq('is_active', true)
            .limit(1);
      
        if (findError) throw findError;
        if (existing?.length > 0) return existing[0].id;
      
        const { data: newLoc, error: createError } = await supabase
            .from('locations')
            .insert([{ name, default_hours: defaultHours, hourly_rate: hourlyRate, is_active: true }])
            .select()
            .single();
      
        if (createError) throw createError;
      
        await loadLocations();
        return newLoc.id;
      
    } catch (error) {
        console.error('❌ Location error:', error);
        throw new Error('Could not find or create location');
    }
}

// Generate Timesheet
async function handleGenerateTimesheet(event) {
    event.preventDefault();
  
    const button = event.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
  
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    button.disabled = true;
  
    try {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
      
        if (!startDate || !endDate) throw new Error('Please select start and end dates');
      
        const { data: entries, error: entriesError } = await supabase
            .from('entries')
            .select('hours, locations (hourly_rate)')
            .gte('work_date', startDate)
            .lte('work_date', endDate);
      
        if (entriesError) throw entriesError;
        if (!entries?.length) throw new Error('No entries found for selected period');
      
        const totalHours = entries.reduce((sum, e) => sum + parseFloat(e.hours), 0);
        const totalEarnings = entries.reduce((sum, e) => {
            const rate = e.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE;
            return sum + (parseFloat(e.hours) * rate);
        }, 0).toFixed(2);
      
        const refNumber = 'TS' + new Date().getTime().toString().slice(-6);
      
        const { data: timesheet, error: tsError } = await supabase
            .from('timesheets')
            .insert([{ ref_number: refNumber, start_date: startDate, end_date: endDate, total_hours: totalHours, total_earnings: totalEarnings }])
            .select()
            .single();
      
        if (tsError) throw tsError;
      
        showMessage(`✅ Timesheet ${refNumber} generated!`, 'success');
        await loadStats();
      
        alert(`Timesheet ${refNumber} generated!\n\nPeriod: ${formatDate(startDate)} to ${formatDate(endDate)}\nTotal Hours: ${totalHours.toFixed(2)}\nTotal Earnings: $${totalEarnings}\nEntries: ${entries.length}`);
      
    } catch (error) {
        console.error('❌ Timesheet error:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// ───────────────────────────────────────────────
//   EDIT & DELETE FOR RECENT ENTRIES – FULL FUNCTIONAL
// ───────────────────────────────────────────────

window.editEntry = async function(id) {
    console.log("Edit clicked for entry ID:", id);

    try {
        const { data: entry, error } = await supabase
            .from('entries')
            .select(`
                *,
                locations (id, name, hourly_rate)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        // Escape values for HTML
        const locationName = escapeHtml(entry.locations.name);
        const hourlyRate = entry.locations.hourly_rate;
        const hours = entry.hours;
        const workDate = entry.work_date;
        const notes = entry.notes ? escapeHtml(entry.notes) : '';

        const html = `
            <div class="modal-content">
                <h2>Edit Entry</h2>
                <form id="editEntryForm">
                    <div class="form-group">
                        <label for="editLocationName">Location Name</label>
                        <input type="text" id="editLocationName" value="${locationName}" required>
                    </div>
                    <div class="form-group">
                        <label for="editRate">Hourly Rate ($)</label>
                        <input type="number" id="editRate" value="${hourlyRate}" step="0.01" min="1" required>
                    </div>
                    <div class="form-group">
                        <label for="editHours">Hours</label>
                        <input type="number" id="editHours" value="${hours}" step="0.5" min="0.5" max="24" required>
                    </div>
                    <div class="form-group">
                        <label for="editDate">Date</label>
                        <input type="date" id="editDate" value="${workDate}" required>
                    </div>
                    <div class="form-group">
                        <label for="editNotes">Notes (optional)</label>
                        <textarea id="editNotes" rows="2">${notes}</textarea>
                    </div>
                    <div style="margin-top:20px; display:flex; gap:10px;">
                        <button type="submit" class="btn btn-primary" style="flex:1;">
                            <i class="fas fa-save"></i> Save Changes
                        </button>
                        <button type="button" onclick="closeModal()" class="btn" style="flex:1; background:#6c757d; color:white;">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                </form>
            </div>
        `;

        showModal(html);

        document.getElementById('editEntryForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const newLocName = document.getElementById('editLocationName').value.trim();
            const newRate = parseFloat(document.getElementById('editRate').value);
            const newHours = parseFloat(document.getElementById('editHours').value);
            const newDate = document.getElementById('editDate').value;
            const newNotes = document.getElementById('editNotes').value.trim();

            // Update entry
            const { error: entryErr } = await supabase
                .from('entries')
                .update({ hours: newHours, work_date: newDate, notes: newNotes })
                .eq('id', id);

            if (entryErr) throw entryErr;

            // Update location (name + rate)
            const { error: locErr } = await supabase
                .from('locations')
                .update({ name: newLocName, hourly_rate: newRate })
                .eq('id', entry.locations.id);

            if (locErr) throw locErr;

            closeModal();
            showMessage('✅ Entry & location updated!', 'success');
            await loadStats();
            await loadRecentEntries();
            await loadLocations(); // refresh dropdown if name changed
        });
    } catch (error) {
        console.error("Edit entry error:", error);
        showMessage('❌ Error: ' + error.message, 'error');
    }
};

window.deleteEntry = function(id) {
    console.log("Delete clicked for entry ID:", id);

    const html = `
        <div class="modal-content">
            <h2>Confirm Delete</h2>
            <p style="margin:15px 0;">Are you sure you want to delete this entry?</p>
            <p style="color:#dc3545; font-weight:bold;">This cannot be undone.</p>
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button class="btn btn-primary confirm-delete-btn" data-id="${id}" style="flex:1; background:#dc3545; border:none;">
                    <i class="fas fa-trash"></i> Yes, Delete
                </button>
                <button onclick="closeModal()" class="btn" style="flex:1;">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `;

    showModal(html);
    
    // Add event listener to the delete button after modal is shown
    setTimeout(() => {
        const deleteBtn = document.querySelector('.confirm-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function() {
                const entryId = this.getAttribute('data-id');
                confirmDelete(entryId);
            });
        }
    }, 100);
};

window.confirmDelete = async function(id) {
    try {
        console.log("Confirming delete for ID:", id);
        
        const { error } = await supabase
            .from('entries')
            .delete()
            .eq('id', id);

        if (error) throw error;

        closeModal();
        showMessage('✅ Entry deleted successfully!', 'success');
        await loadStats();
        await loadRecentEntries();
    } catch (error) {
        console.error("Delete error:", error);
        showMessage('❌ Error deleting entry: ' + error.message, 'error');
    }
};

// Modal Helpers
function showModal(content) {
    // Remove any existing modal first
    closeModal();
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = content;
    
    // Add click outside to close
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    const modalsContainer = document.getElementById('modalsContainer');
    if (modalsContainer) {
        modalsContainer.appendChild(modal);
    } else {
        // Fallback: append to body
        document.body.appendChild(modal);
    }
}

window.closeModal = function() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
};

// Utility functions
function showMessage(text, type = 'info') {
    let messageDiv = document.getElementById('formMessage');
    if (!messageDiv) {
        const form = document.getElementById('entryForm');
        if (form) {
            messageDiv = document.createElement('div');
            messageDiv.id = 'formMessage';
            form.parentNode.insertBefore(messageDiv, form.nextSibling);
        }
    }
    if (messageDiv) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        if (type === 'success' || type === 'info') {
            setTimeout(() => { messageDiv.style.display = 'none'; }, 5000);
        }
    }
}

function updateConnectionStatus(connected) {
    const statusDiv = document.getElementById('connectionStatus');
    if (statusDiv) {
        statusDiv.innerHTML = connected 
            ? '<i class="fas fa-database"></i><span>Connected</span>'
            : '<i class="fas fa-database"></i><span>Disconnected</span>';
        statusDiv.style.color = connected ? '#28a745' : '#dc3545';
    }
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return dateString;
    }
}

function showError(message) {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div style="text-align:center; color:white; padding:40px;">
                <div style="font-size:4rem;">❌</div>
                <h2 style="margin:20px 0;">Database Error</h2>
                <p style="font-size:1.2rem; margin-bottom:20px;">${message}</p>
                <button onclick="location.reload()" style="padding:10px 20px; background:white; color:#667eea; border:none; border-radius:5px; cursor:pointer;">
                    Try Again
                </button>
            </div>
        `;
    }
}

// Action buttons placeholders
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

// Add the missing function for the Manage Locations button
window.viewLocations = async function() {
    try {
        const { data: locations, error } = await supabase
            .from('locations')
            .select('*')
            .order('name');

        if (error) throw error;

        let locationsHtml = '';
        if (locations && locations.length > 0) {
            locations.forEach(location => {
                locationsHtml += `
                    <div class="location-item">
                        <div>
                            <h4>${escapeHtml(location.name)}</h4>
                            <p>Default: ${location.default_hours} hrs • Rate: $${location.hourly_rate}/hr</p>
                        </div>
                        <button class="btn-icon edit-location" data-id="${location.id}" title="Edit"><i class="fas fa-edit"></i></button>
                    </div>
                `;
            });
        } else {
            locationsHtml = '<p style="text-align:center; padding:20px;">No locations found.</p>';
        }

        const html = `
            <div class="modal-content">
                <h2>Manage Locations</h2>
                <div class="locations-list">
                    ${locationsHtml}
                </div>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button onclick="closeModal()" class="btn" style="flex:1;">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            </div>
        `;

        showModal(html);
        
        // Add event listeners for location edit buttons
        setTimeout(() => {
            document.querySelectorAll('.edit-location').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    editLocation(id);
                });
            });
        }, 100);
    } catch (error) {
        console.error('❌ Error loading locations:', error);
        showMessage('❌ Error loading locations: ' + error.message, 'error');
    }
};

// Add edit location function
window.editLocation = async function(id) {
    try {
        const { data: location, error } = await supabase
            .from('locations')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        const html = `
            <div class="modal-content">
                <h2>Edit Location</h2>
                <form id="editLocationForm">
                    <div class="form-group">
                        <label for="editLocName">Location Name</label>
                        <input type="text" id="editLocName" value="${escapeHtml(location.name)}" required>
                    </div>
                    <div class="form-group">
                        <label for="editLocRate">Hourly Rate ($)</label>
                        <input type="number" id="editLocRate" value="${location.hourly_rate}" step="0.01" min="1" required>
                    </div>
                    <div class="form-group">
                        <label for="editLocHours">Default Hours</label>
                        <input type="number" id="editLocHours" value="${location.default_hours}" step="0.5" min="0.5" max="24" required>
                    </div>
                    <div class="form-group">
                        <label class="checkbox">
                            <input type="checkbox" id="editLocActive" ${location.is_active ? 'checked' : ''}>
                            <span>Active</span>
                        </label>
                    </div>
                    <div style="margin-top:20px; display:flex; gap:10px;">
                        <button type="submit" class="btn btn-primary" style="flex:1;">
                            <i class="fas fa-save"></i> Save Changes
                        </button>
                        <button type="button" onclick="closeModal()" class="btn" style="flex:1; background:#6c757d; color:white;">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                </form>
            </div>
        `;

        showModal(html);

        document.getElementById('editLocationForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('editLocName').value.trim();
            const rate = parseFloat(document.getElementById('editLocRate').value);
            const hours = parseFloat(document.getElementById('editLocHours').value);
            const isActive = document.getElementById('editLocActive').checked;

            const { error: updateError } = await supabase
                .from('locations')
                .update({ name, hourly_rate: rate, default_hours: hours, is_active: isActive })
                .eq('id', id);

            if (updateError) throw updateError;

            closeModal();
            showMessage('✅ Location updated!', 'success');
            await loadLocations();
        });
    } catch (error) {
        console.error('❌ Error editing location:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    }
};

window.viewTimesheets = function() { alert('View Timesheets coming soon!'); };
window.exportData = function() { alert('Export coming soon!'); };
window.showSettings = function() { alert('Settings coming soon!'); };
window.showHelp = function() { alert('Help coming soon!'); };

// Final log
console.log('🎉 Script loaded successfully');
