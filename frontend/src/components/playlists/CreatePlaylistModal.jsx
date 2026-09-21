import React, { useState, useEffect } from 'react';
import { Lock, Link2, Globe, AlertCircle, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { createPlaylist, updatePlaylist } from '../../services/playlistService';

const CreatePlaylistModal = ({
  isOpen,
  onClose,
  onSuccess,
  playlistToEdit = null,
}) => {
  const isEditing = Boolean(playlistToEdit);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('PRIVATE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [limitError, setLimitError] = useState(null);

  useEffect(() => {
    if (playlistToEdit) {
      setName(playlistToEdit.name || playlistToEdit.title || '');
      setDescription(playlistToEdit.description || '');
      setVisibility(playlistToEdit.visibility || 'PRIVATE');
    } else {
      setName('');
      setDescription('');
      setVisibility('PRIVATE');
    }
    setError(null);
    setLimitError(null);
  }, [playlistToEdit, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a playlist name.');
      return;
    }

    setLoading(true);
    setError(null);
    setLimitError(null);

    try {
      if (isEditing) {
        const res = await updatePlaylist(playlistToEdit.id, {
          name: name.trim(),
          description: description.trim(),
          visibility,
        });
        if (onSuccess) onSuccess(res.playlist || res);
      } else {
        const res = await createPlaylist({
          name: name.trim(),
          description: description.trim(),
          visibility,
        });
        if (onSuccess) onSuccess(res.playlist || res);
      }
      onClose();
    } catch (err) {
      const errRes = err.response?.data;
      if (errRes?.code === 'PLAYLIST_LIMIT_REACHED') {
        setLimitError({
          message: errRes.message || 'You have reached the playlist limit for your current plan.',
          limit: errRes.limit,
          used: errRes.used,
        });
      } else {
        setError(errRes?.message || err.message || 'Failed to save playlist. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Playlist' : 'Create New Playlist'}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {/* Error Alert */}
        {error && (
          <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Plan Limit Exceeded Alert with Upgrade CTA */}
        {limitError && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-2.5 text-xs text-amber-800 dark:text-amber-300">
            <div className="flex items-start space-x-2">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Playlist Limit Reached</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                  {limitError.message}
                </p>
              </div>
            </div>
            <Link
              to="/subscription-dashboard"
              onClick={onClose}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <span>Upgrade Plan</span>
            </Link>
          </div>
        )}

        {/* Playlist Name Input */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Playlist Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            maxLength={150}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Favorite Coding Tutorials"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          />
          <div className="flex justify-end text-[10px] text-slate-400">
            {name.length} / 150
          </div>
        </div>

        {/* Description Input */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Description <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <textarea
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Briefly describe what this playlist is about..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors resize-none"
          />
        </div>

        {/* Visibility Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Privacy
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setVisibility('PRIVATE')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                visibility === 'PRIVATE'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-cyan-400 ring-1 ring-indigo-500'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Lock className="w-4 h-4 mb-1" />
              <span className="text-xs font-bold">Private</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Only you</span>
            </button>

            <button
              type="button"
              onClick={() => setVisibility('UNLISTED')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                visibility === 'UNLISTED'
                  ? 'border-amber-600 bg-amber-50/50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Link2 className="w-4 h-4 mb-1" />
              <span className="text-xs font-bold">Unlisted</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Link only</span>
            </button>

            <button
              type="button"
              onClick={() => setVisibility('PUBLIC')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                visibility === 'PUBLIC'
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Globe className="w-4 h-4 mb-1" />
              <span className="text-xs font-bold">Public</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Anyone</span>
            </button>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={loading || !name.trim()}
          >
            {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Playlist'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreatePlaylistModal;
