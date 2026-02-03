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

function bindUserMenu() {
  // toggle
  document.querySelectorAll(".user-menu-button").forEach((btn) => {
    btn.onclick = () => {
      const menu = btn.nextElementSibling;
      if (menu) menu.classList.toggle("open");
    };
  });

  // click outside closes
  document.addEventListener(
    "click",
    (e) => {
      if (e.target.closest(".user-menu")) return;
      document.querySelectorAll(".user-menu-dropdown.open").forEach((m) => m.classList.remove("open"));
    },
    true
  );

  console.log("✅ User menu bound");
}

function showHelpModal() {
  if (!window.showModal) return alert("Modal system not loaded.");
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
  document.getElementById("helpCloseBtn")?.addEventListener("click", () => window.closeModal?.());
}

function openSettingsPanel() {
  const card = document.getElementById("companySettingsCard");
  if (!card) return window.showMessage?.("Settings panel not found", "error");
  card.style.display = "block";
  card.scrollIntoView({ behavior: "smooth", block: "start" });
  window.showMessage?.("Settings opened.", "info");
}

async function routeAction(action) {
  switch (action) {
    case "help":
      showHelpModal();
      return;

    case "settings":
      openSettingsPanel();
      return;

    case "logout":
      console.log("🚪 Logout clicked");
      if (window.auth?.logout) return window.auth.logout();
      window.location.replace("login.html");
      return;

    case "refresh-shifts":
      console.log("🔄 Refresh shifts clicked");
      if (typeof window.loadManagerUpcomingShifts === "function") return window.loadManagerUpcomingShifts();
      if (typeof window.refreshShifts === "function") return window.refreshShifts();
      if (typeof window.initShifts === "function") return window.initShifts();
      window.showMessage?.("Shifts refresh not available yet.", "info");
      return;

    case "invite":
      console.log("✉️ Invite clicked");
      return window.showInviteEmployeeModal?.();

    case "employees":
      console.log("👥 Employees clicked");
      if (typeof window.showEmployeesModal === "function") return window.showEmployeesModal();
      if (typeof window.openEmployeesModal === "function") return window.openEmployeesModal();
      if (typeof window.showEmployeeManagementModal === "function") return window.showEmployeeManagementModal();
      window.showMessage?.("Employees modal not loaded yet.", "error");
      return;

    case "create-shift":
      console.log("➕ Create shift clicked");
      return window.showCreateShiftModal?.();

    case "edit-shifts":
      console.log("✏️ Edit shifts clicked");
      return window.showEditShiftsModal?.();

    case "shifts":
      console.log("📋 Shifts clicked");
      return window.showAllShiftsModal?.();

    case "timesheets":
      console.log("📄 Timesheets clicked");
      return window.viewAllTimesheets?.();

    default:
      return;
  }
}

function bindActionRouter() {
  if (document.documentElement.dataset.managerRouterBound === "1") return;
  document.documentElement.dataset.managerRouterBound = "1";

  document.addEventListener(
    "click",
    async (e) => {
      if (!isManagerPage()) return;

      const el = e.target.closest("[data-action]");
      if (!el) return;

      const action = el.getAttribute("data-action");
      if (!action) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      try {
        await routeAction(action);
      } catch (err) {
        console.error("Action error:", action, err);
        window.showMessage?.("Action failed: " + action, "error");
      }
    },
    true
  );

  console.log("✅ Manager router bound");
}

async function initManager() {
  try {
    if (!isManagerPage()) return;

    // Protect route ONCE (auth.js should handle tab restore delays)
    if (window.auth?.protectRoute) {
      const ok = await window.auth.protectRoute("manager");
      if (!ok) return;
    }

    // init modules if they expose init functions
    if (typeof window.initShifts === "function") await window.initShifts();
    if (typeof window.initTimesheets === "function") await window.initTimesheets();

    hideManagerLoader();
  } catch (err) {
    console.error("❌ Manager init failed:", err);
    window.showMessage?.("Could not load dashboard", "error");
  }
}

function boot() {
  if (!isManagerPage()) return;
  bindUserMenu();
  bindActionRouter();
  initManager();
}

document.addEventListener("DOMContentLoaded", boot);

// BFCache restore (tab switching)
window.addEventListener("pageshow", (e) => {
  if (!isManagerPage()) return;

  // Always rebind menu and router after restore
  bindUserMenu();
  bindActionRouter();

  if (e.persisted) {
    console.log("🔁 BFCache restore -> re-init");
    initManager();
  }
});

console.log("📄 Manager page script loaded");
