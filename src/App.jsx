import React, { useState, useEffect } from 'react';
import { 
  Users, 
  BookOpen, 
  CalendarDays, 
  MapPin, 
  LogOut, 
  ShieldCheck, 
  GraduationCap, 
  Briefcase,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Lock,
  Sun,
  Moon
} from 'lucide-react';
import PlasmaRing from "./components/originkit/ui/plasma-ring";

const getInitialAuth = () => {
  try {
    const checkExpiryAndReturn = (storageString, storageType) => {
        if (!storageString) return null;
        const parsed = JSON.parse(storageString);
        // Verify 24-hour expiration
        if (parsed.expiry && parsed.expiry > Date.now()) {
            return parsed;
        } else {
            // Expired - clean up immediately
            if (storageType === 'session') sessionStorage.removeItem('examnex_auth');
            if (storageType === 'local') localStorage.removeItem('examnex_auth');
            return null;
        }
    };

    // 1. Check Session Storage first (For users who didn't click remember me, persists on refresh)
    const sessionAuth = checkExpiryAndReturn(sessionStorage.getItem('examnex_auth'), 'session');
    if (sessionAuth) return sessionAuth;

    // 2. Check Local Storage (For "Remember Me" users, persists across tab closes)
    const localAuth = checkExpiryAndReturn(localStorage.getItem('examnex_auth'), 'local');
    if (localAuth) return localAuth;

  } catch (e) {
    console.warn("Failed to parse auth state", e);
  }
  return { role: null, data: null };
};

const getInitialTheme = () => {
  try {
      const saved = localStorage.getItem('examnex_theme');
      if (saved !== null) return JSON.parse(saved);
      if (typeof window !== 'undefined') {
          return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
  } catch (e) {
      console.warn("Theme retrieval failed", e);
  }
  return false; // Default to light if nothing is found to verify fix
};

export default function App() {
  const [authState, setAuthState] = useState(getInitialAuth);
  const [userRole, setUserRole] = useState(authState.role);
  const [userData, setUserData] = useState(authState.data);
  const [rememberMe, setRememberMe] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(getInitialTheme);

  // Login Form State
  const [loginRole, setLoginRole] = useState('student');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // This explicitly fights environmental overrides by applying the class directly and cleaning up stray dark classes
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const reactRoot = document.getElementById('root');

    if (isDarkMode) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      body.classList.add('dark');
      if (reactRoot) reactRoot.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      body.classList.remove('dark');
      if (reactRoot) reactRoot.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
        const newTheme = !prev;
        try {
            localStorage.setItem('examnex_theme', JSON.stringify(newTheme));
        } catch (e) {}
        return newTheme;
    });
  };

  const handleLogout = () => {
    setUserRole(null);
    setUserData(null);
    setUsername('');
    setPassword('');
    setRememberMe(false);
    try {
      localStorage.removeItem('examnex_auth');
      sessionStorage.removeItem('examnex_auth');
    } catch (e) {}
  };

  // Monitor 24-hour Expiry continuously in the background
  useEffect(() => {
    const checkExpiry = () => {
      try {
        const localAuth = localStorage.getItem('examnex_auth');
        const sessionAuth = sessionStorage.getItem('examnex_auth');
        
        if (localAuth) {
          const parsed = JSON.parse(localAuth);
          if (parsed.expiry && Date.now() > parsed.expiry) handleLogout();
        }
        if (sessionAuth) {
            const parsed = JSON.parse(sessionAuth);
            if (parsed.expiry && Date.now() > parsed.expiry) handleLogout();
        }
      } catch (e) {}
    };
    
    checkExpiry();
    const interval = setInterval(checkExpiry, 60000); // Check every minute automatically
    return () => clearInterval(interval);
  }, []);

  const processSuccessfulLogin = (role, data) => {
    setUserRole(role);
    setUserData(data);

    const sessionData = {
      role: role,
      data: data,
      expiry: Date.now() + (24 * 60 * 60 * 1000) // 24 hours exact
    };

    try {
      if (rememberMe) {
        localStorage.setItem('examnex_auth', JSON.stringify(sessionData));
        sessionStorage.removeItem('examnex_auth'); 
      } else {
        sessionStorage.setItem('examnex_auth', JSON.stringify(sessionData));
        localStorage.removeItem('examnex_auth'); 
      }
    } catch (e) {}
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Admin demo fallback
    if (loginRole === 'admin') {
      const envAdminUser = import.meta.env.VITE_ADMIN_USER || 'bmu_edu_in';
      const envAdminPass = import.meta.env.VITE_ADMIN_PASS || 'admin@bmu@edu@in';
      
      if (username === envAdminUser && password === envAdminPass) {
        processSuccessfulLogin('admin', { name: 'System Administrator' });
        setIsLoading(false);
        return;
      }
    }

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: loginRole })
      });

      const data = await response.json();

      if (response.ok) {
        processSuccessfulLogin(loginRole, data.user);
      } else {
        setError(data.message || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      console.error("Login fetch error:", err);
      setError('Unable to connect to the backend server. Please check your network or try admin credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} w-full min-h-screen flex flex-col`}>
      <div className="w-full min-h-screen text-slate-900 dark:text-gray-100 flex flex-col bg-slate-50 dark:bg-[#0a0a0a] transition-colors duration-300">
          {!userRole ? (
            <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
              {/* Main Card */}
              <div className="w-full max-w-[1200px] min-h-[600px] lg:min-h-[700px] bg-white dark:bg-[#111111] rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl flex flex-col lg:flex-row p-3 relative transition-colors duration-300 border border-slate-200 dark:border-white/5">
                
                {/* LEFT SIDE - VISUAL */}
                <div className="hidden lg:flex flex-col relative w-1/2 rounded-[1.8rem] lg:rounded-[2.2rem] overflow-hidden bg-black p-10 lg:p-14">
                  <div className="flex-1 w-full relative flex items-center justify-center z-10">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <PlasmaRing 
                        background="#000000" 
                        colors={['#FF3300', '#0055FF', '#E200FF']} 
                        scale={45} 
                      />
                    </div>
                  </div>
                  <div className="relative z-20 mt-6 pt-6 border-t border-white/10 shrink-0">
                    <h1 className="text-6xl font-serif text-white leading-tight tracking-tight">
                      ExamNex
                    </h1>
                  </div>
                </div>

                {/* RIGHT SIDE - FORM */}
                <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-6 py-12 sm:px-12 lg:px-20 relative">
                  
                  {/* Theme Toggle */}
                  <button 
                    onClick={toggleTheme}
                    className="absolute top-6 right-6 lg:top-8 lg:right-8 z-[100] p-3 rounded-full bg-slate-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-all border border-slate-200 dark:border-white/5 shadow-sm cursor-pointer"
                    aria-label="Toggle Theme"
                  >
                    {isDarkMode ? <Sun className="w-5 h-5 pointer-events-none" /> : <Moon className="w-5 h-5 pointer-events-none" />}
                  </button>

                  <div className="w-full max-w-sm space-y-8 mt-8 lg:mt-0">
                    <div className="text-center lg:text-left">
                      <h1 className="text-3xl sm:text-4xl font-serif font-medium text-gray-900 dark:text-white tracking-tight mb-2 sm:mb-3 transition-colors">Welcome Back</h1>
                      <p className="text-sm text-slate-500 dark:text-gray-400">Enter your credentials to access your account</p>
                    </div>
                    
                    {error && (
                      <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm flex items-center animate-in fade-in duration-300 border border-red-100 dark:border-red-900/30">
                        <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                      <div className="bg-slate-100 dark:bg-white/5 p-1.5 rounded-2xl flex items-center justify-between border border-slate-200 dark:border-white/5 transition-colors">
                        <button
                          type="button"
                          onClick={() => { setLoginRole('student'); setError(''); setUsername(''); }}
                          className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all ${loginRole === 'student' ? 'bg-white dark:bg-[#222] shadow-sm text-gray-900 dark:text-white' : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'}`}
                        >
                          Student
                        </button>
                        <button
                          type="button"
                          onClick={() => { setLoginRole('faculty'); setError(''); setUsername(''); }}
                          className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all ${loginRole === 'faculty' ? 'bg-white dark:bg-[#222] shadow-sm text-gray-900 dark:text-white' : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'}`}
                        >
                          Faculty
                        </button>
                        <button
                          type="button"
                          onClick={() => { setLoginRole('admin'); setError(''); setUsername(''); }}
                          className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all ${loginRole === 'admin' ? 'bg-white dark:bg-[#222] shadow-sm text-gray-900 dark:text-white' : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'}`}
                        >
                          Admin
                        </button>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2 transition-colors">
                            {loginRole === 'student' ? 'Registration No.' : 'Username'}
                          </label>
                          <input 
                            type="text" 
                            required
                            value={username}
                            onChange={(e) => {
                              const val = e.target.value;
                              setUsername(loginRole === 'student' ? val.toUpperCase() : val);
                            }}
                            className={`w-full bg-slate-100 dark:bg-white/5 border border-transparent rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-white transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 ${loginRole === 'student' ? 'uppercase' : ''}`}
                            placeholder={loginRole === 'admin' ? "E.G., BMU_EDU_IN" : (loginRole === 'student' ? "E.G., 240C2070001" : "Enter your username")}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2 transition-colors">Password</label>
                          <input 
                            type="password" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-white/5 border border-transparent rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-white transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 dark:border-gray-600 dark:bg-white/10 dark:focus:ring-white transition-colors" 
                          />
                          <span className="text-xs font-medium text-slate-600 dark:text-gray-400 transition-colors">Remember me</span>
                        </label>
                        <a href="#" className="text-xs font-medium text-blue-600 dark:text-white hover:underline transition-colors">Forgot Password?</a>
                      </div>

                      <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black p-3.5 sm:p-4 rounded-2xl transition-all duration-200 font-bold mt-2 shadow-lg"
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <span>Sign In</span>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
        ) : (
          <div className="w-full flex flex-col flex-1">
            {/* Top Navigation Bar */}
            <nav className="bg-white dark:bg-[#111111] border-b border-slate-200 dark:border-white/10 sticky top-0 z-10 transition-colors">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex justify-between h-16">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                        <CalendarDays className="text-white w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <span className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white transition-colors">EXAMNEX</span>
                      <span className="hidden sm:inline-block ml-4 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 uppercase tracking-wider transition-colors">
                        {userRole} Portal
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 sm:space-x-4">
                    <button 
                      onClick={toggleTheme}
                      className="p-2 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        {isDarkMode ? <Sun className="w-5 h-5 pointer-events-none" /> : <Moon className="w-5 h-5 pointer-events-none" />}
                      </button>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden md:block border-l border-slate-200 dark:border-slate-700 pl-4 transition-colors">
                        {userData?.name || userData?.username || 'Welcome'}
                      </span>
                      <button 
                        onClick={handleLogout}
                        className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors px-2 sm:px-3 py-2 rounded-md text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <LogOut className="w-5 h-5 sm:w-4 sm:h-4" />
                        <span className="hidden sm:block">Logout</span>
                      </button>
                    </div>
                  </div>
                </div>
              </nav>

              {/* Main Content Area */}
              <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {userRole === 'admin' && <AdminDashboard />}
                {userRole === 'faculty' && <FacultyDashboard user={userData} />}
                {userRole === 'student' && <StudentDashboard user={userData} />}
              </main>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminDashboard() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white transition-colors">Examination Control Center</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors">Manage schedules, rooms, and allocations globally.</p>
      </header>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<BookOpen />} title="Total Exams" value="142" color="blue" />
        <StatCard icon={<Users />} title="Students Registered" value="3,240" color="emerald" />
        <StatCard icon={<MapPin />} title="Rooms Available" value="45" color="purple" />
        <StatCard icon={<AlertTriangle />} title="Unresolved Conflicts" value="2" color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-[#111111] rounded-xl shadow-sm border border-slate-200 dark:border-white/5 p-4 sm:p-6 transition-colors">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white transition-colors">Automated Scheduling Engine</h3>
            <button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
              Generate Draft Schedule
            </button>
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 transition-colors">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 transition-colors">Current Period Setup</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 transition-colors">August 16 - August 21, 2026</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-500 border border-amber-200 dark:border-amber-800/50 transition-colors">
                  Draft Phase
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="bg-white dark:bg-[#1a1a1a] p-3 rounded-md border border-slate-200 dark:border-white/5 shadow-sm transition-colors">
                  <span className="text-slate-500 dark:text-slate-400 block mb-1 transition-colors">Morning Shift:</span> 
                  <span className="font-semibold text-slate-900 dark:text-white transition-colors">10:00 AM</span>
                </div>
                <div className="bg-white dark:bg-[#1a1a1a] p-3 rounded-md border border-slate-200 dark:border-white/5 shadow-sm transition-colors">
                  <span className="text-slate-500 dark:text-slate-400 block mb-1 transition-colors">Evening Shift:</span> 
                  <span className="font-semibold text-slate-900 dark:text-white transition-colors">02:00 PM</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 transition-colors">
              <div className="flex items-center space-x-2 text-red-800 dark:text-red-400 mb-2 transition-colors">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="font-semibold">Detected Clashes (Requires Action)</h4>
              </div>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-2 list-disc list-inside ml-2 transition-colors">
                <li>Student S001 has core (CSE301) and RE (CSE201R) mapped to same slot.</li>
                <li>Batch 2024 has 2 exams falling on Aug 18.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-[#111111] rounded-xl shadow-sm border border-slate-200 dark:border-white/5 p-4 sm:p-6 transition-colors">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 transition-colors">Quick Actions</h3>
            <div className="space-y-3">
              <ActionLink icon={<Users />} label="Import Master Data (CSV)" />
              <ActionLink icon={<MapPin />} label="Manage Room Allocations" />
              <ActionLink icon={<Briefcase />} label="Faculty Duty Roster" />
              <ActionLink icon={<CheckCircle />} label="Approve & Lock Schedule" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FacultyDashboard({ user }) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white transition-colors">Faculty Portal</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors">Welcome back, {user?.name || 'Faculty'}. View your invigilation duties below.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2 transition-colors">Upcoming Invigilation Duties</h3>
          
          <div className="bg-white dark:bg-[#111111] rounded-xl shadow-sm border border-slate-200 dark:border-white/5 p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:border-blue-300 dark:hover:border-blue-800/50 transition-colors gap-4">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
                <span className="text-blue-700 dark:text-blue-400 font-bold text-lg">16</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg transition-colors">CSE301: Data Structures</h4>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1 text-sm text-slate-500 dark:text-slate-400 transition-colors">
                  <span className="flex items-center"><CalendarDays className="w-4 h-4 mr-1.5"/> Aug 16, 2026</span>
                  <span className="flex items-center"><MapPin className="w-4 h-4 mr-1.5"/> Room A (Block 1)</span>
                </div>
              </div>
            </div>
            <div className="w-full sm:w-auto flex flex-row sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-slate-100 dark:border-white/5 pt-3 sm:pt-0 transition-colors">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 transition-colors">
                Confirmed
              </span>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 sm:text-xs sm:text-slate-500 sm:mt-1.5 transition-colors">10:00 AM - 01:00 PM</p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111111] rounded-xl shadow-sm border border-slate-200 dark:border-white/5 p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:border-blue-300 dark:hover:border-blue-800/50 transition-colors gap-4">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
                <span className="text-slate-700 dark:text-slate-300 font-bold text-lg">18</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg transition-colors">CSE401: AI/ML Elective</h4>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1 text-sm text-slate-500 dark:text-slate-400 transition-colors">
                  <span className="flex items-center"><CalendarDays className="w-4 h-4 mr-1.5"/> Aug 18, 2026</span>
                  <span className="flex items-center"><MapPin className="w-4 h-4 mr-1.5"/> Room D (Block 2)</span>
                </div>
              </div>
            </div>
            <div className="w-full sm:w-auto flex flex-row sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-slate-100 dark:border-white/5 pt-3 sm:pt-0 transition-colors">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 transition-colors">
                Confirmed
              </span>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 sm:text-xs sm:text-slate-500 sm:mt-1.5 transition-colors">02:00 PM - 05:00 PM</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111111] rounded-xl shadow-sm border border-slate-200 dark:border-white/5 p-4 sm:p-6 h-fit transition-colors">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 transition-colors">Availability & Leave</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed transition-colors">
            If you have approved leave, report it here so the system can assign a replacement.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors">Select Date</label>
              <input type="date" className="w-full bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-lg shadow-sm p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none sm:text-sm transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors">Reason</label>
              <textarea rows={3} className="w-full bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-lg shadow-sm p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none sm:text-sm transition-all resize-none" placeholder="Enter reason..."></textarea>
            </div>
            <button className="w-full bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm">
              Submit Request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentDashboard({ user }) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white transition-colors">Student Portal</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors">Welcome, {user?.name || 'Student'} | {user?.stream || 'B.Tech'}</p>
        </div>
        <button className="flex items-center justify-center space-x-2 bg-white dark:bg-[#111111] border border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm w-full sm:w-auto">
          <MapPin className="w-4 h-4" />
          <span>Download Admit Card</span>
        </button>
      </header>

      <div className="bg-white dark:bg-[#111111] rounded-xl shadow-sm border border-slate-200 dark:border-white/5 overflow-hidden transition-colors">
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 transition-colors">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white transition-colors">My Examination Timetable</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 transition-colors">Your personalized schedule with seating arrangements.</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#111111] text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-white/10 transition-colors">
              <tr>
                <th className="px-4 sm:px-6 py-4">Date</th>
                <th className="px-4 sm:px-6 py-4">Course Code & Name</th>
                <th className="px-4 sm:px-6 py-4">Type</th>
                <th className="px-4 sm:px-6 py-4">Timing</th>
                <th className="px-4 sm:px-6 py-4">Room & Seat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-800 dark:text-slate-200 bg-white dark:bg-[#111111] transition-colors">
              <tr className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <td className="px-4 sm:px-6 py-4 font-medium text-slate-900 dark:text-white">Aug 16, 2026</td>
                <td className="px-4 sm:px-6 py-4">
                  <div className="font-semibold text-slate-900 dark:text-white">CSE301</div>
                  <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Data Structures</div>
                </td>
                <td className="px-4 sm:px-6 py-4"><span className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors">Core</span></td>
                <td className="px-4 sm:px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">10:00 AM - 01:00 PM</td>
                <td className="px-4 sm:px-6 py-4">
                  <div className="font-semibold text-slate-900 dark:text-white">Room A</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Seat: Col 2, R4</div>
                </td>
              </tr>
              <tr className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <td className="px-4 sm:px-6 py-4 font-medium text-slate-900 dark:text-white">Aug 17, 2026</td>
                <td className="px-4 sm:px-6 py-4">
                  <div className="font-semibold text-slate-900 dark:text-white">CSE201R</div>
                  <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Object Oriented Prog (RE)</div>
                </td>
                <td className="px-4 sm:px-6 py-4"><span className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors">Re-Exam</span></td>
                <td className="px-4 sm:px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">02:00 PM - 05:00 PM</td>
                <td className="px-4 sm:px-6 py-4">
                  <div className="font-semibold text-slate-900 dark:text-white">Room C</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Seat: Col 1, R1</div>
                </td>
              </tr>
              <tr className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <td className="px-4 sm:px-6 py-4 font-medium text-slate-900 dark:text-white">Aug 19, 2026</td>
                <td className="px-4 sm:px-6 py-4">
                  <div className="font-semibold text-slate-900 dark:text-white">MAT201</div>
                  <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Linear Algebra</div>
                </td>
                <td className="px-4 sm:px-6 py-4"><span className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/50 text-purple-700 dark:text-purple-400 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors">Minor</span></td>
                <td className="px-4 sm:px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">10:00 AM - 01:00 PM</td>
                <td className="px-4 sm:px-6 py-4">
                  <div className="font-semibold text-slate-900 dark:text-white">Room B</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Seat: Col 4, R10</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, color }) {
  const colors = {
    blue: 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30 text-emerald-600 dark:text-emerald-400',
    purple: 'bg-purple-50/50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/30 text-purple-600 dark:text-purple-400',
    red: 'bg-red-50/50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30 text-red-600 dark:text-red-400',
  };

  return (
    <div className="bg-white dark:bg-[#111111] p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm flex items-center space-x-4 hover:shadow-md transition-all">
      <div className={`p-3 sm:p-3.5 rounded-xl border transition-colors ${colors[color]}`}>
        {React.cloneElement(icon, { className: 'w-5 h-5 sm:w-6 sm:h-6' })}
      </div>
      <div>
        <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors">{title}</p>
        <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5 transition-colors">{value}</p>
      </div>
    </div>
  );
}

function ActionLink({ icon, label }) {
  return (
    <button className="w-full flex items-center justify-between p-3.5 rounded-lg border border-slate-200 dark:border-white/5 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 group transition-all text-left">
      <div className="flex items-center space-x-3 text-slate-700 dark:text-slate-300 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
        {React.cloneElement(icon, { className: 'w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors' })}
        <span className="font-medium text-sm">{label}</span>
      </div>
      <span className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">→</span>
    </button>
  );
}