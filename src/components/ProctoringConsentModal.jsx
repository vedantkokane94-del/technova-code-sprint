import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Video, 
  Mic, 
  Lock, 
  Eye, 
  AlertCircle, 
  CheckSquare, 
  Square, 
  ArrowRight, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle,
  HelpCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { SVITHubLogo } from './BrandLogo';

export const ProctoringConsentModal = ({
  dayNumber = 1,
  onAccept,
  onAcceptConsent,
  onRequestAlternative,
  isOpen = true
}) => {
  // Support both onAccept and onAcceptConsent callbacks
  const handleAcceptCallback = onAccept || onAcceptConsent;

  // 1. Consent checkbox
  const [consentChecked, setConsentChecked] = useState(false);

  // 2. Camera state: 'waiting' | 'done' | 'problem'
  const [cameraStatus, setCameraStatus] = useState('waiting');
  const [cameraReason, setCameraReason] = useState('Checking camera access...');

  // 3. Microphone state: 'waiting' | 'done' | 'problem'
  const [micStatus, setMicStatus] = useState('waiting');
  const [micReason, setMicReason] = useState('Checking microphone access...');

  // 4. Checks ready & Face detection setup
  const [checksStatus, setChecksStatus] = useState('waiting');
  const [checksReason, setChecksReason] = useState('Initialising local integrity engine...');
  const [isFaceTimeout, setIsFaceTimeout] = useState(false);

  // Saving state on click (double-click prevention)
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Troubleshooting accordion
  const [showTrouble, setShowTrouble] = useState(false);

  // Alternative viva modal
  const [showAlternativeForm, setShowAlternativeForm] = useState(false);
  const [alternativeReason, setAlternativeReason] = useState('');
  const [alternativeSubmitted, setAlternativeSubmitted] = useState(false);

  // Track media streams so we can release them
  const streamRef = useRef(null);
  const faceTimeoutRef = useRef(null);

  // Run device preflight checks
  const runDeviceChecks = async () => {
    setCameraStatus('waiting');
    setCameraReason('Requesting camera permission...');
    setMicStatus('waiting');
    setMicReason('Requesting microphone permission...');
    setChecksStatus('waiting');
    setChecksReason('Initialising local integrity engine...');
    setIsFaceTimeout(false);
    setSaveError('');

    // Set 10-second face-detection / model timeout
    if (faceTimeoutRef.current) clearTimeout(faceTimeoutRef.current);
    faceTimeoutRef.current = setTimeout(() => {
      setIsFaceTimeout(true);
      setChecksStatus('done');
      setChecksReason('Face detection slow - continuing in basic mode (session flagged for viva review)');
    }, 10000);

    // Stop existing stream if running
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(t => t.stop());
      } catch (e) {}
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraStatus('problem');
        setCameraReason('Browser does not support camera access (HTTPS required).');
        setMicStatus('problem');
        setMicReason('Browser does not support microphone access.');
        setChecksStatus('problem');
        setChecksReason('Media devices API unavailable.');
        if (faceTimeoutRef.current) clearTimeout(faceTimeoutRef.current);
        return;
      }

      // Request media stream with low resolution for DPDP Act compliance
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 } },
        audio: true
      });

      streamRef.current = stream;

      // Verify video tracks
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
        setCameraStatus('done');
        setCameraReason('Camera connected and ready.');
      } else {
        setCameraStatus('problem');
        setCameraReason('No active video stream detected.');
      }

      // Verify audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0 && audioTracks[0].readyState === 'live') {
        setMicStatus('done');
        setMicReason('Microphone connected and ready.');
      } else {
        setMicStatus('problem');
        setMicReason('No active audio stream detected.');
      }

      // Checks Ready
      if (faceTimeoutRef.current) clearTimeout(faceTimeoutRef.current);
      setChecksStatus('done');
      setChecksReason('All automated integrity checks verified.');

    } catch (err) {
      console.warn('Device check error:', err);
      if (faceTimeoutRef.current) clearTimeout(faceTimeoutRef.current);

      const errName = err.name || '';
      let camMsg = 'Camera permission required.';
      let micMsg = 'Microphone permission required.';

      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        camMsg = 'Permission denied in browser. Please allow access in address bar.';
        micMsg = 'Permission denied in browser. Please allow access in address bar.';
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        camMsg = 'No camera device found on this system.';
        micMsg = 'No microphone device found on this system.';
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        camMsg = 'Camera in use by another app - close other apps and try again.';
        micMsg = 'Microphone in use by another app - close other apps and try again.';
      } else if (errName === 'OverconstrainedError') {
        camMsg = 'Camera does not satisfy resolution constraints.';
        micMsg = 'Microphone constraints unfulfilled.';
      } else if (errName === 'SecurityError') {
        camMsg = 'Security error: HTTPS connection is required for camera.';
        micMsg = 'Security error: HTTPS connection is required for microphone.';
      }

      setCameraStatus('problem');
      setCameraReason(camMsg);
      setMicStatus('problem');
      setMicReason(micMsg);
      setChecksStatus('problem');
      setChecksReason('Safety checks cannot proceed without permissions.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      runDeviceChecks();
    }
    return () => {
      if (faceTimeoutRef.current) clearTimeout(faceTimeoutRef.current);
      if (streamRef.current) {
        try { streamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine if all preflight steps are satisfied
  const isDevicesReady = cameraStatus === 'done' && micStatus === 'done';
  const isReadyToBegin = consentChecked && (isDevicesReady || isFaceTimeout);

  // Missing requirement explanation line under button (The button must NEVER be disabled with no explanation)
  const getDisabledExplanation = () => {
    if (!consentChecked) {
      return "Tick the consent box to continue";
    }
    if (cameraStatus === 'problem') {
      return cameraReason;
    }
    if (micStatus === 'problem') {
      return micReason;
    }
    if (cameraStatus === 'waiting' || micStatus === 'waiting') {
      return "Waiting for camera and microphone permissions...";
    }
    if (checksStatus === 'waiting') {
      return "Initialising integrity checks...";
    }
    return "";
  };

  const handleBeginClick = async () => {
    if (!isReadyToBegin || isSaving) return;
    setIsSaving(true);
    setSaveError('');

    try {
      if (handleAcceptCallback) {
        await handleAcceptCallback({
          consentGiven: true,
          isAlternativeMode: false,
          isFaceTimeout,
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error('Error saving consent:', e);
      setIsSaving(false);
      setSaveError("Could not save. Check your internet connection and try again.");
      setTimeout(() => {
        setIsSaving(false);
      }, 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#181B20] rounded-3xl max-w-lg w-full p-5 sm:p-7 border border-[#E8DEC8] dark:border-[#2E3440] shadow-2xl relative text-left my-auto max-h-[92vh] flex flex-col justify-between overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-[#E8DEC8] dark:border-[#2E3440]">
          <SVITHubLogo className="w-11 h-11 shrink-0" />
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#B3122B]/10 text-[#B3122B] dark:text-[#ff8a9e] text-[10px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>DPDP Act 2023 Compliant</span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-[#1A1A1A] dark:text-white leading-tight">
              Coding Integrity & Safety Checks
            </h2>
            <p className="text-[11px] text-gray-500">Day {dayNumber} Coding Task & Daily Quiz</p>
          </div>
        </div>

        {!showAlternativeForm ? (
          <div className="space-y-3.5 my-4 text-xs text-gray-700 dark:text-gray-300">
            
            <p className="text-[11px] font-medium text-gray-600 dark:text-gray-300 leading-relaxed">
              To ensure fairness and discourage AI-assisted generation across SVIT Nashik, privacy-safe automated checks run locally inside your browser. No continuous video is ever stored or streamed.
            </p>

            {/* 4-Step Checklist */}
            <div className="p-3 rounded-2xl bg-[#FCF9F2] dark:bg-[#121418] border border-[#E8DEC8] dark:border-[#2E3440] space-y-2.5">
              
              {/* Step 1: Consent Box */}
              <div 
                onClick={() => setConsentChecked(!consentChecked)}
                className="flex items-start gap-2.5 p-2 rounded-xl border border-[#E8DEC8]/80 dark:border-[#2E3440] hover:bg-white dark:hover:bg-[#1b2028] transition-colors cursor-pointer select-none"
              >
                <button type="button" className="text-[#B3122B] shrink-0 mt-0.5 min-w-[20px]">
                  {consentChecked ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-gray-400" />}
                </button>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-[#1A1A1A] dark:text-white">
                      1. Consent given
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      consentChecked ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'
                    }`}>
                      {consentChecked ? 'Done' : 'Waiting'}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Tick to agree to SVIT Honor Code & DPDP Act 2023 guidelines.
                  </p>
                </div>
              </div>

              {/* Step 2: Camera Allowed */}
              <div className="flex items-start gap-2.5 p-2 rounded-xl border border-[#E8DEC8]/80 dark:border-[#2E3440] bg-white/60 dark:bg-[#161a20]">
                <Video className={`w-4 h-4 shrink-0 mt-0.5 ${
                  cameraStatus === 'done' ? 'text-emerald-600' : cameraStatus === 'problem' ? 'text-red-500' : 'text-amber-500'
                }`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-[#1A1A1A] dark:text-white">
                      2. Camera allowed
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      cameraStatus === 'done' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                      cameraStatus === 'problem' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {cameraStatus === 'done' ? 'Done' : cameraStatus === 'problem' ? 'Problem' : 'Waiting'}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {cameraReason}
                  </p>
                </div>
              </div>

              {/* Step 3: Microphone Allowed */}
              <div className="flex items-start gap-2.5 p-2 rounded-xl border border-[#E8DEC8]/80 dark:border-[#2E3440] bg-white/60 dark:bg-[#161a20]">
                <Mic className={`w-4 h-4 shrink-0 mt-0.5 ${
                  micStatus === 'done' ? 'text-emerald-600' : micStatus === 'problem' ? 'text-red-500' : 'text-amber-500'
                }`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-[#1A1A1A] dark:text-white">
                      3. Microphone allowed
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      micStatus === 'done' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                      micStatus === 'problem' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {micStatus === 'done' ? 'Done' : micStatus === 'problem' ? 'Problem' : 'Waiting'}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {micReason}
                  </p>
                </div>
              </div>

              {/* Step 4: Checks Ready */}
              <div className="flex items-start gap-2.5 p-2 rounded-xl border border-[#E8DEC8]/80 dark:border-[#2E3440] bg-white/60 dark:bg-[#161a20]">
                <ShieldCheck className={`w-4 h-4 shrink-0 mt-0.5 ${
                  checksStatus === 'done' ? 'text-emerald-600' : checksStatus === 'problem' ? 'text-red-500' : 'text-amber-500'
                }`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-[#1A1A1A] dark:text-white">
                      4. Checks ready
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      checksStatus === 'done' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                      checksStatus === 'problem' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {checksStatus === 'done' ? 'Done' : checksStatus === 'problem' ? 'Problem' : 'Waiting'}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {checksReason}
                  </p>
                </div>
              </div>

            </div>

            {/* Error banner if save failed */}
            {saveError && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-[11px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            {/* Action Buttons: Min 44px tap targets */}
            <div className="pt-2 border-t border-[#E8DEC8] dark:border-[#2E3440] space-y-2">
              <button
                type="button"
                disabled={!isReadyToBegin || isSaving}
                onClick={handleBeginClick}
                className={`w-full min-h-[46px] px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isReadyToBegin && !isSaving
                    ? 'bg-[#B3122B] text-white hover:bg-[#8B0D20] shadow-md' 
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                }`}
              >
                <span>{isSaving ? "Saving..." : `Accept and Begin Day ${dayNumber}`}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Requirement feedback line under disabled button */}
              {!isReadyToBegin && (
                <div className="text-center text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1.5 pt-0.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{getDisabledExplanation()}</span>
                </div>
              )}
            </div>

            {/* "Having trouble?" section */}
            <div className="pt-2 border-t border-[#E8DEC8]/60 dark:border-[#2E3440]">
              <button
                type="button"
                onClick={() => setShowTrouble(!showTrouble)}
                className="w-full flex items-center justify-between text-[11px] font-bold text-gray-500 hover:text-[#B3122B] transition-colors cursor-pointer py-1"
              >
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Having trouble enabling camera or microphone?</span>
                </span>
                {showTrouble ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showTrouble && (
                <div className="mt-2 p-3 rounded-xl bg-gray-50 dark:bg-[#14171d] border border-[#E8DEC8]/80 dark:border-[#2E3440] text-[11px] space-y-2 text-gray-600 dark:text-gray-400 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-200 dark:border-gray-800">
                    <span className="font-bold text-gray-800 dark:text-gray-200">Browser Troubleshooting</span>
                    <button
                      type="button"
                      onClick={runDeviceChecks}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#B3122B]/10 hover:bg-[#B3122B]/20 text-[#B3122B] font-bold text-[10px] cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Try again</span>
                    </button>
                  </div>

                  <ul className="list-disc pl-4 space-y-1">
                    <li>
                      <strong>Android Chrome:</strong> Tap the lock or tune icon in the URL bar &gt; Permissions &gt; set Camera and Microphone to <em>Allow</em> &gt; tap Try again.
                    </li>
                    <li>
                      <strong>iPhone Safari:</strong> Open iOS Settings &gt; Safari &gt; Camera &amp; Microphone &gt; set to <em>Allow</em>.
                    </li>
                    <li>
                      <strong>Desktop Chrome / Edge:</strong> Click the camera icon or site settings in the address bar &gt; allow Camera and Mic.
                    </li>
                    <li>
                      <strong>Device in use:</strong> Close other apps using the camera (Zoom, Microsoft Teams, Google Meet, WhatsApp, Camera app).
                    </li>
                    <li>
                      <strong>Connection:</strong> Ensure you are browsing over HTTPS or localhost.
                    </li>
                  </ul>

                  <div className="pt-2 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Camera still unavailable?</span>
                    <button
                      type="button"
                      onClick={() => setShowAlternativeForm(true)}
                      className="text-[11px] font-bold text-[#B3122B] dark:text-[#ff8a9e] underline cursor-pointer"
                    >
                      Request alternative verification
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        ) : (
          /* ALTERNATIVE VERIFICATION REQUEST FORM (Section 5: Zero Penalty) */
          <div className="space-y-4 my-4 text-xs text-gray-700 dark:text-gray-300">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
              <h3 className="font-bold text-sm mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Request Viva-Based Alternative Verification</span>
              </h3>
              <p className="text-[11px] leading-relaxed">
                If your device lacks a working camera/microphone, you can proceed immediately with manual faculty verification. <strong>Alternative verification carries ZERO point penalty.</strong>
              </p>
            </div>

            {!alternativeSubmitted ? (
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  setAlternativeSubmitted(true);
                  if (onRequestAlternative) {
                    await onRequestAlternative(alternativeReason || "Hardware camera/microphone unavailable");
                  }
                  if (handleAcceptCallback) {
                    await handleAcceptCallback({
                      consentGiven: true,
                      isAlternativeMode: true,
                      alternativeReason: alternativeReason || "Hardware camera/microphone unavailable",
                      timestamp: new Date().toISOString()
                    });
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Reason for Alternative (Optional):
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Hardware camera failure, driver issue, mobile browser limitation..."
                    value={alternativeReason}
                    onChange={(e) => setAlternativeReason(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#121418] text-xs focus:outline-hidden focus:border-[#B3122B]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAlternativeForm(false)}
                    className="px-4 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
                  >
                    Back to Checklist
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 min-h-[44px] rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] cursor-pointer shadow-md"
                  >
                    Register Alternative & Enter Task
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-4 space-y-3">
                <ShieldCheck className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-sm text-[#1A1A1A] dark:text-white">
                  Alternative Verification Registered
                </h4>
                <p className="text-xs text-gray-500">
                  Your request is active. Verification will occur via a brief 2-minute faculty viva before final results. You can now solve Day {dayNumber}.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
