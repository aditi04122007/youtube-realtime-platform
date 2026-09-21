import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Tv, PlusCircle, FolderHeart, User } from 'lucide-react';

const BottomNav = () => {
  const navItems = [
    { name: 'Home', icon: Home, path: '/' },
    { name: 'Subscriptions', icon: Tv, path: '/subscriptions' },
    { name: 'Upload', icon: PlusCircle, path: '/upload', isAction: true },
    { name: 'Playlists', icon: FolderHeart, path: '/playlists' },
    { name: 'Profile', icon: User, path: '/login' },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-[#0a0e17]/95 backdrop-blur border-t border-slate-200 dark:border-slate-800/80 px-2 flex items-center justify-around"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        if (item.isAction) {
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className="flex flex-col items-center justify-center -mt-5"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                {item.name}
              </span>
            </NavLink>
          );
        }

        return (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors ${
                isActive
                  ? 'text-indigo-600 dark:text-cyan-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] mt-1">{item.name}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default BottomNav;
