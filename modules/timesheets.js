// Timesheets module - handles all timesheet-related operations

// Generate Timesheet
async function handleGenerateTimesheet(event) {
    event.preventDefault();
  
    const button = event.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
  
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    button.disabled = true;
  
    try {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const sendEmail = document.getElementById('sendEmail').checked;
        const emailAddress = sendEmail ? document.getElementById('emailAddress')?.value.trim() : null;
      
        if (!startDate || !endDate) throw new Error('Please select start and end dates');
        if (sendEmail && (!emailAddress || !validateEmail(emailAddress))) {
            throw new Error('Please enter a valid email address');
        }
      
        const { data: entries, error: entriesError } = await supabase
            .from('entries')
            .select(`
                *,
                locations (name, hourly_rate)
            `)
            .gte('work_date', startDate)
            .lte('work_date', endDate)
            .order('work_date', { ascending: true });
      
        if (entriesError) throw entriesError;
        if (!entries?.length) throw new Error('No entries found for selected period');
      
        const totalHours = entries.reduce((sum, e) => sum + parseFloat(e.hours), 0);
        const totalEarnings = entries.reduce((sum, e) => {
            const rate = e.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE;
            return sum + (parseFloat(e.hours) * rate);
        }, 0).toFixed(2);
      
        const refNumber = 'TS' + new Date().getTime().toString().slice(-6);
      
        // Prepare insert data - only include email fields if sending email
        const insertData = {
            ref_number: refNumber, 
            start_date: startDate, 
            end_date: endDate, 
            total_hours: totalHours, 
            total_earnings: totalEarnings
        };
        
        if (sendEmail) {
            insertData.email_sent = true;
            insertData.email_address = emailAddress;
        }
      
        const { data: timesheet, error: tsError } = await supabase
            .from('timesheets')
            .insert([insertData])
            .select()
            .single();
      
        if (tsError) throw tsError;
      
        // Prepare timesheet details for display/email
        const timesheetDetails = {
            refNumber,
            startDate,
            endDate,
            totalHours: totalHours.toFixed(2),
            totalEarnings,
            entriesCount: entries.length,
            entries: entries.map(entry => ({
                date: formatDate(entry.work_date),
                location: entry.locations?.name || 'Unknown',
                hours: entry.hours,
                rate: entry.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE,
                earnings: (entry.hours * (entry.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE)).toFixed(2),
                notes: entry.notes || ''
            }))
        };
      
        showMessage(`✅ Timesheet ${refNumber} generated!`, 'success');
        await loadStats();
      
        // Show timesheet details
        viewTimesheetDetails(timesheetDetails);
      
        // Send email if requested
        if (sendEmail && emailAddress) {
            await sendTimesheetEmail(timesheetDetails, emailAddress);
        }
      
    } catch (error) {
        console.error('❌ Timesheet error:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Send timesheet email
async function sendTimesheetEmail(timesheetDetails, emailAddress) {
    try {
        // For now, we'll show a message that email would be sent
        // In a real app, you would integrate with an email service like SendGrid, etc.
        console.log('📧 Would send timesheet to:', emailAddress);
        console.log('Timesheet details:', timesheetDetails);
        
        // Show a message that email functionality is coming soon
        setTimeout(() => {
            showMessage(`📧 Timesheet summary would be sent to ${emailAddress} (Email integration coming soon!)`, 'info');
        }, 1000);
        
        return true;
    } catch (error) {
        console.error('❌ Email error:', error);
        showMessage('⚠️ Could not send email (feature in development)', 'info');
        return false;
    }
}

// View timesheet details
function viewTimesheetDetails(timesheetDetails) {
    let entriesHtml = '';
    timesheetDetails.entries.forEach(entry => {
        entriesHtml += `
            <div style="padding: 10px 0; border-bottom: 1px solid #eee;">
                <div style="display: flex; justify-content: space-between;">
                    <div>
                        <strong>${entry.date}</strong> • ${entry.location}
                        ${entry.notes ? `<br><small>${escapeHtml(entry.notes)}</small>` : ''}
                    </div>
                    <div style="text-align: right;">
                        ${entry.hours} hrs @ $${entry.rate}/hr<br>
                        <strong>$${entry.earnings}</strong>
                    </div>
                </div>
            </div>
        `;
    });
  
    const html = `
        <div class="modal-content">
            <h2>Timesheet ${timesheetDetails.refNumber}</h2>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <div>
                        <strong>Period:</strong><br>
                        ${formatDate(timesheetDetails.startDate)} to ${formatDate(timesheetDetails.endDate)}
                    </div>
                    <div style="text-align: right;">
                        <strong>Total Hours:</strong><br>
                        ${timesheetDetails.totalHours} hrs
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <div>
                        <strong>Total Earnings:</strong><br>
                        $${timesheetDetails.totalEarnings}
                    </div>
                    <div style="text-align: right;">
                        <strong>Entries:</strong><br>
                        ${timesheetDetails.entriesCount}
                    </div>
                </div>
            </div>
            
            <h3>Entries</h3>
            <div style="max-height: 300px; overflow-y: auto; margin-bottom: 20px;">
                ${entriesHtml}
            </div>
            
            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <button onclick="printTimesheet('${timesheetDetails.refNumber}', ${JSON.stringify(timesheetDetails).replace(/'/g, "\\'")})" class="btn btn-primary" style="flex:1;">
                    <i class="fas fa-print"></i> Print/Export
                </button>
                <button onclick="closeModal()" class="btn" style="flex:1;">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        </div>
    `;
  
    showModal(html);
}

// Print timesheet - Updated with beautiful formatting
window.printTimesheet = function(refNumber, timesheetDetails) {
    // Parse the timesheetDetails if it's a string
    if (typeof timesheetDetails === 'string') {
        timesheetDetails = JSON.parse(timesheetDetails);
    }
    
    const printWindow = window.open('', '_blank');
    
    // Calculate subtotals by location
    const locationTotals = {};
    timesheetDetails.entries.forEach(entry => {
        if (!locationTotals[entry.location]) {
            locationTotals[entry.location] = {
                hours: 0,
                earnings: 0
            };
        }
        locationTotals[entry.location].hours += parseFloat(entry.hours);
        locationTotals[entry.location].earnings += parseFloat(entry.earnings);
    });
    
    // Create location summary HTML
    let locationSummaryHtml = '';
    Object.keys(locationTotals).forEach(location => {
        locationSummaryHtml += `
            <tr>
                <td>${location}</td>
                <td>${locationTotals[location].hours.toFixed(2)}</td>
                <td>$${locationTotals[location].earnings.toFixed(2)}</td>
            </tr>
        `;
    });
    
    // Create entries table HTML
    let entriesTableHtml = '';
    timesheetDetails.entries.forEach(entry => {
        entriesTableHtml += `
            <tr>
                <td>${entry.date}</td>
                <td>${entry.location}</td>
                <td>${entry.hours}</td>
                <td>$${entry.rate}/hr</td>
                <td>$${entry.earnings}</td>
                <td>${entry.notes || ''}</td>
            </tr>
        `;
    });
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Timesheet ${refNumber} - Cleaning Services</title>
            <style>
                /* Reset and base styles */
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Arial', 'Helvetica', sans-serif; 
                    line-height: 1.6; 
                    color: #333;
                    background: #fff;
                    padding: 20px;
                    max-width: 1000px;
                    margin: 0 auto;
                }
                
                /* Header */
                .header { 
                    border-bottom: 3px solid #667eea;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                
                .company-info h1 { 
                    color: #667eea; 
                    font-size: 28px;
                    margin-bottom: 5px;
                }
                
                .company-info p { 
                    color: #666; 
                    font-size: 14px;
                    margin-bottom: 3px;
                }
                
                .timesheet-info {
                    text-align: right;
                }
                
                .timesheet-info h2 {
                    font-size: 24px;
                    color: #333;
                    margin-bottom: 10px;
                }
                
                .timesheet-meta {
                    font-size: 14px;
                    color: #666;
                }
                
                /* Summary Section */
                .summary-section {
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    padding: 25px;
                    border-radius: 10px;
                    margin-bottom: 30px;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.08);
                }
                
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-top: 15px;
                }
                
                .summary-item {
                    text-align: center;
                    padding: 15px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                }
                
                .summary-item h3 {
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                
                .summary-item .value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #667eea;
                }
                
                .summary-item .value.earnings {
                    color: #28a745;
                }
                
                /* Tables */
                .section-title {
                    font-size: 18px;
                    color: #333;
                    margin: 25px 0 15px 0;
                    padding-bottom: 8px;
                    border-bottom: 2px solid #667eea;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 15px 0 30px 0;
                    font-size: 14px;
                }
                
                table th {
                    background: #667eea;
                    color: white;
                    padding: 12px 15px;
                    text-align: left;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                table td {
                    padding: 12px 15px;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                table tr:hover {
                    background-color: #f8f9fa;
                }
                
                table tr:last-child td {
                    border-bottom: 2px solid #667eea;
                }
                
                /* Total row */
                .total-row {
                    font-weight: bold;
                    background-color: #f8f9fa;
                }
                
                .total-row td {
                    border-top: 2px solid #667eea;
                }
                
                /* Footer */
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    text-align: center;
                    color: #666;
                    font-size: 12px;
                }
                
                /* Print-specific styles */
                @media print {
                    body { padding: 0; }
                    .no-print { display: none !important; }
                    .header { border-bottom: 2px solid #000; }
                    .summary-section { 
                        box-shadow: none; 
                        border: 1px solid #ddd;
                    }
                    table th { 
                        background: #f0f0f0 !important; 
                        color: #000 !important;
                        -webkit-print-color-adjust: exact;
                    }
                    .summary-item { 
                        box-shadow: none; 
                        border: 1px solid #ddd;
                    }
                }
                
                /* Notes section */
                .notes {
                    margin-top: 30px;
                    padding: 15px;
                    background: #fff8e1;
                    border-radius: 8px;
                    border-left: 4px solid #ffc107;
                }
                
                .notes h4 {
                    color: #333;
                    margin-bottom: 10px;
                }
                
                .notes ul {
                    margin-left: 20px;
                }
                
                .notes li {
                    margin-bottom: 5px;
                }
            </style>
        </head>
        <body>
            <!-- Header -->
            <div class="header">
                <div class="company-info">
                    <h1>Cleaning Timesheet</h1>
                    <p>Professional Cleaning Services</p>
                    <p>Timesheet ID: ${refNumber}</p>
                    <p>Generated: ${formatDate(new Date())}</p>
                </div>
                <div class="timesheet-info">
                    <h2>INVOICE</h2>
                    <div class="timesheet-meta">
                        <p><strong>Period:</strong> ${formatDate(timesheetDetails.startDate)} to ${formatDate(timesheetDetails.endDate)}</p>
                        <p><strong>Status:</strong> Generated</p>
                    </div>
                </div>
            </div>
            
            <!-- Summary Section -->
            <div class="summary-section">
                <h2 style="color: #333; margin-bottom: 15px;">Summary</h2>
                <div class="summary-grid">
                    <div class="summary-item">
                        <h3>Total Hours</h3>
                        <div class="value">${timesheetDetails.totalHours} hrs</div>
                    </div>
                    <div class="summary-item">
                        <h3>Total Earnings</h3>
                        <div class="value earnings">$${timesheetDetails.totalEarnings}</div>
                    </div>
                    <div class="summary-item">
                        <h3>Number of Entries</h3>
                        <div class="value">${timesheetDetails.entriesCount}</div>
                    </div>
                    <div class="summary-item">
                        <h3>Average per Entry</h3>
                        <div class="value">$${(parseFloat(timesheetDetails.totalEarnings) / timesheetDetails.entriesCount).toFixed(2)}</div>
                    </div>
                </div>
            </div>
            
            <!-- Location Summary -->
            <h3 class="section-title">Summary by Location</h3>
            <table>
                <thead>
                    <tr>
                        <th>Location</th>
                        <th>Total Hours</th>
                        <th>Total Earnings</th>
                    </tr>
                </thead>
                <tbody>
                    ${locationSummaryHtml}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td><strong>GRAND TOTAL</strong></td>
                        <td><strong>${timesheetDetails.totalHours} hrs</strong></td>
                        <td><strong>$${timesheetDetails.totalEarnings}</strong></td>
                    </tr>
                </tfoot>
            </table>
            
            <!-- Detailed Entries -->
            <h3 class="section-title">Detailed Entries</h3>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Location</th>
                        <th>Hours</th>
                        <th>Rate</th>
                        <th>Earnings</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    ${entriesTableHtml}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td colspan="2"><strong>TOTALS</strong></td>
                        <td><strong>${timesheetDetails.totalHours}</strong></td>
                        <td></td>
                        <td><strong>$${timesheetDetails.totalEarnings}</strong></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
            
            <!-- Notes -->
            <div class="notes">
                <h4>Notes & Terms</h4>
                <ul>
                    <li>This timesheet covers work completed during the specified period</li>
                    <li>All amounts are in ${CONFIG.CURRENCY}</li>
                    <li>Hourly rate: $${CONFIG.DEFAULT_HOURLY_RATE}/hr (standard)</li>
                    <li>Please contact for any discrepancies within 7 days</li>
                    <li>Payment due within 14 days of receipt</li>
                </ul>
            </div>
            
            <!-- Footer -->
            <div class="footer">
                <p>Generated by Cleaning Timesheet Manager • ${formatDate(new Date())}</p>
                <p>Thank you for your business!</p>
                <div class="no-print" style="margin-top: 20px; text-align: center;">
                    <button onclick="window.print()" style="padding: 12px 30px; background: #667eea; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin: 10px;">
                        <i class="fas fa-print"></i> Print Timesheet
                    </button>
                    <button onclick="window.close()" style="padding: 12px 30px; background: #6c757d; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin: 10px;">
                        <i class="fas fa-times"></i> Close Window
                    </button>
                </div>
            </div>
            
            <script>
                // Auto-print option (commented out by default)
                // window.onload = function() {
                //     setTimeout(function() {
                //         window.print();
                //     }, 1000);
                // };
                
                // Add page break for printing
                const style = document.createElement('style');
                style.innerHTML = \`
                    @media print {
                        .summary-section, table { break-inside: avoid; }
                        h3.section-title { margin-top: 20px; }
                    }
                \`;
                document.head.appendChild(style);
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

// VIEW TIMESHEETS FUNCTIONALITY
window.viewTimesheets = async function() {
    try {
        const { data: timesheets, error } = await supabase
            .from('timesheets')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        let timesheetsHtml = '';
        if (timesheets && timesheets.length > 0) {
            timesheets.forEach(timesheet => {
                const emailStatus = timesheet.email_sent 
                    ? `<span style="color: #28a745;"><i class="fas fa-check-circle"></i> Sent${timesheet.email_address ? ' to ' + timesheet.email_address : ''}</span>`
                    : '<span style="color: #6c757d;"><i class="fas fa-times-circle"></i> Not sent</span>';
                
                timesheetsHtml += `
                    <div class="timesheet-item" style="padding: 15px; border-bottom: 1px solid #eee;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h4 style="margin: 0 0 5px 0;">${timesheet.ref_number}</h4>
                                <p style="margin: 0; color: #666; font-size: 0.9rem;">
                                    ${formatDate(timesheet.start_date)} to ${formatDate(timesheet.end_date)}<br>
                                    ${timesheet.total_hours} hrs • $${timesheet.total_earnings} • ${emailStatus}
                                </p>
                            </div>
                            <div class="timesheet-actions">
                                <button class="btn-icon view-timesheet-btn" data-id="${timesheet.id}" title="View Details">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn-icon delete-timesheet-btn" data-id="${timesheet.id}" title="Delete" style="color: #dc3545;">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            timesheetsHtml = '<p style="text-align:center; padding:20px;">No timesheets generated yet.</p>';
        }

        const html = `
            <div class="modal-content">
                <h2>All Timesheets</h2>
                <div style="max-height: 400px; overflow-y: auto; margin-bottom: 20px;">
                    ${timesheetsHtml}
                </div>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button onclick="closeModal()" class="btn" style="flex:1;">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            </div>
        `;

        showModal(html);
        
        // Add event listeners for buttons
        setTimeout(() => {
            document.querySelectorAll('.view-timesheet-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    viewTimesheetById(id);
                });
            });
            
            document.querySelectorAll('.delete-timesheet-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    deleteTimesheet(id);
                });
            });
        }, 100);
    } catch (error) {
        console.error('❌ Error loading timesheets:', error);
        showMessage('❌ Error loading timesheets: ' + error.message, 'error');
    }
};

// View specific timesheet by ID
async function viewTimesheetById(id) {
    try {
        const { data: timesheet, error: tsError } = await supabase
            .from('timesheets')
            .select('*')
            .eq('id', id)
            .single();

        if (tsError) throw tsError;

        // Get entries for this timesheet period
        const { data: entries, error: entriesError } = await supabase
            .from('entries')
            .select(`
                *,
                locations (name, hourly_rate)
            `)
            .gte('work_date', timesheet.start_date)
            .lte('work_date', timesheet.end_date)
            .order('work_date', { ascending: true });

        if (entriesError) throw entriesError;

        const timesheetDetails = {
            refNumber: timesheet.ref_number,
            startDate: timesheet.start_date,
            endDate: timesheet.end_date,
            totalHours: parseFloat(timesheet.total_hours).toFixed(2),
            totalEarnings: timesheet.total_earnings,
            entriesCount: entries?.length || 0,
            entries: entries?.map(entry => ({
                date: formatDate(entry.work_date),
                location: entry.locations?.name || 'Unknown',
                hours: entry.hours,
                rate: entry.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE,
                earnings: (entry.hours * (entry.locations?.hourly_rate || CONFIG.DEFAULT_HOURLY_RATE)).toFixed(2),
                notes: entry.notes || ''
            })) || []
        };

        viewTimesheetDetails(timesheetDetails);
    } catch (error) {
        console.error('❌ Error viewing timesheet:', error);
        showMessage('❌ Error viewing timesheet: ' + error.message, 'error');
    }
}

// Delete timesheet - Fixed null reference error
async function deleteTimesheet(id) {
    console.log("Delete timesheet clicked for ID:", id);

    const html = `
        <div class="modal-content" data-timesheet-id="${id}">
            <h2>Confirm Delete Timesheet</h2>
            <p style="margin:15px 0;">Are you sure you want to delete this timesheet?</p>
            <p style="color:#dc3545; font-weight:bold;">
                Note: This only deletes the timesheet record, not the actual entries.
            </p>
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button class="btn btn-primary confirm-delete-timesheet-btn" style="flex:1; background:#dc3545; border:none;">
                    <i class="fas fa-trash"></i> Yes, Delete Timesheet
                </button>
                <button class="btn cancel-btn" style="flex:1;">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `;

    showModal(html);
    
    // Add event listeners after modal is shown
    setTimeout(() => {
        const modalContent = document.querySelector('.modal-content');
        const timesheetId = modalContent.getAttribute('data-timesheet-id');
        
        document.querySelector('.confirm-delete-timesheet-btn').addEventListener('click', async function() {
            console.log("Confirming delete for timesheet ID:", timesheetId);
            
            try {
                const { error } = await supabase
                    .from('timesheets')
                    .delete()
                    .eq('id', timesheetId);

                if (error) throw error;

                closeModal();
                showMessage('✅ Timesheet deleted successfully!', 'success');
                await loadStats();
                
                // Check if the "All Timesheets" modal is still open before trying to refresh it
                const allTimesheetsModal = document.querySelector('.modal-content h2');
                if (allTimesheetsModal && allTimesheetsModal.textContent === 'All Timesheets') {
                    closeModal();
                    // Re-open the timesheets view
                    setTimeout(() => {
                        viewTimesheets();
                    }, 300);
                }
            } catch (error) {
                console.error("Delete timesheet error:", error);
                showMessage('❌ Error deleting timesheet: ' + error.message, 'error');
            }
        });
        
        document.querySelector('.cancel-btn').addEventListener('click', closeModal);
    }, 100);
};

// Make functions globally accessible
window.handleGenerateTimesheet = handleGenerateTimesheet;
window.sendTimesheetEmail = sendTimesheetEmail;
window.viewTimesheetDetails = viewTimesheetDetails;
window.viewTimesheetById = viewTimesheetById;
window.deleteTimesheet = deleteTimesheet;

// Signal that this module is loaded
if (typeof checkModulesLoaded !== 'undefined') {
    checkModulesLoaded();
}

console.log('✅ Timesheets module loaded');
