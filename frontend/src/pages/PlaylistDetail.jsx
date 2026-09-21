import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ListMusic,
  Play,
  Lock,
  Globe,
  Link2,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Share2,
  FolderPlus,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import CreatePlaylistModal from '../components/playlists/CreatePlaylistModal';
import PremiumBadge from '../components/videos/PremiumBadge';
import { useAuth } from '../context/AuthContext';
import {
  getPlaylist,
  deletePlaylist,
  removeVideoFromPlaylist,
  reorderPlaylist,
} from '../services/playlistService';
import { getMediaUrl } from '../services/api';
import { formatNumber } from '../utils/formatNumber';
import { timeAgo, formatDuration } from '../utils/timeAgo';

const PlaylistDetail = () => {
  const { playlistId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);

  // Edit / Delete modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    fetchPlaylist();
  }, [playlistId]);

  const fetchPlaylist = async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const res = await getPlaylist(playlistId);
      setPlaylist(res.playlist);
    } catch (err) {
      const errData = err.response?.data;
      setError(errData?.message || 'Failed to load playlist');
      setErrorCode(errData?.code || (err.response?.status === 403 ? 'PRIVATE_PLAYLIST' : 'ERROR'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveVideo = async (videoId) => {
    if (!playlist) return;
    try {
      await removeVideoFromPlaylist(playlist.id, videoId);
      // Optimistically update video list
      setPlaylist((prev) => {
        if (!prev) return prev;
        const updatedVideos = prev.videos
          .filter((v) => v.id !== videoId)
          .map((v, idx) => ({ ...v, position: idx + 1 }));
        return {
          ...prev,
          videoCount: updatedVideos.length,
          videos: updatedVideos,
        };
      });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove video');
    }
  };

  const handleMove = async (index, direction) => {
    if (!playlist || !playlist.videos || reorderLoading) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= playlist.videos.length) return;

    const newVideos = [...playlist.videos];
    const temp = newVideos[index];
    newVideos[index] = newVideos[targetIndex];
    newVideos[targetIndex] = temp;

    // Update positions
    const reorderedWithPositions = newVideos.map((v, idx) => ({
      ...v,
      position: idx + 1,
    }));

    setPlaylist((prev) => ({ ...prev, videos: reorderedWithPositions }));

    // Send videoIds to backend
    setReorderLoading(true);
    try {
      const videoIds = reorderedWithPositions.map((v) => v.id);
      await reorderPlaylist(playlist.id, videoIds);
    } catch (err) {
      // Revert if failed
      fetchPlaylist();
    } finally {
      setReorderLoading(false);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!playlist) return;
    setIsDeleting(true);
    try {
      await deletePlaylist(playlist.id);
      navigate('/playlists');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete playlist');
      setIsDeleting(false);
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loading size="lg" message="Loading playlist..." />
      </div>
    );
  }

  if (errorCode === 'PRIVATE_PLAYLIST') {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <Card className="p-8 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Private Playlist
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This playlist is private. Only the creator has access to view its contents.
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <Card className="p-8 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Playlist Unavailable
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {error || 'Playlist not found or has been removed.'}
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/playlists')}>
            View All Playlists
          </Button>
        </Card>
      </div>
    );
  }

  const isOwner = Boolean(user && user.id === playlist.userId);
  const firstVideo = playlist.videos && playlist.videos.length > 0 ? playlist.videos[0] : null;
  const resolvedThumbnail = playlist.thumbnailUrl ? getMediaUrl(playlist.thumbnailUrl) : null;

  return (
    <div className="max-w-7xl mx-auto pb-16 space-y-8">
      {/* Edit Modal */}
      {showEditModal && (
        <CreatePlaylistModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          playlistToEdit={playlist}
          onSuccess={(updated) => setPlaylist((prev) => ({ ...prev, ...updated }))}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <Card className="max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Delete Playlist?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-slate-200">"{playlist.name}"</span>? This will remove the playlist but will not delete your uploaded videos.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeletePlaylist}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Playlist Metadata & Artwork Panel */}
        <div className="lg:col-span-4 sticky top-20">
          <Card className="p-5 sm:p-6 space-y-5 bg-gradient-to-b from-indigo-950/20 to-transparent dark:from-slate-900/60 dark:to-slate-900/20 border-slate-200 dark:border-slate-800">
            {/* Artwork */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-900 shadow-md">
              {resolvedThumbnail ? (
                <img
                  src={resolvedThumbnail}
                  alt={playlist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-indigo-400">
                  <ListMusic className="w-16 h-16 opacity-50" />
                </div>
              )}

              {/* Total videos badge */}
              <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-sm text-xs font-bold text-white">
                {playlist.videoCount} {playlist.videoCount === 1 ? 'video' : 'videos'}
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                {playlist.visibility === 'PUBLIC' && (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <Globe className="w-3 h-3" />
                    <span>Public</span>
                  </span>
                )}
                {playlist.visibility === 'UNLISTED' && (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    <Link2 className="w-3 h-3" />
                    <span>Unlisted</span>
                  </span>
                )}
                {playlist.visibility === 'PRIVATE' && (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    <Lock className="w-3 h-3" />
                    <span>Private</span>
                  </span>
                )}

                <span className="text-[11px] text-slate-400">
                  Updated {timeAgo(playlist.updatedAt || playlist.createdAt)}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                {playlist.name}
              </h1>

              {playlist.description && (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
                  {playlist.description}
                </p>
              )}

              {/* Creator info */}
              {playlist.owner && (
                <div className="flex items-center space-x-2.5 pt-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold">
                    {(playlist.owner.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {playlist.owner.channel?.name || playlist.owner.username}
                  </span>
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="space-y-2.5 pt-2">
              {firstVideo ? (
                <Link to={`/watch/${firstVideo.id}`} className="block">
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full shadow-md"
                    leftIcon={<Play className="w-4 h-4 fill-current" />}
                  >
                    Play All
                  </Button>
                </Link>
              ) : (
                <Button variant="secondary" size="md" disabled className="w-full">
                  Empty Playlist
                </Button>
              )}

              {/* Secondary action row */}
              <div className="flex items-center space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyShareLink}
                  leftIcon={<Share2 className="w-3.5 h-3.5" />}
                  className="flex-1"
                >
                  {copiedLink ? 'Link Copied!' : 'Share'}
                </Button>

                {isOwner && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowEditModal(true)}
                      title="Edit details"
                      className="px-3"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}
                      title="Delete playlist"
                      className="px-3 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Ordered Videos List */}
        <div className="lg:col-span-8 space-y-3">
          {playlist.videos.length === 0 ? (
            <EmptyState
              icon={FolderPlus}
              title="This playlist has no videos yet"
              description="Browse videos on StreamWave and click 'Save to playlist' to add them here."
              action={
                <Link to="/">
                  <Button variant="primary" size="sm" leftIcon={<Play className="w-4 h-4" />}>
                    Browse Videos
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-2">
              {playlist.videos.map((vid, index) => {
                const vidThumb = vid.thumbnailUrl ? getMediaUrl(vid.thumbnailUrl) : null;
                const progress = vid.watchProgress;

                return (
                  <div
                    key={vid.id}
                    className="group relative flex items-center space-x-3 sm:space-x-4 p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-500/40 dark:hover:border-indigo-500/30 transition-all"
                  >
                    {/* Position Number / Reorder handle */}
                    <div className="w-6 flex-shrink-0 text-center text-xs font-bold text-slate-400 dark:text-slate-500">
                      {index + 1}
                    </div>

                    {/* Thumbnail */}
                    <Link
                      to={`/watch/${vid.id}`}
                      className="relative w-28 sm:w-40 aspect-video flex-shrink-0 rounded-xl overflow-hidden bg-slate-900 group/thumb block"
                    >
                      {vidThumb ? (
                        <img
                          src={vidThumb}
                          alt={vid.title}
                          className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                          <Play className="w-6 h-6" />
                        </div>
                      )}

                      {/* Duration */}
                      {vid.durationSeconds > 0 && (
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-semibold text-white">
                          {formatDuration(vid.durationSeconds)}
                        </span>
                      )}

                      {/* Watch History Progress Bar */}
                      {progress && progress.progressPercent > 0 && (
                        <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-700/80">
                          <div
                            className="h-full bg-red-600"
                            style={{ width: `${progress.progressPercent}%` }}
                          />
                        </div>
                      )}
                    </Link>

                    {/* Title & Channel details */}
                    <div className="flex-1 min-w-0 pr-2 space-y-1">
                      <div className="flex items-center space-x-1.5">
                        {vid.access?.isPremium && (
                          <PremiumBadge
                            plan={vid.access.minimumPlanCode || 'PREMIUM'}
                            size="xs"
                          />
                        )}
                        <Link
                          to={`/watch/${vid.id}`}
                          className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-cyan-400 transition-colors line-clamp-2 leading-snug"
                        >
                          {vid.title}
                        </Link>
                      </div>

                      {vid.channel && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {vid.channel.name}
                        </p>
                      )}

                      <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                        <span>{formatNumber(vid.viewCount)} views</span>
                        <span>•</span>
                        <span>Added {timeAgo(vid.addedAt)}</span>
                        {progress?.completed && (
                          <span className="inline-flex items-center space-x-0.5 text-emerald-500 font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Watched</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Owner Management Controls (Move up/down, remove) */}
                    {isOwner && (
                      <div className="flex items-center space-x-1 flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          disabled={index === 0 || reorderLoading}
                          onClick={() => handleMove(index, 'up')}
                          title="Move Up"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={index === playlist.videos.length - 1 || reorderLoading}
                          onClick={() => handleMove(index, 'down')}
                          title="Move Down"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveVideo(vid.id)}
                          title="Remove from playlist"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaylistDetail;
