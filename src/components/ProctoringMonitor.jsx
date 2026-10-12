import React, { useEffect, useRef, useState } from 'react';
import { 
  Camera, 
  Mic, 
  MicOff, 
  VideoOff, 
  ShieldCheck, 
  AlertTriangle, 
  Eye, 
  ShieldAlert, 
  CheckCircle2, 
  RefreshCw, 
  Smartphone, 
  Users, 
  EyeOff,
  Sparkles
} from 'lucide-react';
import { loadCocoModel, analyzeFrameOptical, captureSnapshot } from '../utils/visionProctor';

export const ProctoringMonitor = ({
  dayNumber,
  taskTitle,
  onStatusChange,        // (isActive: boolean, hasGracePeriod: boolean) => void
  onFlagEvent,           // (flag: object) => void
  onViolationAutoExit,   // (violation: { reason: string, snapshotUrl: string }) => void
  onDeviceDisconnected,  // (reason: string) => void
  proctoringSettings = {},
  disabled = false
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  const [hasPermission, setHasPermission] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [inGracePeriod, setInGracePeriod] = useState(false);
  const [graceSeconds, setGraceSeconds] = useState(15);
  const [isFaceDetected, setIsFaceDetected] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showPreview, setShowPreview] = useState(true);

  // Settings
  const noFaceSecondsThreshold = proctoringSettings.noFaceSeconds || 10;
  const phoneConfidenceThreshold = proctoringSettings.phoneConfidence || 0.55;

  // Detection Counters
  const [noFaceSeconds, setNoFaceSeconds] = useState(0);
  const [multiplePersonsSeconds, setMultiplePersonsSeconds] = useState(0);
  const [phoneDetectedSeconds, setPhoneDetectedSeconds] = useState(0);
  const [lookingAwaySeconds, setLookingAwaySeconds] = useState(0);
  const [talkingSeconds, setTalkingSeconds] = useState(0);

  // AI Model Status
  const [cocoModelReady, setCocoModelReady] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState([]);
  const hasTriggeredExitRef = useRef(false);

  // 1. Initialize Neural Net in background
  useEffect(() => {
    let active = true;
    loadCocoModel().then(model => {
      if (active && model) {
        setCocoModelReady(true);
      }
    });
    return () => { active = false; };
  }, []);

  // 2. Initialize Camera & Microphone
  useEffect(() => {
    let isMounted = true;

    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" },
          audio: true
        });

        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Web Audio API for VAD (Volume Activity Only - No recording)
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;
        }

        setHasPermission(true);
        setPermissionError(null);
        setInGracePeriod(false);
        if (onStatusChange) onStatusChange(true, false);

        // Detect device disconnect / turn off
        stream.getTracks().forEach(track => {
          track.onended = () => handleStreamInterruption("Webcam or Microphone disconnected");
          track.onmute = () => handleStreamInterruption("Webcam or Microphone muted");
        });
      } catch (err) {
        if (!isMounted) return;
        console.warn("Proctoring Media Access:", err);
        setPermissionError(err.name || "MediaDenied");
        setHasPermission(false);
        setInGracePeriod(true);
        if (onStatusChange) onStatusChange(false, true);

        // Critical: Camera and mic are mandatory. If denied, trigger disconnect
        if (onDeviceDisconnected) {
          onDeviceDisconnected(`Camera/Microphone permission denied: ${err.name || 'NotAllowedError'}`);
        }
      }
    }

    if (!disabled) {
      initMedia();
    }

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [disabled]);

  const handleStreamInterruption = (reason) => {
    setInGracePeriod(true);
    if (onStatusChange) onStatusChange(false, true);
    if (onDeviceDisconnected) {
      onDeviceDisconnected(reason);
    }
  };

  // Trigger confirmed violation auto-exit
  const triggerAutoExit = (reason) => {
    if (hasTriggeredExitRef.current) return;
    hasTriggeredExitRef.current = true;

    const snap = captureSnapshot(videoRef.current);
    if (onFlagEvent) {
      onFlagEvent({
        reason,
        day: dayNumber,
        snapshotUrl: snap,
        timestamp: new Date().toISOString()
      });
    }

    if (onViolationAutoExit) {
      onViolationAutoExit({
        reason,
        snapshotUrl: snap
      });
    }
  };

  // 3. Frame & Object Detection Loop (Every 1000ms)
  useEffect(() => {
    if (!hasPermission || disabled) return;

    const checkInterval = setInterval(async () => {
      if (hasTriggeredExitRef.current) return;

      // Audio analysis
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setAudioLevel(Math.round(avg));

        if (avg > 40) {
          setTalkingSeconds(prev => {
            const next = prev + 1;
            if (next >= 45) {
              triggerAutoExit("Sustained talking / secondary voice detected (>45s)");
            }
            return next;
          });
        } else {
          setTalkingSeconds(0);
        }
      }

      // Video Frame Analysis
      if (videoRef.current && videoRef.current.readyState >= 2) {
        let detectedPersonCount = 1;
        let detectedPhone = false;
        let lookingAway = false;
        let hasFace = true;

        // Try COCO-SSD Neural Network if loaded
        const model = window.__technovaCocoModel;
        if (model) {
          try {
            const predictions = await model.detect(videoRef.current);
            setDetectedObjects(predictions.map(p => p.class));

            const persons = predictions.filter(p => p.class === 'person');
            detectedPersonCount = persons.length;

            const phones = predictions.filter(p => 
              (p.class === 'cell phone' || p.class === 'remote' || p.class === 'book') && 
              p.score >= phoneConfidenceThreshold
            );
            if (phones.length > 0) {
              detectedPhone = true;
            }

            hasFace = detectedPersonCount > 0;
          } catch (e) {
            // Fallback to optical
            const optical = analyzeFrameOptical(videoRef.current, canvasRef.current);
            hasFace = optical.hasFace;
            detectedPersonCount = optical.personCount;
            lookingAway = optical.lookingAway;
          }
        } else {
          // Fast optical analysis
          const optical = analyzeFrameOptical(videoRef.current, canvasRef.current);
          hasFace = optical.hasFace;
          detectedPersonCount = optical.personCount;
          lookingAway = optical.lookingAway;
        }

        setIsFaceDetected(hasFace);

        // Check 1: Cell Phone detection
        if (detectedPhone) {
          setPhoneDetectedSeconds(prev => {
            const next = prev + 1;
            if (next >= 2) {
              triggerAutoExit("Cell phone / unauthorized handheld device detected on camera");
            }
            return next;
          });
        } else {
          setPhoneDetectedSeconds(0);
        }

        // Check 2: Multiple Faces / Persons detection
        if (detectedPersonCount > 1) {
          setMultiplePersonsSeconds(prev => {
            const next = prev + 1;
            if (next >= 3) {
              triggerAutoExit(`Multiple persons detected in test environment (${detectedPersonCount} people found)`);
            }
            return next;
          });
        } else {
          setMultiplePersonsSeconds(0);
        }

        // Check 3: No Face / Absence from Camera detection
        if (!hasFace) {
          setNoFaceSeconds(prev => {
            const next = prev + 1;
            if (next >= noFaceSecondsThreshold) {
              triggerAutoExit(`Absence from test frame: No face detected for more than ${noFaceSecondsThreshold} seconds`);
            }
            return next;
          });
        } else {
          setNoFaceSeconds(0);
        }

        // Check 4: Looking away continuously
        if (lookingAway) {
          setLookingAwaySeconds(prev => {
            const next = prev + 1;
            if (next >= 20) {
              triggerAutoExit("Continuous looking away / secondary screen usage detected (>20s)");
            }
            return next;
          });
        } else {
          setLookingAwaySeconds(0);
        }
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [hasPermission, disabled, noFaceSecondsThreshold, phoneConfidenceThreshold]);

  return (
    <div className="relative">
      <canvas ref={canvasRef} width={160} height={120} className="hidden" />

      {/* Floating or Docked Self-Preview Panel */}
      <div className="bg-white dark:bg-[#181B20] rounded-2xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-md p-3 max-w-[280px]">
        
        {/* Top Indicator Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${hasPermission ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="text-[11px] font-bold text-[#1A1A1A] dark:text-white">
              {hasPermission ? 'AI Proctor Active' : 'Camera Required'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {cocoModelReady && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold flex items-center gap-0.5" title="COCO-SSD Neural Network Active">
                <Sparkles className="w-2.5 h-2.5" />
                <span>COCO-SSD</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              {showPreview ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* Video Frame */}
        {showPreview && (
          <div className="relative rounded-xl overflow-hidden bg-black aspect-4/3 mb-2 border border-[#E8DEC8]/50 dark:border-[#2E3440]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />

            {!hasPermission && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-black/80 text-white text-xs">
                <VideoOff className="w-6 h-6 text-red-500 mb-1" />
                <span className="font-bold">Camera Denied or Disconnected</span>
                <span className="text-[10px] text-gray-400 mt-1">Permission is strictly mandatory for test evaluation.</span>
              </div>
            )}

            {/* In-Frame Status Badges */}
            {hasPermission && (
              <div className="absolute top-2 left-2 flex flex-col gap-1">
                {!isFaceDetected && (
                  <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-bold animate-pulse">
                    No Face ({noFaceSeconds}s)
                  </span>
                )}
                {multiplePersonsSeconds > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-bold animate-pulse">
                    Multiple Persons!
                  </span>
                )}
                {phoneDetectedSeconds > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-bold animate-pulse">
                    Phone Detected!
                  </span>
                )}
                {lookingAwaySeconds > 5 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-600 text-white text-[9px] font-bold">
                    Looking Away ({lookingAwaySeconds}s)
                  </span>
                )}
              </div>
            )}

            {/* Audio Indicator */}
            {hasPermission && (
              <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-full text-white text-[9px]">
                <Mic className={`w-2.5 h-2.5 ${audioLevel > 35 ? 'text-amber-400' : 'text-emerald-400'}`} />
                <div className="w-8 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-150"
                    style={{ width: `${Math.min(100, audioLevel * 2)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Real-time Status Badges */}
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <div className={`p-1 rounded flex items-center gap-1 ${isFaceDetected ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/10 text-red-700'}`}>
            <Eye className="w-3 h-3 shrink-0" />
            <span className="truncate">{isFaceDetected ? 'Face Verified' : `Absent (${noFaceSeconds}s)`}</span>
          </div>
          <div className={`p-1 rounded flex items-center gap-1 ${phoneDetectedSeconds === 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/10 text-red-700'}`}>
            <Smartphone className="w-3 h-3 shrink-0" />
            <span className="truncate">{phoneDetectedSeconds === 0 ? 'Device: Clear' : 'Phone Found'}</span>
          </div>
        </div>

        {/* Warning Notice if countdown active */}
        {noFaceSeconds > 3 && (
          <div className="mt-2 p-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[10px] text-red-700 dark:text-red-300 font-bold text-center">
            Warning: Return to camera! Test will exit in {noFaceSecondsThreshold - noFaceSeconds}s.
          </div>
        )}
      </div>
    </div>
  );
};
