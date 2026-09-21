import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Compass, Tv, FolderHeart, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const MobileNav = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // Hide mobile bottom nav during active full-screen video calls to avoid overlapping call controls
  const isCallRoute =
    location.pathname.startsWith('/call/') ||
    location.pathname.startsWith('/room/');

  if (isCallRoute) {
    return null;
  }

  const navItems = [
    { name: 'Home', icon: Home, path: '/' },
    { name: 'Explore', icon: Compass, path: '/explore' },
    { name: 'Subscriptions', icon: Tv, path: '/subscriptions' },
    { name: 'Library', icon: FolderHeart, path: '/playlists' },
    {
      name: 'Profile',
      icon: User,
      path: isAuthenticated ? '/profile' : '/login',
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom,0px)] bg-white/95 dark:bg-[#0a0e17]/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800/90 px-2 flex items-center justify-around shadow-lg select-none"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1.5 px-3 min-h-[48px] min-w-[48px] rounded-2xl transition-all duration-150 ${
                isActive
                  ? 'text-indigo-600 dark:text-cyan-400 font-bold scale-105'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium tracking-tight">
              {item.name}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default MobileNav;
