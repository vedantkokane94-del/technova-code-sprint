import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { TaskPage } from './pages/TaskPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { AdminPage } from './pages/AdminPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { MyCertificatePage } from './pages/MyCertificatePage';
import { VerifyCertificatePage } from './pages/VerifyCertificatePage';
import { ErrorBoundary, PageErrorBoundary } from './components/ErrorBoundary';
import { SVITHubLogo, DurgaMataSketch, ShaktiVidyaWatermark } from './components/BrandLogo';
import { ShieldCheck } from 'lucide-react';

function SprintApp() {
  const [currentTab, setCurrentTab] = useState('landing');
  const [selectedDay, setSelectedDay] = useState(1);
  const [verifyCertId, setVerifyCertId] = useState('');
  const { user, isAdmin, isSessionLoading } = useApp();

  const ADMIN_ROUTE_PATH = (import.meta.env.VITE_ADMIN_PATH || '/svit-lead-command-2026').replace(/\/$/, '');

  // Listen for direct URL routes e.g. /admin, /verify/ID
  React.useEffect(() => {
    const checkRoute = () => {
      const pathname = window.location.pathname.replace(/\/$/, '');
      const hash = window.location.hash.replace(/\/$/, '');
      const searchParams = new URLSearchParams(window.location.search);

      // 1. Dedicated Admin Page Route: /admin or /admin/login
      if (pathname === '/admin' || pathname === '/admin/login' || hash === '#admin' || hash === '#admin/login') {
        setCurrentTab('admin');
        if (pathname === '/admin/login' || hash === '#admin/login') {
          window.history.replaceState(null, '', '/admin');
        }
        return;
      }

      // 3. Obfuscated Admin Route fallback
      if (
        pathname === ADMIN_ROUTE_PATH || 
        hash === `#${ADMIN_ROUTE_PATH}` ||
        pathname === `${ADMIN_ROUTE_PATH}/auth/setup` ||
        hash === `#${ADMIN_ROUTE_PATH}/auth/setup`
      ) {
        if (isAdmin) {
          setCurrentTab('admin');
        } else {
          setCurrentTab('admin-login');
        }
        return;
      }

      // 4. Certificate Verification Route: /verify or /verify/:id
      if (pathname === '/verify' || pathname.startsWith('/verify/') || hash === '#verify' || hash.startsWith('#verify/')) {
        let id = '';
        if (pathname.includes('/verify/')) {
          id = decodeURIComponent(pathname.split('/verify/')[1] || '').split('?')[0].split('#')[0].replace(/\/$/, '');
        } else if (hash.includes('#verify/')) {
          id = decodeURIComponent(hash.split('#verify/')[1] || '').split('?')[0].replace(/\/$/, '');
        } else if (searchParams.get('verify')) {
          id = decodeURIComponent(searchParams.get('verify')).trim();
        }
        setVerifyCertId(id);
        setCurrentTab('verify');
        return;
      } else if (searchParams.get('verify')) {
        setVerifyCertId(decodeURIComponent(searchParams.get('verify')).trim());
        setCurrentTab('verify');
        return;
      }
    };

    checkRoute();
    window.addEventListener('popstate', checkRoute);
    window.addEventListener('hashchange', checkRoute);
    return () => {
      window.removeEventListener('popstate', checkRoute);
      window.removeEventListener('hashchange', checkRoute);
    };
  }, [isAdmin, isSessionLoading]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FCF9F2] dark:bg-[#0F1115] text-[#1A1A1A] dark:text-[#E2E8F0] transition-colors relative">
      {/* Universal Shakti Vidya Sacred Background Watermark */}
      <ShaktiVidyaWatermark />

      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <main className="flex-1 relative">
        {currentTab === 'landing' && (
          <PageErrorBoundary pageName="landing" onBackToDashboard={() => setCurrentTab('landing')}>
            <LandingPage setCurrentTab={setCurrentTab} />
          </PageErrorBoundary>
        )}

        {currentTab === 'register' && (
          <PageErrorBoundary pageName="register" onBackToDashboard={() => setCurrentTab('dashboard')}>
            <RegisterPage setCurrentTab={setCurrentTab} />
          </PageErrorBoundary>
        )}

        {currentTab === 'dashboard' && (
          <PageErrorBoundary pageName="dashboard" onBackToDashboard={() => setCurrentTab('dashboard')}>
            <DashboardPage 
              setCurrentTab={setCurrentTab} 
              setSelectedDay={setSelectedDay} 
            />
          </PageErrorBoundary>
        )}

        {currentTab === 'task' && (
          <PageErrorBoundary pageName="task" onBackToDashboard={() => setCurrentTab('dashboard')}>
            <TaskPage 
              dayNumber={selectedDay} 
              setCurrentTab={setCurrentTab} 
            />
          </PageErrorBoundary>
        )}

        {currentTab === 'leaderboard' && (
          <PageErrorBoundary pageName="leaderboard" onBackToDashboard={() => setCurrentTab('dashboard')}>
            <LeaderboardPage />
          </PageErrorBoundary>
        )}

        {currentTab === 'my-certificate' && (
          <PageErrorBoundary pageName="my-certificate" onBackToDashboard={() => setCurrentTab('dashboard')}>
            <MyCertificatePage setCurrentTab={setCurrentTab} />
          </PageErrorBoundary>
        )}

        {currentTab === 'verify' && (
          <PageErrorBoundary pageName="verify" onBackToDashboard={() => setCurrentTab('dashboard')}>
            <VerifyCertificatePage 
              certificateId={verifyCertId} 
              onBack={() => {
                setCurrentTab('landing');
                window.history.pushState(null, '', '/');
              }}
            />
          </PageErrorBoundary>
        )}

        {currentTab === 'admin-login' && (
          <PageErrorBoundary pageName="admin-login" onBackToDashboard={() => setCurrentTab('dashboard')}>
            <AdminLoginPage 
              onLoginSuccess={() => {
                setCurrentTab('admin');
                window.history.pushState(null, '', '/admin');
              }}
              onNavigateHome={() => {
                setCurrentTab('landing');
                window.history.pushState(null, '', '/');
              }}
            />
          </PageErrorBoundary>
        )}

        {currentTab === 'admin' && (
          <PageErrorBoundary 
            pageName="admin" 
            friendlyMessage="We couldn't open the admin page. Please try again."
            onBackToDashboard={() => {
              setCurrentTab('landing');
              window.history.pushState(null, '', '/');
            }}
          >
            {isSessionLoading ? (
              <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center">
                <div className="w-12 h-12 rounded-full border-4 border-[#8B0D20]/20 border-t-[#8B0D20] animate-spin mb-4" />
                <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-white">Verifying Administrator Session...</h3>
                <p className="text-xs text-gray-500 mt-1">Checking secure session credentials with the server</p>
              </div>
            ) : isAdmin ? (
              <AdminPage setCurrentTab={setCurrentTab} />
            ) : (
              <AdminLoginPage 
                onLoginSuccess={() => {
                  setCurrentTab('admin');
                  window.history.pushState(null, '', '/admin');
                }}
                onNavigateHome={() => {
                  setCurrentTab('landing');
                  window.history.pushState(null, '', '/');
                }}
              />
            )}
          </PageErrorBoundary>
        )}
      </main>

      {/* College Institutional Footer */}
      <footer className="border-t border-[#E8DEC8] dark:border-[#2E3440] bg-white dark:bg-[#0F1115] py-8 px-4 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SVITHubLogo className="w-8 h-8 shrink-0" />
            <div className="text-left">
              <span className="font-extrabold text-[#1A1A1A] dark:text-white block sm:inline">
                Technical Skill Development Hub, SVIT Nashik
              </span>
              <span className="hidden sm:inline text-gray-400 mx-2">|</span>
              <span className="font-bold text-[#8B0D20] dark:text-[#ff8a9e]">Learn | Build | Grow</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 text-gray-500 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold">
              <DurgaMataSketch className="w-5 h-5 text-[#B3122B]" />
              <span>Shri Durga Mata Blessings</span>
            </div>
            <span>•</span>
            <span>Academic Integrity Protected</span>
            <span>•</span>
            <span>© 2026 SVIT Nashik</span>
            <span>•</span>
            {/* Prominent, always present and tappable (at least 44px tall) Admin Login entry point */}
            <button
              type="button"
              onClick={() => {
                setCurrentTab('admin');
                window.history.pushState(null, '', '/admin');
              }}
              className="min-h-[44px] px-3.5 py-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#B3122B] dark:text-[#ff8a9e] bg-[#B3122B]/10 hover:bg-[#B3122B] hover:text-white dark:hover:text-white border border-[#B3122B]/30 rounded-xl transition-all cursor-pointer shadow-2xs"
              title={isAdmin ? "Open Administrator Command Center" : "Institutional Administrator Sign-In"}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isAdmin ? "Admin Dashboard" : "Admin Login"}</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}


export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <SprintApp />
      </AppProvider>
    </ErrorBoundary>
  );
}

