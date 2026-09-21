import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ThumbsUp, ThumbsDown, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getVideoReaction, setVideoReaction } from '../services/videoService';
import { formatNumber } from '../utils/formatNumber';
import Modal from './common/Modal';
import Button from './common/Button';

const VideoReactions = ({
  videoId,
  initialLikeCount = 0,
  initialDislikeCount = 0,
  className = '',
}) => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [reaction, setReaction] = useState(null); // 'LIKE' | 'DISLIKE' | null
  const [likeCount, setLikeCount] = useState(Number(initialLikeCount) || 0);
  const [dislikeCount, setDislikeCount] = useState(Number(initialDislikeCount) || 0);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [guestPromptAction, setGuestPromptAction] = useState('like');
  const [errorMessage, setErrorMessage] = useState('');

  // Keep counts updated if initial props change
  useEffect(() => {
    setLikeCount(Number(initialLikeCount) || 0);
    setDislikeCount(Number(initialDislikeCount) || 0);
  }, [initialLikeCount, initialDislikeCount]);

  // Fetch authenticated user's reaction on mount / auth change
  useEffect(() => {
    let isMounted = true;

    if (isAuthenticated && user && videoId) {
      setLoading(true);
      getVideoReaction(videoId)
        .then((res) => {
          if (isMounted && res && res.success) {
            setReaction(res.reaction || null);
            if (typeof res.likeCount === 'number') setLikeCount(res.likeCount);
            if (typeof res.dislikeCount === 'number') setDislikeCount(res.dislikeCount);
          }
        })
        .catch((err) => {
          console.warn('[VideoReactions] Failed to fetch user reaction:', err);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      setReaction(null);
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [videoId, isAuthenticated, user]);

  // Handle reaction action (LIKE or DISLIKE)
  const handleReactionClick = async (targetReaction) => {
    // 1. Guest protection: show login modal
    if (!isAuthenticated || !user) {
      setGuestPromptAction(targetReaction === 'LIKE' ? 'like' : 'dislike');
      setShowLoginModal(true);
      return;
    }

    // 2. Prevent rapid double-clicks
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');

    // 3. Snapshot previous state for rollback
    const prevReaction = reaction;
    const prevLikes = likeCount;
    const prevDislikes = dislikeCount;

    // 4. Optimistic update
    if (prevReaction === targetReaction) {
      // Toggle OFF
      setReaction(null);
      if (targetReaction === 'LIKE') {
        setLikeCount((prev) => Math.max(0, prev - 1));
      } else {
        setDislikeCount((prev) => Math.max(0, prev - 1));
      }
    } else if (prevReaction === null) {
      // New reaction
      setReaction(targetReaction);
      if (targetReaction === 'LIKE') {
        setLikeCount((prev) => prev + 1);
      } else {
        setDislikeCount((prev) => prev + 1);
      }
    } else {
      // Switch reaction (e.g. LIKE -> DISLIKE or DISLIKE -> LIKE)
      setReaction(targetReaction);
      if (targetReaction === 'LIKE') {
        setLikeCount((prev) => prev + 1);
        setDislikeCount((prev) => Math.max(0, prev - 1));
      } else {
        setDislikeCount((prev) => prev + 1);
        setLikeCount((prev) => Math.max(0, prev - 1));
      }
    }

    // 5. Server request
    try {
      const res = await setVideoReaction(videoId, targetReaction);
      if (res && res.success) {
        setReaction(res.reaction);
        setLikeCount(Number(res.likeCount) || 0);
        setDislikeCount(Number(res.dislikeCount) || 0);
      } else {
        throw new Error(res?.message || 'Failed to update reaction');
      }
    } catch (err) {
      console.error('[VideoReactions] Reaction mutation failed:', err);
      // Rollback to previous state
      setReaction(prevReaction);
      setLikeCount(prevLikes);
      setDislikeCount(prevDislikes);
      setErrorMessage(err.message || 'Unable to update reaction. Please try again.');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLiked = reaction === 'LIKE';
  const isDisliked = reaction === 'DISLIKE';

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* Grouped YouTube-style pill button */}
      <div className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800/80 p-0.5 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold select-none shadow-sm">
        {/* Like Button */}
        <button
          type="button"
          onClick={() => handleReactionClick('LIKE')}
          disabled={loading || isSubmitting}
          aria-label={isLiked ? 'You liked this video' : 'Like this video'}
          aria-pressed={isLiked}
          className={`px-3 sm:px-3.5 py-1.5 rounded-l-full inline-flex items-center space-x-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 active:scale-95 ${
            isLiked
              ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-cyan-400 font-bold'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/60'
          }`}
        >
          <ThumbsUp
            className={`w-4 h-4 transition-transform ${
              isLiked ? 'fill-current scale-110' : ''
            }`}
          />
          <span>{formatNumber(likeCount)}</span>
        </button>

        {/* Vertical Divider */}
        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

        {/* Dislike Button */}
        <button
          type="button"
          onClick={() => handleReactionClick('DISLIKE')}
          disabled={loading || isSubmitting}
          aria-label={isDisliked ? 'You disliked this video' : 'Dislike this video'}
          aria-pressed={isDisliked}
          className={`px-3 sm:px-3.5 py-1.5 rounded-r-full inline-flex items-center space-x-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 active:scale-95 ${
            isDisliked
              ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-cyan-400 font-bold'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/60'
          }`}
        >
          <ThumbsDown
            className={`w-4 h-4 transition-transform ${
              isDisliked ? 'fill-current scale-110' : ''
            }`}
          />
          {dislikeCount > 0 && <span>{formatNumber(dislikeCount)}</span>}
        </button>
      </div>

      {/* Ephemeral Error Banner */}
      {errorMessage && (
        <div className="absolute top-full left-0 mt-2 z-30 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-[11px] font-medium shadow-lg flex items-center space-x-1.5 whitespace-nowrap animate-fade-in">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Guest Login Required Modal */}
      <Modal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Sign in to react"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-cyan-400 flex items-center justify-center">
            <LogIn className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Want to {guestPromptAction} this video?
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Sign in to make your opinion count and keep track of videos you react to.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLoginModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setShowLoginModal(false);
                navigate('/login', { state: { from: location } });
              }}
              icon={<LogIn className="w-3.5 h-3.5" />}
            >
              Sign In
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default VideoReactions;
