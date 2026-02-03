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
  KEY: "REPLACE_WITH_YOUR_ANON_KEY_IF_NEEDED",
};

let supabaseClient = null;

// Keep only one auth listener
let authUnsubscribe = null;

function clearAuthStorage() {
  try {
    localStorage.removeItem(STORAGE.TOKEN);
    localStorage.removeItem(STORAGE.USER);
    localStorage.removeItem(STORAGE.ROLE);
    localStorage.removeItem(STORAGE.COMPANY);
  } catch (_) {}
}

function ensureClient() {
  // Reuse existing global client
  if (window.supabaseClient && window.supabaseClient.auth) {
    supabaseClient = window.supabaseClient;
    return true;
  }

  // Supabase UMD must exist
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("❌ Supabase library not loaded (supabase.min.js missing).");
    return false;
  }

  const cfg = window.CONFIG || {};
  const url = cfg.SUPABASE_URL || SUPABASE_FALLBACK.URL;
  const key = cfg.SUPABASE_KEY || SUPABASE_FALLBACK.KEY;

  if (!url || !key) {
    console.error("❌ Missing window.CONFIG.SUPABASE_URL or window.CONFIG.SUPABASE_KEY");
    return false;
  }

  window.supabaseClient = window.supabase.createClient(url, key);
  supabaseClient = window.supabaseClient;
  return true;
}

async function persistSession(user, session) {
  if (!ensureClient() || !supabaseClient) throw new Error("Supabase client not ready");

  // If no session passed, fetch it
  let sess = session;
  if (!sess) {
    const { data } = await supabaseClient.auth.getSession();
    sess = data?.session || null;
  }

  // Profile lookup for role/company
  let role = "employee";
  let companyId = null;

  try {
    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("company_id, role")
      .eq("id", user.id)
      .single();

    if (!error && profile) {
      role = (profile.role || "employee").toLowerCase();
      companyId = profile.company_id || null;
    } else if (error) {
      console.warn("Profile fetch failed:", error.message);
    }
  } catch (e) {
    console.warn("Profile fetch exception:", e?.message || e);
  }

  const token = sess?.access_token || "";

  try {
    localStorage.setItem(STORAGE.TOKEN, token);
    localStorage.setItem(STORAGE.USER, JSON.stringify({ id: user.id, email: user.email }));
    localStorage.setItem(STORAGE.ROLE, role);
    if (companyId) localStorage.setItem(STORAGE.COMPANY, companyId);
    else localStorage.removeItem(STORAGE.COMPANY);
  } catch (_) {}

  console.log(`✅ Session handled: ${user.email} Role: ${role} Company: ${companyId}`);
  return { role, companyId, token };
}

function isAuthPage() {
  const p = (window.location.pathname || "").toLowerCase();
  return p.includes("login.html") || p.includes("register.html") || p.includes("forgot-password.html");
}

function isInviteAcceptPage() {
  return (window.location.pathname || "").toLowerCase().includes("invite-accept.html");
}

async function initializeAuth() {
  try {
    if (!ensureClient() || !supabaseClient?.auth) return;

    // If we JUST logged out, don’t let any redirect happen
    if (sessionStorage.getItem("just_logged_out") === "1") {
      console.log("🧹 just_logged_out present: enforcing signed-out state");
      sessionStorage.removeItem("just_logged_out");
      try { await supabaseClient.auth.signOut(); } catch (_) {}
      clearAuthStorage();
      return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session?.user) {
      await persistSession(session.user, session);

      // If user is on login/register, send them to correct dashboard
      if (isAuthPage() && !isInviteAcceptPage()) {
        const role = (localStorage.getItem(STORAGE.ROLE) || "employee").toLowerCase();
        window.location.href = role === "manager" ? "manager.html" : "employee.html";
        return;
      }
    }

    // Ensure we don't register multiple listeners
    if (authUnsubscribe) return;

    const { data: sub } = supabaseClient.auth.onAuthStateChange(async (event, session2) => {
      console.log("Auth event:", event, session2 ? "has session" : "no session");

      if (sessionStorage.getItem("just_logged_out") === "1") {
        console.log("⛔ Ignoring auth event due to just_logged_out");
        return;
      }

      if (session2?.user) {
        await persistSession(session2.user, session2);

        if (isAuthPage() && !isInviteAcceptPage()) {
          const role = (localStorage.getItem(STORAGE.ROLE) || "employee").toLowerCase();
          window.location.href = role === "manager" ? "manager.html" : "employee.html";
        }
      } else {
        clearAuthStorage();
        if (!isAuthPage() && !isInviteAcceptPage()) window.location.href = "login.html";
      }
    });

    authUnsubscribe = () => sub?.subscription?.unsubscribe?.();
  } catch (e) {
    console.error("initializeAuth error:", e);
  }
}

// ✅ Login must return {success:true/false} because login.html expects it
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
  // Stops auth listener redirect loops while signOut runs
  sessionStorage.setItem("just_logged_out", "1");

  try {
    if (ensureClient() && supabaseClient?.auth) {
      await supabaseClient.auth.signOut();
    }
  } catch (e) {
    console.warn("signOut error:", e?.message || e);
  }

  clearAuthStorage();
  window.location.href = "login.html";
}

async function protectRoute(requiredRole = null) {
  if (!ensureClient() || !supabaseClient?.auth) {
    window.location.href = "login.html";
    return false;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();

  // ✅ Source of truth: Supabase session
  if (!session?.user) {
    clearAuthStorage();
    window.location.href = "login.html";
    return false;
  }

  await persistSession(session.user, session);

  const role = (localStorage.getItem(STORAGE.ROLE) || "employee").toLowerCase();
  if (requiredRole && role !== requiredRole) {
    window.location.href = role === "manager" ? "manager.html" : "employee.html";
    return false;
  }

  return true;
}

ensureClient();
initializeAuth();

console.log("✅ Auth module loaded");

window.auth = {
  login,
  logout,
  protectRoute,
  initializeAuth,
};
