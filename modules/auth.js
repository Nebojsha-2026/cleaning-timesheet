// modules/auth.js
console.log("🔐 Auth module loading...");

const STORAGE = {
  TOKEN: "cleaning_timesheet_token",
  USER: "cleaning_timesheet_user",
  ROLE: "cleaning_timesheet_role",
  COMPANY: "cleaning_timesheet_company_id",
};

let supabaseClient = null;
let authListenerBound = false;

function isAuthPage() {
  const p = (window.location.pathname || "").toLowerCase();
  return p.includes("login.html") || p.includes("register.html") || p.includes("forgot-password.html");
}

function isInviteAcceptPage() {
  return (window.location.pathname || "").toLowerCase().includes("invite-accept.html");
}

function clearAuthStorage() {
  try {
    localStorage.removeItem(STORAGE.TOKEN);
    localStorage.removeItem(STORAGE.USER);
    localStorage.removeItem(STORAGE.ROLE);
    localStorage.removeItem(STORAGE.COMPANY);

    // Also clear supabase auth tokens (project key varies, so clear by pattern)
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) localStorage.removeItem(k);
    });
  } catch (_) {}
}

function ensureClient() {
  // reuse
  if (window.supabaseClient?.auth) {
    supabaseClient = window.supabaseClient;
    return true;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("❌ Supabase library not loaded (supabase.min.js).");
    return false;
  }

  const cfg = window.CONFIG || {};
  const url = cfg.SUPABASE_URL;
  const key = cfg.SUPABASE_KEY;

  if (!url || !key) {
    console.error("❌ Missing window.CONFIG.SUPABASE_URL or window.CONFIG.SUPABASE_KEY");
    return false;
  }

  window.supabaseClient = window.supabase.createClient(url, key);
  supabaseClient = window.supabaseClient;
  return true;
}

async function fetchProfile(userId) {
  if (!ensureClient()) return { role: "employee", companyId: null };

  try {
    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("company_id, role")
      .eq("id", userId)
      .single();

    if (error) throw error;

    return {
      role: profile?.role || "employee",
      companyId: profile?.company_id || null,
    };
  } catch (e) {
    console.warn("Profile fetch failed:", e?.message || e);
    return { role: "employee", companyId: null };
  }
}

async function persistSession(user, session) {
  if (!user) return { role: "employee", companyId: null, token: "" };

  const { role, companyId } = await fetchProfile(user.id);
  const token = session?.access_token || "";

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

function redirectByRole(role) {
  const dest = role === "manager" ? "manager.html" : "employee.html";
  // replace avoids back button weirdness
  window.location.replace(dest);
}

async function initializeAuth() {
  try {
    if (!ensureClient()) return;

    // If we JUST logged out, ignore any leftover auth events briefly
    const justOut = Number(sessionStorage.getItem("just_logged_out_ts") || "0");
    if (justOut && Date.now() - justOut < 5000) {
      console.log("🧹 just_logged_out_ts present: skipping auto-redirect/auth handling");
      return;
    }

    const { data } = await supabaseClient.auth.getSession();
    const session = data?.session || null;

    if (session?.user) {
      await persistSession(session.user, session);

      // On auth pages: go straight to dashboard
      if (isAuthPage() && !isInviteAcceptPage()) {
        const role = localStorage.getItem(STORAGE.ROLE) || "employee";
        redirectByRole(role);
        return;
      }
    }

    if (!authListenerBound) {
      authListenerBound = true;

      supabaseClient.auth.onAuthStateChange(async (event, session2) => {
        const justOut2 = Number(sessionStorage.getItem("just_logged_out_ts") || "0");
        if (justOut2 && Date.now() - justOut2 < 5000) {
          console.log("⛔ Ignoring auth event due to recent logout");
          return;
        }

        console.log("Auth event:", event, session2 ? "has session" : "no session");

        if (session2?.user) {
          await persistSession(session2.user, session2);

          if (isAuthPage() && !isInviteAcceptPage()) {
            const role = localStorage.getItem(STORAGE.ROLE) || "employee";
            redirectByRole(role);
          }
        } else {
          clearAuthStorage();
          if (!isAuthPage() && !isInviteAcceptPage()) {
            window.location.replace("login.html?logged_out=1");
          }
        }
      });
    }
  } catch (e) {
    console.error("initializeAuth error:", e);
  }
}

// Login returns {success:true/false}
async function login(email, password) {
  try {
    if (!ensureClient()) return { success: false, error: "Supabase client not ready" };

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };

    const meta = await persistSession(data.user, data.session);
    return { success: true, user: data.user, ...meta };
  } catch (e) {
    return { success: false, error: e?.message || "Login failed" };
  }
}

async function logout() {
  // Mark logout to prevent onAuthStateChange redirect race
  sessionStorage.setItem("just_logged_out_ts", String(Date.now()));

  try {
    if (ensureClient()) {
      await supabaseClient.auth.signOut();
    }
  } catch (e) {
    console.warn("signOut error:", e?.message || e);
  }

  clearAuthStorage();
  window.location.replace("login.html?logged_out=1");
}

async function protectRoute(requiredRole = null) {
  try {
    if (!ensureClient()) {
      window.location.replace("login.html");
      return false;
    }

    const { data } = await supabaseClient.auth.getSession();
    const session = data?.session || null;

    if (!session?.user) {
      clearAuthStorage();
      window.location.replace("login.html");
      return false;
    }

    // refresh local cache
    await persistSession(session.user, session);

    const role = localStorage.getItem(STORAGE.ROLE) || "employee";
    if (requiredRole && role !== requiredRole) {
      redirectByRole(role);
      return false;
    }

    return true;
  } catch (e) {
    console.warn("protectRoute error:", e?.message || e);
    window.location.replace("login.html");
    return false;
  }
}

// Boot
initializeAuth();

window.auth = {
  login,
  logout,
  protectRoute,
  initializeAuth,
};

console.log("✅ Auth module loaded");
