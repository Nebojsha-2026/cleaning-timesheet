// modules/auth.js - Role-safe auth + RPC-based manager bootstrap
console.log('🔐 Auth module loading...');

const AUTH_CONFIG = {
    TOKEN_KEY: 'cleaning_timesheet_token',
    USER_KEY: 'cleaning_timesheet_user',
    COMPANY_KEY: 'cleaning_timesheet_company_id',
    ROLE_KEY: 'cleaning_timesheet_role'
};

let currentUser = null;
let currentToken = null;
let currentCompanyId = null;
let userRole = null;
let supabase = null;

function initSupabase() {
    if (window.supabase && window.supabase.createClient) {
        supabase = window.supabase.createClient(
            'https://hqmtigcjyqckqdzepcdu.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw'
        );
        window.supabaseClient = supabase;
        console.log('✅ Supabase initialized');
    } else {
        console.error('❌ Supabase library not loaded');
    }
}

initSupabase();

function isTestPage() {
    const p = window.location.pathname || '';
    return p.includes('test-registration.html') || p.includes('test-registration2.html');
}

function isAuthPage() {
    const p = window.location.pathname || '';
    return p.includes('login.html') || p.includes('register.html') || p.includes('forgot-password.html');
}

function isDashboardPage() {
    const p = window.location.pathname || '';
    return p.includes('manager.html') || p.includes('employee.html');
}

async function initializeAuth() {
    if (!supabase) return;

    if (isTestPage()) {
        console.log('🧪 Test page detected - skipping auth initialization');
        return;
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
            console.log('✅ Found existing session');
            await handleUserSession(session.user);
        } else {
            if (isDashboardPage()) {
                window.location.href = 'login.html';
            }
        }

        supabase.auth.onAuthStateChange(async (event, session2) => {
            console.log('Auth event:', event, session2 ? 'has session' : 'no session');

            if (isTestPage()) return;

            if (session2?.user) {
                await handleUserSession(session2.user);
            } else {
                clearAuth();
                if (isDashboardPage() && !window.location.pathname.includes('invite-accept.html')) {
                    window.location.href = 'login.html';
                }
            }
        });
    } catch (e) {
        console.error('❌ initializeAuth exception:', e);
    }
}

async function handleUserSession(user) {
    currentUser = user;

    const sessionResp = await supabase.auth.getSession();
    currentToken = sessionResp?.data?.session?.access_token || null;

    const metadata = currentUser.user_metadata || {};
    const metaRole = (metadata.role || '').toLowerCase();
    const metaCompanyId = metadata.company_id || null;

    // Profiles
    let profile = null;
    const { data: profileData } = await supabase
        .from('profiles')
        .select('company_id, role, name')
        .eq('id', currentUser.id)
        .maybeSingle();

    if (profileData) profile = profileData;

    // Staff (optional)
    let staff = null;
    const { data: staffData } = await supabase
        .from('staff')
        .select('company_id, role')
        .eq('user_id', currentUser.id)
        .maybeSingle();

    if (staffData) staff = staffData;

    const profileRole = (profile?.role || '').toLowerCase();
    const staffRole = (staff?.role || '').toLowerCase();

    // Prefer manager if metadata says manager
    let resolvedRole = 'employee';
    if (metaRole === 'manager') resolvedRole = 'manager';
    else if (profileRole) resolvedRole = profileRole;
    else if (staffRole) resolvedRole = staffRole;

    let resolvedCompanyId = profile?.company_id || metaCompanyId || staff?.company_id || null;

    userRole = resolvedRole;
    currentCompanyId = resolvedCompanyId;

    // Ensure profile exists (no forced downgrade)
    if (!profile) {
        const nameGuess = (currentUser.email || '').split('@')[0] || 'User';
        const insertPayload = { id: currentUser.id, role: userRole, name: nameGuess };
        if (currentCompanyId) insertPayload.company_id = currentCompanyId;

        const { error: createError } = await supabase.from('profiles').insert([insertPayload]);
        if (createError) console.warn('Profile create warning:', createError.message);
    } else {
        const updates = {};
        if ((!profileRole && userRole) || (userRole === 'manager' && profileRole !== 'manager')) {
            updates.role = userRole;
        }
        if (!profile.company_id && currentCompanyId) updates.company_id = currentCompanyId;

        if (Object.keys(updates).length > 0) {
            updates.updated_at = new Date().toISOString();
            const { error: updErr } = await supabase.from('profiles').update(updates).eq('id', currentUser.id);
            if (updErr) console.warn('Profile update warning:', updErr.message);
        }
    }

    // Persist
    localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, currentToken || '');
    localStorage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify(currentUser));
    localStorage.setItem(AUTH_CONFIG.COMPANY_KEY, currentCompanyId || '');
    localStorage.setItem(AUTH_CONFIG.ROLE_KEY, userRole || 'employee');

    console.log('✅ Session handled:', currentUser.email, 'Role:', userRole, 'Company:', currentCompanyId);

    await redirectBasedOnRole();
}

async function redirectBasedOnRole() {
    if (isTestPage()) return;

    const role = localStorage.getItem(AUTH_CONFIG.ROLE_KEY) || 'employee';
    const currentPath = window.location.pathname || '';

    const hasToken = !!localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
    if (isAuthPage() && !hasToken) return;

    console.log('🔀 Redirect check - role:', role, 'path:', currentPath);

    if (role === 'manager') {
        if (!currentPath.includes('manager.html')) window.location.href = 'manager.html';
    } else {
        if (!currentPath.includes('employee.html')) window.location.href = 'employee.html';
    }
}

async function login(email, password) {
    if (!supabase) return { success: false, error: 'System not ready' };

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password
        });

        if (error) return { success: false, error: error.message };
        if (!data.user) return { success: false, error: 'No user data returned' };

        await handleUserSession(data.user);
        return { success: true, user: data.user };
    } catch (err) {
        return { success: false, error: err.message || 'Login failed' };
    }
}

// ✅ Manager registration now uses RPC bootstrap (solves your RLS insert failure)
async function registerManager(email, password, companyName) {
    if (!supabase) return { success: false, error: 'Supabase not initialized' };

    try {
        // 1) Sign up (role in metadata)
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { role: 'manager' } }
        });

        if (signUpError) return { success: false, error: signUpError.message };
        if (!authData.user) return { success: false, error: 'No user created' };

        // 2) Ensure session exists
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password
            });
            if (signInError) return { success: false, error: 'Unable to start session after sign-up' };
        }

        // 3) Bootstrap company/profile/staff via RPC (bypasses RLS reliably)
        const { data: companyId, error: rpcError } = await supabase.rpc('bootstrap_manager_company', {
            company_name: companyName.trim()
        });

        if (rpcError) return { success: false, error: 'Bootstrap failed: ' + rpcError.message };
        if (!companyId) return { success: false, error: 'Bootstrap failed: no company id returned' };

        // 4) Store company in metadata (nice-to-have)
        const { error: metadataError } = await supabase.auth.updateUser({
            data: { role: 'manager', company_id: companyId }
        });
        if (metadataError) console.warn('Metadata update warning:', metadataError.message);

        // 5) Force localStorage and finalize
        localStorage.setItem(AUTH_CONFIG.ROLE_KEY, 'manager');
        localStorage.setItem(AUTH_CONFIG.COMPANY_KEY, companyId);

        await handleUserSession(authData.user);

        return { success: true, user: authData.user, company: { id: companyId } };
    } catch (err) {
        return { success: false, error: err.message || 'Registration failed' };
    }
}

async function logout() {
    try {
        if (supabase) await supabase.auth.signOut();
    } catch (e) {
        console.warn('Logout warning:', e);
    }
    clearAuth();
    window.location.href = 'login.html';
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

setTimeout(initializeAuth, 300);

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
