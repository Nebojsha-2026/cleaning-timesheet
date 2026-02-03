// src/pages/manager.page.js
console.log("📄 Manager page script loading...");

function isManagerPage() {
  return (window.location.pathname || "").toLowerCase().includes("manager.html");
}

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
   Sticky click delegation
------------------------- */
function bindManagerActionsSticky() {
  if (document.documentElement.dataset.managerActionsBound === "1") return;
  document.documentElement.dataset.managerActionsBound = "1";

  console.log("✅ Binding manager actions (capture delegation)");

  document.addEventListener(
    "click",
    async (e) => {
      if (!isManagerPage()) return;

      const btn = e.target.closest("button, .action-btn");
      if (!btn) return;

      // ✅ First: explicit menu action buttons
      const action = btn.dataset ? btn.dataset.action : null;

      if (action === "help") {
        e.preventDefault();
        e.stopImmediatePropagation();
        showHelpModal();
        return;
      }

      if (action === "settings") {
        e.preventDefault();
        e.stopImmediatePropagation();
        openSettingsPanel();
        return;
      }

      if (action === "logout") {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log("🚪 Logout clicked");
        await doLogout();
        return;
      }

      // ✅ Then: quick action buttons (fallback by label)
      const text = (btn.textContent || "").toLowerCase();

      if (text.includes("create shift")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log("➕ Create shift clicked");
        window.showCreateShiftModal?.();
        return;
      }

      if (text.includes("timesheet")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log("📄 Timesheets clicked");
        window.viewAllTimesheets?.();
        return;
      }

      // Avoid catching "Edit Shifts" as plain "Shifts" if you want
      if (text.trim() === "shifts" || text.includes(" all shifts")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log("📋 Shifts clicked");
        window.showAllShiftsModal?.();
        return;
      }

      if (text.includes("edit shifts")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log("✏️ Edit shifts clicked");
        window.showEditShiftsModal?.();
        return;
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

    // Always clean overlays on init
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

window.addEventListener("pageshow", () => {
  if (!isManagerPage()) return;
  console.log("🔁 pageshow → clean + rebind");
  nukeInvisibleBlockers();
  bindManagerActionsSticky();
  initManagerPage();
});

document.addEventListener("visibilitychange", () => {
  if (!isManagerPage()) return;
  if (document.visibilityState === "visible") {
    nukeInvisibleBlockers();
    // binding is capture + document-level, but keep call for safety
    bindManagerActionsSticky();
  }
});

console.log("📄 Manager page script loaded");
