// modules/auth.js
console.log('🔐 Auth module loading...');

/**
 * IMPORTANT NOTES
 * - On GitHub Pages, supabase-js UMD exposes window.supabase (library), NOT a client.
 * - We must call window.supabase.createClient(URL, KEY) to get a client with .auth
 * - login.html currently does NOT load script.js, so we must provide config fallback here.
 */

// ✅ Use the SAME localStorage keys your login.html already checks
const STORAGE = {
  TOKEN: 'cleaning_timesheet_token',
  USER: 'cleaning_timesheet_user',
  ROLE: 'cleaning_timesheet_role',
  COMPANY: 'cleaning_timesheet_company_id',
};

// ✅ Fallback config (matches your script.js)
const FALLBACK_CONFIG = {
  SUPABASE_URL: 'https://hqmtigcjyqckqdzepcdu.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw',
};

let supabaseClient = null;

function getConfig() {
  // If script.js is loaded, it defines CONFIG (global). Sometimes you also have window.CONFIG.
  const cfg = window.CONFIG || (typeof CONFIG !== 'undefined' ? CONFIG : null);
  return {
    SUPABASE_URL: cfg?.SUPABASE_URL || FALLBACK_CONFIG.SUPABASE_URL,
    SUPABASE_KEY: cfg?.SUPABASE_KEY || FALLBACK_CONFIG.SUPABASE_KEY,
  };
}

function initSupabaseClient() {
  // If another file already created the client, reuse it
  if (window.supabaseClient && window.supabaseClient.auth) {
    supabaseClient = window.supabaseClient;
    console.log('✅ Supabase client reused (window.supabaseClient)');
    return;
  }

  // UMD library should exist as window.supabase with createClient
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('❌ Supabase library not loaded. Check supabase.min.js script tag.');
    return;
  }

  const { SUPABASE_URL, SUPABASE_KEY } = getConfig();

  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  supabaseClient = window.supabaseClient;

  console.log('✅ Supabase client initialized');
}

initSupabaseClient();

function clearAuthStorage() {
  localStorage.removeItem(STORAGE.TOKEN);
  localStorage.removeItem(STORAGE.USER);
  localStorage.removeItem(STORAGE.ROLE);
  localStorage.removeItem(STORAGE.COMPANY);
}

async function fetchProfileAndPersist(user) {
  if (!supabaseClient?.auth) throw new Error('Supabase client not ready');

  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single();

  if (error) {
    console.warn('Profile fetch failed:', error.message);
  }

  const role = profile?.role || 'employee';
  const companyId = profile?.company_id || null;

  // Store tokens & user
  const { data: { session } } = await supabaseClient.auth.getSession();
  const token = session?.access_token || '';

  localStorage.setItem(STORAGE.TOKEN, token);
  localStorage.setItem(STORAGE.USER, JSON.stringify({ id: user.id, email: user.email }));
  localStorage.setItem(STORAGE.ROLE, role);
  if (companyId) localStorage.setItem(STORAGE.COMPANY, companyId);

  console.log(`✅ Session handled: ${user.email} Role: ${role} Company: ${companyId}`);

  return { role, companyId, token };
}

function isAuthPage() {
  const p = window.location.pathname.toLowerCase();
  return p.includes('login.html') || p.includes('register.html') || p.includes('forgot-password.html');
}

function isInviteAcceptPage() {
  return window.location.pathname.toLowerCase().includes('invite-accept.html');
}

async function initializeAuth() {
  try {
    if (!supabaseClient?.auth) {
      console.error('❌ Supabase client not ready in initializeAuth');
      return;
    }

    // If user just logged out in this tab, block any racey auto re-login for this load
    if (sessionStorage.getItem('just_logged_out') === '1') {
      console.log('🧹 just_logged_out present: ensuring signed-out state');
      sessionStorage.removeItem('just_logged_out');
      try { await supabaseClient.auth.signOut(); } catch (_) {}
      clearAuthStorage();
      return;
    }

    // Check session
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
      await fetchProfileAndPersist(session.user);

      // Redirect away from login/register
      if (isAuthPage() && !isInviteAcceptPage()) {
        const role = localStorage.getItem(STORAGE.ROLE) || 'employee';
        window.location.href = (role === 'manager') ? 'manager.html' : 'employee.html';
        return;
      }
    }

    // Listen for auth changes
    supabaseClient.auth.onAuthStateChange(async (event, session2) => {
      console.log('Auth event:', event, session2 ? 'has session' : 'no session');

      if (sessionStorage.getItem('just_logged_out') === '1') {
        console.log('⛔ Ignoring auth event due to just_logged_out');
        return;
      }

      if (session2?.user) {
        await fetchProfileAndPersist(session2.user);

        if (isAuthPage() && !isInviteAcceptPage()) {
          const role = localStorage.getItem(STORAGE.ROLE) || 'employee';
          window.location.href = (role === 'manager') ? 'manager.html' : 'employee.html';
        }
      } else {
        clearAuthStorage();
        if (!isAuthPage() && !isInviteAcceptPage()) {
          window.location.href = 'login.html';
        }
      }
    });

  } catch (e) {
    console.error('initializeAuth error:', e);
  }
}

// Login
async function login(email, password) {
  if (!supabaseClient?.auth) throw new Error('Supabase client not ready');

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;

  await fetchProfileAndPersist(data.user);
  return data.user;
}

// Logout
async function logout() {
  sessionStorage.setItem('just_logged_out', '1');

  try {
    if (supabaseClient?.auth) await supabaseClient.auth.signOut();
  } catch (e) {
    console.warn('signOut error:', e?.message || e);
  }

  clearAuthStorage();
  window.location.href = 'login.html';
}

// Helpers
function isAuthenticated() {
  return !!localStorage.getItem(STORAGE.TOKEN);
}

function getUserRole() {
  return localStorage.getItem(STORAGE.ROLE) || 'employee';
}

function getCurrentCompanyId() {
  return localStorage.getItem(STORAGE.COMPANY) || null;
}

function protectRoute(requiredRole = null) {
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
    return false;
  }

  const role = getUserRole();
  if (requiredRole && role !== requiredRole) {
    window.location.href = (role === 'manager') ? 'manager.html' : 'employee.html';
    return false;
  }

  return true;
}

// Start auth initialization shortly after load
setTimeout(initializeAuth, 300);

console.log('✅ Auth module loaded');

window.auth = {
  login,
  logout,
  protectRoute,
  isAuthenticated,
  getUserRole,
  getCurrentCompanyId,
  initializeAuth,
};
