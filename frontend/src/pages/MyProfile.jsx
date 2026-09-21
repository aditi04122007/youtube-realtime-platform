import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import {
  User,
  MapPin,
  Globe,
  Mail,
  Calendar,
  Edit3,
  Tv,
  PlusCircle,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { getCurrentUserProfile, getMediaUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';

const MyProfile = () => {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchMyProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getCurrentUserProfile();
        if (isMounted) {
          if (data && data.success && data.user) {
            setProfile(data.user);
          } else {
            setError('Failed to load profile data');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Error loading profile');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMyProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Loading your profile...
        </p>
      </div>
    );
  }

  const currentUser = profile || authUser;
  const userInitials = (currentUser?.display_name || currentUser?.username || 'U')
    .slice(0, 2)
    .toUpperCase();

  const formattedJoinDate = currentUser?.created_at
    ? new Date(currentUser.created_at).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'Recently';

  let safeWebsiteUrl = currentUser?.website;
  if (safeWebsiteUrl && !safeWebsiteUrl.startsWith('http://') && !safeWebsiteUrl.startsWith('https://')) {
    safeWebsiteUrl = `https://${safeWebsiteUrl}`;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-2 sm:px-4 pb-12">
      {/* Banner */}
      <div className="relative h-44 sm:h-64 rounded-3xl overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 shadow-sm">
        {currentUser?.banner_url ? (
          <img
            src={getMediaUrl(currentUser.banner_url)}
            alt="My Profile Banner"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-black/10" />
        )}
      </div>

      {/* Header Info Card */}
      <div className="relative -mt-16 sm:-mt-20 px-4 sm:px-8">
        <Card className="p-6 sm:p-8 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            {/* Avatar & Identifiers */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-5">
              <div className="relative -mt-14 sm:-mt-16">
                {currentUser?.avatar_url ? (
                  <img
                    src={getMediaUrl(currentUser.avatar_url)}
                    alt={currentUser.display_name || currentUser.username}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-white dark:ring-[#0f172a] shadow-md bg-white dark:bg-slate-900"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white text-3xl font-extrabold ring-4 ring-white dark:ring-[#0f172a] shadow-md">
                    {userInitials}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {currentUser?.display_name || currentUser?.username}
                  </h1>
                  {currentUser?.role === 'ADMIN' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      ADMIN
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-indigo-600 dark:text-cyan-400">
                  @{currentUser?.username}
                </p>
              </div>
            </div>

            {/* Edit Profile Action */}
            <Link to="/settings/profile">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Edit3 className="w-4 h-4" />}
              >
                Edit Profile
              </Button>
            </Link>
          </div>

          {/* Bio */}
          {currentUser?.bio ? (
            <p className="mt-5 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed max-w-2xl">
              {currentUser.bio}
            </p>
          ) : (
            <div className="mt-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-500 flex items-center justify-between">
              <span>Tell the community about yourself by adding a bio.</span>
              <Link to="/settings/profile" className="text-indigo-600 dark:text-cyan-400 font-semibold hover:underline">
                Add Bio
              </Link>
            </div>
          )}

          {/* Metadata Badges */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-slate-500 dark:text-slate-400">
            {currentUser?.email && (
              <div className="flex items-center space-x-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{currentUser.email}</span>
              </div>
            )}

            {currentUser?.location && (
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                <span>{currentUser.location}</span>
              </div>
            )}

            {safeWebsiteUrl && (
              <a
                href={safeWebsiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1.5 text-indigo-600 dark:text-cyan-400 hover:underline font-medium"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{currentUser.website.replace(/^https?:\/\//, '')}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            <div className="flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Joined {formattedJoinDate}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Creator Channel Section */}
      <div className="px-4 sm:px-8 space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Creator Channel
        </h2>

        {currentUser?.channel ? (
          <Card className="p-6 border border-indigo-100 dark:border-indigo-950/50 bg-gradient-to-br from-white to-indigo-50/20 dark:from-[#0f172a] dark:to-indigo-950/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-cyan-400 flex items-center justify-center shadow-sm flex-shrink-0">
                  <Tv className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {currentUser.channel.channel_name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    @{currentUser.channel.handle} • {currentUser.channel.subscriber_count || 0} subscribers • {currentUser.channel.video_count || 0} videos
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Link to={`/channel/${currentUser.channel.handle || currentUser.channel.id}`}>
                  <Button
                    variant="primary"
                    size="sm"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    View Channel
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-6 sm:p-8 text-center space-y-4 border-dashed border-2 border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-cyan-400 mx-auto flex items-center justify-center">
              <Tv className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Create Your Creator Channel
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Set up your channel handle, upload artwork, and start building your audience.
              </p>
            </div>
            <Link to="/channel/create">
              <Button
                variant="primary"
                size="md"
                leftIcon={<PlusCircle className="w-4 h-4" />}
              >
                Create Channel
              </Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MyProfile;
