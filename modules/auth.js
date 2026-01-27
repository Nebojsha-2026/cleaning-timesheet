// auth.js - Real Supabase Authentication

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

// Wait for Supabase to be ready
function waitForSupabase() {
    if (window.supabase && window.supabase.createClient) {
        return window.supabase.createClient(
            'https://hqmtigcjyqckqdzepcdu.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw'
        );
    }
    return null;
}

let supabase = waitForSupabase();

// Initialize auth
async function initializeAuth() {
    console.log('Initializing real auth...');

    if (!supabase) {
        console.error('Supabase not loaded – cannot initialize auth');
        return;
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth event:', event);

        if (session?.user) {
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

            console.log('Logged in:', currentUser.email, userRole, currentCompanyId);

            // Redirect based on role
            if (userRole === 'manager' && window.location.pathname.includes('index.html')) {
                window.location.href = 'manager.html';
            } else if (userRole !== 'manager' && window.location.pathname.includes('manager.html')) {
                window.location.href = 'index.html';
            }

        } else {
            clearAuth();
            if (!window.location.pathname.includes('login.html') && 
                !window.location.pathname.includes('register.html')) {
                window.location.href = 'login.html';
            }
        }
    });

    // Check existing session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        supabase.auth.setSession(session);
    }
}

// Login
async function login(email, password) {
    if (!supabase) throw new Error('Supabase not ready');

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        console.log('Login success:', data.user.email);
        return { success: true, user: data.user };
    } catch (err) {
        console.error('Login failed:', err.message);
        return { success: false, error: err.message };
    }
}

// Register manager (creates company + profile)
async function registerManager(email, password, companyName) {
    if (!supabase) throw new Error('Supabase not ready');

    try {
        // Sign up
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { role: 'manager' } }
        });

        if (signUpError) throw signUpError;
        if (!authData.user) throw new Error('No user created');

        // Wait a moment for trigger to create profile
        await new Promise(r => setTimeout(r, 1000));

        // Create company
        const { data: company, error: companyError } = await supabase
            .from('companies')
            .insert([{ 
                name: companyName, 
                custom_title: companyName + ' Timesheet',
                primary_color: '#667eea',
                secondary_color: '#764ba2'
            }])
            .select()
            .single();

        if (companyError) throw companyError;

        // Update profile
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
    if (supabase) await supabase.auth.signOut();
    clearAuth();
    window.location.href = 'login.html';
}

function clearAuth() {
    localStorage.clear();
    currentUser = null;
    currentToken = null;
    currentCompanyId = null;
    userRole = null;
}

function isAuthenticated() {
    return !!localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
}

function getCurrentCompanyId() {
    return localStorage.getItem(AUTH_CONFIG.COMPANY_KEY);
}

function getUserRole() {
    return localStorage.getItem(AUTH_CONFIG.ROLE_KEY);
}

function protectRoute(requiredRole = null) {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }

    const role = getUserRole();
    if (requiredRole && role !== requiredRole) {
        window.location.href = role === 'manager' ? 'manager.html' : 'index.html';
        return false;
    }

    return true;
}

// Auto-init
setTimeout(initializeAuth, 500); // give time for supabase to load

console.log('✅ Real Auth module loaded');

window.auth = {
    login,
    registerManager,
    logout,
    isAuthenticated,
    getCurrentCompanyId,
    getUserRole,
    protectRoute
};
