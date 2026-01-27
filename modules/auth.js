// auth.js - Fixed role & company linking

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

function initSupabase() {
    if (window.supabase && window.supabase.createClient) {
        supabase = window.supabase.createClient(
            'https://hqmtigcjyqckqdzepcdu.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw'
        );
        window.supabaseClient = supabase;
        console.log('Supabase initialized');
    }
}

initSupabase();

async function initializeAuth() {
    if (!supabase) return;

    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth event:', event);

        if (session?.user) {
            currentUser = session.user;
            currentToken = session.access_token;

            // Get or create profile
            let { data: profile, error } = await supabase
                .from('profiles')
                .select('company_id, role')
                .eq('id', currentUser.id)
                .single();

            if (error && error.code === 'PGRST116') {
                // No profile – create default
                const { data: newProfile, error: insertError } = await supabase
                    .from('profiles')
                    .insert([{ id: currentUser.id, role: 'employee' }])
                    .select()
                    .single();

                if (insertError) {
                    console.error('Create profile failed:', insertError);
                } else {
                    profile = newProfile;
                }
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

            // Redirect
            if (userRole === 'manager') {
                window.location.href = 'manager.html';
            } else {
                window.location.href = 'index.html';
            }

        } else {
            clearAuth();
            if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
                window.location.href = 'login.html';
            }
        }
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (session) supabase.auth.setSession(session);
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

// Register manager – force manager role + company link
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

        // Wait longer for trigger
        await new Promise(r => setTimeout(r, 3000));

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

        // Update profile – retry if needed
        let updateSuccess = false;
        for (let i = 0; i < 3; i++) {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ 
                    company_id: company.id,
                    role: 'manager',
                    name: 'Manager'
                })
                .eq('id', authData.user.id);

            if (!updateError) {
                updateSuccess = true;
                break;
            }
            await new Promise(r => setTimeout(r, 1000)); // retry delay
        }

        if (!updateSuccess) throw new Error('Failed to update profile to manager');

        // Auto sign-in
        await supabase.auth.signInWithPassword({ email, password });

        console.log('Manager registered & logged in:', email, company.name);
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
