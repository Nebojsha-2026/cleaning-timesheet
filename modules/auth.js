// auth.js - Fixed to avoid redirect loops on auth pages

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

let supabase = null;

// Safe Supabase init
function initSupabase() {
    if (window.supabase && window.supabase.createClient) {
        supabase = window.supabase.createClient(
            'https://hqmtigcjyqckqdzepcdu.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw'
        );
        window.supabaseClient = supabase;
        console.log('Supabase initialized');
    } else {
        console.error('Supabase script not loaded');
    }
}

initSupabase();

// Initialize auth
async function initializeAuth() {
    if (!supabase) {
        console.error('Supabase not ready');
        return;
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth event:', event, session ? 'session exists' : 'no session');

        // Skip redirect logic on login/register pages
        const isAuthPage = window.location.pathname.includes('login.html') || 
                           window.location.pathname.includes('register.html');

        if (isAuthPage) {
            console.log('On auth page - skipping redirect');
            return;
        }

        if (session?.user) {
            currentUser = session.user;
            currentToken = session.access_token;

            // Load profile
            let profile = null;
            const { data, error } = await supabase
                .from('profiles')
                .select('company_id, role')
                .eq('id', currentUser.id)
                .single();

            if (!error && data) {
                profile = data;
            }

            if (profile) {
                currentCompanyId = profile.company_id;
                userRole = profile.role || 'employee';
            } else {
                userRole = 'employee';
                currentCompanyId = null;
            }

            localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, currentToken);
            localStorage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify(currentUser));
            localStorage.setItem(AUTH_CONFIG.COMPANY_KEY, currentCompanyId || '');
            localStorage.setItem(AUTH_CONFIG.ROLE_KEY, userRole);

            console.log('Logged in as:', currentUser.email, userRole, currentCompanyId);

            // Redirect ONLY if not already on correct page
            if (userRole === 'manager' && !window.location.pathname.includes('manager.html')) {
                console.log('Redirecting manager to manager.html');
                window.location.href = 'manager.html';
            } else if (userRole !== 'manager' && !window.location.pathname.includes('index.html')) {
                console.log('Redirecting employee to index.html');
                window.location.href = 'index.html';
            }

        } else {
            clearAuth();
            // Only redirect if not already on auth page
            if (!isAuthPage) {
                console.log('No session - redirecting to login');
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
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        console.log('Login success:', data.user.email);
        return { success: true, user: data.user };
    } catch (err) {
        console.error('Login failed:', err.message);
        return { success: false, error: err.message };
    }
}

// Register manager
async function registerManager(email, password, companyName) {
    if (!supabase) throw new Error('Supabase not ready');

    try {
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { role: 'manager' } }
        });

        if (signUpError) throw signUpError;
        if (!authData.user) throw new Error('No user created');

        await new Promise(r => setTimeout(r, 2000));

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

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
                company_id: company.id,
                role: 'manager',
                name: 'Manager'
            })
            .eq('id', authData.user.id);

        if (updateError) throw updateError;

        await supabase.auth.signInWithPassword({ email, password });

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

setTimeout(initializeAuth, 1000);

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
