// src/pages/manager.page.js

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
          <li><b>Timesheets</b> to manage employee submissions.</li>
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

async function doLogout() {
  // Prefer your auth module logout (handles just_logged_out flag)
  if (window.auth && typeof window.auth.logout === "function") {
    await window.auth.logout();
    return;
  }

  // Fallback: Supabase signOut
  try {
    if (window.supabaseClient?.auth) {
      await window.supabaseClient.auth.signOut();
    }
  } catch (e) {
    console.warn("signOut error:", e?.message || e);
  }

  try {
    localStorage.removeItem("cleaning_timesheet_token");
    localStorage.removeItem("cleaning_timesheet_role");
    localStorage.removeItem("cleaning_timesheet_company_id");
  } catch {}

  window.location.href = "login.html";
}

function isManagerPage() {
  return (window.location.pathname || "").includes("manager.html");
}

/**
 * IMPORTANT:
 * Use delegated handler with a wide selector so it works even after bfcache restore,
 * and regardless of whether the menu items are <button>, <a>, <div>, etc.
 */
function ensureManagerMenuBound() {
  if (document.documentElement.dataset.managerMenuBound === "1") return;
  document.documentElement.dataset.managerMenuBound = "1";

  document.addEventListener(
    "click",
    async (e) => {
      if (!isManagerPage()) return;

      // ✅ Wide match: any element with data-action, not just buttons
      const el = e.target.closest("[data-action]");
      if (!el) return;

      const action = el.dataset.action;
      if (!action) return;

      e.preventDefault();

      try {
        if (action === "help") {
          showHelpModal();
          return;
        }

        if (action === "settings") {
          openSettingsPanel();
          return;
        }

        if (action === "logout") {
          await doLogout();
          return;
        }

        // ✅ Create shift (expects manager-shifts.js to attach window.showCreateShiftModal)
        if (action === "create-shift" || action === "createShift" || action === "create_shift") {
          if (typeof window.showCreateShiftModal === "function") {
            await window.showCreateShiftModal();
          } else {
            console.error("showCreateShiftModal is not defined. Is modules/manager-shifts.js loaded?");
            if (typeof window.showMessage === "function") {
              window.showMessage("Create Shift module not loaded.", "error");
            } else {
              alert("Create Shift module not loaded.");
            }
          }
          return;
        }

        // ✅ Timesheets
        // If you have a timesheets page: timesheets.html
        // If you later switch to an in-page panel, update this handler only.
        if (action === "timesheets") {
          window.location.href = "timesheets.html";
          return;
        }

        // Unknown action: no-op, but log so you can see mis-typed values
        console.warn("Unknown manager action:", action);
      } catch (err) {
        console.error(err);
        if (typeof window.showMessage === "function") {
          window.showMessage("❌ " + (err?.message || "Action failed"), "error");
        } else {
          alert(err?.message || "Action failed");
        }
      }
    },
    true // capture: runs even if something stops bubbling
  );
}

/**
 * Optional: support legacy IDs if your HTML doesn't have data-action attributes everywhere.
 * This fixes buttons even if they have ids instead of data-action.
 */
function ensureLegacyButtonBindings() {
  if (!isManagerPage()) return;

  const bind = (id, handler) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.onclick = handler; // overwrite to prevent duplicates
  };

  bind("logoutBtn", async (e) => {
    e?.preventDefault();
    await doLogout();
  });

  bind("createShiftBtn", async (e) => {
    e?.preventDefault();
    if (typeof window.showCreateShiftModal === "function") {
      await window.showCreateShiftModal();
    }
  });

  bind("timesheetsBtn", (e) => {
    e?.preventDefault();
    window.location.href = "timesheets.html";
  });

  bind("settingsBtn", (e) => {
    e?.preventDefault();
    openSettingsPanel();
  });

  bind("helpBtn", (e) => {
    e?.preventDefault();
    showHelpModal();
  });
}

function bootManagerPage() {
  if (!isManagerPage()) return;

  ensureManagerMenuBound();
  ensureLegacyButtonBindings(); // safe, no harm if ids don't exist
}

document.addEventListener("DOMContentLoaded", bootManagerPage);

// ✅ Fires on bfcache restore (tab switch, back/forward)
window.addEventListener("pageshow", bootManagerPage);

// ✅ Extra safety: when tab becomes visible again
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") bootManagerPage();
});
