import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ThumbsUp,
  MessageSquare,
  MoreVertical,
  Edit2,
  Trash2,
  AlertTriangle,
  LogIn,
  Flag,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getMediaUrl } from '../services/api';
import { timeAgo } from '../utils/timeAgo';
import { formatNumber } from '../utils/formatNumber';
import {
  likeComment,
  unlikeComment,
  updateComment,
  deleteComment,
  createComment,
} from '../services/commentService';
import CommentComposer from './CommentComposer';
import CommentReplies from './CommentReplies';
import CommentTranslation from './CommentTranslation';
import ReportCommentModal from './ReportCommentModal';
import Modal from './common/Modal';
import Button from './common/Button';

const CommentItem = ({
  comment,
  isReply = false,
  onUpdate,
  onDelete,
  onReplyAdded,
  activeReplyId,
  setActiveReplyId,
}) => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [liked, setLiked] = useState(Boolean(comment.likedByCurrentUser));
  const [likeCount, setLikeCount] = useState(Number(comment.likeCount) || 0);
  const [replyCount, setReplyCount] = useState(Number(comment.replyCount) || 0);
  const [isLiking, setIsLiking] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Phase 13: Translation state
  const [translationState, setTranslationState] = useState({
    isShowingTranslated: false,
    translatedContent: null,
    translationData: null,
  });

  const [avatarError, setAvatarError] = useState(false);
  const menuRef = useRef(null);

  // Sync props if comment changes externally
  useEffect(() => {
    setLiked(Boolean(comment.likedByCurrentUser));
    setLikeCount(Number(comment.likeCount) || 0);
    setReplyCount(Number(comment.replyCount) || 0);
  }, [comment.likedByCurrentUser, comment.likeCount, comment.replyCount]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const isDeleted = comment.status === 'DELETED';
  const isRemoved = comment.status === 'REMOVED';
  const isHidden = comment.status === 'HIDDEN';
  const isModerated = isRemoved || isHidden;
  const isOwner = user && Number(user.id) === Number(comment.userId);
  const isReplying = activeReplyId === comment.id;
  const canShowMenu = !isDeleted && !isModerated;

  // Check if edited: difference > 3 seconds
  const isEdited =
    !isDeleted &&
    comment.updatedAt &&
    comment.createdAt &&
    Math.abs(new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime()) > 3000;

  const authorName = comment.user?.displayName || comment.user?.username || 'User';
  const authorHandle = comment.user?.channelHandle || comment.user?.username;
  const authorAvatar = comment.user?.avatarUrl ? getMediaUrl(comment.user.avatarUrl) : null;
  const authorInitial = authorName.charAt(0).toUpperCase();

  // Handle Like Toggle
  const handleLikeToggle = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    if (isLiking || isDeleted) return;

    setIsLiking(true);
    const wasLiked = liked;
    const prevCount = likeCount;

    // Optimistic UI
    setLiked(!wasLiked);
    setLikeCount(wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      if (wasLiked) {
        const res = await unlikeComment(comment.id);
        setLiked(false);
        setLikeCount(Number(res.likeCount) || 0);
      } else {
        const res = await likeComment(comment.id);
        setLiked(true);
        setLikeCount(Number(res.likeCount) || 0);
      }
    } catch (err) {
      console.error('Failed to toggle comment like:', err);
      // Revert on failure
      setLiked(wasLiked);
      setLikeCount(prevCount);
    } finally {
      setIsLiking(false);
    }
  };

  // Handle Reply Button Click
  const handleReplyClick = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    if (isReplying) {
      setActiveReplyId(null);
    } else {
      setActiveReplyId(comment.id);
    }
  };

  // Submit Reply
  const handleReplySubmit = async (replyContent) => {
    const parentId = isReply ? (comment.parentId || comment.id) : comment.id;
    const res = await createComment(comment.videoId, {
      content: replyContent,
      parentId,
    });

    setReplyCount((prev) => prev + 1);
    setActiveReplyId(null);
    if (onReplyAdded) {
      onReplyAdded(res.comment);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (newContent) => {
    const res = await updateComment(comment.id, { content: newContent });
    setIsEditing(false);
    if (onUpdate) {
      onUpdate(res.comment);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      setDeleteError('');
      const res = await deleteComment(comment.id);
      setShowDeleteModal(false);
      if (onDelete) {
        onDelete(comment.id, res.isSoftDeleted);
      }
    } catch (err) {
      console.error('Failed to delete comment:', err);
      setDeleteError(err?.message || 'Unable to delete comment. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="group/comment flex items-start space-x-3 text-slate-800 dark:text-slate-200">
      {/* Author Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        {!isDeleted && !isRemoved && authorHandle ? (
          <Link to={`/channel/${authorHandle}`} tabIndex={-1}>
            {!avatarError && authorAvatar ? (
              <img
                src={authorAvatar}
                alt={authorName}
                onError={() => setAvatarError(true)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700 hover:ring-indigo-500 transition-all"
              />
            ) : (
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-white text-xs sm:text-sm font-bold shadow-sm">
                {authorInitial}
              </div>
            )}
          </Link>
        ) : (
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 text-xs font-bold">
            ?
          </div>
        )}
      </div>

      {/* Main Comment Content & Action Area */}
      <div className="flex-1 min-w-0">
        {/* Author Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 flex-wrap text-xs">
            {isRemoved ? (
              <span className="font-semibold text-rose-500/90 dark:text-rose-400/90 italic">
                [removed by moderator]
              </span>
            ) : isHidden ? (
              <span className="font-semibold text-amber-500/90 dark:text-amber-400/90 italic">
                [unavailable]
              </span>
            ) : !isDeleted ? (
              <>
                <Link
                  to={authorHandle ? `/channel/${authorHandle}` : '#'}
                  className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-cyan-400 transition-colors truncate"
                >
                  {authorName}
                </Link>
                {authorHandle && (
                  <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
                    @{authorHandle}
                  </span>
                )}
              </>
            ) : (
              <span className="font-semibold text-slate-400 dark:text-slate-500 italic">
                [deleted]
              </span>
            )}

            <span className="text-slate-400 dark:text-slate-500">
              • {timeAgo(comment.createdAt)}
            </span>

            {isEdited && (
              <span className="text-slate-400 dark:text-slate-500 italic">
                (edited)
              </span>
            )}
          </div>

          {/* Options Menu ⋮ (Edit/Delete for owner, Report for non-owner) */}
          {canShowMenu && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setShowMenu((prev) => !prev)}
                className="opacity-70 sm:opacity-0 sm:group-hover/comment:opacity-100 focus:opacity-100 p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all focus:outline-none"
                aria-label="Comment options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-6 z-20 w-32 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg py-1 text-xs">
                  {isOwner ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenu(false);
                          setIsEditing(true);
                        }}
                        className="w-full px-3 py-2 text-left flex items-center space-x-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenu(false);
                          setShowDeleteModal(true);
                        }}
                        className="w-full px-3 py-2 text-left flex items-center space-x-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        if (!isAuthenticated) {
                          setShowAuthModal(true);
                        } else {
                          setShowReportModal(true);
                        }
                      }}
                      className="w-full px-3 py-2 text-left flex items-center space-x-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>Report</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Comment Text or Inline Edit Composer */}
        {isEditing ? (
          <div className="mt-2">
            <CommentComposer
              initialContent={comment.content}
              submitText="Save"
              isEditing={true}
              autoFocus={true}
              onSubmit={handleEditSubmit}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        ) : (
          <div className="mt-1">
            {/* Translated header badge */}
            {translationState.isShowingTranslated && translationState.translationData && (
              <div className="mb-1 text-[11px] flex items-center space-x-1.5 text-indigo-600 dark:text-cyan-400 font-medium select-none">
                <span>
                  Translated from {translationState.translationData.sourceLanguage ? translationState.translationData.sourceLanguage.toUpperCase() : 'detected language'}
                </span>
                {translationState.translationData.cached && (
                  <span className="text-slate-400 dark:text-slate-500 text-[10px]">• cached</span>
                )}
              </div>
            )}

            <p
              className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
                isDeleted
                  ? 'text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg'
                  : isRemoved
                  ? 'text-rose-600/80 dark:text-rose-400/80 italic bg-rose-50/50 dark:bg-rose-950/20 p-2.5 rounded-lg border border-rose-100 dark:border-rose-900/30'
                  : isHidden
                  ? 'text-amber-600/80 dark:text-amber-400/80 italic bg-amber-50/50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/30'
                  : 'text-slate-800 dark:text-slate-200'
              }`}
            >
              {translationState.isShowingTranslated && translationState.translatedContent
                ? translationState.translatedContent
                : comment.content}
            </p>
          </div>
        )}

        {/* Comment Action Bar (Like, Reply, Translate) */}
        {!isDeleted && !isModerated && !isEditing && (
          <div className="flex items-center space-x-3 mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400 flex-wrap gap-y-1">
            {/* Like button */}
            <button
              type="button"
              onClick={handleLikeToggle}
              disabled={isLiking}
              aria-label={liked ? 'Unlike comment' : 'Like comment'}
              className={`inline-flex items-center space-x-1.5 py-1 px-2 rounded-full transition-colors focus:outline-none ${
                liked
                  ? 'text-indigo-600 dark:text-cyan-400 font-bold bg-indigo-50 dark:bg-indigo-950/40'
                  : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <ThumbsUp
                className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`}
              />
              {likeCount > 0 && <span>{formatNumber(likeCount)}</span>}
            </button>

            {/* Reply button */}
            <button
              type="button"
              onClick={handleReplyClick}
              aria-label="Reply to comment"
              className={`inline-flex items-center space-x-1 py-1 px-2.5 rounded-full hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none ${
                isReplying ? 'text-indigo-600 dark:text-cyan-400 font-bold' : ''
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 mr-0.5" />
              <span>Reply</span>
            </button>

            {/* Translate action (Phase 13) */}
            <CommentTranslation
              commentId={comment.id}
              originalContent={comment.content}
              onTranslationStateChange={setTranslationState}
              isDeleted={isDeleted || isModerated}
            />
          </div>
        )}

        {/* Inline Reply Composer */}
        {isReplying && (
          <CommentComposer
            placeholder={`Reply to ${authorName}...`}
            submitText="Reply"
            isReply={true}
            autoFocus={true}
            onSubmit={handleReplySubmit}
            onCancel={() => setActiveReplyId(null)}
          />
        )}

        {/* Nested Replies Component (Only on top-level comments) */}
        {!isReply && (
          <CommentReplies
            commentId={comment.id}
            replyCount={replyCount}
            onReplyUpdated={onUpdate}
            onReplyDeleted={onDelete}
            activeReplyId={activeReplyId}
            setActiveReplyId={setActiveReplyId}
          />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
        title="Delete comment?"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            This action will remove your comment from the discussion. If other viewers have replied to this comment, the thread will be preserved.
          </p>

          {deleteError && (
            <p className="text-xs text-rose-500 font-medium">
              {deleteError}
            </p>
          )}

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Guest Sign-In Modal */}
      <Modal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Sign in to join the conversation"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Please sign in to react, reply, and participate in discussions.
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

      {/* Report Comment Modal */}
      <ReportCommentModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        commentId={comment.id}
        commentContent={comment.content}
        authorName={authorName}
      />
    </div>
  );
};

export default CommentItem;
