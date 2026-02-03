// modules/employee-management.js
console.log("👥 Employee Management module loading...");

function em_getSupabase() {
  if (window.supabaseClient?.auth) return window.supabaseClient;
  throw new Error("Supabase client not initialized (auth.js should create window.supabaseClient).");
}

async function em_getCompanyId() {
  const companyId = localStorage.getItem("cleaning_timesheet_company_id");
  if (companyId) return companyId;

  // fallback from profiles
  const supabase = em_getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error("Not logged in");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  if (!profile?.company_id) throw new Error("No company linked");
  localStorage.setItem("cleaning_timesheet_company_id", profile.company_id);
  return profile.company_id;
}

function em_escape(s) {
  const d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

/* -------------------------
   Invite Employee (your existing one)
------------------------- */
window.showInviteEmployeeModal = async function () {
  try {
    if (!window.showModal) return alert("Modal system not loaded.");

    const companyId = await em_getCompanyId();

    window.showModal(`
      <div class="modal-content">
        <h2><i class="fas fa-user-plus"></i> Invite Employee</h2>
        <p style="color:#666; margin-top:6px;">
          Generate an invite link for your company.
        </p>

        <div style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-primary" id="emGenInvite" style="flex:1; min-width:220px;">
            <i class="fas fa-link"></i> Generate Invite Link
          </button>
          <button class="btn" id="emInviteClose" style="flex:1; min-width:220px; background:#6c757d; color:white;">
            <i class="fas fa-times"></i> Close
          </button>
        </div>

        <div id="emInviteOut" style="margin-top:14px; display:none;">
          <label style="display:block; font-weight:900; margin-bottom:8px;">Invite Link</label>
          <input id="emInviteLink" type="text" readonly style="width:100%;" />
          <button class="btn btn-outline" id="emCopyInvite" style="margin-top:10px; width:100%;">
            <i class="fas fa-copy"></i> Copy
          </button>
        </div>
      </div>
    `);

    document.getElementById("emInviteClose")?.addEventListener("click", () => window.closeModal?.());

    document.getElementById("emGenInvite")?.addEventListener("click", async () => {
      try {
        const inviteUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, "")}/invite-accept.html?company_id=${encodeURIComponent(companyId)}`;
        const out = document.getElementById("emInviteOut");
        const inp = document.getElementById("emInviteLink");
        if (out) out.style.display = "block";
        if (inp) inp.value = inviteUrl;
      } catch (e) {
        console.error(e);
        window.showMessage?.("Could not generate invite link", "error");
      }
    });

    document.getElementById("emCopyInvite")?.addEventListener("click", async () => {
      const v = document.getElementById("emInviteLink")?.value || "";
      try {
        await navigator.clipboard.writeText(v);
        window.showMessage?.("Copied!", "success");
      } catch {
        window.showMessage?.("Copy failed", "error");
      }
    });

  } catch (e) {
    console.error(e);
    window.showMessage?.("Invite system not ready", "error");
  }
};

/* -------------------------
   Employees modal (NEW)
------------------------- */
window.showEmployeesModal = async function () {
  try {
    if (!window.showModal) return alert("Modal system not loaded.");

    const supabase = em_getSupabase();
    const companyId = await em_getCompanyId();

    const { data, error } = await supabase
      .from("staff")
      .select("id, name, email, role, is_active")
      .eq("company_id", companyId)
      .order("name", { ascending: true });

    if (error) throw error;

    const rows = (data || [])
      .map((s) => `
        <div style="padding:10px 12px; border:1px solid #eee; border-radius:12px; margin-bottom:10px;">
          <div style="font-weight:900;">${em_escape(s.name || "No name")}</div>
          <div style="color:#666; font-size:0.92rem;">${em_escape(s.email || "")}</div>
          <div style="margin-top:6px; display:flex; gap:8px; flex-wrap:wrap;">
            <span class="pill pill-info">${em_escape(s.role || "employee")}</span>
            <span class="pill ${s.is_active ? "pill-success" : "pill-warning"}">${s.is_active ? "active" : "inactive"}</span>
          </div>
        </div>
      `)
      .join("");

    window.showModal(`
      <div class="modal-content">
        <h2><i class="fas fa-user-friends"></i> Employees</h2>
        <p style="color:#666; margin-top:6px;">Your company staff list.</p>

        <div style="margin-top:14px; max-height:420px; overflow:auto;">
          ${rows || `<div style="color:#666;">No employees found yet.</div>`}
        </div>

        <div style="margin-top:18px;">
          <button class="btn btn-primary" id="emEmployeesClose" style="width:100%;">Close</button>
        </div>
      </div>
    `);

    document.getElementById("emEmployeesClose")?.addEventListener("click", () => window.closeModal?.());
  } catch (e) {
    console.error(e);
    window.showMessage?.("Employees modal not loaded yet.", "error");
  }
};

console.log("✅ Employee Management module loaded");
