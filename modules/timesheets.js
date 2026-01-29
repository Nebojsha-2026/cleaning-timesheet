// modules/timesheets.js
console.log('🧾 Timesheets module loading...');

// Handle menu toggle
const menuBtn = document.getElementById('menuBtn');
const userMenu = document.getElementById('userMenu');

if (menuBtn && userMenu) {
  menuBtn.addEventListener('click', () => {
    userMenu.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!menuBtn.contains(e.target) && !userMenu.contains(e.target)) {
      userMenu.classList.remove('active');
    }
  });
}

// Show message helper
function showMessage(message, type = 'success') {
  const container = document.createElement('div');
  container.className = `message ${type}`;
  container.textContent = message;
  document.body.appendChild(container);
  setTimeout(() => container.remove(), 3000);
}

// Create modal
function showModal(content) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = content;
  document.body.appendChild(modal);
}

function closeModal() {
  const modal = document.querySelector('.modal');
  if (modal) modal.remove();
}

let currentCompanyId = localStorage.getItem('cleaning_timesheet_company_id');

// Data load functions (mocked for now)
async function loadStats() {
  console.log('Loading stats...');
}

async function loadRecentEntries() {
  console.log('Loading recent entries...');
}

async function loadLocations() {
  console.log('Loading locations...');
}

// Load timesheets
window.viewTimesheets = async function () {
  const container = document.getElementById('timesheetsContainer');
  if (!container) return;

  container.innerHTML = '<p>Loading timesheets...</p>';
  try {
    const { data, error } = await supabase
      .from('timesheets')
      .select('*')
      .eq('company_id', currentCompanyId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = '<p>No timesheets yet.</p>';
      return;
    }

    container.innerHTML = data
      .map((t) => `
        <div class="timesheet-card">
          <strong>Ref:</strong> ${t.ref_number}<br/>
          <strong>Total Hours:</strong> ${t.total_hours}<br/>
          <strong>Status:</strong> ${t.status}
        </div>
      `)
      .join('');
  } catch (err) {
    container.innerHTML = `<p>Error loading timesheets: ${err.message}</p>`;
  }
};

// Refresh data button
window.refreshData = async function () {
  console.log('🔄 Refreshing data...');
  showMessage('Refreshing data...', 'info');
  await loadStats();
  await loadRecentEntries();
  await loadLocations();
  showMessage('✅ Data refreshed!', 'success');
};

window.generateTimesheet = function () {
  document.getElementById('timesheetForm').scrollIntoView({ behavior: 'smooth' });
};

window.exportData = function () { alert('Export coming soon!'); };
if (typeof window.showSettings !== 'function') {
  window.showSettings = function () { alert('Settings coming soon!'); };
}
if (typeof window.showHelp !== 'function') {
  window.showHelp = function () { alert('Help coming soon!'); };
}

console.log('✅ Timesheets module loaded');
