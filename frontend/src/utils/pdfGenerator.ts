/**
 * FlowPeople Professional Attendance PDF Generator
 * Generates print-ready vector PDF reports with company branding,
 * full employee in/out timestamps, punch logs, and summary KPIs.
 */

export interface AttendancePdfRecord {
  name: string;
  code: string;
  department?: string;
  branch?: string;
  date: string;
  whenIn: string;
  whenOut: string;
  duration: string;
  status: string;
  method?: string;
  punchLogs?: string;
}

export interface AttendancePdfOptions {
  title?: string;
  subtitle?: string;
  date?: string;
  companyName?: string;
  companyLogoUrl?: string;
  softwareTitle?: string;
  records: AttendancePdfRecord[];
  summary?: {
    totalEmployees?: number;
    present?: number;
    absent?: number;
    checkedIn?: number;
    avgHours?: string;
  };
}

export function generateAttendancePdf(options: AttendancePdfOptions): void {
  const {
    title = 'Official Attendance & In-Out Timesheet Report',
    subtitle = 'Comprehensive Employee Clock-In, Departure & Biometric Verification Record',
    date = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    companyName = 'Organization Workspace',
    companyLogoUrl,
    softwareTitle,
    records = [],
    summary
  } = options;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup blocked. Please allow popups for this site to generate the PDF report.');
    return;
  }

  const total = records.length;
  const presentCount = summary?.present ?? records.filter(r => r.status.toUpperCase().includes('PRESENT') || r.status.toUpperCase().includes('CHECKED_IN')).length;
  const activeCount = summary?.checkedIn ?? records.filter(r => r.status.toUpperCase() === 'CHECKED_IN').length;
  const absentCount = summary?.absent ?? records.filter(r => r.status.toUpperCase() === 'ABSENT').length;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title} - ${companyName}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 24px;
      color: #0f172a;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.4;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0d9488;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .brand h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0f172a;
    }
    .brand h1 span {
      color: #590907;
    }
    .brand p {
      margin: 3px 0 0;
      font-size: 11px;
      color: #64748b;
    }
    .meta {
      text-align: right;
    }
    .meta .badge {
      display: inline-block;
      padding: 3px 8px;
      background: #ECEEE7;
      border: 1px solid #A5A79B;
      color: #4A5A3F;
      border-radius: 4px;
      font-weight: 700;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .meta p {
      margin: 2px 0;
      font-size: 11px;
      color: #475569;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 18px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
    }
    .summary-card .label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      font-weight: 600;
      margin: 0;
    }
    .summary-card .val {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin: 4px 0 0;
    }
    .summary-card.teal .val { color: #590907; }
    .summary-card.emerald .val { color: #4A5A3F; }
    .summary-card.amber .val { color: #8C4820; }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 10.5px;
    }
    th {
      background: #590907;
      color: #FAF6F0;
      text-align: left;
      padding: 8px 10px;
      font-weight: 700;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #DFE1D8;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background: #FAF6F0;
    }
    .emp-name {
      font-weight: 700;
      color: #2E3029;
      font-size: 11px;
    }
    .emp-code {
      font-family: monospace;
      color: #717368;
      font-size: 10px;
    }
    .time-in {
      font-family: monospace;
      font-weight: 700;
      color: #4A5A3F;
    }
    .time-out {
      font-family: monospace;
      font-weight: 700;
      color: #590907;
    }
    .duration {
      font-family: monospace;
      font-weight: 700;
      color: #2E3029;
    }
    .punch-logs {
      font-family: monospace;
      font-size: 9.5px;
      color: #475569;
      background: #ECEEE7;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
      max-width: 220px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .status-checked-in {
      background: #ECEEE7;
      color: #4A5A3F;
      border: 1px solid #A5A79B;
    }
    .status-present {
      background: #ECEEE7;
      color: #4A5A3F;
      border: 1px solid #A5A79B;
    }
    .status-absent {
      background: #F7E8E8;
      color: #590907;
      border: 1px solid #E5BABA;
    }
    .status-late {
      background: #F9EFE4;
      color: #8C4820;
      border: 1px solid #E8D2B5;
    }
    .footer {
      margin-top: 32px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #64748b;
      font-size: 10px;
    }
    .sign-box {
      display: flex;
      gap: 40px;
      margin-top: 24px;
    }
    .sign-line {
      border-top: 1px dashed #94a3b8;
      width: 180px;
      text-align: center;
      padding-top: 4px;
      font-size: 10px;
      color: #64748b;
    }
    .no-print {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      margin-bottom: 16px;
    }
    .btn-print {
      background: #590907;
      color: #FAF6F0;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 700;
      cursor: pointer;
      font-size: 12px;
    }
    .btn-print:hover { background: #450605; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn-print" onclick="window.print()">Save as PDF / Print Document</button>
  </div>

  <div class="header">
    <div class="brand" style="display: flex; align-items: center; gap: 14px;">
      ${companyLogoUrl ? `<img src="${companyLogoUrl}" alt="${companyName}" style="max-height: 48px; max-width: 150px; object-fit: contain; border-radius: 6px;" />` : ''}
      <div>
        <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a;">${softwareTitle || companyName}</h1>
        <p style="margin: 3px 0 0; font-size: 11px; color: #64748b;">${title} &bull; ${subtitle}</p>
      </div>
    </div>
    <div class="meta">
      <div class="badge">Official HR Document</div>
      <p><strong>Organization:</strong> ${companyName}</p>
      <p><strong>Reporting Period:</strong> ${date}</p>
      <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <p class="label">Total Records</p>
      <p class="val">${total}</p>
    </div>
    <div class="summary-card emerald">
      <p class="label">Present / Present Today</p>
      <p class="val">${presentCount}</p>
    </div>
    <div class="summary-card teal">
      <p class="label">Currently On Duty</p>
      <p class="val">${activeCount}</p>
    </div>
    <div class="summary-card amber">
      <p class="label">Absent / Off Duty</p>
      <p class="val">${absentCount}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Employee Name & Code</th>
        <th>Department / Role</th>
        <th>Date</th>
        <th>When In (Clock In)</th>
        <th>When Out (Departure)</th>
        <th>Work Duration</th>
        <th>In/Out Punch Log</th>
        <th>Method</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${records.length === 0 ? `
        <tr>
          <td colspan="10" style="text-align: center; padding: 24px; color: #94a3b8;">
            No attendance records found for the selected reporting criteria.
          </td>
        </tr>
      ` : records.map((r, idx) => {
        const normStatus = (r.status || '').toUpperCase();
        let badgeClass = 'status-present';
        if (normStatus.includes('CHECKED_IN')) badgeClass = 'status-checked-in';
        else if (normStatus.includes('ABSENT')) badgeClass = 'status-absent';
        else if (normStatus.includes('LATE')) badgeClass = 'status-late';

        return `
          <tr>
            <td style="color: #94a3b8; font-family: monospace;">${idx + 1}</td>
            <td>
              <div class="emp-name">${r.name}</div>
              <div class="emp-code">${r.code}</div>
            </td>
            <td>
              <div style="font-weight: 600; color: #334155;">${r.department || 'General'}</div>
              <div style="font-size: 9.5px; color: #64748b;">${r.branch || 'Headquarters'}</div>
            </td>
            <td style="font-family: monospace; font-size: 10px; color: #475569;">${r.date}</td>
            <td><span class="time-in">${r.whenIn || '—'}</span></td>
            <td><span class="time-out">${r.whenOut || 'Active / On Duty'}</span></td>
            <td><span class="duration">${r.duration || '0h 0m'}</span></td>
            <td>
              <span class="punch-logs" title="${r.punchLogs || (r.whenIn ? `IN: ${r.whenIn}` : 'No punch logs')}">
                ${r.punchLogs || (r.whenIn ? `IN: ${r.whenIn}` : '—')}
              </span>
            </td>
            <td>
              <span style="font-size: 10px; font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: 600;">
                ${r.method || 'FACE'}
              </span>
            </td>
            <td>
              <span class="status-badge ${badgeClass}">${r.status}</span>
            </td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <div class="sign-box">
    <div>
      <div class="sign-line">HR Administrator Signature</div>
    </div>
    <div>
      <div class="sign-line">Department Supervisor Approval</div>
    </div>
    <div>
      <div class="sign-line">System Verification Seal</div>
    </div>
  </div>

  <div class="footer" style="margin-top: 32px; border-top: 1px solid #cbd5e1; padding-top: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b;">
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-weight: 800; color: #590907; letter-spacing: 0.5px; font-size: 11px;">FlowPeople by FlowCraft</span>
      <span>&bull;</span>
      <span>Enterprise Multi-Tenant HRMS & Biometric System</span>
    </div>
    <div>Confidential &bull; Generated for <strong>${companyName}</strong> &bull; Page 1 of 1</div>
  </div>

  <script>
    window.addEventListener('load', () => {
      // Small timeout to guarantee full DOM & stylesheet paint before opening print dialog
      setTimeout(() => {
        window.print();
      }, 300);
    });
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

