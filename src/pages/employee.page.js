// src/pages/employee.page.js
console.log("📄 Employee page script loading...");

function isEmployeePage() {
  return (window.location.pathname || "").toLowerCase().includes("employee.html");
}

function cleanupBlockers() {
  const selectors = [
    ".modal-backdrop",
    ".modal-overlay",
    "#modalOverlay",
    "#modalBackdrop",
  ];

  selectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      try {
        el.style.pointerEvents = "none";
        el.remove();
      } catch (_) {}
    });
  });

  try {
    document.body.style.pointerEvents = "auto";
  } catch (_) {}

  console.log("🧹 Employee blockers cleaned");
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

function bindEmployeeClicks() {
  if (document.documentElement.dataset.employeeClicksBound === "1") return;
  document.documentElement.dataset.employeeClicksBound = "1";

  console.log("✅ Binding employee click router (capture)");

  document.addEventListener(
    "click",
    async (e) => {
      if (!isEmployeePage()) return;

      const el = e.target.closest("button, .action-btn");
      if (!el) return;

      const action = el.dataset?.action || null;
      if (action === "logout") {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log("🚪 Logout clicked (employee)");
        return await doLogout();
      }
    },
    true
  );
}

async function initEmployeePage() {
  try {
    if (!isEmployeePage()) return;

    cleanupBlockers();

    if (window.auth?.protectRoute) {
      const ok = await window.auth.protectRoute("employee");
      if (!ok) return;
    }

    // If you have init functions, call them safely
    if (typeof window.initShifts === "function") await window.initShifts();
    if (typeof window.initTimesheets === "function") await window.initTimesheets();

    console.log("✅ Employee page ready");
  } catch (err) {
    console.error("❌ Employee init failed:", err);
    window.showMessage?.("Could not load employee page", "error");
  }
}

function boot() {
  if (!isEmployeePage()) return;
  bindEmployeeClicks();
  initEmployeePage();
}

document.addEventListener("DOMContentLoaded", boot);

window.addEventListener("pageshow", () => {
  if (!isEmployeePage()) return;
  console.log("🔁 pageshow → rebind employee");
  document.documentElement.dataset.employeeClicksBound = "0";
  bindEmployeeClicks();
  initEmployeePage();
});

document.addEventListener("visibilitychange", () => {
  if (!isEmployeePage()) return;
  if (document.visibilityState === "visible") cleanupBlockers();
});

console.log("📄 Employee page script loaded");
