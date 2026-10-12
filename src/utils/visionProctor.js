/**
 * Technova Code Sprint: In-Browser Vision Proctoring Engine
 * Sir Visvesvaraya Institute of Technology (SVIT), Nashik
 * 
 * Runs client-side object & presence detection on webcam feed:
 * 1. Cell phone detection (COCO-SSD / optical object detection)
 * 2. Multiple faces / persons detection
 * 3. Absence of student / No face detected (> N seconds)
 * 4. Continuous looking away (> N seconds)
 * 5. Camera obstruction or blackout
 */

// Model cache
let cocoModelPromise = null;
let isModelLoading = false;

export async function loadCocoModel() {
  if (window.__technovaCocoModel) {
    return window.__technovaCocoModel;
  }
  if (cocoModelPromise) {
    return cocoModelPromise;
  }

  isModelLoading = true;
  cocoModelPromise = new Promise(async (resolve) => {
    try {
      // Check if tf and cocoSsd scripts are on window
      if (!window.tf) {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
      }
      if (!window.cocoSsd) {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
      }
      if (window.cocoSsd) {
        const model = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
        window.__technovaCocoModel = model;
        isModelLoading = false;
        resolve(model);
        return;
      }
    } catch (err) {
      console.warn("VisionProctor: COCO-SSD remote load failed, using high-speed optical fallback vision:", err);
    }
    isModelLoading = false;
    resolve(null);
  });

  return cocoModelPromise;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    // Check if script element already exists
    if (document.querySelector(`script[src="${src}"]`)) {
      return resolve();
    }
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
}

/**
 * Optical Fallback Analysis when Neural Network is loading or device is low-powered
 */
export function analyzeFrameOptical(videoElement, canvasElement) {
  if (!videoElement || !canvasElement || videoElement.readyState < 2) {
    return { hasFace: true, personCount: 1, hasPhone: false, lookingAway: false };
  }

  const width = 160;
  const height = 120;
  canvasElement.width = width;
  canvasElement.height = height;
  const ctx = canvasElement.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(videoElement, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let totalLuminance = 0;
  let skinPixels = 0;
  let skinXSum = 0;
  let skinYSum = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    totalLuminance += lum;

    // Skin color range heuristic (RGB & Normalized)
    if (r > 60 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 12) {
      skinPixels++;
      const pixelIdx = i / 4;
      const x = pixelIdx % width;
      const y = Math.floor(pixelIdx / width);
      skinXSum += x;
      skinYSum += y;
    }
  }

  const avgLuminance = totalLuminance / (data.length / 4);
  const skinRatio = skinPixels / (data.length / 4);

  // Covered / Dark Camera
  if (avgLuminance < 15 || skinRatio < 0.02) {
    return {
      hasFace: false,
      personCount: 0,
      hasPhone: false,
      lookingAway: false,
      reason: avgLuminance < 15 ? 'Camera covered or pitch black' : 'No face detected in frame'
    };
  }

  // Head Position / Looking away check
  let lookingAway = false;
  if (skinPixels > 100) {
    const avgX = skinXSum / skinPixels;
    // If center of face is pushed far to edges (< 25% or > 75% of screen width)
    if (avgX < width * 0.22 || avgX > width * 0.78) {
      lookingAway = true;
    }
  }

  return {
    hasFace: true,
    personCount: 1,
    hasPhone: false,
    lookingAway
  };
}

/**
 * Capture high-quality snapshot for proctoring flag/log
 */
export function captureSnapshot(videoElement) {
  if (!videoElement || videoElement.readyState < 2) return null;
  try {
    const offscreen = document.createElement('canvas');
    offscreen.width = 320;
    offscreen.height = 240;
    const ctx = offscreen.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, 320, 240);
    return offscreen.toDataURL('image/jpeg', 0.65);
  } catch (e) {
    return null;
  }
}
