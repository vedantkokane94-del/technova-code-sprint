import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  AlertCircle, 
  Clock, 
  ArrowLeft,
  UserCheck,
  LogOut
} from 'lucide-react';
import { SVITHubLogo } from '../components/BrandLogo';
import { loginAdminWithEmailAndPassword } from '../services/api';
import { useApp } from '../context/AppContext';
import { auth, googleProvider, signInWithPopup, isConfiguredFirebase } from '../services/firebase';

export const AdminLoginPage = ({ onLoginSuccess, onNavigateHome }) => {
  const { user, loginAsAdmin, isAdmin } = useApp();

  // Step 1: Google account identity state
  const [googleAccount, setGoogleAccount] = useState(() => {
    if (user && user.email) {
      return {
        email: user.email,
        name: user.name || 'User',
        uid: user.uid || ''
      };
    }
    return null;
  });

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Simulated Google fallback modal state (for offline/demo/testing environments)
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleModalEmail, setGoogleModalEmail] = useState('');
  const [googleModalName, setGoogleModalName] = useState('');

  // If already authenticated on server, transition directly to dashboard
  useEffect(() => {
    if (isAdmin && onLoginSuccess) {
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

  // Trigger Google Sign-In
  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setIsLoading(true);

    try {
      if (isConfiguredFirebase() && auth && googleProvider) {
        const result = await signInWithPopup(auth, googleProvider);
        if (result && result.user) {
          setGoogleAccount({
            email: result.user.email || '',
            name: result.user.displayName || result.user.email?.split('@')[0] || 'User',
            uid: result.user.uid || ''
          });
          setIsLoading(false);
          return;
        }
      }
      // Demo / Testing / Offline fallback: Open institutional Google prompt modal
      setGoogleModalEmail('technicalteamsvit@gmail.com');
      setGoogleModalName('Vedant Kokane');
      setShowGoogleModal(true);
      setIsLoading(false);
    } catch (err) {
      console.warn('[AdminLogin] Google popup error, falling back to institutional prompt:', err);
      setGoogleModalEmail('technicalteamsvit@gmail.com');
      setGoogleModalName('Vedant Kokane');
      setShowGoogleModal(true);
      setIsLoading(false);
    }
  };

  const handleConfirmGoogleModal = (e) => {
    e.preventDefault();
    if (!googleModalEmail.trim()) return;
    setGoogleAccount({
      email: googleModalEmail.trim().toLowerCase(),
      name: googleModalName.trim() || 'User',
      uid: `google-${Date.now()}`
    });
    setShowGoogleModal(false);
  };

  const handleSwitchAccount = () => {
    setGoogleAccount(null);
    setPassword('');
    setErrorMessage('');
  };

  // Submit password verification to server
  const handleVerifyPassword = async (e) => {
    if (e) e.preventDefault();
    if (lockoutSeconds > 0) return;

    if (!password) {
      setErrorMessage('Admin access denied');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const email = googleAccount?.email || '';
      const name = googleAccount?.name || '';
      const res = await loginAdminWithEmailAndPassword(email, password, name);
      setIsLoading(false);

      if (res.success && res.user) {
        loginAsAdmin(res.user);
        if (onLoginSuccess) {
          onLoginSuccess(res.user);
        }
      } else {
        if (res.status === 429 || res.lockoutSeconds) {
          setLockoutSeconds(res.lockoutSeconds || 900);
          setErrorMessage('Too many attempts. Try again in 15 minutes.');
        } else {
          // Rule 2 & 3: Never reveal which check failed; show only "Admin access denied"
          setErrorMessage('Admin access denied');
        }
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Admin access denied');
    }
  };

  return (
    <div className="min-h-[85vh] bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      <div className="max-w-md w-full">
        
        {/* Navigation back to student home */}
        <div className="mb-5">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-[#B3122B] dark:hover:text-[#ff8a9e] transition-colors cursor-pointer min-h-[44px] py-2 px-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Student Portal</span>
          </button>
        </div>

        {/* Card Container */}
        <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 sm:p-8 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm relative">
          
          {/* Institutional Header */}
          <div className="text-center mb-6">
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
                <p className="text-[11px] text-red-600/90 dark:text-red-300/90">
                  Too many attempts. Try again in 15 minutes.
                </p>
              </div>
            </div>
          )}

          {/* Error Message: Uniformly "Admin access denied" */}
          {errorMessage && lockoutSeconds === 0 && (
            <div 
              role="alert" 
              className="mb-5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2.5 font-semibold"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Visitor is NOT signed in with Google */}
          {!googleAccount ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] text-center">
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                  Sign in with your verified institutional Google account to proceed to administrator verification.
                </p>

                {/* Sign in with Google Button (at least 44px tall) */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full min-h-[44px] py-3 px-4 rounded-xl font-bold text-xs bg-white dark:bg-[#181B20] text-gray-800 dark:text-white border border-[#E8DEC8] dark:border-[#2E3440] hover:border-[#B3122B] shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                  <span>{isLoading ? "Connecting to Google..." : "Sign in with Google"}</span>
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: Signed in with Google -> Admin verification step */
            <div className="space-y-4">
              {/* Signed-in Account Card */}
              <div className="p-3.5 rounded-2xl bg-[#FCF9F2] dark:bg-[#111317] border border-[#E8DEC8] dark:border-[#2E3440] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#B3122B]/10 text-[#B3122B] flex items-center justify-center shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#1A1A1A] dark:text-white truncate">
                      {googleAccount.name}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">
                      {googleAccount.email}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSwitchAccount}
                  className="text-[11px] font-bold text-gray-500 hover:text-[#B3122B] transition-colors shrink-0 flex items-center gap-1 cursor-pointer py-1 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Switch to another Google account"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Switch</span>
                </button>
              </div>

              {/* Password Verification Form */}
              <form 
                onSubmit={handleVerifyPassword} 
                className="space-y-4" 
                noValidate
              >
                <div>
                  <label 
                    htmlFor="admin-password"
                    className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Administrator Password
                  </label>
                  <div className="relative">
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      disabled={isLoading || lockoutSeconds > 0}
                      placeholder="••••••••••••"
                      className="w-full px-3.5 py-2.5 pl-10 pr-10 rounded-xl border text-xs text-[#1A1A1A] dark:text-white bg-white dark:bg-[#14171C] border-[#E8DEC8] dark:border-[#2E3440] focus:border-[#B3122B] focus:outline-hidden disabled:opacity-50"
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
                </div>

                {/* Verify Admin Access Button (at least 44px tall) */}
                <button
                  type="submit"
                  disabled={isLoading || lockoutSeconds > 0}
                  className="w-full min-h-[44px] py-3 px-4 rounded-xl font-bold text-xs text-white bg-[#B3122B] hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Verify Admin Access</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Security Policy Notice */}
          <div className="mt-6 pt-5 border-t border-[#E8DEC8] dark:border-[#2E3440] text-center">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
              Protected by serverless brute-force rate limiting and HttpOnly session cookies. All login actions are cryptographically logged with IP and timestamp.
            </p>
          </div>
        </div>

      </div>

      {/* Simulated Google Institutional Modal (For offline/testing fallback) */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181B20] rounded-3xl p-6 max-w-sm w-full border border-[#E8DEC8] dark:border-[#2E3440] shadow-2xl">
            <div className="flex items-center gap-3 pb-3 border-b border-[#E8DEC8] dark:border-[#2E3440] mb-4">
              <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#1A1A1A] dark:text-white">
                  Institutional Google Account
                </h3>
                <p className="text-[11px] text-gray-500">
                  Select or enter Google identity
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmGoogleModal} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={googleModalName}
                  onChange={(e) => setGoogleModalName(e.target.value)}
                  placeholder="Vedant Kokane"
                  className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-white dark:bg-[#14171C] text-xs text-[#1A1A1A] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Google Email Address
                </label>
                <input
                  type="email"
                  value={googleModalEmail}
                  onChange={(e) => setGoogleModalEmail(e.target.value)}
                  placeholder="technicalteamsvit@gmail.com"
                  className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-white dark:bg-[#14171C] text-xs text-[#1A1A1A] dark:text-white"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] transition-colors cursor-pointer"
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
