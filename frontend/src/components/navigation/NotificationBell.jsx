import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Video,
  MessageSquare,
  Heart,
  UserPlus,
  Crown,
  Sparkles,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { timeAgo } from '../../utils/timeAgo';

/**
 * Returns icon corresponding to notification type
 */
const getNotificationIcon = (type) => {
  switch (type) {
    case 'VIDEO_PUBLISHED':
      return <Video className="w-3.5 h-3.5 text-indigo-500" />;
    case 'NEW_SUBSCRIBER':
      return <UserPlus className="w-3.5 h-3.5 text-emerald-500" />;
    case 'COMMENT_ON_VIDEO':
    case 'REPLY_TO_COMMENT':
      return <MessageSquare className="w-3.5 h-3.5 text-cyan-500" />;
    case 'VIDEO_LIKED':
    case 'COMMENT_LIKED':
      return <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />;
    case 'SUBSCRIPTION_STARTED':
    case 'SUBSCRIPTION_CHANGED':
      return <Crown className="w-3.5 h-3.5 text-amber-500" />;
    default:
      return <Sparkles className="w-3.5 h-3.5 text-indigo-500" />;
  }
};

const NotificationBell = () => {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
    setIsOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    await deleteNotification(id);
  };

  const displayCount = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        aria-expanded={isOpen}
        className="relative p-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
      >
        <Bell className="w-5 h-5" />

        {unreadCount > 0 && (
          <span
            data-testid="unread-badge"
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md animate-pulse"
          >
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-sm sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-cyan-400">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-600 dark:text-cyan-400 hover:text-indigo-700 dark:hover:text-cyan-300 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-400">
                  <Bell className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Your inbox is empty
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Subscribe to channels and join conversations to receive real-time updates.
                </p>
              </div>
            ) : (
              notifications.slice(0, 8).map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`group relative flex items-start space-x-3 p-3.5 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                    !notif.isRead
                      ? 'bg-indigo-50/40 dark:bg-indigo-950/20'
                      : 'bg-transparent'
                  }`}
                >
                  {/* Left Icon / Avatar */}
                  <div className="relative flex-shrink-0">
                    {notif.actor?.avatarUrl ? (
                      <img
                        src={notif.actor.avatarUrl}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700"
                      />
                    ) : notif.video?.thumbnailUrl ? (
                      <img
                        src={notif.video.thumbnailUrl}
                        alt=""
                        className="w-12 h-8 rounded-md object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-slate-800 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-indigo-600 dark:text-cyan-400" />
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-xs border border-slate-200 dark:border-slate-800">
                      {getNotificationIcon(notif.type)}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-1">
                      {notif.title}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
                      {timeAgo(notif.createdAt)}
                    </p>
                  </div>

                  {/* Right Status Dot & Delete Action */}
                  <div className="absolute right-3 top-3.5 flex flex-col items-center space-y-1">
                    {!notif.isRead && (
                      <span
                        title="Unread"
                        className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-cyan-400"
                      />
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, notif.id)}
                      title="Delete notification"
                      className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded-md transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 text-center bg-slate-50/50 dark:bg-slate-900/50">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center space-x-1 text-xs font-bold text-indigo-600 dark:text-cyan-400 hover:underline"
            >
              <span>View all notifications</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
