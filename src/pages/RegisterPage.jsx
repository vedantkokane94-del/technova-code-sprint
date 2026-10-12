import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  User, 
  Mail, 
  Hash, 
  GraduationCap, 
  BookOpen, 
  Code2, 
  CheckCircle, 
  ArrowRight
} from 'lucide-react';
import { SVITHubLogo } from '../components/BrandLogo';

export const RegisterPage = ({ setCurrentTab }) => {
  const { user, setUser } = useApp();

  const [formData, setFormData] = useState({
    name: user?.role !== 'admin' ? (user?.name || "") : "",
    email: user?.role !== 'admin' ? (user?.email || "") : "",
    prn: user?.role !== 'admin' ? (user?.prn || "") : "",
    year: user?.role !== 'admin' ? (user?.year || "First Year (FE)") : "First Year (FE)",
    branch: user?.role !== 'admin' ? (user?.branch || "Computer Engineering") : "Computer Engineering",
    language: user?.role !== 'admin' ? (user?.language || user?.track || "Python") : "Python"
  });

  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.prn.trim()) {
      setError("Please fill in your name and Roll Number.");
      return;
    }

    const updatedUser = {
      uid: user?.uid || `svit-user-${Date.now()}`,
      name: formData.name.trim(),
      email: formData.email.trim(),
      prn: formData.prn.trim().toUpperCase(),
      year: formData.year,
      branch: formData.branch,
      language: formData.language,
      track: formData.language,
      role: user?.role || "student"
      // No external dummy profile photo loaded or stored (Section 6A)
    };

    setUser(updatedUser);
    setIsSuccess(true);
    setTimeout(() => {
      setCurrentTab('dashboard');
    }, 1000);
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
            {user ? "Update Sprint Profile" : "New Student Registration"}
          </h1>
          <p className="text-sm text-[#6b6375] dark:text-[#94a3b8] mt-1">
            Fill your academic details and select your programming language to begin the 9-day challenge.
          </p>
        </div>

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
                <CheckCircle className="w-4 h-4" />
                <span>Profile saved! Redirecting to dashboard...</span>
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
                    placeholder="e.g. 24CS089 / 42"
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
              className="w-full mt-4 py-3.5 px-4 rounded-xl font-bold text-white bg-[#B3122B] hover:bg-[#8B0D20] shadow-md shadow-[#B3122B]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Save Profile & Start Coding</span>
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
