// modules/auth.js
console.log("🔐 Auth module loading...");

const STORAGE = {
  TOKEN: "cleaning_timesheet_token",
  USER: "cleaning_timesheet_user",
  ROLE: "cleaning_timesheet_role",
  COMPANY: "cleaning_timesheet_company_id",
};

let supabaseClient = null;

function ensureClient() {
  if (window.supabaseClient && window.supabaseClient.auth) {
    supabaseClient = window.supabaseClient;
    return true;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("❌ Supabase library not loaded.");
    return false;
  }

  if (!window.CONFIG?.SUPABASE_URL || !window.CONFIG?.SUPABASE_KEY) {
    console.error("❌ Missing window.CONFIG.SUPABASE_URL or SUPABASE_KEY");
    return false;
  }

  window.supabaseClient = window.supabase.createClient(
    window.CONFIG.SUPABASE_URL,
    window.CONFIG.SUPABASE_KEY
  );

  supabaseClient = window.supabaseClient;
  return true;
}

function clearAuthStorage() {
  localStorage.removeItem(STORAGE.TOKEN);
  localStorage.removeItem(STORAGE.USER);
  localStorage.removeItem(STORAGE.ROLE);
  localStorage.removeItem(STORAGE.COMPANY);
}

async function persistSession(user, session) {
  ensureClient();
  if (!supabaseClient) throw new Error("Supabase client not ready");

  if (!session) {
    const { data } = await supabaseClient.auth.getSession();
    session = data?.session || null;
  }

  let role = "employee";
  let companyId = null;

  try {
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("company_id, role")
      .eq("id", user.id)
      .single();

    if (profile) {
      role = profile.role || role;
      companyId = profile.company_id || null;
    }
  } catch (e) {
    console.warn("Profile lookup failed:", e?.message || e);
  }

  const token = session?.access_token || "";

  localStorage.setItem(STORAGE.TOKEN, token);
  localStorage.setItem(STORAGE.USER, JSON.stringify({ id: user.id, email: user.email }));
  localStorage.setItem(STORAGE.ROLE, role);

  if (companyId) localStorage.setItem(STORAGE.COMPANY, companyId);
  else localStorage.removeItem(STORAGE.COMPANY);

  console.log(`✅ Session handled: ${user.email} Role: ${role} Company: ${companyId}`);
  return { role, companyId, token };
}

function isAuthPage() {
  const p = window.location.pathname.toLowerCase();
  return p.includes("login.html") || p.includes("register.html");
}

async function initializeAuth() {
  try {
    if (!ensureClient()) return;

    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session?.user) {
      await persistSession(session.user, session);

      if (isAuthPage()) {
        const role = localStorage.getItem(STORAGE.ROLE) || "employee";
        window.location.href = role === "manager" ? "manager.html" : "employee.html";
      }
    }

    supabaseClient.auth.onAuthStateChange(async (_event, session2) => {
      if (session2?.user) {
        await persistSession(session2.user, session2);
      } else {
        clearAuthStorage();
      }
    });
  } catch (e) {
    console.error("initializeAuth error:", e);
  }
}

async function login(email, password) {
  try {
    if (!ensureClient()) return { success: false, error: "Supabase not ready" };

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return { success: false, error: error.message };

    const meta = await persistSession(data.user, data.session);
    return { success: true, user: data.user, ...meta };
  } catch (e) {
    return { success: false, error: e.message || "Login failed" };
  }
}

async function logout() {
  try {
    ensureClient();
    await supabaseClient?.auth?.signOut();
  } catch (e) {
    console.warn("signOut error:", e?.message || e);
  }

  clearAuthStorage();
  window.location.href = "login.html";
}

async function protectRoute(requiredRole = null) {
  if (!ensureClient()) {
    window.location.href = "login.html";
    return false;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session?.user) {
    clearAuthStorage();
    window.location.href = "login.html";
    return false;
  }

  await persistSession(session.user, session);

  const role = localStorage.getItem(STORAGE.ROLE) || "employee";
  if (requiredRole && role !== requiredRole) {
    window.location.href = role === "manager" ? "manager.html" : "employee.html";
    return false;
  }

  return true;
}

// boot
ensureClient();
initializeAuth();

window.auth = {
  login,
  logout,
  protectRoute,
  initializeAuth,
};

console.log("✅ Auth module loaded");
