import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Check,
  Trash2,
  Video,
  MessageSquare,
  Heart,
  UserPlus,
  Crown,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { timeAgo } from '../utils/timeAgo';
import Button from '../components/common/Button';
import Card from '../components/common/Card';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'VIDEO_PUBLISHED':
      return <Video className="w-4 h-4 text-indigo-500" />;
    case 'NEW_SUBSCRIBER':
      return <UserPlus className="w-4 h-4 text-emerald-500" />;
    case 'COMMENT_ON_VIDEO':
    case 'REPLY_TO_COMMENT':
      return <MessageSquare className="w-4 h-4 text-cyan-500" />;
    case 'VIDEO_LIKED':
    case 'COMMENT_LIKED':
      return <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />;
    case 'SUBSCRIPTION_STARTED':
    case 'SUBSCRIPTION_CHANGED':
      return <Crown className="w-4 h-4 text-amber-500" />;
    default:
      return <Sparkles className="w-4 h-4 text-indigo-500" />;
  }
};

const Notifications = () => {
  const {
    notifications,
    unreadCount,
    isLoading,
    pagination,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const [filterUnread, setFilterUnread] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications({ page: currentPage, limit: 15, unreadOnly: filterUnread });
  }, [loadNotifications, currentPage, filterUnread]);

  const handleTabChange = (unreadOnly) => {
    setFilterUnread(unreadOnly);
    setCurrentPage(1);
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const handleDelete = async (e, notifId) => {
    e.stopPropagation();
    await deleteNotification(notifId);
  };

  const handleMarkRead = async (e, notifId) => {
    e.stopPropagation();
    await markAsRead(notifId);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-cyan-400">
              <Bell className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white shadow-xs">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 pl-1">
            Stay updated with subscribers, comments, likes, and channel activity.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              leftIcon={<CheckCheck className="w-4 h-4 text-indigo-500" />}
            >
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => handleTabChange(false)}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
            !filterUnread
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => handleTabChange(true)}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
            filterUnread
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Notifications List */}
      {isLoading && notifications.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="p-12 text-center space-y-4 bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Bell className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {filterUnread ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {filterUnread
                ? 'You have caught up with all your updates. Check back later!'
                : 'Activity such as new subscribers, comments on your videos, and likes will appear here.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`group flex items-start justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                !notif.isRead
                  ? 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900/60 shadow-sm'
                  : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800/60 hover:bg-white dark:hover:bg-slate-900'
              }`}
            >
              {/* Left Side: Avatar + Badge + Text */}
              <div className="flex items-start space-x-3.5 min-w-0 pr-4">
                {/* Avatar with type badge */}
                <div className="relative flex-shrink-0">
                  {notif.actor?.avatarUrl ? (
                    <img
                      src={notif.actor.avatarUrl}
                      alt=""
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700"
                    />
                  ) : notif.video?.thumbnailUrl ? (
                    <img
                      src={notif.video.thumbnailUrl}
                      alt=""
                      className="w-14 h-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-slate-800 flex items-center justify-center">
                      <Bell className="w-5 h-5 text-indigo-600 dark:text-cyan-400" />
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-xs border border-slate-200 dark:border-slate-800">
                    {getNotificationIcon(notif.type)}
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {notif.title}
                    </h4>
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-cyan-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {notif.message}
                  </p>
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                    {timeAgo(notif.createdAt)}
                  </span>
                </div>
              </div>

              {/* Right Side Actions */}
              <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                {!notif.isRead && (
                  <button
                    type="button"
                    onClick={(e) => handleMarkRead(e, notif.id)}
                    title="Mark as read"
                    className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-cyan-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, notif.id)}
                  title="Delete notification"
                  className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors opacity-80 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing page <span className="font-bold text-slate-700 dark:text-slate-200">{pagination.page}</span> of{' '}
            <span className="font-bold text-slate-700 dark:text-slate-200">{pagination.totalPages}</span>
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= pagination.totalPages || isLoading}
              onClick={() => setCurrentPage((p) => p + 1)}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
