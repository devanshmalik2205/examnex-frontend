import React, { useState } from 'react';
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
  Lock
} from 'lucide-react';

export default function App() {
  // Authentication & User State
  const [userRole, setUserRole] = useState(null); // 'admin', 'faculty', 'student'
  const [userData, setUserData] = useState(null);
  
  // Login Form State
  const [loginRole, setLoginRole] = useState('student');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Admin env variable fallback checking (Frontend Verification)
    if (loginRole === 'admin') {
      const envAdminUser = import.meta.env.VITE_ADMIN_USER || 'bmu_edu_in';
      const envAdminPass = import.meta.env.VITE_ADMIN_PASS || 'admin@bmu@edu@in';
      
      if (username === envAdminUser && password === envAdminPass) {
        setUserRole('admin');
        setUserData({ name: 'System Administrator' });
        setIsLoading(false);
        return;
      }
    }

    try {
      // Connect to the Render backend (or localhost during dev)
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      
      const response = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username, 
          password, 
          role: loginRole 
        })
      });

      const data = await response.json();

      if (response.ok) {
        setUserRole(loginRole);
        setUserData(data.user);
        // In a real app, you would save the JWT token to localStorage here
        // localStorage.setItem('token', data.token);
      } else {
        setError(data.message || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      console.error("Login fetch error:", err);
      setError('Unable to connect to the backend server. Please check your network.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUserRole(null);
    setUserData(null);
    setUsername('');
    setPassword('');
    // localStorage.removeItem('token');
  };

  if (!userRole) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
              <CalendarDays className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">EXAMNEX</h1>
            <p className="text-sm text-gray-500 mt-2">Automated Examination Management System</p>
          </div>
          
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center animate-in fade-in zoom-in duration-300">
              <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Login As</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { setLoginRole('student'); setError(''); }}
                  className={`py-2 px-3 text-sm font-medium rounded-lg border transition-colors ${loginRole === 'student' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginRole('faculty'); setError(''); }}
                  className={`py-2 px-3 text-sm font-medium rounded-lg border transition-colors ${loginRole === 'faculty' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  Faculty
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginRole('admin'); setError(''); }}
                  className={`py-2 px-3 text-sm font-medium rounded-lg border transition-colors ${loginRole === 'admin' ? 'bg-slate-800 border-slate-900 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  Admin
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {loginRole === 'student' ? 'Registration No.' : 'Username'}
              </label>
              <input 
                type="text" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                placeholder={loginRole === 'admin' ? "e.g., bmu_edu_in" : (loginRole === 'student' ? "e.g., 240C2070001" : "Enter your username")}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all pl-10"
                  placeholder="••••••••"
                />
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white p-3 rounded-lg transition-all duration-200 mt-2 font-semibold"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {loginRole === 'admin' && <ShieldCheck className="w-5 h-5" />}
                  {loginRole === 'faculty' && <Briefcase className="w-5 h-5" />}
                  {loginRole === 'student' && <GraduationCap className="w-5 h-5" />}
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <CalendarDays className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-bold text-gray-900 hidden sm:block">EXAMNEX</span>
              <span className="ml-2 sm:ml-4 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 uppercase tracking-wider">
                {userRole} Portal
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700 hidden sm:block">
                {userData?.name || userData?.username || 'Welcome'}
              </span>
              <button 
                onClick={handleLogout}
                className="flex items-center space-x-2 text-gray-500 hover:text-red-600 transition-colors px-3 py-2 rounded-md text-sm font-medium bg-gray-50 hover:bg-red-50 border border-transparent hover:border-red-100"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:block">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area Routing */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {userRole === 'admin' && <AdminDashboard />}
        {userRole === 'faculty' && <FacultyDashboard user={userData} />}
        {userRole === 'student' && <StudentDashboard user={userData} />}
      </main>
    </div>
  );
}

// ==========================================
// ADMIN DASHBOARD
// ==========================================
function AdminDashboard() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h2 className="text-2xl font-bold text-gray-900">Examination Control Center</h2>
        <p className="text-gray-500 text-sm mt-1">Manage schedules, rooms, and allocations globally.</p>
      </header>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={<BookOpen />} title="Total Exams" value="142" color="blue" />
        <StatCard icon={<Users />} title="Students Registered" value="3,240" color="emerald" />
        <StatCard icon={<MapPin />} title="Rooms Available" value="45" color="purple" />
        <StatCard icon={<AlertTriangle />} title="Unresolved Conflicts" value="2" color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Exam Schedule Generation Module */}
        <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Automated Scheduling Engine</h3>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
              Generate Draft Schedule
            </button>
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-gray-800">Current Period Setup</h4>
                  <p className="text-sm text-gray-500 mt-1">August 16 - August 21, 2026</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                  Draft Phase
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div className="bg-white p-3 rounded-md border border-gray-100 shadow-sm">
                  <span className="text-gray-500 block mb-1">Morning Shift:</span> 
                  <span className="font-semibold text-gray-900">10:00 AM</span>
                </div>
                <div className="bg-white p-3 rounded-md border border-gray-100 shadow-sm">
                  <span className="text-gray-500 block mb-1">Evening Shift:</span> 
                  <span className="font-semibold text-gray-900">02:00 PM</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-red-200 bg-red-50">
              <div className="flex items-center space-x-2 text-red-800 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="font-semibold">Detected Clashes (Requires Action)</h4>
              </div>
              <ul className="text-sm text-red-700 space-y-2 list-disc list-inside ml-2">
                <li>Student S001 has core (CSE301) and RE (CSE201R) mapped to same slot.</li>
                <li>Batch 2024 has 2 exams falling on Aug 18.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
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

// ==========================================
// FACULTY DASHBOARD
// ==========================================
function FacultyDashboard({ user }) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h2 className="text-2xl font-bold text-gray-900">Faculty Portal</h2>
        <p className="text-gray-500 text-sm mt-1">Welcome back, {user?.name || 'Faculty'}. View your invigilation duties below.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Duty List */}
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Upcoming Invigilation Duties</h3>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:border-blue-200 transition-colors">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-blue-700 font-bold text-lg">16</span>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-lg">CSE301: Data Structures</h4>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1 text-sm text-gray-500">
                  <span className="flex items-center"><CalendarDays className="w-4 h-4 mr-1.5"/> Aug 16, 2026</span>
                  <span className="flex items-center"><MapPin className="w-4 h-4 mr-1.5"/> Room A (Block 1)</span>
                </div>
              </div>
            </div>
            <div className="mt-4 sm:mt-0 text-left sm:text-right w-full sm:w-auto flex flex-row sm:flex-col items-center sm:items-end justify-between">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                Confirmed
              </span>
              <p className="text-sm font-medium text-gray-700 sm:text-xs sm:text-gray-500 sm:mt-1.5">10:00 AM - 01:00 PM</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:border-blue-200 transition-colors">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-gray-700 font-bold text-lg">18</span>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-lg">CSE401: AI/ML Elective</h4>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1 text-sm text-gray-500">
                  <span className="flex items-center"><CalendarDays className="w-4 h-4 mr-1.5"/> Aug 18, 2026</span>
                  <span className="flex items-center"><MapPin className="w-4 h-4 mr-1.5"/> Room D (Block 2)</span>
                </div>
              </div>
            </div>
            <div className="mt-4 sm:mt-0 text-left sm:text-right w-full sm:w-auto flex flex-row sm:flex-col items-center sm:items-end justify-between">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                Confirmed
              </span>
              <p className="text-sm font-medium text-gray-700 sm:text-xs sm:text-gray-500 sm:mt-1.5">02:00 PM - 05:00 PM</p>
            </div>
          </div>
        </div>

        {/* Leave Reporting */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-fit">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Availability & Leave</h3>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            If you have approved leave, report it here so the system can assign a same-designation replacement.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Date</label>
              <input type="date" className="w-full border-gray-300 rounded-lg shadow-sm p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none sm:text-sm transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason</label>
              <textarea rows={3} className="w-full border-gray-300 rounded-lg shadow-sm p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none sm:text-sm transition-all resize-none" placeholder="Enter reason for unavailability..."></textarea>
            </div>
            <button className="w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm">
              Submit Leave Request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// STUDENT DASHBOARD
// ==========================================
function StudentDashboard({ user }) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Student Portal</h2>
          <p className="text-gray-500 text-sm mt-1">Welcome, {user?.name || 'Student'} | {user?.stream || 'B.Tech'}</p>
        </div>
        <button className="flex items-center justify-center space-x-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm">
          <MapPin className="w-4 h-4" />
          <span>Download Admit Card (PDF)</span>
        </button>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-slate-50/50">
          <h3 className="text-lg font-semibold text-gray-900">My Examination Timetable</h3>
          <p className="text-sm text-gray-500 mt-1">Your personalized schedule with seating arrangements.</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white text-gray-600 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Course Code & Name</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Timing</th>
                <th className="px-6 py-4">Room & Seat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800 bg-white">
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">Aug 16, 2026</td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-900">CSE301</div>
                  <div className="text-gray-500 text-xs mt-0.5">Data Structures</div>
                </td>
                <td className="px-6 py-4"><span className="bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-md text-xs font-semibold">Core</span></td>
                <td className="px-6 py-4 text-gray-600 font-medium">10:00 AM - 01:00 PM</td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-900">Room A</div>
                  <div className="text-xs text-gray-500 mt-0.5">Seat: Col 2, R4</div>
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">Aug 17, 2026</td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-900">CSE201R</div>
                  <div className="text-gray-500 text-xs mt-0.5">Object Oriented Prog (RE)</div>
                </td>
                <td className="px-6 py-4"><span className="bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-md text-xs font-semibold">Re-Exam</span></td>
                <td className="px-6 py-4 text-gray-600 font-medium">02:00 PM - 05:00 PM</td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-900">Room C</div>
                  <div className="text-xs text-gray-500 mt-0.5">Seat: Col 1, R1</div>
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">Aug 19, 2026</td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-900">MAT201</div>
                  <div className="text-gray-500 text-xs mt-0.5">Linear Algebra</div>
                </td>
                <td className="px-6 py-4"><span className="bg-purple-50 border border-purple-200 text-purple-700 px-2.5 py-1 rounded-md text-xs font-semibold">Minor</span></td>
                <td className="px-6 py-4 text-gray-600 font-medium">10:00 AM - 01:00 PM</td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-900">Room B</div>
                  <div className="text-xs text-gray-500 mt-0.5">Seat: Col 4, R10</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// UTILITY COMPONENTS
// ==========================================
function StatCard({ icon, title, value, color }) {
  const colors = {
    blue: 'bg-blue-50/50 border-blue-100 text-blue-600',
    emerald: 'bg-emerald-50/50 border-emerald-100 text-emerald-600',
    purple: 'bg-purple-50/50 border-purple-100 text-purple-600',
    red: 'bg-red-50/50 border-red-100 text-red-600',
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4 hover:shadow-md transition-shadow">
      <div className={`p-3.5 rounded-xl border ${colors[color]}`}>
        {React.cloneElement(icon, { className: 'w-6 h-6' })}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function ActionLink({ icon, label }) {
  return (
    <button className="w-full flex items-center justify-between p-3.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 group transition-all text-left">
      <div className="flex items-center space-x-3 text-gray-700 group-hover:text-blue-700">
        {React.cloneElement(icon, { className: 'w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors' })}
        <span className="font-medium text-sm">{label}</span>
      </div>
      <span className="text-gray-300 group-hover:text-blue-500 transition-colors">→</span>
    </button>
  );
}