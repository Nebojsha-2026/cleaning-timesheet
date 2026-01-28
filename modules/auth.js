// auth.js - Complete working version with test page support
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
        console.log('Supabase initialized');
    } else {
        console.error('Supabase not loaded');
    }
}

initSupabase();

// Check if current page is a test page
function isTestPage() {
    return window.location.pathname.includes('test-registration.html') ||
           window.location.pathname.includes('test-registration2.html');
}

// Initialize auth state
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

    // Check current session first
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        console.log('Found existing session');
        await handleUserSession(session.user);
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth event:', event, session ? 'has session' : 'no session');

        // Skip on test pages
        if (isTestPage()) return;

        if (session?.user) {
            await handleUserSession(session.user);
        } else {
            clearAuth();
            // Only redirect if not on auth page
            const isAuthPage = window.location.pathname.includes('login.html') || 
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

    // Load profile from profiles table
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('company_id, role, name')
        .eq('id', currentUser.id)
        .single();

    if (error) {
        console.warn('Profile load error:', error.message);
        
        // If profile doesn't exist, create a basic one
        if (error.code === 'PGRST116') {
            console.log('Creating basic profile for user');
            const { error: createError } = await supabase
                .from('profiles')
                .insert([{
                    id: currentUser.id,
                    role: 'employee',
                    name: currentUser.email.split('@')[0]
                }]);
            
            if (createError) {
                console.error('Failed to create profile:', createError);
            } else {
                userRole = 'employee';
                console.log('Basic profile created');
            }
        }
    } else if (profile) {
        currentCompanyId = profile.company_id;
        userRole = profile.role || 'employee';
        console.log('✅ Loaded profile - Role:', userRole, 'Company:', currentCompanyId);
    }

    localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, currentToken || '');
    localStorage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify(currentUser));
    localStorage.setItem(AUTH_CONFIG.COMPANY_KEY, currentCompanyId || '');
    localStorage.setItem(AUTH_CONFIG.ROLE_KEY, userRole || 'employee');

    console.log('User session handled:', currentUser.email, 'Role:', userRole, 'Company:', currentCompanyId);

    // Redirect based on role
    await redirectBasedOnRole();
}

async function redirectBasedOnRole() {
    // Skip on test pages
    if (isTestPage()) return;

    const role = localStorage.getItem(AUTH_CONFIG.ROLE_KEY) || 'employee';
    const currentPath = window.location.pathname;
    
    console.log('🔀 Redirect check - Current role:', role, 'Current path:', currentPath);
    
    // Don't redirect if already on correct page
    if (role === 'manager' && !currentPath.includes('manager.html')) {
        console.log('Redirecting manager to manager.html');
        window.location.href = 'manager.html';
    } else if (role !== 'manager' && !currentPath.includes('employee.html')) {
        console.log('Redirecting employee to employee.html');
        window.location.href = 'employee.html';
    }
}

// Login function
async function login(email, password) {
    if (!supabase) {
        console.error('Supabase not initialized');
        return { success: false, error: 'System not ready' };
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ 
            email: email.trim(), 
            password: password 
        });
        
        if (error) {
            console.error('Login error:', error.message);
            return { success: false, error: error.message };
        }

        if (!data.user) {
            return { success: false, error: 'No user data returned' };
        }

        console.log('✅ Login successful for:', data.user.email);
        return { success: true, user: data.user };

    } catch (err) {
        console.error('Login exception:', err);
        return { success: false, error: err.message || 'Login failed' };
    }
}

// Register manager - SIMPLIFIED AND WORKING VERSION
async function registerManager(email, password, companyName) {
    if (!supabase) {
        return { success: false, error: 'Supabase not initialized' };
    }

    try {
        console.log('🚀 Starting manager registration for:', email);
        
        // STEP 1: Sign up the user
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email: email.trim(),
            password: password,
            options: {
                data: {
                    role: 'manager'
                }
            }
        });

        if (signUpError) {
            console.error('❌ Signup error:', signUpError.message);
            return { success: false, error: signUpError.message };
        }

        if (!authData.user) {
            return { success: false, error: 'No user created' };
        }

        console.log('✅ User created:', authData.user.id);

        // Wait for the trigger to create basic profile
        await new Promise(resolve => setTimeout(resolve, 1500));

        // STEP 2: Create company
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

        // STEP 3: Update profile with company and manager role
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
            
            // Clean up - delete company
            await supabase.from('companies').delete().eq('id', company.id);
            return { success: false, error: 'Profile update failed: ' + profileError.message };
        }

        console.log('✅ Profile updated with manager role');

        // STEP 4: Create staff record for the manager
        const { error: staffError } = await supabase
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

        if (staffError) {
            console.warn('⚠️ Staff record creation warning:', staffError.message);
            // Continue anyway, staff record is optional
        } else {
            console.log('✅ Staff record created');
        }

        // STEP 5: Sign in the user
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });

        if (signInError) {
            console.error('⚠️ Auto sign-in error:', signInError.message);
            // Still return success, user can login manually
        } else {
            console.log('✅ Auto login successful');
        }

        // Force update localStorage immediately with manager role
        localStorage.setItem(AUTH_CONFIG.ROLE_KEY, 'manager');
        localStorage.setItem(AUTH_CONFIG.COMPANY_KEY, company.id);
        localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, (await supabase.auth.getSession()).data.session?.access_token || '');
        
        console.log('🎉 Registration complete - role set to manager in localStorage');

        return { 
            success: true, 
            user: authData.user, 
            company: company 
        };

    } catch (err) {
        console.error('❌ Registration exception:', err);
        return { success: false, error: err.message || 'Registration failed' };
    }
}

// Logout
async function logout() {
    if (supabase) {
        await supabase.auth.signOut();
    }
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

// Export functions to window
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
