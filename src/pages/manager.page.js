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

/* -------------------------
   Minimal blocker cleanup (DO NOT delete #managerApp)
------------------------- */
function cleanupBlockers() {
  // Only remove overlays/backdrops that can steal clicks
  const selectors = [
    ".modal-backdrop",
    ".modal-overlay",
    "#modalOverlay",
    "#modalBackdrop",
  ];

  selectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      try {
        el.style.pointerEvents = "none";
        el.remove();
      } catch (_) {}
    });
  });

  // Never kill #managerLoadingScreen here — it's controlled by hideManagerLoader()
  try {
    document.body.style.pointerEvents = "auto";
  } catch (_) {}

  console.log("🧹 Click blockers cleaned");
}

/* -------------------------
   User menu toggle (BFCache safe)
------------------------- */
function bindUserMenu() {
  const btn = document.querySelector(".user-menu-button");
  const dropdown = document.querySelector(".user-menu-dropdown");

  if (!btn || !dropdown) {
    console.warn("⚠️ user menu elements not found");
    return;
  }

  // Toggle
  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropdown.classList.toggle("open");
  };

  // Click outside closes it
  document.addEventListener(
    "click",
    () => dropdown.classList.remove("open"),
    true
  );

  // Clicking inside shouldn't close
  dropdown.addEventListener("click", (e) => e.stopPropagation());
}

/* -------------------------
   Modals / menu actions
------------------------- */
function showHelpModal() {
  if (!window.showModal) return alert("Modal system not loaded.");

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
   ONE click router (capture)
------------------------- */
function bindManagerClicks() {
  if (document.documentElement.dataset.managerClicksBound === "1") return;
  document.documentElement.dataset.managerClicksBound = "1";

  console.log("✅ Binding manager click router (capture)");

  document.addEventListener(
    "click",
    async (e) => {
      if (!isManagerPage()) return;

      const el = e.target.closest("button, .action-btn");
      if (!el) return;

      // 1) Handle menu by data-action (most reliable)
      const action = el.dataset?.action || null;

      if (action) {
        e.preventDefault();
        e.stopImmediatePropagation();

        if (action === "help") return showHelpModal();
        if (action === "settings") return openSettingsPanel();
        if (action === "logout") {
          console.log("🚪 Logout clicked");
          return await doLogout();
        }
      }

      // 2) Handle quick-action buttons by function existence (avoid label matching)
      // This avoids issues when text changes or includes icons.

      // Invite
      if (el.onclick && String(el.onclick).includes("showInviteEmployeeModal")) return;
      if (el.querySelector?.(".fa-user-plus")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log("✉️ Invite clicked");
        return window.showInviteEmployeeModal?.();
      }

      // Employees
      if (el.querySelector?.(".fa-user-friends")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log("👥 Employees clicked");

        if (typeof window.showEmployeesModal === "function") return window.showEmployeesModal();
        if (typeof window.openEmployeesModal === "function") return window.openEmployeesModal();
        if (typeof window.showEmployeeManagementModal === "function") return window.showEmployeeManagementModal();

        return window.showMessage?.("Employees modal not loaded yet.", "error");
      }

      // Create shift
      if (el.querySelector?.(".fa-plus-circle")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log("➕ Create shift clicked");
        return window.showCreateShiftModal?.();
      }

      // Edit shifts
      if (el.querySelector?.(".fa-pen-to-square")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log("✏️ Edit shifts clicked");
        return window.showEditShiftsModal?.();
      }

      // All shifts
      if (el.querySelector?.(".fa-clipboard-list")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log("📋 Shifts clicked");
        return window.showAllShiftsModal?.();
      }

      // Timesheets
      if (el.querySelector?.(".fa-file-invoice-dollar")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log("📄 Timesheets clicked");
        return window.viewAllTimesheets?.();
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

    cleanupBlockers();

    // ✅ Route protection
    if (window.auth?.protectRoute) {
      const ok = await window.auth.protectRoute("manager");
      if (!ok) return; // protectRoute redirects if needed
    }

    // ✅ Init modules (if they exist)
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
function boot() {
  if (!isManagerPage()) return;

  bindUserMenu();
  bindManagerClicks();
  initManagerPage();
}

document.addEventListener("DOMContentLoaded", boot);

// BFCache restore: important for tab switching
window.addEventListener("pageshow", () => {
  if (!isManagerPage()) return;
  console.log("🔁 pageshow → rebind + init");
  // allow rebinding by resetting flags
  document.documentElement.dataset.managerClicksBound = "0";
  bindUserMenu();
  bindManagerClicks();
  initManagerPage();
});

document.addEventListener("visibilitychange", () => {
  if (!isManagerPage()) return;
  if (document.visibilityState === "visible") {
    cleanupBlockers();
    bindUserMenu();
  }
});

console.log("📄 Manager page script loaded");
