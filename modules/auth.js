// modules/auth.js
console.log("🔐 Auth module loading...");

const STORAGE = {
  TOKEN: "cleaning_timesheet_token",
  USER: "cleaning_timesheet_user",
  ROLE: "cleaning_timesheet_role",
  COMPANY: "cleaning_timesheet_company_id",
};

const SUPABASE_FALLBACK = {
  URL: "https://hqmtigcjyqckqdzepcdu.supabase.co",
  KEY: "PASTE_YOUR_ANON_KEY_HERE", // keep as fallback only
};

let supabaseClient = null;
let authInitBound = false;

function isAuthPage() {
  const p = (window.location.pathname || "").toLowerCase();
  return p.includes("login.html") || p.includes("register.html") || p.includes("forgot-password.html");
}
function isInviteAcceptPage() {
  return (window.location.pathname || "").toLowerCase().includes("invite-accept.html");
}

function clearAuthStorage() {
  localStorage.removeItem(STORAGE.TOKEN);
  localStorage.removeItem(STORAGE.USER);
  localStorage.removeItem(STORAGE.ROLE);
  localStorage.removeItem(STORAGE.COMPANY);
}

function ensureClient() {
  // reuse singleton if already exists
  if (window.supabaseClient?.auth) {
    supabaseClient = window.supabaseClient;
    return true;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("❌ Supabase UMD not loaded. Check supabase.min.js script tag.");
    return false;
  }

  const cfg = window.CONFIG || {};
  const url = cfg.SUPABASE_URL || SUPABASE_FALLBACK.URL;
  const key = cfg.SUPABASE_KEY || SUPABASE_FALLBACK.KEY;

  if (!url || !key) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_KEY (window.CONFIG).");
    return false;
  }

  // IMPORTANT: set auth persistence explicitly (avoids tab-switch/bfcache weirdness)
  window.supabaseClient = window.supabase.createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  });

  supabaseClient = window.supabaseClient;
  return true;
}

async function persistSession(user, session) {
  ensureClient();
  if (!supabaseClient?.auth) throw new Error("Supabase client not ready");

  let sess = session;
  if (!sess) {
    const { data } = await supabaseClient.auth.getSession();
    sess = data?.session || null;
  }

  // profile lookup
  let role = "employee";
  let companyId = null;

  try {
    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("company_id, role")
      .eq("id", user.id)
      .single();

    if (error) throw error;
    role = profile?.role || "employee";
    companyId = profile?.company_id || null;
  } catch (e) {
    console.warn("Profile fetch failed:", e?.message || e);
  }

  const token = sess?.access_token || "";

  localStorage.setItem(STORAGE.TOKEN, token);
  localStorage.setItem(STORAGE.USER, JSON.stringify({ id: user.id, email: user.email }));
  localStorage.setItem(STORAGE.ROLE, role);

  if (companyId) localStorage.setItem(STORAGE.COMPANY, companyId);
  else localStorage.removeItem(STORAGE.COMPANY);

  console.log(`✅ Session handled: ${user.email} Role: ${role} Company: ${companyId}`);
  return { role, companyId, token };
}

// wait a bit for session to rehydrate after tab restore
async function waitForSession({ timeoutMs = 1500, stepMs = 150 } = {}) {
  ensureClient();
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const { data } = await supabaseClient.auth.getSession();
    if (data?.session?.user) return data.session;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  const { data } = await supabaseClient.auth.getSession();
  return data?.session || null;
}

async function initializeAuth() {
  try {
    if (!ensureClient() || !supabaseClient?.auth) return;

    if (authInitBound) return;
    authInitBound = true;

    // If we just logged out, block any instant re-redirect on the next page
    if (sessionStorage.getItem("just_logged_out") === "1") {
      console.log("🧹 just_logged_out present: ensure signed-out state");
      sessionStorage.removeItem("just_logged_out");
      try { await supabaseClient.auth.signOut(); } catch (_) {}
      clearAuthStorage();
      return;
    }

    // First hydration (tab restore safe)
    const session = await waitForSession({ timeoutMs: 1200, stepMs: 150 });

    if (session?.user) {
      await persistSession(session.user, session);

      // if on login/register pages, go to correct dashboard
      if (isAuthPage() && !isInviteAcceptPage()) {
        const role = localStorage.getItem(STORAGE.ROLE) || "employee";
        window.location.replace(role === "manager" ? "manager.html" : "employee.html");
        return;
      }
    } else {
      // no session: clear local cache but don't forcibly redirect from auth pages
      clearAuthStorage();
    }

    // single auth listener
    supabaseClient.auth.onAuthStateChange(async (event, session2) => {
      // if logout flag set, ignore any “ghost” events
      if (sessionStorage.getItem("just_logged_out") === "1") return;

      if (session2?.user) {
        await persistSession(session2.user, session2);

        if (isAuthPage() && !isInviteAcceptPage()) {
          const role = localStorage.getItem(STORAGE.ROLE) || "employee";
          window.location.replace(role === "manager" ? "manager.html" : "employee.html");
        }
      } else {
        clearAuthStorage();
        if (!isAuthPage() && !isInviteAcceptPage()) {
          window.location.replace("login.html");
        }
      }
    });

    // BFCache restore: allow rehydrate again (but do NOT add another listener)
    window.addEventListener("pageshow", async (e) => {
      if (!e.persisted) return;
      authInitBound = true; // keep listener single
      const s = await waitForSession({ timeoutMs: 1200, stepMs: 150 });
      if (s?.user) await persistSession(s.user, s);
    });

  } catch (e) {
    console.error("initializeAuth error:", e);
  }
}

async function login(email, password) {
  try {
    if (!ensureClient() || !supabaseClient?.auth) {
      return { success: false, error: "Supabase client not ready" };
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };

    const meta = await persistSession(data.user, data.session);
    return { success: true, user: data.user, ...meta };
  } catch (e) {
    return { success: false, error: e?.message || "Login failed" };
  }
}

async function logout() {
  sessionStorage.setItem("just_logged_out", "1");

  try {
    if (ensureClient() && supabaseClient?.auth) {
      await supabaseClient.auth.signOut();
    }
  } catch (e) {
    console.warn("signOut error:", e?.message || e);
  }

  clearAuthStorage();

  // Replace (prevents back button returning to cached page)
  window.location.replace("login.html?logged_out=1");
}

async function protectRoute(requiredRole = null) {
  if (!ensureClient() || !supabaseClient?.auth) {
    window.location.replace("login.html");
    return false;
  }

  // IMPORTANT: retry instead of instantly redirecting (fixes tab-switch)
  const session = await waitForSession({ timeoutMs: 1500, stepMs: 150 });

  if (!session?.user) {
    clearAuthStorage();
    window.location.replace("login.html");
    return false;
  }

  // refresh local role/company cache
  await persistSession(session.user, session);

  const role = localStorage.getItem(STORAGE.ROLE) || "employee";
  if (requiredRole && role !== requiredRole) {
    window.location.replace(role === "manager" ? "manager.html" : "employee.html");
    return false;
  }

  return true;
}

// boot
ensureClient();
initializeAuth();

console.log("✅ Auth module loaded");

window.auth = {
  login,
  logout,
  protectRoute,
  initializeAuth,
};
