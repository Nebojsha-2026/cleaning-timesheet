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

async function doLogout() {
  try {
    await window.auth?.logout?.();
  } catch (e) {
    console.warn("logout failed:", e?.message || e);
    window.location.replace("login.html?logged_out=1");
  }
}

function bindMenuToggle() {
  document.querySelectorAll(".user-menu-button").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const menu = btn.nextElementSibling;
      if (menu) menu.classList.toggle("open");
    };
  });

  // close on outside click
  document.addEventListener(
    "click",
    (e) => {
      document.querySelectorAll(".user-menu-dropdown.open").forEach((menu) => {
        if (!menu.contains(e.target) && !menu.previousElementSibling?.contains(e.target)) {
          menu.classList.remove("open");
        }
      });
    },
    true
  );
}

async function handleAction(action) {
  switch (action) {
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

    case "refresh-shifts":
      if (typeof window.loadManagerUpcomingShifts === "function") return await window.loadManagerUpcomingShifts();
      if (typeof window.refreshShifts === "function") return await window.refreshShifts();
      if (typeof window.initShifts === "function") return await window.initShifts();
      return window.showMessage?.("Shifts refresh not available yet.", "info");

    case "invite":
      return window.showInviteEmployeeModal?.();

    case "employees":
      if (typeof window.showEmployeesModal === "function") return window.showEmployeesModal();
      if (typeof window.openEmployeesModal === "function") return window.openEmployeesModal();
      return window.showMessage?.("Employees modal not loaded yet.", "error");

    case "create-shift":
      return window.showCreateShiftModal?.();

    case "edit-shifts":
      return window.showEditShiftsModal?.();

    case "shifts":
      return window.showAllShiftsModal?.();

    case "timesheets":
      return window.viewAllTimesheets?.();

    default:
      return;
  }
}

function bindActionDelegation() {
  if (document.documentElement.dataset.managerBound === "1") return;
  document.documentElement.dataset.managerBound = "1";

  console.log("✅ Binding manager actions (data-action delegation)");

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
      await handleAction(action);
    },
    true
  );
}

let initRunning = false;

async function initManagerPage() {
  if (!isManagerPage()) return;
  if (initRunning) return;
  initRunning = true;

  try {
    const ok = await window.auth?.protectRoute?.("manager");
    if (!ok) return;

    if (typeof window.initShifts === "function") await window.initShifts();
    if (typeof window.initTimesheets === "function") await window.initTimesheets();

    hideManagerLoader();
  } catch (err) {
    console.error("❌ Manager init failed:", err);
    window.showMessage?.("Could not load dashboard", "error");
  } finally {
    initRunning = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!isManagerPage()) return;
  bindMenuToggle();
  bindActionDelegation();
  initManagerPage();
});

// BFCache/tab restore
window.addEventListener("pageshow", () => {
  if (!isManagerPage()) return;
  bindMenuToggle();
  initManagerPage();
});

document.addEventListener("visibilitychange", () => {
  if (!isManagerPage()) return;
  if (document.visibilityState === "visible") {
    bindMenuToggle();
  }
});

console.log("📄 Manager page script loaded");
