// auth.js - Real Supabase Auth

console.log('🔐 Real Auth module loading...');

const AUTH_CONFIG = {
    TOKEN_KEY: 'cleaning_timesheet_token',
    USER_KEY: 'cleaning_timesheet_user',
    COMPANY_KEY: 'cleaning_timesheet_company',
    ROLE_KEY: 'cleaning_timesheet_role'
};

let currentUser = null;
let currentToken = null;
let currentCompanyId = null;
let userRole = null;

// Initialize auth state on page load
async function initializeAuth() {
    console.log('Initializing real Supabase Auth...');

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth event:', event, session?.user?.email);

        if (session) {
            currentUser = session.user;
            currentToken = session.access_token;

            // Load profile
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('company_id, role')
                .eq('id', currentUser.id)
                .single();

            if (error || !profile) {
                console.error('Profile load failed:', error);
                logout();
                return;
            }

            currentCompanyId = profile.company_id;
            userRole = profile.role;

            localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, currentToken);
            localStorage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify(currentUser));
            localStorage.setItem(AUTH_CONFIG.COMPANY_KEY, currentCompanyId);
            localStorage.setItem(AUTH_CONFIG.ROLE_KEY, userRole);

            console.log('Logged in as:', currentUser.email, userRole, currentCompanyId);

            // Redirect based on role
            if (userRole === 'manager' && !window.location.pathname.includes('manager.html')) {
                window.location.href = 'manager.html';
            } else if (userRole === 'employee' && window.location.pathname.includes('manager.html')) {
                window.location.href = 'index.html';
            }

        } else {
            clearAuth();
        }
    });

    // Check current session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        // Trigger the change handler manually
        supabase.auth.setSession(session);
    }
}

// Login
async function login(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        console.log('Login successful:', data.user.email);
        return { success: true, user: data.user };
    } catch (err) {
        console.error('Login failed:', err.message);
        return { success: false, error: err.message };
    }
}

// Register manager (creates company + profile)
async function registerManager(email, password, companyName) {
    try {
        // 1. Sign up user
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { role: 'manager' } // metadata
            }
        });

        if (signUpError) throw signUpError;
        if (!authData.user) throw new Error('No user returned');

        // 2. Create company
        const { data: company, error: companyError } = await supabase
            .from('companies')
            .insert([{ name: companyName, custom_title: companyName + ' Timesheet' }])
            .select()
            .single();

        if (companyError) throw companyError;

        // 3. Update profile with company & role
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ 
                company_id: company.id,
                role: 'manager',
                name: 'Manager'
            })
            .eq('id', authData.user.id);

        if (profileError) throw profileError;

        console.log('Manager registered:', email, company.name);
        return { success: true, user: authData.user, company };
    } catch (err) {
        console.error('Register failed:', err.message);
        return { success: false, error: err.message };
    }
}

// Logout
async function logout() {
    await supabase.auth.signOut();
    clearAuth();
    window.location.href = 'login.html'; // or wherever your login page is
}

function clearAuth() {
    localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
    localStorage.removeItem(AUTH_CONFIG.USER_KEY);
    localStorage.removeItem(AUTH_CONFIG.COMPANY_KEY);
    localStorage.removeItem(AUTH_CONFIG.ROLE_KEY);
    currentUser = null;
    currentToken = null;
    currentCompanyId = null;
    userRole = null;
}

function isAuthenticated() {
    return !!currentUser || !!localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
}

function getCurrentCompanyId() {
    return currentCompanyId || localStorage.getItem(AUTH_CONFIG.COMPANY_KEY);
}

function getUserRole() {
    return userRole || localStorage.getItem(AUTH_CONFIG.ROLE_KEY);
}

// Protect page (call on manager.html and index.html)
function protectRoute(requiredRole = null) {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }

    const role = getUserRole();
    if (requiredRole && role !== requiredRole) {
        showMessage('Access denied – insufficient permissions', 'error');
        window.location.href = role === 'manager' ? 'manager.html' : 'index.html';
        return false;
    }

    return true;
}

// Auto-init
if (window.supabaseClient) {
    initializeAuth();
}

console.log('✅ Real Auth module loaded');

// Export to window
window.auth = {
    login,
    registerManager,
    logout,
    isAuthenticated,
    getCurrentCompanyId,
    getUserRole,
    protectRoute
};
