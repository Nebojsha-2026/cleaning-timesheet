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
  // Manager page contains this but it's hidden by default in manager.html
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
  // Prefer your existing auth module logout (it handles just_logged_out flag).
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

  // Cleanup local keys (fallback only)
  try {
    localStorage.removeItem("cleaning_timesheet_token");
    localStorage.removeItem("cleaning_timesheet_role");
    localStorage.removeItem("cleaning_timesheet_company_id");
  } catch {}

  window.location.href = "login.html";
}

function ensureManagerMenuBound() {
  const dropdown = document.querySelector(".user-menu-dropdown");
  if (!dropdown) return;

  // Prevent duplicate listeners (important when page is restored from cache)
  if (dropdown.dataset.bound === "1") return;
  dropdown.dataset.bound = "1";

  dropdown.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;
    if (!action) return;

    e.preventDefault();

    if (action === "help") showHelpModal();
    if (action === "settings") openSettingsPanel();
    if (action === "logout") await doLogout();
  });
}

function isManagerPage() {
  return (window.location.pathname || "").includes("manager.html");
}

document.addEventListener("DOMContentLoaded", () => {
  if (!isManagerPage()) return;
  ensureManagerMenuBound();
});

// Fires when Chrome restores the page after tab switching / back-forward cache
window.addEventListener("pageshow", () => {
  if (!isManagerPage()) return;
  ensureManagerMenuBound();
});
