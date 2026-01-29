// modules/locations.js
// Locations module - handles all location-related operations
// Works on both manager + employee pages (guards when UI elements don't exist)

(function () {
  'use strict';

  function getCompanyId() {
    // Prefer the same key auth.js uses
    return (
      localStorage.getItem('cleaning_timesheet_company_id') ||
      localStorage.getItem('cleaning_timesheet_company') ||
      localStorage.getItem('cleaning_timesheet_companyId') ||
      null
    );
  }

  function requireSupabase() {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized (window.supabaseClient missing)');
    }
    return window.supabaseClient;
  }

  // Create or return the datalist used by the manager shift modal (input#location)
  function createLocationDatalist() {
    const input = document.getElementById('location');

    // Employee page usually doesn't have this input — do nothing safely
    if (!input) {
      console.log('ℹ️ createLocationDatalist skipped (no #location input on this page)');
      return null;
    }

    let datalist = document.getElementById('locationList');
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = 'locationList';
      document.body.appendChild(datalist);
    }

    input.setAttribute('list', 'locationList');
    return datalist;
  }

  // Load locations (for datalist + global cache)
  async function loadLocations() {
    try {
      console.log('📍 Loading locations...');

      const supabase = requireSupabase();
      const companyId = getCompanyId();

      if (!companyId) {
        console.warn('⚠️ No companyId found in localStorage — cannot load company locations');
        window.appLocations = [];
        return;
      }

      const { data: locations, error } = await supabase
        .from('locations')
        .select('id, company_id, name, default_hours, hourly_rate, is_active')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      // Keep locations available globally for other modules
      window.appLocations = locations || [];

      // Render into datalist ONLY if the page has the location input
      const existingDatalist = document.getElementById('locationList');
      const datalist = existingDatalist || createLocationDatalist();

      if (!datalist) {
        console.log(`✅ Locations loaded (no UI to render): ${locations?.length || 0}`);
        return;
      }

      datalist.innerHTML = (locations || [])
        .map((loc) => {
          const rate = typeof loc.hourly_rate === 'number' ? loc.hourly_rate : parseFloat(loc.hourly_rate || '0');
          const hrs = typeof loc.default_hours === 'number' ? loc.default_hours : parseFloat(loc.default_hours || '0');
          const name = (window.escapeHtml ? window.escapeHtml(loc.name) : String(loc.name || ''));

          return `<option value="${name}">${name} (${hrs} hrs - $${rate}/hr)</option>`;
        })
        .join('');

      console.log('✅ Locations loaded:', locations?.length || 0);
    } catch (err) {
      console.error('❌ Error loading locations:', err);
      if (typeof window.showMessage === 'function') {
        window.showMessage('❌ Error loading locations: ' + (err.message || err), 'error');
      }
    }
  }

  // Find a location by name or create it (manager create-shift flow)
  async function findOrCreateLocation(name, defaultHours = 2.0, hourlyRate = null) {
    try {
      const supabase = requireSupabase();
      const companyId = getCompanyId();

      if (!companyId) throw new Error('No companyId found — cannot create location');
      const cleanName = String(name || '').trim();
      if (!cleanName) throw new Error('Location name is required');

      const rateFallback =
        hourlyRate != null
          ? hourlyRate
          : (window.CONFIG && window.CONFIG.DEFAULT_HOURLY_RATE) || 23;

      // 1) find existing
      const { data: existing, error: findError } = await supabase
        .from('locations')
        .select('id')
        .eq('company_id', companyId)
        .eq('name', cleanName)
        .eq('is_active', true)
        .limit(1);

      if (findError) throw findError;
      if (existing && existing.length > 0) return existing[0].id;

      // 2) create new
      const insertRow = {
        company_id: companyId,
        name: cleanName,
        default_hours: defaultHours,
        hourly_rate: rateFallback,
        is_active: true
      };

      const { data: created, error: createError } = await supabase
        .from('locations')
        .insert([insertRow])
        .select('id')
        .single();

      if (createError) throw createError;

      await loadLocations();
      return created.id;
    } catch (err) {
      console.error('❌ findOrCreateLocation error:', err);
      throw err;
    }
  }

  // Modal: View locations list (manager UI)
  async function viewLocations() {
    try {
      const supabase = requireSupabase();
      const companyId = getCompanyId();
      if (!companyId) throw new Error('No companyId found');

      const { data: locations, error } = await supabase
        .from('locations')
        .select('id, name, default_hours, hourly_rate, is_active')
        .eq('company_id', companyId)
        .order('name', { ascending: true });

      if (error) throw error;

      const esc = window.escapeHtml || ((t) => String(t || ''));
      let listHtml = '';

      if (locations && locations.length > 0) {
        locations.forEach((loc) => {
          listHtml += `
            <div class="location-item">
              <div>
                <h4>${esc(loc.name)}</h4>
                <p>Default: ${loc.default_hours} hrs • Rate: $${loc.hourly_rate}/hr</p>
                <p style="color: ${loc.is_active ? '#28a745' : '#dc3545'}; font-size: 0.8rem;">
                  ${loc.is_active ? 'Active' : 'Inactive'}
                </p>
              </div>
              <div class="location-actions">
                <button class="btn-icon edit-location" data-id="${loc.id}" title="Edit">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon delete-location" data-id="${loc.id}" title="Delete" style="color:#dc3545;">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          `;
        });
      } else {
        listHtml = '<p style="text-align:center; padding:20px;">No locations found.</p>';
      }

      const html = `
        <div class="modal-content">
          <h2>Manage Locations</h2>
          <div class="locations-list">
            ${listHtml}
          </div>
          <div style="margin-top:20px; display:flex; gap:10px;">
            <button class="btn close-locations-btn" style="flex:1;">
              <i class="fas fa-times"></i> Close
            </button>
          </div>
        </div>
      `;

      if (typeof window.showModal !== 'function') {
        throw new Error('Modal system not loaded (utils.js). window.showModal missing');
      }

      window.showModal(html);

      setTimeout(() => {
        document.querySelector('.close-locations-btn')?.addEventListener('click', () => {
          if (typeof window.closeModal === 'function') window.closeModal();
        });

        document.querySelectorAll('.edit-location').forEach((btn) => {
          btn.addEventListener('click', () => editLocation(btn.getAttribute('data-id')));
        });

        document.querySelectorAll('.delete-location').forEach((btn) => {
          btn.addEventListener('click', () => deleteLocation(btn.getAttribute('data-id')));
        });
      }, 50);
    } catch (err) {
      console.error('❌ viewLocations error:', err);
      if (typeof window.showMessage === 'function') {
        window.showMessage('❌ Error loading locations: ' + (err.message || err), 'error');
      }
    }
  }

  // Modal: Edit a single location
  async function editLocation(id) {
    try {
      const supabase = requireSupabase();

      const { data: loc, error } = await supabase
        .from('locations')
        .select('id, name, default_hours, hourly_rate, is_active')
        .eq('id', id)
        .single();

      if (error) throw error;
      const esc = window.escapeHtml || ((t) => String(t || ''));

      const html = `
        <div class="modal-content">
          <h2>Edit Location</h2>
          <form id="editLocationForm">
            <div class="form-group">
              <label for="editLocName">Location Name</label>
              <input type="text" id="editLocName" value="${esc(loc.name)}" required>
            </div>
            <div class="form-group">
              <label for="editLocRate">Hourly Rate ($)</label>
              <input type="number" id="editLocRate" value="${loc.hourly_rate}" step="0.01" min="1" required>
            </div>
            <div class="form-group">
              <label for="editLocHours">Default Hours</label>
              <input type="number" id="editLocHours" value="${loc.default_hours}" step="0.5" min="0.5" max="24" required>
            </div>
            <div class="form-group">
              <label class="checkbox">
                <input type="checkbox" id="editLocActive" ${loc.is_active ? 'checked' : ''}>
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

      if (typeof window.showModal !== 'function') {
        throw new Error('Modal system not loaded (utils.js). window.showModal missing');
      }

      window.showModal(html);

      document.querySelector('.cancel-btn')?.addEventListener('click', () => {
        if (typeof window.closeModal === 'function') window.closeModal();
      });

      document.getElementById('editLocationForm')?.addEventListener('submit', async (e) => {
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

        if (typeof window.closeModal === 'function') window.closeModal();
        if (typeof window.showMessage === 'function') window.showMessage('✅ Location updated!', 'success');

        await loadLocations();
        // If locations modal is open, refresh it
        // (optional; safe to ignore)
      });
    } catch (err) {
      console.error('❌ editLocation error:', err);
      if (typeof window.showMessage === 'function') {
        window.showMessage('❌ Error editing location: ' + (err.message || err), 'error');
      }
    }
  }

  // Modal: Delete location (+ delete entries referencing it)
  function deleteLocation(id) {
    try {
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

      if (typeof window.showModal !== 'function') {
        throw new Error('Modal system not loaded (utils.js). window.showModal missing');
      }

      window.showModal(html);

      setTimeout(() => {
        document.querySelector('.cancel-btn')?.addEventListener('click', () => {
          if (typeof window.closeModal === 'function') window.closeModal();
        });

        document.querySelector('.confirm-delete-location-btn')?.addEventListener('click', async () => {
          try {
            const supabase = requireSupabase();

            // delete entries first
            const { error: entriesError } = await supabase
              .from('entries')
              .delete()
              .eq('location_id', id);

            if (entriesError) throw entriesError;

            // delete location
            const { error: locError } = await supabase
              .from('locations')
              .delete()
              .eq('id', id);

            if (locError) throw locError;

            if (typeof window.closeModal === 'function') window.closeModal();
            if (typeof window.showMessage === 'function') {
              window.showMessage('✅ Location and associated entries deleted!', 'success');
            }

            // refresh cached locations
            await loadLocations();

            // Optional refresh hooks (only if they exist)
            if (typeof window.loadStats === 'function') {
              await window.loadStats();
            }
            if (typeof window.loadRecentEntries === 'function') {
              await window.loadRecentEntries();
            }
          } catch (err) {
            console.error('❌ deleteLocation error:', err);
            if (typeof window.showMessage === 'function') {
              window.showMessage('❌ Error deleting location: ' + (err.message || err), 'error');
            }
          }
        });
      }, 50);
    } catch (err) {
      console.error('❌ deleteLocation modal error:', err);
      if (typeof window.showMessage === 'function') {
        window.showMessage('❌ ' + (err.message || err), 'error');
      }
    }
  }

  // Expose public API (for other scripts)
  window.loadLocations = loadLocations;
  window.findOrCreateLocation = findOrCreateLocation;
  window.viewLocations = viewLocations;
  window.editLocation = editLocation;
  window.deleteLocation = deleteLocation;

  console.log('✅ Locations module loaded');
})();
