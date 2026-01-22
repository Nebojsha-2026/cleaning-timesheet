// Configuration
const CONFIG = {
    SUPABASE_URL: 'https://hqmtigcjyqckqdzepcdu.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw',
    HOURLY_RATE: 23,
    CURRENCY: 'AUD',
    VERSION: '1.0.0'
};

// Initialize Supabase client
console.log('🔌 Supabase client:', window.supabase);
);

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
        
        // Calculate total earnings
        const { data: earningsData, error: earningsError } = await supabase
            .from('entries')
            .select('hours');
        
        if (earningsError) throw earningsError;
        
        const totalHours = earningsData.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
        const totalEarnings = (totalHours * CONFIG.HOURLY_RATE).toFixed(2);
        
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
                `<option value="${location.name}">${location.name} (${location.default_hours} hrs)</option>`
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
                locations (name)
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
        const earnings = (entry.hours * CONFIG.HOURLY_RATE).toFixed(2);
        
        html += `
            <div class="entry-item">
                <div class="entry-info">
                    <h4>${locationName}</h4>
                    <p>${formatDate(entry.work_date)} • ${entry.notes || ''}</p>
                </div>
                <div class="entry-stats">
                    <div class="entry-hours">${entry.hours} hrs</div>
                    <div class="entry-earnings">$${earnings}</div>
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
        
        if (!locationName || !hours || !date) {
            throw new Error('Please fill in all required fields');
        }
        
        if (hours <= 0 || hours > 24) {
            throw new Error('Hours must be between 0.5 and 24');
        }
        
        console.log('📝 Adding entry:', { locationName, hours, date, notes });
        
        // Find or create location
        let locationId = await findOrCreateLocation(locationName, hours);
        
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
        
        // Refresh data
        await loadStats();
        await loadRecentEntries();
        
    } catch (error) {
        console.error('❌ Add entry error:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

async function findOrCreateLocation(name, defaultHours = 2.0) {
    try {
        // Try to find existing location
        const { data: existingLocations, error: findError } = await supabase
            .from('locations')
            .select('id')
            .eq('name', name)
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
                hourly_rate: CONFIG.HOURLY_RATE
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
        
        // Get entries for date range
        const { data: entries, error: entriesError } = await supabase
            .from('entries')
            .select('hours')
            .gte('work_date', startDate)
            .lte('work_date', endDate);
        
        if (entriesError) throw entriesError;
        
        if (!entries || entries.length === 0) {
            throw new Error('No entries found for selected period');
        }
        
        // Calculate totals
        const totalHours = entries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
        const totalEarnings = (totalHours * CONFIG.HOURLY_RATE).toFixed(2);
        
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
    
    showMessage('✅ Data refreshed!', 'success');
};

window.generateTimesheet = function() {
    document.getElementById('timesheetForm').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('startDate').focus();
};

window.exportData = function() {
    alert('Export feature coming in next update!');
};

console.log('🎉 Script loaded successfully');


