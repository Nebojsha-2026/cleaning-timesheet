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
        const emailAddress = sendEmail ? document.getElementById('emailAddress').value.trim() : null;
      
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
      
        const { data: timesheet, error: tsError } = await supabase
            .from('timesheets')
            .insert([{ 
                ref_number: refNumber, 
                start_date: startDate, 
                end_date: endDate, 
                total_hours: totalHours, 
                total_earnings: totalEarnings,
                email_sent: sendEmail,
                email_address: emailAddress
            }])
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
                <button onclick="printTimesheet('${timesheetDetails.refNumber}')" class="btn btn-primary" style="flex:1;">
                    <i class="fas fa-print"></i> Print
                </button>
                <button onclick="closeModal()" class="btn" style="flex:1;">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        </div>
    `;
  
    showModal(html);
}

// Print timesheet
window.printTimesheet = function(refNumber) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Timesheet ${refNumber}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #333; }
                .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .total { font-weight: bold; text-align: right; }
                @media print {
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>Timesheet ${refNumber}</h1>
            <p>Generated on ${formatDate(new Date())}</p>
            <div style="text-align: center; margin: 20px 0;">
                <button onclick="window.print()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Print Timesheet
                </button>
            </div>
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
                // Refresh the timesheets view if it's open
                if (document.querySelector('.modal-content h2').textContent === 'All Timesheets') {
                    closeModal();
                    viewTimesheets();
                }
            } catch (error) {
                console.error("Delete timesheet error:", error);
                showMessage('❌ Error deleting timesheet: ' + error.message, 'error');
            }
        });
        
        document.querySelector('.cancel-btn').addEventListener('click', closeModal);
    }, 100);
};

console.log('✅ Timesheets module loaded');
