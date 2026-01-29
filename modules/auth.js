// modules/auth.js
console.log('🔐 Auth module loading...');

// Config
const AUTH_CONFIG = {
    TOKEN_KEY: 'auth_token',
    USER_KEY: 'auth_user',
    ROLE_KEY: 'user_role',
    COMPANY_KEY: 'company_id'
};

let supabase = null;
let currentUser = null;
let currentToken = null;
let currentCompanyId = null;
let userRole = null;

function isTestPage() {
    const p = window.location.pathname.toLowerCase();
    return p.includes('test-registration') || p.includes('test-');
}

// Init Supabase from global config (script.js sets CONFIG)
function initSupabase() {
    try {
        if (window.supabase && typeof window.supabase.from === 'function') {
            // already created in script.js
            supabase = window.supabase;
            console.log('✅ Supabase already initialized (script.js)');
            return;
        }

        if (!window.supabaseClient && window.CONFIG?.SUPABASE_URL && window.CONFIG?.SUPABASE_KEY) {
            window.supabaseClient = window.supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_KEY);
        }
        supabase = window.supabaseClient || window.supabase;
        console.log('✅ Supabase initialized');
    } catch (e) {
        console.error('Supabase init failed:', e);
    }
}

initSupabase();

// Main initializer
async function initializeAuth() {
    if (!supabase) {
        console.error('Supabase not ready');
        return;
    }

    // Skip auth checks on test pages
    if (isTestPage()) {
        console.log('Test page detected - skipping auth initialization');
        return;
    }

    // ✅ If user just logged out in this tab, force sign-out and stop auto-login.
    if (sessionStorage.getItem('just_logged_out') === '1') {
        console.log('🧹 just_logged_out flag present - forcing signed-out state');
        sessionStorage.removeItem('just_logged_out');
        try { await supabase.auth.signOut(); } catch (_) {}
        clearAuth();
        // Do not proceed to handle session
    } else {
        // Check current session first
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            console.log('✅ Found existing session');
            await handleUserSession(session.user);
        }
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth event:', event, session ? 'has session' : 'no session');
        if (isTestPage()) return;

        // If logout was just triggered, ignore any session event race.
        if (sessionStorage.getItem('just_logged_out') === '1') {
            console.log('⛔ Ignoring auth event due to just_logged_out');
            return;
        }

        if (session?.user) {
            await handleUserSession(session.user);
        } else {
            clearAuth();
            const isAuthPage =
                window.location.pathname.includes('login.html') ||
                window.location.pathname.includes('register.html');

            if (!isAuthPage && !window.location.pathname.includes('invite-accept.html')) {
                console.log('No session - redirecting to login');
                window.location.href = 'login.html';
            }
        }
    });
}

async function handleUserSession(user) {
    currentUser = user;
    currentToken = (await supabase.auth.getSession()).data.session?.access_token || null;

    // Load profile (role + company)
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('company_id, role')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error('Profile fetch error:', error);
        // fallback
        userRole = 'employee';
        currentCompanyId = null;
    } else {
        userRole = profile?.role || 'employee';
        currentCompanyId = profile?.company_id || null;
    }

    // Persist
    localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, currentToken || '');
    localStorage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify({
        id: user.id,
        email: user.email
    }));
    localStorage.setItem(AUTH_CONFIG.ROLE_KEY, userRole);
    if (currentCompanyId) localStorage.setItem(AUTH_CONFIG.COMPANY_KEY, currentCompanyId);

    console.log(`✅ Session handled: ${user.email} Role: ${userRole} Company: ${currentCompanyId}`);

    // Redirect logic (skip if on invite accept)
    if (window.location.pathname.includes('invite-accept.html')) return;

    const path = window.location.pathname;
    const onLogin = path.includes('login.html');
    const onRegister = path.includes('register.html');

    // If user is on auth pages, redirect to their dashboard
    if (onLogin || onRegister) {
        window.location.href = (userRole === 'manager') ? 'manager.html' : 'employee.html';
        return;
    }

    // If user is on wrong dashboard, redirect
    if (path.includes('manager.html') && userRole !== 'manager') {
        window.location.href = 'employee.html';
        return;
    }
    if (path.includes('employee.html') && userRole === 'manager') {
        window.location.href = 'manager.html';
        return;
    }
}

// Login
async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await handleUserSession(data.user);
    return data.user;
}

// Register manager (kept as-is; your register flow already works)
async function registerManager(email, password, companyName) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { companyName } }
    });
    if (error) throw error;
    return data.user;
}

// Logout
async function logout() {
    // ✅ prevent auth listener race
    sessionStorage.setItem('just_logged_out', '1');

    try {
        if (supabase) await supabase.auth.signOut();
    } catch (e) {
        console.warn('signOut error:', e);
    }

    clearAuth();
    window.location.href = 'login.html';
}

function clearAuth() {
    // Do NOT nuke all storage across the app ecosystem; clear only our keys + safe clear.
    try {
        localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
        localStorage.removeItem(AUTH_CONFIG.USER_KEY);
        localStorage.removeItem(AUTH_CONFIG.ROLE_KEY);
        localStorage.removeItem(AUTH_CONFIG.COMPANY_KEY);
    } catch (_) {}

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
    return localStorage.getItem(AUTH_CONFIG.ROLE_KEY) || 'employee';
}

function protectRoute(requiredRole = null) {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }

    const role = getUserRole();
    if (requiredRole && role !== requiredRole) {
        window.location.href = role === 'manager' ? 'manager.html' : 'employee.html';
        return false;
    }

    return true;
}

// Initialize auth after a short delay
setTimeout(initializeAuth, 500);

console.log('✅ Auth module loaded');

window.auth = {
    login,
    registerManager,
    logout,
    isAuthenticated,
    getCurrentCompanyId,
    getUserRole,
    protectRoute,
    initializeAuth
};
