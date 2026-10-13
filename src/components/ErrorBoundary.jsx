import React from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { SVITHubLogo } from './BrandLogo';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 1. Prominently log to browser console with full stack trace
    console.error('====================================================');
    console.error('[ErrorBoundary] Uncaught application runtime error:');
    console.error(error);
    if (error?.stack) {
      console.error('Stack trace:\n' + error.stack);
    }
    if (errorInfo?.componentStack) {
      console.error('Component stack:\n' + errorInfo.componentStack);
    }
    console.error('====================================================');

    this.setState({ errorInfo });

    // 2. Report error with stack trace to server logs
    try {
      const payload = {
        message: error?.message || String(error),
        stack: error?.stack || null,
        componentStack: errorInfo?.componentStack || null,
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        timestamp: new Date().toISOString()
      };

      if (typeof fetch === 'function') {
        fetch('/api/logs/client-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'same-origin'
        }).catch(() => {
          // If fetch fails, try sendBeacon as fallback
          if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            navigator.sendBeacon('/api/logs/client-error', JSON.stringify(payload));
          }
        });
      }
    } catch (e) {
      // Non-blocking telemetry failure
    }
  }

  handleClearCacheAndReload = async () => {
    try {
      // 1. Clear old or stale student/session cache keys from localStorage
      const keysToClear = [
        'technova_active_user',
        'technova_students',
        'technova_submissions',
        'technova_certificates',
        'technova_manual_overrides',
        'technova_user_consents',
        'technova_proctoring_flags',
        'technova_tasks'
      ];
      keysToClear.forEach(key => {
        try { localStorage.removeItem(key); } catch (e) {}
      });

      // 2. Clear sessionStorage
      try { sessionStorage.clear(); } catch (e) {}

      // 3. Unregister any service workers if present
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }

      // 4. Clear any CacheStorage caches
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheKeys = await window.caches.keys();
        for (const k of cacheKeys) {
          await window.caches.delete(k);
        }
      }
    } catch (e) {
      console.warn('Cache clearing error:', e);
    } finally {
      // Hard reload
      window.location.reload();
    }
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || 'Unknown runtime error';
      const errorStack = this.state.error?.stack || '';

      return (
        <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] text-[#1A1A1A] dark:text-[#E2E8F0] flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
            <div className="flex justify-center mb-4">
              <SVITHubLogo className="w-12 h-12" />
            </div>
            
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-[#1A1A1A] dark:text-white mb-2">
              Something went wrong
            </h2>

            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              An unexpected display error occurred while rendering this view. Your server-side progress and submissions remain completely safe.
            </p>

            <div className="p-3.5 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/30 text-xs text-red-700 dark:text-red-300 font-mono text-left mb-6 break-words">
              <strong>Error:</strong> {errorMessage}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <button
                onClick={this.handleClearCacheAndReload}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#8B0D20] text-white font-bold text-xs sm:text-sm hover:bg-[#6D0A19] transition-all shadow-md cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Clear Cache & Reload</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold text-xs sm:text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Return Home</span>
              </button>
            </div>

            {/* Diagnostic Details Accordion */}
            <div className="border-t border-[#E8DEC8] dark:border-[#2E3440] pt-4 text-left">
              <button
                onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                className="flex items-center justify-between w-full text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-semibold cursor-pointer"
              >
                <span>Diagnostic Details (Stack Trace)</span>
                {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {this.state.showDetails && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-[#121418] rounded-xl border border-gray-200 dark:border-gray-800 text-[10px] text-gray-700 dark:text-gray-300 font-mono max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                  {errorStack || 'No stack trace available.'}
                  {this.state.errorInfo?.componentStack && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-800 text-gray-500">
                      <strong>Component Hierarchy:</strong>
                      {this.state.errorInfo.componentStack}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('====================================================');
    console.error(`[PageErrorBoundary:${this.props.pageName || 'page'}] Uncaught runtime error:`);
    console.error(error);
    if (error?.stack) {
      console.error('Stack trace:\n' + error.stack);
    }
    if (errorInfo?.componentStack) {
      console.error('Component stack:\n' + errorInfo.componentStack);
    }
    console.error('====================================================');
    this.setState({ errorInfo });
  }

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleBackToDashboard = () => {
    if (this.props.onBackToDashboard) {
      this.props.onBackToDashboard();
    } else {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      const isTask = this.props.pageName === 'task';
      const mainMessage = isTask
        ? "We couldn't open this task. Please try again."
        : (this.props.friendlyMessage || "We couldn't load this page. Please try again.");
      const errorText = this.state.error?.message || String(this.state.error || 'Unknown error');
      const errorStack = this.state.error?.stack || '';

      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] rounded-3xl p-6 sm:p-8 shadow-xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/40 text-[#B3122B] flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base sm:text-lg font-black text-[#1A1A1A] dark:text-white mb-2">
              {mainMessage}
            </h3>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
              An unexpected display issue occurred. You can retry opening the view or return to your sprint dashboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 justify-center mb-5">
              <button
                type="button"
                onClick={this.handleTryAgain}
                className="px-5 py-2.5 rounded-xl bg-[#B3122B] hover:bg-[#8B0D20] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try again</span>
              </button>

              <button
                type="button"
                onClick={this.handleBackToDashboard}
                className="px-5 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] hover:border-[#B3122B] text-gray-700 dark:text-gray-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>{this.props.pageName === 'admin' ? 'Back to home' : 'Back to dashboard'}</span>
              </button>
            </div>

            {/* Technical error text in small grey type for debugging */}
            <div className="mt-4 pt-3 border-t border-[#E8DEC8]/60 dark:border-[#2E3440] text-left">
              <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">
                Technical Error Details:
              </div>
              <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#111317] border border-gray-200 dark:border-gray-800 text-[11px] font-mono text-gray-400 max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                {errorText}
                {errorStack ? `\n\n${errorStack}` : ''}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

