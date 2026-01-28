// modules/employee-management.js
console.log('👥 Employee Management module loading...');

function getSupabase() {
    return window.supabaseClient || window.supabase;
}

function getCompanyId() {
    // Prefer auth module if present
    if (window.auth && typeof window.auth.getCurrentCompanyId === 'function') {
        return window.auth.getCurrentCompanyId();
    }
    return localStorage.getItem('cleaning_timesheet_company_id') || localStorage.getItem('cleaning_timesheet_company') || null;
}

function makeToken(length = 48) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (x) => chars[x % chars.length]).join('');
}

async function countPendingInvites() {
    const supabase = getSupabase();
    const companyId = getCompanyId();
    if (!supabase || !companyId) return;

    const { count, error } = await supabase
        .from('invitations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('accepted', false);

    if (!error) {
        const el = document.getElementById('statPendingInvites');
        if (el) el.textContent = count || 0;
    }
}

function buildInviteModalHtml() {
    return `
    <div class="modal-content">
        <h2><i class="fas fa-user-plus"></i> Invite Employee</h2>
        <p style="color:#666; margin-top:6px;">
            This will generate an invite link you can copy and send to the employee.
        </p>

        <form id="inviteEmployeeForm" style="margin-top:16px;">
            <div class="form-group">
                <label for="inviteName">Employee Name</label>
                <input type="text" id="inviteName" placeholder="e.g. John Smith" required />
            </div>

            <div class="form-group">
                <label for="inviteEmail">Employee Email</label>
                <input type="email" id="inviteEmail" placeholder="employee@example.com" required />
            </div>

            <div style="margin-top:18px; display:flex; gap:10px;">
                <button type="submit" class="btn btn-primary" style="flex:1;">
                    <i class="fas fa-link"></i> Generate Invite Link
                </button>
                <button type="button" class="btn cancel-btn" style="flex:1; background:#6c757d; color:white;">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </form>

        <div id="inviteResult" style="display:none; margin-top:16px; padding:12px; background:#f6f7fb; border-radius:8px;">
            <h3 style="margin:0 0 10px 0; font-size:1rem;">Invite Link</h3>
            <input type="text" id="inviteLinkOutput" readonly style="width:100%;" />
            <div style="margin-top:10px; display:flex; gap:10px;">
                <button type="button" class="btn btn-primary" id="copyInviteBtn" style="flex:1;">
                    <i class="fas fa-copy"></i> Copy Link
                </button>
                <button type="button" class="btn" id="closeInviteBtn" style="flex:1; background:#6c757d; color:white;">
                    <i class="fas fa-check"></i> Done
                </button>
            </div>
            <p style="margin-top:10px; color:#666; font-size:0.9rem;">
                Send this link to the employee. They will set their password and activate their account.
            </p>
        </div>
    </div>
    `;
}

async function createInvitation(employeeName, employeeEmail) {
    const supabase = getSupabase();
    const companyId = getCompanyId();

    if (!supabase) throw new Error('Supabase not ready');
    if (!companyId) throw new Error('Company not found. Please login again.');

    const token = makeToken(56);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { error } = await supabase
        .from('invitations')
        .insert([{
            company_id: companyId,
            email: employeeEmail.toLowerCase(),
            token,
            role: 'employee',
            expires_at: expiresAt.toISOString(),
            accepted: false
        }]);

    if (error) throw new Error(error.message);

    // Build invite link (GitHub Pages safe)
    const origin = window.location.origin;
    const pathBase = window.location.pathname.replace(/\/[^/]*$/, '/'); // folder path
    const inviteUrl = `${origin}${pathBase}auth/invite-accept.html?token=${encodeURIComponent(token)}`;

    return { token, inviteUrl };
}

// Expose modal trigger (manager.html uses this)
window.showInviteEmployeeModal = function () {
    if (window.auth && typeof window.auth.protectRoute === 'function') {
        const ok = window.auth.protectRoute('manager');
        if (!ok) return;
    }

    if (typeof window.showModal !== 'function' || typeof window.closeModal !== 'function') {
        alert('Modal system not loaded (utils.js).');
        return;
    }

    window.showModal(buildInviteModalHtml());

    const form = document.getElementById('inviteEmployeeForm');
    const cancelBtn = document.querySelector('.cancel-btn');

    cancelBtn?.addEventListener('click', window.closeModal);

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('inviteName').value.trim();
        const email = document.getElementById('inviteEmail').value.trim();

        if (!name || !email) {
            window.showMessage?.('Please fill in name and email', 'error');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const original = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

        try {
            const { inviteUrl } = await createInvitation(name, email);

            const result = document.getElementById('inviteResult');
            const out = document.getElementById('inviteLinkOutput');
            result.style.display = 'block';
            out.value = inviteUrl;

            document.getElementById('copyInviteBtn')?.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(inviteUrl);
                    window.showMessage?.('✅ Link copied!', 'success');
                } catch {
                    out.select();
                    document.execCommand('copy');
                    window.showMessage?.('✅ Link copied!', 'success');
                }
            });

            document.getElementById('closeInviteBtn')?.addEventListener('click', () => {
                window.closeModal();
            });

            window.showMessage?.('✅ Invite link created!', 'success');
            await countPendingInvites();

        } catch (err) {
            console.error(err);
            window.showMessage?.('❌ ' + err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = original;
        }
    });
};

// Auto-refresh pending invite count when manager dashboard loads
document.addEventListener('DOMContentLoaded', () => {
    // only on manager.html
    if ((window.location.pathname || '').includes('manager.html')) {
        setTimeout(countPendingInvites, 1000);
    }
});

console.log('✅ Employee Management module loaded');
