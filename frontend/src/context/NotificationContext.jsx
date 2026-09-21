import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification as apiDeleteNotification,
} from '../services/notificationService';

const NotificationContext = createContext(null);

/**
 * Play a subtle Web Audio chime for incoming notifications without external audio files
 */
const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Silently ignore audio context failures
  }
};

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 1,
    hasMore: false,
  });
  const [toastNotification, setToastNotification] = useState(null);

  // Refresh unread count from API
  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetchUnreadCount();
      if (res && typeof res.unreadCount === 'number') {
        setUnreadCount(res.unreadCount);
      }
    } catch (err) {
      // Silently handle error
    }
  }, [isAuthenticated]);

  // Load paginated notifications
  const loadNotifications = useCallback(
    async ({ page = 1, limit = 20, unreadOnly = false, append = false } = {}) => {
      if (!isAuthenticated) return;
      setIsLoading(true);
      try {
        const res = await fetchNotifications({ page, limit, unreadOnly });
        if (res?.success) {
          setNotifications((prev) => (append ? [...prev, ...res.data] : res.data));
          setPagination(res.pagination || { page, limit, totalCount: res.data.length, totalPages: 1, hasMore: false });
          if (typeof res.unreadCount === 'number') {
            setUnreadCount(res.unreadCount);
          }
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated]
  );

  // Mark single notification as read
  const markAsRead = useCallback(async (id) => {
    try {
      const res = await markNotificationAsRead(id);
      if (res?.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
        );
        if (typeof res.data?.unreadCount === 'number') {
          setUnreadCount(res.data.unreadCount);
        } else {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const res = await markAllNotificationsAsRead();
      if (res?.success) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, []);

  // Delete a notification
  const deleteNotification = useCallback(async (id) => {
    try {
      const res = await apiDeleteNotification(id);
      if (res?.success) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (typeof res.unreadCount === 'number') {
          setUnreadCount(res.unreadCount);
        }
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  }, []);

  // Dismiss popup toast
  const dismissToast = useCallback(() => {
    setToastNotification(null);
  }, []);

  // Socket connection and real-time listener setup
  useEffect(() => {
    if (!isAuthenticated || !user) {
      disconnectSocket();
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    // Connect socket
    const socket = connectSocket(user.token);

    // Initial fetch of unread count and recent notifications
    refreshUnreadCount();
    loadNotifications({ page: 1, limit: 15 });

    // Handle new incoming real-time notification
    const handleNewNotification = (notification) => {
      console.log('[NotificationContext] Received real-time notification:', notification);
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Trigger visual toast
      setToastNotification(notification);

      // Play soft audio ping
      playNotificationSound();
    };

    // Handle real-time count synchronization
    const handleCountUpdate = ({ unreadCount: count }) => {
      if (typeof count === 'number') {
        setUnreadCount(count);
      }
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('notification:count', handleCountUpdate);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:count', handleCountUpdate);
    };
  }, [isAuthenticated, user?.id, refreshUnreadCount, loadNotifications]);

  // Auto-dismiss toast notification after 5 seconds
  useEffect(() => {
    if (!toastNotification) return;
    const timer = setTimeout(() => {
      setToastNotification(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toastNotification]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        pagination,
        toastNotification,
        loadNotifications,
        refreshUnreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        dismissToast,
      }}
    >
      {children}

      {/* Global In-App Notification Toast */}
      {toastNotification && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white dark:bg-slate-900 border border-indigo-500/30 dark:border-indigo-500/40 rounded-2xl shadow-2xl p-4 flex items-start space-x-3.5 animate-bounce-short transition-all"
        >
          {toastNotification.actor?.avatarUrl ? (
            <img
              src={toastNotification.actor.avatarUrl}
              alt=""
              className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2 ring-indigo-500/30"
            />
          ) : toastNotification.video?.thumbnailUrl ? (
            <img
              src={toastNotification.video.thumbnailUrl}
              alt=""
              className="w-12 h-8 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-indigo-600/10 text-indigo-600 dark:text-cyan-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
              🔔
            </div>
          )}

          <div className="flex-1 min-w-0 pr-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {toastNotification.title}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">
              {toastNotification.message}
            </p>
          </div>

          <button
            type="button"
            onClick={dismissToast}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm p-1 rounded-lg"
            aria-label="Close notification toast"
          >
            ✕
          </button>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
