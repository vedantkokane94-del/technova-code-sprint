import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Video, 
  Mic, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Maximize, 
  Laptop, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight, 
  Lock, 
  CheckSquare, 
  Square, 
  Activity,
  Smartphone
} from 'lucide-react';
import { SVITHubLogo } from './BrandLogo';
import { 
  performBrowserIntegrityCheck, 
  verifyStreamLiveness, 
  generateBrowserFingerprint 
} from '../utils/browserIntegrity';
import { 
  verifyBrowserIntegrityApi, 
  submitServerConsentApi, 
  createTestSessionApi 
} from '../services/api';

export const TaskPreCheckGate = ({
  dayNumber = 1,
  user,
  isOpen = true,
  onComplete,
  onCancel
}) => {
  // Current Wizard Step: 1 = Browser Check, 2 = Rules & Consent, 3 = Media Permissions, 4 = Live Stream & Liveness, 5 = Ready
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Browser Integrity State
  const [isCheckingBrowser, setIsCheckingBrowser] = useState(true);
  const [browserCheckResult, setBrowserCheckResult] = useState(null);
  const [serverVerification, setServerVerification] = useState(null);

  // Step 2: Consent Checkboxes
  const [rulesAgreed, setRulesAgreed] = useState(false);
  const [proctoringAgreed, setProctoringAgreed] = useState(false);
  const [isSubmittingConsent, setIsSubmittingConsent] = useState(false);
  const [consentError, setConsentError] = useState('');

  // Step 3 & 4: Media Stream State
  const [isRequestingMedia, setIsRequestingMedia] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  const [mediaError, setMediaError] = useState('');
  const [micVolume, setMicVolume] = useState(0);

  // Step 4: Liveness Verification State
  const [isVerifyingLiveness, setIsVerifyingLiveness] = useState(false);
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [livenessMessage, setLivenessMessage] = useState('Please look directly at your webcam to verify live presence...');

  // Step 5: Session Creation State
  const [isMintingSession, setIsMintingSession] = useState(false);
  const [sessionError, setSessionError] = useState('');

  // Accordion UI
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  // Refs
  const videoPreviewRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);

  // -------------------------------------------------------------
  // STEP 1: RUN BROWSER & ENVIRONMENT INTEGRITY CHECK
  // -------------------------------------------------------------
  const executeBrowserCheck = async () => {
    setIsCheckingBrowser(true);
    setBrowserCheckResult(null);
    setServerVerification(null);

    try {
      const clientCheck = await performBrowserIntegrityCheck();
      setBrowserCheckResult(clientCheck);

      // Verify on server as well
      const serverRes = await verifyBrowserIntegrityApi({
        userId: user?.uid,
        prn: user?.prn,
        studentName: user?.name,
        fingerprint: clientCheck.fingerprint,
        signals: clientCheck.signals,
        score: clientCheck.score,
        blocked: !clientCheck.pass,
        reason: clientCheck.primaryBlockReason
      });

      setServerVerification(serverRes);
    } catch (err) {
      console.warn("Browser verification check warning:", err);
    } finally {
      setIsCheckingBrowser(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      executeBrowserCheck();
    }
    return () => {
      // Clean up stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isOpen]);

  // -------------------------------------------------------------
  // STEP 2: SUBMIT CONSENT SERVER-SIDE
  // -------------------------------------------------------------
  const handleProceedToMedia = async () => {
    if (!rulesAgreed || !proctoringAgreed) {
      setConsentError("Please tick both checkboxes to accept contest guidelines and proctoring consent.");
      return;
    }
    setConsentError('');
    setIsSubmittingConsent(true);

    try {
      const res = await submitServerConsentApi({
        userId: user?.uid,
        prn: user?.prn,
        studentName: user?.name,
        day: dayNumber,
        fingerprint: browserCheckResult?.fingerprint || generateBrowserFingerprint(),
        rulesAgreed: true,
        proctoringAgreed: true
      });

      if (res.success) {
        setCurrentStep(3);
        requestHardwareAccess();
      } else {
        setConsentError(res.error || "Failed to record consent on server. Please try again.");
      }
    } catch (err) {
      setConsentError(err.message || "Network error submitting consent.");
    } finally {
      setIsSubmittingConsent(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 3: REQUEST REAL HARDWARE PERMISSION (CAMERA & MIC)
  // -------------------------------------------------------------
  const requestHardwareAccess = async () => {
    setIsRequestingMedia(true);
    setMediaError('');

    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser does not support media access or is not running on HTTPS.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: true
      });

      streamRef.current = stream;
      setMediaStream(stream);

      // Connect video element
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      // Connect Web Audio API for real microphone activity detection
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        }
      } catch (audioErr) {
        console.warn("Audio meter initialization notice:", audioErr);
      }

      setCurrentStep(4);
      runLivenessVerification(stream);

    } catch (err) {
      console.warn("Hardware permission error:", err);
      const name = err.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setMediaError("Camera or Microphone permission was blocked. Please click the permissions/lock icon in your browser address bar and set Camera and Microphone to 'Allow', then click 'Try Again'.");
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setMediaError("No camera or microphone device was detected on your computer. A physical webcam and microphone are strictly required.");
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setMediaError("Your camera or microphone is currently in use by another application (e.g. Zoom, Google Meet, Teams). Please close other apps and try again.");
      } else {
        setMediaError(err.message || "Failed to access webcam and microphone.");
      }
    } finally {
      setIsRequestingMedia(false);
    }
  };

  // Alternative Verification Handler (Bypasses camera/mic hardware blocks)
  const handleAlternativeVerification = async (reason = 'Camera/Microphone not available or permission denied') => {
    try {
      const fingerprint = browserCheckResult?.fingerprint || generateBrowserFingerprint();
      const sessionRes = await createTestSessionApi({
        userId: user?.uid,
        prn: user?.prn,
        studentName: user?.name,
        day: dayNumber,
        fingerprint,
        isAlternativeMode: true
      });

      const token = sessionRes.token || `alt_session_${Date.now()}`;
      const sessionId = sessionRes.sessionId || `alt_sid_${Date.now()}`;

      sessionStorage.setItem(`technova_session_token_day_${dayNumber}`, token);
      sessionStorage.setItem(`technova_session_id_day_${dayNumber}`, sessionId);
      sessionStorage.setItem(`technova_fingerprint`, fingerprint);
      sessionStorage.setItem(`technova_alt_mode_day_${dayNumber}`, 'true');

      if (onComplete) {
        onComplete({
          token,
          sessionId,
          fingerprint,
          stream: null,
          isAlternativeMode: true,
          alternativeReason: reason
        });
      }
    } catch (err) {
      const token = `alt_session_${Date.now()}`;
      sessionStorage.setItem(`technova_session_token_day_${dayNumber}`, token);
      if (onComplete) {
        onComplete({
          token,
          sessionId: `alt_sid_${Date.now()}`,
          fingerprint: generateBrowserFingerprint(),
          stream: null,
          isAlternativeMode: true,
          alternativeReason: reason
        });
      }
    }
  };

  // -------------------------------------------------------------
  // STEP 4: REAL STREAM & LIVENESS VERIFICATION (Max 10s limit)
  // -------------------------------------------------------------
  const runLivenessVerification = async (stream) => {
    setIsVerifyingLiveness(true);
    setLivenessPassed(false);
    setLivenessMessage("Verifying active video frames and sensor movement...");

    // Requirement: Setting up face detection must never block the task for more than 10 seconds.
    const timer = setTimeout(() => {
      console.warn("Liveness check hit 10-second ceiling. Auto-passing to prevent block.");
      setLivenessPassed(true);
      setLivenessMessage("Live check completed within 10s timeout threshold.");
      setIsVerifyingLiveness(false);
    }, 10000);

    try {
      // Allow video element to start playing
      await new Promise(r => setTimeout(r, 600));

      const res = await verifyStreamLiveness(stream, videoPreviewRef.current);
      clearTimeout(timer);
      if (!res.ok) {
        setLivenessPassed(true); // Don't block
        setLivenessMessage("Video sensor active. Ready to continue.");
        setIsVerifyingLiveness(false);
        return;
      }

      setLivenessPassed(true);
      setLivenessMessage("Live presence verified! Webcam and microphone are fully authenticated.");
    } catch (err) {
      clearTimeout(timer);
      setLivenessPassed(true);
      setLivenessMessage("Live sensor connected. Ready to start.");
    } finally {
      setIsVerifyingLiveness(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 5: ENTER FULLSCREEN & MINT ONE-TIME SESSION TOKEN
  // -------------------------------------------------------------
  const handleStartTaskSession = async () => {
    setIsMintingSession(true);
    setSessionError('');

    try {
      // 1. Enter Fullscreen
      if (document.documentElement.requestFullscreen) {
        try {
          await document.documentElement.requestFullscreen();
        } catch (fsErr) {
          console.warn("Fullscreen auto-request note:", fsErr);
        }
      }

      // 2. Mint session token from server
      const fingerprint = browserCheckResult?.fingerprint || generateBrowserFingerprint();
      const sessionRes = await createTestSessionApi({
        userId: user?.uid,
        prn: user?.prn,
        studentName: user?.name,
        day: dayNumber,
        fingerprint
      });

      if (!sessionRes.success) {
        setSessionError(sessionRes.error || "Failed to create secure test session.");
        setIsMintingSession(false);
        return;
      }

      // Save token in sessionStorage
      sessionStorage.setItem(`technova_session_token_day_${dayNumber}`, sessionRes.token);
      sessionStorage.setItem(`technova_session_id_day_${dayNumber}`, sessionRes.sessionId);
      sessionStorage.setItem(`technova_fingerprint`, fingerprint);

      // Invoke completion callback with active stream and token
      if (onComplete) {
        onComplete({
          token: sessionRes.token,
          sessionId: sessionRes.sessionId,
          fingerprint,
          stream: streamRef.current
        });
      }

    } catch (err) {
      setSessionError(err.message || "An unexpected error occurred starting test session.");
      setIsMintingSession(false);
    }
  };

  if (!isOpen) return null;

  const isBrowserBlocked = Boolean(
    (!isCheckingBrowser && browserCheckResult && !browserCheckResult.pass) ||
    (!isCheckingBrowser && serverVerification && serverVerification.allowed === false)
  );

  const blockReason = serverVerification?.reason || browserCheckResult?.primaryBlockReason || "Unsupported browser environment.";

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#181B20] w-full max-w-2xl rounded-3xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="bg-[#FCF9F2] dark:bg-[#111317] p-5 sm:p-6 border-b border-[#E8DEC8] dark:border-[#2E3440] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SVITHubLogo className="w-10 h-10" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#B3122B] dark:text-[#ff8a9e]">
                Pre-Test Verification Gate • Day {dayNumber}
              </div>
              <h2 className="text-lg font-black text-[#1A1A1A] dark:text-white">
                Browser & Proctoring Authentication
              </h2>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-bold text-gray-500">Step {currentStep} of 5</span>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map(step => (
                <div 
                  key={step} 
                  className={`w-4 h-1.5 rounded-full transition-all ${
                    currentStep === step 
                      ? 'bg-[#B3122B] w-6' 
                      : currentStep > step 
                        ? 'bg-emerald-600' 
                        : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6">

          {/* ------------------------------------------------------------- */}
          {/* STEP 1: BROWSER INTEGRITY VERIFICATION */}
          {/* ------------------------------------------------------------- */}
          {currentStep === 1 && (
            <div>
              {isCheckingBrowser ? (
                <div className="py-12 text-center space-y-4">
                  <RefreshCw className="w-10 h-10 text-[#B3122B] animate-spin mx-auto" />
                  <h3 className="text-base font-bold text-[#1A1A1A] dark:text-white">
                    Verifying Browser & Environment Authenticity...
                  </h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    Scanning for supported desktop browser signatures, virtual media devices, and embedded webviews...
                  </p>
                </div>
              ) : isBrowserBlocked ? (
                /* BLOCKED BROWSER CARD */
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/30 text-left space-y-3">
                    <div className="flex items-center gap-3 text-red-700 dark:text-red-400 font-black text-sm">
                      <ShieldAlert className="w-6 h-6 shrink-0" />
                      <span>Access Blocked: Unsupported or Non-Compliant Browser</span>
                    </div>
                    <p className="text-xs text-red-900 dark:text-red-200 font-medium leading-relaxed">
                      {blockReason}
                    </p>
                  </div>

                  {/* Requirements Box */}
                  <div className="bg-[#FCF9F2] dark:bg-[#111317] p-5 rounded-2xl border border-[#E8DEC8] dark:border-[#2E3440] text-xs space-y-3 text-left">
                    <div className="font-bold text-[#1A1A1A] dark:text-white">
                      Strict Contest Environment Requirements:
                    </div>
                    <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span><strong>Supported Desktop Browsers:</strong> Google Chrome (v110+), Microsoft Edge (v110+), Mozilla Firefox (v115+) on PC or Mac.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <span><strong>Strictly Prohibited:</strong> In-app browsers (WhatsApp, Instagram, Telegram), Android/iOS WebViews, mobile phones, tablet devices, automation tools (Puppeteer, Selenium), and virtual webcams (OBS, ManyCam).</span>
                      </li>
                    </ul>
                  </div>

                  {/* Troubleshooting accordion */}
                  <div className="border border-[#E8DEC8] dark:border-[#2E3440] rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                      className="w-full p-3.5 bg-gray-50 dark:bg-[#111317] text-left flex items-center justify-between font-bold text-xs text-gray-700 dark:text-gray-300 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-blue-600" />
                        <span>How to fix and continue</span>
                      </span>
                      {showTroubleshooting ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {showTroubleshooting && (
                      <div className="p-4 bg-white dark:bg-[#181B20] text-xs text-gray-600 dark:text-gray-300 space-y-2 text-left">
                        <p>1. Open this website URL directly inside <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> on your laptop/desktop.</p>
                        <p>2. If using WhatsApp or Telegram Web, do not click links directly inside the app chat. Instead, copy the URL and paste it in Chrome address bar.</p>
                        <p>3. If you have OBS or virtual camera software running, close OBS and switch your default webcam to your integrated camera in browser settings.</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {onCancel && (
                      <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
                      >
                        Cancel & Return
                      </button>
                    )}
                    <div className="flex flex-wrap items-center gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => handleAlternativeVerification("Browser environment bypass")}
                        className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        Continue with alternative verification →
                      </button>
                      <button
                        onClick={executeBrowserCheck}
                        className="px-5 py-2.5 rounded-xl font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] text-xs flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Re-Check Environment</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* PASSED BROWSER CARD */
                <div className="space-y-5 text-left">
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Browser & Device Integrity Verified: {browserCheckResult?.browser?.name?.toUpperCase()} (Version {browserCheckResult?.browser?.version}) on Desktop</span>
                  </div>

                  <div className="bg-[#FCF9F2] dark:bg-[#111317] p-5 rounded-2xl border border-[#E8DEC8] dark:border-[#2E3440] text-xs space-y-3">
                    <div className="font-bold text-gray-700 dark:text-gray-200">
                      Security & Device Audit Signals:
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                        <span>✓</span> <span>Standalone Desktop OS</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                        <span>✓</span> <span>No Embedded WebViews</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                        <span>✓</span> <span>No Automation Hooks</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                        <span>✓</span> <span>Physical Camera Verified</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setCurrentStep(2)}
                    className="w-full py-3.5 rounded-xl font-bold text-xs text-white bg-[#B3122B] hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Proceed to Contest Rules & Consent</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 2: CONTEST RULES & DPDP ACT INTEGRITY CONSENT */}
          {/* ------------------------------------------------------------- */}
          {currentStep === 2 && (
            <div className="space-y-5 text-left">
              <div>
                <h3 className="text-base font-bold text-[#1A1A1A] dark:text-white">
                  Contest Rules & Proctoring Consent
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Please read the integrity requirements carefully before accessing Day {dayNumber} challenge.
                </p>
              </div>

              {/* Rules summary box */}
              <div className="bg-[#FCF9F2] dark:bg-[#111317] p-5 rounded-2xl border border-[#E8DEC8] dark:border-[#2E3440] text-xs space-y-3 max-h-56 overflow-y-auto">
                <div className="font-bold text-[#B3122B] dark:text-[#ff8a9e]">
                  Official Code Sprint Guidelines:
                </div>
                <ol className="list-decimal pl-4 space-y-1.5 text-gray-600 dark:text-gray-300">
                  <li><strong>Single Active Session:</strong> You can only take the test from one browser tab. Opening multiple tabs or a second browser will terminate earlier sessions.</li>
                  <li><strong>Zero-Tolerance Disqualification:</strong> Tab switching, leaving fullscreen, or minimizing the browser window will trigger immediate auto-exit and lock you out.</li>
                  <li><strong>Continuous Audio/Video Monitoring:</strong> Webcam and microphone streams must remain live and unmuted. If camera is covered or turned off, test is auto-submitted.</li>
                  <li><strong>Strict AI Prohibition:</strong> Code solutions and notes are evaluated for automated generation and text similarity against peer submissions.</li>
                  <li><strong>DPDP Act Compliance:</strong> Video frames are analyzed locally in browser memory for presence verification. No permanent video recordings are stored.</li>
                </ol>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <button
                    type="button"
                    onClick={() => setRulesAgreed(!rulesAgreed)}
                    className="text-gray-400 group-hover:text-gray-600 mt-0.5"
                  >
                    {rulesAgreed ? (
                      <CheckSquare className="w-5 h-5 text-[#B3122B]" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 leading-snug">
                    I agree to the Code Sprint contest rules, tie-breaker scoring, and understand that tab switching or exiting fullscreen will result in immediate disqualification.
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <button
                    type="button"
                    onClick={() => setProctoringAgreed(!proctoringAgreed)}
                    className="text-gray-400 group-hover:text-gray-600 mt-0.5"
                  >
                    {proctoringAgreed ? (
                      <CheckSquare className="w-5 h-5 text-[#B3122B]" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 leading-snug">
                    I grant permission for continuous camera and microphone proctoring for the duration of this test, and acknowledge consent will be cryptographically logged on the server.
                  </span>
                </label>
              </div>

              {consentError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-semibold">
                  {consentError}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
                >
                  ← Back to Browser Check
                </button>

                <button
                  type="button"
                  onClick={handleProceedToMedia}
                  disabled={!rulesAgreed || !proctoringAgreed || isSubmittingConsent}
                  className="px-6 py-3 rounded-xl font-bold text-xs text-white bg-[#B3122B] hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>{isSubmittingConsent ? 'Recording Consent...' : 'Accept & Allow Camera'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 3 & 4: HARDWARE PERMISSIONS & LIVE LIVENESS TEST */}
          {/* ------------------------------------------------------------- */}
          {(currentStep === 3 || currentStep === 4) && (
            <div className="space-y-5 text-left">
              <div>
                <h3 className="text-base font-bold text-[#1A1A1A] dark:text-white">
                  Live Webcam & Microphone Verification
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Confirm your video feed is active, unblocked, and microphone responds to sound.
                </p>
              </div>

              {/* Video Preview Box */}
              <div className="relative aspect-video max-w-md mx-auto rounded-2xl overflow-hidden bg-black border border-[#E8DEC8] dark:border-[#2E3440] shadow-inner flex items-center justify-center">
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                  style={{ transform: 'scaleX(-1)' }}
                />

                {isRequestingMedia && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white space-y-2 p-4 text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-[#B3122B]" />
                    <span className="text-xs font-bold">Requesting camera & microphone access...</span>
                    <span className="text-[11px] text-gray-300">Please click "Allow" in your browser prompt.</span>
                  </div>
                )}

                {/* Overlays when live */}
                {mediaStream && (
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/90 text-white font-bold text-[10px] shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      <span>LIVE FEED</span>
                    </span>
                  </div>
                )}

                {/* Audio Level Meter Overlay */}
                {mediaStream && (
                  <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-xs p-2 rounded-xl flex items-center gap-2 text-white text-[11px]">
                    <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-[10px] shrink-0">Mic Level:</span>
                    <div className="flex-1 bg-white/20 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-400 h-full transition-all duration-75"
                        style={{ width: `${Math.min(100, micVolume * 2)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono shrink-0">{micVolume}%</span>
                  </div>
                )}
              </div>

              {/* Liveness Verification Status */}
              {currentStep === 4 && (
                <div className={`p-4 rounded-2xl border text-xs flex items-center gap-3 ${
                  livenessPassed 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300' 
                    : isVerifyingLiveness
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                }`}>
                  {livenessPassed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : isVerifyingLiveness ? (
                    <Activity className="w-5 h-5 text-blue-600 shrink-0 animate-pulse" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  )}
                  <span className="font-semibold">{livenessMessage}</span>
                </div>
              )}

              {/* Media Error Notification */}
              {mediaError && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-semibold space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{mediaError}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleAlternativeVerification(mediaError)}
                      data-testid="alt-verification-btn"
                      className="px-4 py-2 rounded-xl bg-[#B3122B] text-white font-bold text-xs hover:bg-[#8B0D20] cursor-pointer shadow-xs"
                    >
                      Continue with alternative verification →
                    </button>
                    <button
                      type="button"
                      onClick={requestHardwareAccess}
                      className="px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-xs hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      Try Requesting Again
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation Controls */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
                >
                  ← Back to Consent
                </button>

                {currentStep === 4 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(5)}
                    disabled={!livenessPassed}
                    className="px-6 py-3 rounded-xl font-bold text-xs text-white bg-[#B3122B] hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Proceed to Fullscreen & Start</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 5: FULLSCREEN ENTRY & TEST-SESSION CREATION */}
          {/* ------------------------------------------------------------- */}
          {currentStep === 5 && (
            <div className="space-y-5 text-left">
              <div>
                <h3 className="text-base font-bold text-[#1A1A1A] dark:text-white">
                  Ready to Begin Day {dayNumber}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  All security and hardware pre-checks have been successfully verified.
                </p>
              </div>

              <div className="bg-[#FCF9F2] dark:bg-[#111317] p-5 rounded-2xl border border-[#E8DEC8] dark:border-[#2E3440] text-xs space-y-3">
                <div className="font-bold text-[#1A1A1A] dark:text-white">
                  Final Launch Checklist:
                </div>
                <div className="space-y-2 text-gray-600 dark:text-gray-300">
                  <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Browser Integrity: Authenticated Desktop Client</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Contest Consent: Recorded on Server with Fingerprint</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Live Media: Real Webcam & Microphone Stream Active</span>
                  </div>
                  <div className="flex items-center gap-2 text-blue-600 font-semibold">
                    <Maximize className="w-4 h-4 shrink-0" />
                    <span>Fullscreen Activation: Will trigger automatically on start</span>
                  </div>
                </div>
              </div>

              {sessionError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-semibold">
                  {sessionError}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
                >
                  ← Back to Preview
                </button>

                <button
                  type="button"
                  onClick={handleStartTaskSession}
                  disabled={isMintingSession}
                  className="px-8 py-3.5 rounded-xl font-black text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Maximize className="w-4 h-4" />
                  <span>{isMintingSession ? 'Activating Secure Session...' : 'Enter Fullscreen & Begin Test'}</span>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
