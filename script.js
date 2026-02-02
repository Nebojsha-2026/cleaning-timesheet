// script.js  (GLUE ONLY)
// Purpose:
// - Provide GLOBAL functions used by inline onclick="" in HTML
// - Keep the 3-line menu dropdown working reliably
// - Ensure window.supabaseClient exists (using config.js if present)
// - Do NOT duplicate business logic (that lives in /modules/*)

console.log("🧩 script.js (glue) loading...");

(function () {
  // ---- Supabase bootstrap (robust) ----
  const FALLBACK = {
    SUPABASE_URL: "https://hqmtigcjyqckqdzepcdu.supabase.co",
    SUPABASE_KEY:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw",
  };

  function ensureSupabaseClient() {
    // If already present, reuse (prevents multiple clients + weird auth behavior)
    if (window.supabaseClient?.auth) return window.supabaseClient;

    // Supabase UMD must be loaded
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      console.error("❌ Supabase UMD not loaded. Check supabase.min.js script tag.");
      return null;
    }

    // Use config.js if present; otherwise fallback
    const cfg = window.CONFIG || {};
    const url = cfg.SUPABASE_URL || FALLBACK.SUPABASE_URL;
    const key = cfg.SUPABASE_KEY || FALLBACK.SUPABASE_KEY;

    if (!url || !key) {
      console.error("❌ Missing SUPABASE_URL / SUPABASE_KEY (config.js or fallback).");
      return null;
    }

    window.supabaseClient = window.supabase.createClient(url, key);
    console.log("✅ supabaseClient ready");
    return window.supabaseClient;
  }

  // Make sure it exists ASAP (helps other modules too)
  ensureSupabaseClient();

  // ---- Menu dropdown (3-line menu) ----
  function bindUserMenuDropdown() {
    const menuRoot = document.querySelector(".user-menu");
    if (!menuRoot) return;

    const btn = menuRoot.querySelector(".user-menu-button, .menu-btn");
    const dropdown = menuRoot.querySelector(".user-menu-dropdown, .dropdown");

    if (!btn || !dropdown) return;

    // Prevent double-binding
    if (menuRoot.dataset.bound === "1") return;
    menuRoot.dataset.bound = "1";

    function close() {
      dropdown.classList.remove("open");
      dropdown.style.display = "none";
    }

    function toggle() {
      const isOpen = dropdown.classList.contains("open");
      if (isOpen) close();
      else {
        dropdown.classList.add("open");
        dropdown.style.display = "block";
      }
    }

    btn.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      },
      true
    );

    // Clicking outside closes
    document.addEventListener(
      "click",
      (e) => {
        if (!menuRoot.contains(e.target)) close();
      },
      true
    );

    // If user hits ESC, close
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") close();
      },
      true
    );
  }

  function rebindOnRestore() {
    bindUserMenuDropdown();
  }

  document.addEventListener("DOMContentLoaded", rebindOnRestore);
  window.addEventListener("pageshow", rebindOnRestore);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") rebindOnRestore();
  });

  // ---- GLOBAL functions used by manager.html onclick="" ----

  // Manager menu items call these:
  window.showHelp = function () {
    // Prefer module-provided help if present
    if (typeof window.showModal === "function") {
      window.showModal(`
        <div class="modal-content">
          <h2>Help</h2>
          <p style="margin-top:10px;color:#666">
            Worklynx Manager Dashboard help.
          </p>
          <ul style="margin-top:12px; padding-left:18px; color:#555; line-height:1.7">
            <li><b>Invite Employee</b> to generate an invite link.</li>
            <li><b>Create Shift</b> to assign or offer shifts.</li>
            <li><b>Timesheets</b> to view generated timesheets.</li>
          </ul>
          <div style="margin-top:18px; display:flex; gap:10px;">
            <button class="btn btn-primary" id="helpCloseBtn" style="flex:1">Close</button>
          </div>
        </div>
      `);
      document.getElementById("helpCloseBtn")?.addEventListener("click", () => window.closeModal?.());
    } else {
      alert("Help: modal system not loaded.");
    }
  };

  window.showSettings = function () {
    // Manager.html currently uses a settings card: #companySettingsCard
    const card = document.getElementById("companySettingsCard");
    if (card) {
      card.style.display = "block";
      card.scrollIntoView({ behavior: "smooth", block: "start" });
      window.showMessage?.("Settings opened.", "info");
      return;
    }
    window.showMessage?.("Settings panel not found.", "error");
  };

  window.safeLogout = async function () {
    try {
      // Always prefer auth module logout (it handles redirects + cleanup)
      if (window.auth?.logout) {
        await window.auth.logout();
        return;
      }

      // fallback
      const supabase = ensureSupabaseClient();
      await supabase?.auth?.signOut();
    } catch (e) {
      console.warn("logout error:", e?.message || e);
    } finally {
      // final fallback redirect
      window.location.href = "login.html";
    }
  };

  // Quick actions call these:
  window.viewAllTimesheets = function () {
    // Your modules/timesheets.js attaches window.viewTimesheets
    if (typeof window.viewTimesheets === "function") return window.viewTimesheets();

    window.showMessage?.("Timesheets module not loaded.", "error");
    console.warn("viewTimesheets() not found on window");
  };

  // Create shift button already calls showCreateShiftModal().
  // If it's missing, show a clear error instead of silently failing.
  const oldCreateShift = window.showCreateShiftModal;
  window.showCreateShiftModal = function () {
    if (typeof oldCreateShift === "function") return oldCreateShift();
    window.showMessage?.("Create Shift module not loaded.", "error");
    console.warn("showCreateShiftModal() not found on window");
  };

  console.log("✅ script.js (glue) loaded");
})();
