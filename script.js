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
      
        // Setup location input listener for auto-fill and rate field
        document.getElementById('location').addEventListener('input', handleLocationInput);
        document.getElementById('location').addEventListener('change', handleLocationSelection);
        
        // Setup email notification checkbox
        document.getElementById('sendEmail').addEventListener('change', handleEmailCheckbox);
      
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

// Handle email checkbox change
function handleEmailCheckbox(event) {
    const emailGroup = document.getElementById('emailGroup');
    if (!emailGroup) {
        // Create email group if it doesn't exist
        const checkbox = event.target;
        const formGroup = checkbox.closest('.form-group');
        
        const emailHtml = `
            <div class="form-group" id="emailGroup">
                <label for="emailAddress"><i class="fas fa-envelope"></i> Email Address</label>
                <input type="email" id="emailAddress" placeholder="your@email.com" required>
            </div>
        `;
        
        formGroup.insertAdjacentHTML('afterend', emailHtml);
    }
    
    emailGroup.style.display = event.target.checked ? 'block' : 'none';
    if (!event.target.checked) {
        document.getElementById('emailAddress').value = '';
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

// Handle location selection from dropdown to auto-fill hours
async function handleLocationSelection(event) {
    const locationName = event.target.value.trim();
    
    if (!locationName) return;
    
    // Try to find the location in our loaded locations
    if (window.appLocations) {
        const location = window.appLocations.find(loc => loc.name === locationName);
        
        if (location) {
            // Auto-fill the hours field with the location's default hours
            document.getElementById('hours').value = location.default_hours;
            
            // Also hide the rate group since this is an existing location
            document.getElementById('rateGroup').style.display = 'none';
        }
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
        const sendEmail = document.getElementById('sendEmail').checked;
        const emailAddress = sendEmail ? document.getElementById('emailAddress').value.trim() : null;
      
        if (!startDate || !endDate) throw new Error('Please select start and end dates');
        if (sendEmail && (!emailAddress || !validateEmail(emailAddress))) {
            throw new Error('Please enter a valid email address');
        }
      
        const { data: entries, error: entriesError } = await supabase
            .from('entries')
            .select(`
                *,
                locations (name, hourly_rate)
            `)
            .gte('work_date', startDate)
            .lte('work_date', endDate)
            .order('work_date', { ascending: true });
      
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
            .insert([{ 
                ref_number: refNumber, 
                start_date: startDate, 
                end_date: endDate, 
                total_hours: totalHours, 
                total_earnings: totalEarnings,
                email_sent: sendEmail,
                email_address: emailAddress
            }])
            .select()
            .single();
      
        if (tsError) throw tsError;
      
        // Prepare timesheet details for display/email
        const timesheetDetails = {
            refNumber,
            startDate,
            endDate,
            totalHours: totalHours.toFixed(2),
            totalEarnings,
            entriesCount: entries.length,
            entries: entries.map(entry => ({
                date: formatDate(entry.work_date),
                location: entry.locations?.name || 'Unknown',
                hours: entry.hours,
                rate: entry.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE,
                earnings: (entry.hours * (entry.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE)).toFixed(2),
                notes: entry.notes || ''
            }))
        };
      
        showMessage(`✅ Timesheet ${refNumber} generated!`, 'success');
        await loadStats();
      
        // Show timesheet details
        viewTimesheetDetails(timesheetDetails);
      
        // Send email if requested
        if (sendEmail && emailAddress) {
            await sendTimesheetEmail(timesheetDetails, emailAddress);
        }
      
    } catch (error) {
        console.error('❌ Timesheet error:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Email validation helper
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Send timesheet email
async function sendTimesheetEmail(timesheetDetails, emailAddress) {
    try {
        // For now, we'll show a message that email would be sent
        // In a real app, you would integrate with an email service like SendGrid, etc.
        console.log('📧 Would send timesheet to:', emailAddress);
        console.log('Timesheet details:', timesheetDetails);
        
        // Show a message that email functionality is coming soon
        setTimeout(() => {
            showMessage(`📧 Timesheet summary would be sent to ${emailAddress} (Email integration coming soon!)`, 'info');
        }, 1000);
        
        return true;
    } catch (error) {
        console.error('❌ Email error:', error);
        showMessage('⚠️ Could not send email (feature in development)', 'info');
        return false;
    }
}

// View timesheet details
function viewTimesheetDetails(timesheetDetails) {
    let entriesHtml = '';
    timesheetDetails.entries.forEach(entry => {
        entriesHtml += `
            <div style="padding: 10px 0; border-bottom: 1px solid #eee;">
                <div style="display: flex; justify-content: space-between;">
                    <div>
                        <strong>${entry.date}</strong> • ${entry.location}
                        ${entry.notes ? `<br><small>${escapeHtml(entry.notes)}</small>` : ''}
                    </div>
                    <div style="text-align: right;">
                        ${entry.hours} hrs @ $${entry.rate}/hr<br>
                        <strong>$${entry.earnings}</strong>
                    </div>
                </div>
            </div>
        `;
    });
  
    const html = `
        <div class="modal-content">
            <h2>Timesheet ${timesheetDetails.refNumber}</h2>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <div>
                        <strong>Period:</strong><br>
                        ${formatDate(timesheetDetails.startDate)} to ${formatDate(timesheetDetails.endDate)}
                    </div>
                    <div style="text-align: right;">
                        <strong>Total Hours:</strong><br>
                        ${timesheetDetails.totalHours} hrs
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <div>
                        <strong>Total Earnings:</strong><br>
                        $${timesheetDetails.totalEarnings}
                    </div>
                    <div style="text-align: right;">
                        <strong>Entries:</strong><br>
                        ${timesheetDetails.entriesCount}
                    </div>
                </div>
            </div>
            
            <h3>Entries</h3>
            <div style="max-height: 300px; overflow-y: auto; margin-bottom: 20px;">
                ${entriesHtml}
            </div>
            
            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <button onclick="printTimesheet('${timesheetDetails.refNumber}')" class="btn btn-primary" style="flex:1;">
                    <i class="fas fa-print"></i> Print
                </button>
                <button onclick="closeModal()" class="btn" style="flex:1;">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        </div>
    `;
  
    showModal(html);
}

// Print timesheet
window.printTimesheet = function(refNumber) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Timesheet ${refNumber}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #333; }
                .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .total { font-weight: bold; text-align: right; }
                @media print {
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>Timesheet ${refNumber}</h1>
            <p>Generated on ${formatDate(new Date())}</p>
            <div style="text-align: center; margin: 20px 0;">
                <button onclick="window.print()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Print Timesheet
                </button>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
};

// ───────────────────────────────────────────────
//   VIEW TIMESHEETS FUNCTIONALITY
// ───────────────────────────────────────────────

window.viewTimesheets = async function() {
    try {
        const { data: timesheets, error } = await supabase
            .from('timesheets')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        let timesheetsHtml = '';
        if (timesheets && timesheets.length > 0) {
            timesheets.forEach(timesheet => {
                const emailStatus = timesheet.email_sent 
                    ? `<span style="color: #28a745;"><i class="fas fa-check-circle"></i> Sent${timesheet.email_address ? ' to ' + timesheet.email_address : ''}</span>`
                    : '<span style="color: #6c757d;"><i class="fas fa-times-circle"></i> Not sent</span>';
                
                timesheetsHtml += `
                    <div class="timesheet-item" style="padding: 15px; border-bottom: 1px solid #eee;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h4 style="margin: 0 0 5px 0;">${timesheet.ref_number}</h4>
                                <p style="margin: 0; color: #666; font-size: 0.9rem;">
                                    ${formatDate(timesheet.start_date)} to ${formatDate(timesheet.end_date)}<br>
                                    ${timesheet.total_hours} hrs • $${timesheet.total_earnings} • ${emailStatus}
                                </p>
                            </div>
                            <div class="timesheet-actions">
                                <button class="btn-icon view-timesheet-btn" data-id="${timesheet.id}" title="View Details">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn-icon delete-timesheet-btn" data-id="${timesheet.id}" title="Delete" style="color: #dc3545;">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            timesheetsHtml = '<p style="text-align:center; padding:20px;">No timesheets generated yet.</p>';
        }

        const html = `
            <div class="modal-content">
                <h2>All Timesheets</h2>
                <div style="max-height: 400px; overflow-y: auto; margin-bottom: 20px;">
                    ${timesheetsHtml}
                </div>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button onclick="closeModal()" class="btn" style="flex:1;">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            </div>
        `;

        showModal(html);
        
        // Add event listeners for buttons
        setTimeout(() => {
            document.querySelectorAll('.view-timesheet-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    viewTimesheetById(id);
                });
            });
            
            document.querySelectorAll('.delete-timesheet-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    deleteTimesheet(id);
                });
            });
        }, 100);
    } catch (error) {
        console.error('❌ Error loading timesheets:', error);
        showMessage('❌ Error loading timesheets: ' + error.message, 'error');
    }
};

// View specific timesheet by ID
async function viewTimesheetById(id) {
    try {
        const { data: timesheet, error: tsError } = await supabase
            .from('timesheets')
            .select('*')
            .eq('id', id)
            .single();

        if (tsError) throw tsError;

        // Get entries for this timesheet period
        const { data: entries, error: entriesError } = await supabase
            .from('entries')
            .select(`
                *,
                locations (name, hourly_rate)
            `)
            .gte('work_date', timesheet.start_date)
            .lte('work_date', timesheet.end_date)
            .order('work_date', { ascending: true });

        if (entriesError) throw entriesError;

        const timesheetDetails = {
            refNumber: timesheet.ref_number,
            startDate: timesheet.start_date,
            endDate: timesheet.end_date,
            totalHours: parseFloat(timesheet.total_hours).toFixed(2),
            totalEarnings: timesheet.total_earnings,
            entriesCount: entries?.length || 0,
            entries: entries?.map(entry => ({
                date: formatDate(entry.work_date),
                location: entry.locations?.name || 'Unknown',
                hours: entry.hours,
                rate: entry.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE,
                earnings: (entry.hours * (entry.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE)).toFixed(2),
                notes: entry.notes || ''
            })) || []
        };

        viewTimesheetDetails(timesheetDetails);
    } catch (error) {
        console.error('❌ Error viewing timesheet:', error);
        showMessage('❌ Error viewing timesheet: ' + error.message, 'error');
    }
}

// Delete timesheet
async function deleteTimesheet(id) {
    console.log("Delete timesheet clicked for ID:", id);

    const html = `
        <div class="modal-content" data-timesheet-id="${id}">
            <h2>Confirm Delete Timesheet</h2>
            <p style="margin:15px 0;">Are you sure you want to delete this timesheet?</p>
            <p style="color:#dc3545; font-weight:bold;">
                Note: This only deletes the timesheet record, not the actual entries.
            </p>
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button class="btn btn-primary confirm-delete-timesheet-btn" style="flex:1; background:#dc3545; border:none;">
                    <i class="fas fa-trash"></i> Yes, Delete Timesheet
                </button>
                <button class="btn cancel-btn" style="flex:1;">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `;

    showModal(html);
    
    // Add event listeners after modal is shown
    setTimeout(() => {
        const modalContent = document.querySelector('.modal-content');
        const timesheetId = modalContent.getAttribute('data-timesheet-id');
        
        document.querySelector('.confirm-delete-timesheet-btn').addEventListener('click', async function() {
            console.log("Confirming delete for timesheet ID:", timesheetId);
            
            try {
                const { error } = await supabase
                    .from('timesheets')
                    .delete()
                    .eq('id', timesheetId);

                if (error) throw error;

                closeModal();
                showMessage('✅ Timesheet deleted successfully!', 'success');
                await loadStats();
                // Refresh the timesheets view if it's open
                if (document.querySelector('.modal-content h2').textContent === 'All Timesheets') {
                    closeModal();
                    viewTimesheets();
                }
            } catch (error) {
                console.error("Delete timesheet error:", error);
                showMessage('❌ Error deleting timesheet: ' + error.message, 'error');
            }
        });
        
        document.querySelector('.cancel-btn').addEventListener('click', closeModal);
    }, 100);
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
                        <button type="button" class="btn cancel-btn" style="flex:1; background:#6c757d; color:white;">
                            <i
