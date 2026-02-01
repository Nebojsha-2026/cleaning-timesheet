// modules/auth.js
console.log('🔐 Auth module loading...');

const STORAGE = {
  TOKEN: 'cleaning_timesheet_token',
  USER: 'cleaning_timesheet_user',
  ROLE: 'cleaning_timesheet_role',
  COMPANY: 'cleaning_timesheet_company_id',
};

let supabaseClient = null;

function ensureClient() {
  // Reuse existing global client (prevents multiple instances)
  if (window.supabaseClient && window.supabaseClient.auth) {
    supabaseClient = window.supabaseClient;
    return true;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('❌ Supabase library not loaded. Check supabase.min.js script tag.');
    return false;
  }

  const cfg = window.CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_KEY) {
    console.error('❌ Missing window.CONFIG.SUPABASE_URL or window.CONFIG.SUPABASE_KEY');
    return false;
  }

  window.supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);
  supabaseClient = window.supabaseClient;
  return true;
}

function clearAuthStorage() {
  try {
    localStorage.removeItem(STORAGE.TOKEN);
    localStorage.removeItem(STORAGE.USER);
    localStorage.removeItem(STORAGE.ROLE);
    localStorage.removeItem(STORAGE.COMPANY);
  } catch {}
}

async function fetchProfile(userId) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('company_id, role')
    .eq('id', userId)
    .single();

  if (error) {
    console.warn('Profile fetch failed:', error.message);
    return null;
  }
  return data;
}

// Cache-only: keeps role/company/token convenient for legacy code,
// but the *truth* is always the current supabase session.
async function persistSession(session) {
  if (!session?.user) return { role: 'employee', companyId: null, token: '' };

  const user = session.user;
  const profile = await fetchProfile(user.id);

  const role = profile?.role || 'employee';
  const companyId = profile?.company_id || null;
  const token = session.access_token || '';

  try {
    localStorage.setItem(STORAGE.TOKEN, token);
    localStorage.setItem(STORAGE.USER, JSON.stringify({ id: user.id, email: user.email }));
    localStorage.setItem(STORAGE.ROLE, role);

    if (companyId) localStorage.setItem(STORAGE.COMPANY, companyId);
    else localStorage.removeItem(STORAGE.COMPANY);
  } catch {}

  return { role, companyId, token };
}

function isAuthPage() {
  const p = (window.location.pathname || '').toLowerCase();
  return p.includes('login.html') || p.includes('register.html') || p.includes('forgot-password.html');
}

function isInviteAcceptPage() {
  return ((window.location.pathname || '').toLowerCase().includes('invite-accept.html'));
}

async function getLiveSession() {
  if (!ensureClient() || !supabaseClient?.auth) return null;
  const { data } = await supabaseClient.auth.getSession();
  return data?.session || null;
}

async function initializeAuth() {
  try {
    if (!ensureClient() || !supabaseClient?.auth) return;

    // If we JUST logged out, force signed-out state and prevent redirect loops
    if (sessionStorage.getItem('just_logged_out') === '1') {
      sessionStorage.removeItem('just_logged_out');
      try { await supabaseClient.auth.signOut(); } catch {}
      clearAuthStorage();
      return;
    }

    const session = await getLiveSession();

    if (session?.user) {
      const meta = await persistSession(session);

      // If on login/register and already logged in, redirect
      if (isAuthPage() && !isInviteAcceptPage()) {
        window.location.href = (meta.role === 'manager') ? 'manager.html' : 'employee.html';
        return;
      }
    }

    // Keep cache in sync with auth changes
    supabaseClient.auth.onAuthStateChange(async (event, nextSession) => {
      if (sessionStorage.getItem('just_logged_out') === '1') return;

      if (nextSession?.user) {
        const meta = await persistSession(nextSession);

        if (isAuthPage() && !isInviteAcceptPage()) {
          window.location.href = (meta.role === 'manager') ? 'manager.html' : 'employee.html';
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

// Login must return {success:true/false} because login.html expects it
async function login(email, password) {
  try {
    if (!ensureClient() || !supabaseClient?.auth) return { success: false, error: 'Supabase client not ready' };

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };

    const session = await getLiveSession();
    const meta = await persistSession(session);

    return { success: true, user: data.user, ...meta };
  } catch (e) {
    return { success: false, error: e.message || 'Login failed' };
  }
}

async function logout() {
  sessionStorage.setItem('just_logged_out', '1');

  try {
    if (ensureClient() && supabaseClient?.auth) await supabaseClient.auth.signOut();
  } catch (e) {
    console.warn('signOut error:', e?.message || e);
  }

  clearAuthStorage();
  window.location.href = 'login.html';
}

async function protectRoute(requiredRole = null) {
  if (!ensureClient() || !supabaseClient?.auth) {
    window.location.href = 'login.html';
    return false;
  }

  const session = await getLiveSession();

  // ✅ Truth: live session
  if (!session?.user) {
    clearAuthStorage();
    window.location.href = 'login.html';
    return false;
  }

  const meta = await persistSession(session);

  if (requiredRole && meta.role !== requiredRole) {
    window.location.href = (meta.role === 'manager') ? 'manager.html' : 'employee.html';
    return false;
  }

  return true;
}

ensureClient();
initializeAuth();

console.log('✅ Auth module loaded');

window.auth = {
  login,
  logout,
  protectRoute,
  initializeAuth,
};
