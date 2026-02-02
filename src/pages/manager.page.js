// src/pages/manager.page.js
console.log("📄 Manager page script loading...");

/**
 * HELP MODAL
 */
function showHelpModal() {
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
          <li><b>Settings</b> to update branding & pay frequency.</li>
          <li><b>Timesheets</b> to view and manage generated invoices.</li>
        </ul>

        <div style="margin-top:18px; display:flex; gap:10px;">
          <button class="btn btn-primary" id="helpCloseBtn" style="flex:1">
            Close
          </button>
        </div>
      </div>
    `);

    document.getElementById("helpCloseBtn")?.addEventListener("click", () => {
      if (typeof window.closeModal === "function") window.closeModal();
    });
  } else {
    alert("Help: modal system not loaded.");
  }
}

/**
 * SETTINGS PANEL
 */
function openSettingsPanel() {
  const card = document.getElementById("companySettingsCard");
  if (card) {
    card.style.display = "block";
    card.scrollIntoView({ behavior: "smooth", block: "start" });

    if (typeof window.showMessage === "function") {
      window.showMessage("Settings opened.", "info");
    }
    return;
  }

  if (typeof window.showMessage === "function") {
    window.showMessage("Settings panel not found on this page.", "error");
  } else {
    alert("Settings panel not found on this page.");
  }
}

/**
 * LOGOUT (always prefer auth.js logout)
 */
async function doLogout() {
  try {
    if (window.auth && typeof window.auth.logout === "function") {
      await window.auth.logout();
      return;
    }
  } catch (e) {
    console.warn("auth.logout failed:", e?.message || e);
  }

  // Fallback: Supabase signOut
  try {
    if (window.supabaseClient?.auth) {
      await window.supabaseClient.auth.signOut();
    }
  } catch (e) {
    console.warn("supabase signOut error:", e?.message || e);
  }

  // Fallback storage cleanup
  try {
    localStorage.removeItem("cleaning_timesheet_token");
    localStorage.removeItem("cleaning_timesheet_user");
    localStorage.removeItem("cleaning_timesheet_role");
    localStorage.removeItem("cleaning_timesheet_company_id");
  } catch {}

  window.location.href = "login.html";
}

/**
 * QUICK ACTIONS (Create Shift / Timesheets)
 * These wrappers ensure we call the correct function even if some file loads late.
 */
async function openCreateShift() {
  if (typeof window.showCreateShiftModal === "function") {
    await window.showCreateShiftModal();
    return;
  }
  if (typeof window.showMessage === "function") {
    window.showMessage("Create Shift function not loaded yet.", "error");
  } else {
    alert("Create Shift function not loaded yet.");
  }
}

async function openTimesheets() {
  // Your timesheets.js exposes window.viewTimesheets()
  if (typeof window.viewAllTimesheets === "function") {
    // if you kept viewAllTimesheets wrapper
    await window.viewAllTimesheets();
    return;
  }
  if (typeof window.viewTimesheets === "function") {
    await window.viewTimesheets();
    return;
  }

  if (typeof window.showMessage === "function") {
    window.showMessage("Timesheets function not loaded yet.", "error");
  } else {
    alert("Timesheets function not loaded yet.");
  }
}

/**
 * MANAGER PAGE DETECTION
 */
function isManagerPage() {
  return (window.location.pathname || "").toLowerCase().includes("manager.html");
}

/**
 * STRONG BINDING:
 * - capture-phase click delegation (survives dropdown DOM changes / overlays)
 * - also binds Quick Action buttons by label as a fallback (if inline onclick breaks)
 */
function bindManagerActionsOnce() {
  if (!isManagerPage()) return;

  if (document.documentElement.dataset.managerActionsBound === "1") return;
  document.documentElement.dataset.managerActionsBound = "1";

  console.log("✅ Binding manager actions (capture delegation + fallbacks)");

  // 1) Capture-phase delegation for menu buttons/links
  document.addEventListener(
    "click",
    async (e) => {
      if (!isManagerPage()) return;

      const el =
        e.target.closest("[data-action]") ||
        e.target.closest("[onclick]") ||
        e.target.closest("a") ||
        e.target.closest("button");

      if (!el) return;

      const action = el.getAttribute("data-action") || "";

      // Handle common menu patterns:
      // - data-action="logout|help|settings"
      // - onclick="safeLogout()" etc.
      // - inner text "Logout" etc.
      const onclick = (el.getAttribute("onclick") || "").toLowerCase();
      const text = (el.textContent || "").trim().toLowerCase();

      const wantsLogout =
        action === "logout" ||
        onclick.includes("logout") ||
        onclick.includes("safelogout") ||
        text === "logout" ||
        text.includes("log out");

      const wantsHelp =
        action === "help" ||
        onclick.includes("help") ||
        text === "help";

      const wantsSettings =
        action === "settings" ||
        onclick.includes("settings") ||
        onclick.includes("showcompanysettings") ||
        text.includes("settings");

      // Quick actions:
      const wantsCreateShift =
        onclick.includes("showcreateshiftmodal") ||
        text.includes("create shift");

      const wantsTimesheets =
        onclick.includes("viewalltimesheets") ||
        text.includes("timesheets");

      if (wantsLogout) {
        e.preventDefault();
        e.stopPropagation();
        await doLogout();
        return;
      }

      if (wantsHelp) {
        e.preventDefault();
        e.stopPropagation();
        showHelpModal();
        return;
      }

      if (wantsSettings) {
        e.preventDefault();
        e.stopPropagation();
        openSettingsPanel();
        return;
      }

      if (wantsCreateShift) {
        e.preventDefault();
        e.stopPropagation();
        await openCreateShift();
        return;
      }

      if (wantsTimesheets) {
        e.preventDefault();
        e.stopPropagation();
        await openTimesheets();
        return;
      }
    },
    true // capture-phase = survives other handlers
  );

  // 2) Fallback bindings for the Quick Action grid buttons (by label)
  // This fixes cases where inline onclick is ignored or overwritten.
  const actionButtons = Array.from(document.querySelectorAll(".action-btn"));
  actionButtons.forEach((btn) => {
    const label = (btn.textContent || "").trim().toLowerCase();

    if (label.includes("create shift")) {
      btn.addEventListener(
        "click",
        async (e) => {
          e.preventDefault();
          await openCreateShift();
        },
        true
      );
    }

    if (label.includes("timesheets")) {
      btn.addEventListener(
        "click",
        async (e) => {
          e.preventDefault();
          await openTimesheets();
        },
        true
      );
    }
  });

  // 3) Expose globals so your HTML onclicks always resolve
  window.safeLogout = doLogout;       // menu calls safeLogout()
  window.showHelp = showHelpModal;    // if menu calls showHelp()
  window.showSettings = openSettingsPanel; // if menu calls showSettings()
}

document.addEventListener("DOMContentLoaded", () => {
  if (!isManagerPage()) return;
  bindManagerActionsOnce();
});

// BFCache restore
window.addEventListener("pageshow", () => {
  if (!isManagerPage()) return;
  // Allow rebinding after restore (but keep it idempotent)
  bindManagerActionsOnce();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && isManagerPage()) {
    bindManagerActionsOnce();
  }
});

console.log("✅ Manager page script loaded");
