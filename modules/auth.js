// modules/auth.js - Fixed role detection + safer profile creation + RLS-friendly manager registration
console.log('🔐 Auth module loading...');

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

// Initialize Supabase
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

// Check if current page is a test page
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

// Initialize auth state
async function initializeAuth() {
    if (!supabase) {
        console.error('❌ Supabase not ready');
        return;
    }

    if (isTestPage()) {
        console.log('🧪 Test page detected - skipping auth initialization');
        return;
    }

    try {
        // Check current session first
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) console.warn('Session check warning:', error.message);

        if (session?.user) {
            console.log('✅ Found existing session');
            await handleUserSession(session.user);
        } else {
            // If on dashboard and no session -> login
            if (isDashboardPage()) {
                console.log('No session on dashboard - redirecting to login');
                window.location.href = 'login.html';
            }
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session2) => {
            console.log('Auth event:', event, session2 ? 'has session' : 'no session');

            if (isTestPage()) return;

            if (session2?.user) {
                await handleUserSession(session2.user);
            } else {
                clearAuth();

                // Only redirect away if on dashboard (auth pages should stay)
                if (isDashboardPage() && !window.location.pathname.includes('invite-accept.html')) {
                    console.log('No session - redirecting to login');
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

    // 1) Try load profile
    let profile = null;
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('company_id, role, name')
        .eq('id', currentUser.id)
        .single();

    if (profileError) {
        // Profile missing is common on fresh signups
        console.warn('Profile load warning:', profileError.message);
    } else {
        profile = profileData;
    }

    // 2) Try load staff row (helps employees)
    let staff = null;
    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('company_id, role')
        .eq('user_id', currentUser.id)
        .single();

    if (!staffError) staff = staffData;
    else console.warn('Staff lookup warning:', staffError.message);

    // 3) Resolve role with correct precedence (IMPORTANT)
    // Prefer manager if metadata says manager (prevents downgrade bug).
    // Otherwise prefer profile role, then staff role, else default employee.
    const profileRole = (profile?.role || '').toLowerCase();
    const staffRole = (staff?.role || '').toLowerCase();

    let resolvedRole = 'employee';
    if (metaRole === 'manager') resolvedRole = 'manager';
    else if (profileRole) resolvedRole = profileRole;
    else if (staffRole) resolvedRole = staffRole;

    // 4) Resolve company_id precedence
    let resolvedCompanyId = profile?.company_id || metaCompanyId || staff?.company_id || null;

    userRole = resolvedRole;
    currentCompanyId = resolvedCompanyId;

    // 5) Ensure profile exists (but do NOT force employee if we know it's manager)
    if (!profile) {
        const nameGuess = (currentUser.email || '').split('@')[0] || 'User';
        const insertPayload = {
            id: currentUser.id,
            role: userRole || 'employee',
            name: nameGuess
        };
        if (currentCompanyId) insertPayload.company_id = currentCompanyId;

        const { error: createError } = await supabase
            .from('profiles')
            .insert([insertPayload]);

        if (createError) {
            console.warn('Profile create warning:', createError.message);
        } else {
            console.log('✅ Profile created:', insertPayload);
        }
    } else {
        // 6) Sync profile if role/company is missing or wrong (no downgrades)
        const updates = {};
        if (userRole && profileRole !== userRole) {
            // Only upgrade to manager, or fix empty role
            if (!profileRole || userRole === 'manager') updates.role = userRole;
        }
        if (!profile?.company_id && currentCompanyId) updates.company_id = currentCompanyId;
        if (Object.keys(updates).length > 0) {
            updates.updated_at = new Date().toISOString();
            const { error: updErr } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', currentUser.id);
            if (updErr) console.warn('Profile update warning:', updErr.message);
        }
    }

    // 7) Persist to localStorage
    localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, currentToken || '');
    localStorage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify(currentUser));
    localStorage.setItem(AUTH_CONFIG.COMPANY_KEY, currentCompanyId || '');
    localStorage.setItem(AUTH_CONFIG.ROLE_KEY, userRole || 'employee');

    console.log('✅ Session handled:', currentUser.email, 'Role:', userRole, 'Company:', currentCompanyId);

    // 8) Redirect (only when role is known)
    await redirectBasedOnRole();
}

async function redirectBasedOnRole() {
    if (isTestPage()) return;

    const role = localStorage.getItem(AUTH_CONFIG.ROLE_KEY) || 'employee';
    const currentPath = window.location.pathname || '';

    // Don’t auto-redirect while still on auth pages unless user is logged in
    // (we consider "logged in" = token exists)
    const hasToken = !!localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
    if (isAuthPage() && !hasToken) return;

    console.log('🔀 Redirect check - role:', role, 'path:', currentPath);

    if (role === 'manager') {
        if (!currentPath.includes('manager.html')) window.location.href = 'manager.html';
    } else {
        if (!currentPath.includes('employee.html')) window.location.href = 'employee.html';
    }
}

async function ensureManagerProfile(user, displayName) {
    const name = displayName || (user.email || '').split('@')[0] || 'Manager';
    const { error } = await supabase
        .from('profiles')
        .upsert([{
            id: user.id,
            role: 'manager',
            name
        }], { onConflict: 'id' });

    if (error) {
        console.error('❌ Profile upsert error:', error.message);
        return { success: false, error };
    }
    return { success: true };
}

// Login function
async function login(email, password) {
    if (!supabase) return { success: false, error: 'System not ready' };

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password
        });

        if (error) return { success: false, error: error.message };
        if (!data.user) return { success: false, error: 'No user data returned' };

        console.log('✅ Login successful:', data.user.email);
        await handleUserSession(data.user);
        return { success: true, user: data.user };
    } catch (err) {
        console.error('Login exception:', err);
        return { success: false, error: err.message || 'Login failed' };
    }
}

// Register manager
async function registerManager(email, password, companyName) {
    if (!supabase) return { success: false, error: 'Supabase not initialized' };

    try {
        console.log('🚀 Starting manager registration for:', email);

        // STEP 1: Sign up
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
                data: { role: 'manager' }
            }
        });

        if (signUpError) return { success: false, error: signUpError.message };
        if (!authData.user) return { success: false, error: 'No user created' };

        console.log('✅ User created:', authData.user.id);

        // STEP 2: Ensure session
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password
            });
            if (signInError) {
                return { success: false, error: 'Unable to start session after sign-up' };
            }
        }

        // STEP 3: Ensure profile is manager BEFORE company insert
        const profileResult = await ensureManagerProfile(authData.user, 'Manager');
        if (!profileResult.success) {
            return { success: false, error: 'Profile setup failed: ' + profileResult.error.message };
        }

        // STEP 4: Create company (REQUIRES RLS INSERT POLICY)
        const { data: company, error: companyError } = await supabase
            .from('companies')
            .insert([{
                name: companyName.trim(),
                custom_title: companyName.trim() + ' Timesheet',
                primary_color: '#667eea',
                secondary_color: '#764ba2',
                default_pay_frequency: 'weekly'
            }])
            .select()
            .single();

        if (companyError) {
            console.error('❌ Company creation error:', companyError.message);
            return { success: false, error: 'Company creation failed: ' + companyError.message };
        }

        console.log('✅ Company created:', company.id);

        // STEP 5: Attach company_id to user metadata (nice-to-have)
        const { error: metadataError } = await supabase.auth.updateUser({
            data: { role: 'manager', company_id: company.id }
        });
        if (metadataError) console.warn('Metadata update warning:', metadataError.message);

        // STEP 6: Update profile with company + manager role
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                company_id: company.id,
                role: 'manager',
                name: 'Manager',
                updated_at: new Date().toISOString()
            })
            .eq('id', authData.user.id);

        if (profileError) {
            console.error('❌ Profile update error:', profileError.message);
            // Cleanup company if desired:
            // await supabase.from('companies').delete().eq('id', company.id);
            return { success: false, error: 'Profile update failed: ' + profileError.message };
        }

        // STEP 7: Create staff row for manager (optional)
        const { error: staffErr } = await supabase
            .from('staff')
            .insert([{
                user_id: authData.user.id,
                company_id: company.id,
                name: 'Manager',
                email: email.trim(),
                role: 'manager',
                hourly_rate: 23.00,
                is_active: true
            }]);

        if (staffErr) console.warn('Staff create warning:', staffErr.message);
        else console.log('✅ Staff record created');

        // STEP 8: Force localStorage values immediately
        const sessionNow = await supabase.auth.getSession();
        localStorage.setItem(AUTH_CONFIG.ROLE_KEY, 'manager');
        localStorage.setItem(AUTH_CONFIG.COMPANY_KEY, company.id);
        localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, sessionNow?.data?.session?.access_token || '');

        // STEP 9: Finalize session + redirect
        await handleUserSession(authData.user);

        return { success: true, user: authData.user, company };
    } catch (err) {
        console.error('❌ Registration exception:', err);
        return { success: false, error: err.message || 'Registration failed' };
    }
}

// Logout
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
    // safer than localStorage.clear() (doesn't wipe unrelated keys)
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

// Init auth after short delay
setTimeout(initializeAuth, 500);

console.log('✅ Auth module loaded');

// Export
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
