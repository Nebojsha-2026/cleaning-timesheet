// Employee Management Module
console.log('👥 Employee Management module loading...');

// Load all employees for manager
async function loadEmployees() {
    try {
        const companyId = localStorage.getItem('cleaning_timesheet_company');
        if (!companyId) {
            console.warn('No company ID found');
            return [];
        }

        console.log('Loading employees for company:', companyId);
        
        const { data: employees, error } = await window.supabaseClient
            .from('profiles')
            .select(`
                id,
                name,
                role,
                created_at,
                users:auth.users(email, last_sign_in_at)
            `)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        console.log('Employees loaded:', employees?.length || 0);
        return employees || [];

    } catch (error) {
        console.error('Error loading employees:', error);
        return [];
    }
}

// Invite employee by email
async function inviteEmployee(email, name = '') {
    try {
        const companyId = localStorage.getItem('cleaning_timesheet_company');
        if (!companyId) {
            throw new Error('No company selected');
        }

        // Create invitation record
        const token = generateToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        const { error } = await window.supabaseClient
            .from('invitations')
            .insert([{
                company_id: companyId,
                email: email.trim().toLowerCase(),
                token: token,
                role: 'employee',
                expires_at: expiresAt.toISOString(),
                accepted: false
            }]);

        if (error) throw error;

        // TODO: Send invitation email with token
        console.log('Invitation created for:', email);
        
        return { success: true, token: token };

    } catch (error) {
        console.error('Error inviting employee:', error);
        return { success: false, error: error.message };
    }
}

// Generate random token
function generateToken() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Create employee directly (without invitation)
async function createEmployee(email, password, name, role = 'employee') {
    try {
        const companyId = localStorage.getItem('cleaning_timesheet_company');
        if (!companyId) {
            throw new Error('No company selected');
        }

        // Create user in auth
        const { data: authData, error: authError } = await window.supabaseClient.auth.admin.createUser({
            email: email.trim().toLowerCase(),
            password: password,
            email_confirm: true
        });

        if (authError) throw authError;

        // Create profile
        const { error: profileError } = await window.supabaseClient
            .from('profiles')
            .insert([{
                id: authData.user.id,
                company_id: companyId,
                role: role,
                name: name || email.split('@')[0]
            }]);

        if (profileError) throw profileError;

        console.log('Employee created:', email);
        return { success: true, userId: authData.user.id };

    } catch (error) {
        console.error('Error creating employee:', error);
        return { success: false, error: error.message };
    }
}

// Show invite employee modal
window.showInviteEmployeeModal = function() {
    const html = `
        <div class="modal-content">
            <h2><i class="fas fa-user-plus"></i> Invite Employee</h2>
            <form id="inviteEmployeeForm">
                <div class="form-group">
                    <label for="inviteEmail"><i class="fas fa-envelope"></i> Email Address</label>
                    <input type="email" id="inviteEmail" placeholder="employee@example.com" required>
                </div>
                <div class="form-group">
                    <label for="inviteName"><i class="fas fa-user"></i> Name (Optional)</label>
                    <input type="text" id="inviteName" placeholder="Employee Name">
                </div>
                <div class="form-group">
                    <label>Invitation Method</label>
                    <div style="margin-top: 10px;">
                        <label class="radio" style="display: block; margin-bottom: 10px;">
                            <input type="radio" name="inviteMethod" value="email" checked>
                            <span>Send invitation email (employee creates own password)</span>
                        </label>
                        <label class="radio" style="display: block;">
                            <input type="radio" name="inviteMethod" value="create">
                            <span>Create account for them (you'll set password)</span>
                        </label>
                    </div>
                </div>
                <div id="passwordSection" style="display: none;">
                    <div class="form-group">
                        <label for="employeePassword">Password</label>
                        <input type="password" id="employeePassword" placeholder="Set initial password">
                    </div>
                </div>
                <div style="margin-top: 20px; display: flex; gap: 10px;">
                    <button type="submit" class="btn btn-primary" style="flex: 1;">
                        <i class="fas fa-paper-plane"></i> Send Invitation
                    </button>
                    <button type="button" class="btn cancel-btn" style="flex: 1; background: #6c757d; color: white;">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </form>
        </div>
    `;

    showModal(html);

    // Toggle password field based on selection
    document.querySelectorAll('input[name="inviteMethod"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const passwordSection = document.getElementById('passwordSection');
            if (this.value === 'create') {
                passwordSection.style.display = 'block';
                document.getElementById('employeePassword').required = true;
            } else {
                passwordSection.style.display = 'none';
                document.getElementById('employeePassword').required = false;
            }
        });
    });

    // Handle form submission
    document.getElementById('inviteEmployeeForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('inviteEmail').value.trim();
        const name = document.getElementById('inviteName').value.trim();
        const method = document.querySelector('input[name="inviteMethod"]:checked').value;
        const password = document.getElementById('employeePassword')?.value;

        if (!email) {
            showMessage('Please enter email address', 'error');
            return;
        }

        if (method === 'create' && (!password || password.length < 6)) {
            showMessage('Password must be at least 6 characters', 'error');
            return;
        }

        showMessage('Processing...', 'info');

        try {
            if (method === 'create') {
                // Create employee directly
                const result = await createEmployee(email, password, name);
                if (result.success) {
                    showMessage('✅ Employee account created successfully!', 'success');
                    closeModal();
                } else {
                    showMessage('❌ ' + result.error, 'error');
                }
            } else {
                // Send invitation
                const result = await inviteEmployee(email, name);
                if (result.success) {
                    showMessage('✅ Invitation sent to ' + email, 'success');
                    closeModal();
                } else {
                    showMessage('❌ ' + result.error, 'error');
                }
            }
        } catch (error) {
            showMessage('❌ Error: ' + error.message, 'error');
        }
    });

    document.querySelector('.cancel-btn').addEventListener('click', closeModal);
};

console.log('✅ Employee Management module loaded');
