import React, { useState } from 'react';
import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  Tv,
  Film,
  MessageSquare,
  Flag,
  Crown,
  CreditCard,
  Download,
  Video,
  History,
  Settings,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Bell,
} from 'lucide-react';

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on Escape key press
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Overview', path: '/admin', icon: LayoutDashboard, exact: true },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Channels', path: '/admin/channels', icon: Tv },
    { name: 'Videos', path: '/admin/videos', icon: Film },
    { name: 'Comments', path: '/admin/comments', icon: MessageSquare },
    { name: 'Reports', path: '/admin/reports', icon: Flag },
    { name: 'Subscriptions', path: '/admin/subscriptions', icon: Crown },
    { name: 'Payments', path: '/admin/payments', icon: CreditCard },
    { name: 'Downloads', path: '/admin/downloads', icon: Download },
    { name: 'Video Calls', path: '/admin/calls', icon: Video },
    { name: 'Activity Log', path: '/admin/activity', icon: History },
    { name: 'System Info', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* 1. ADMIN HEADER */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 h-16 flex items-center justify-between px-4 sm:px-6">
        {/* Left: Brand & Mobile Toggle */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link to="/admin" className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
                  StreamWave
                </span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Admin Console
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">Platform Operations & Moderation</p>
            </div>
          </Link>
        </div>

        {/* Right: Quick actions, Theme, Profile */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Back to Platform */}
          <Link
            to="/"
            className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Main Site</span>
          </Link>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Notifications shortcut */}
          <Link
            to="/notifications"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
          </Link>

          {/* Admin Profile Pill */}
          <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
              {user?.username?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                {user?.username || 'Admin'}
              </div>
              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                Administrator
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. BODY CONTAINER: SIDEBAR + CONTENT */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Collapsible Sidebar */}
        <aside
          className={`hidden md:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 select-none ${
            sidebarCollapsed ? 'w-20' : 'w-64'
          }`}
        >
          {/* Nav links */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.exact}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                    } ${sidebarCollapsed ? 'justify-center space-x-0' : ''}`
                  }
                  title={sidebarCollapsed ? item.name : undefined}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!sidebarCollapsed && <span>{item.name}</span>}
                </NavLink>
              );
            })}
          </nav>

          {/* Collapse Button */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-xs"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <div className="flex items-center space-x-2">
                  <ChevronLeft className="w-4 h-4" />
                  <span className="font-medium">Collapse Menu</span>
                </div>
              )}
            </button>
          </div>
        </aside>

        {/* Mobile Drawer Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-64 max-w-[80vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full z-10 animate-slide-in">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <span className="font-bold text-sm text-slate-900 dark:text-white">Admin Menu</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.exact}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.name}</span>
                    </NavLink>
                  );
                })}
              </nav>

              <div className="p-3 border-t border-slate-200 dark:border-slate-800">
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center space-x-2 p-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Return to Main Site</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 min-w-0 max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
