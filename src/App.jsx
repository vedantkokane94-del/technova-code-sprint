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
import { SVITHubLogo, DurgaMataSketch, ShaktiVidyaWatermark } from './components/BrandLogo';

function SprintApp() {
  const [currentTab, setCurrentTab] = useState('landing');
  const [selectedDay, setSelectedDay] = useState(1);
  const [verifyCertId, setVerifyCertId] = useState('');
  const { user, isAdmin } = useApp();

  const ADMIN_ROUTE_PATH = (import.meta.env.VITE_ADMIN_PATH || '/svit-lead-command-2026').replace(/\/$/, '');

  // Listen for direct URL routes e.g. /admin/login, /admin, /verify/ID
  React.useEffect(() => {
    const checkRoute = () => {
      const pathname = window.location.pathname.replace(/\/$/, '');
      const hash = window.location.hash.replace(/\/$/, '');
      const searchParams = new URLSearchParams(window.location.search);

      // 1. Explicit Admin Login Route: /admin/login
      if (pathname === '/admin/login' || hash === '#admin/login') {
        if (isAdmin) {
          setCurrentTab('admin');
          window.history.replaceState(null, '', '/admin');
        } else {
          setCurrentTab('admin-login');
        }
        return;
      }

      // 2. Protected Admin Dashboard Route: /admin
      if (pathname === '/admin' || hash === '#admin') {
        if (isAdmin) {
          setCurrentTab('admin');
        } else {
          // Unauthenticated visitors to /admin are directed to /admin/login
          setCurrentTab('admin-login');
          window.history.replaceState(null, '', '/admin/login');
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

      if (pathname.includes('/verify/')) {
        const id = pathname.split('/verify/')[1]?.replace(/\/$/, '');
        if (id) {
          setVerifyCertId(id);
          setCurrentTab('verify');
        }
      } else if (hash.includes('#verify/')) {
        const id = hash.split('#verify/')[1];
        if (id) {
          setVerifyCertId(id);
          setCurrentTab('verify');
        }
      } else if (searchParams.get('verify')) {
        setVerifyCertId(searchParams.get('verify'));
        setCurrentTab('verify');
      }
    };

    checkRoute();
    window.addEventListener('popstate', checkRoute);
    window.addEventListener('hashchange', checkRoute);
    return () => {
      window.removeEventListener('popstate', checkRoute);
      window.removeEventListener('hashchange', checkRoute);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#FCF9F2] dark:bg-[#0F1115] text-[#1A1A1A] dark:text-[#E2E8F0] transition-colors relative">
      {/* Universal Shakti Vidya Sacred Background Watermark */}
      <ShaktiVidyaWatermark />

      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <main className="flex-1 relative">
        {currentTab === 'landing' && (
          <LandingPage setCurrentTab={setCurrentTab} />
        )}

        {currentTab === 'register' && (
          <RegisterPage setCurrentTab={setCurrentTab} />
        )}

        {currentTab === 'dashboard' && (
          <DashboardPage 
            setCurrentTab={setCurrentTab} 
            setSelectedDay={setSelectedDay} 
          />
        )}

        {currentTab === 'task' && (
          <TaskPage 
            dayNumber={selectedDay} 
            setCurrentTab={setCurrentTab} 
          />
        )}

        {currentTab === 'leaderboard' && (
          <LeaderboardPage />
        )}

        {currentTab === 'my-certificate' && (
          <MyCertificatePage setCurrentTab={setCurrentTab} />
        )}

        {currentTab === 'verify' && (
          <VerifyCertificatePage 
            certificateId={verifyCertId} 
            onBack={() => {
              setCurrentTab('landing');
              window.history.pushState(null, '', '/');
            }}
          />
        )}

        {currentTab === 'admin-login' && (
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

        {currentTab === 'admin' && (
          isAdmin ? (
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
          )
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

          <div className="flex items-center gap-3 text-gray-500 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold">
              <DurgaMataSketch className="w-5 h-5 text-[#B3122B]" />
              <span>Shri Durga Mata Blessings</span>
            </div>
            <span>•</span>
            <span>Academic Integrity Protected</span>
            <span>•</span>
            <span>© 2026 SVIT Nashik</span>
          </div>
        </div>
      </footer>
    </div>
  );
}


export default function App() {
  return (
    <AppProvider>
      <SprintApp />
    </AppProvider>
  );
}

