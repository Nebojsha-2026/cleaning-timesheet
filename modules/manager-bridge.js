// modules/manager-bridge.js
console.log("🌉 Manager bridge loading...");

// Employees
window.showEmployeesModal = function () {
  if (typeof window.showAllEmployees === "function") {
    window.showAllEmployees();
  } else {
    window.showMessage?.("Employees modal not loaded yet.", "error");
  }
};

// Timesheets
window.viewAllTimesheets = function () {
  if (typeof window.viewTimesheets === "function") {
    window.viewTimesheets();
  } else {
    window.showMessage?.("Timesheets module not ready.", "error");
  }
};

// Shifts
window.showAllShiftsModal = function () {
  if (typeof window.viewAllShifts === "function") {
    window.viewAllShifts();
  } else {
    window.showMessage?.("Shifts module not ready.", "error");
  }
};

window.showEditShiftsModal = function () {
  if (typeof window.openEditShifts === "function") {
    window.openEditShifts();
  } else {
    window.showMessage?.("Edit shifts not ready.", "error");
  }
};

console.log("🌉 Manager bridge ready");
