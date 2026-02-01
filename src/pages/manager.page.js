// src/pages/manager.page.js

function showHelpModal() {
  // Use your existing modal system if present
  if (typeof window.showModal === "function") {
    window.showModal(`
      <div class="modal-content">
        <h2>Help</h2>
        <p style="margin-top:10px;color:#666">
          Need help? This is the Worklynx manager dashboard.
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
  // Your script.js already has setupCompanySettingsForm() and expects a form in the DOM. :contentReference[oaicite:2]{index=2}
  // For now: scroll to the settings card/section if it exists, otherwise show message.
  const settings = document.getElementById("companySettingsCard") || document.getElementById("companySettingsForm");

  if (settings) {
    settings.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  // If you have a modal-based settings UI later, we’ll swap this out.
  if (typeof window.showMessage === "function") {
    window.showMessage("Settings panel not found on this page yet.", "info");
  } else {
    alert("Settings panel not found on this page yet.");
  }
}

async function doLogout() {
  // Prefer your auth module logout if present (it also handles the just_logged_out flag). :contentReference[oaicite:3]{index=3}
  if (window.auth && typeof window.auth.logout === "function") {
    await window.auth.logout();
    return;
  }

  // Fallback: try Supabase signOut
  try {
    if (window.supabaseClient?.auth) {
      await window.supabaseClient.auth.signOut();
    }
  } catch (e) {
    console.warn("signOut error:", e?.message || e);
  }

  // Fallback cleanup
  try {
    localStorage.removeItem("cleaning_timesheet_token");
    localStorage.removeItem("cleaning_timesheet_role");
    localStorage.removeItem("cleaning_timesheet_company_id");
  } catch {}

  window.location.href = "login.html";
}

function bindManagerMenu() {
  const dropdown = document.querySelector(".user-menu-dropdown");
  if (!dropdown) return;

  // Bind using event delegation, so we don’t need inline onclick.
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

document.addEventListener("DOMContentLoaded", () => {
  // Only run on manager.html
  if (!(window.location.pathname || "").includes("manager.html")) return;
  bindManagerMenu();
});
