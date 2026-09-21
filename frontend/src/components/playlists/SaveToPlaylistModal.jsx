import React, { useState, useEffect } from 'react';
import { Plus, Check, Lock, Globe, Link2, Loader2, AlertCircle, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import {
  checkVideoInPlaylists,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  createPlaylist,
} from '../../services/playlistService';

const SaveToPlaylistModal = ({ isOpen, onClose, videoId, videoTitle = '' }) => {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState(null);

  // Inline create playlist form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistVisibility, setNewPlaylistVisibility] = useState('PRIVATE');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  useEffect(() => {
    if (isOpen && user && videoId) {
      fetchUserPlaylists();
      setShowCreateForm(false);
      setNewPlaylistName('');
      setCreateError(null);
      setError(null);
    }
  }, [isOpen, user, videoId]);

  const fetchUserPlaylists = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await checkVideoInPlaylists(videoId);
      setPlaylists(res.playlists || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your playlists');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlaylist = async (playlist) => {
    if (!playlist || actionLoading[playlist.id]) return;

    setActionLoading((prev) => ({ ...prev, [playlist.id]: true }));
    setError(null);

    const isCurrentlyIn = playlist.containsVideo;

    try {
      if (isCurrentlyIn) {
        await removeVideoFromPlaylist(playlist.id, videoId);
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlist.id ? { ...p, containsVideo: false, videoCount: Math.max(0, p.videoCount - 1) } : p
          )
        );
      } else {
        await addVideoToPlaylist(playlist.id, videoId);
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlist.id ? { ...p, containsVideo: true, videoCount: p.videoCount + 1 } : p
          )
        );
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update playlist');
    } finally {
      setActionLoading((prev) => ({ ...prev, [playlist.id]: false }));
    }
  };

  const handleCreateNewPlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    setCreating(true);
    setCreateError(null);
    try {
      const createRes = await createPlaylist({
        name: newPlaylistName.trim(),
        visibility: newPlaylistVisibility,
      });

      const newPl = createRes.playlist;
      // Immediately add the current video to the newly created playlist
      await addVideoToPlaylist(newPl.id, videoId);

      setPlaylists((prev) => [
        {
          id: newPl.id,
          name: newPl.name,
          visibility: newPl.visibility,
          videoCount: 1,
          containsVideo: true,
        },
        ...prev,
      ]);

      setNewPlaylistName('');
      setShowCreateForm(false);
    } catch (err) {
      const errRes = err.response?.data;
      setCreateError(errRes?.message || 'Failed to create playlist');
    } finally {
      setCreating(false);
    }
  };

  const getVisibilityIcon = (visibility) => {
    switch (visibility) {
      case 'PUBLIC':
        return <Globe className="w-3 h-3 text-emerald-500" />;
      case 'UNLISTED':
        return <Link2 className="w-3 h-3 text-amber-500" />;
      case 'PRIVATE':
      default:
        return <Lock className="w-3 h-3 text-slate-400" />;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Save to Playlist"
      maxWidth="max-w-sm"
    >
      <div className="space-y-4 pt-2">
        {/* Guest prompt */}
        {!user ? (
          <div className="p-4 text-center space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Please sign in to save videos to your playlists.
            </p>
            <Link
              to="/login"
              onClick={onClose}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="flex items-start space-x-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Playlist Checkbox List */}
            {loading ? (
              <div className="flex items-center justify-center py-8 space-x-2 text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span>Loading playlists...</span>
              </div>
            ) : playlists.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No playlists yet. Create your first playlist below!
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {playlists.map((playlist) => {
                  const isChecked = playlist.containsVideo;
                  const isBusy = actionLoading[playlist.id];

                  return (
                    <button
                      key={playlist.id}
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleTogglePlaylist(playlist)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left group"
                    >
                      <div className="flex items-center space-x-3 min-w-0 pr-2">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                            isChecked
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 group-hover:border-indigo-400'
                          }`}
                        >
                          {isBusy ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          ) : isChecked ? (
                            <Check className="w-3 h-3 stroke-[3]" />
                          ) : null}
                        </div>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {playlist.name}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5 flex-shrink-0">
                        {getVisibilityIcon(playlist.visibility)}
                        <span className="text-[10px] text-slate-400">
                          {playlist.videoCount}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Create New Playlist Accordion */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              {!showCreateForm ? (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center space-x-2 py-2 px-1 text-xs font-bold text-indigo-600 dark:text-cyan-400 hover:opacity-80 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create new playlist</span>
                </button>
              ) : (
                <form onSubmit={handleCreateNewPlaylist} className="space-y-3 pt-1">
                  {createError && (
                    <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-[11px] text-red-600 dark:text-red-400">
                      {createError}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={150}
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      placeholder="Enter playlist title"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Privacy
                    </label>
                    <select
                      value={newPlaylistVisibility}
                      onChange={(e) => setNewPlaylistVisibility(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="PRIVATE">Private</option>
                      <option value="UNLISTED">Unlisted</option>
                      <option value="PUBLIC">Public</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="xs"
                      disabled={creating || !newPlaylistName.trim()}
                    >
                      {creating ? 'Creating...' : 'Create'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default SaveToPlaylistModal;
