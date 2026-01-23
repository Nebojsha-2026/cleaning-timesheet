// Locations module - handles all location-related operations

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
                            <p style="color: ${location.is_active ? '#28a745' : '#dc3545'}; font-size: 0.8rem;">
                                ${location.is_active ? 'Active' : 'Inactive'}
                            </p>
                        </div>
                        <div class="location-actions">
                            <button class="btn-icon edit-location" data-id="${location.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon delete-location" data-id="${location.id}" title="Delete" style="color: #dc3545;"><i class="fas fa-trash"></i></button>
                        </div>
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
        
        // Add event listeners for buttons
        setTimeout(() => {
            document.querySelectorAll('.edit-location').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    editLocation(id);
                });
            });
            
            document.querySelectorAll('.delete-location').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    deleteLocation(id);
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
                        <button type="button" class="btn cancel-btn" style="flex:1; background:#6c757d; color:white;">
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
        
        // Add cancel button listener
        document.querySelector('.cancel-btn').addEventListener('click', closeModal);
    } catch (error) {
        console.error('❌ Error editing location:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    }
};

// Add delete location function
window.deleteLocation = function(id) {
    console.log("Delete location clicked for ID:", id);

    const html = `
        <div class="modal-content" data-location-id="${id}">
            <h2>Confirm Delete Location</h2>
            <p style="margin:15px 0;">Are you sure you want to delete this location?</p>
            <p style="color:#dc3545; font-weight:bold;">
                Warning: This will also delete all entries associated with this location!
            </p>
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button class="btn btn-primary confirm-delete-location-btn" style="flex:1; background:#dc3545; border:none;">
                    <i class="fas fa-trash"></i> Yes, Delete Location
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
        const locationId = modalContent.getAttribute('data-location-id');
        
        document.querySelector('.confirm-delete-location-btn').addEventListener('click', async function() {
            console.log("Confirming delete for location ID:", locationId);
            
            try {
                // First delete all entries associated with this location
                const { error: entriesError } = await supabase
                    .from('entries')
                    .delete()
                    .eq('location_id', locationId);

                if (entriesError) throw entriesError;

                // Then delete the location
                const { error: locationError } = await supabase
                    .from('locations')
                    .delete()
                    .eq('id', locationId);

                if (locationError) throw locationError;

                closeModal();
                showMessage('✅ Location and associated entries deleted successfully!', 'success');
                await loadStats();
                await loadRecentEntries();
                await loadLocations();
            } catch (error) {
                console.error("Delete location error:", error);
                showMessage('❌ Error deleting location: ' + error.message, 'error');
            }
        });
        
        document.querySelector('.cancel-btn').addEventListener('click', closeModal);
    }, 100);
};

// Make functions globally accessible
window.loadLocations = loadLocations;

console.log('✅ Locations module loaded');
