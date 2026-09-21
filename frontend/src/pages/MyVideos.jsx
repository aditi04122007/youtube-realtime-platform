import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import Modal from '../components/common/Modal';
import DeleteVideoModal from '../components/DeleteVideoModal';
import ThumbnailUploader from '../components/ThumbnailUploader';
import VideoAccessSelector from '../components/videos/VideoAccessSelector';
import PremiumBadge from '../components/videos/PremiumBadge';
import { VisibilityBadge, StatusBadge } from '../components/VideoStatusBadge';
import {
  getMyVideos,
  updateVideo,
  deleteVideo,
  getVideoCategories,
  getCurrentUserChannel,
  getMediaUrl,
} from '../services/api';
import {
  Video,
  Upload,
  Eye,
  ThumbsUp,
  MessageSquare,
  Edit2,
  Trash2,
  ExternalLink,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Tv,
  Film,
  Calendar,
  Lock,
  Globe,
  EyeOff,
  Filter,
} from 'lucide-react';

const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const MyVideos = () => {
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, hasMore: false });
  const [categories, setCategories] = useState([]);
  const [channel, setChannel] = useState(null);
  const [hasNoChannel, setHasNoChannel] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Filter state
  const [filterVisibility, setFilterVisibility] = useState('ALL');

  // Edit Modal state
  const [editingVideo, setEditingVideo] = useState(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    tags: '',
    visibility: 'PUBLIC',
  });
  const [editThumbnailFile, setEditThumbnailFile] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState(null);

  // Delete Modal state
  const [deletingVideo, setDeletingVideo] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch creator data
  const fetchData = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      // Check channel
      try {
        const chanRes = await getCurrentUserChannel();
        if (chanRes && chanRes.success && chanRes.channel) {
          setChannel(chanRes.channel);
        } else {
          setHasNoChannel(true);
          setLoading(false);
          return;
        }
      } catch (cErr) {
        if (cErr.status === 404) {
          setHasNoChannel(true);
          setLoading(false);
          return;
        }
      }

      // Fetch videos
      const videoRes = await getMyVideos({ page, limit: 12 });
      if (videoRes && videoRes.success) {
        setVideos(videoRes.data || []);
        if (videoRes.pagination) {
          setPagination(videoRes.pagination);
        }
      }

      // Fetch categories
      const catRes = await getVideoCategories();
      if (catRes && catRes.success) {
        setCategories(catRes.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load video studio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  // Open Edit Modal
  const handleOpenEdit = (video) => {
    setEditingVideo(video);
    setEditThumbnailFile(null);
    setEditError(null);
    setEditFormData({
      title: video.title || '',
      description: video.description || '',
      category_id: video.category_id || '',
      tags: video.tags ? video.tags.map((t) => t.name).join(', ') : '',
      visibility: video.visibility || 'PUBLIC',
      access_type: video.access?.type || (video.is_premium ? 'PREMIUM' : 'FREE'),
      minimum_plan_code: video.access?.minimum_plan_code || video.minimum_plan_code || 'BRONZE',
    });
  };

  // Submit Edit
  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!editingVideo) return;

    if (!editFormData.title || editFormData.title.trim().length < 3) {
      setEditError('Title must be at least 3 characters long');
      return;
    }

    try {
      setIsUpdating(true);
      setEditError(null);

      const formData = new FormData();
      formData.append('title', editFormData.title.trim());
      formData.append('description', editFormData.description.trim());
      if (editFormData.category_id) {
        formData.append('category_id', editFormData.category_id);
      }
      formData.append('tags', editFormData.tags);
      formData.append('visibility', editFormData.visibility);
      formData.append('access_type', editFormData.access_type || 'FREE');
      if (editFormData.access_type === 'PREMIUM') {
        formData.append('minimum_plan_code', editFormData.minimum_plan_code || 'BRONZE');
      }

      if (editThumbnailFile) {
        formData.append('thumbnail', editThumbnailFile);
      }

      const res = await updateVideo(editingVideo.id, formData);
      if (res && res.success) {
        setFeedback({ type: 'success', message: 'Video updated successfully' });
        setTimeout(() => setFeedback(null), 4000);
        setEditingVideo(null);
        fetchData(pagination.page);
      } else {
        setEditError(res.message || 'Failed to update video');
      }
    } catch (err) {
      setEditError(err.message || 'Failed to update video');
    } finally {
      setIsUpdating(false);
    }
  };

  // Open Delete Modal
  const handleOpenDelete = (video) => {
    setDeletingVideo(video);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingVideo) return;

    try {
      setIsDeleting(true);
      const res = await deleteVideo(deletingVideo.id);
      if (res && res.success) {
        setVideos((prev) => prev.filter((v) => v.id !== deletingVideo.id));
        setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
        setDeletingVideo(null);
        setFeedback({ type: 'success', message: 'Video deleted successfully' });
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete video' });
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered videos
  const filteredVideos = videos.filter((v) => {
    if (filterVisibility === 'ALL') return true;
    return v.visibility === filterVisibility;
  });

  if (loading && videos.length === 0) {
    return (
      <div className="py-24 flex items-center justify-center">
        <Loading message="Loading Creator Studio..." />
      </div>
    );
  }

  if (hasNoChannel) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card className="p-8 sm:p-10 text-center space-y-6 border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 text-indigo-600 dark:text-cyan-400 flex items-center justify-center mx-auto">
            <Tv className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Create a Channel to Access Creator Studio
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              You must set up a channel before you can manage uploaded videos and analytics.
            </p>
          </div>
          <Link to="/channel/create">
            <Button variant="primary" size="lg" leftIcon={<PlusCircle className="w-5 h-5" />}>
              Create Your Channel
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-2 sm:px-4 py-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center space-x-2.5">
            <Video className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Channel Content & Studio</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage your published uploads, edit details, and monitor stats for{' '}
            <strong className="text-slate-700 dark:text-slate-300">{channel?.channel_name}</strong>
          </p>
        </div>

        <Link to="/upload">
          <Button
            variant="primary"
            size="md"
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Upload Video
          </Button>
        </Link>
      </div>

      {/* Notifications / Toast */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center space-x-2 animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Quick Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Videos</p>
            <p className="text-base font-bold text-slate-900 dark:text-white">{pagination.total}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Public</p>
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {videos.filter((v) => v.visibility === 'PUBLIC').length}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <EyeOff className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Unlisted</p>
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {videos.filter((v) => v.visibility === 'UNLISTED').length}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Private</p>
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {videos.filter((v) => v.visibility === 'PRIVATE').length}
            </p>
          </div>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {['ALL', 'PUBLIC', 'UNLISTED', 'PRIVATE'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterVisibility(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterVisibility === tab
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab === 'ALL' ? 'All Videos' : tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Video Content List */}
      {filteredVideos.length === 0 ? (
        <EmptyState
          icon={Film}
          title={videos.length === 0 ? 'No videos uploaded yet' : 'No videos match this filter'}
          description={
            videos.length === 0
              ? 'Get started by uploading your first video. Your creations will appear here.'
              : 'Try switching to another visibility tab to view your videos.'
          }
          action={
            videos.length === 0 ? (
              <Link to="/upload">
                <Button variant="primary" size="md" leftIcon={<Upload className="w-4 h-4" />}>
                  Upload Video
                </Button>
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {/* Table Header (Desktop) */}
          <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <div className="col-span-5">Video</div>
            <div className="col-span-2">Visibility</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-1 text-center">Views</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Video Rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredVideos.map((video) => (
              <div
                key={video.id}
                className="p-4 sm:px-6 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex flex-col md:grid md:grid-cols-12 gap-4 items-start md:items-center"
              >
                {/* Video Info (Col 5) */}
                <div className="w-full md:col-span-5 flex items-start space-x-3 min-w-0">
                  <div className="relative w-28 sm:w-32 aspect-video bg-black rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
                    {video.thumbnail_url ? (
                      <img
                        src={getMediaUrl(video.thumbnail_url)}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <Film className="w-6 h-6" />
                      </div>
                    )}
                    {video.duration_seconds > 0 && (
                      <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded text-[10px] font-semibold bg-black/80 text-white">
                        {formatDuration(video.duration_seconds)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/watch/${video.id}`}
                      className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-2 leading-snug"
                    >
                      {video.title}
                    </Link>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {video.description || 'No description provided'}
                    </p>
                    {video.category && (
                      <span className="inline-block mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {video.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* Visibility & Access (Col 2) */}
                <div className="w-full md:w-auto md:col-span-2 flex md:block items-center justify-between text-xs">
                  <span className="md:hidden text-[11px] font-semibold text-slate-400">Visibility:</span>
                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                    <VisibilityBadge visibility={video.visibility} />
                    <StatusBadge status={video.status} />
                    {(video.is_premium || video.access?.is_premium) ? (
                      <PremiumBadge
                        plan={video.access?.minimum_plan_code || video.minimum_plan_code || 'PREMIUM'}
                        size="xs"
                      />
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        FREE
                      </span>
                    )}
                  </div>
                </div>

                {/* Date (Col 2) */}
                <div className="w-full md:w-auto md:col-span-2 flex md:block items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="md:hidden text-[11px] font-semibold text-slate-400">Published:</span>
                  <span>{formatDate(video.published_at || video.created_at)}</span>
                </div>

                {/* Stats (Col 1) */}
                <div className="w-full md:w-auto md:col-span-1 flex md:block items-center justify-between md:text-center text-xs text-slate-600 dark:text-slate-300">
                  <span className="md:hidden text-[11px] font-semibold text-slate-400">Views:</span>
                  <span>{video.view_count.toLocaleString()}</span>
                </div>

                {/* Actions (Col 2) */}
                <div className="w-full md:w-auto md:col-span-2 flex items-center justify-end space-x-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                  <Link
                    to={`/watch/${video.id}`}
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Watch Video"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(video)}
                    className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Edit Metadata & Thumbnail"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenDelete(video)}
                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Delete Video"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Video Modal */}
      {editingVideo && (
        <Modal
          isOpen={true}
          onClose={() => !isUpdating && setEditingVideo(null)}
          title="Edit Video Details"
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleUpdateSubmit} className="space-y-4">
            {editError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isUpdating}
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                maxLength={200}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Description
              </label>
              <textarea
                rows={3}
                disabled={isUpdating}
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                maxLength={5000}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-y"
              />
            </div>

            {/* Thumbnail */}
            <div>
              <ThumbnailUploader
                file={editThumbnailFile}
                currentUrl={editingVideo.thumbnail_url}
                onChange={(file) => setEditThumbnailFile(file)}
                onClear={() => setEditThumbnailFile(null)}
                disabled={isUpdating}
              />
            </div>

            {/* Category & Tags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Category
                </label>
                <select
                  disabled={isUpdating}
                  value={editFormData.category_id}
                  onChange={(e) => setEditFormData({ ...editFormData, category_id: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  disabled={isUpdating}
                  value={editFormData.tags}
                  onChange={(e) => setEditFormData({ ...editFormData, tags: e.target.value })}
                  placeholder="react, tutorial, video"
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Visibility */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Visibility
              </label>
              <select
                disabled={isUpdating}
                value={editFormData.visibility}
                onChange={(e) => setEditFormData({ ...editFormData, visibility: e.target.value })}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="PUBLIC">Public — Anyone can watch</option>
                <option value="UNLISTED">Unlisted — Anyone with link can watch</option>
                <option value="PRIVATE">Private — Only you can watch</option>
              </select>
            </div>

            {/* Access & Monetization Tier Selection (Phase 18) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <VideoAccessSelector
                accessType={editFormData.access_type || 'FREE'}
                onChangeAccessType={(type) => setEditFormData({ ...editFormData, access_type: type })}
                minimumPlanCode={editFormData.minimum_plan_code || 'BRONZE'}
                onChangeMinimumPlanCode={(code) => setEditFormData({ ...editFormData, minimum_plan_code: code })}
                disabled={isUpdating}
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={isUpdating}
                onClick={() => setEditingVideo(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isUpdating}
                disabled={isUpdating}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletingVideo && (
        <DeleteVideoModal
          isOpen={true}
          onClose={() => !isDeleting && setDeletingVideo(null)}
          onConfirm={handleConfirmDelete}
          videoTitle={deletingVideo.title}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};

export default MyVideos;
