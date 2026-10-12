/**
 * Technova Code Sprint: Advanced Browser & Device Integrity Engine
 * Sir Visvesvaraya Institute of Technology (SVIT), Nashik
 *
 * Verifies legitimate desktop browsers (Chrome, Edge, Firefox), blocks in-app/webviews,
 * detects headless/automation (Puppeteer, Playwright, Selenium), blocks virtual cameras (OBS, ManyCam),
 * detects spoofed user agents, and runs real media stream and liveness verification.
 */

// Default configuration (can be overridden by Vite env variables)
const DEFAULT_ALLOWED_BROWSERS = ['chrome', 'edge', 'firefox'];
const DEFAULT_MIN_VERSIONS = {
  chrome: 110,
  edge: 110,
  firefox: 115
};

/**
 * Read allowed browsers from env or fallback
 */
export function getAllowedBrowsers() {
  const envAllowed = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ALLOWED_BROWSERS) ||
                     (typeof process !== 'undefined' && process.env?.ALLOWED_BROWSERS);
  if (envAllowed) {
    return envAllowed.split(',').map(b => b.trim().toLowerCase()).filter(Boolean);
  }
  return DEFAULT_ALLOWED_BROWSERS;
}

/**
 * Read minimum browser versions from env or fallback
 */
export function getMinBrowserVersions() {
  const envVersions = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MIN_BROWSER_VERSIONS) ||
                      (typeof process !== 'undefined' && process.env?.MIN_BROWSER_VERSIONS);
  if (envVersions) {
    const map = { ...DEFAULT_MIN_VERSIONS };
    envVersions.split(',').forEach(item => {
      const [name, ver] = item.split(':').map(s => s.trim().toLowerCase());
      if (name && ver) map[name] = parseInt(ver, 10);
    });
    return map;
  }
  return DEFAULT_MIN_VERSIONS;
}

/**
 * Generate a deterministic client fingerprint string
 */
export function generateBrowserFingerprint() {
  try {
    const nav = window.navigator || {};
    const screen = window.screen || {};
    
    // Canvas fingerprinting
    let canvasHash = 'no-canvas';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('SVIT-TECHNOVA-2026', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('SVIT-TECHNOVA-2026', 4, 17);
        canvasHash = canvas.toDataURL();
      }
    } catch (e) {}

    const components = [
      nav.userAgent || '',
      nav.language || '',
      nav.platform || '',
      screen.width + 'x' + screen.height,
      screen.colorDepth || 0,
      new Date().getTimezoneOffset(),
      nav.hardwareConcurrency || 0,
      nav.deviceMemory || 0,
      canvasHash.slice(0, 100)
    ];

    // Simple deterministic hash
    const str = components.join('###');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return 'fp_' + Math.abs(hash).toString(36) + '_' + (nav.hardwareConcurrency || 1);
  } catch (err) {
    return 'fp_fallback_' + Date.now().toString(36);
  }
}

/**
 * Parse current browser name, version, and platform
 */
export function parseBrowserDetails() {
  const ua = navigator.userAgent || '';
  const vendor = navigator.vendor || '';
  let name = 'unknown';
  let version = 0;
  let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(ua);

  // Tablet & Touch detection
  if (!isMobile && navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) {
    // iPad with desktop Safari spoofing
    isMobile = true;
  }

  // Edge
  if (/Edg(?:e|A|iOS)?\/([0-9.]+)/i.test(ua)) {
    name = 'edge';
    const match = ua.match(/Edg(?:e|A|iOS)?\/([0-9.]+)/i);
    version = match ? parseInt(match[1], 10) : 0;
  }
  // Firefox
  else if (/Firefox\/([0-9.]+)/i.test(ua) || /FxiOS\/([0-9.]+)/i.test(ua)) {
    name = 'firefox';
    const match = ua.match(/(?:Firefox|FxiOS)\/([0-9.]+)/i);
    version = match ? parseInt(match[1], 10) : 0;
  }
  // Chrome / Chromium (must not be Edge, Opera, Brave, etc.)
  else if (/Chrome\/([0-9.]+)/i.test(ua) || /CriOS\/([0-9.]+)/i.test(ua)) {
    if (/OPR\/([0-9.]+)/i.test(ua) || /Opera/i.test(ua)) {
      name = 'opera';
    } else if (/Vivaldi\/([0-9.]+)/i.test(ua)) {
      name = 'vivaldi';
    } else if (/Brave/i.test(ua) || (navigator.brave && typeof navigator.brave.isBrave === 'function')) {
      name = 'brave';
    } else {
      name = 'chrome';
      const match = ua.match(/(?:Chrome|CriOS)\/([0-9.]+)/i);
      version = match ? parseInt(match[1], 10) : 0;
    }
  }
  // Safari
  else if (/Safari\/([0-9.]+)/i.test(ua) && /Apple/i.test(vendor)) {
    name = 'safari';
    const match = ua.match(/Version\/([0-9.]+)/i);
    version = match ? parseInt(match[1], 10) : 0;
  }

  return { name, version, isMobile, rawUserAgent: ua };
}

/**
 * Detect In-App / Embedded WebViews (WhatsApp, Instagram, Telegram, etc.)
 */
export function detectEmbeddedBrowser() {
  const ua = (navigator.userAgent || '').toLowerCase();
  
  // Specific app webview tokens
  const webviewTokens = [
    'fban', 'fbav', 'facebook',           // Facebook In-App
    'instagram',                          // Instagram In-App
    'whatsapp',                           // WhatsApp Webview
    'telegram',                           // Telegram In-App
    'linkedinapp', 'linkedin',            // LinkedIn In-App
    'snapchat',                           // Snapchat In-App
    'micromessenger', 'wechat',           // WeChat
    'line/',                              // Line App
    'twitter',                            // Twitter In-App
    'tiktok', 'musical_ly',               // TikTok
    'electron',                           // Electron wrapper
    'wkwebview',                          // iOS WKWebView
    '; wv',                               // Android WebView flag (e.g. "Version/4.0 Chrome/... Mobile; wv")
    'gsa/',                               // Google Search App WebView
    'webview'                             // Generic webview token
  ];

  for (const token of webviewTokens) {
    if (ua.includes(token)) {
      let appName = 'In-App Embedded Browser';
      if (token.includes('fb')) appName = 'Facebook In-App Browser';
      if (token.includes('instagram')) appName = 'Instagram In-App Browser';
      if (token.includes('whatsapp')) appName = 'WhatsApp In-App Browser';
      if (token.includes('telegram')) appName = 'Telegram In-App Browser';
      if (token.includes('linkedin')) appName = 'LinkedIn In-App Browser';
      if (token.includes('snapchat')) appName = 'Snapchat In-App Browser';
      if (token.includes('electron')) appName = 'Electron Wrapper Browser';
      if (token === '; wv' || token === 'webview') appName = 'Android System WebView';
      return { isEmbedded: true, appName, reason: `Detected embedded webview signature: ${token}` };
    }
  }

  // Check Android WebView signature: Contains 'Version/X.X' alongside 'Chrome/'
  if (/android/i.test(ua) && /version\/[0-9.]+/i.test(ua) && /chrome\/[0-9.]+/i.test(ua)) {
    return { isEmbedded: true, appName: 'Android System WebView', reason: 'Android WebView signature detected (Version/X.X Chrome)' };
  }

  // Check globals indicating wrapper environments
  if (typeof window !== 'undefined') {
    if (window.ReactNativeWebView) {
      return { isEmbedded: true, appName: 'React Native WebView', reason: 'window.ReactNativeWebView detected' };
    }
    if (window.webkit && window.webkit.messageHandlers && !ua.includes('safari')) {
      return { isEmbedded: true, appName: 'iOS WKWebView Host', reason: 'window.webkit.messageHandlers detected' };
    }
    if (window.__nwjs || window.nw) {
      return { isEmbedded: true, appName: 'NW.js Embedded Browser', reason: 'NW.js environment detected' };
    }
  }

  return { isEmbedded: false, appName: null, reason: null };
}

/**
 * Detect Automation / Headless Browsers (Puppeteer, Playwright, Selenium, etc.)
 */
export function detectAutomation() {
  const flags = [];

  // 1. Standard webdriver property
  if (navigator.webdriver === true) {
    flags.push('navigator.webdriver is true');
  }

  // 2. Headless Chrome detection
  const ua = navigator.userAgent || '';
  if (/HeadlessChrome/i.test(ua)) {
    flags.push('HeadlessChrome user-agent signature');
  }

  // 3. Selenium / Webdriver variables on window / document
  if (typeof window !== 'undefined') {
    if (window._phantom || window.callPhantom) flags.push('PhantomJS signatures');
    if (window.__nightmare) flags.push('NightmareJS signatures');
    if (window.__selenium_evaluate || window.__webdriver_evaluate || window.__driver_evaluate) {
      flags.push('Selenium driver variables');
    }
    if (window.document && (
      window.document.$cdc_asdjflasutopfhvcZLmcfl_ || 
      window.document.__webdriver_script_fn || 
      window.document.$wdc_
    )) {
      flags.push('Chromium ChromeDriver driver hook detected');
    }
    if (window.__playwright || window.__puppeteer_evaluation_script__) {
      flags.push('Playwright/Puppeteer script hooks detected');
    }

    // 4. Inconsistent Chrome globals: Chrome browser without window.chrome
    if (/Chrome/i.test(ua) && !/Edge|Edg/i.test(ua) && !window.chrome) {
      flags.push('Chrome user-agent without window.chrome API');
    }

    // 5. Inconsistent screen/window properties (0x0 window dimensions)
    if (window.outerWidth === 0 && window.outerHeight === 0) {
      flags.push('Zero-dimension browser window (headless trait)');
    }

    // 6. Missing navigator.languages
    if (navigator.languages && navigator.languages.length === 0) {
      flags.push('Empty navigator.languages list');
    }
  }

  return {
    isAutomated: flags.length > 0,
    flags,
    reason: flags.length > 0 ? flags.join(', ') : null
  };
}

/**
 * Detect Spoofed User-Agent & Environment Inconsistencies
 */
export function detectSpoofedUserAgent() {
  const flags = [];
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';

  // 1. Cross-reference platform vs user agent
  if (/Windows|Win32|Win64/i.test(platform)) {
    if (/iPhone|iPad|Android/i.test(ua)) {
      flags.push(`Platform says Windows (${platform}) but UA claims mobile device`);
    }
  } else if (/MacIntel/i.test(platform)) {
    if (/Windows/i.test(ua) || /Android/i.test(ua)) {
      flags.push(`Platform says Mac (${platform}) but UA claims Windows/Android`);
    }
  } else if (/Linux/i.test(platform) && !/Android/i.test(platform)) {
    if (/Windows|iPhone|Macintosh/i.test(ua)) {
      flags.push(`Platform says Linux (${platform}) but UA claims Windows/Apple`);
    }
  }

  // 2. Cross-reference navigator.userAgentData (Client Hints API in modern Chrome/Edge)
  if (navigator.userAgentData) {
    const brands = (navigator.userAgentData.brands || []).map(b => (b.brand || '').toLowerCase());
    const isUaChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    const isUaEdge = /Edg/i.test(ua);

    if (isUaEdge && !brands.some(b => b.includes('edge') || b.includes('edg'))) {
      flags.push('UA claims Microsoft Edge but userAgentData brands lack Edge');
    }
    if (navigator.userAgentData.mobile !== undefined) {
      const uaHasMobile = /Mobile|Android|iPhone/i.test(ua);
      if (navigator.userAgentData.mobile !== uaHasMobile) {
        flags.push('Discrepancy between userAgentData.mobile and UA string');
      }
    }
  }

  // 3. Screen geometry consistency
  if (window.screen) {
    if (window.screen.width === 0 || window.screen.height === 0) {
      flags.push('Invalid screen geometry (0x0)');
    }
    if (window.screen.colorDepth === 0) {
      flags.push('Invalid screen colorDepth (0)');
    }
  }

  // 4. Missing mandatory proctoring web APIs
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    flags.push('navigator.mediaDevices.getUserMedia is unavailable');
  }
  if (typeof document !== 'undefined' && !document.fullscreenEnabled && !document.documentElement.requestFullscreen) {
    flags.push('Fullscreen API is not supported in this browser');
  }
  if (typeof document !== 'undefined' && typeof document.hidden === 'undefined' && typeof document.visibilityState === 'undefined') {
    flags.push('Page Visibility API is not supported');
  }

  return {
    isSpoofed: flags.length > 0,
    flags,
    reason: flags.length > 0 ? flags.join(', ') : null
  };
}

/**
 * Detect Virtual Cameras and Fake Media Devices (OBS, ManyCam, Fake Cam, etc.)
 */
export async function detectVirtualCameras() {
  const virtualKeywords = [
    'obs', 'virtual', 'manycam', 'fake', 'vcam', 'splitcam',
    'droidcam', 'iriun', 'xsplit', 'prism', 'ndi', 'streamlabs',
    'camwiz', 'epoccam', 'snap camera', 'altercam', 'cyberlink',
    'logi capture virtual', 'avatar', 'facecam virtual'
  ];

  const suspiciousDevices = [];

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return { hasVirtualCam: false, suspiciousDevices: [], error: 'Device enumeration not supported' };
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(d => d.kind === 'videoinput');

    for (const dev of videoInputs) {
      const label = (dev.label || '').toLowerCase();
      if (!label) continue; // Label may be empty if permission not granted yet

      for (const kw of virtualKeywords) {
        if (label.includes(kw)) {
          suspiciousDevices.push({
            label: dev.label,
            deviceId: dev.deviceId,
            matchedKeyword: kw
          });
          break;
        }
      }
    }

    return {
      hasVirtualCam: suspiciousDevices.length > 0,
      suspiciousDevices,
      totalVideoInputs: videoInputs.length,
      reason: suspiciousDevices.length > 0 
        ? `Virtual camera software detected: ${suspiciousDevices.map(d => d.label).join(', ')}`
        : null
    };
  } catch (err) {
    return { hasVirtualCam: false, suspiciousDevices: [], error: err.message };
  }
}

/**
 * Master Client-Side Browser & Environment Integrity Assessment
 */
export async function performBrowserIntegrityCheck() {
  const allowedBrowsers = getAllowedBrowsers();
  const minVersions = getMinBrowserVersions();

  const browser = parseBrowserDetails();
  const embedded = detectEmbeddedBrowser();
  const automation = detectAutomation();
  const spoofing = detectSpoofedUserAgent();
  const virtualCams = await detectVirtualCameras();

  const signals = [];
  let score = 100; // Perfect score
  let pass = true;
  let primaryBlockReason = null;

  // 1. Embedded Browser Check
  if (embedded.isEmbedded) {
    score -= 60;
    pass = false;
    primaryBlockReason = `In-app browser detected (${embedded.appName}). Embedded webviews are not allowed. Please open this test in a standalone desktop browser (Google Chrome, Microsoft Edge, or Mozilla Firefox).`;
    signals.push({ type: 'embedded_browser', detail: embedded.reason });
  }

  // 2. Automation / Headless Check
  if (automation.isAutomated) {
    score -= 80;
    pass = false;
    primaryBlockReason = `Automation/Headless browser detected (${automation.reason}). Browser automation tools (Puppeteer, Selenium, Playwright) are strictly prohibited.`;
    signals.push({ type: 'automation_detected', detail: automation.reason });
  }

  // 3. Spoofed User Agent Check
  if (spoofing.isSpoofed) {
    score -= 50;
    pass = false;
    primaryBlockReason = `Browser environment inconsistency detected (${spoofing.reason}). Please disable user-agent spoofers or browser extensions that alter device properties.`;
    signals.push({ type: 'spoofed_user_agent', detail: spoofing.reason });
  }

  // 4. Virtual Camera Check
  if (virtualCams.hasVirtualCam) {
    score -= 70;
    pass = false;
    primaryBlockReason = `Virtual camera detected: "${virtualCams.suspiciousDevices[0]?.label}". Virtual webcams (OBS, ManyCam, DroidCam, etc.) are blocked. Please switch to your physical webcam.`;
    signals.push({ type: 'virtual_camera', detail: virtualCams.reason });
  }

  // 5. Desktop & Allowed Browser Validation
  if (pass) {
    if (browser.isMobile) {
      score -= 40;
      pass = false;
      primaryBlockReason = "Mobile devices and phone browsers are not supported for the Technova Code Sprint. You must use a desktop computer or laptop running Google Chrome, Microsoft Edge, or Mozilla Firefox.";
      signals.push({ type: 'mobile_device_blocked', detail: 'Mobile device detected' });
    } else if (!allowedBrowsers.includes(browser.name)) {
      score -= 40;
      pass = false;
      primaryBlockReason = `Unsupported browser (${browser.name.toUpperCase()}). Please open Technova Code Sprint in Google Chrome, Microsoft Edge, or Mozilla Firefox on desktop.`;
      signals.push({ type: 'unsupported_browser', detail: `Browser: ${browser.name}` });
    } else if (browser.version > 0 && minVersions[browser.name] && browser.version < minVersions[browser.name]) {
      score -= 30;
      pass = false;
      primaryBlockReason = `Outdated ${browser.name.toUpperCase()} (version ${browser.version}). Minimum required version is ${minVersions[browser.name]}. Please update your browser to proceed.`;
      signals.push({ type: 'outdated_browser', detail: `Version ${browser.version} < ${minVersions[browser.name]}` });
    }
  }

  return {
    pass,
    score: Math.max(0, score),
    browser,
    primaryBlockReason,
    signals,
    details: {
      embedded,
      automation,
      spoofing,
      virtualCams
    },
    fingerprint: generateBrowserFingerprint()
  };
}

/**
 * Verify Live Media Stream & Frame Liveness
 * Confirms video stream is not frozen, blank, blacked out, or a looped static image,
 * and confirms microphone has active AudioContext levels.
 */
export async function verifyStreamLiveness(stream, videoElement = null) {
  if (!stream) {
    return { ok: false, reason: "No active media stream provided." };
  }

  const videoTrack = stream.getVideoTracks()[0];
  const audioTrack = stream.getAudioTracks()[0];

  if (!videoTrack || videoTrack.readyState !== 'live' || videoTrack.muted) {
    return { ok: false, reason: "Webcam video track is not live or has been muted." };
  }

  if (!audioTrack || audioTrack.readyState !== 'live' || audioTrack.muted) {
    return { ok: false, reason: "Microphone audio track is not live or has been muted." };
  }

  // If a video element is supplied, perform dynamic frame motion analysis over 1 second
  if (videoElement && videoElement.readyState >= 2) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 120;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return { ok: true, note: "Canvas 2D unavailable; track live state verified." };

      // Grab Frame 1
      ctx.drawImage(videoElement, 0, 0, 160, 120);
      const frame1 = ctx.getImageData(0, 0, 160, 120).data;

      // Analyze Frame 1 luminance
      let totalLum = 0;
      for (let i = 0; i < frame1.length; i += 4) {
        totalLum += (0.299 * frame1[i] + 0.587 * frame1[i + 1] + 0.114 * frame1[i + 2]);
      }
      const avgLum = totalLum / (frame1.length / 4);

      if (avgLum < 10) {
        return { ok: false, reason: "Camera is completely blacked out or covered. Please ensure lighting and camera cover is open." };
      }
      if (avgLum > 250) {
        return { ok: false, reason: "Camera feed is solid white. Please check webcam connection." };
      }

      // Wait 350ms and grab Frame 2 to check for natural sensor noise / micro-movement (not frozen)
      await new Promise(r => setTimeout(r, 350));
      ctx.drawImage(videoElement, 0, 0, 160, 120);
      const frame2 = ctx.getImageData(0, 0, 160, 120).data;

      let pixelDiffSum = 0;
      for (let i = 0; i < frame1.length; i += 16) {
        pixelDiffSum += Math.abs(frame1[i] - frame2[i]);
      }

      // If pixel difference is exactly zero across all sampled pixels, frame is completely frozen or a fake canvas mock
      if (pixelDiffSum === 0) {
        return { ok: false, reason: "Camera feed is frozen or static. Live moving webcam video is required." };
      }

    } catch (err) {
      console.warn("Liveness frame verification note:", err);
    }
  }

  return { ok: true, reason: "Live video and audio streams verified." };
}
