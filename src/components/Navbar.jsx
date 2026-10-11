import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Code2, 
  Sun, 
  Moon, 
  User, 
  ShieldCheck, 
  Menu, 
  X, 
  Trophy, 
  LayoutDashboard, 
  FileCode2, 
  LogOut,
  Calendar,
  Award
} from 'lucide-react';

import { SVITHubLogo, DurgaMataSketch } from './BrandLogo';

export const Navbar = ({ currentTab, setCurrentTab }) => {
  const { theme, toggleTheme, user, isAdmin, switchRole } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'landing', label: 'Home' },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'my-certificate', label: 'My Certificate', icon: Award },
  ];

  if (isAdmin) {
    navLinks.push({ id: 'admin', label: 'Admin Panel', icon: ShieldCheck, badge: 'Faculty' });
  }

  const handleNavClick = (id) => {
    setCurrentTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#FCF9F2]/95 dark:bg-[#0F1115]/95 backdrop-blur-md border-b border-[#E8DEC8] dark:border-[#2E3440] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo with Hub Emblem & Durga Mata Blessings */}
          <div 
            onClick={() => handleNavClick('landing')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            {/* Technical Skill Development Hub Logo */}
            <div className="group-hover:scale-105 transition-transform">
              <SVITHubLogo className="w-10 h-10" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-[#1A1A1A] dark:text-white">
                  TECHNOVA <span className="text-[#B3122B]">CODE SPRINT</span>
                </span>
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#B3122B]/10 dark:bg-[#B3122B]/30 text-[#B3122B] dark:text-[#ff8a9e]">
                  9 Days to Build
                </span>
              </div>
              <p className="text-[11px] text-[#6b6375] dark:text-[#94a3b8] font-medium flex items-center gap-1.5">
                <span className="font-bold text-[#8B0D20] dark:text-[#ff8a9e]">Skill Development Hub</span>
                <span className="inline-block w-1 h-1 rounded-full bg-[#B3122B]"></span>
                <span>SVIT Nashik</span>
                <span className="hidden sm:inline text-amber-600 dark:text-amber-400 font-semibold">• Learn | Build | Grow</span>
              </p>
            </div>

            {/* Sacred Durga Mata Divine Sketch Emblem */}
            <div 
              className="hidden lg:flex items-center gap-1 pl-2 border-l border-[#E8DEC8] dark:border-[#2E3440] text-[#B3122B] dark:text-[#ff8a9e]"
              title="Shri Durga Mata Blessings • Wisdom, Strength & Knowledge"
            >
              <DurgaMataSketch className="w-8 h-8" />
              <div className="text-[9px] font-bold leading-tight uppercase tracking-wider text-amber-700 dark:text-amber-400">
                <span>Shakti</span><br/><span>Vidya</span>
              </div>
            </div>
          </div>


          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = currentTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleNavClick(link.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                    active
                      ? 'bg-[#B3122B] text-white shadow-sm shadow-[#B3122B]/30'
                      : 'text-[#4A4A4A] dark:text-[#CBD5E1] hover:bg-[#F5EFEB] dark:hover:bg-[#1E232B] hover:text-[#1A1A1A] dark:hover:text-white'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold px-1.5 py-0.5 rounded">
                      {link.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Icons & Role Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Faculty Admin Portal Link */}
            <div className="hidden lg:flex items-center">
              {isAdmin ? (
                <button
                  onClick={() => handleNavClick('admin')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    currentTab === 'admin'
                      ? 'bg-[#B3122B] text-white shadow-xs'
                      : 'bg-red-50 dark:bg-red-950/30 text-[#B3122B] dark:text-[#ff8a9e] border border-red-200 dark:border-red-900/50 hover:bg-red-100'
                  }`}
                  title="Access Faculty Admin Command Center"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Faculty Admin</span>
                </button>
              ) : (
                <button
                  onClick={() => handleNavClick('admin')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-[#B3122B] hover:bg-[#F5EFEB] dark:hover:bg-[#1A1D24] border border-[#E8DEC8] dark:border-[#2E3440] transition-all cursor-pointer"
                  title="Faculty & Mentor Sign In"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
                  <span>Admin Portal</span>
                </button>
              )}
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg bg-[#F5EFEB] dark:bg-[#1E232B] text-[#4A4A4A] dark:text-[#CBD5E1] hover:text-[#B3122B] dark:hover:text-red-400 border border-[#E8DEC8] dark:border-[#2E3440] transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* User Profile / Auth State */}
            {user ? (
              <div className="flex items-center gap-1.5">
                <div 
                  onClick={() => handleNavClick('register')}
                  className="flex items-center gap-2 p-1 pl-2 sm:pr-3 rounded-full bg-[#F5EFEB] dark:bg-[#1E232B] border border-[#E8DEC8] dark:border-[#2E3440] cursor-pointer hover:border-[#B3122B] transition-all"
                  title="Edit registration profile"
                >
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || 'Student')}`}
                    alt={user.name}
                    className="w-7 h-7 rounded-full object-cover ring-1 ring-[#B3122B]"
                  />
                  <div className="hidden sm:block text-left text-xs">
                    <div className="font-semibold text-[#1A1A1A] dark:text-white truncate max-w-[100px]">
                      {user.name.split(' ')[0]}
                    </div>
                    <div className="text-[10px] text-[#6b6375] dark:text-[#94a3b8]">
                      {isAdmin ? 'Admin' : (user.track || 'Web')}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setUser(null);
                    localStorage.removeItem('technova_active_user');
                    handleNavClick('landing');
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                  title="Sign out (register new student)"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleNavClick('register')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#B3122B] text-white hover:bg-[#8B0D20] transition-all shadow-sm shadow-[#B3122B]/20 cursor-pointer"
              >
                Register / Sign In
              </button>
            )}

            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-[#F5EFEB] dark:bg-[#1E232B] text-gray-700 dark:text-gray-300"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#0F1115] px-4 pt-3 pb-5 space-y-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = currentTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => handleNavClick(link.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  active
                    ? 'bg-[#B3122B] text-white'
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

          <div className="pt-2 border-t border-[#E8DEC8] dark:border-[#2E3440] flex justify-between items-center text-xs">
            <span className="text-gray-500 font-medium">Faculty / Mentor:</span>
            <button
              onClick={() => handleNavClick('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                isAdmin 
                  ? 'bg-[#B3122B] text-white' 
                  : 'bg-white dark:bg-[#1E232B] border border-[#E8DEC8] dark:border-[#2E3440] text-gray-700 dark:text-gray-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isAdmin ? 'Admin Dashboard' : 'Admin Login'}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
