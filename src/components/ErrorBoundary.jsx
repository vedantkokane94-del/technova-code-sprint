import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { SVITHubLogo } from './BrandLogo';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] text-[#1A1A1A] dark:text-[#E2E8F0] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-[#181B20] border border-[#E8DEC8] dark:border-[#2E3440] rounded-3xl p-8 shadow-2xl text-center">
            <div className="flex justify-center mb-4">
              <SVITHubLogo className="w-12 h-12" />
            </div>
            
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h2 className="text-xl font-black text-[#1A1A1A] dark:text-white mb-2">
              Something went wrong
            </h2>

            <p className="text-xs text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              An unexpected error occurred while rendering this page. Our technical team has been notified.
            </p>

            {this.state.error?.message && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/30 text-[11px] text-red-700 dark:text-red-300 font-mono text-left mb-6 overflow-x-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#8B0D20] text-white font-bold text-xs hover:bg-[#6D0A19] transition-all shadow-md cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Return Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
