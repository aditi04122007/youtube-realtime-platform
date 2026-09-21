import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  ArrowUpDown,
  Check,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { formatNumber } from '../utils/formatNumber';
import { getVideoComments, createComment } from '../services/commentService';
import CommentComposer from './CommentComposer';
import CommentItem from './CommentItem';
import Button from './common/Button';

const SORT_OPTIONS = [
  { key: 'top', label: 'Top comments' },
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
];

const CommentsSection = ({ videoId, initialCommentCount = 0 }) => {
  const [comments, setComments] = useState([]);
  const [totalCount, setTotalCount] = useState(Number(initialCommentCount) || 0);
  const [sort, setSort] = useState('top');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const [activeReplyId, setActiveReplyId] = useState(null);
  const sortMenuRef = useRef(null);

  // Sync initial count if video updates
  useEffect(() => {
    if (initialCommentCount !== undefined && initialCommentCount !== null) {
      setTotalCount(Number(initialCommentCount) || 0);
    }
  }, [initialCommentCount]);

  // Close sort menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
        setShowSortMenu(false);
      }
    };
    if (showSortMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSortMenu]);

  // Fetch comments
  const fetchComments = async (pageNum = 1, currentSort = sort) => {
    if (!videoId) return;

    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      setError('');

      const res = await getVideoComments(videoId, {
        page: pageNum,
        limit: 20,
        sort: currentSort,
      });

      if (pageNum === 1) {
        setComments(res.comments || []);
      } else {
        setComments((prev) => [...prev, ...(res.comments || [])]);
      }

      setPage(pageNum);
      setTotalCount(Number(res.pagination?.total) || 0);
      setHasMore(Boolean(res.pagination?.hasMore));
    } catch (err) {
      console.error('Failed to load comments:', err);
      setError('Unable to load comments. Please check your connection and try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Re-fetch when videoId or sort changes
  useEffect(() => {
    fetchComments(1, sort);
  }, [videoId, sort]);

  const handleSortChange = (newSort) => {
    setSort(newSort);
    setShowSortMenu(false);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchComments(page + 1, sort);
    }
  };

  // Handle new top-level comment creation
  const handleTopLevelSubmit = async (content) => {
    const res = await createComment(videoId, { content });
    const newComment = res.comment;

    setTotalCount((prev) => prev + 1);

    // If sort is newest or top, put at the top of the list
    if (sort === 'newest' || sort === 'top') {
      setComments((prev) => [newComment, ...prev]);
    } else {
      setComments((prev) => [...prev, newComment]);
    }
  };

  // Handle comment update
  const handleCommentUpdate = (updatedComment) => {
    setComments((prev) =>
      prev.map((c) => (c.id === updatedComment.id ? updatedComment : c))
    );
  };

  // Handle comment delete
  const handleCommentDelete = (deletedId, isSoftDeleted) => {
    if (isSoftDeleted) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === deletedId
            ? {
                ...c,
                status: 'DELETED',
                content: '[deleted]',
                user: { displayName: '[deleted]' },
              }
            : c
        )
      );
    } else {
      setComments((prev) => prev.filter((c) => c.id !== deletedId));
    }
    setTotalCount((prev) => Math.max(0, prev - 1));
  };

  // Handle reply added under top-level comment
  const handleReplyAdded = (newReply) => {
    // Increment parent reply count in local top-level comment
    setComments((prev) =>
      prev.map((c) =>
        c.id === newReply.parentId
          ? { ...c, replyCount: (c.replyCount || 0) + 1 }
          : c
      )
    );
  };

  const currentSortLabel =
    SORT_OPTIONS.find((s) => s.key === sort)?.label || 'Top comments';

  return (
    <section aria-label="Comments" className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-800 space-y-6">
      {/* 1. Comments Header: Total count and Sort dropdown */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-cyan-400" />
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            {formatNumber(totalCount)} {totalCount === 1 ? 'Comment' : 'Comments'}
          </h2>
        </div>

        {/* Sort dropdown */}
        <div className="relative" ref={sortMenuRef}>
          <button
            type="button"
            onClick={() => setShowSortMenu((prev) => !prev)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            aria-haspopup="true"
            aria-expanded={showSortMenu}
          >
            <ArrowUpDown className="w-3.5 h-3.5 mr-0.5 text-slate-500" />
            <span>{currentSortLabel}</span>
          </button>

          {showSortMenu && (
            <div className="absolute right-0 top-9 z-20 w-44 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 text-xs">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleSortChange(opt.key)}
                  className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${
                    sort === opt.key
                      ? 'font-bold text-indigo-600 dark:text-cyan-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span>{opt.label}</span>
                  {sort === opt.key && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Top-level Comment Composer */}
      <CommentComposer
        placeholder="Add a comment..."
        submitText="Comment"
        onSubmit={handleTopLevelSubmit}
      />

      {/* 3. Comment List, Skeletons, or Error State */}
      {loading ? (
        <div className="space-y-4 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start space-x-3.5 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-32" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-8 text-center space-y-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {error}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchComments(1, sort)}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Try Again
          </Button>
        </div>
      ) : comments.length === 0 ? (
        <div className="py-12 text-center space-y-2 text-slate-500 dark:text-slate-400">
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
            No comments yet.
          </p>
          <p className="text-xs">
            Be the first to share your thoughts and join the discussion!
          </p>
        </div>
      ) : (
        <div className="space-y-5 pt-2">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              isReply={false}
              onUpdate={handleCommentUpdate}
              onDelete={handleCommentDelete}
              onReplyAdded={handleReplyAdded}
              activeReplyId={activeReplyId}
              setActiveReplyId={setActiveReplyId}
            />
          ))}

          {/* Load more comments */}
          {hasMore && (
            <div className="pt-3 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-full px-5 py-2 text-xs font-bold"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    <span>Loading more comments...</span>
                  </>
                ) : (
                  <span>Load more comments</span>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default CommentsSection;
