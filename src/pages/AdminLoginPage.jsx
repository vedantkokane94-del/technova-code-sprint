import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  AlertCircle, 
  Clock, 
  ArrowLeft,
  KeyRound,
  Info
} from 'lucide-react';
import { SVITHubLogo } from '../components/BrandLogo';
import { loginAdminWithEmailAndPassword } from '../services/api';
import { useApp } from '../context/AppContext';

export const AdminLoginPage = ({ onLoginSuccess, onNavigateHome }) => {
  const { loginAsAdmin, isAdmin } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  // If already authenticated, transition directly to dashboard
  useEffect(() => {
    if (isAdmin && onLoginSuccess) {
      console.log('[AdminLogin] Already verified as admin, transitioning to dashboard...');
      onLoginSuccess();
    }
  }, [isAdmin, onLoginSuccess]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds > 0) {
      const timer = setTimeout(() => {
        setLockoutSeconds((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [lockoutSeconds]);

  const validateInputs = () => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');
    setErrorMessage('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError('Administrator email is required.');
      isValid = false;
    } else if (!emailRegex.test(email.trim())) {
      setEmailError('Please enter a valid email address format.');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Administrator password is required.');
      isValid = false;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    if (!validateInputs()) return;

    setIsLoading(true);
    setErrorMessage('');
    console.log('[AdminLogin] Initiating login for email:', email.trim());

    try {
      const res = await loginAdminWithEmailAndPassword(email, password);
      setIsLoading(false);
      console.log('[AdminLogin] Received server response:', { success: res.success, status: res.status });

      if (res.success && res.user) {
        console.log('[AdminLogin] Login successful! Initializing administrator session...');
        loginAsAdmin(res.user);
        if (onLoginSuccess) {
          onLoginSuccess(res.user);
        }
      } else {
        console.error('[AdminLogin] Login rejected by server:', res);
        if (res.status === 429) {
          setLockoutSeconds(900); // 15 mins default
          setErrorMessage(res.error || 'Too many failed login attempts. Security lockout in effect.');
        } else {
          setErrorMessage(res.error || 'Authentication failed. Invalid administrator credentials.');
          if (res.attemptsRemaining !== undefined) {
            setAttemptsRemaining(res.attemptsRemaining);
          }
        }
      }
    } catch (err) {
      setIsLoading(false);
      console.error('[AdminLogin] Network or client exception:', err);
      setErrorMessage('Network connection error. Please verify your connection and try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      <div className="max-w-md w-full">
        
        {/* Navigation back */}
        <div className="mb-6">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-[#B3122B] dark:hover:text-[#ff8a9e] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Student Portal</span>
          </button>
        </div>

        {/* Card Container */}
        <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm relative">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2.5 mb-3">
              <SVITHubLogo className="w-12 h-12" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B3122B]/10 dark:bg-[#B3122B]/20 text-[#B3122B] dark:text-[#ff8a9e] text-xs font-bold mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Technical Skill Development Hub • SVIT Nashik</span>
            </div>

            <h1 className="text-2xl font-black text-[#1A1A1A] dark:text-white">
              Administrator Login
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
              Authorized faculty and technical coordinators only. Access requires legitimate credentials and server authorization.
            </p>
          </div>

          {/* Rate-limit Lockout Alert */}
          {lockoutSeconds > 0 && (
            <div 
              role="alert" 
              className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-3 font-semibold"
            >
              <Clock className="w-5 h-5 shrink-0 text-red-600 animate-spin" />
              <div>
                <p className="font-bold">Security Lockout In Effect</p>
                <p className="text-[11px] text-red-600/80 dark:text-red-300/80">
                  Too many consecutive failed attempts. Please retry in {Math.floor(lockoutSeconds / 60)}m {lockoutSeconds % 60}s.
                </p>
              </div>
            </div>
          )}

          {/* Generic Error Message (prevents account enumeration) */}
          {errorMessage && lockoutSeconds === 0 && (
            <div 
              role="alert" 
              className="mb-5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2.5 font-semibold"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <div className="flex-1">
                <span>{errorMessage}</span>
                {attemptsRemaining !== null && attemptsRemaining < 5 && attemptsRemaining > 0 && (
                  <span className="block text-[11px] font-normal text-red-500 mt-0.5">
                    Remaining attempts before temporary lockout: <strong>{attemptsRemaining}</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Main Login Form */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(e);
            }} 
            action="#" 
            className="space-y-4" 
            noValidate
          >
            
            {/* Email Field */}
            <div>
              <label 
                htmlFor="admin-email"
                className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1"
              >
                Administrator Email Address
              </label>
              <div className="relative">
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  disabled={isLoading || lockoutSeconds > 0}
                  placeholder="name@svit.ac.in"
                  className={`w-full px-3.5 py-2.5 pl-10 rounded-xl border text-xs text-[#1A1A1A] dark:text-white bg-white dark:bg-[#14171C] transition-all focus:outline-hidden disabled:opacity-50 ${
                    emailError 
                      ? 'border-red-500 focus:border-red-600' 
                      : 'border-[#E8DEC8] dark:border-[#2E3440] focus:border-[#B3122B]'
                  }`}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? "admin-email-error" : undefined}
                  required
                />
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
              </div>
              {emailError && (
                <p id="admin-email-error" className="text-[11px] text-red-600 font-semibold mt-1">
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label 
                  htmlFor="admin-password"
                  className="block text-xs font-bold text-gray-700 dark:text-gray-300"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowRecoveryModal(true)}
                  className="text-[11px] text-[#B3122B] dark:text-[#ff8a9e] font-semibold hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  disabled={isLoading || lockoutSeconds > 0}
                  placeholder="••••••••••••"
                  className={`w-full px-3.5 py-2.5 pl-10 pr-10 rounded-xl border text-xs text-[#1A1A1A] dark:text-white bg-white dark:bg-[#14171C] transition-all focus:outline-hidden disabled:opacity-50 ${
                    passwordError 
                      ? 'border-red-500 focus:border-red-600' 
                      : 'border-[#E8DEC8] dark:border-[#2E3440] focus:border-[#B3122B]'
                  }`}
                  aria-invalid={Boolean(passwordError)}
                  aria-describedby={passwordError ? "admin-password-error" : undefined}
                  required
                />
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && (
                <p id="admin-password-error" className="text-[11px] text-red-600 font-semibold mt-1">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || lockoutSeconds > 0}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-xs text-white bg-[#B3122B] hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Sign In as Administrator</span>
                </>
              )}
            </button>
          </form>

          {/* Security Policy Notice */}
          <div className="mt-6 pt-5 border-t border-[#E8DEC8] dark:border-[#2E3440] text-center">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
              Protected by serverless brute-force rate limiting and HttpOnly session cookies. All login actions are cryptographically logged with IP and timestamp.
            </p>
          </div>
        </div>

      </div>

      {/* Password Recovery Information Modal */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 max-w-sm w-full border border-[#E8DEC8] dark:border-[#2E3440] shadow-2xl">
            <div className="flex items-center gap-3 pb-3 border-b border-[#E8DEC8] dark:border-[#2E3440] mb-4">
              <div className="w-10 h-10 rounded-2xl bg-[#B3122B]/10 text-[#B3122B] flex items-center justify-center font-bold">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#1A1A1A] dark:text-white">
                  Administrator Password Recovery
                </h3>
                <p className="text-[11px] text-gray-500">
                  Institutional Security Policy
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              <p>
                To prevent account enumeration and unauthorized takeover, public self-service password reset links and magic links are permanently disabled.
              </p>
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-[11px]">
                <div className="font-bold mb-1 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-amber-700" />
                  <span>Faculty Protocol:</span>
                </div>
                <span>
                  Please contact the Lead Technical Coordinator in person or via college technical affairs at <strong>technicalteamsvit@gmail.com</strong> for secure credential rotation.
                </span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRecoveryModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] transition-colors cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
