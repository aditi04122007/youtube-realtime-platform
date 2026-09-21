import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { getCommentReplies } from '../services/commentService';
import CommentItem from './CommentItem';

const CommentReplies = ({
  commentId,
  replyCount = 0,
  onReplyUpdated,
  onReplyDeleted,
  activeReplyId,
  setActiveReplyId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [replies, setReplies] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const fetchReplies = async (pageNum = 1) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      setError('');

      const res = await getCommentReplies(commentId, { page: pageNum, limit: 10 });
      if (pageNum === 1) {
        setReplies(res.replies || []);
      } else {
        setReplies((prev) => [...prev, ...(res.replies || [])]);
      }
      setPage(pageNum);
      setHasMore(Boolean(res.pagination?.hasMore));
    } catch (err) {
      console.error('Failed to fetch replies:', err);
      setError('Unable to load replies. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState && replies.length === 0) {
      fetchReplies(1);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchReplies(page + 1);
    }
  };

  const handleChildReplyUpdated = (updatedReply) => {
    setReplies((prev) =>
      prev.map((r) => (r.id === updatedReply.id ? updatedReply : r))
    );
    if (onReplyUpdated) onReplyUpdated(updatedReply);
  };

  const handleChildReplyDeleted = (deletedId, isSoftDeleted) => {
    if (isSoftDeleted) {
      setReplies((prev) =>
        prev.map((r) =>
          r.id === deletedId
            ? { ...r, status: 'DELETED', content: '[deleted]', user: { displayName: '[deleted]' } }
            : r
        )
      );
    } else {
      setReplies((prev) => prev.filter((r) => r.id !== deletedId));
    }
    if (onReplyDeleted) onReplyDeleted(deletedId, isSoftDeleted);
  };

  // Expose method to append a newly created reply into open thread
  const addReply = (newReply) => {
    setReplies((prev) => [...prev, newReply]);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  if (replyCount <= 0 && replies.length === 0) {
    return null;
  }

  return (
    <div className="mt-2">
      {/* Toggle button */}
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center space-x-2 text-xs sm:text-sm font-bold text-indigo-600 dark:text-cyan-400 hover:text-indigo-700 dark:hover:text-cyan-300 py-1 px-2.5 rounded-full hover:bg-indigo-50/80 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <>
            <ChevronUp className="w-4 h-4" />
            <span>Hide {replyCount || replies.length} {replyCount === 1 ? 'reply' : 'replies'}</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            <span>View {replyCount || replies.length} {replyCount === 1 ? 'reply' : 'replies'}</span>
          </>
        )}
      </button>

      {/* Replies list */}
      {isOpen && (
        <div className="mt-2 pl-3 sm:pl-6 border-l-2 border-slate-200 dark:border-slate-800 space-y-3">
          {loading ? (
            <div className="flex items-center space-x-2 py-3 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              <span>Loading replies...</span>
            </div>
          ) : error ? (
            <div className="py-2 text-xs text-rose-500">
              {error}{' '}
              <button
                type="button"
                onClick={() => fetchReplies(1)}
                className="underline font-bold text-indigo-600 dark:text-cyan-400 ml-1"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  isReply={true}
                  onUpdate={handleChildReplyUpdated}
                  onDelete={handleChildReplyDeleted}
                  activeReplyId={activeReplyId}
                  setActiveReplyId={setActiveReplyId}
                />
              ))}

              {hasMore && (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="text-xs font-bold text-indigo-600 dark:text-cyan-400 hover:underline inline-flex items-center space-x-1 py-1 disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      <span>Loading more replies...</span>
                    </>
                  ) : (
                    <span>Show more replies</span>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentReplies;
