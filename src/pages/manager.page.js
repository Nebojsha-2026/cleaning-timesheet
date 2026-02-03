// src/pages/manager.page.js
console.log("📄 Manager page script loading...");

function isManagerPage() {
  return (window.location.pathname || "").toLowerCase().includes("manager.html");
}

function hideManagerLoader() {
  const loader = document.getElementById("managerLoadingScreen");
  const app = document.getElementById("managerApp");

  if (loader) loader.style.display = "none";
  if (app) app.style.display = "block";

  console.log("✅ Manager UI unlocked");
}

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

function openSettingsPanel() {
  const card = document.getElementById("companySettingsCard");
  if (card) {
    card.style.display = "block";
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    window.showMessage?.("Settings opened.", "info");
    return;
  }
  window.showMessage?.("Settings panel not found on this page.", "error");
}

async function doLogout() {
  try {
    if (window.auth && typeof window.auth.logout === "function") {
      await window.auth.logout();
      return;
    }
  } catch (e) {
    console.warn("auth.logout failed:", e?.message || e);
  }

  // Fallback
  try {
    await window.supabaseClient?.auth?.signOut();
  } catch (e) {
    console.warn("supabase signOut failed:", e?.message || e);
  }

  try {
    localStorage.removeItem("cleaning_timesheet_token");
    localStorage.removeItem("cleaning_timesheet_role");
    localStorage.removeItem("cleaning_timesheet_company_id");
  } catch {}

  window.location.href = "login.html";
}

async function initManagerPage() {
  try {
    if (!isManagerPage()) return;

    // ✅ Protect route
    if (window.auth && typeof window.auth.protectRoute === "function") {
      const ok = await window.auth.protectRoute("manager");
      if (!ok) return;
    }

    // ✅ Init modules if they expose init hooks
    if (typeof window.initShifts === "function") await window.initShifts();
    if (typeof window.initTimesheets === "function") await window.initTimesheets();

    // ✅ Show UI
    hideManagerLoader();
  } catch (err) {
    console.error("❌ Manager init failed:", err);
    window.showMessage?.("Could not load dashboard", "error");
  }
}

function bindManagerStickyHandlers() {
  if (document.documentElement.dataset.managerHandlersBound === "1") return;
  document.documentElement.dataset.managerHandlersBound = "1";

  console.log("✅ Binding manager handlers (capture delegation)");

  document.addEventListener(
    "click",
    async (e) => {
      if (!isManagerPage()) return;

      // 1) MENU ACTIONS (Help / Settings / Logout)
      const actionBtn = e.target.closest("button[data-action]");
      if (actionBtn) {
        const action = actionBtn.dataset.action;

        e.preventDefault();
        e.stopPropagation();

        if (action === "help") return showHelpModal();
        if (action === "settings") return openSettingsPanel();
        if (action === "logout") {
          // IMPORTANT: stop other click handlers fighting this
          if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
          return await doLogout();
        }
      }

      // 2) QUICK ACTION BUTTONS (Create Shift / Timesheets / Shifts)
      const btn = e.target.closest(".action-btn, button");
      if (!btn) return;

      // If it was a menu button, it already handled above
      if (btn.matches("button[data-action]")) return;

      const text = (btn.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();

      // Use text matching to survive DOM rebuild / tab restore
      if (text.includes("create shift")) {
        e.preventDefault();
        if (typeof window.showCreateShiftModal === "function") window.showCreateShiftModal();
        return;
      }

      if (text.includes("timesheets") || text.includes("timesheet")) {
        e.preventDefault();
        if (typeof window.viewAllTimesheets === "function") window.viewAllTimesheets();
        return;
      }

      // Be careful: "Edit Shifts" also contains "shifts"
      if (text === "shifts" || text.includes(" all shifts")) {
        e.preventDefault();
        if (typeof window.showAllShiftsModal === "function") window.showAllShiftsModal();
        return;
      }

      if (text.includes("edit shifts")) {
        e.preventDefault();
        if (typeof window.showEditShiftsModal === "function") window.showEditShiftsModal();
        return;
      }
    },
    true // capture = survives weird bubbling / restored DOM
  );
}

// Boot
document.addEventListener("DOMContentLoaded", () => {
  if (!isManagerPage()) return;
  bindManagerStickyHandlers();
  initManagerPage();
});

// Chrome tab restore / bfcache
window.addEventListener("pageshow", () => {
  if (!isManagerPage()) return;
  bindManagerStickyHandlers();
  initManagerPage();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && isManagerPage()) {
    bindManagerStickyHandlers();
  }
});

console.log("📄 Manager page script loaded");
