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
  KEY: 'PASTE_YOUR_KEY_HERE', // keep your correct key
};

let supabaseClient = null;

function ensureClient() {
  // Reuse existing global client
  if (window.supabaseClient && window.supabaseClient.auth) {
    supabaseClient = window.supabaseClient;
    return true;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('❌ Supabase library not loaded. Check supabase.min.js script tag.');
    return false;
  }

  const cfg = window.CONFIG || {};
  const url = cfg.SUPABASE_URL || SUPABASE_FALLBACK.URL;
  const key = cfg.SUPABASE_KEY || SUPABASE_FALLBACK.KEY;

  if (!url || !key) {
    console.error('❌ Missing window.CONFIG.SUPABASE_URL or window.CONFIG.SUPABASE_KEY');
    return false;
  }

  window.supabaseClient = window.supabase.createClient(url, key);
  supabaseClient = window.supabaseClient;
  return true;
}

function clearAuthStorage() {
  try {
    localStorage.removeItem(STORAGE.TOKEN);
    localStorage.removeItem(STORAGE.USER);
    localStorage.removeItem(STORAGE.ROLE);
    localStorage.removeItem(STORAGE.COMPANY);
  } catch (_) {}
}

async function persistSession(user, session) {
  ensureClient();
  if (!supabaseClient) throw new Error('Supabase client not ready');

  let sess = session;
  if (!sess) {
    const { data } = await supabaseClient.auth.getSession();
    sess = data?.session || null;
  }

  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single();

  if (error) console.warn('Profile fetch failed:', error.message);

  const role = profile?.role || 'employee';
  const companyId = profile?.company_id || null;
  const token = sess?.access_token || '';

  localStorage.setItem(STORAGE.TOKEN, token);
  localStorage.setItem(STORAGE.USER, JSON.stringify({ id: user.id, email: user.email }));
  localStorage.setItem(STORAGE.ROLE, role);

  if (companyId) localStorage.setItem(STORAGE.COMPANY, companyId);
  else localStorage.removeItem(STORAGE.COMPANY);

  console.log(`✅ Session handled: ${user.email} Role: ${role} Company: ${companyId}`);
  return { role, companyId, token };
}

function isAuthPage() {
  const p = (window.location.pathname || '').toLowerCase();
  return p.includes('login.html') || p.includes('register.html') || p.includes('forgot-password.html');
}

function isInviteAcceptPage() {
  return (window.location.pathname || '').toLowerCase().includes('invite-accept.html');
}

async function initializeAuth() {
  try {
    if (!ensureClient() || !supabaseClient?.auth) return;

    // If we JUST logged out, do not auto-redirect anywhere
    if (sessionStorage.getItem('just_logged_out') === '1') {
      console.log('🧹 just_logged_out present: forcing signed-out state');
      // Ensure any stale session is cleared
      try { await supabaseClient.auth.signOut({ scope: 'global' }); } catch (_) {}
      clearAuthStorage();
      return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session?.user) {
      await persistSession(session.user, session);

      if (isAuthPage() && !isInviteAcceptPage()) {
        const role = localStorage.getItem(STORAGE.ROLE) || 'employee';
        window.location.href = (role === 'manager') ? 'manager.html' : 'employee.html';
        return;
      }
    }

    supabaseClient.auth.onAuthStateChange(async (event, session2) => {
      // ignore auth events right after logout
      if (sessionStorage.getItem('just_logged_out') === '1') {
        console.log('⛔ Ignoring auth event due to just_logged_out');
        return;
      }

      if (session2?.user) {
        await persistSession(session2.user, session2);

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

async function login(email, password) {
  try {
    if (!ensureClient() || !supabaseClient?.auth) return { success: false, error: 'Supabase client not ready' };

    // clear "just logged out" flag on successful login attempt
    sessionStorage.removeItem('just_logged_out');

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };

    const meta = await persistSession(data.user, data.session);
    return { success: true, user: data.user, ...meta };
  } catch (e) {
    return { success: false, error: e.message || 'Login failed' };
  }
}

async function logout() {
  // mark immediately so any redirects/events won't bounce you back
  sessionStorage.setItem('just_logged_out', '1');

  // clear local cache immediately
  clearAuthStorage();

  // hard signout
  try {
    if (ensureClient() && supabaseClient?.auth) {
      await supabaseClient.auth.signOut({ scope: 'global' });
    }
  } catch (e) {
    console.warn('signOut error:', e?.message || e);
  }

  // go to login with explicit flag
  window.location.href = 'login.html?logged_out=1';
}

async function protectRoute(requiredRole = null) {
  if (!ensureClient() || !supabaseClient?.auth) {
    window.location.href = 'login.html';
    return false;
  }

  if (sessionStorage.getItem('just_logged_out') === '1') {
    clearAuthStorage();
    window.location.href = 'login.html?logged_out=1';
    return false;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session?.user) {
    clearAuthStorage();
    window.location.href = 'login.html';
    return false;
  }

  await persistSession(session.user, session);

  const role = localStorage.getItem(STORAGE.ROLE) || 'employee';
  if (requiredRole && role !== requiredRole) {
    window.location.href = (role === 'manager') ? 'manager.html' : 'employee.html';
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
