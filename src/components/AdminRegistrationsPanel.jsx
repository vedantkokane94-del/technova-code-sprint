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
  Phone
} from 'lucide-react';
import {
  fetchAdminRegistrationsApi,
  adminRegistrationActionApi
} from '../services/api';

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

  const loadRegistrations = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchAdminRegistrationsApi();
    if (data) {
      setRegistrations(data.registrations || []);
      if (data.summary) setSummary(data.summary);
      if (data.registrationSettings) {
        setSettings(data.registrationSettings);
        setDomainsInput((data.registrationSettings.allowedDomains || []).join(', '));
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadRegistrations();
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
      const ok = window.confirm(
        `Delete account "${student.name}" (Roll No: ${student.prn}, Email: ${student.email})? This will permanently remove the fake/spam registration and any associated submissions.`
      );
      if (!ok) return;
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

  const filteredRegistrations = registrations.filter(reg => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (reg.name || '').toLowerCase().includes(q) ||
      (reg.email || '').toLowerCase().includes(q) ||
      (reg.phone || '').toLowerCase().includes(q) ||
      String(reg.prn || '').toLowerCase().includes(q) ||
      (reg.branch || '').toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Verified' && reg.emailVerified && !reg.suspended) ||
      (statusFilter === 'Unverified' && !reg.emailVerified && !reg.suspended) ||
      (statusFilter === 'Flagged' && reg.flagged) ||
      (statusFilter === 'Suspended' && reg.suspended);

    const matchesBranch = branchFilter === 'All' || reg.branch === branchFilter;
    const matchesTrack =
      trackFilter === 'All' ||
      (reg.track || reg.language || '').toLowerCase() === trackFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesBranch && matchesTrack;
  });

  // Export to CSV / Excel (with UTF-8 BOM so Excel opens columns cleanly)
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
      'Verified Status',
      'Account Status',
      'Flagged',
      'Submissions Count',
      'Total Score (/100)',
      'Registration Time (IST)'
    ];

    const rows = filteredRegistrations.map(r => {
      const regTime = r.registeredAt
        ? new Date(r.registeredAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        : 'Legacy';
      const verifiedLabel = r.suspended
        ? 'SUSPENDED'
        : r.emailVerified
          ? 'VERIFIED'
          : 'UNVERIFIED';
      return [
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${(r.email || '').replace(/"/g, '""')}"`,
        `"${(r.phone || '').replace(/"/g, '""')}"`,
        `"${String(r.prn || '').replace(/"/g, '""')}"`,
        `"${(r.branch || '').replace(/"/g, '""')}"`,
        `"${(r.year || '').replace(/"/g, '""')}"`,
        `"${(r.division || 'A').replace(/"/g, '""')}"`,
        `"${(r.track || r.language || 'Python').replace(/"/g, '""')}"`,
        `"${verifiedLabel}"`,
        `"${r.accountStatus || ''}"`,
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

  const uniqueBranches = Array.from(new Set(registrations.map(r => r.branch).filter(Boolean)));

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
            <span className="text-xs font-bold text-gray-500">OTP Verified</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div data-testid="admin-reg-verified-count" className="text-2xl font-black text-emerald-600 mt-1">
            {summary.verified}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Unverified / Pending</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div data-testid="admin-reg-unverified-count" className="text-2xl font-black text-amber-600 mt-1">
            {summary.unverified}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Flagged / Suspended</span>
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-600 mt-1">
            {(summary.flagged || 0) + (summary.suspended || 0)}
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
                  <span className="font-semibold text-[#1A1A1A] dark:text-white">{branchName}:</span>
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
            <option value="Verified">Verified Only</option>
            <option value="Unverified">Unverified Only</option>
            <option value="Flagged">Flagged</option>
            <option value="Suspended">Suspended</option>
          </select>

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#121418] text-xs font-bold text-[#1A1A1A] dark:text-white"
          >
            <option value="All">All Branches</option>
            {uniqueBranches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadRegistrations}
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
            <span>Export Registrations (CSV / Excel)</span>
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
                <th className="py-3.5 px-4">Verified Status</th>
                <th className="py-3.5 px-4">Registered Time</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DEC8]/60 dark:divide-[#2E3440] text-xs">
              {filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400">
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
                      <div className="font-semibold text-[#1A1A1A] dark:text-white">{reg.branch}</div>
                      <div className="text-[11px] text-gray-500">
                        {reg.year} • Div {reg.division || 'A'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-[#B3122B]/10 text-[#B3122B] dark:text-[#ff8a9e] font-bold text-[11px]">
                        {reg.track || reg.language || 'Python'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {reg.suspended ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/15 text-red-700 dark:text-red-300 font-bold text-[11px]">
                          <Ban className="w-3 h-3" />
                          Suspended
                        </span>
                      ) : reg.emailVerified ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      ) : reg.accountStatus === 'legacy_active' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold text-[11px]">
                          <Clock className="w-3 h-3" />
                          Legacy (Prompted)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-[11px]">
                          <Clock className="w-3 h-3" />
                          Unverified
                        </span>
                      )}
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
                        {!reg.emailVerified && (
                          <button
                            type="button"
                            onClick={() => handleAccountAction('verify', reg)}
                            title="Manually mark account as verified"
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}

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
    </div>
  );
};
