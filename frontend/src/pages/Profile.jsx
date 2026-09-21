import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import {
  User,
  MapPin,
  Globe,
  Calendar,
  Tv,
  ArrowRight,
  Edit3,
  AlertCircle,
  ExternalLink,
  Video,
} from 'lucide-react';
import { getPublicProfile, getMediaUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';

const Profile = () => {
  const { userId } = useParams();
  const { user: authUser } = useAuth();

  const navigate = useNavigate();
  const { initiateCall } = useCall();

  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleStartCall = async () => {
    if (!authUser) {
      window.location.href = '/login';
      return;
    }
    if (!profileUser?.id) return;
    const res = await initiateCall(profileUser.id);
    if (res.success && res.callId) {
      navigate(`/call/${res.callId}`);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getPublicProfile(userId);
        if (isMounted) {
          if (data && data.success && data.user) {
            setProfileUser(data.user);
          } else {
            setError('User not found');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to load profile');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (userId) {
      fetchProfile();
    }

    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Loading profile...
        </p>
      </div>
    );
  }

  if (error || !profileUser) {
    return (
      <div className="max-w-md mx-auto my-12 px-4 text-center">
        <Card className="p-8 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            User Not Found
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {error || 'The profile you are looking for does not exist or has been deactivated.'}
          </p>
          <Link to="/">
            <Button variant="outline" size="sm" className="mt-2">
              Back to Home
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const isOwnProfile = authUser && Number(authUser.id) === Number(profileUser.id);
  const userInitials = (profileUser.display_name || profileUser.username || 'U')
    .slice(0, 2)
    .toUpperCase();

  const formattedJoinDate = profileUser.created_at
    ? new Date(profileUser.created_at).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'Recently';

  // Sanitize external website link
  let safeWebsiteUrl = profileUser.website;
  if (safeWebsiteUrl && !safeWebsiteUrl.startsWith('http://') && !safeWebsiteUrl.startsWith('https://')) {
    safeWebsiteUrl = `https://${safeWebsiteUrl}`;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-2 sm:px-4 pb-12">
      {/* Banner */}
      <div className="relative h-44 sm:h-64 rounded-3xl overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 shadow-sm">
        {profileUser.banner_url ? (
          <img
            src={getMediaUrl(profileUser.banner_url)}
            alt="Profile Banner"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-black/10" />
        )}
      </div>

      {/* Profile Header Card */}
      <div className="relative -mt-16 sm:-mt-20 px-4 sm:px-8">
        <Card className="p-6 sm:p-8 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            {/* Avatar and Identity */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-5">
              <div className="relative -mt-14 sm:-mt-16">
                {profileUser.avatar_url ? (
                  <img
                    src={getMediaUrl(profileUser.avatar_url)}
                    alt={profileUser.display_name || profileUser.username}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-white dark:ring-[#0f172a] shadow-md bg-white dark:bg-slate-900"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white text-3xl font-extrabold ring-4 ring-white dark:ring-[#0f172a] shadow-md">
                    {userInitials}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {profileUser.display_name || profileUser.username}
                </h1>
                <p className="text-xs font-semibold text-indigo-600 dark:text-cyan-400">
                  @{profileUser.username}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            {isOwnProfile ? (
              <Link to="/settings/profile">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Edit3 className="w-4 h-4" />}
                >
                  Edit Profile
                </Button>
              </Link>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartCall}
                leftIcon={<Video className="w-4 h-4" />}
              >
                Video Call
              </Button>
            )}
          </div>

          {/* Biography */}
          {profileUser.bio ? (
            <p className="mt-5 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed max-w-2xl">
              {profileUser.bio}
            </p>
          ) : (
            <p className="mt-5 text-xs text-slate-400 italic">
              No bio provided yet.
            </p>
          )}

          {/* Metadata Badges */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-slate-500 dark:text-slate-400">
            {profileUser.location && (
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                <span>{profileUser.location}</span>
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
                <span>{profileUser.website.replace(/^https?:\/\//, '')}</span>
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

      {/* Channel Showcase Card if user owns a channel */}
      {profileUser.channel && (
        <div className="px-4 sm:px-8">
          <Card className="p-6 border border-indigo-100 dark:border-indigo-950/50 bg-gradient-to-br from-white to-indigo-50/20 dark:from-[#0f172a] dark:to-indigo-950/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-cyan-400 flex items-center justify-center shadow-sm">
                  <Tv className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {profileUser.channel.channel_name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    @{profileUser.channel.handle} • {profileUser.channel.subscriber_count} subscribers
                  </p>
                </div>
              </div>

              <Link to={`/channel/${profileUser.channel.handle || profileUser.channel.id}`}>
                <Button
                  variant="primary"
                  size="sm"
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  Visit Channel
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Profile;
