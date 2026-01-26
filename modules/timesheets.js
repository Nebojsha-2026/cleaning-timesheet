// Timesheets module - handles all timesheet-related operations

// Load statistics
async function loadStats() {
    try {
        console.log('📊 Loading statistics...');
      
        const { count: totalEntries, error: entriesError } = await window.supabaseClient
            .from('entries')
            .select('*', { count: 'exact', head: true });
      
        if (entriesError) throw entriesError;
      
        const { count: totalLocations, error: locationsError } = await window.supabaseClient
            .from('locations')
            .select('*', { count: 'exact', head: true });
      
        if (locationsError) throw locationsError;
      
        const { count: totalTimesheets, error: timesheetsError } = await window.supabaseClient
            .from('timesheets')
            .select('*', { count: 'exact', head: true });
      
        if (timesheetsError) throw timesheetsError;
      
        const { data: earningsData, error: earningsError } = await window.supabaseClient
            .from('entries')
            .select(`
                hours,
                locations (hourly_rate)
            `);
      
        if (earningsError) throw earningsError;
      
        const totalEarnings = earningsData.reduce((sum, entry) => {
            const rate = entry.locations?.hourly_rate || window.CONFIG.DEFAULT_HOURLY_RATE;
            return sum + (parseFloat(entry.hours) * rate);
        }, 0).toFixed(2);
      
        updateStatsDisplay({
            totalEntries: totalEntries || 0,
            totalLocations: totalLocations || 0,
            totalTimesheets: totalTimesheets || 0,
            totalEarnings: totalEarnings
        });
      
        console.log('✅ Statistics loaded');
      
    } catch (error) {
        console.error('❌ Error loading statistics:', error);
    }
}

// Update stats display
function updateStatsDisplay(stats) {
    document.querySelectorAll('.stat-card')[0].innerHTML = `
        <div class="stat-icon"><i class="fas fa-list"></i></div>
        <div class="stat-info">
            <h3>Total Entries</h3>
            <div class="stat-value">${stats.totalEntries}</div>
        </div>
    `;
  
    document.querySelectorAll('.stat-card')[1].innerHTML = `
        <div class="stat-icon"><i class="fas fa-map-marker-alt"></i></div>
        <div class="stat-info">
            <h3>Locations</h3>
            <div class="stat-value">${stats.totalLocations}</div>
        </div>
    `;
  
    document.querySelectorAll('.stat-card')[2].innerHTML = `
        <div class="stat-icon"><i class="fas fa-file-invoice-dollar"></i></div>
        <div class="stat-info">
            <h3>Timesheets</h3>
            <div class="stat-value">${stats.totalTimesheets}</div>
        </div>
    `;
  
    document.querySelectorAll('.stat-card')[3].innerHTML = `
        <div class="stat-icon"><i class="fas fa-money-bill-wave"></i></div>
        <div class="stat-info">
            <h3>Total Earned</h3>
            <div class="stat-value">$${stats.totalEarnings}</div>
        </div>
    `;
  
    document.querySelectorAll('.stat-card').forEach(card => card.classList.remove('loading'));
}

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
      
        const { data: entries, error: entriesError } = await window.supabaseClient
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
            const rate = e.locations?.hourly_rate || window.CONFIG.DEFAULT_HOURLY_RATE;
            return sum + (parseFloat(e.hours) * rate);
        }, 0).toFixed(2);
      
        const refNumber = 'TS' + new Date().getTime().toString().slice(-6);
      
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
      
        const { data: timesheet, error: tsError } = await window.supabaseClient
            .from('timesheets')
            .insert([insertData])
            .select()
            .single();
      
        if (tsError) throw tsError;
      
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
                rate: entry.locations?.hourly_rate || window.CONFIG.DEFAULT_HOURLY_RATE,
                earnings: (entry.hours * (entry.locations?.hourly_rate || window.CONFIG.DEFAULT_HOURLY_RATE)).toFixed(2),
                notes: entry.notes || ''
            }))
        };
      
        showMessage(`✅ Timesheet ${refNumber} generated!`, 'success');
        await loadStats();
      
        viewTimesheetDetails(timesheetDetails);
      
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
        console.log('📧 Sending timesheet to:', emailAddress);
        
        const emailContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
                    .summary { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                    .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
                    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    th { background: #667eea; color: white; padding: 10px; text-align: left; }
                    td { padding: 8px 10px; border-bottom: 1px solid #ddd; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Cleaning Timesheet</h1>
                        <p>Reference: ${timesheetDetails.refNumber}</p>
                    </div>
                    <div class="content">
                        <h2>Timesheet Summary</h2>
                        <div class="summary">
                            <p><strong>Period:</strong> ${formatDate(timesheetDetails.startDate)} to ${formatDate(timesheetDetails.endDate)}</p>
                            <p><strong>Total Hours:</strong> ${timesheetDetails.totalHours} hrs</p>
                            <p><strong>Total Earnings:</strong> $${timesheetDetails.totalEarnings} AUD</p>
                            <p><strong>Number of Entries:</strong> ${timesheetDetails.entriesCount}</p>
                        </div>
                        
                        <h3>Detailed Entries</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Location</th>
                                    <th>Hours</th>
                                    <th>Rate</th>
                                    <th>Earnings</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${timesheetDetails.entries.map(entry => `
                                    <tr>
                                        <td>${entry.date}</td>
                                        <td>${entry.location}</td>
                                        <td>${entry.hours}</td>
                                        <td>$${entry.rate}/hr</td>
                                        <td>$${entry.earnings}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr style="font-weight: bold; background: #f0f0f0;">
                                    <td colspan="2">TOTALS</td>
                                    <td>${timesheetDetails.totalHours}</td>
                                    <td></td>
                                    <td>$${timesheetDetails.totalEarnings}</td>
                                </tr>
                            </tfoot>
                        </table>
                        
                        <p>You can also view and print this timesheet directly from the Cleaning Timesheet Manager app.</p>
                        
                        <div class="footer">
                            <p>This timesheet was generated automatically by Cleaning Timesheet Manager.</p>
                            <p>If you have any questions, please contact us.</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        const emailWindow = window.open('', '_blank');
        emailWindow.document.write(emailContent);
        emailWindow.document.close();
        
        setTimeout(() => {
            showMessage(`📧 Timesheet email preview opened in new tab. In production, this would be sent to ${emailAddress}`, 'success');
        }, 500);
        
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
  
    const printBtnId = 'printBtn_' + Date.now();
    
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
                <button id="${printBtnId}" class="btn btn-primary" style="flex:1;">
                    <i class="fas fa-print"></i> Print/Export
                </button>
                <button onclick="closeModal()" class="btn" style="flex:1;">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        </div>
    `;
  
    showModal(html);
    
    setTimeout(() => {
        document.getElementById(printBtnId).addEventListener('click', function() {
            printTimesheet(timesheetDetails.refNumber, timesheetDetails);
        });
    }, 100);
}

// Print timesheet
window.printTimesheet = function(refNumber, timesheetDetails) {
    console.log("Printing timesheet:", refNumber);
    
    if (typeof timesheetDetails === 'string') {
        try {
            timesheetDetails = JSON.parse(timesheetDetails);
        } catch (e) {
            console.error("Failed to parse timesheetDetails:", e);
            showMessage('❌ Error: Could not parse timesheet data', 'error');
            return;
        }
    }
    
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
        showMessage('❌ Please allow pop-ups to print the timesheet', 'error');
        return;
    }
    
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
    
    let locationSummaryHtml = '';
    Object.keys(locationTotals).forEach(location => {
        locationSummaryHtml += `
            <tr>
                <td>${escapeHtml(location)}</td>
                <td>${locationTotals[location].hours.toFixed(2)}</td>
                <td>$${locationTotals[location].earnings.toFixed(2)}</td>
            </tr>
        `;
    });
    
    let entriesTableHtml = '';
    timesheetDetails.entries.forEach(entry => {
        entriesTableHtml += `
            <tr>
                <td>${entry.date}</td>
                <td>${escapeHtml(entry.location)}</td>
                <td>${entry.hours}</td>
                <td>$${entry.rate}/hr</td>
                <td>$${entry.earnings}</td>
                <td>${escapeHtml(entry.notes || '')}</td>
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
                
                /* Print buttons */
                .print-buttons {
                    text-align: center;
                    margin: 20px 0;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 8px;
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
                    <li>All amounts are in ${window.CONFIG.CURRENCY}</li>
                    <li>Hourly rate: $${window.CONFIG.DEFAULT_HOURLY_RATE}/hr (standard)</li>
                    <li>Please contact for any discrepancies within 7 days</li>
                    <li>Payment due within 14 days of receipt</li>
                </ul>
            </div>
            
            <!-- Print Buttons -->
            <div class="print-buttons no-print">
                <button onclick="window.print()" style="padding: 12px 30px; background: #667eea; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin: 10px;">
                    <i class="fas fa-print"></i> Print Timesheet
                </button>
                <button onclick="window.close()" style="padding: 12px 30px; background: #6c757d; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin: 10px;">
                    <i class="fas fa-times"></i> Close Window
                </button>
                <button onclick="saveAsPDF()" style="padding: 12px 30px; background: #28a745; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin: 10px;">
                    <i class="fas fa-download"></i> Save as PDF
                </button>
            </div>
            
            <!-- Footer -->
            <div class="footer">
                <p>Generated by Cleaning Timesheet Manager • ${formatDate(new Date())}</p>
                <p>Thank you for your business!</p>
            </div>
            
            <script>
                function saveAsPDF() {
                    alert('To save as PDF, use the "Print" option and choose "Save as PDF" as your printer.');
                }
                
                const style = document.createElement('style');
                style.innerHTML = \`
                    @media print {
                        .summary-section, table { break-inside: avoid; }
                        h3.section-title { margin-top: 20px; }
                        .print-buttons { display: none !important; }
                    }
                \`;
                document.head.appendChild(style);
                
                window.focus();
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

// View all timesheets
window.viewTimesheets = async function() {
    try {
        const { data: timesheets, error } = await window.supabaseClient
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
        const { data: timesheet, error: tsError } = await window.supabaseClient
            .from('timesheets')
            .select('*')
            .eq('id', id)
            .single();

        if (tsError) throw tsError;

        const { data: entries, error: entriesError } = await window.supabaseClient
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
                rate: entry.locations?.hourly_rate || window.CONFIG.DEFAULT_HOURLY_RATE,
                earnings: (entry.hours * (entry.locations?.hourly_rate || window.CONFIG.DEFAULT_HOURLY_RATE)).toFixed(2),
                notes: entry.notes || ''
            })) || []
        };

        viewTimesheetDetails(timesheetDetails);
    } catch (error) {
        console.error('❌ Error viewing timesheet:', error);
        showMessage('❌ Error viewing timesheet: ' + error.message, 'error');
    }
}

// Delete timesheet
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
    
    setTimeout(() => {
        const modalContent = document.querySelector('.modal-content');
        const timesheetId = modalContent.getAttribute('data-timesheet-id');
        
        document.querySelector('.confirm-delete-timesheet-btn').addEventListener('click', async function() {
            console.log("Confirming delete for timesheet ID:", timesheetId);
            
            try {
                const { error } = await window.supabaseClient
                    .from('timesheets')
                    .delete()
                    .eq('id', timesheetId);

                if (error) throw error;

                closeModal();
                showMessage('✅ Timesheet deleted successfully!', 'success');
                await loadStats();
                
                const allTimesheetsModal = document.querySelector('.modal-content h2');
                if (allTimesheetsModal && allTimesheetsModal.textContent === 'All Timesheets') {
                    closeModal();
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

// Edit entry
window.editEntry = async function(id) {
    console.log("Edit clicked for entry ID:", id);

    try {
        const { data: entry, error } = await window.supabaseClient
            .from('entries')
            .select(`
                *,
                locations (id, name, hourly_rate)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        const locationName = escapeHtml(entry.locations.name);
        const hourlyRate = entry.locations.hourly_rate;
        const hours = entry.hours;
        const workDate = entry.work_date;
        const notes = entry.notes ? escapeHtml(entry.notes) : '';

        const html = `
            <div class="modal-content">
                <h2>Edit Entry</h2>
                <form id="editEntryForm">
                    <div class="form-group">
                        <label for="editLocationName">Location Name</label>
                        <input type="text" id="editLocationName" value="${locationName}" required>
                    </div>
                    <div class="form-group">
                        <label for="editRate">Hourly Rate ($)</label>
                        <input type="number" id="editRate" value="${hourlyRate}" step="0.01" min="1" required>
                    </div>
                    <div class="form-group">
                        <label for="editHours">Hours</label>
                        <input type="number" id="editHours" value="${hours}" step="0.5" min="0.5" max="24" required>
                    </div>
                    <div class="form-group">
                        <label for="editDate">Date</label>
                        <input type="date" id="editDate" value="${workDate}" required>
                    </div>
                    <div class="form-group">
                        <label for="editNotes">Notes (optional)</label>
                        <textarea id="editNotes" rows="2">${notes}</textarea>
                    </div>
                    <div style="margin-top:20px; display:flex; gap:10px;">
                        <button type="submit" class="btn btn-primary" style="flex:1;">
                            <i class="fas fa-save"></i> Save Changes
                        </button>
                        <button type="button" class="btn cancel-btn" style="flex:1; background:#6c757d; color:white;">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                </form>
            </div>
        `;

        showModal(html);
        
        document.getElementById('editEntryForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const newLocName = document.getElementById('editLocationName').value.trim();
            const newRate = parseFloat(document.getElementById('editRate').value);
            const newHours = parseFloat(document.getElementById('editHours').value);
            const newDate = document.getElementById('editDate').value;
            const newNotes = document.getElementById('editNotes').value.trim();

            const { error: entryErr } = await window.supabaseClient
                .from('entries')
                .update({ hours: newHours, work_date: newDate, notes: newNotes })
                .eq('id', id);

            if (entryErr) throw entryErr;

            const { error: locErr } = await window.supabaseClient
                .from('locations')
                .update({ name: newLocName, hourly_rate: newRate })
                .eq('id', entry.locations.id);

            if (locErr) throw locErr;

            closeModal();
            showMessage('✅ Entry & location updated!', 'success');
            await loadStats();
            await loadRecentEntries();
            await loadLocations();
        });
        
        document.querySelector('.cancel-btn').addEventListener('click', closeModal);
        
    } catch (error) {
        console.error("Edit entry error:", error);
        showMessage('❌ Error: ' + error.message, 'error');
    }
};

// Delete entry
window.deleteEntry = function(id) {
    console.log("Delete clicked for entry ID:", id);

    const html = `
        <div class="modal-content" data-entry-id="${id}">
            <h2>Confirm Delete</h2>
            <p style="margin:15px 0;">Are you sure you want to delete this entry?</p>
            <p style="color:#dc3545; font-weight:bold;">This cannot be undone.</p>
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button class="btn btn-primary confirm-delete-btn" style="flex:1; background:#dc3545; border:none;">
                    <i class="fas fa-trash"></i> Yes, Delete
                </button>
                <button class="btn cancel-btn" style="flex:1;">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `;

    showModal(html);
    
    setTimeout(() => {
        const modalContent = document.querySelector('.modal-content');
        const entryId = modalContent.getAttribute('data-entry-id');
        
        document.querySelector('.confirm-delete-btn').addEventListener('click', async function() {
            console.log("Confirming delete for ID:", entryId);
            
            try {
                const { error } = await window.supabaseClient
                    .from('entries')
                    .delete()
                    .eq('id', entryId);

                if (error) throw error;

                closeModal();
                showMessage('✅ Entry deleted successfully!', 'success');
                await loadStats();
                await loadRecentEntries();
            } catch (error) {
                console.error("Delete error:", error);
                showMessage('❌ Error deleting entry: ' + error.message, 'error');
            }
        });
        
        document.querySelector('.cancel-btn').addEventListener('click', closeModal);
    }, 100);
};

// Action buttons
window.refreshData = async function() {
    console.log('🔄 Refreshing data...');
    showMessage('Refreshing data...', 'info');
    await loadStats();
    await loadRecentEntries();
    await loadLocations();
    showMessage('✅ Data refreshed!', 'success');
};

window.generateTimesheet = function() {
    document.getElementById('timesheetForm').scrollIntoView({ behavior: 'smooth' });
};

window.exportData = function() { alert('Export coming soon!'); };
window.showSettings = function() { alert('Settings coming soon!'); };
window.showHelp = function() { alert('Help coming soon!'); };

console.log('✅ Timesheets module loaded');
