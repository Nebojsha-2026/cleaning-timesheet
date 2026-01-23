// Entries module - handles all entry-related operations

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

// EDIT & DELETE FOR RECENT ENTRIES
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
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                </form>
            </div>
        `;

        showModal(html);
        
        // Add event listeners
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
        
        // Add cancel button listener
        document.querySelector('.cancel-btn').addEventListener('click', closeModal);
        
    } catch (error) {
        console.error("Edit entry error:", error);
        showMessage('❌ Error: ' + error.message, 'error');
    }
};

window.deleteEntry = function(id) {
    console.log("Delete clicked for entry ID:", id);

    // Store the ID in a data attribute on the modal itself
    const html = `
        <div class="modal-content" data-entry-id="${id}">
            <h2>Confirm Delete</h2>
            <p style="margin:15px 0;">Are you sure you want to delete this entry?</p>
            <p style="color:#dc3545; font-weight:bold;">This cannot be undone.</p>
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button class="btn btn-primary confirm-delete-btn" style="flex:1; background:#dc3545; border:none;">
                    <i class="fas fa-trash"></i> Yes, Delete
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
        const entryId = modalContent.getAttribute('data-entry-id');
        
        document.querySelector('.confirm-delete-btn').addEventListener('click', async function() {
            console.log("Confirming delete for ID:", entryId);
            
            try {
                const { error } = await supabase
                    .from('entries')
                    .delete()
                    .eq('id', entryId);

                if (error) throw error;

                closeModal();
                showMessage('✅ Entry deleted successfully!', 'success');
                await loadStats();
                await loadRecentEntries();
            } catch (error) {
                console.error("Delete error:", error);
                showMessage('❌ Error deleting entry: ' + error.message, 'error');
            }
        });
        
        document.querySelector('.cancel-btn').addEventListener('click', closeModal);
    }, 100);
};

console.log('✅ Entries module loaded');
