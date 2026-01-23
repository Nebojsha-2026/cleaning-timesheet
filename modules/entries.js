// Handle email checkbox change
function handleEmailCheckbox(event) {
    // First check if emailGroup already exists
    let emailGroup = document.getElementById('emailGroup');
    
    if (!emailGroup) {
        // Create email group if it doesn't exist
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
    
    // Show/hide based on checkbox state
    emailGroup.style.display = event.target.checked ? 'block' : 'none';
    
    // Clear email field when unchecked
    if (!event.target.checked) {
        const emailInput = document.getElementById('emailAddress');
        if (emailInput) {
            emailInput.value = '';
            
            // Make functions globally accessible

        }
    }
}
window.handleAddEntry = handleAddEntry;
window.handleLocationInput = handleLocationInput;
window.handleLocationSelection = handleLocationSelection;
window.handleEmailCheckbox = handleEmailCheckbox;
window.loadRecentEntries = loadRecentEntries;
window.loadLocations = loadLocations;
window.loadStats = loadStats;
window.findOrCreateLocation = findOrCreateLocation;

// Signal that this module is loaded
if (typeof checkModulesLoaded !== 'undefined') {
    checkModulesLoaded();
}

console.log('✅ Entries module loaded');
