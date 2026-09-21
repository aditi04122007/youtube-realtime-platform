import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Compass,
  Tv,
  History,
  Clock,
  FolderHeart,
  Settings,
  Shield,
  ShieldCheck,
  PlusCircle,
  Video,
  Crown,
  Download,
  Bell,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { getCurrentUserChannel } from '../../services/api';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, isAuthenticated } = useAuth();
  const { unreadCount } = useNotifications();
  const [userChannel, setUserChannel] = useState(null);

  const handleNavClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && onClose) {
      onClose();
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated) {
      getCurrentUserChannel()
        .then((res) => {
          if (isMounted && res.data?.success && res.data?.data) {
            setUserChannel(res.data.data);
          }
        })
        .catch(() => {
          if (isMounted) setUserChannel(null);
        });
    } else {
      setUserChannel(null);
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.id]);

  // Section 1: Main navigation
  const mainItems = [
    { name: 'Home', icon: Home, path: '/' },
    { name: 'Explore', icon: Compass, path: '/explore' },
    { name: 'Subscriptions', icon: Tv, path: '/subscriptions' },
    ...(isAuthenticated ? [{ name: 'Notifications', icon: Bell, path: '/notifications', badge: unreadCount }] : []),
    { name: 'History', icon: History, path: '/history' },
    { name: 'Downloads', icon: Download, path: '/download-history' },
    ...(isAuthenticated ? [{ name: 'Call History', icon: Video, path: '/call-history' }] : []),
    { name: 'Watch Later', icon: Clock, path: '/watch-later' },
    { name: 'Playlists', icon: FolderHeart, path: '/playlists' },
  ];

  // Section 2: Creator channel links
  const channelPath = isAuthenticated
    ? userChannel
      ? `/channel/${userChannel.handle || userChannel.id}`
      : '/channel/create'
    : '/login';

  const channelLabel = userChannel ? userChannel.channel_name : 'My Channel';

  // Section 3: Settings & Security
  const systemItems = [
    { name: 'Settings', icon: Settings, path: '/settings' },
    { name: 'Security', icon: Shield, path: '/settings/security' },
  ];

  const isAdmin = user?.role === 'ADMIN';

  return (
    <aside
      aria-label="Main navigation sidebar"
      className={`fixed lg:sticky top-0 lg:top-16 left-0 z-40 lg:z-30 h-full lg:h-[calc(100vh-4rem)] bg-white dark:bg-[#0a0e17] border-r border-slate-200 dark:border-slate-800/80 transition-all duration-200 overflow-y-auto px-2 select-none shadow-2xl lg:shadow-none ${
        isOpen
          ? 'w-64 max-w-[80vw] lg:w-60 translate-x-0'
          : 'w-20 -translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Mobile Drawer Header with Close Button (Requirements 5, 6, 7) */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-slate-200 dark:border-slate-800 lg:hidden">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center text-white">
            <svg className="w-4 h-4 ml-0.5 fill-current" viewBox="0 0 24 24">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <span className="font-extrabold text-sm text-slate-900 dark:text-white">StreamWave</span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close navigation"
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="pt-3 pb-8 space-y-4">
        {/* Section 1: Core Browsing */}
        <div className="space-y-1">
          <ul className="space-y-1">
            {mainItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      `flex items-center rounded-xl transition-all duration-150 ${
                        isOpen
                          ? 'px-3 py-2.5 space-x-3 text-sm'
                          : 'flex-col justify-center py-2.5 px-1 text-[10px]'
                      } ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-cyan-400 font-bold border-l-2 border-indigo-600 dark:border-cyan-400'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`
                    }
                  >
                    <div className="relative flex-shrink-0">
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {!isOpen && item.badge > 0 && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-600" />
                      )}
                    </div>
                    <span className={`truncate ${!isOpen && 'mt-1 text-center font-medium'}`}>
                      {item.name}
                    </span>
                    {isOpen && item.badge > 0 && (
                      <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white shadow-xs">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>

        <hr className="border-slate-200 dark:border-slate-800" />

        {/* Section 2: Creator Channels & Studio */}
        <div className="space-y-1">
          {isOpen && (
            <h4 className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Creator Studio
            </h4>
          )}
          <ul className="space-y-1">
            <li>
              <NavLink
                to={channelPath}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `flex items-center rounded-xl transition-all duration-150 ${
                    isOpen
                      ? 'px-3 py-2.5 space-x-3 text-sm'
                      : 'flex-col justify-center py-2.5 px-1 text-[10px]'
                  } ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-cyan-400 font-bold border-l-2 border-indigo-600 dark:border-cyan-400'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`
                }
              >
                {userChannel ? (
                  <Tv className="w-5 h-5 flex-shrink-0 text-indigo-500" />
                ) : (
                  <PlusCircle className="w-5 h-5 flex-shrink-0 text-indigo-500" />
                )}
                <span className={`truncate ${!isOpen && 'mt-1 text-center font-medium'}`}>
                  {channelLabel}
                </span>
              </NavLink>
            </li>

            {isAuthenticated && (
              <>
                <li>
                  <NavLink
                    to="/my-videos"
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      `flex items-center rounded-xl transition-all duration-150 ${
                        isOpen
                          ? 'px-3 py-2.5 space-x-3 text-sm'
                          : 'flex-col justify-center py-2.5 px-1 text-[10px]'
                      } ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-cyan-400 font-bold border-l-2 border-indigo-600 dark:border-cyan-400'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`
                    }
                  >
                    <Video className="w-5 h-5 flex-shrink-0 text-indigo-500" />
                    <span className={`truncate ${!isOpen && 'mt-1 text-center font-medium'}`}>
                      My Videos
                    </span>
                  </NavLink>
                </li>

                <li>
                  <NavLink
                    to="/subscription-dashboard"
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      `flex items-center rounded-xl transition-all duration-150 ${
                        isOpen
                          ? 'px-3 py-2.5 space-x-3 text-sm'
                          : 'flex-col justify-center py-2.5 px-1 text-[10px]'
                      } ${
                        isActive
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-bold border-l-2 border-amber-500 dark:border-amber-400'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`
                    }
                  >
                    <Crown className="w-5 h-5 flex-shrink-0 text-amber-500" />
                    <span className={`truncate ${!isOpen && 'mt-1 text-center font-medium'}`}>
                      My Subscription
                    </span>
                  </NavLink>
                </li>
              </>
            )}
          </ul>
        </div>

        <hr className="border-slate-200 dark:border-slate-800" />

        {/* Section 3: Settings & Security */}
        <div className="space-y-1">
          {isOpen && (
            <h4 className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              System
            </h4>
          )}
          <ul className="space-y-1">
            {systemItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <NavLink
                    to={item.path}
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      `flex items-center rounded-xl transition-all duration-150 ${
                        isOpen
                          ? 'px-3 py-2.5 space-x-3 text-sm'
                          : 'flex-col justify-center py-2.5 px-1 text-[10px]'
                      } ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-cyan-400 font-bold border-l-2 border-indigo-600 dark:border-cyan-400'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className={`truncate ${!isOpen && 'mt-1 text-center font-medium'}`}>
                      {item.name}
                    </span>
                  </NavLink>
                </li>
              );
            })}

            {/* Admin Dashboard: STRICTLY GATED BY role === 'ADMIN' */}
            {isAdmin && (
              <li>
                <NavLink
                  to="/admin"
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    `flex items-center rounded-xl transition-all duration-150 ${
                      isOpen
                        ? 'px-3 py-2.5 space-x-3 text-sm'
                        : 'flex-col justify-center py-2.5 px-1 text-[10px]'
                    } ${
                      isActive
                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-bold border-l-2 border-amber-600 dark:border-amber-400'
                        : 'text-amber-600/90 dark:text-amber-400/90 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                    }`
                  }
                >
                  <ShieldCheck className="w-5 h-5 flex-shrink-0 text-amber-500" />
                  <span className={`truncate ${!isOpen && 'mt-1 text-center font-medium'}`}>
                    Admin Dashboard
                  </span>
                </NavLink>
              </li>
            )}
          </ul>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
