import React, { useState, useEffect } from 'react';
import { FolderHeart, Plus, ListMusic, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../components/common/Button';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import Card from '../components/common/Card';
import PlaylistCard from '../components/playlists/PlaylistCard';
import CreatePlaylistModal from '../components/playlists/CreatePlaylistModal';
import { getPlaylists, deletePlaylist } from '../services/playlistService';
import { useAuth } from '../context/AuthContext';

const Playlists = () => {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [playlistToEdit, setPlaylistToEdit] = useState(null);
  const [playlistToDelete, setPlaylistToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPlaylists(1);
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchPlaylists = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPlaylists({ page, limit: 20 });
      setPlaylists(res.data || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your playlists');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (playlist) => {
    setPlaylistToEdit(playlist);
    setShowCreateModal(true);
  };

  const handleDelete = (playlist) => {
    setPlaylistToDelete(playlist);
  };

  const confirmDelete = async () => {
    if (!playlistToDelete) return;
    setIsDeleting(true);
    try {
      await deletePlaylist(playlistToDelete.id);
      setPlaylists((prev) => prev.filter((p) => p.id !== playlistToDelete.id));
      setPlaylistToDelete(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete playlist');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleModalSuccess = (savedPlaylist) => {
    // If updating, replace in array; if creating, prepend
    setPlaylists((prev) => {
      const exists = prev.find((p) => p.id === savedPlaylist.id);
      if (exists) {
        return prev.map((p) => (p.id === savedPlaylist.id ? { ...p, ...savedPlaylist } : p));
      }
      return [savedPlaylist, ...prev];
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Create / Edit Modal */}
      {showCreateModal && (
        <CreatePlaylistModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setPlaylistToEdit(null);
          }}
          playlistToEdit={playlistToEdit}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {playlistToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <Card className="max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Delete Playlist?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-slate-200">"{playlistToDelete.name || playlistToDelete.title}"</span>?
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPlaylistToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-cyan-400">
            <FolderHeart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Your Playlists
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {pagination.total > 0
                ? `${pagination.total} ${pagination.total === 1 ? 'collection' : 'collections'} created`
                : 'Create and organize custom video collections'}
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setPlaylistToEdit(null);
            setShowCreateModal(true);
          }}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New Playlist
        </Button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <Loading size="lg" message="Loading your playlists..." />
        </div>
      ) : playlists.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title="No playlists created yet"
          description="Create your first playlist to organize videos you want to watch or share with others."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Create Playlist
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {playlists.map((pl) => (
              <PlaylistCard
                key={pl.id}
                playlist={pl}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isOwner={true}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 pt-6">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchPlaylists(pagination.page - 1)}
              >
                Previous
              </Button>
              <span className="text-xs text-slate-500 px-3">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchPlaylists(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Playlists;
