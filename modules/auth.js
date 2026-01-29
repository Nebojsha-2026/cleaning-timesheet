// modules/auth.js
console.log('🔐 Auth module loading...');

const STORAGE = {
  TOKEN: 'cleaning_timesheet_token',
  USER: 'cleaning_timesheet_user',
  ROLE: 'cleaning_timesheet_role',
  COMPANY: 'cleaning_timesheet_company_id',
};

const SUPABASE_FALLBACK = {
  URL: 'https://hqmtigcjyqckqdzepcdu.supabase.co',
  KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw',
};

let supabaseClient = null;

function ensureClient() {
  // Reuse existing global client (prevents Multiple GoTrueClient instances)
  if (window.supabaseClient && window.supabaseClient.auth) {
    supabaseClient = window.supabaseClient;
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('❌ Supabase library not loaded. Check supabase.min.js script tag.');
    return;
  }

  const cfg = window.CONFIG || {};
  const url = cfg.SUPABASE_URL || SUPABASE_FALLBACK.URL;
  const key = cfg.SUPABASE_KEY || SUPABASE_FALLBACK.KEY;

  window.supabaseClient = window.supabase.createClient(url, key);
  supabaseClient = window.supabaseClient;
}

function clearAuthStorage() {
  localStorage.removeItem(STORAGE.TOKEN);
  localStorage.removeItem(STORAGE.USER);
  localStorage.removeItem(STORAGE.ROLE);
  localStorage.removeItem(STORAGE.COMPANY);
}

async function persistSession(user) {
  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single();

  // Profile might not exist briefly – don’t hard-fail
  if (error) console.warn('Profile fetch failed:', error.message);

  const role = profile?.role || 'employee';
  const companyId = profile?.company_id || null;

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
    ensureClient();
    if (!supabaseClient?.auth) return;

    // If we JUST logged out, force-clean the session and stop any auto-redirect
    if (sessionStorage.getItem('just_logged_out') === '1') {
      console.log('🧹 just_logged_out present: ensuring signed-out state');
      sessionStorage.removeItem('just_logged_out');
      try { await supabaseClient.auth.signOut(); } catch (_) {}
      clearAuthStorage();
      return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
      await persistSession(session.user);

      if (isAuthPage() && !isInviteAcceptPage()) {
        const role = localStorage.getItem(STORAGE.ROLE) || 'employee';
        window.location.href = (role === 'manager') ? 'manager.html' : 'employee.html';
        return;
      }
    }

    supabaseClient.auth.onAuthStateChange(async (event, session2) => {
      console.log('Auth event:', event, session2 ? 'has session' : 'no session');

      if (sessionStorage.getItem('just_logged_out') === '1') {
        console.log('⛔ Ignoring auth event due to just_logged_out');
        return;
      }

      if (session2?.user) {
        await persistSession(session2.user);

        if (isAuthPage() && !isInviteAcceptPage()) {
          const role = localStorage.getItem(STORAGE.ROLE) || 'employee';
          window.location.href = (role === 'manager') ? 'manager.html' : 'employee.html';
        }
      } else {
        clearAuthStorage();
        if (!isAuthPage() && !isInviteAcceptPage()) window.location.href = 'login.html';
      }
    });

  } catch (e) {
    console.error('initializeAuth error:', e);
  }
}

// ✅ Login must return {success:true/false} because login.html expects it
async function login(email, password) {
  try {
    ensureClient();
    if (!supabaseClient?.auth) return { success: false, error: 'Supabase client not ready' };

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };

    const meta = await persistSession(data.user);
    return { success: true, user: data.user, ...meta };
  } catch (e) {
    return { success: false, error: e.message || 'Login failed' };
  }
}

async function logout() {
  sessionStorage.setItem('just_logged_out', '1');
  try {
    ensureClient();
    if (supabaseClient?.auth) await supabaseClient.auth.signOut();
  } catch (e) {
    console.warn('signOut error:', e?.message || e);
  }

  clearAuthStorage();
  window.location.href = 'login.html';
}

function protectRoute(requiredRole = null) {
  const token = localStorage.getItem(STORAGE.TOKEN);
  if (!token) {
    window.location.href = 'login.html';
    return false;
  }

  const role = localStorage.getItem(STORAGE.ROLE) || 'employee';
  if (requiredRole && role !== requiredRole) {
    window.location.href = (role === 'manager') ? 'manager.html' : 'employee.html';
    return false;
  }
  return true;
}

ensureClient();
setTimeout(initializeAuth, 200);

console.log('✅ Auth module loaded');

window.auth = {
  login,
  logout,
  protectRoute,
  initializeAuth,
};
