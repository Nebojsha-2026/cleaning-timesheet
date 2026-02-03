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

function bindUserMenuToggle() {
  document.querySelectorAll(".user-menu-button").forEach((btn) => {
    btn.onclick = () => {
      const menu = btn.nextElementSibling;
      if (menu) menu.classList.toggle("open");
    };
  });

  // close if clicking outside
  document.addEventListener("click", (e) => {
    const menuRoot = e.target.closest(".user-menu");
    if (menuRoot) return;
    document.querySelectorAll(".user-menu-dropdown.open").forEach((m) => m.classList.remove("open"));
  }, true);
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
  if (window.auth?.logout) return window.auth.logout();
  window.location.replace("login.html");
}

function bindManagerActions() {
  if (document.documentElement.dataset.managerBound === "1") return;
  document.documentElement.dataset.managerBound = "1";

  console.log("✅ Binding manager actions");

  document.addEventListener("click", async (e) => {
    if (!isManagerPage()) return;

    const btn = e.target.closest("button, .action-btn");
    if (!btn) return;

    // handle menu buttons by data-action
    const action = btn.dataset?.action;

    if (action === "help") {
      e.preventDefault(); e.stopImmediatePropagation();
      showHelpModal();
      return;
    }
    if (action === "settings") {
      e.preventDefault(); e.stopImmediatePropagation();
      openSettingsPanel();
      return;
    }
    if (action === "logout") {
      e.preventDefault(); e.stopImmediatePropagation();
      console.log("🚪 Logout clicked");
      await doLogout();
      return;
    }

    // Quick actions fallback by label (works even if inline onclick breaks)
    const text = (btn.textContent || "").toLowerCase();

    if (text.includes("invite")) {
      e.preventDefault(); e.stopImmediatePropagation();
      window.showInviteEmployeeModal?.();
      return;
    }
    if (text.includes("employees")) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (typeof window.showEmployeesModal === "function") window.showEmployeesModal();
      else window.showMessage?.("Employees modal not loaded yet.", "error");
      return;
    }
    if (text.includes("create shift")) {
      e.preventDefault(); e.stopImmediatePropagation();
      window.showCreateShiftModal?.();
      return;
    }
    if (text.includes("edit shifts")) {
      e.preventDefault(); e.stopImmediatePropagation();
      window.showEditShiftsModal?.();
      return;
    }
    if (text.trim() === "shifts" || text.includes("shifts")) {
      e.preventDefault(); e.stopImmediatePropagation();
      window.showAllShiftsModal?.();
      return;
    }
    if (text.includes("timesheet")) {
      e.preventDefault(); e.stopImmediatePropagation();
      window.viewAllTimesheets?.();
      return;
    }
  }, true);
}

async function initManagerPage() {
  try {
    if (!isManagerPage()) return;

    // only protect once on entry + BFCache restore (not every visibility change)
    if (window.auth?.protectRoute) {
      const ok = await window.auth.protectRoute("manager");
      if (!ok) return;
    }

    if (typeof window.initShifts === "function") await window.initShifts();
    if (typeof window.initTimesheets === "function") await window.initTimesheets();

    hideManagerLoader();
  } catch (err) {
    console.error("❌ Manager init failed:", err);
    window.showMessage?.("Could not load dashboard", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!isManagerPage()) return;
  bindUserMenuToggle();
  bindManagerActions();
  initManagerPage();
});

window.addEventListener("pageshow", (e) => {
  if (!isManagerPage()) return;
  // BFCache restore path
  if (e.persisted) {
    bindUserMenuToggle();
    // don’t rebind document handler (it’s once) but safe:
    bindManagerActions();
    initManagerPage();
  }
});

console.log("📄 Manager page script loaded");
