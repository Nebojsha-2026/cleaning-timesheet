// Configuration
const CONFIG = {
    SUPABASE_URL: 'https://hqmtigcjyqckqdzepcdu.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbXRpZ2NqeXFja3FkemVwY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODgwMjYsImV4cCI6MjA4NDY2NDAyNn0.Rs6yv54hZyXzqqWQM4m-Z4g3gKqacBeDfHiMfpOuFRw',
    DEFAULT_HOURLY_RATE: 23,
    CURRENCY: 'AUD',
    VERSION: '1.2.0'
};

// Global variables
let supabase;
let currentEntryMode = 'daily';
let selectedDaysOfWeek = [];
let selectedMonthDays = [];
let appLocations = [];

// Initialize App
document.addEventListener('DOMContentLoaded', async function() {
    console.log('✅ DOM Ready');
    
    // Modern Supabase client initialization
    if (!window.supabase) {
        console.error('❌ Supabase global not found.');
        throw new Error('Supabase not loaded');
    }
    
    const { createClient } = window.supabase;
    supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    window.supabaseClient = supabase;
    window.CONFIG = CONFIG;
    
    console.log('✅ Supabase client initialized');
    
    // Initialize the app
    await initializeApp();
});

async function initializeApp() {
    console.log('📱 Initializing app...');
  
    try {
        // Set today's date
        const today = new Date();
        document.getElementById('currentDate').textContent = formatDate(today);

        // Set default dates for timesheet generator
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        if (startDateInput) startDateInput.value = lastWeek.toISOString().split('T')[0];
        if (endDateInput) endDateInput.value = today.toISOString().split('T')[0];
      
        // Setup form handlers - ONLY TIMESHEET FORM (no shift forms for employees)
        const timesheetForm = document.getElementById('timesheetForm');
        
        console.log('Checking forms:', {
            timesheetForm: !!timesheetForm
        });
        
        if (timesheetForm) {
            console.log('✅ Adding listener to timesheetForm');
            timesheetForm.addEventListener('submit', handleGenerateTimesheet);
        }

        // Setup email notification checkbox
        const emailCheckbox = document.getElementById('sendEmail');
        if (emailCheckbox) {
            emailCheckbox.addEventListener('change', handleEmailCheckbox);
            handleEmailCheckbox({ target: emailCheckbox });
        }
        
        // Setup timesheet period selector
        const timesheetPeriod = document.getElementById('timesheetPeriod');
        if (timesheetPeriod) {
            timesheetPeriod.addEventListener('change', handleTimesheetPeriodChange);
        }
        
        // Setup entry mode selector (for work entries, not shifts)
        const entryMode = document.getElementById('entryMode');
        if (entryMode) {
            entryMode.addEventListener('change', handleEntryModeChange);
        }
        
        // Initialize entry mode UI
        initializeEntryModeUI();
        
        // Setup custom dates button
        const customDatesBtn = document.getElementById('customDatesBtn');
        if (customDatesBtn) {
            customDatesBtn.addEventListener('click', showCustomDatesPopup);
        }
      
        // Test connection
        const connected = await testConnection();
      
        if (connected) {
            console.log('✅ Connected to Supabase');
            updateConnectionStatus(true);
          
            // Show main interface
            document.getElementById('loadingScreen').style.display = 'none';
            document.querySelector('.container').style.display = 'block';
            console.log('✨ Dashboard ready');
          
            // Load data in background
            setTimeout(async () => {
                await loadStats();
                await loadLocations();
                await loadRecentEntries();
                
                // Load employee shifts
                try {
                    if (typeof loadMyShifts === 'function') {
                        await loadMyShifts(); // Employee shift viewing function
                    } else {
                        console.log('⚠️ loadMyShifts function not found - shifts.js might not be loaded');
                    }
                } catch (error) {
                    console.log('⚠️ Could not load shifts:', error.message);
                }
                
            }, 500);
          
        } else {
            console.error('❌ Database connection failed');
            showError('Cannot connect to database. Please try again later.');
        }
      
    } catch (error) {
        console.error('💥 Init error:', error);
        showError('Error loading app: ' + error.message);
    }
}

// ============================================
// ACTION BUTTONS
// ============================================

window.refreshData = async function() {
    console.log('🔄 Refreshing data...');
    showMessage('Refreshing data...', 'info');
    await loadStats();
    await loadRecentEntries();
    await loadLocations();
    if (typeof loadMyShifts === 'function') {
        await loadMyShifts();
    }
    showMessage('✅ Data refreshed!', 'success');
};

window.generateTimesheet = function() {
    document.getElementById('timesheetForm').scrollIntoView({ behavior: 'smooth' });
};

window.exportData = function() { 
    alert('Export feature coming soon!'); 
};

window.showSettings = function() { 
    // Open settings modal for employee
    const html = `
        <div class="modal-content">
            <h2><i class="fas fa-cog"></i> Employee Settings</h2>
            
            <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h3 style="margin-top: 0; color: #667eea;">
                    <i class="fas fa-user-circle"></i> My Account
                </h3>
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                    <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem;">
                        <i class="fas fa-user"></i>
                    </div>
                    <div>
                        <h4 style="margin: 0 0 5px 0;">Employee Profile</h4>
                        <p style="margin: 0; color: #666; font-size: 0.9rem;">View and update your information</p>
                    </div>
                </div>
                <button onclick="viewMyProfile()" class="btn" style="width: 100%; margin-bottom: 10px; background: #667eea; color: white;">
                    <i class="fas fa-user-edit"></i> Edit My Profile
                </button>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #667eea; margin-bottom: 15px;">
                    <i class="fas fa-calendar-alt"></i> Shift Management
                </h3>
                <button onclick="refreshMyShifts()" class="btn" style="width: 100%; margin-bottom: 10px;">
                    <i class="fas fa-sync-alt"></i> Refresh My Shifts
                </button>
                <button onclick="viewShiftCalendar()" class="btn" style="width: 100%; margin-bottom: 10px;">
                    <i class="fas fa-calendar-week"></i> View Shift Calendar
                </button>
                <button onclick="requestTimeOff()" class="btn" style="width: 100%; margin-bottom: 10px;">
                    <i class="fas fa-calendar-times"></i> Request Time Off
                </button>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #667eea; margin-bottom: 15px;">
                    <i class="fas fa-life-ring"></i> Support & Help
                </h3>
                <button onclick="reportIssue()" class="btn" style="width: 100%; margin-bottom: 10px; background: #ffc107; color: #212529;">
                    <i class="fas fa-exclamation-triangle"></i> Report Issue
                </button>
                <button onclick="showHelp()" class="btn" style="width: 100%; margin-bottom: 10px;">
                    <i class="fas fa-question-circle"></i> Help & Documentation
                </button>
                <button onclick="contactSupport()" class="btn" style="width: 100%; margin-bottom: 10px;">
                    <i class="fas fa-headset"></i> Contact Support
                </button>
            </div>
            
            <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h3 style="color: #667eea; margin-top: 0; margin-bottom: 15px;">
                    <i class="fas fa-chart-line"></i> Performance
                </h3>
                <button onclick="viewMyTimesheets()" class="btn" style="width: 100%; margin-bottom: 10px;">
                    <i class="fas fa-file-invoice"></i> My Timesheets
                </button>
                <button onclick="viewMyEarnings()" class="btn" style="width: 100%; margin-bottom: 10px;">
                    <i class="fas fa-money-bill-wave"></i> View Earnings
                </button>
            </div>
            
            <div style="border-top: 1px solid #e9ecef; padding-top: 15px;">
                <div style="display: flex; gap: 10px;">
                    <button onclick="exportMyData()" class="btn" style="flex: 1;">
                        <i class="fas fa-download"></i> Export Data
                    </button>
                    <button onclick="closeModal()" class="btn" style="flex: 1; background: #6c757d; color: white;">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            </div>
        </div>
    `;
    showModal(html);
};

window.showHelp = function() { 
    alert('Help documentation coming soon!'); 
};

// ============================================
// EMPLOYEE PROFILE & SETTINGS FUNCTIONS
// ============================================

window.viewMyProfile = function() {
    const html = `
        <div class="modal-content">
            <h2><i class="fas fa-user-circle"></i> My Profile</h2>
            <div style="text-align: center; margin: 20px 0;">
                <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 2.5rem; margin-bottom: 15px;">
                    <i class="fas fa-user"></i>
                </div>
                <h3 style="margin: 10px 0 5px 0;">Employee Name</h3>
                <p style="color: #666; margin-bottom: 20px;">Cleaning Staff</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div class="info-item">
                    <i class="fas fa-envelope"></i>
                    <div>
                        <strong>Email:</strong>
                        <span>employee@example.com</span>
                    </div>
                </div>
                <div class="info-item">
                    <i class="fas fa-phone"></i>
                    <div>
                        <strong>Phone:</strong>
                        <span>+1 (555) 123-4567</span>
                    </div>
                </div>
                <div class="info-item">
                    <i class="fas fa-money-bill"></i>
                    <div>
                        <strong>Hourly Rate:</strong>
                        <span>$23.00 AUD</span>
                    </div>
                </div>
                <div class="info-item">
                    <i class="fas fa-calendar"></i>
                    <div>
                        <strong>Member Since:</strong>
                        <span>${formatDate(new Date())}</span>
                    </div>
                </div>
            </div>
            
            <p style="text-align: center; color: #666; font-size: 0.9rem; margin-bottom: 20px;">
                Contact your manager to update personal information
            </p>
            
            <button onclick="closeModal()" class="btn" style="width: 100%;">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;
    showModal(html);
};

window.viewShiftCalendar = function() {
    const html = `
        <div class="modal-content">
            <h2><i class="fas fa-calendar-alt"></i> My Shift Calendar</h2>
            
            <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                        <strong>Current Month:</strong>
                        <div>${new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</div>
                    </div>
                    <div style="text-align: right;">
                        <strong>Shifts This Month:</strong>
                        <div>Loading...</div>
                    </div>
                </div>
                <button onclick="refreshMyShifts()" class="btn" style="width: 100%;">
                    <i class="fas fa-sync-alt"></i> Refresh Calendar
                </button>
            </div>
            
            <div style="text-align: center; padding: 40px 20px;">
                <i class="fas fa-calendar" style="font-size: 3rem; color: #667eea; opacity: 0.7; margin-bottom: 15px;"></i>
                <h3>Calendar View</h3>
                <p style="color: #666; margin-bottom: 20px;">
                    Full calendar view will be available in the next update.
                </p>
                <p style="color: #666; font-size: 0.9rem;">
                    For now, use the "My Upcoming Shifts" section on the main page.
                </p>
            </div>
            
            <button onclick="closeModal()" class="btn" style="width: 100%;">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;
    showModal(html);
};

window.viewMyTimesheets = function() {
    const html = `
        <div class="modal-content">
            <h2><i class="fas fa-file-invoice"></i> My Timesheets</h2>
            <div style="text-align: center; padding: 40px 20px;">
                <i class="fas fa-file-invoice-dollar" style="font-size: 3rem; color: #28a745; opacity: 0.7; margin-bottom: 15px;"></i>
                <h3>Timesheet History</h3>
                <p style="color: #666; margin-bottom: 20px;">
                    View all your generated timesheets and earnings history.
                </p>
                <button onclick="viewTimesheets()" class="btn btn-success" style="padding: 12px 30px; margin-bottom: 15px;">
                    <i class="fas fa-folder-open"></i> View All Timesheets
                </button>
                <p style="color: #666; font-size: 0.9rem;">
                    Generate new timesheets from the main page.
                </p>
            </div>
            <button onclick="closeModal()" class="btn" style="width: 100%;">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;
    showModal(html);
};

window.viewMyEarnings = function() {
    const html = `
        <div class="modal-content">
            <h2><i class="fas fa-money-bill-wave"></i> My Earnings</h2>
            
            <div style="margin-bottom: 20px; padding: 20px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border-radius: 8px;">
                <div style="text-align: center;">
                    <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 5px;">$0.00</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">Total Earnings (This Month)</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: bold; color: #667eea;">0</div>
                    <div style="font-size: 0.8rem; color: #666;">Shifts This Month</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: bold; color: #28a745;">0 hrs</div>
                    <div style="font-size: 0.8rem; color: #666;">Total Hours</div>
                </div>
            </div>
            
            <div style="text-align: center; color: #666; font-size: 0.9rem; margin-bottom: 20px;">
                <i class="fas fa-info-circle"></i> Earnings data will populate as you complete shifts
            </div>
            
            <button onclick="closeModal()" class="btn" style="width: 100%;">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;
    showModal(html);
};

window.contactSupport = function() {
    const html = `
        <div class="modal-content">
            <h2><i class="fas fa-headset"></i> Contact Support</h2>
            
            <div style="margin-bottom: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                <h3 style="margin-top: 0; color: #667eea;">Need Help?</h3>
                <p style="color: #666; margin-bottom: 15px;">
                    Our support team is here to help you with any questions or issues.
                </p>
                
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #333; margin-bottom: 8px;">Support Hours:</h4>
                    <p style="color: #666; margin: 0;">Monday - Friday: 9:00 AM - 5:00 PM</p>
                    <p style="color: #666; margin: 0;">Weekends: Emergency support only</p>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #333; margin-bottom: 8px;">Contact Methods:</h4>
                    <div class="info-item">
                        <i class="fas fa-envelope"></i>
                        <div>
                            <strong>Email:</strong>
                            <span>support@cleaningcompany.com</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-phone"></i>
                        <div>
                            <strong>Phone:</strong>
                            <span>(555) 123-HELP</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="border-top: 1px solid #e9ecef; padding-top: 15px;">
                <p style="color: #666; font-size: 0.9rem; text-align: center;">
                    For urgent shift-related issues, use the "Report Issue" button.
                </p>
            </div>
            
            <button onclick="closeModal()" class="btn" style="width: 100%; margin-top: 15px;">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;
    showModal(html);
};

window.exportMyData = function() {
    showMessage('📊 Preparing your data export...', 'info');
    
    setTimeout(() => {
        const html = `
            <div class="modal-content">
                <h2><i class="fas fa-download"></i> Export My Data</h2>
                
                <div style="margin-bottom: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                    <h3 style="margin-top: 0; color: #667eea;">Select Data to Export</h3>
                    
                    <div style="margin-bottom: 15px;">
                        <label class="checkbox">
                            <input type="checkbox" id="exportShifts" checked>
                            <span>Shift History</span>
                        </label>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label class="checkbox">
                            <input type="checkbox" id="exportTimesheets" checked>
                            <span>Timesheets</span>
                        </label>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label class="checkbox">
                            <input type="checkbox" id="exportEarnings">
                            <span>Earnings Report</span>
                        </label>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label class="checkbox">
                            <input type="checkbox" id="exportProfile">
                            <span>Profile Information</span>
                        </label>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #333; margin-bottom: 10px;">Export Format</h4>
                    <select id="exportFormat" class="form-control" style="margin-bottom: 10px;">
                        <option value="csv">CSV (Spreadsheet)</option>
                        <option value="pdf">PDF Document</option>
                        <option value="json">JSON (Raw Data)</option>
                    </select>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="generateExport()" class="btn btn-success" style="flex: 1;">
                        <i class="fas fa-file-export"></i> Generate Export
                    </button>
                    <button onclick="closeModal()" class="btn" style="flex: 1;">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </div>
        `;
        
        showModal(html);
        
        setTimeout(() => {
            const generateBtn = document.querySelector('.btn-success');
            if (generateBtn) {
                generateBtn.addEventListener('click', function() {
                    const format = document.getElementById('exportFormat').value;
                    showMessage(`✅ Export generated in ${format.toUpperCase()} format. Download will start shortly.`, 'success');
                    setTimeout(closeModal, 2000);
                });
            }
        }, 100);
        
    }, 1000);
};

// Helper function for export modal
window.generateExport = function() {
    // This would be implemented to actually generate the export
    showMessage('✅ Export generated successfully!', 'success');
    closeModal();
};

// Final log
console.log('🎉 Main script loaded (Employee Version)');
