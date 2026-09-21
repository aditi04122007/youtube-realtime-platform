import React, { useState, useEffect } from 'react';
import { Clock, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  checkWatchLater,
  addToWatchLater,
  removeFromWatchLater,
} from '../../services/watchLaterService';

const WatchLaterButton = ({
  videoId,
  variant = 'pill', // 'pill' for Watch page action bar, 'icon' for hover on video cards
  className = '',
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [inWatchLater, setInWatchLater] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (user && videoId) {
      setChecking(true);
      checkWatchLater(videoId)
        .then((res) => {
          if (isMounted) setInWatchLater(Boolean(res.inWatchLater));
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setChecking(false);
        });
    } else {
      setInWatchLater(false);
    }
    return () => {
      isMounted = false;
    };
  }, [user, videoId]);

  const handleToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate('/login');
      return;
    }

    if (loading) return;

    setLoading(true);
    const previousState = inWatchLater;
    // Optimistic toggle
    setInWatchLater(!previousState);

    try {
      if (previousState) {
        await removeFromWatchLater(videoId);
      } else {
        await addToWatchLater(videoId);
      }
    } catch (err) {
      // Revert on failure
      setInWatchLater(previousState);
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        title={inWatchLater ? 'Remove from Watch Later' : 'Save to Watch Later'}
        className={`p-1.5 rounded-lg backdrop-blur-md transition-all shadow-md ${
          inWatchLater
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-black/60 text-white hover:bg-black/80 hover:text-indigo-400'
        } ${className}`}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : inWatchLater ? (
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
        ) : (
          <Clock className="w-3.5 h-3.5" />
        )}
      </button>
    );
  }

  // Default 'pill' variant for Watch page
  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 shadow-2xs ${
        inWatchLater
          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
      } ${className}`}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
      ) : inWatchLater ? (
        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
      ) : (
        <Clock className="w-3.5 h-3.5" />
      )}
      <span>{inWatchLater ? 'Saved for Later' : 'Watch Later'}</span>
    </button>
  );
};

export default WatchLaterButton;
