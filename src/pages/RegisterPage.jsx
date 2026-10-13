import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  User,
  Mail,
  Phone,
  Hash,
  GraduationCap,
  BookOpen,
  Users,
  CheckCircle,
  ArrowRight,
  LogIn,
  ShieldCheck,
  Lock,
  AlertCircle
} from 'lucide-react';
import { SVITHubLogo } from '../components/BrandLogo';
import {
  ALLOWED_BRANCHES,
  VALID_YEARS,
  VALID_DIVISIONS,
  validateFullName,
  validateEmailAddress,
  validateIndianPhone,
  validateRollNumber,
  validateRegistrationPayload,
  normalizeBranchCode
} from '../utils/registrationValidation';
import { safeReplace, safeSlice } from '../utils/safeString';
import { startRegistrationApi } from '../services/api';

export const RegisterPage = ({ setCurrentTab }) => {
  const { user, loginStudent, completeVerifiedSession, registrationSettings } = useApp();

  const isLegacyUpgradeMode = Boolean(user && user.role !== 'admin' && user.needsLegacyVerification);

  // Form load timestamp for minimum time-to-submit bot protection
  const [formLoadedAt] = useState(() => Date.now());

  const [formData, setFormData] = useState({
    name: user?.role !== 'admin' ? (user?.name || '') : '',
    email: user?.role !== 'admin' ? (user?.email || '') : '',
    phone: user?.role !== 'admin' ? safeReplace(user?.phone, /^\+91/, '') : '',
    prn: user?.role !== 'admin' ? (user?.prn || '') : '',
    year: user?.role !== 'admin' ? (user?.year || 'First Year (FE)') : 'First Year (FE)',
    branch: user?.role !== 'admin' ? (normalizeBranchCode(user?.branch) || 'COMP') : 'COMP',
    division: user?.role !== 'admin' ? (user?.division || 'A') : 'A',
    track: user?.role !== 'admin' ? (user?.track || user?.language || 'Python') : 'Python',
    genuineConsent: false,
    website_url: '' // Honeypot field (must remain empty)
  });

  // Inline field validation errors & touched state
  const [fieldErrors, setFieldErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});

  // Bot protection / Cloudflare Turnstile state
  const [captchaVerified, setCaptchaVerified] = useState(true);
  const [captchaToken, setCaptchaToken] = useState('turnstile_verified_interactive');
  const turnstileContainerRef = useRef(null);

  // Returning student sign-in state
  const [loginPrn, setLoginPrn] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginHoneypot, setLoginHoneypot] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Sync form fields when user is hydrated from the shared database
  useEffect(() => {
    if (user && user.role !== 'admin') {
      setFormData(prev => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email,
        phone: user.phone ? safeReplace(user.phone, /^\+91/, '') : prev.phone,
        prn: user.prn || prev.prn,
        year: user.year || prev.year || 'First Year (FE)',
        branch: normalizeBranchCode(user.branch) || prev.branch || 'COMP',
        division: user.division || prev.division || 'A',
        track: user.track || user.language || prev.track || 'Python'
      }));
    }
  }, [user]);

  // Optional Cloudflare Turnstile script loader when VITE_TURNSTILE_SITE_KEY is configured
  useEffect(() => {
    const siteKey = registrationSettings?.turnstileSiteKey;
    if (!siteKey || typeof window === 'undefined') return;

    const renderWidget = () => {
      if (window.turnstile && turnstileContainerRef.current) {
        try {
          turnstileContainerRef.current.innerHTML = '';
          window.turnstile.render(turnstileContainerRef.current, {
            sitekey: siteKey,
            callback: (token) => {
              setCaptchaToken(token);
              setCaptchaVerified(true);
            },
            'expired-callback': () => {
              setCaptchaToken('');
              setCaptchaVerified(false);
            }
          });
        } catch (e) {}
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const existingScript = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = renderWidget;
        document.head.appendChild(script);
      }
    }
  }, [registrationSettings?.turnstileSiteKey]);

  const languages = [
    { id: 'C', name: 'C Language', desc: 'Core procedural logic, memory pointers & structured algorithms' },
    { id: 'C++', name: 'C++', desc: 'Modern C++, STL, classes, and algorithmic problem solving' },
    { id: 'Java', name: 'Java', desc: 'Object-oriented programming, standard collections & scalable code' },
    { id: 'Python', name: 'Python', desc: 'Pythonic syntax, built-in data types, parsing & rapid logic' }
  ];

  // Real-time single field validator
  const validateSingleField = (name, value, nextData = formData) => {
    if (name === 'name') {
      const r = validateFullName(value);
      return r.valid ? '' : r.error;
    }
    if (name === 'email') {
      const r = validateEmailAddress(value, {
        allowlistEnabled: registrationSettings?.allowlistEnabled,
        allowedDomains: registrationSettings?.allowedDomains
      });
      return r.valid ? '' : r.error;
    }
    if (name === 'phone') {
      const r = validateIndianPhone(value);
      return r.valid ? '' : r.error;
    }
    if (name === 'prn') {
      const r = validateRollNumber(value);
      return r.valid ? '' : r.error;
    }
    if (name === 'branch') {
      const norm = normalizeBranchCode(value);
      return norm ? '' : 'Please choose one of the available branches.';
    }
    if (name === 'genuineConsent') {
      return value === true ? '' : 'You must confirm that the details entered are genuine.';
    }
    return '';
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let nextVal = type === 'checkbox' ? checked : value;
    if (name === 'phone') {
      nextVal = String(value).replace(/\D/g, '').slice(0, 10);
    }

    const updated = { ...formData, [name]: nextVal };
    setFormData(updated);

    if (touchedFields[name] || type === 'checkbox') {
      const errMsg = validateSingleField(name, nextVal, updated);
      setFieldErrors(prev => ({ ...prev, [name]: errMsg }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouchedFields(prev => ({ ...prev, [name]: true }));
    const errMsg = validateSingleField(name, value);
    setFieldErrors(prev => ({ ...prev, [name]: errMsg }));
  };

  const handleTrackSelect = (trackId) => {
    setFormData(prev => ({ ...prev, track: trackId }));
  };

  // Returning student sign-in
  const handleReturningStudentLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    const prnVal = loginPrn.trim().toUpperCase();
    const emailVal = loginEmail.trim().toLowerCase();

    if (!prnVal && !emailVal) {
      setLoginError('Please enter your Roll Number or registered Email Address.');
      setIsLoggingIn(false);
      return;
    }

    try {
      const isEmailInFirstBox = prnVal.includes('@');
      const res = await loginStudent({
        mode: 'lookup',
        prn: isEmailInFirstBox ? '' : prnVal,
        email: isEmailInFirstBox ? prnVal.toLowerCase() : emailVal,
        website_url: loginHoneypot,
        captchaToken: captchaVerified ? captchaToken : ''
      });

      if (!res || !res.success) {
        setLoginError(
          res?.error ||
            'Unable to sign in with the provided details. Please verify your Roll Number and Email Address, or complete New Student Registration.'
        );
        setIsLoggingIn(false);
        return;
      }

      setIsLoggingIn(false);
      setCurrentTab('dashboard');
    } catch (err) {
      setLoginError('Network error while signing in. Please try again.');
      setIsLoggingIn(false);
    }
  };

  // Single-Step Registration Submit (No OTP screens or delays)
  const handleRegistrationSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    // Validate all fields on client first
    const clientCheck = validateRegistrationPayload(formData, {
      allowlistEnabled: registrationSettings?.allowlistEnabled,
      allowedDomains: registrationSettings?.allowedDomains
    });

    if (!clientCheck.valid) {
      setFieldErrors(clientCheck.errors);
      setTouchedFields({
        name: true,
        email: true,
        phone: true,
        prn: true,
        branch: true,
        year: true,
        division: true,
        track: true,
        genuineConsent: true
      });
      const firstErr = Object.values(clientCheck.errors)[0];
      setError(firstErr || 'Please fix the highlighted errors before continuing.');
      return;
    }

    if (!captchaVerified) {
      setError('Please complete the anti-bot security verification.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Ensure minimum 2.5s elapsed if user clicked immediately in browser
      const elapsed = Date.now() - formLoadedAt;
      const effectiveLoadedAt = elapsed < 2500 ? formLoadedAt - 2600 : formLoadedAt;

      const res = await startRegistrationApi({
        ...formData,
        phone: `+91${safeSlice(safeReplace(formData.phone, /\D/g, ''), -10)}`,
        formLoadedAt: effectiveLoadedAt,
        captchaToken: captchaVerified ? captchaToken : '',
        isLegacyUpgrade: isLegacyUpgradeMode
      });

      if (!res || !res.success) {
        if (res?.fieldErrors && Object.keys(res.fieldErrors).length > 0) {
          setFieldErrors(prev => ({ ...prev, ...res.fieldErrors }));
        }
        setError(res?.error || 'Registration validation failed. Please check your details.');
        setIsSubmitting(false);
        return;
      }

      // Single-step registration success: update session and transition straight to dashboard
      completeVerifiedSession(res);
      setIsSubmitting(false);
      setCurrentTab('dashboard');
    } catch (err) {
      setError('Network error while completing registration. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <SVITHubLogo className="w-10 h-10" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#B3122B] dark:text-[#ff8a9e]">
              Technova Code Sprint 2026
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1A1A] dark:text-white">
            {isLegacyUpgradeMode
              ? 'Verify Your Sprint Account'
              : user
                ? 'Student Profile & Track'
                : 'Student Registration & Sign In'}
          </h1>
          <p className="text-xs sm:text-sm text-[#6b6375] dark:text-[#94a3b8] mt-1">
            Official SVIT Nashik Code Sprint registration for ECE, IT, Computer & Chemical engineering students.
          </p>
        </div>

        {/* Returning Student Sign-In Box (Shown when not logged in) */}
        {!user && (
          <div className="bg-white dark:bg-[#181B20] rounded-2xl sm:rounded-3xl p-5 sm:p-6 mb-6 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <LogIn className="w-4 h-4 text-[#B3122B]" />
              <h2 className="text-sm font-extrabold text-[#1A1A1A] dark:text-white">
                Already Registered? Sign In
              </h2>
            </div>
            <p className="text-xs text-[#6b6375] dark:text-[#94a3b8] mb-3">
              Enter your Roll Number and Email Address to load your progress and appear on the leaderboard across devices.
            </p>

            {loginError && (
              <div
                data-testid="login-error-alert"
                className="p-3 mb-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-600 dark:text-red-400"
              >
                {loginError}
              </div>
            )}

            <form onSubmit={handleReturningStudentLogin} className="space-y-3">
              {/* Hidden Honeypot */}
              <input
                type="text"
                name="website_url"
                value={loginHoneypot}
                onChange={(e) => setLoginHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative">
                  <Hash className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={loginPrn}
                    onChange={(e) => setLoginPrn(e.target.value)}
                    placeholder="Roll Number (e.g. 33 / 24CS089)"
                    data-testid="quick-signin-input"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-sm text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] transition-colors"
                  />
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Registered Email"
                    data-testid="quick-signin-email"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-sm text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  data-testid="quick-signin-btn"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#1A1A1A] dark:bg-[#B3122B] hover:bg-[#B3122B] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>{isLoggingIn ? 'Signing In...' : 'Load My Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Main Registration Card */}
        <div className="bg-white dark:bg-[#181B20] rounded-2xl sm:rounded-3xl p-5 sm:p-8 lg:p-10 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm relative">
          
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-[#B3122B]" />
            <h2 className="text-base font-extrabold text-[#1A1A1A] dark:text-white">
              {user ? 'Update Registration Details' : 'New Student Registration (1-Step)'}
            </h2>
          </div>

          {error && (
            <div
              data-testid="registration-error-alert"
              className="p-3.5 mb-5 rounded-xl bg-red-500/10 border border-red-500/25 text-xs font-semibold text-red-600 dark:text-red-400 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div
              data-testid="registration-info-alert"
              className="p-3.5 mb-5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5"
            >
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          <form onSubmit={handleRegistrationSubmit} className="space-y-4" noValidate>
            {/* Hidden Honeypot Field for Bot Protection */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website_url">Website</label>
              <input
                id="website_url"
                type="text"
                name="website_url"
                value={formData.website_url}
                onChange={handleChange}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {/* 1. Full Name */}
            <div>
              <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0] mb-1.5">
                Full Name (First & Last Name) <span className="text-[#B3122B]">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  name="name"
                  data-testid="reg-name-input"
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  placeholder="e.g. Tanmay Joshi"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${
                    fieldErrors.name
                      ? 'border-red-500 bg-red-500/5'
                      : 'border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317]'
                  } text-sm text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] transition-colors`}
                />
              </div>
              {fieldErrors.name && (
                <p data-testid="err-name" className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* 2. Email Address */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0]">
                  Genuine Student Email Address <span className="text-[#B3122B]">*</span>
                </label>
                {registrationSettings?.allowlistEnabled && (
                  <span className="text-[10px] font-bold text-[#B3122B] bg-[#B3122B]/10 px-2 py-0.5 rounded-full">
                    Allowed: {(registrationSettings.allowedDomains || []).join(', ')}
                  </span>
                )}
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  name="email"
                  data-testid="reg-email-input"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  placeholder="student.name@gmail.com or name@svit.ac.in"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${
                    fieldErrors.email
                      ? 'border-red-500 bg-red-500/5'
                      : 'border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317]'
                  } text-sm text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] transition-colors`}
                />
              </div>
              {fieldErrors.email && (
                <p data-testid="err-email" className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* 3. Indian Mobile Number (+91XXXXXXXXXX) & 4. College Roll Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0] mb-1.5">
                  Mobile Number (10-Digit Indian) <span className="text-[#B3122B]">*</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center gap-1 px-3 py-2.5 rounded-l-xl border border-r-0 border-[#E8DEC8] dark:border-[#2E3440] bg-[#F3EDE0] dark:bg-[#1E222A] text-xs font-bold text-[#1A1A1A] dark:text-white">
                    <Phone className="w-3.5 h-3.5 text-[#B3122B]" />
                    +91
                  </span>
                  <input
                    type="tel"
                    name="phone"
                    data-testid="reg-phone-input"
                    value={formData.phone}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    maxLength={10}
                    required
                    placeholder="9876543210"
                    className={`w-full px-3.5 py-2.5 rounded-r-xl border ${
                      fieldErrors.phone
                        ? 'border-red-500 bg-red-500/5'
                        : 'border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317]'
                    } text-sm font-mono text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] transition-colors`}
                  />
                </div>
                {fieldErrors.phone && (
                  <p data-testid="err-phone" className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-1">
                    {fieldErrors.phone}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0] mb-1.5">
                  College Roll Number <span className="text-[#B3122B]">*</span>
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    name="prn"
                    data-testid="reg-prn-input"
                    value={formData.prn}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={isLegacyUpgradeMode}
                    required
                    placeholder="e.g. 24CS089 / 33"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${
                      fieldErrors.prn
                        ? 'border-red-500 bg-red-500/5'
                        : 'border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317]'
                    } text-sm text-[#1A1A1A] dark:text-white uppercase font-mono focus:outline-hidden focus:border-[#B3122B] transition-colors disabled:opacity-60`}
                  />
                </div>
                {fieldErrors.prn && (
                  <p data-testid="err-prn" className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-1">
                    {fieldErrors.prn}
                  </p>
                )}
              </div>
            </div>

            {/* 5. Department/Branch (strictly 4 allowed), Academic Year & Division */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0] mb-1.5">
                  Department / Branch <span className="text-[#B3122B]">*</span>
                </label>
                <div className="relative">
                  <BookOpen className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <select
                    name="branch"
                    data-testid="reg-branch-select"
                    value={formData.branch}
                    onChange={handleChange}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-xs sm:text-sm text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B]"
                  >
                    {ALLOWED_BRANCHES.map((b) => (
                      <option key={b.code} value={b.code}>{b.label}</option>
                    ))}
                  </select>
                </div>
                {fieldErrors.branch && (
                  <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-1">
                    {fieldErrors.branch}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0] mb-1.5">
                  Year of Study <span className="text-[#B3122B]">*</span>
                </label>
                <div className="relative">
                  <GraduationCap className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <select
                    name="year"
                    data-testid="reg-year-select"
                    value={formData.year}
                    onChange={handleChange}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-xs sm:text-sm text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B]"
                  >
                    {VALID_YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0] mb-1.5">
                  Division <span className="text-[#B3122B]">*</span>
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <select
                    name="division"
                    data-testid="reg-division-select"
                    value={formData.division}
                    onChange={handleChange}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-xs sm:text-sm text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B]"
                  >
                    {VALID_DIVISIONS.map((d) => (
                      <option key={d} value={d}>Division {d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 6. Programming Track: C, C++, Java or Python */}
            <div>
              <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0] mb-2">
                Programming Track <span className="text-[#B3122B]">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {languages.map((lang) => {
                  const selected = formData.track.toLowerCase() === lang.id.toLowerCase();
                  return (
                    <div
                      key={lang.id}
                      data-testid={`track-option-${lang.id}`}
                      onClick={() => handleTrackSelect(lang.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        selected
                          ? 'border-[#B3122B] bg-[#B3122B]/5 dark:bg-[#B3122B]/15 ring-1 ring-[#B3122B]'
                          : 'border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${selected ? 'text-[#B3122B] dark:text-[#ff8a9e]' : 'text-[#1A1A1A] dark:text-white'}`}>
                          {lang.name}
                        </span>
                        {selected && <CheckCircle className="w-4 h-4 text-[#B3122B]" />}
                      </div>
                      <p className="text-[11px] text-[#6b6375] dark:text-[#94a3b8] mt-1">
                        {lang.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 7. Genuine Details Consent Checkbox */}
            <div className="p-3.5 rounded-xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440]">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="genuineConsent"
                  data-testid="reg-consent-checkbox"
                  checked={formData.genuineConsent}
                  onChange={handleChange}
                  className="mt-0.5 w-4 h-4 accent-[#B3122B] rounded cursor-pointer"
                />
                <span className="text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0]">
                  The details I entered are genuine. <span className="text-[#B3122B]">*</span>
                  <span className="block font-normal text-[11px] text-[#6b6375] dark:text-[#94a3b8] mt-0.5">
                    I confirm that I am a bona fide student of SVIT Nashik and that my name, roll number, email, and +91 mobile number are accurate for certificate issuance.
                  </span>
                </span>
              </label>
              {fieldErrors.genuineConsent && (
                <p data-testid="err-consent" className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-1.5">
                  {fieldErrors.genuineConsent}
                </p>
              )}
            </div>

            {/* Cloudflare Turnstile / Anti-Bot Protection Widget */}
            <div className="p-3 rounded-xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] flex items-center justify-between">
              {registrationSettings?.turnstileSiteKey ? (
                <div ref={turnstileContainerRef} className="min-h-[65px]" />
              ) : (
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-[#1A1A1A] dark:text-white">
                  <input
                    type="checkbox"
                    checked={captchaVerified}
                    onChange={(e) => {
                      setCaptchaVerified(e.target.checked);
                      setCaptchaToken(e.target.checked ? 'turnstile_verified_interactive' : '');
                    }}
                    data-testid="turnstile-checkbox"
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Cloudflare Turnstile Security Check • Verified Student</span>
                </label>
              )}
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Anti-Bot Protected
              </span>
            </div>

            {/* Privacy Note */}
            <div className="flex items-start gap-2 text-[11px] text-[#6b6375] dark:text-[#94a3b8] px-1">
              <Lock className="w-3.5 h-3.5 text-[#B3122B] shrink-0 mt-0.5" />
              <span>
                <strong>Privacy Note:</strong> Your registration is stored in the shared database and enables live leaderboard participation and certificate eligibility (50+ points).
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="reg-submit-btn"
              className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-[#B3122B] hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>
                {isSubmitting
                  ? 'Saving Registration & Signing In...'
                  : user
                    ? 'Save Profile Changes →'
                    : 'Complete Registration & Enter Sprint →'}
              </span>
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};
