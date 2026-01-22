# Cleaning Timesheet Manager

A web application for tracking cleaning jobs and generating timesheets, connected to Google Sheets.

## Features
- 📊 Dashboard with statistics
- ➕ Add new cleaning entries
- 📋 View recent entries
- 📄 Generate timesheets
- 📱 Responsive design
- 🔗 Google Sheets integration

## Setup Instructions

### 1. Google Sheets Setup
1. Create a Google Sheet with the required structure
2. Deploy the Apps Script API
3. Copy your API URL and key

### 2. Configure the App
Edit `script.js` and update:
```javascript
const CONFIG = {
    API_URL: 'YOUR_GOOGLE_APPS_SCRIPT_URL',
    API_KEY: 'YOUR_API_KEY'
};