import React, { useEffect, useRef, useState } from 'react';
import { Camera, Mic, MicOff, VideoOff, ShieldCheck, AlertTriangle, Eye, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';

export const ProctoringMonitor = ({
  dayNumber,
  taskTitle,
  onStatusChange, // (isActive: boolean, hasGracePeriod: boolean) => void
  onFlagEvent,    // (flag: object) => void
  disabled = false
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  const [hasPermission, setHasPermission] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [graceSeconds, setGraceSeconds] = useState(30);
  const [inGracePeriod, setInGracePeriod] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [talkingSeconds, setTalkingSeconds] = useState(0);
  const [noFaceSeconds, setNoFaceSeconds] = useState(0);
  const [showPreview, setShowPreview] = useState(true);

  // Initialize Camera & Microphone with privacy-safe 320x240 resolution
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

        // Setup Web Audio API for VAD (Volume Activity Only - No Recording)
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
        setGraceSeconds(30);
        if (onStatusChange) onStatusChange(true, false);

        // Listen for track ending (e.g. user toggles device off)
        stream.getTracks().forEach(track => {
          track.onended = () => handleStreamInterruption("Device disconnected");
          track.onmute = () => handleStreamInterruption("Device muted");
        });
      } catch (err) {
        if (!isMounted) return;
        console.warn("Proctoring Media Access Notice:", err);
        setPermissionError(err.name || "MediaDenied");
        setHasPermission(false);
        setInGracePeriod(true);
        if (onStatusChange) onStatusChange(false, true);
      }
    }

    initMedia();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleStreamInterruption = (reason) => {
    setInGracePeriod(true);
    if (onStatusChange) onStatusChange(false, true);
  };

  // Grace Period Timer (30 seconds)
  useEffect(() => {
    let timer = null;
    if (inGracePeriod && graceSeconds > 0) {
      timer = setInterval(() => {
        setGraceSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            if (onStatusChange) onStatusChange(false, false); // locks Run, Submit, Quiz
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [inGracePeriod, graceSeconds]);

  // Client-Side Frame & Audio Analysis Loop (No streaming to server)
  useEffect(() => {
    if (!hasPermission) return;

    let checkInterval = setInterval(() => {
      // 1. Analyze Audio Volume
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.round(avg));

        // Detect sustained talking (>35 volume for >60s)
        if (avg > 35) {
          setTalkingSeconds(prev => {
            const next = prev + 1;
            if (next === 60) {
              captureSnapshotAndFlag("Sustained talking detected (>60s)");
            }
            return next;
          });
        } else {
          setTalkingSeconds(0);
        }
      }

      // 2. Client-Side Video Analysis (Face Presence & Lighting)
      if (videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, 80, 60);
        const imgData = ctx.getImageData(0, 0, 80, 60);
        const data = imgData.data;

        let totalBrightness = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          totalBrightness += (0.299 * r + 0.587 * g + 0.114 * b);
        }
        const avgBrightness = totalBrightness / (data.length / 4);

        if (avgBrightness < 20) {
          // Camera covered or very dark
          setNoFaceSeconds(prev => {
            const next = prev + 1;
            if (next === 20) {
              captureSnapshotAndFlag("Camera covered or very dark (>20s)");
            }
            return next;
          });
          setIsFaceDetected(false);
        } else {
          setIsFaceDetected(true);
          setNoFaceSeconds(0);
        }
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [hasPermission]);

  // Capture small snapshot ONLY when a check raises a flag
  const captureSnapshotAndFlag = (reason) => {
    let snapshotUrl = null;
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, 160, 120);
      snapshotUrl = canvas.toDataURL('image/jpeg', 0.6);
    }

    const flagData = {
      id: `flag_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      date: new Date().toLocaleDateString('en-GB'),
      reason,
      day: dayNumber,
      taskTitle: taskTitle || `Day ${dayNumber}`,
      snapshot: snapshotUrl,
      status: 'pending_review' // 'pending_review' | 'dismissed' | 'reviewed' | 'needs_viva'
    };

    if (onFlagEvent) onFlagEvent(flagData);
  };

  const handleRetryPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 } },
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setHasPermission(true);
      setPermissionError(null);
      setInGracePeriod(false);
      setGraceSeconds(30);
      if (onStatusChange) onStatusChange(true, false);
    } catch (e) {
      setPermissionError(e.name || "MediaDenied");
    }
  };

  return (
    <div className="relative">
      <canvas ref={canvasRef} width={80} height={60} className="hidden" />

      {/* Floating or Docked Self-Preview Panel (Section 5) */}
      <div className="bg-white dark:bg-[#181B20] rounded-2xl border border-[#E8DEC8] dark:border-[#2E3440] shadow-md p-3 max-w-[280px]">
        
        {/* Top Indicator Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${hasPermission && !inGracePeriod ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="text-[11px] font-bold text-[#1A1A1A] dark:text-white">
              {hasPermission && !inGracePeriod ? "Checks Active" : "Checks Offline"}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${hasPermission ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'}`}>
              <ShieldCheck className="w-3 h-3 inline mr-0.5" />
              Privacy Safe
            </span>
          </div>
        </div>

        {/* Video Self-Preview Window */}
        <div className="relative w-full aspect-[4/3] bg-black/90 rounded-xl overflow-hidden border border-[#E8DEC8] dark:border-[#2E3440] flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover mirror ${hasPermission && !inGracePeriod ? 'block' : 'hidden'}`}
            style={{ transform: 'scaleX(-1)' }}
          />

          {(!hasPermission || inGracePeriod) && (
            <div className="p-3 text-center text-white space-y-1">
              <VideoOff className="w-6 h-6 mx-auto text-amber-400" />
              <p className="text-[10px] font-bold text-amber-300">
                Camera / Mic Offline
              </p>
              {graceSeconds > 0 ? (
                <div className="text-[10px] text-gray-300">
                  Grace period: <strong className="text-amber-400 font-mono">{graceSeconds}s</strong>
                </div>
              ) : (
                <div className="text-[10px] text-red-400 font-bold">
                  Buttons Locked
                </div>
              )}
            </div>
          )}

          {/* Active Audio Visualizer Meter */}
          {hasPermission && (
            <div className="absolute bottom-1.5 left-2 right-2 flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-xs">
              <Mic className="w-3 h-3 text-emerald-400 shrink-0" />
              <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-400 h-full transition-all duration-100"
                  style={{ width: `${Math.min(100, (audioLevel / 60) * 100)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Interruption / Grace Period Warning Banner */}
        {inGracePeriod && (
          <div className="mt-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[10px] space-y-1">
            <div className="flex items-center gap-1 font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Permission Interrupted ({graceSeconds}s grace)</span>
            </div>
            <p className="leading-tight text-[9.5px]">
              Please re-enable camera and mic. After 30s, Run and Submit will be temporarily locked.
            </p>
            <button
              onClick={handleRetryPermission}
              className="mt-1 w-full py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold flex items-center justify-center gap-1 text-[10px] cursor-pointer"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Re-enable Media</span>
            </button>
          </div>
        )}

        <div className="mt-2 text-[9px] text-gray-400 dark:text-gray-500 leading-tight">
          Client-side checks only. No video or audio is continuously recorded or streamed.
        </div>
      </div>
    </div>
  );
};
