import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Sun, 
  Moon, 
  ShieldCheck, 
  Menu, 
  X, 
  Trophy, 
  LayoutDashboard, 
  LogOut,
  Award,
  Home,
  Lock
} from 'lucide-react';
import { SVITHubLogo } from './BrandLogo';
import { safeInitials, safeSplit, safeTrim } from '../utils/safeString';

export const Navbar = ({ currentTab, setCurrentTab }) => {
  const { theme, toggleTheme, user, setUser, isAdmin } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'landing', label: 'Home', icon: Home },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'my-certificate', label: 'My Certificate', icon: Award },
    { id: 'admin', label: isAdmin ? 'Admin' : 'Admin Login', icon: ShieldCheck, badge: isAdmin ? 'Faculty' : null },
  ];

  const handleNavClick = (id) => {
    setCurrentTab(id);
    setMobileMenuOpen(false);
    if (id === 'admin') {
      window.history.pushState(null, '', '/admin');
    } else if (id === 'landing') {
      window.history.pushState(null, '', '/');
    }
  };

  const getInitials = (name) => {
    return safeInitials(name, 'S');
  };

  const firstName = user?.name ? (safeSplit(safeTrim(user.name), /\s+/)[0] || 'Student') : 'Student';
  const userLanguage = user?.language || user?.track || 'Python';

  return (
    <header className="sticky top-0 z-50 h-16 sm:h-[72px] bg-[#FCF9F2] dark:bg-[#0F1115] border-b border-[#E8DEC8] dark:border-[#2E3440] transition-colors select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full min-w-0">
          
          {/* Section 6B Left: Hub logo (40px) + Title on one line, subtitle below */}
          <div 
            onClick={() => handleNavClick('landing')}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer min-w-0"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center">
              <SVITHubLogo className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>

            <div className="min-w-0 text-left">
              <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden text-ellipsis">
                <span className="font-extrabold text-sm sm:text-lg tracking-tight text-[#1A1A1A] dark:text-white whitespace-nowrap">
                  Technova <span className="text-[#B3122B]">Code Sprint</span>
                </span>
                <span className="hidden md:inline-block text-[9.5px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#B3122B]/10 dark:bg-[#B3122B]/30 text-[#B3122B] dark:text-[#ff8a9e]">
                  9 Days to Build
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-[#6b6375] dark:text-[#94a3b8] font-medium whitespace-nowrap truncate leading-tight">
                Technical Skill Development Hub • SVIT Nashik
              </p>
            </div>
          </div>

          {/* Section 6B Desktop Navigation: in one row without wrapping */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2 whitespace-nowrap shrink-0">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = currentTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleNavClick(link.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#B3122B] text-white shadow-xs'
                      : 'text-[#4A4A4A] dark:text-[#CBD5E1] hover:bg-[#F5EFEB] dark:hover:bg-[#1E232B] hover:text-[#1A1A1A] dark:hover:text-white'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4 shrink-0" />}
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className="text-[9.5px] bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold px-1.5 py-0.5 rounded">
                      {link.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Section 6A & 6B Right: Theme toggle, User chip (first name - language), Logout icon */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            
            {/* Theme Toggle Button (at least 40px wide for easy tapping) */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="w-10 h-10 rounded-xl bg-[#F5EFEB] dark:bg-[#1E232B] text-[#4A4A4A] dark:text-[#CBD5E1] hover:text-[#B3122B] border border-[#E8DEC8] dark:border-[#2E3440] transition-colors flex items-center justify-center shrink-0 cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* User Chip: First name and chosen language, NO external or dummy photo */}
            {user ? (
              <div className="flex items-center gap-1.5">
                <div 
                  onClick={() => handleNavClick(isAdmin ? 'admin' : 'register')}
                  className="flex items-center gap-2 h-10 px-2.5 rounded-xl bg-[#F5EFEB] dark:bg-[#1E232B] border border-[#E8DEC8] dark:border-[#2E3440] cursor-pointer hover:border-[#B3122B] transition-all min-w-0"
                  title={isAdmin ? "Click to open admin dashboard" : "Click to view or edit profile"}
                >
                  {/* Initials circle: red on cream */}
                  <div className="w-6 h-6 rounded-full bg-[#FCF9F2] text-[#B3122B] border border-[#B3122B]/50 font-black text-[10px] flex items-center justify-center shrink-0 shadow-2xs">
                    {getInitials(user.name)}
                  </div>
                  <span className="text-xs font-bold text-[#1A1A1A] dark:text-white truncate max-w-[110px] sm:max-w-none whitespace-nowrap">
                    {firstName} - {isAdmin ? 'Admin' : userLanguage}
                  </span>
                </div>

                {/* Logout Icon Button (at least 40px wide) */}
                <button
                  onClick={() => {
                    setUser(null);
                    localStorage.removeItem('technova_active_user');
                    handleNavClick('landing');
                  }}
                  className="w-10 h-10 rounded-xl bg-[#F5EFEB] dark:bg-[#1E232B] text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-[#E8DEC8] dark:border-[#2E3440] transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleNavClick('register')}
                className="h-10 px-4 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] transition-all shadow-xs cursor-pointer whitespace-nowrap"
              >
                Sign In
              </button>
            )}

            {/* Section 6B Mobile Hamburger Menu (under 768px) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              className="md:hidden w-10 h-10 rounded-xl bg-[#F5EFEB] dark:bg-[#1E232B] text-gray-700 dark:text-gray-300 border border-[#E8DEC8] dark:border-[#2E3440] flex items-center justify-center cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Section 6B: Mobile Full-Width Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#0F1115] px-4 pt-3 pb-5 space-y-1.5 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = currentTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => handleNavClick(link.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-[#B3122B] text-white shadow-xs'
                    : 'text-[#4A4A4A] dark:text-[#CBD5E1] hover:bg-[#F5EFEB] dark:hover:bg-[#1E232B]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {Icon && <Icon className="w-4 h-4" />}
                  <span>{link.label}</span>
                </div>
                {link.badge && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold px-1.5 py-0.5 rounded">
                    {link.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Persistent Admin entry point visible to everyone (at least 44px tall) */}
          <div className="pt-2 border-t border-[#E8DEC8] dark:border-[#2E3440]">
            {isAdmin ? (
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-medium">Faculty Admin:</span>
                <button
                  onClick={() => handleNavClick('admin')}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer bg-[#B3122B] text-white"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Admin Dashboard</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleNavClick('admin')}
                className="w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-[#B3122B] dark:hover:text-[#ff8a9e] hover:bg-[#F5EFEB] dark:hover:bg-[#1E232B] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-gray-400" />
                  <span>Admin Login</span>
                </div>
                <span className="text-[10px] text-gray-400">Faculty & Mentors</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
