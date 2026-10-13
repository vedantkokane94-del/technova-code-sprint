import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Search,
  Download,
  RefreshCw,
  Flag,
  Trash2,
  Ban,
  Unlock,
  Check,
  Settings,
  Mail,
  Phone,
  AlertTriangle,
  X
} from 'lucide-react';
import {
  fetchAdminRegistrationsApi,
  adminRegistrationActionApi
} from '../services/api';
import { safeString, safeTrim, safeLowerCase } from '../utils/safeString';
import { getBranchLabel, normalizeBranchCode, ALLOWED_BRANCHES } from '../utils/registrationValidation';

export const AdminRegistrationsPanel = ({ onDataChanged, showToast }) => {
  const [registrations, setRegistrations] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    verified: 0,
    unverified: 0,
    suspended: 0,
    flagged: 0,
    byBranch: {},
    byTrack: { C: 0, 'C++': 0, Java: 0, Python: 0 }
  });
  const [settings, setSettings] = useState({
    allowlistEnabled: false,
    allowedDomains: ['svit.ac.in', 'pravara.in', 'sinhgad.edu'],
    phoneVerificationRequired: false
  });
  const [domainsInput, setDomainsInput] = useState('svit.ac.in, pravara.in, sinhgad.edu');
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [branchFilter, setBranchFilter] = useState('All');
  const [trackFilter, setTrackFilter] = useState('All');

  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [isLiveActive, setIsLiveActive] = useState(true);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [clearAllInput, setClearAllInput] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const loadRegistrations = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const data = await fetchAdminRegistrationsApi();
      if (data) {
        setRegistrations(data.registrations || []);
        if (data.summary) setSummary(data.summary);
        if (data.registrationSettings) {
          setSettings(data.registrationSettings);
          setDomainsInput((data.registrationSettings.allowedDomains || []).join(', '));
        }
        setLastUpdated(new Date());
        setIsLiveActive(true);
      } else {
        setIsLiveActive(false);
      }
    } catch (e) {
      setIsLiveActive(false);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRegistrations();
    // Real-Time auto-refresh every 5 seconds without page refresh (Problem 2)
    const interval = setInterval(() => {
      loadRegistrations(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [loadRegistrations]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSavingSettings(true);
    const res = await adminRegistrationActionApi({
      action: 'update_settings',
      allowlistEnabled: settings.allowlistEnabled,
      allowedDomains: domainsInput
        .split(',')
        .map(d => d.trim().toLowerCase())
        .filter(Boolean),
      phoneVerificationRequired: settings.phoneVerificationRequired
    });
    setIsSavingSettings(false);
    if (res && res.success) {
      if (res.registrationSettings) setSettings(res.registrationSettings);
      if (showToast) showToast(res.message || 'Registration policy settings saved.');
      if (onDataChanged) onDataChanged();
    } else if (showToast) {
      showToast(res?.error || 'Failed to update settings.');
    }
  };

  const handleAccountAction = async (action, student, reason = '') => {
    if (action === 'delete') {
      setStudentToDelete(student);
      return;
    }

    const res = await adminRegistrationActionApi({
      action,
      prn: student.prn,
      uid: student.uid,
      reason
    });

    if (res && res.success) {
      if (showToast) showToast(res.message || `Action ${action} completed.`);
      await loadRegistrations();
      if (onDataChanged) onDataChanged();
    } else if (showToast) {
      showToast(res?.error || `Failed to perform ${action}.`);
    }
  };

  const confirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    setIsProcessingAction(true);
    const res = await adminRegistrationActionApi({
      action: 'delete',
      prn: studentToDelete.prn,
      uid: studentToDelete.uid
    });
    setIsProcessingAction(false);
    setStudentToDelete(null);

    if (res && res.success) {
      if (showToast) showToast(res.message || 'Student permanently deleted.');
      await loadRegistrations();
      if (onDataChanged) onDataChanged();
    } else if (showToast) {
      showToast(res?.error || 'Failed to delete student.');
    }
  };

  const confirmClearAllStudents = async () => {
    if (clearAllInput.trim() !== 'CLEAR ALL') {
      if (showToast) showToast('Please type "CLEAR ALL" exactly to confirm.');
      return;
    }
    setIsProcessingAction(true);
    const res = await adminRegistrationActionApi({
      action: 'clear_all',
      confirmationPhrase: 'CLEAR ALL'
    });
    setIsProcessingAction(false);
    setShowClearAllModal(false);
    setClearAllInput('');

    if (res && res.success) {
      if (showToast) showToast(res.message || 'All student records cleared.');
      await loadRegistrations();
      if (onDataChanged) onDataChanged();
    } else if (showToast) {
      showToast(res?.error || 'Failed to clear students.');
    }
  };

  const filteredRegistrations = registrations.filter(reg => {
    const q = searchQuery.trim().toLowerCase();
    const branchLabel = getBranchLabel(reg.branch).toLowerCase();
    const matchesSearch =
      !q ||
      (reg.name || '').toLowerCase().includes(q) ||
      (reg.email || '').toLowerCase().includes(q) ||
      (reg.phone || '').toLowerCase().includes(q) ||
      String(reg.prn || '').toLowerCase().includes(q) ||
      branchLabel.includes(q) ||
      (reg.branch || '').toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Flagged' && reg.flagged) ||
      (statusFilter === 'Suspended' && reg.suspended);

    const normBranch = normalizeBranchCode(reg.branch);
    const matchesBranch =
      branchFilter === 'All' ||
      (branchFilter === 'Previous / other' ? !normBranch : normBranch === branchFilter);

    const matchesTrack =
      trackFilter === 'All' ||
      (reg.track || reg.language || '').toLowerCase() === trackFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesBranch && matchesTrack;
  });

  // Export to CSV / Excel (with UTF-8 BOM so Excel opens columns cleanly)
  // Hide verified status from CSV export
  const handleExportRegistrationsCsv = () => {
    const headers = [
      'Full Name',
      'Email Address',
      'Mobile Number (+91)',
      'Roll Number',
      'Department / Branch',
      'Academic Year',
      'Division',
      'Programming Track',
      'Flagged',
      'Submissions Count',
      'Total Score (/100)',
      'Registration Time (IST)'
    ];

    const rows = filteredRegistrations.map(r => {
      const regTime = r.registeredAt
        ? new Date(r.registeredAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        : 'Legacy';
      return [
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${(r.email || '').replace(/"/g, '""')}"`,
        `"${(r.phone || '').replace(/"/g, '""')}"`,
        `"${String(r.prn || '').replace(/"/g, '""')}"`,
        `"${getBranchLabel(r.branch).replace(/"/g, '""')}"`,
        `"${(r.year || '').replace(/"/g, '""')}"`,
        `"${(r.division || 'A').replace(/"/g, '""')}"`,
        `"${(r.track || r.language || 'Python').replace(/"/g, '""')}"`,
        `"${r.flagged ? 'YES' : 'NO'}"`,
        r.submissionCount || 0,
        r.totalScore || 0,
        `"${regTime}"`
      ];
    });

    const csvString = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `svit_technova_registrations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="admin-registrations-panel">
      {/* 1. Summary Counts: Total, Verified, Unverified, Flagged/Suspended, by Branch, and by Track */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Total Registered</span>
            <Users className="w-4 h-4 text-[#B3122B]" />
          </div>
          <div data-testid="admin-reg-total-count" className="text-2xl font-black text-[#1A1A1A] dark:text-white mt-1">
            {summary.total}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Submissions Active</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div data-testid="admin-reg-active-count" className="text-2xl font-black text-emerald-600 mt-1">
            {registrations.filter(r => (r.submissionCount || 0) > 0).length}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Flagged</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div data-testid="admin-reg-flagged-count" className="text-2xl font-black text-amber-600 mt-1">
            {summary.flagged || 0}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Suspended</span>
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-600 mt-1">
            {summary.suspended || 0}
          </div>
        </div>
      </div>

      {/* Breakdown by Branch and by Track */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440]">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-3">
            Registrations by Programming Track
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {['C', 'C++', 'Java', 'Python'].map(tr => (
              <div
                key={tr}
                className="p-2.5 rounded-xl bg-[#FCF9F2] dark:bg-[#121418] border border-[#E8DEC8] dark:border-[#2E3440] text-center"
              >
                <div className="text-lg font-black text-[#B3122B] dark:text-[#ff8a9e]">
                  {summary.byTrack?.[tr] || 0}
                </div>
                <div className="text-[11px] font-bold text-[#1A1A1A] dark:text-white">{tr}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440]">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-3">
            Registrations by Department / Branch
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.byBranch || {}).length === 0 ? (
              <span className="text-xs text-gray-400">No registrations yet</span>
            ) : (
              Object.entries(summary.byBranch || {}).map(([branchName, count]) => (
                <div
                  key={branchName}
                  className="px-3 py-1.5 rounded-xl bg-[#FCF9F2] dark:bg-[#121418] border border-[#E8DEC8] dark:border-[#2E3440] text-xs flex items-center gap-2"
                >
                  <span className="font-semibold text-[#1A1A1A] dark:text-white">{getBranchLabel(branchName)}:</span>
                  <span className="font-black text-[#B3122B] dark:text-[#ff8a9e]">{count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 2. Anti-Fake Domain Allowlist & Phone Verification Config */}
      <form
        onSubmit={handleSaveSettings}
        className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] space-y-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#B3122B]" />
            <h3 className="text-sm font-extrabold text-[#1A1A1A] dark:text-white">
              Anti-Fake Email Domain Allowlist & Phone OTP Settings
            </h3>
          </div>
          <button
            type="submit"
            disabled={isSavingSettings}
            className="px-4 py-1.5 rounded-xl bg-[#B3122B] hover:bg-[#8B0D20] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {isSavingSettings ? 'Saving...' : 'Save Verification Policy'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FCF9F2] dark:bg-[#121418] border border-[#E8DEC8] dark:border-[#2E3440] cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(settings.allowlistEnabled)}
              onChange={(e) => setSettings(prev => ({ ...prev, allowlistEnabled: e.target.checked }))}
              className="mt-0.5 accent-[#B3122B]"
            />
            <div>
              <div className="font-bold text-[#1A1A1A] dark:text-white">
                Enforce Allowed Email Domains Only
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                When switched ON, only emails from the domains listed to the right can register. (300+ disposable domains are always blocked.)
              </p>
            </div>
          </label>

          <div className="p-3 rounded-xl bg-[#FCF9F2] dark:bg-[#121418] border border-[#E8DEC8] dark:border-[#2E3440]">
            <label className="block font-bold text-[#1A1A1A] dark:text-white mb-1">
              Allowed College/Email Domains (comma-separated)
            </label>
            <input
              type="text"
              value={domainsInput}
              onChange={(e) => setDomainsInput(e.target.value)}
              placeholder="svit.ac.in, pravara.in, gmail.com"
              className="w-full px-3 py-1.5 rounded-lg border border-[#E8DEC8] dark:border-[#2E3440] bg-white dark:bg-[#181B20] text-xs font-mono text-[#1A1A1A] dark:text-white"
            />
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FCF9F2] dark:bg-[#121418] border border-[#E8DEC8] dark:border-[#2E3440] cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(settings.phoneVerificationRequired)}
              onChange={(e) => setSettings(prev => ({ ...prev, phoneVerificationRequired: e.target.checked }))}
              className="mt-0.5 accent-[#B3122B]"
            />
            <div>
              <div className="font-bold text-[#1A1A1A] dark:text-white">
                Require Strict SMS OTP for +91 Phone
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                When OFF, +91 Indian mobile numbers are pattern-validated and stored uniquely while keeping SMS OTP optional.
              </p>
            </div>
          </label>
        </div>
      </form>

      {/* 3. Search, Filter & Export Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-[#181B20] p-4 rounded-2xl border border-[#E8DEC8] dark:border-[#2E3440]">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, +91 phone, roll no..."
              data-testid="admin-reg-search"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#121418] text-xs text-[#1A1A1A] dark:text-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            data-testid="admin-reg-status-filter"
            className="px-3 py-2 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#121418] text-xs font-bold text-[#1A1A1A] dark:text-white"
          >
            <option value="All">All Statuses</option>
            <option value="Flagged">Flagged</option>
            <option value="Suspended">Suspended</option>
          </select>

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            data-testid="admin-reg-branch-filter"
            className="px-3 py-2 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#121418] text-xs font-bold text-[#1A1A1A] dark:text-white"
          >
            <option value="All">All Branches</option>
            <option value="ECE">Electronics and Communication (ECE)</option>
            <option value="IT">Information Technology (IT)</option>
            <option value="COMP">Computer Engineering</option>
            <option value="CHEM">Chemical Engineering</option>
            <option value="Previous / other">Previous / other</option>
          </select>

          <select
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#121418] text-xs font-bold text-[#1A1A1A] dark:text-white"
          >
            <option value="All">All Tracks</option>
            <option value="C">C</option>
            <option value="C++">C++</option>
            <option value="Java">Java</option>
            <option value="Python">Python</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 ${
            isLiveActive 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isLiveActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{isLiveActive ? 'Live' : 'Reconnecting...'}</span>
            <span className="text-[10px] opacity-75 font-mono">({lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})</span>
          </div>

          <button
            type="button"
            onClick={() => loadRegistrations(false)}
            className="px-3 py-2 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] text-xs font-bold text-gray-700 dark:text-gray-200 hover:border-[#B3122B] flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportRegistrationsCsv}
            data-testid="admin-reg-export-csv-btn"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setClearAllInput('');
              setShowClearAllModal(true);
            }}
            data-testid="admin-clear-all-students-btn"
            className="px-3.5 py-2 rounded-xl bg-red-600/10 hover:bg-red-600 border border-red-600/30 text-red-600 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All Students</span>
          </button>
        </div>
      </div>

      {/* 4. Full Registrations Table */}
      <div className="bg-white dark:bg-[#181B20] rounded-2xl border border-[#E8DEC8] dark:border-[#2E3440] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#14171C] text-[11px] font-extrabold uppercase text-gray-500">
                <th className="py-3.5 px-4">Student & Roll No</th>
                <th className="py-3.5 px-4">Email & Mobile (+91)</th>
                <th className="py-3.5 px-4">Branch • Year • Div</th>
                <th className="py-3.5 px-4">Track</th>
                <th className="py-3.5 px-4">Registered Time</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DEC8]/60 dark:divide-[#2E3440] text-xs">
              {filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">
                    No student registrations match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRegistrations.map(reg => (
                  <tr
                    key={reg.uid || reg.prn}
                    data-testid={`admin-reg-row-${reg.prn}`}
                    className={`hover:bg-[#FCF9F2]/60 dark:hover:bg-[#1E222A]/50 transition-colors ${
                      reg.suspended ? 'opacity-60 bg-red-500/5' : reg.flagged ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-[#1A1A1A] dark:text-white flex items-center gap-1.5">
                        <span>{reg.name}</span>
                        {reg.flagged && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                            Flagged
                          </span>
                        )}
                        {reg.suspended && (
                          <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-700 dark:text-red-300 text-[10px] font-bold">
                            Suspended
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-[#B3122B] dark:text-[#ff8a9e] font-bold">
                        Roll No: {reg.prn}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 text-[#1A1A1A] dark:text-gray-200 font-medium">
                        <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                        <span>{reg.email || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-[11px] text-gray-500 mt-0.5">
                        <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                        <span>{reg.phone || 'Not provided (Legacy)'}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#1A1A1A] dark:text-white">{getBranchLabel(reg.branch)}</div>
                      <div className="text-[11px] text-gray-500">
                        {reg.year} • Div {reg.division || 'A'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-[#B3122B]/10 text-[#B3122B] dark:text-[#ff8a9e] font-bold text-[11px]">
                        {reg.track || reg.language || 'Python'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-[11px] text-gray-500">
                      {reg.registeredAt
                        ? new Date(reg.registeredAt).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'Pre-existing'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">

                        <button
                          type="button"
                          onClick={() => handleAccountAction('flag', reg)}
                          title={reg.flagged ? 'Unflag account' : 'Flag suspicious account'}
                          className={`p-1.5 rounded-lg cursor-pointer ${
                            reg.flagged
                              ? 'bg-amber-500 text-white'
                              : 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20'
                          }`}
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>

                        {reg.suspended ? (
                          <button
                            type="button"
                            onClick={() => handleAccountAction('unsuspend', reg)}
                            title="Restore suspended account"
                            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 cursor-pointer"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAccountAction('suspend', reg)}
                            title="Suspend account"
                            className="p-1.5 rounded-lg bg-orange-500/10 text-orange-700 hover:bg-orange-500/20 cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleAccountAction('delete', reg)}
                          title="Delete fake account"
                          data-testid={`admin-delete-reg-${reg.prn}`}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Single Student Delete Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="max-w-md w-full bg-white dark:bg-[#181B20] border border-red-200 dark:border-red-950/60 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-red-600">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-[#1A1A1A] dark:text-white">Delete Student Account</h3>
                  <p className="text-xs text-gray-500">Permanent cascade deletion</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#121418] border border-gray-200 dark:border-gray-800 text-xs space-y-1.5">
              <div><strong>Name:</strong> {studentToDelete.name}</div>
              <div><strong>Roll No:</strong> {studentToDelete.prn}</div>
              <div><strong>Email:</strong> {studentToDelete.email}</div>
              <div><strong>Track:</strong> {studentToDelete.track || studentToDelete.language}</div>
              <div><strong>Department:</strong> {studentToDelete.branch}</div>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              This will permanently delete this student record, their submissions, quiz scores, badges, certificates, and leaderboard ranking. Their login sessions will be invalidated immediately across all devices.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={confirmDeleteStudent}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isProcessingAction ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Clear All Students Confirmation Modal */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="max-w-md w-full bg-white dark:bg-[#181B20] border-2 border-red-500 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-red-600">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-black text-base text-red-600 dark:text-red-400">Clear All Student Data</h3>
                  <p className="text-xs text-gray-500">Destructive administrative action</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClearAllModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-xs text-red-800 dark:text-red-300">
              <strong>Warning:</strong> You are about to permanently delete <strong>{summary.total}</strong> registered student account(s), including all submissions, quiz marks, certificates, and leaderboard standings.
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                To confirm, type <span className="font-mono text-red-600 bg-red-100 dark:bg-red-950/40 px-1 py-0.5 rounded">CLEAR ALL</span> below:
              </label>
              <input
                type="text"
                value={clearAllInput}
                onChange={(e) => setClearAllInput(e.target.value)}
                placeholder="Type CLEAR ALL to confirm"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121418] text-xs font-mono font-bold text-[#1A1A1A] dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowClearAllModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearAllInput.trim() !== 'CLEAR ALL' || isProcessingAction}
                onClick={confirmClearAllStudents}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isProcessingAction ? 'Purging All Students...' : 'Wipe All Students'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
