// src/pages/manager.page.js
console.log("📄 Manager page script loading...");

function hideManagerLoader() {
  const loader = document.getElementById("managerLoadingScreen");
  const app = document.getElementById("managerApp");

  if (loader) loader.style.display = "none";
  if (app) app.style.display = "block";

  console.log("✅ Manager UI unlocked");
}

async function initManagerPage() {
  try {
    // 1. Protect route
    if (window.auth && typeof window.auth.protectRoute === "function") {
      const ok = await window.auth.protectRoute("manager");
      if (!ok) return;
    }

    // 2. Wait for shifts module if present
    if (typeof window.initShifts === "function") {
      await window.initShifts();
    }

    // 3. Wait for timesheets module if present
    if (typeof window.initTimesheets === "function") {
      await window.initTimesheets();
    }

    // 4. All core systems are ready → show UI
    hideManagerLoader();
  } catch (err) {
    console.error("❌ Manager init failed:", err);
    window.showMessage?.("Could not load dashboard", "error");
  }
}

// Fire on load
document.addEventListener("DOMContentLoaded", initManagerPage);

// Also fire when Chrome restores the tab (bfcache)
window.addEventListener("pageshow", () => {
  console.log("🔁 pageshow → re-init manager");
  initManagerPage();
});

console.log("📄 Manager page script loaded");
