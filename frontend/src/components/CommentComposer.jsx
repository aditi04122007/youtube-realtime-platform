import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMediaUrl } from '../services/api';
import Modal from './common/Modal';
import Button from './common/Button';
import { LogIn } from 'lucide-react';

const MAX_COMMENT_LENGTH = 5000;

const CommentComposer = ({
  onSubmit,
  onCancel,
  placeholder = 'Add a comment...',
  submitText = 'Comment',
  initialContent = '',
  autoFocus = false,
  isReply = false,
  isEditing = false,
}) => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState(initialContent);
  const [isFocused, setIsFocused] = useState(autoFocus || isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const userAvatar = user?.avatarUrl || user?.avatar_url;
  const displayName = user?.displayName || user?.display_name || user?.username || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  const handleFocus = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    setIsFocused(true);
  };

  const handleChange = (e) => {
    setContent(e.target.value);
    if (error) setError('');
  };

  const handleCancelClick = () => {
    setContent(initialContent);
    setError('');
    if (!isEditing && !isReply) {
      setIsFocused(false);
    }
    if (onCancel) {
      onCancel();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      setError('Comment cannot be empty.');
      return;
    }

    if (trimmed.length > MAX_COMMENT_LENGTH) {
      setError(`Comment cannot exceed ${MAX_COMMENT_LENGTH} characters.`);
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await onSubmit(trimmed);
      setContent('');
      if (!isEditing && !isReply) {
        setIsFocused(false);
      }
    } catch (err) {
      console.error('Failed to submit comment:', err);
      setError(err?.message || 'Unable to post your comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isOverLimit = content.length > MAX_COMMENT_LENGTH;
  const isSubmitDisabled = !content.trim() || submitting || isOverLimit;

  return (
    <div className={`flex items-start space-x-3.5 ${isReply ? 'mt-3' : ''}`}>
      {/* Current User Avatar (hidden when editing to save space) */}
      {!isEditing && (
        <div className="flex-shrink-0 mt-0.5">
          {!avatarError && userAvatar ? (
            <img
              src={getMediaUrl(userAvatar)}
              alt={displayName}
              onError={() => setAvatarError(true)}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
            />
          ) : (
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-white text-xs sm:text-sm font-bold shadow-sm">
              {isAuthenticated ? initial : '?'}
            </div>
          )}
        </div>
      )}

      {/* Composer Input Area */}
      <div className="flex-1 min-w-0">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div
            className={`rounded-2xl transition-all ${
              isFocused || content.length > 0
                ? 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-sm p-3'
                : 'bg-slate-100 dark:bg-slate-800/80 border border-transparent p-2.5 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
          >
            <textarea
              ref={textareaRef}
              rows={isFocused || content.length > 0 ? 3 : 1}
              value={content}
              onChange={handleChange}
              onFocus={handleFocus}
              placeholder={placeholder}
              aria-label={placeholder}
              disabled={submitting}
              className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none resize-none leading-relaxed"
            />

            {(isFocused || content.length > 0 || isReply || isEditing) && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 mt-1">
                <span
                  className={`text-xs ${
                    isOverLimit
                      ? 'text-rose-600 font-bold'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {content.length} / {MAX_COMMENT_LENGTH}
                </span>

                <div className="flex items-center space-x-2">
                  {(isFocused || isReply || isEditing || content.length > 0) && (
                    <button
                      type="button"
                      onClick={handleCancelClick}
                      disabled={submitting}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSubmitDisabled}
                    className="rounded-full px-4 py-1.5 text-xs font-bold"
                  >
                    {submitting ? 'Posting...' : submitText}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-rose-500 dark:text-rose-400 pl-1 font-medium">
              {error}
            </p>
          )}
        </form>
      </div>

      {/* Guest Sign-In Modal */}
      <Modal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Sign in to join the conversation"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Share your thoughts, reply to other viewers, and react to comments by signing into your account.
          </p>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAuthModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<LogIn className="w-4 h-4" />}
              onClick={() => navigate('/login')}
            >
              Sign In
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CommentComposer;
