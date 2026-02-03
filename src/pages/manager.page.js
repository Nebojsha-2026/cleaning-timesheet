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
        el.style.display = "none";
        el.style.pointerEvents = "none";
        // remove overlays that might remain in DOM and block clicks
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
   User menu: open/close dropdown
------------------------- */
function rebindUserMenuToggle() {
  // Bind toggle to every menu button (needed after tab restore)
  document.querySelectorAll(".user-menu-button").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const menu = btn.nextElementSibling; // .user-menu-dropdown
      if (!menu) return;

      // close other open dropdowns first
      document.querySelectorAll(".user-menu-dropdown.open").forEach((m) => {
        if (m !== menu) m.classList.remove("open");
      });

      menu.classList.toggle("open");
    };
  });
}

function closeUserMenus() {
  document.querySelectorAll(".user-menu-dropdown.open").forEach((m) => m.classList.remove("open"));
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
  window.location.href = "login.html";
}

/* -------------------------
   Action router
------------------------- */
async function handleManagerAction(action) {
  switch (action) {
    // user-menu
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

    // shifts refresh
    case "refresh-shifts":
      console.log("🔄 Refresh shifts clicked");
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

    // quick actions
    case "invite":
      console.log("✉️ Invite clicked");
      window.showInviteEmployeeModal?.();
      return;

    case "employees":
      console.log("👥 Employees clicked");
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
      return;
  }
}

/* -------------------------
   Infer action for legacy buttons (no data-action)
------------------------- */
function inferActionFromButton(btn) {
  // 1) data-action wins
  const da = btn?.dataset?.action;
  if (da) return da;

  // 2) onclick mapping (if present)
  const oc = btn.getAttribute?.("onclick") || "";
  const ocl = oc.toLowerCase();
  if (ocl.includes("showinviteemployeemodal")) return "invite";
  if (ocl.includes("showemployeesmodal")) return "employees";
  if (ocl.includes("showcreateshiftmodal")) return "create-shift";
  if (ocl.includes("showeditshiftsmodal")) return "edit-shifts";
  if (ocl.includes("showallshiftsmodal")) return "shifts";
  if (ocl.includes("viewalltimesheets")) return "timesheets";
  if (ocl.includes("refreshshifts") || ocl.includes("loadmanagerupcomingshifts")) return "refresh-shifts";

  // 3) text fallback
  const text = (btn.textContent || "").trim().toLowerCase();
  if (text.includes("invite")) return "invite";
  if (text.includes("employee")) return "employees";
  if (text.includes("create shift")) return "create-shift";
  if (text.includes("edit shifts")) return "edit-shifts";
  if (text === "shifts" || text.includes("shifts")) return "shifts";
  if (text.includes("timesheet")) return "timesheets";

  return null;
}

/* -------------------------
   Sticky click delegation (capture)
------------------------- */
function bindManagerActionsSticky() {
  // always rebind menu toggle (needed after BFCache restore)
  rebindUserMenuToggle();

  // bind the document click handler only once
  if (document.documentElement.dataset.managerActionsBound === "1") return;
  document.documentElement.dataset.managerActionsBound = "1";

  console.log("✅ Binding manager actions (capture delegation)");

  document.addEventListener(
    "click",
    async (e) => {
      if (!isManagerPage()) return;

      // close dropdown if click is outside menu
      if (!e.target.closest(".user-menu")) {
        closeUserMenus();
      }

      const btn = e.target.closest("button, .action-btn");
      if (!btn) return;

      const action = inferActionFromButton(btn);
      if (!action) return;

      // For our routed actions, prevent default + stop competing handlers
      e.preventDefault();
      e.stopImmediatePropagation();

      await handleManagerAction(action);
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

    // clean overlays early
    nukeInvisibleBlockers();

    // protect route
    if (window.auth?.protectRoute) {
      const ok = await window.auth.protectRoute("manager");
      if (!ok) return;
    }

    // init modules if they exist
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

  // BFCache restore: DO NOT clone DOM (it breaks state). Just rebind + cleanup.
  console.log("🔁 pageshow (bfcache?):", !!e.persisted);

  nukeInvisibleBlockers();
  rebindUserMenuToggle();
  // click handler already bound once; no need to reset the flag
  initManagerPage();
});

document.addEventListener("visibilitychange", () => {
  if (!isManagerPage()) return;
  if (document.visibilityState === "visible") {
    nukeInvisibleBlockers();
    rebindUserMenuToggle();
  }
});

console.log("📄 Manager page script loaded");
