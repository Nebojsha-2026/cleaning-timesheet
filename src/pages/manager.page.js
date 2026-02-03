// src/pages/manager.page.js
console.log("📄 Manager page script loading...");

function isManagerPage() {
  return (window.location.pathname || "").includes("manager.html");
}

function hideManagerLoader() {
  const loader = document.getElementById("managerLoadingScreen");
  const app = document.getElementById("managerApp");

  if (loader) loader.style.display = "none";
  if (app) app.style.display = "block";

  console.log("✅ Manager UI unlocked");
}

async function initManagerPage() {
  try {
    if (!isManagerPage()) return;

    // Protect route
    if (window.auth?.protectRoute) {
      const ok = await window.auth.protectRoute("manager");
      if (!ok) return;
    }

    // Init modules if present
    if (typeof window.initShifts === "function") await window.initShifts();
    if (typeof window.initTimesheets === "function") await window.initTimesheets();

    hideManagerLoader();
  } catch (err) {
    console.error("❌ Manager init failed:", err);
    window.showMessage?.("Could not load dashboard", "error");
  }
}

/* ============================
   STICKY GLOBAL ACTION BINDING
   ============================ */

function bindManagerActionsSticky() {
  if (document.documentElement.dataset.managerBound === "1") return;
  document.documentElement.dataset.managerBound = "1";

  document.addEventListener(
    "click",
    async (e) => {
      if (!isManagerPage()) return;

      const btn = e.target.closest("button, .action-btn");
      if (!btn) return;

      const text = (btn.textContent || "").toLowerCase();
      const action = btn.dataset?.action || "";

      // MENU (3-line)
      if (action === "help") {
        e.stopImmediatePropagation();
        showHelpModal();
        return;
      }

      if (action === "settings") {
        e.stopImmediatePropagation();
        openSettingsPanel();
        return;
      }

      if (action === "logout") {
        e.stopImmediatePropagation();
        await doLogout();
        return;
      }

      // QUICK ACTIONS
      if (text.includes("timesheet")) {
        e.stopImmediatePropagation();
        viewAllTimesheets();
      }

      if (text.includes("create shift")) {
        e.stopImmediatePropagation();
        showCreateShiftModal();
      }

      if (text.includes("shifts")) {
        e.stopImmediatePropagation();
        showAllShiftsModal();
      }
    },
    true // CAPTURE so Chrome tab restore can’t block it
  );

  console.log("✅ Binding manager actions (capture delegation + fallbacks)");
}

/* ============================
   HELP / SETTINGS / LOGOUT
   ============================ */

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
        <button class="btn btn-primary" id="helpCloseBtn" style="flex:1">
          Close
        </button>
      </div>
    </div>
  `);

  document.getElementById("helpCloseBtn")?.addEventListener("click", () => {
    window.closeModal?.();
  });
}

function openSettingsPanel() {
  const card = document.getElementById("companySettingsCard");
  if (!card) return window.showMessage?.("Settings panel not found", "error");

  card.style.display = "block";
  card.scrollIntoView({ behavior: "smooth", block: "start" });
  window.showMessage?.("Settings opened.", "info");
}

async function doLogout() {
  if (window.auth?.logout) {
    await window.auth.logout();
    return;
  }
  window.location.href = "login.html";
}

/* ============================
   LIFECYCLE
   ============================ */

document.addEventListener("DOMContentLoaded", () => {
  initManagerPage();
  bindManagerActionsSticky();
});

window.addEventListener("pageshow", () => {
  console.log("🔁 pageshow → rebind + reinit");
  initManagerPage();
  bindManagerActionsSticky();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    bindManagerActionsSticky();
  }
});

console.log("📄 Manager page script loaded");
