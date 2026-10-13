import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  User, 
  Mail, 
  Hash, 
  GraduationCap, 
  BookOpen, 
  Code2, 
  CheckCircle, 
  ArrowRight,
  LogIn
} from 'lucide-react';
import { SVITHubLogo } from '../components/BrandLogo';

export const RegisterPage = ({ setCurrentTab }) => {
  const { user, loginStudent } = useApp();

  const [formData, setFormData] = useState({
    name: user?.role !== 'admin' ? (user?.name || "") : "",
    email: user?.role !== 'admin' ? (user?.email || "") : "",
    prn: user?.role !== 'admin' ? (user?.prn || "") : "",
    year: user?.role !== 'admin' ? (user?.year || "First Year (FE)") : "First Year (FE)",
    branch: user?.role !== 'admin' ? (user?.branch || "Computer Engineering") : "Computer Engineering",
    language: user?.role !== 'admin' ? (user?.language || user?.track || "Python") : "Python"
  });

  const [lookupInput, setLookupInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("Profile saved! Redirecting to dashboard...");
  const [error, setError] = useState("");

  // Sync form fields when user is hydrated from the shared database via sessionToken
  useEffect(() => {
    if (user && user.role !== 'admin') {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        prn: user.prn || "",
        year: user.year || "First Year (FE)",
        branch: user.branch || "Computer Engineering",
        language: user.language || user.track || "Python"
      });
    }
  }, [user]);

  const branches = [
    "Computer Engineering",
    "ECE",
    "Chemical Engineering",
    "Information Technology"
  ];

  const years = [
    "First Year (FE)",
    "Second Year (SE)",
    "Third Year (TE)",
    "Final Year (BE)"
  ];

  const languages = [
    { id: "C", name: "C Language", desc: "Core procedural logic, memory pointers & structured algorithms" },
    { id: "C++", name: "C++", desc: "Modern C++, STL, classes, and algorithmic problem solving" },
    { id: "Java", name: "Java", desc: "Object-oriented programming, standard collections & scalable code" },
    { id: "Python", name: "Python", desc: "Pythonic syntax, built-in data types, parsing & rapid logic" }
  ];

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleLanguageSelect = (langId) => {
    setFormData(prev => ({ ...prev, language: langId }));
  };

  // Returning student sign-in by Roll Number or Email (loads name, roll number & track from shared database)
  const handleQuickLookupLogin = async (e) => {
    e.preventDefault();
    setError("");
    const val = lookupInput.trim();
    if (!val) {
      setError("Please enter your Roll Number or Email to sign in.");
      return;
    }

    setIsSubmitting(true);
    try {
      const isEmail = val.includes("@");
      const res = await loginStudent({
        mode: 'lookup',
        prn: isEmail ? '' : val.toUpperCase(),
        email: isEmail ? val.toLowerCase() : ''
      });

      if (!res || !res.success) {
        setError(res?.error || "No registered student found with that Roll Number. Please register using the form below.");
        setIsSubmitting(false);
        return;
      }

      setSuccessMsg(`Welcome back, ${res.user.name} (Roll No: ${res.user.prn} • ${res.user.language || res.user.track})! Redirecting...`);
      setIsSuccess(true);
      setTimeout(() => {
        setCurrentTab('dashboard');
      }, 800);
    } catch (err) {
      setError("Network error while signing in. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!formData.name.trim() || !formData.prn.trim()) {
      setError("Please fill in your name and Roll Number.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        mode: 'register_or_update',
        uid: user?.uid || `svit-student-${formData.prn.trim().toUpperCase()}`,
        name: formData.name.trim(),
        email: formData.email.trim(),
        prn: formData.prn.trim().toUpperCase(),
        year: formData.year,
        branch: formData.branch,
        language: formData.language,
        track: formData.language,
        role: "student"
      };

      const res = await loginStudent(payload);
      if (!res || !res.success) {
        setError(res?.error || "Could not save profile to database. Please try again.");
        setIsSubmitting(false);
        return;
      }

      setSuccessMsg("Profile saved to database! Redirecting to dashboard...");
      setIsSuccess(true);
      setTimeout(() => {
        setCurrentTab('dashboard');
      }, 800);
    } catch (err) {
      setError("Network error while saving profile. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCF9F2] dark:bg-[#0F1115] transition-colors py-8 sm:py-12 px-3 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <SVITHubLogo className="w-12 h-12" />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#B3122B]/10 dark:bg-[#B3122B]/20 text-[#B3122B] dark:text-[#ff8a9e] text-xs font-bold mb-2">
            <span>Technical Skill Development Hub • SVIT Nashik</span>
          </div>

          <h1 className="text-3xl font-extrabold text-[#1A1A1A] dark:text-white">
            {user ? "Update Sprint Profile" : "Student Sign In & Registration"}
          </h1>
          <p className="text-sm text-[#6b6375] dark:text-[#94a3b8] mt-1">
            Sign in with your Roll Number on any device, or register your profile to begin the 9-day challenge.
          </p>
        </div>

        {/* Returning Student Quick Sign-In (Loads Name, Roll No & Track from Shared DB) */}
        {!user && (
          <div className="bg-white dark:bg-[#181B20] rounded-2xl sm:rounded-3xl p-5 sm:p-6 mb-6 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <LogIn className="w-4 h-4 text-[#B3122B]" />
              <h2 className="text-sm font-extrabold text-[#1A1A1A] dark:text-white">
                Already Registered on Another Device? Sign In Instantly
              </h2>
            </div>
            <p className="text-xs text-[#6b6375] dark:text-[#94a3b8] mb-3">
              Enter your College Roll Number (e.g. <span className="font-mono font-bold">33</span>) or SVIT Email to load your account, score, and track from the database.
            </p>
            <form onSubmit={handleQuickLookupLogin} className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Hash className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={lookupInput}
                  onChange={(e) => setLookupInput(e.target.value)}
                  placeholder="Enter Roll Number (e.g. 33) or Email..."
                  data-testid="quick-signin-input"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-sm text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="quick-signin-btn"
                className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#1A1A1A] dark:bg-[#B3122B] hover:bg-[#B3122B] transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <span>Load My Account</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Card (No internal watermark, Section 6D) */}
        <div className="bg-white dark:bg-[#181B20] rounded-2xl sm:rounded-3xl p-5 sm:p-8 lg:p-10 border border-[#E8DEC8] dark:border-[#2E3440] shadow-sm relative">
          
          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {isSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0] mb-1.5">
                Full Name <span className="text-[#B3122B]">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Tanmay Joshi"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-sm text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0] mb-1.5">
                Email Address <span className="text-[#B3122B]">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="name@svit.ac.in"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-sm text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] transition-colors"
                />
              </div>
            </div>

            {/* Roll Number and Year */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0] mb-1.5">
                  College Roll Number <span className="text-[#B3122B]">*</span>
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    name="prn"
                    value={formData.prn}
                    onChange={handleChange}
                    required
                    placeholder="e.g. 24CS089 / 33"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-sm text-[#1A1A1A] dark:text-white uppercase font-mono focus:outline-hidden focus:border-[#B3122B] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0] mb-1.5">
                  Academic Year
                </label>
                <div className="relative">
                  <GraduationCap className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <select
                    name="year"
                    value={formData.year}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-sm text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] transition-colors"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Branch */}
            <div>
              <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0] mb-1.5">
                Department / Branch
              </label>
              <div className="relative">
                <BookOpen className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <select
                  name="branch"
                  value={formData.branch}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] text-sm text-[#1A1A1A] dark:text-white focus:outline-hidden focus:border-[#B3122B] transition-colors"
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Language Selector (4 Languages: C, C++, Java, Python) */}
            <div>
              <label className="block text-xs font-bold text-[#1A1A1A] dark:text-[#E2E8F0] mb-2">
                Choose Your Language Track <span className="text-[#B3122B]">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {languages.map((lang) => {
                  const selected = formData.language.toLowerCase() === lang.id.toLowerCase();
                  return (
                    <div
                      key={lang.id}
                      onClick={() => handleLanguageSelect(lang.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        selected
                          ? 'border-[#B3122B] bg-[#B3122B]/5 dark:bg-[#B3122B]/15 ring-1 ring-[#B3122B]'
                          : 'border-[#E8DEC8] dark:border-[#2E3440] bg-[#FCF9F2] dark:bg-[#111317] hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${selected ? 'text-[#B3122B] dark:text-[#ff8a9e]' : 'text-[#1A1A1A] dark:text-white'}`}>
                          {lang.name}
                        </span>
                        {selected && <CheckCircle className="w-4 h-4 text-[#B3122B]" />}
                      </div>
                      <p className="text-[11px] text-[#6b6375] dark:text-[#94a3b8] mt-1">
                        {lang.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 py-3.5 px-4 rounded-xl font-bold text-white bg-[#B3122B] hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isSubmitting ? "Saving..." : "Save Profile & Start Coding"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Faculty / Admin Link */}
          <div className="mt-6 pt-5 border-t border-[#E8DEC8] dark:border-[#2E3440] text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              SVIT Faculty member, Mentor or Administrator?{' '}
              <button
                type="button"
                onClick={() => setCurrentTab('admin')}
                className="font-bold text-[#B3122B] dark:text-[#ff8a9e] hover:underline cursor-pointer ml-1 inline-flex items-center gap-1"
              >
                Sign in to Admin Console →
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

