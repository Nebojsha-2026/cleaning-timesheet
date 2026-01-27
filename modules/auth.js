// modules/auth.js - Authentication module
console.log('🔐 Auth module loading...');

// Configuration
const AUTH_CONFIG = {
    TOKEN_KEY: 'cleaning_timesheet_token',
    USER_KEY: 'cleaning_timesheet_user',
    COMPANY_KEY: 'cleaning_timesheet_company',
    ROLE_KEY: 'cleaning_timesheet_role'
};

// Current authentication state
let currentUser = null;
let currentToken = null;
let currentCompany = null;
let userRole = null;

// Initialize authentication
function initializeAuth() {
    console.log('🔐 Initializing authentication...');
    
    // Load saved authentication state
    loadAuthState();
    
    // Check if user is authenticated
    if (isAuthenticated()) {
        console.log('✅ User is authenticated:', currentUser?.email);
        updateUIForAuthState();
    } else {
        console.log('⚠️ User is not authenticated');
        updateUIForAuthState();
    }
}

// Load authentication state from localStorage
function loadAuthState() {
    try {
        const token = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
        const userStr = localStorage.getItem(AUTH_CONFIG.USER_KEY);
        const companyStr = localStorage.getItem(AUTH_CONFIG.COMPANY_KEY);
        const role = localStorage.getItem(AUTH_CONFIG.ROLE_KEY);
        
        if (token && userStr) {
            currentToken = token;
            currentUser = JSON.parse(userStr);
            currentCompany = companyStr ? JSON.parse(companyStr) : null;
            userRole = role;
            
            // Set token in Supabase headers if needed
            if (window.supabaseClient) {
                window.supabaseClient.auth.setAuth(token);
            }
            
            return true;
        }
    } catch (error) {
        console.error('❌ Error loading auth state:', error);
        clearAuth();
    }
    return false;
}

// Save authentication state to localStorage
function saveAuthState(token, user, company = null, role = null) {
    try {
        localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, token);
        localStorage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify(user));
        
        if (company) {
            localStorage.setItem(AUTH_CONFIG.COMPANY_KEY, JSON.stringify(company));
            currentCompany = company;
        }
        
        if (role) {
            localStorage.setItem(AUTH_CONFIG.ROLE_KEY, role);
            userRole = role;
        }
        
        currentToken = token;
        currentUser = user;
        
        console.log('✅ Auth state saved');
        return true;
    } catch (error) {
        console.error('❌ Error saving auth state:', error);
        return false;
    }
}

// Clear authentication state
function clearAuth() {
    localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
    localStorage.removeItem(AUTH_CONFIG.USER_KEY);
    localStorage.removeItem(AUTH_CONFIG.COMPANY_KEY);
    localStorage.removeItem(AUTH_CONFIG.ROLE_KEY);
    
    currentUser = null;
    currentToken = null;
    currentCompany = null;
    userRole = null;
    
    if (window.supabaseClient) {
        window.supabaseClient.auth.signOut();
    }
    
    console.log('✅ Auth state cleared');
}

// Check if user is authenticated
function isAuthenticated() {
    return !!(currentToken && currentUser);
}

// Check user role
function hasRole(role) {
    return userRole === role;
}

// Get current user
function getCurrentUser() {
    return currentUser;
}

// Get current company
function getCurrentCompany() {
    return currentCompany;
}

// Get user role
function getUserRole() {
    return userRole;
}

// Update UI based on authentication state
function updateUIForAuthState() {
    const isAuth = isAuthenticated();
    const role = getUserRole();
    
    // This function will be customized in each HTML page
    // We'll add specific logic for each page
    console.log(`🔄 UI update: Authenticated=${isAuth}, Role=${role}`);
}

// Login function
async function login(email, password) {
    try {
        console.log('🔐 Attempting login for:', email);
        
        // For now, we'll simulate login with existing staff table
        // In production, you'd use proper auth
        const { data: user, error } = await window.supabaseClient
            .from('staff')
            .select('*')
            .eq('email', email)
            .single();
        
        if (error) {
            console.error('❌ Login error:', error);
            throw new Error('Invalid email or password');
        }
        
        if (!user) {
            throw new Error('User not found');
        }
        
        // In a real app, you'd verify password hash
        // For now, we'll accept any password (temporary)
        
        // Create auth token (simplified - in real app, use JWT from backend)
        const authToken = `token_${Date.now()}_${user.id}`;
        
        // Get company info if available
        let company = null;
        if (user.company_id) {
            const { data: companyData } = await window.supabaseClient
                .from('companies')
                .select('*')
                .eq('id', user.company_id)
                .single();
            
            company = companyData;
        }
        
        // Save auth state
        saveAuthState(authToken, user, company, user.role);
        
        console.log('✅ Login successful for:', user.email);
        return { success: true, user, company, role: user.role };
        
    } catch (error) {
        console.error('❌ Login failed:', error);
        return { success: false, error: error.message };
    }
}

// Register function (for managers)
async function registerManager(email, password, companyName) {
    try {
        console.log('📝 Registering new manager:', email);
        
        // Check if email already exists
        const { data: existingUser } = await window.supabaseClient
            .from('staff')
            .select('id')
            .eq('email', email)
            .single();
        
        if (existingUser) {
            throw new Error('Email already registered');
        }
        
        // Create company first
        const { data: company, error: companyError } = await window.supabaseClient
            .from('companies')
            .insert([
                {
                    name: companyName,
                    primary_color: '#667eea',
                    secondary_color: '#764ba2',
                    custom_title: `${companyName} Timesheet`
                }
            ])
            .select()
            .single();
        
        if (companyError) throw companyError;
        
        // Create manager user
        const { data: user, error: userError } = await window.supabaseClient
            .from('staff')
            .insert([
                {
                    email: email,
                    name: 'Manager', // Default name
                    role: 'manager',
                    company_id: company.id,
                    is_active: true,
                    hourly_rate: 0 // Managers don't have hourly rate
                }
            ])
            .select()
            .single();
        
        if (userError) throw userError;
        
        // Create auth token
        const authToken = `token_${Date.now()}_${user.id}`;
        
        // Save auth state
        saveAuthState(authToken, user, company, 'manager');
        
        console.log('✅ Manager registration successful');
        return { success: true, user, company };
        
    } catch (error) {
        console.error('❌ Registration failed:', error);
        return { success: false, error: error.message };
    }
}

// Invite employee
async function inviteEmployee(email, companyId, invitedBy) {
    try {
        console.log('📧 Inviting employee:', email);
        
        // Check if email already exists
        const { data: existingUser } = await window.supabaseClient
            .from('staff')
            .select('id')
            .eq('email', email)
            .single();
        
        if (existingUser) {
            throw new Error('Employee already registered');
        }
        
        // Create invitation token
        const token = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days
        
        // Save invitation to database
        const { data: invitation, error: inviteError } = await window.supabaseClient
            .from('invitations')
            .insert([
                {
                    email: email,
                    token: token,
                    company_id: companyId,
                    role: 'employee',
                    expires_at: expiresAt.toISOString(),
                    created_by: invitedBy
                }
            ])
            .select()
            .single();
        
        if (inviteError) throw inviteError;
        
        // In a real app, send email here
        console.log('📧 Invitation created (token would be emailed):', token);
        
        return { success: true, token, invitation };
        
    } catch (error) {
        console.error('❌ Invitation failed:', error);
        return { success: false, error: error.message };
    }
}

// Accept invitation
async function acceptInvitation(token, name, password) {
    try {
        console.log('✅ Accepting invitation with token:', token);
        
        // Get invitation
        const { data: invitation, error: inviteError } = await window.supabaseClient
            .from('invitations')
            .select('*')
            .eq('token', token)
            .single();
        
        if (inviteError || !invitation) {
            throw new Error('Invalid or expired invitation');
        }
        
        // Check if expired
        if (new Date(invitation.expires_at) < new Date()) {
            throw new Error('Invitation has expired');
        }
        
        // Check if already accepted
        if (invitation.accepted) {
            throw new Error('Invitation already accepted');
        }
        
        // Create employee account
        const { data: user, error: userError } = await window.supabaseClient
            .from('staff')
            .insert([
                {
                    email: invitation.email,
                    name: name,
                    role: 'employee',
                    company_id: invitation.company_id,
                    is_active: true,
                    hourly_rate: 23.00 // Default rate
                }
            ])
            .select()
            .single();
        
        if (userError) throw userError;
        
        // Mark invitation as accepted
        await window.supabaseClient
            .from('invitations')
            .update({ accepted: true })
            .eq('id', invitation.id);
        
        // Get company info
        const { data: company } = await window.supabaseClient
            .from('companies')
            .select('*')
            .eq('id', invitation.company_id)
            .single();
        
        // Create auth token
        const authToken = `token_${Date.now()}_${user.id}`;
        
        // Save auth state
        saveAuthState(authToken, user, company, 'employee');
        
        console.log('✅ Invitation accepted successfully');
        return { success: true, user, company };
        
    } catch (error) {
        console.error('❌ Accept invitation failed:', error);
        return { success: false, error: error.message };
    }
}

// Logout function
function logout() {
    clearAuth();
    window.location.href = 'auth/login.html';
}

// Protect route - redirect if not authenticated
function protectRoute(requiredRole = null, redirectTo = 'auth/login.html') {
    if (!isAuthenticated()) {
        window.location.href = redirectTo;
        return false;
    }
    
    if (requiredRole && userRole !== requiredRole) {
        console.warn(`⛔ Access denied: Required role ${requiredRole}, user role ${userRole}`);
        window.location.href = redirectTo;
        return false;
    }
    
    return true;
}

// Auto-initialize when module loads
document.addEventListener('DOMContentLoaded', function() {
    if (typeof window.supabaseClient !== 'undefined') {
        setTimeout(initializeAuth, 1000);
    }
});

// Export functions to window
window.auth = {
    login,
    logout,
    registerManager,
    inviteEmployee,
    acceptInvitation,
    isAuthenticated,
    getCurrentUser,
    getCurrentCompany,
    getUserRole,
    hasRole,
    protectRoute,
    clearAuth
};

console.log('✅ Auth module loaded');
