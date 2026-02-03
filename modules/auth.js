// modules/auth.js
console.log("🔐 Auth module loading...");

(function () {
  const TOKEN_KEY = "cleaning_timesheet_token";
  const ROLE_KEY = "cleaning_timesheet_role";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getRole() {
    return localStorage.getItem(ROLE_KEY);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    sessionStorage.clear();
  }

  async function protectRoute(requiredRole) {
    const token = getToken();
    const role = getRole();

    if (!token || !role) {
      clearSession();
      window.location.replace("login.html");
      return false;
    }

    if (requiredRole && role !== requiredRole) {
      window.location.replace(role === "manager" ? "manager.html" : "employee.html");
      return false;
    }

    console.log(`✅ Session handled: ${role}`);
    return true;
  }

  async function logout() {
    console.log("🚪 Logging out (hard reset)");
    clearSession();

    // HARD reload to break BFCache
    window.location.replace("login.html");
  }

  async function login(email, password) {
    // your supabase login logic stays
    // on success:
    // localStorage.setItem(TOKEN_KEY, token)
    // localStorage.setItem(ROLE_KEY, role)
    // window.location.replace(role === "manager" ? "manager.html" : "employee.html");
  }

  window.auth = {
    protectRoute,
    logout,
    login,
  };

  console.log("✅ Auth module loaded");
})();
