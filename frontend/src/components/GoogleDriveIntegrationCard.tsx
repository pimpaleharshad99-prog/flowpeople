import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FolderTree,
  ExternalLink,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Calendar,
  Lock,
  Mail,
  ShieldCheck,
  PowerOff,
  Sliders,
  History,
  Info
} from 'lucide-react';
import { api, GoogleDriveStatus, DriveUploadItem, User } from '../services/api';
import { useToast } from './ui';

interface GoogleDriveIntegrationCardProps {
  currentUser: User | null;
  onNavigateTab?: (tab: string) => void;
}

export const GoogleDriveIntegrationCard: React.FC<GoogleDriveIntegrationCardProps> = ({
  currentUser,
}) => {
  const { addToast } = useToast();
  const [status, setStatus] = useState<GoogleDriveStatus | null>(null);
  const [uploads, setUploads] = useState<DriveUploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState('DAILY_ATTENDANCE');

  // Check URL query parameters for OAuth callback results
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('google_drive') === 'connected') {
      addToast({
        title: 'Google Drive Connected',
        description: 'Successfully authorized! Your FlowPeople cloud backup folder has been initialized.',
        type: 'success'
      });
      // Clean query params
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('google_drive_error')) {
      addToast({
        title: 'Connection Failed',
        description: decodeURIComponent(urlParams.get('google_drive_error') || 'Unknown error'),
        type: 'danger'
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await api.getGoogleDriveStatus();
      setStatus(data);
      if (data.connection_status === 'CONNECTED') {
        const historyData = await api.getGoogleDriveUploads(20);
        setUploads(historyData);
      }
    } catch (err: any) {
      // Permission denied or network issue
      setStatus({
        configured: false,
        connection_status: 'CONFIG_UNAVAILABLE',
        connected_account_email: null,
        auto_attendance_reports: true,
        auto_monthly_reports: true,
        last_successful_sync: null,
        last_error: err.message,
        total_uploads_count: 0
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const res = await api.connectGoogleDrive();
      if (res.authorization_url) {
        // Redirect to Google's official OAuth 2.0 authorization screen
        window.location.href = res.authorization_url;
      }
    } catch (err: any) {
      addToast({
        title: 'Authorization Error',
        description: err.message || 'Failed to initiate Google OAuth 2.0 connection.',
        type: 'danger'
      });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Google Drive? Your uploaded reports in Google Drive will remain safe, but automatic background uploads will stop.')) {
      return;
    }
    try {
      setDisconnecting(true);
      await api.disconnectGoogleDrive();
      addToast({
        title: 'Google Drive Disconnected',
        description: 'Google authorization revoked. Existing documents in Drive remain preserved.',
        type: 'info'
      });
      await loadStatus();
    } catch (err: any) {
      addToast({
        title: 'Disconnect Error',
        description: err.message,
        type: 'danger'
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleToggleSetting = async (key: 'auto_attendance_reports' | 'auto_monthly_reports', val: boolean) => {
    if (!status) return;
    try {
      setSavingSettings(true);
      const updated = await api.updateGoogleDriveSettings({ [key]: val });
      setStatus({
        ...status,
        auto_attendance_reports: updated.auto_attendance_reports,
        auto_monthly_reports: updated.auto_monthly_reports
      });
      addToast({
        title: 'Settings Updated',
        description: 'Google Drive automation preferences saved.',
        type: 'success'
      });
    } catch (err: any) {
      addToast({
        title: 'Update Failed',
        description: err.message,
        type: 'danger'
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleManualUpload = async () => {
    try {
      setUploading(true);
      const res = await api.uploadReportToDrive({
        report_type: selectedReportType,
        date: new Date().toISOString().split('T')[0]
      });
      addToast({
        title: 'Report Uploaded to Drive',
        description: `Successfully uploaded ${res.file_name} to your organization's Google Drive.`,
        type: 'success'
      });
      await loadStatus();
    } catch (err: any) {
      addToast({
        title: 'Upload Failed',
        description: err.message,
        type: 'danger'
      });
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const renderStatusBadge = () => {
    if (loading) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#A5A79B]/20 text-[#590907]">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Checking Status...</span>
        </span>
      );
    }

    switch (status?.connection_status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>Google Drive Connected</span>
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-800">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
            <span>Connecting...</span>
          </span>
        );
      case 'SYNCING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 border border-blue-500/30 text-blue-800">
            <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
            <span>Syncing Documents...</span>
          </span>
        );
      case 'REAUTH_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/15 border border-orange-500/30 text-orange-800">
            <AlertTriangle className="w-3 h-3 text-orange-600" />
            <span>Reauthorization Required</span>
          </span>
        );
      case 'SYNC_FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-800">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            <span>Sync Failed</span>
          </span>
        );
      case 'CONFIG_UNAVAILABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/15 border border-slate-500/30 text-slate-700">
            <Info className="w-3 h-3 text-slate-500" />
            <span>Configuration Unavailable</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-200 border border-slate-300 text-slate-700">
            <PowerOff className="w-3 h-3 text-slate-500" />
            <span>Not Connected</span>
          </span>
        );
    }
  };

  const isConnected = status?.connection_status === 'CONNECTED';
  const isConfigured = status?.configured ?? false;

  return (
    <div className="space-y-6">
      {/* Primary Integration Header Card */}
      <div className="p-6 rounded-2xl bg-[#FAF6F0] border border-[#DFE1D8] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E8D2B5]">
          <div className="flex items-start gap-4">
            {/* Google Drive Logo Badge */}
            <div className="w-14 h-14 rounded-2xl bg-white border border-[#DFE1D8] flex items-center justify-center p-2.5 shadow-xs shrink-0">
              <svg className="w-full h-full" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-lg font-bold text-[#590907] tracking-tight">Google Drive Enterprise Cloud Storage</h3>
                {renderStatusBadge()}
              </div>
              <p className="text-xs text-[#590907]/80 leading-relaxed max-w-2xl">
                Automatically generate and archive official attendance timesheets, monthly verification rosters, leave logs, and payroll summaries directly to your organization's Google Drive.
              </p>
            </div>
          </div>

          {/* Quick Action Button */}
          <div className="flex items-center gap-2 self-start md:self-center">
            {isConnected ? (
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 rounded-xl border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {disconnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PowerOff className="w-3.5 h-3.5" />}
                <span>Disconnect</span>
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting || !isConfigured}
                className="px-5 py-2.5 rounded-xl bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] font-bold text-xs transition cursor-pointer flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title={!isConfigured ? 'Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env to connect' : undefined}
              >
                {connecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                <span>Connect Google Drive</span>
              </button>
            )}
          </div>
        </div>

        {/* Configuration Notice (if not configured in backend) */}
        {!isConfigured && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs text-amber-900">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">Google OAuth Credentials Required</p>
              <p className="text-[11px] text-amber-800/90 mt-0.5">
                To connect live Google Drive accounts, provide <code className="px-1 py-0.5 rounded bg-amber-200/60 font-mono text-[10px]">GOOGLE_CLIENT_ID</code> and <code className="px-1 py-0.5 rounded bg-amber-200/60 font-mono text-[10px]">GOOGLE_CLIENT_SECRET</code> in <code className="px-1 py-0.5 rounded bg-amber-200/60 font-mono text-[10px]">backend/.env</code>. See documentation in <code className="px-1 py-0.5 rounded bg-amber-200/60 font-mono text-[10px]">docs/GOOGLE_DRIVE_OAUTH_SETUP.md</code>.
              </p>
            </div>
          </div>
        )}

        {/* Sync Error Notice if any */}
        {status?.last_error && status.connection_status !== 'CONFIG_UNAVAILABLE' && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Sync Alert</p>
              <p className="text-[11px] text-rose-700 mt-0.5">{status.last_error}</p>
            </div>
          </div>
        )}

        {/* Integration Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* Account Card */}
          <div className="p-3.5 rounded-xl bg-white border border-[#DFE1D8]">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#590907] mb-1">
              <Mail className="w-3.5 h-3.5 text-[#A5A79B]" />
              <span>Connected Account</span>
            </div>
            <p className="text-xs font-mono font-medium text-slate-800 truncate">
              {status?.connected_account_email || 'Not Authorized'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {isConnected ? 'One-Click OAuth 2.0' : 'Awaiting Connection'}
            </p>
          </div>

          {/* Dedicated Folder Path */}
          <div className="p-3.5 rounded-xl bg-white border border-[#DFE1D8]">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#590907] mb-1">
              <FolderTree className="w-3.5 h-3.5 text-[#A5A79B]" />
              <span>Drive Folder Hierarchy</span>
            </div>
            <p className="text-xs font-medium text-slate-800 truncate" title={`FlowPeople/${currentUser?.company_name || 'Organization'}`}>
              FlowPeople/{currentUser?.company_name || 'Organization'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Isolated Company Structure</p>
          </div>

          {/* Last Sync */}
          <div className="p-3.5 rounded-xl bg-white border border-[#DFE1D8]">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#590907] mb-1">
              <Calendar className="w-3.5 h-3.5 text-[#A5A79B]" />
              <span>Last Sync Timestamp</span>
            </div>
            <p className="text-xs font-medium text-slate-800">
              {status?.last_successful_sync
                ? new Date(status.last_successful_sync).toLocaleString()
                : 'No sync yet'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Automatic Background Sync</p>
          </div>

          {/* Total Uploads */}
          <div className="p-3.5 rounded-xl bg-white border border-[#DFE1D8]">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#590907] mb-1">
              <History className="w-3.5 h-3.5 text-[#A5A79B]" />
              <span>Archived Documents</span>
            </div>
            <p className="text-xs font-bold text-[#590907]">
              {status?.total_uploads_count || uploads.length} files
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Immutable Audit History</p>
          </div>
        </div>

        {/* Automation Toggles & Manual Upload (Only when connected) */}
        {isConnected && (
          <div className="mt-6 pt-6 border-t border-[#E8D2B5] grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Automation Preferences */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#590907]" />
                <h4 className="text-xs font-bold text-[#590907] uppercase tracking-wider">Automated Archival Preferences</h4>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#DFE1D8] cursor-pointer hover:bg-slate-50 transition">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-800 block">Daily Attendance Reports</span>
                    <span className="text-[11px] text-slate-500 block">Automatically generate and upload verified end-of-day attendance rosters to Drive.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={status?.auto_attendance_reports ?? true}
                    onChange={(e) => handleToggleSetting('auto_attendance_reports', e.target.checked)}
                    disabled={savingSettings}
                    className="w-4 h-4 text-[#590907] rounded border-[#DFE1D8] focus:ring-[#590907] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#DFE1D8] cursor-pointer hover:bg-slate-50 transition">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-800 block">Monthly Timesheet & Payroll Exports</span>
                    <span className="text-[11px] text-slate-500 block">Export full monthly attendance summaries and payroll records on period close.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={status?.auto_monthly_reports ?? true}
                    onChange={(e) => handleToggleSetting('auto_monthly_reports', e.target.checked)}
                    disabled={savingSettings}
                    className="w-4 h-4 text-[#590907] rounded border-[#DFE1D8] focus:ring-[#590907] cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Manual Upload Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-[#590907]" />
                <h4 className="text-xs font-bold text-[#590907] uppercase tracking-wider">On-Demand Sync to Google Drive</h4>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#DFE1D8] space-y-3">
                <p className="text-xs text-slate-600">
                  Instantly generate and push verified reports to your organization's Google Drive folder right now:
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedReportType}
                    onChange={(e) => setSelectedReportType(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-[#DFE1D8] bg-[#FAF6F0] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#590907]"
                  >
                    <option value="DAILY_ATTENDANCE">Today's Attendance Roster (PDF)</option>
                    <option value="DAILY_ATTENDANCE_CSV">Today's Attendance Matrix (CSV)</option>
                    <option value="MONTHLY_ATTENDANCE">Monthly Attendance Summary (CSV)</option>
                    <option value="LEAVE_SUMMARY">Leave Requests & Approvals (CSV)</option>
                    <option value="PAYROLL_SUMMARY">Payroll Summary & Payslips (CSV)</option>
                  </select>

                  <button
                    onClick={handleManualUpload}
                    disabled={uploading}
                    className="px-4 py-2 rounded-xl bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                    <span>Upload to Drive</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload History Table (When connected) */}
      {isConnected && (
        <div className="p-6 rounded-2xl bg-white border border-[#DFE1D8] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#590907]" />
              <h4 className="text-sm font-bold text-[#590907]">Google Drive Document Upload History</h4>
            </div>
            <button
              onClick={loadStatus}
              className="text-xs text-[#590907] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh Log</span>
            </button>
          </div>

          {uploads.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-[#DFE1D8] rounded-xl">
              No reports have been uploaded to Google Drive yet. Use on-demand upload above or wait for end-of-day sync.
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#DFE1D8] rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAF6F0] text-[#590907] font-semibold border-b border-[#DFE1D8]">
                  <tr>
                    <th className="py-2.5 px-3">Report Document</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">File Size</th>
                    <th className="py-2.5 px-3">Upload Status</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3 text-right">Drive Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFE1D8]">
                  {uploads.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-medium text-slate-900 flex items-center gap-2">
                        {item.mime_type.includes('pdf') ? (
                          <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : (
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                        <span className="truncate max-w-[240px]">{item.file_name}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                        {item.report_type}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                        {formatFileSize(item.file_size_bytes)}
                      </td>
                      <td className="py-2.5 px-3">
                        {item.upload_status === 'SUCCESS' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Uploaded</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200" title={item.error_message || undefined}>
                            <AlertTriangle className="w-3 h-3" />
                            <span>{item.upload_status}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {item.drive_web_view_link ? (
                          <a
                            href={item.drive_web_view_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#590907] hover:underline font-semibold text-[11px]"
                          >
                            <span>Open in Drive</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

