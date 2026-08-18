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
  CheckCircle
} from 'lucide-react';

export default function App() {
  // State to manage the current logged-in user role
  const [userRole, setUserRole] = useState(null); // 'admin', 'faculty', 'student', or null

  // Mock Login Handler
  const handleLogin = (role) => {
    setUserRole(role);
  };

  // Logout Handler
  const handleLogout = () => {
    setUserRole(null);
  };

  // Render Login Screen if no user is logged in
  if (!userRole) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
              <CalendarDays className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">EXAMNEX</h1>
            <p className="text-sm text-gray-500 mt-2">Automated Examination Management System</p>
          </div>
          
          <div className="space-y-4 pt-4">
            <button 
              onClick={() => handleLogin('admin')}
              className="w-full flex items-center justify-center space-x-3 bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-xl transition-all duration-200"
            >
              <ShieldCheck className="w-5 h-5" />
              <span className="font-semibold">Sign in as Administrator</span>
            </button>
            
            <button 
              onClick={() => handleLogin('faculty')}
              className="w-full flex items-center justify-center space-x-3 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl transition-all duration-200"
            >
              <Briefcase className="w-5 h-5" />
              <span className="font-semibold">Sign in as Faculty</span>
            </button>

            <button 
              onClick={() => handleLogin('student')}
              className="w-full flex items-center justify-center space-x-3 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl transition-all duration-200"
            >
              <GraduationCap className="w-5 h-5" />
              <span className="font-semibold">Sign in as Student</span>
            </button>
          </div>
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
              <span className="text-xl font-bold text-gray-900">EXAMNEX</span>
              <span className="ml-4 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 uppercase tracking-wider">
                {userRole} Portal
              </span>
            </div>
            <div className="flex items-center">
              <button 
                onClick={handleLogout}
                className="flex items-center space-x-2 text-gray-500 hover:text-red-600 transition-colors px-3 py-2 rounded-md text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {userRole === 'admin' && <AdminDashboard />}
        {userRole === 'faculty' && <FacultyDashboard />}
        {userRole === 'student' && <StudentDashboard />}
      </main>
    </div>
  );
}

// ==========================================
// ADMIN DASHBOARD
// ==========================================
function AdminDashboard() {
  return (
    <div className="space-y-6">
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
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Generate Draft Schedule
            </button>
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-gray-800">Current Period Setup</h4>
                  <p className="text-sm text-gray-500 mt-1">August 16 - August 21, 2026</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Draft Phase
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Morning Shift:</span> <span className="font-medium">10:00 AM</span>
                </div>
                <div>
                  <span className="text-gray-500">Evening Shift:</span> <span className="font-medium">02:00 PM</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-red-100 bg-red-50">
              <div className="flex items-center space-x-2 text-red-800 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="font-semibold">Detected Clashes (Requires Action)</h4>
              </div>
              <ul className="text-sm text-red-700 space-y-2 list-disc list-inside">
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
function FacultyDashboard() {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-gray-900">Faculty Portal</h2>
        <p className="text-gray-500 text-sm mt-1">Welcome back, Dr. Smith. View your invigilation duties below.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Duty List */}
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Upcoming Invigilation Duties</h3>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-blue-700 font-bold">16</span>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-lg">CSE301: Data Structures</h4>
                <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                  <span className="flex items-center"><CalendarDays className="w-4 h-4 mr-1"/> Aug 16, 2026</span>
                  <span className="flex items-center"><MapPin className="w-4 h-4 mr-1"/> Room A (Block 1)</span>
                </div>
              </div>
            </div>
            <div className="mt-4 sm:mt-0 text-right">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
                Confirmed
              </span>
              <p className="text-xs text-gray-500 mt-1">10:00 AM - 01:00 PM</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-gray-700 font-bold">18</span>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-lg">CSE401: AI/ML Elective</h4>
                <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                  <span className="flex items-center"><CalendarDays className="w-4 h-4 mr-1"/> Aug 18, 2026</span>
                  <span className="flex items-center"><MapPin className="w-4 h-4 mr-1"/> Room D (Block 2)</span>
                </div>
              </div>
            </div>
            <div className="mt-4 sm:mt-0 text-right">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
                Confirmed
              </span>
              <p className="text-xs text-gray-500 mt-1">02:00 PM - 05:00 PM</p>
            </div>
          </div>
        </div>

        {/* Leave Reporting */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-fit">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Availability & Leave</h3>
          <p className="text-sm text-gray-600 mb-4">
            If you have approved leave, report it here so the system can assign a same-designation replacement.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
              <input type="date" className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea rows={3} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Enter reason for unavailability..."></textarea>
            </div>
            <button className="w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
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
function StudentDashboard() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Student Portal</h2>
          <p className="text-gray-500 text-sm mt-1">Roll No: S001 | B.Tech CSE (Batch 2024)</p>
        </div>
        <button className="mt-4 sm:mt-0 flex items-center space-x-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
          <MapPin className="w-4 h-4" />
          <span>Download Admit Card (PDF)</span>
        </button>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-slate-50">
          <h3 className="text-lg font-semibold text-gray-900">My Examination Timetable</h3>
          <p className="text-sm text-gray-500 mt-1">Your personalized schedule with seating arrangements.</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Course Code & Name</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Timing</th>
                <th className="px-6 py-4">Room & Seat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-800">
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">Aug 16, 2026</td>
                <td className="px-6 py-4">
                  <div className="font-semibold">CSE301</div>
                  <div className="text-gray-500 text-xs">Data Structures</div>
                </td>
                <td className="px-6 py-4"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">Core</span></td>
                <td className="px-6 py-4">10:00 AM - 01:00 PM</td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-blue-700">Room A</div>
                  <div className="text-xs text-gray-500">Seat: Col 2, R4</div>
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">Aug 17, 2026</td>
                <td className="px-6 py-4">
                  <div className="font-semibold">CSE201R</div>
                  <div className="text-gray-500 text-xs">Object Oriented Prog (RE)</div>
                </td>
                <td className="px-6 py-4"><span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">Re-Exam</span></td>
                <td className="px-6 py-4">02:00 PM - 05:00 PM</td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-blue-700">Room C</div>
                  <div className="text-xs text-gray-500">Seat: Col 1, R1</div>
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">Aug 19, 2026</td>
                <td className="px-6 py-4">
                  <div className="font-semibold">MAT201</div>
                  <div className="text-gray-500 text-xs">Linear Algebra</div>
                </td>
                <td className="px-6 py-4"><span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">Minor</span></td>
                <td className="px-6 py-4">10:00 AM - 01:00 PM</td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-blue-700">Room B</div>
                  <div className="text-xs text-gray-500">Seat: Col 4, R10</div>
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
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
      <div className={`p-3 rounded-lg ${colors[color]}`}>
        {React.cloneElement(icon, { className: 'w-6 h-6' })}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function ActionLink({ icon, label }) {
  return (
    <button className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 group transition-all text-left">
      <div className="flex items-center space-x-3 text-gray-700 group-hover:text-blue-700">
        {React.cloneElement(icon, { className: 'w-5 h-5' })}
        <span className="font-medium text-sm">{label}</span>
      </div>
      <span className="text-gray-400 group-hover:text-blue-500">→</span>
    </button>
  );
}