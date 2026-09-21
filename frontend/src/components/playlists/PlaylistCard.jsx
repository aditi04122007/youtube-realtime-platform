import React from 'react';
import { Link } from 'react-router-dom';
import { ListMusic, Lock, Globe, Link2, MoreVertical, Edit2, Trash2, Play } from 'lucide-react';
import Card from '../common/Card';
import { getMediaUrl } from '../../services/api';
import { timeAgo } from '../../utils/timeAgo';

const PlaylistCard = ({
  playlist,
  onEdit = null,
  onDelete = null,
  isOwner = true,
}) => {
  if (!playlist) return null;

  const {
    id,
    name,
    title,
    description,
    visibility = 'PRIVATE',
    thumbnailUrl,
    videoCount = 0,
    updatedAt,
    createdAt,
  } = playlist;

  const displayName = name || title || 'Untitled Playlist';
  const resolvedThumbnail = thumbnailUrl ? getMediaUrl(thumbnailUrl) : null;

  const getVisibilityIcon = () => {
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

  const getVisibilityLabel = () => {
    switch (visibility) {
      case 'PUBLIC':
        return 'Public';
      case 'UNLISTED':
        return 'Unlisted';
      case 'PRIVATE':
      default:
        return 'Private';
    }
  };

  return (
    <Card hoverEffect className="group flex flex-col overflow-hidden h-full border border-slate-200/80 dark:border-slate-800/80">
      {/* 1. Artwork Thumbnail */}
      <Link to={`/playlist/${id}`} className="block relative aspect-video w-full bg-slate-900 overflow-hidden">
        {resolvedThumbnail ? (
          <img
            src={resolvedThumbnail}
            alt={displayName}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-indigo-400">
            <ListMusic className="w-12 h-12 opacity-60 group-hover:scale-110 transition-transform duration-300" />
          </div>
        )}

        {/* Video count overlay banner */}
        <div className="absolute inset-y-0 right-0 w-24 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white px-2 space-y-1">
          <ListMusic className="w-5 h-5" />
          <span className="text-xs font-bold">{videoCount}</span>
          <span className="text-[10px] text-slate-300 uppercase tracking-wider">videos</span>
        </div>

        {/* Play overlay hover indicator */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>
      </Link>

      {/* 2. Body Details */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <Link
              to={`/playlist/${id}`}
              className="font-bold text-sm sm:text-base text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-cyan-400 transition-colors line-clamp-1"
              title={displayName}
            >
              {displayName}
            </Link>

            {/* Owner Actions */}
            {isOwner && (
              <div className="flex items-center space-x-1 flex-shrink-0">
                {onEdit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onEdit(playlist);
                    }}
                    title="Edit playlist"
                    className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-cyan-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete(playlist);
                    }}
                    title="Delete playlist"
                    className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* 3. Footer Metadata */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center space-x-1.5">
            {getVisibilityIcon()}
            <span className="font-medium text-[11px]">{getVisibilityLabel()}</span>
          </div>

          <span className="text-[11px]">
            {updatedAt ? `Updated ${timeAgo(updatedAt)}` : createdAt ? `Created ${timeAgo(createdAt)}` : ''}
          </span>
        </div>
      </div>
    </Card>
  );
};

export default PlaylistCard;
