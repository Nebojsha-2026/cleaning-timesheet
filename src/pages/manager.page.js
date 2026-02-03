// src/pages/manager.page.js
console.log("📄 Manager page script loading...");

function isManagerPage() {
  return (window.location.pathname || "").toLowerCase().includes("manager.html");
}

/* -------------------------
   Safety cleanup: remove invisible blockers
------------------------- */
function nukeInvisibleBlockers() {
  const selectors = [
    "#managerLoadingScreen",
    ".loading-screen",
    ".modal-backdrop",
    ".modal-overlay",
    "#modalOverlay",
    "#modalBackdrop",
  ];

  selectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      try {
        // If it's the real loader, we'll hide it later via hideManagerLoader().
        // But if it gets stuck as an invisible overlay, kill it.
        el.style.display = "none";
        el.style.pointerEvents = "none";
        el.remove();
      } catch (_) {}
    });
  });

  try {
    document.body.style.pointerEvents = "auto";
  } catch (_) {}

  console.log("🧹 Invisible overlays removed");
}

function hideManagerLoader() {
  const loader = document.getElementById("managerLoadingScreen");
  const app = document.getElementById("managerApp");

  if (loader) loader.style.display = "none";
  if (app) app.style.display = "block";

  console.log("✅ Manager UI unlocked");
}

/* -------------------------
   Menu actions
------------------------- */
function showHelpModal() {
  if (!window.showModal) {
    alert("Modal system not loaded.");
    return;
  }

  window.showModal(`
    <div class="modal-content">
      <h2>Help</h2>
      <p style="margin-top:10px;color:#666">Worklynx Manager Dashboard help.</p>
      <ul style="margin-top:12px; padding-left:18px; color:#555; line-height:1.7">
        <li><b>Invite Employee</b> to generate an invite link.</li>
        <li><b>Create Shift</b> to assign or offer shifts.</li>
        <li><b>Settings</b> to update branding & pay frequency.</li>
      </ul>
      <div style="margin-top:18px; display:flex; gap:10px;">
        <button class="btn btn-primary" id="helpCloseBtn" style="flex:1">Close</button>
      </div>
    </div>
  `);

  document.getElementById("helpCloseBtn")?.addEventListener("click", () => {
    window.closeModal?.();
  });
}

function openSettingsPanel() {
  const card = document.getElementById("companySettingsCard");
  if (!card) {
    window.showMessage?.("Settings panel not found", "error");
    return;
  }
  card.style.display = "block";
  card.scrollIntoView({ behavior: "smooth", block: "start" });
  window.showMessage?.("Settings opened.", "info");
}

async function doLogout() {
  try {
    if (window.auth?.logout) {
      await window.auth.logout();
      return;
    }
  } catch (e) {
    console.warn("auth.logout failed:", e?.message || e);
  }

  // Fallback
  window.location.href = "login.html";
}

/* -------------------------
   Action router (data-action only)
------------------------- */
async function handleManagerAction(action) {
  switch (action) {
    // User menu
    case "help":
      showHelpModal();
      return;

    case "settings":
      openSettingsPanel();
      return;

    case "logout":
      console.log("🚪 Logout clicked");
      await doLogout();
      return;

    // Header / list controls
    case "refresh-shifts":
      console.log("🔄 Refresh shifts clicked");
      // prefer whichever exists in your modules
      if (typeof window.loadManagerUpcomingShifts === "function") {
        await window.loadManagerUpcomingShifts();
      } else if (typeof window.refreshShifts === "function") {
        await window.refreshShifts();
      } else if (typeof window.initShifts === "function") {
        await window.initShifts();
      } else {
        window.showMessage?.("Shifts refresh not available yet.", "info");
      }
      return;

    // Quick actions (right column)
    case "invite":
      console.log("✉️ Invite clicked");
      window.showInviteEmployeeModal?.();
      return;

    case "employees":
      console.log("👥 Employees clicked");
      // IMPORTANT: your module must export one of these to window
      // We'll try a few likely names.
      if (typeof window.showEmployeesModal === "function") {
        window.showEmployeesModal();
      } else if (typeof window.openEmployeesModal === "function") {
        window.openEmployeesModal();
      } else if (typeof window.showEmployeeManagementModal === "function") {
        window.showEmployeeManagementModal();
      } else {
        window.showMessage?.("Employees modal not loaded yet.", "error");
      }
      return;

    case "create-shift":
      console.log("➕ Create shift clicked");
      window.showCreateShiftModal?.();
      return;

    case "edit-shifts":
      console.log("✏️ Edit shifts clicked");
      window.showEditShiftsModal?.();
      return;

    case "shifts":
      console.log("📋 Shifts clicked");
      window.showAllShiftsModal?.();
      return;

    case "timesheets":
      console.log("📄 Timesheets clicked");
      window.viewAllTimesheets?.();
      return;

    default:
      // ignore unknown buttons
      return;
  }
}

/* -------------------------
   Sticky click delegation (capture)
------------------------- */
function bindManagerActionsSticky() {
  if (document.documentElement.dataset.managerActionsBound === "1") return;
  document.documentElement.dataset.managerActionsBound = "1";

  console.log("✅ Binding manager actions (capture delegation)");

  // 🔁 Always rebind menu toggle (fixes BFCache dead menu)
  document.querySelectorAll(".user-menu-button").forEach(btn => {
    btn.onclick = () => {
      const menu = btn.nextElementSibling;
      if (menu) menu.classList.toggle("open");
    };
  });
  
  document.addEventListener(
    "click",
    async (e) => {
      if (!isManagerPage()) return;

      const el = e.target.closest("[data-action]");
      if (!el) return;

      const action = el.dataset.action;
      if (!action) return;

      // Critical: capture + stopImmediatePropagation avoids weird bfcache/tab restore handlers
      e.preventDefault();
      e.stopImmediatePropagation();

      try {
        await handleManagerAction(action);
      } catch (err) {
        console.error("Action failed:", action, err);
        window.showMessage?.("Action failed: " + action, "error");
      }
    },
    true
  );
}

/* -------------------------
   Init manager page
------------------------- */
async function initManagerPage() {
  try {
    if (!isManagerPage()) return;

    // Clean overlays early
    nukeInvisibleBlockers();

    // Protect route
    if (window.auth?.protectRoute) {
      const ok = await window.auth.protectRoute("manager");
      if (!ok) return;
    }

    // Init modules if they exist
    if (typeof window.initShifts === "function") await window.initShifts();
    if (typeof window.initTimesheets === "function") await window.initTimesheets();

    hideManagerLoader();
  } catch (err) {
    console.error("❌ Manager init failed:", err);
    window.showMessage?.("Could not load dashboard", "error");
  }
}

/* -------------------------
   Lifecycle hooks
------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  if (!isManagerPage()) return;
  bindManagerActionsSticky();
  initManagerPage();
});

window.addEventListener("pageshow", (e) => {
  if (!isManagerPage()) return;

  console.log("🔁 BFCache restore detected:", e.persisted);

  if (e.persisted) {
    // HARD reset UI shell
    const app = document.getElementById("managerApp");
    if (app) {
      const clone = app.cloneNode(true);
      app.replaceWith(clone);
    }

    // rebind everything
    document.documentElement.dataset.managerActionsBound = "0";
    nukeInvisibleBlockers();
    bindManagerActionsSticky();
    initManagerPage();
  }
});


document.addEventListener("visibilitychange", () => {
  if (!isManagerPage()) return;
  if (document.visibilityState === "visible") {
    nukeInvisibleBlockers();
    // binding is document-level and capture, but keep call for safety
    bindManagerActionsSticky();
  }
});

console.log("📄 Manager page script loaded");
