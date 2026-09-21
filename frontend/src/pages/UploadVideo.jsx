import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Loading from '../components/common/Loading';
import VideoUploader from '../components/VideoUploader';
import ThumbnailUploader from '../components/ThumbnailUploader';
import UploadProgress from '../components/UploadProgress';
import VideoAccessSelector from '../components/videos/VideoAccessSelector';
import { VisibilityBadge } from '../components/VideoStatusBadge';
import {
  getCurrentUserChannel,
  getVideoCategories,
  uploadVideo,
  getMediaUrl,
} from '../services/api';
import {
  Tv,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Film,
  Sparkles,
  ArrowRight,
  Tag as TagIcon,
  Globe,
  Lock,
  EyeOff,
  Video,
} from 'lucide-react';

const UploadVideo = () => {
  const navigate = useNavigate();

  // Channel check & initial load
  const [channelLoading, setChannelLoading] = useState(true);
  const [channel, setChannel] = useState(null);
  const [hasNoChannel, setHasNoChannel] = useState(false);

  // Categories
  const [categories, setCategories] = useState([]);

  // Form State
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [accessType, setAccessType] = useState('FREE');
  const [minimumPlanCode, setMinimumPlanCode] = useState('BRONZE');

  // Upload Progress & State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loadedBytes, setLoadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Abort controller ref for cancellation
  const abortControllerRef = useRef(null);

  // 1. Check channel prerequisite and load categories on mount
  useEffect(() => {
    let isMounted = true;

    const initData = async () => {
      try {
        setChannelLoading(true);
        // Check channel
        const chanRes = await getCurrentUserChannel();
        if (isMounted) {
          if (chanRes && chanRes.success && chanRes.channel) {
            setChannel(chanRes.channel);
          } else {
            setHasNoChannel(true);
          }
        }
      } catch (err) {
        if (isMounted) {
          if (err.status === 404) {
            setHasNoChannel(true);
          } else {
            setUploadError(err.message || 'Failed to verify channel prerequisite');
          }
        }
      }

      try {
        const catRes = await getVideoCategories();
        if (isMounted && catRes && catRes.success) {
          setCategories(catRes.data || []);
        }
      } catch (catErr) {
        console.error('Failed to load categories:', catErr);
      } finally {
        if (isMounted) setChannelLoading(false);
      }
    };

    initData();

    return () => {
      isMounted = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // When a video file is chosen, default title to filename without extension if empty
  const handleVideoSelect = (file) => {
    setVideoFile(file);
    if (!title && file.name) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
      setTitle(cleanName.slice(0, 100));
    }
  };

  const handleVideoClear = () => {
    setVideoFile(null);
  };

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsUploading(false);
      setIsProcessing(false);
      setUploadProgress(0);
      setUploadError('Upload cancelled.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploadError(null);

    if (!videoFile) {
      setUploadError('Please select a video file to upload');
      return;
    }

    if (!title || title.trim().length < 3) {
      setUploadError('Title must be at least 3 characters long');
      return;
    }

    if (title.trim().length > 200) {
      setUploadError('Title cannot exceed 200 characters');
      return;
    }

    // Build FormData
    const formData = new FormData();
    formData.append('video', videoFile);
    if (thumbnailFile) {
      formData.append('thumbnail', thumbnailFile);
    }
    formData.append('title', title.trim());
    if (description.trim()) {
      formData.append('description', description.trim());
    }
    if (categoryId) {
      formData.append('category_id', categoryId);
    }
    if (tagsInput.trim()) {
      formData.append('tags', tagsInput.trim());
    }
    formData.append('visibility', visibility);
    formData.append('access_type', accessType);
    if (accessType === 'PREMIUM') {
      formData.append('minimum_plan_code', minimumPlanCode);
    }

    // Setup abort controller
    abortControllerRef.current = new AbortController();

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setLoadedBytes(0);
      setTotalBytes(videoFile.size);
      setIsProcessing(false);

      const res = await uploadVideo(
        formData,
        (progress, loaded, total) => {
          setUploadProgress(progress);
          setLoadedBytes(loaded);
          setTotalBytes(total);
          if (progress >= 100) {
            setIsProcessing(true);
          }
        },
        abortControllerRef.current.signal
      );

      if (res && res.success) {
        setUploadedVideo(res.data);
      } else {
        setUploadError(res.message || 'Failed to upload video');
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        setUploadError('Upload was cancelled');
      } else {
        setUploadError(err.message || 'An error occurred while uploading your video');
      }
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
    }
  };

  const handleCopyLink = () => {
    if (!uploadedVideo) return;
    const url = `${window.location.origin}/watch/${uploadedVideo.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleResetForm = () => {
    setVideoFile(null);
    setThumbnailFile(null);
    setTitle('');
    setDescription('');
    setCategoryId('');
    setTagsInput('');
    setVisibility('PUBLIC');
    setAccessType('FREE');
    setMinimumPlanCode('BRONZE');
    setUploadedVideo(null);
    setUploadProgress(0);
    setUploadError(null);
  };

  // Loading state
  if (channelLoading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <Loading message="Checking creator permissions..." />
      </div>
    );
  }

  // Prerequisite check: Channel required
  if (hasNoChannel) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card className="p-8 sm:p-10 text-center space-y-6 border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 text-indigo-600 dark:text-cyan-400 flex items-center justify-center mx-auto shadow-inner">
            <Tv className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Create a Channel to Start Uploading
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Your creator journey begins here. You must have an active channel before you can publish and manage videos on StreamWave.
            </p>
          </div>

          <div className="pt-2">
            <Link to="/channel/create">
              <Button
                variant="primary"
                size="lg"
                leftIcon={<PlusCircle className="w-5 h-5" />}
              >
                Create Your Channel Now
              </Button>
            </Link>
          </div>

          <p className="text-xs text-slate-400">
            It takes less than a minute to choose your channel name and handle.
          </p>
        </Card>
      </div>
    );
  }

  // Upload Complete / Success View
  if (uploadedVideo) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        <Card className="p-6 sm:p-8 space-y-6 border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="flex items-center space-x-3 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-8 h-8 flex-shrink-0" />
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Video Published Successfully!
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your video is now live on your channel and ready for viewers.
              </p>
            </div>
          </div>

          {/* Video Preview Card */}
          <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-5 items-start">
            <div className="w-full sm:w-56 aspect-video bg-black rounded-xl overflow-hidden shadow-sm flex-shrink-0 relative">
              {uploadedVideo.thumbnail_url ? (
                <img
                  src={getMediaUrl(uploadedVideo.thumbnail_url)}
                  alt={uploadedVideo.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500">
                  <Film className="w-8 h-8" />
                </div>
              )}
              <div className="absolute bottom-2 right-2">
                <VisibilityBadge visibility={uploadedVideo.visibility} />
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2">
                {uploadedVideo.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Published to <strong className="text-slate-700 dark:text-slate-300">{channel?.channel_name}</strong> (@{channel?.handle})
              </p>

              {/* Shareable Link Box */}
              <div className="pt-2">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Video Link
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/watch/${uploadedVideo.id}`}
                    className="flex-1 text-xs px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    leftIcon={<Copy className="w-3.5 h-3.5" />}
                  >
                    {copiedLink ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleResetForm}
            >
              Upload Another Video
            </Button>

            <div className="flex items-center space-x-3">
              <Link to="/my-videos">
                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={<Video className="w-4 h-4" />}
                >
                  Manage My Videos
                </Button>
              </Link>
              <Link to={`/watch/${uploadedVideo.id}`}>
                <Button
                  variant="primary"
                  size="md"
                  rightIcon={<ExternalLink className="w-4 h-4" />}
                >
                  Watch Video
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-4 py-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Upload Video
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Publish high-quality video content directly to <strong className="text-slate-700 dark:text-slate-300">{channel?.channel_name}</strong> (@{channel?.handle})
          </p>
        </div>

        <Link to="/my-videos">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Video className="w-4 h-4" />}
          >
            My Videos Studio
          </Button>
        </Link>
      </div>

      {/* Global Error Banner */}
      {uploadError && (
        <div className="rounded-2xl p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-3">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <span className="font-medium leading-relaxed">{uploadError}</span>
        </div>
      )}

      {/* Active Upload Progress Banner */}
      {isUploading && (
        <UploadProgress
          progress={uploadProgress}
          loadedBytes={loadedBytes}
          totalBytes={totalBytes}
          isProcessing={isProcessing}
          onCancel={handleCancelUpload}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Video File Dropzone */}
        <Card className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center space-x-2 text-sm font-bold text-slate-900 dark:text-white">
            <Film className="w-4 h-4 text-indigo-500" />
            <span>Video File</span>
          </div>

          <VideoUploader
            file={videoFile}
            onChange={handleVideoSelect}
            onClear={handleVideoClear}
            disabled={isUploading}
          />
        </Card>

        {/* 2. Metadata Section (enabled once video is picked or anytime) */}
        <Card className="p-6 sm:p-8 space-y-5">
          <div className="flex items-center space-x-2 text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>Video Details & Metadata</span>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Title <span className="text-rose-500">*</span>
              </label>
              <span className={`text-[11px] ${title.length > 200 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                {title.length}/200
              </span>
            </div>
            <input
              type="text"
              required
              disabled={isUploading}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Add a title that describes your video (required)"
              className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Description <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {description.length}/5000
              </span>
            </div>
            <textarea
              disabled={isUploading}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={4}
              placeholder="Tell viewers about your video, topics covered, links, and notes..."
              className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all resize-y"
            />
          </div>

          {/* Thumbnail Uploader */}
          <div className="pt-2">
            <ThumbnailUploader
              file={thumbnailFile}
              onChange={(file) => setThumbnailFile(file)}
              onClear={() => setThumbnailFile(null)}
              disabled={isUploading}
            />
          </div>

          {/* Category & Tags Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Category
              </label>
              <select
                disabled={isUploading}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all"
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tags <span className="text-slate-400 font-normal">(Comma-separated)</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  disabled={isUploading}
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. react, tutorial, coding"
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all"
                />
                <TagIcon className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Visibility Selection */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Visibility
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Public */}
              <div
                onClick={() => !isUploading && setVisibility('PUBLIC')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  visibility === 'PUBLIC'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <Globe className={`w-4 h-4 ${visibility === 'PUBLIC' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Public</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Anyone can discover and watch your video.
                </p>
              </div>

              {/* Unlisted */}
              <div
                onClick={() => !isUploading && setVisibility('UNLISTED')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  visibility === 'UNLISTED'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <EyeOff className={`w-4 h-4 ${visibility === 'UNLISTED' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Unlisted</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Anyone with the video link can watch.
                </p>
              </div>

              {/* Private */}
              <div
                onClick={() => !isUploading && setVisibility('PRIVATE')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  visibility === 'PRIVATE'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <Lock className={`w-4 h-4 ${visibility === 'PRIVATE' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Private</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Only you can see and access this video.
                </p>
              </div>
            </div>
          </div>

          {/* Access & Monetization Tier Selection (Phase 18) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <VideoAccessSelector
              accessType={accessType}
              onChangeAccessType={setAccessType}
              minimumPlanCode={minimumPlanCode}
              onChangeMinimumPlanCode={setMinimumPlanCode}
              disabled={isUploading}
            />
          </div>
        </Card>

        {/* Submit Bar */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={isUploading}
            onClick={handleResetForm}
          >
            Clear Form
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isUploading}
            disabled={isUploading || !videoFile}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            {isUploading ? (isProcessing ? 'Processing Video...' : `Uploading ${uploadProgress}%`) : 'Publish Video'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default UploadVideo;
