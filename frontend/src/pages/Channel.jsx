import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCall } from '../context/CallContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import {
  Bell,
  CheckCircle,
  Video,
  Info,
  Edit3,
  Camera,
  Image as ImageIcon,
  Eye,
  Calendar,
  User as UserIcon,
  X,
  AlertCircle,
  Share2,
} from 'lucide-react';
import {
  getChannelById,
  getChannelByHandle,
  updateChannel,
  uploadChannelAvatar,
  uploadChannelBanner,
  getMediaUrl,
  getChannelVideos,
} from '../services/api';
import VideoCard from '../components/VideoCard';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToChannel,
  unsubscribeFromChannel,
  getChannelSubscriptionStatus,
} from '../services/notificationService';

const Channel = () => {
  const { channelId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { initiateCall } = useCall();

  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('videos');

  // Channel videos state
  const [videos, setVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);

  // Subscribe UI state (Phase 22 Real-time Subscriptions)
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subCount, setSubCount] = useState(0);
  const [subscribing, setSubscribing] = useState(false);

  // Edit Channel Modal state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const fetchChannelData = async () => {
    try {
      setLoading(true);
      setError('');

      let res;
      // If purely numeric, try by ID first, else by handle
      if (/^\d+$/.test(channelId)) {
        try {
          res = await getChannelById(channelId);
        } catch {
          res = await getChannelByHandle(channelId);
        }
      } else {
        res = await getChannelByHandle(channelId);
      }

      if (res.data?.success && res.data?.data) {
        const cData = res.data.data;
        setChannel(cData);
        setSubCount(Number(cData.subscribers_count || cData.subscriber_count) || 0);
        setEditForm({
          name: cData.name || '',
          description: cData.description || '',
        });

        if (isAuthenticated && cData.id) {
          getChannelSubscriptionStatus(cData.id)
            .then((statusRes) => {
              if (statusRes?.success) {
                setIsSubscribed(statusRes.isSubscribed);
                if (typeof statusRes.subscriberCount === 'number') {
                  setSubCount(statusRes.subscriberCount);
                }
              }
            })
            .catch(() => {});
        }
      } else {
        setError('Channel not found');
      }
    } catch (err) {
      console.error('Failed to load channel:', err);
      setError(err.response?.data?.message || 'Failed to load channel details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribeToggle = async () => {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }
    if (subscribing || !channel?.id) return;
    setSubscribing(true);
    try {
      if (isSubscribed) {
        const res = await unsubscribeFromChannel(channel.id);
        if (res?.success) {
          setIsSubscribed(false);
          setSubCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        const res = await subscribeToChannel(channel.id);
        if (res?.success) {
          setIsSubscribed(true);
          setSubCount((prev) => prev + 1);
        }
      }
    } catch (err) {
      console.error('Channel subscribe error:', err);
    } finally {
      setSubscribing(false);
    }
  };

  const handleStartCall = async () => {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }
    if (!channel?.user_id) return;
    const res = await initiateCall(channel.user_id);
    if (res.success && res.callId) {
      navigate(`/call/${res.callId}`);
    }
  };

  useEffect(() => {
    if (channelId) {
      fetchChannelData();
    }
  }, [channelId]);

  useEffect(() => {
    if (channel && channel.id) {
      const loadVideos = async () => {
        try {
          setVideosLoading(true);
          const res = await getChannelVideos(channel.id);
          if (res && res.success) {
            setVideos(res.data || []);
          }
        } catch (err) {
          console.error('Failed to load channel videos:', err);
        } finally {
          setVideosLoading(false);
        }
      };
      loadVideos();
    }
  }, [channel?.id]);

  const isOwner = isAuthenticated && user && channel && user.id === channel.user_id;

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleBannerChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveChannel = async (e) => {
    e.preventDefault();
    setSaving(true);
    setEditError('');
    setEditSuccess('');

    try {
      // 1. Update text metadata
      await updateChannel({
        name: editForm.name.trim(),
        description: editForm.description.trim(),
      });

      // 2. Upload avatar if selected
      if (avatarFile) {
        const avatarFormData = new FormData();
        avatarFormData.append('avatar', avatarFile);
        await uploadChannelAvatar(avatarFormData);
      }

      // 3. Upload banner if selected
      if (bannerFile) {
        const bannerFormData = new FormData();
        bannerFormData.append('banner', bannerFile);
        await uploadChannelBanner(bannerFormData);
      }

      setEditSuccess('Channel updated successfully!');
      // Refresh channel state
      await fetchChannelData();

      setTimeout(() => {
        setIsEditing(false);
        setAvatarFile(null);
        setBannerFile(null);
        setAvatarPreview(null);
        setBannerPreview(null);
        setEditSuccess('');
      }, 1200);
    } catch (err) {
      console.error('Error updating channel:', err);
      setEditError(err.response?.data?.message || 'Failed to update channel details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading channel...</p>
        </div>
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Channel Not Found</h2>
        <p className="text-sm text-slate-500">
          {error || "The channel you are looking for doesn't exist or has been removed."}
        </p>
        <div className="pt-2">
          <Link to="/">
            <Button variant="primary" size="md">
              Return Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const channelAvatarSrc = getMediaUrl(channel.avatar_url);
  const channelBannerSrc = getMediaUrl(channel.banner_url);
  const initialLetter = (channel.name || 'C').charAt(0).toUpperCase();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Channel Banner */}
      <div className="relative h-32 sm:h-48 md:h-64 rounded-3xl overflow-hidden shadow-sm bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500">
        {channelBannerSrc ? (
          <img
            src={channelBannerSrc}
            alt={`${channel.name} Banner`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
            <span className="text-white/40 text-sm font-medium">StreamWave Channel</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

        {isOwner && (
          <button
            onClick={() => setIsEditing(true)}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs font-semibold backdrop-blur transition-colors flex items-center space-x-1.5 shadow-md"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Customize Channel</span>
          </button>
        )}
      </div>

      {/* Channel Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-2">
        <div className="flex items-start sm:items-center space-x-3.5 sm:space-x-4 min-w-0">
          {/* Channel Avatar */}
          <div className="relative -mt-10 sm:-mt-16 ring-4 ring-white dark:ring-[#0a0e17] rounded-full overflow-hidden shadow-xl w-20 h-20 sm:w-28 sm:h-28 bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white text-2xl sm:text-3xl font-extrabold flex-shrink-0">
            {channelAvatarSrc ? (
              <img
                src={channelAvatarSrc}
                alt={channel.name}
                className="w-full h-full object-cover"
              />
            ) : (
              initialLetter
            )}
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white break-words">
                {channel.name}
              </h1>
              {channel.is_verified ? (
                <span title="Verified Channel">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-500 fill-current" />
                </span>
              ) : null}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                @{channel.handle}
              </span>{' '}
              • {subCount} subscribers • {channel.videos_count || 0} videos
            </p>

            {channel.description && (
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl line-clamp-2 pt-0.5 break-words">
                {channel.description}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
          {isOwner ? (
            <Button
              variant="outline"
              size="md"
              leftIcon={<Edit3 className="w-4 h-4" />}
              onClick={() => setIsEditing(true)}
            >
              Customize Channel
            </Button>
          ) : (
            <>
              <Button
                variant={isSubscribed ? 'outline' : 'primary'}
                size="md"
                disabled={subscribing}
                onClick={handleSubscribeToggle}
                leftIcon={<Bell className={`w-4 h-4 ${isSubscribed ? 'fill-current' : ''}`} />}
              >
                {isSubscribed ? 'Subscribed' : 'Subscribe'}
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={handleStartCall}
                leftIcon={<Video className="w-4 h-4 text-indigo-600 dark:text-cyan-400" />}
              >
                Video Call
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="md"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                alert('Channel link copied to clipboard!');
              }
            }}
            title="Share Channel"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-6 border-b border-slate-200 dark:border-slate-800 text-sm font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('videos')}
          className={`pb-3 border-b-2 flex items-center space-x-2 transition-colors ${
            activeTab === 'videos'
              ? 'border-indigo-600 text-indigo-600 dark:text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>Videos ({videos.length || channel.videos_count || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('about')}
          className={`pb-3 border-b-2 flex items-center space-x-2 transition-colors ${
            activeTab === 'about'
              ? 'border-indigo-600 text-indigo-600 dark:text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Info className="w-4 h-4" />
          <span>About</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'videos' && (
        <div className="space-y-4">
          {videosLoading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-2">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500">Loading videos...</p>
            </div>
          ) : videos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {videos.map((vid) => (
                <VideoCard key={vid.id} video={vid} />
              ))}
            </div>
          ) : (
            <div className="p-12 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
              <Video className="w-12 h-12 mx-auto text-slate-400" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                No Published Videos Yet
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {isOwner
                  ? "You haven't published any videos to this channel yet. Upload your first video to share with your audience."
                  : 'This channel has not uploaded any public videos yet.'}
              </p>
              {isOwner && (
                <div className="pt-2">
                  <Link to="/upload">
                    <Button variant="primary" size="sm">
                      Upload Video
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Description</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                {channel.description || 'This channel has not added a description yet.'}
              </p>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-6 space-y-4 text-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Channel Stats</h3>
              <div className="space-y-3 text-slate-600 dark:text-slate-300">
                <div className="flex items-center space-x-2.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>
                    Joined {channel.created_at ? new Date(channel.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Recently'}
                  </span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <Eye className="w-4 h-4 text-slate-400" />
                  <span>{channel.views_count || 0} total views</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  <span>
                    Owner Profile:{' '}
                    <Link
                      to={`/profile/${channel.user_id}`}
                      className="text-indigo-600 dark:text-cyan-400 font-semibold hover:underline"
                    >
                      View User Profile
                    </Link>
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Customize Channel Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-indigo-500" />
                <span>Customize Channel</span>
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {editSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs">
                {editSuccess}
              </div>
            )}

            <form onSubmit={handleSaveChannel} className="space-y-4 text-xs">
              {/* Channel Avatar Uploader */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Channel Avatar
                </label>
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center ring-2 ring-indigo-500/20">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : channelAvatarSrc ? (
                      <img src={channelAvatarSrc} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      id="channel-avatar-input"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="channel-avatar-input"
                      className="cursor-pointer inline-flex items-center px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5 mr-1.5" />
                      Choose New Avatar
                    </label>
                    <p className="text-[11px] text-slate-400 mt-1">JPEG, PNG, WebP up to 5MB</p>
                  </div>
                </div>
              </div>

              {/* Channel Banner Uploader */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Channel Banner
                </label>
                <div className="space-y-2">
                  <div className="h-24 w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 relative ring-2 ring-indigo-500/20">
                    {bannerPreview ? (
                      <img src={bannerPreview} alt="Banner Preview" className="w-full h-full object-cover" />
                    ) : channelBannerSrc ? (
                      <img src={channelBannerSrc} alt="Banner" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      id="channel-banner-input"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleBannerChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="channel-banner-input"
                      className="cursor-pointer inline-flex items-center px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                      Choose New Banner
                    </label>
                    <p className="text-[11px] text-slate-400 mt-1">JPEG, PNG, WebP up to 5MB (16:9 or banner ratio recommended)</p>
                  </div>
                </div>
              </div>

              {/* Name */}
              <Input
                label="Channel Name"
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                placeholder="Channel display name"
              />

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Channel Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={4}
                  placeholder="Tell viewers about your channel..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={saving}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Channel;
