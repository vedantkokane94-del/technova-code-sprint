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
  RefreshCw,
  Lock,
  AlertCircle,
  Check
} from 'lucide-react';
import { SVITHubLogo } from '../components/BrandLogo';
import {
  validateFullName,
  validateEmailAddress,
  validateIndianPhone,
  validateRollNumber,
  validateRegistrationPayload,
  VALID_BRANCHES,
  VALID_YEARS,
  VALID_DIVISIONS
} from '../utils/registrationValidation';
import {
  startRegistrationApi,
  resendOtpApi,
  verifyEmailOtpApi,
  verifyPhoneOtpApi
} from '../services/api';

const STEPS = [
  { id: 'details', num: 1, label: 'Details' },
  { id: 'verify_email', num: 2, label: 'Verify Email' },
  { id: 'verify_phone', num: 3, label: 'Verify Phone' },
  { id: 'done', num: 4, label: 'Done' }
];

export const RegisterPage = ({ setCurrentTab }) => {
  const { user, loginStudent, completeVerifiedSession, registrationSettings } = useApp();

  const isLegacyUpgradeMode = Boolean(user && user.role !== 'admin' && user.needsLegacyVerification);

  // Multi-step state: 'details' | 'verify_email' | 'verify_phone' | 'done'
  const [step, setStep] = useState('details');

  // Form load timestamp for minimum time-to-submit bot protection
  const [formLoadedAt, setFormLoadedAt] = useState(() => Date.now());

  const [formData, setFormData] = useState({
    name: user?.role !== 'admin' ? (user?.name || '') : '',
    email: user?.role !== 'admin' ? (user?.email || '') : '',
    phone: user?.role !== 'admin' ? (user?.phone ? user.phone.replace(/^\+91/, '') : '') : '',
    prn: user?.role !== 'admin' ? (user?.prn || '') : '',
    year: user?.role !== 'admin' ? (user?.year || 'First Year (FE)') : 'First Year (FE)',
    branch: user?.role !== 'admin' ? (user?.branch || 'Computer Engineering') : 'Computer Engineering',
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

  // OTP Verification state
  const [pendingPrn, setPendingPrn] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPhone, setPendingPhone] = useState('');
  const [emailOtpInput, setEmailOtpInput] = useState('');
  const [phoneOtpInput, setPhoneOtpInput] = useState('');
  const [sandboxEmailOtp, setSandboxEmailOtp] = useState('');
  const [sandboxPhoneOtp, setSandboxPhoneOtp] = useState('');
  const [otpExpirySeconds, setOtpExpirySeconds] = useState(600);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);

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
        phone: user.phone ? user.phone.replace(/^\+91/, '') : prev.phone,
        prn: user.prn || prev.prn,
        year: user.year || prev.year || 'First Year (FE)',
        branch: user.branch || prev.branch || 'Computer Engineering',
        division: user.division || prev.division || 'A',
        track: user.track || user.language || prev.track || 'Python'
      }));
    }
  }, [user]);

  // Countdown timers for OTP expiry (10 mins) and Resend cooldown (60s)
  useEffect(() => {
    if (step !== 'verify_email' && step !== 'verify_phone') return;
    const timer = setInterval(() => {
      setOtpExpirySeconds(prev => (prev > 0 ? prev - 1 : 0));
      setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

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
    const errMsg = validateSingleField(name, value, formData);
    setFieldErrors(prev => ({ ...prev, [name]: errMsg }));
  };

  const handleTrackSelect = (trackId) => {
    setFormData(prev => ({ ...prev, track: trackId }));
    setFieldErrors(prev => ({ ...prev, track: '' }));
  };

  // Returning Student Login (Non-enumerating, rate-limited, bot-protected)
  const handleReturningStudentLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const prnVal = loginPrn.trim().toUpperCase();
    const emailVal = loginEmail.trim().toLowerCase();

    if (!prnVal && !emailVal) {
      setLoginError('Please enter your College Roll Number or Email Address.');
      return;
    }

    if (!captchaVerified) {
      setLoginError('Please complete the security verification check.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const isEmailInFirstBox = prnVal.includes('@') && !emailVal;
      const res = await loginStudent({
        mode: 'lookup',
        prn: isEmailInFirstBox ? '' : prnVal,
        email: isEmailInFirstBox ? prnVal.toLowerCase() : emailVal,
        website_url: loginHoneypot,
        captchaToken: captchaVerified ? captchaToken : ''
      });

      if (!res || !res.success) {
        if (res?.requiresVerification && res?.prn) {
          setPendingPrn(res.prn);
          setPendingEmail(res.email || emailVal);
          setPendingPhone(res.phone || '');
          setStep('verify_email');
          setInfoMessage('Your registration is awaiting email OTP verification. Click Resend OTP if you need a fresh code.');
          setIsLoggingIn(false);
          return;
        }
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

  // Step 1 Submit: Start Registration & Send 6-Digit Email OTP
  const handleStartRegistration = async (e) => {
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
      const effectiveLoadedAt = elapsed < 2500 ? formLoadedAt : formLoadedAt;

      const res = await startRegistrationApi({
        ...formData,
        phone: `+91${String(formData.phone).replace(/\D/g, '').slice(-10)}`,
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

      setPendingPrn(res.prn);
      setPendingEmail(res.email);
      setPendingPhone(res.phone);
      setOtpExpirySeconds(res.expiresInSeconds || 600);
      setResendCooldown(res.resendCooldownSeconds || 60);
      setAttemptsRemaining(5);
      setEmailOtpInput('');
      setSandboxEmailOtp(res.sandboxOtp || '');
      setStep('verify_email');
      setInfoMessage(`A 6-digit verification code has been sent to ${res.email}.`);
      setIsSubmitting(false);
    } catch (err) {
      setError('Network error while starting registration. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Step 2 Submit: Verify 6-Digit Email OTP
  const handleVerifyEmailOtp = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    const cleanOtp = emailOtpInput.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setError('Please enter the 6-digit numeric OTP sent to your email.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyEmailOtpApi({
        prn: pendingPrn,
        otp: cleanOtp
      });

      if (!res || !res.success) {
        if (res?.attemptsRemaining !== undefined) {
          setAttemptsRemaining(res.attemptsRemaining);
        }
        setError(res?.error || 'Invalid OTP code. Please try again.');
        setIsSubmitting(false);
        return;
      }

      setSandboxPhoneOtp(res.sandboxPhoneOtp || '');
      setPhoneOtpInput('');
      setOtpExpirySeconds(600);
      setResendCooldown(60);
      setAttemptsRemaining(5);
      setStep('verify_phone');
      setInfoMessage('Email verified! Now confirm your +91 mobile number to activate your account.');
      setIsSubmitting(false);
    } catch (err) {
      setError('Network error while verifying OTP.');
      setIsSubmitting(false);
    }
  };

  // Step 3 Submit: Verify Phone OTP or Complete Validated Mobile Step
  const handleVerifyPhone = async (e, skipSms = false) => {
    if (e) e.preventDefault();
    setError('');
    setInfoMessage('');

    const smsRequired = Boolean(registrationSettings?.phoneVerificationRequired);
    const cleanOtp = phoneOtpInput.trim();

    if ((smsRequired || !skipSms) && !/^\d{6}$/.test(cleanOtp)) {
      setError('Please enter the 6-digit Mobile OTP code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyPhoneOtpApi({
        prn: pendingPrn,
        otp: skipSms ? '' : cleanOtp,
        skipSmsOtp: skipSms
      });

      if (!res || !res.success) {
        if (res?.attemptsRemaining !== undefined) {
          setAttemptsRemaining(res.attemptsRemaining);
        }
        setError(res?.error || 'Mobile verification failed.');
        setIsSubmitting(false);
        return;
      }

      completeVerifiedSession(res);
      setStep('done');
      setIsSubmitting(false);
    } catch (err) {
      setError('Network error while completing mobile verification.');
      setIsSubmitting(false);
    }
  };

  // Resend Email or Phone OTP (60s cooldown)
  const handleResendOtp = async (channel = 'email') => {
    if (resendCooldown > 0) return;
    setError('');
    setInfoMessage('');
    setIsSubmitting(true);
    try {
      const res = await resendOtpApi({
        prn: pendingPrn,
        channel
      });
      if (!res || !res.success) {
        if (res?.retryAfterSeconds) {
          setResendCooldown(res.retryAfterSeconds);
        }
        setError(res?.error || 'Could not resend OTP. Please wait and try again.');
        setIsSubmitting(false);
        return;
      }

      setOtpExpirySeconds(res.expiresInSeconds || 600);
      setResendCooldown(res.resendCooldownSeconds || 60);
      setAttemptsRemaining(5);
      if (channel === 'phone') {
        setSandboxPhoneOtp(res.sandboxPhoneOtp || '');
        setPhoneOtpInput('');
        setInfoMessage(`A fresh 6-digit SMS OTP has been sent to ${pendingPhone}.`);
      } else {
        setSandboxEmailOtp(res.sandboxOtp || '');
        setEmailOtpInput('');
        setInfoMessage(`A fresh 6-digit Email OTP has been sent to ${pendingEmail}.`);
      }
      setIsSubmitting(false);
    } catch (err) {
      setError('Network error while resending OTP.');
      setIsSubmitting(false);
    }
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentStepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-8 sm:py-12 px-3 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-3">
            <SVITHubLogo className="w-12 h-12" />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#B3122B]/10 dark:bg-[#B3122B]/20 text-[#B3122B] dark:text-[#ff8a9e] text-xs font-bold mb-2">
            <span>Technical Skill Development Hub • SVIT Nashik</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1A1A] dark:text-white">
            {isLegacyUpgradeMode
              ? 'Verify Your Existing Sprint Account'
              : user && user.emailVerified
                ? 'Verified Student Profile'
                : 'Verified Student Registration & Sign In'}
          </h1>
          <p className="text-xs sm:text-sm text-[#6b6375] dark:text-[#94a3b8] mt-1">
            Only genuine SVIT students with a verified email and mobile number can access the dashboard, submit programs, and appear on the leaderboard.
          </p>
        </div>

        {/* Legacy Account One-Time Verification Prompt (Requirement 8) */}
        {isLegacyUpgradeMode && step === 'details' && (
          <div
            data-testid="legacy-verification-banner"
            className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-sm">One-Time Verification Required: Verify Your Email & Mobile Number</p>
              <p className="mt-1">
                Welcome back, <strong>{user.name}</strong> (Roll No: <strong>{user.prn}</strong>). Your existing Code Sprint submissions and points are safely preserved! Please complete this one-time email and +91 mobile verification to keep your account active.
              </p>
            </div>
          </div>
        )}

        {/* Returning Student Sign-In Box (Shown on Step 1 when not logged in) */}
        {!user && step === 'details' && (
          <div className="bg-white dark:bg-[#181B20] rounded-2xl sm:rounded-3xl p-5 sm:p-6 mb-6 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <LogIn className="w-4 h-4 text-[#B3122B]" />
              <h2 className="text-sm font-extrabold text-[#1A1A1A] dark:text-white">
                Already Registered & Verified? Sign In
              </h2>
            </div>
            <p className="text-xs text-[#6b6375] dark:text-[#94a3b8] mb-3">
              Enter your registered College Roll Number and Email Address to load your profile, score, and track on this device.
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
                    placeholder="Registered Email (optional for legacy)"
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

        {/* 4-Step Progress Indicator (Details -> Verify Email -> Verify Phone -> Done) */}
        <div
          data-testid="registration-stepper"
          className="bg-white dark:bg-[#181B20] rounded-2xl p-4 mb-5 border border-[#E8DEC8] dark:border-[#2E3440] shadow-xs"
        >
          <div className="grid grid-cols-4 gap-2">
            {STEPS.map((s, idx) => {
              const isCompleted = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div key={s.id} className="flex flex-col items-center text-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold transition-all ${
                      isCompleted
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                          ? 'bg-[#B3122B] text-white ring-4 ring-[#B3122B]/15'
                          : 'bg-[#FCF9F2] dark:bg-[#111317] text-gray-400 border border-[#E8DEC8] dark:border-[#2E3440]'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : s.num}
                  </div>
                  <span
                    className={`text-[11px] mt-1.5 font-bold ${
                      isCurrent
                        ? 'text-[#B3122B] dark:text-[#ff8a9e]'
                        : isCompleted
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-gray-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-[#181B20] rounded-2xl sm:rounded-3xl p-5 sm:p-8 lg:p-10 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm relative">
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

          {/* =================================================================
              STEP 1: REGISTRATION DETAILS FORM
             ================================================================= */}
          {step === 'details' && (
            <form onSubmit={handleStartRegistration} className="space-y-4" noValidate>
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
                {fieldErrors.email ? (
                  <p data-testid="err-email" className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-1">
                    {fieldErrors.email}
                  </p>
                ) : (
                  <p className="text-[11px] text-[#6b6375] dark:text-[#94a3b8] mt-1">
                    Disposable/temporary emails are strictly blocked. A 6-digit OTP will be sent here.
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

              {/* 5. Department/Branch, Academic Year & Division */}
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
                      {VALID_BRANCHES.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
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
                    <span>Cloudflare Turnstile Security Check • Verified Human</span>
                  </label>
                )}
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Anti-Bot Protected
                </span>
              </div>

              {/* Privacy Note (Requirement 8) */}
              <div className="flex items-start gap-2 text-[11px] text-[#6b6375] dark:text-[#94a3b8] px-1">
                <Lock className="w-3.5 h-3.5 text-[#B3122B] shrink-0 mt-0.5" />
                <span>
                  <strong>Privacy Note:</strong> The personal details you provide are stored securely in the shared SVIT database and used strictly for Technova Code Sprint evaluation and official certificate generation.
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
                    ? 'Validating & Sending 6-Digit Email OTP...'
                    : 'Send 6-Digit Email OTP & Continue →'}
                </span>
              </button>
            </form>
          )}

          {/* =================================================================
              STEP 2: VERIFY EMAIL (6-DIGIT OTP)
             ================================================================= */}
          {step === 'verify_email' && (
            <form onSubmit={handleVerifyEmailOtp} className="space-y-5" data-testid="step-verify-email">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#B3122B]/10 text-[#B3122B] flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-extrabold text-[#1A1A1A] dark:text-white">
                  Verify Your Email Address
                </h2>
                <p className="text-xs text-[#6b6375] dark:text-[#94a3b8] mt-1">
                  Enter the 6-digit OTP sent to <strong className="text-[#1A1A1A] dark:text-white">{pendingEmail}</strong>
                </p>
              </div>

              {/* Sandbox OTP preview when external email provider key is not set */}
              {sandboxEmailOtp && (
                <div
                  data-testid="sandbox-email-otp-box"
                  className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 text-center"
                >
                  <span className="font-semibold">Verification Dispatch Code (Sandbox/Dev Mode): </span>
                  <span data-testid="sandbox-email-otp-value" className="font-mono font-extrabold text-sm tracking-widest text-[#B3122B] dark:text-amber-300">
                    {sandboxEmailOtp}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-center text-[#1A1A1A] dark:text-[#E2E8F0] mb-2">
                  6-Digit Email Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  data-testid="email-otp-input"
                  value={emailOtpInput}
                  onChange={(e) => setEmailOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full text-center tracking-[0.5em] font-mono text-xl font-extrabold py-3 px-4 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B]"
                />
                <div className="flex items-center justify-between text-[11px] text-[#6b6375] dark:text-[#94a3b8] mt-2 px-1">
                  <span>Expires in: <strong>{formatTimer(otpExpirySeconds)}</strong></span>
                  <span>Attempts remaining: <strong>{attemptsRemaining} / 5</strong></span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || emailOtpInput.length !== 6}
                data-testid="verify-email-otp-btn"
                className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-[#B3122B] hover:bg-[#8B0D20] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Verifying OTP...' : 'Verify Email OTP →'}</span>
              </button>

              <div className="flex items-center justify-between pt-2 border-t border-[#E8DEC8] dark:border-[#2E3440] text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep('details');
                    setError('');
                    setInfoMessage('');
                  }}
                  className="text-gray-500 hover:text-[#1A1A1A] dark:hover:text-white font-semibold cursor-pointer"
                >
                  ← Edit Details
                </button>

                <button
                  type="button"
                  disabled={resendCooldown > 0 || isSubmitting}
                  onClick={() => handleResendOtp('email')}
                  data-testid="resend-email-otp-btn"
                  className="inline-flex items-center gap-1.5 font-bold text-[#B3122B] dark:text-[#ff8a9e] disabled:text-gray-400 cursor-pointer disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>
                    {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend Email OTP'}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* =================================================================
              STEP 3: VERIFY PHONE (+91XXXXXXXXXX)
             ================================================================= */}
          {step === 'verify_phone' && (
            <form onSubmit={(e) => handleVerifyPhone(e, false)} className="space-y-5" data-testid="step-verify-phone">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <Phone className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-extrabold text-[#1A1A1A] dark:text-white">
                  Verify Your Indian Mobile Number
                </h2>
                <p className="text-xs text-[#6b6375] dark:text-[#94a3b8] mt-1">
                  Mobile Number: <strong className="font-mono text-[#1A1A1A] dark:text-white">{pendingPhone}</strong>
                </p>
              </div>

              {sandboxPhoneOtp && (
                <div
                  data-testid="sandbox-phone-otp-box"
                  className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 text-center"
                >
                  <span className="font-semibold">Mobile Verification Code: </span>
                  <span data-testid="sandbox-phone-otp-value" className="font-mono font-extrabold text-sm tracking-widest text-[#B3122B] dark:text-amber-300">
                    {sandboxPhoneOtp}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-center text-[#1A1A1A] dark:text-[#E2E8F0] mb-2">
                  6-Digit Mobile OTP Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  data-testid="phone-otp-input"
                  value={phoneOtpInput}
                  onChange={(e) => setPhoneOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full text-center tracking-[0.5em] font-mono text-xl font-extrabold py-3 px-4 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || phoneOtpInput.length !== 6}
                data-testid="verify-phone-otp-btn"
                className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-[#B3122B] hover:bg-[#8B0D20] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Verifying...' : 'Verify Mobile OTP & Activate Account →'}</span>
              </button>

              {!registrationSettings?.phoneVerificationRequired && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={(e) => handleVerifyPhone(e, true)}
                  data-testid="confirm-phone-optional-btn"
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-[#1A1A1A] dark:text-white border border-[#E8DEC8] dark:border-[#2E3440] hover:bg-[#FCF9F2] dark:hover:bg-[#111317] transition-all cursor-pointer"
                >
                  Confirm {pendingPhone} & Complete Registration (SMS Optional Mode)
                </button>
              )}
            </form>
          )}

          {/* =================================================================
              STEP 4: DONE (VERIFIED ACCOUNT SUMMARY)
             ================================================================= */}
          {step === 'done' && (
            <div className="text-center space-y-5 py-3" data-testid="step-done">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold mb-2">
                  <ShieldCheck className="w-4 h-4" />
                  Verified SVIT Student Account
                </span>
                <h2 className="text-xl font-extrabold text-[#1A1A1A] dark:text-white">
                  Registration & Verification Complete!
                </h2>
                <p className="text-xs text-[#6b6375] dark:text-[#94a3b8] mt-1">
                  Your profile is now verified and synced across all devices.
                </p>
              </div>

              <div className="bg-[#FCF9F2] dark:bg-[#111317] rounded-2xl p-4 border border-[#E8DEC8] dark:border-[#2E3440] text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Full Name:</span>
                  <span className="font-bold text-[#1A1A1A] dark:text-white">{user?.name || formData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Roll Number:</span>
                  <span className="font-mono font-bold text-[#B3122B]">{user?.prn || pendingPrn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Verified Email:</span>
                  <span className="font-semibold text-[#1A1A1A] dark:text-white">{user?.email || pendingEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mobile Number:</span>
                  <span className="font-mono font-semibold text-[#1A1A1A] dark:text-white">{user?.phone || pendingPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Academic Details:</span>
                  <span className="font-semibold text-[#1A1A1A] dark:text-white">
                    {user?.branch || formData.branch} • {user?.year || formData.year} (Div {user?.division || formData.division})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Programming Track:</span>
                  <span className="font-bold text-emerald-600">{user?.track || formData.track}</span>
                </div>
              </div>

              <button
                type="button"
                data-testid="go-to-dashboard-btn"
                onClick={() => setCurrentTab('dashboard')}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-[#B3122B] hover:bg-[#8B0D20] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Open My Sprint Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Faculty / Admin Link */}
          <div className="mt-6 pt-5 border-t border-[#E8DEC8] dark:border-[#2E3440] text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              SVIT Faculty member, Mentor or Administrator?{' '}
              <button
                type="button"
                onClick={() => setCurrentTab('admin')}
                className="font-bold text-[#B3122B] dark:text-[#ff8a9e] hover:underline cursor-pointer ml-1 inline-flex items-center gap-1"
              >
                Sign in to Admin Console →
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
