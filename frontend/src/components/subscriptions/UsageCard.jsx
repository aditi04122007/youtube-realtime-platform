import React from 'react';
import { Video, HardDrive, FolderHeart, Download, Info } from 'lucide-react';

const formatStorageDisplay = (bytes = 0) => {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1000) {
    return `${mb.toFixed(1)} MB`;
  }
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(2)} GB`;
};

const MetricItem = ({ icon: Icon, title, usedDisplay, maxDisplay, percent, isUnlimited, note, colorClass }) => {
  const safePercent = isUnlimited ? 5 : Math.min(100, Math.max(0, percent || 0));

  return (
    <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col justify-between shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${colorClass} bg-opacity-10 dark:bg-opacity-20`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {title}
            </h4>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {usedDisplay}
              </span>
              <span className="text-xs text-slate-400">
                / {isUnlimited ? 'Unlimited' : maxDisplay}
              </span>
            </div>
          </div>
        </div>
        {isUnlimited && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300">
            VIP Unlimited
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            role="progressbar"
            aria-valuenow={isUnlimited ? 100 : safePercent}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label={`${title} usage`}
            className={`h-full rounded-full transition-all duration-300 ${
              isUnlimited
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500'
                : safePercent > 90
                ? 'bg-rose-500'
                : safePercent > 70
                ? 'bg-amber-500'
                : 'bg-indigo-600 dark:bg-cyan-500'
            }`}
            style={{ width: `${safePercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 font-medium">
          <span>{isUnlimited ? 'No quota limit' : `${safePercent.toFixed(0)}% used`}</span>
          {note && <span className="truncate ml-2">{note}</span>}
        </div>
      </div>
    </div>
  );
};

const UsageCard = ({ usage = {}, limits = {} }) => {
  const videosUsed = Number(usage.videosUploaded || 0);
  const maxVideos = Number(limits.maxVideoUploads ?? 10);
  const isUnlimitedVideos = maxVideos === 0;
  const videosPercent = isUnlimitedVideos ? 0 : (videosUsed / maxVideos) * 100;

  const storageUsedBytes = Number(usage.storageUsedBytes || 0);
  const storageUsedGb = Number(usage.storageUsedGb || (storageUsedBytes / (1024 * 1024 * 1024)));
  const maxStorageGb = Number(limits.maxStorageGb ?? 5);
  const isUnlimitedStorage = maxStorageGb === 0;
  const storagePercent = isUnlimitedStorage ? 0 : (storageUsedGb / maxStorageGb) * 100;

  const playlistsUsed = Number(usage.playlistsCreated || 0);
  const maxPlaylists = Number(limits.maxPlaylists ?? 10);
  const isUnlimitedPlaylists = maxPlaylists === 0;
  const playlistsPercent = isUnlimitedPlaylists ? 0 : (playlistsUsed / maxPlaylists) * 100;

  const downloadsUsed = Number(usage.downloadsUsed || 0);
  const isUnlimitedDownloads = Boolean(usage.isUnlimitedDownloads || limits.downloadLimit === null || (limits.downloadLimit ?? 0) >= 500);
  const maxDownloads = isUnlimitedDownloads ? 0 : Number(limits.downloadLimit ?? 0);
  const downloadsPercent = isUnlimitedDownloads ? 0 : maxDownloads > 0 ? (downloadsUsed / maxDownloads) * 100 : 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Resource Usage & Quotas
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time usage calculated authoritatively from your platform uploads and content.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Videos Metric */}
        <MetricItem
          icon={Video}
          title="Videos Uploaded"
          usedDisplay={videosUsed}
          maxDisplay={`${maxVideos} videos`}
          percent={videosPercent}
          isUnlimited={isUnlimitedVideos}
          colorClass="text-indigo-600 dark:text-indigo-400 bg-indigo-500"
        />

        {/* Storage Metric */}
        <MetricItem
          icon={HardDrive}
          title="Cloud Storage"
          usedDisplay={formatStorageDisplay(storageUsedBytes)}
          maxDisplay={`${maxStorageGb} GB`}
          percent={storagePercent}
          isUnlimited={isUnlimitedStorage}
          colorClass="text-cyan-600 dark:text-cyan-400 bg-cyan-500"
        />

        {/* Playlists Metric */}
        <MetricItem
          icon={FolderHeart}
          title="Playlists"
          usedDisplay={playlistsUsed}
          maxDisplay={`${maxPlaylists} lists`}
          percent={playlistsPercent}
          isUnlimited={isUnlimitedPlaylists}
          colorClass="text-emerald-600 dark:text-emerald-400 bg-emerald-500"
        />

        {/* Downloads Metric (Phase 20 Active) */}
        <MetricItem
          icon={Download}
          title="Offline Downloads"
          usedDisplay={downloadsUsed}
          maxDisplay={isUnlimitedDownloads ? 'Unlimited' : maxDownloads > 0 ? `${maxDownloads} / mo` : '0 / mo'}
          percent={downloadsPercent}
          isUnlimited={isUnlimitedDownloads}
          note={
            isUnlimitedDownloads
              ? 'Unrestricted monthly downloads'
              : maxDownloads > 0
              ? `${Math.max(0, maxDownloads - downloadsUsed)} remaining`
              : 'Upgrade to download'
          }
          colorClass="text-purple-600 dark:text-purple-400 bg-purple-500"
        />
      </div>
    </div>
  );
};

export default UsageCard;
