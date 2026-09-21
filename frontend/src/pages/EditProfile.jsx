import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import {
  User,
  MapPin,
  Globe,
  Upload,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Smile,
} from 'lucide-react';
import {
  getCurrentUserProfile,
  updateProfile,
  uploadAvatar,
  uploadBanner,
  getMediaUrl,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = ['image/jpeg', 'image/png', 'image/webp'];

const EditProfile = () => {
  const { updateUserState } = useAuth();
  const navigate = useNavigate();

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingDetails, setSavingDetails] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [feedback, setFeedback] = useState({ type: null, message: '' });

  // Form states
  const [formData, setFormData] = useState({
    display_name: '',
    bio: '',
    location: '',
    website: '',
  });

  // Current images & preview states
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(null);
  const [currentBannerUrl, setCurrentBannerUrl] = useState(null);

  const [avatarPreview, setAvatarPreview] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);

  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  // Load existing profile details
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoadingProfile(true);
        const data = await getCurrentUserProfile();
        if (data && data.success && data.user) {
          const u = data.user;
          setFormData({
            display_name: u.display_name || '',
            bio: u.bio || '',
            location: u.location || '',
            website: u.website || '',
          });
          setCurrentAvatarUrl(u.avatar_url);
          setCurrentBannerUrl(u.banner_url);
        }
      } catch (err) {
        setFeedback({
          type: 'error',
          message: err.message || 'Failed to load profile details',
        });
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (feedback.type) setFeedback({ type: null, message: '' });
  };

  // Avatar file selection & upload
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_EXTENSIONS.includes(file.type)) {
      setFeedback({
        type: 'error',
        message: 'Invalid file format. Please select a JPEG, PNG, or WebP image.',
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFeedback({
        type: 'error',
        message: 'Avatar image must not exceed 5 MB.',
      });
      return;
    }

    setAvatarPreview(URL.createObjectURL(file));
    uploadAvatarFile(file);
  };

  const uploadAvatarFile = async (file) => {
    try {
      setUploadingAvatar(true);
      setFeedback({ type: null, message: '' });
      const uploadFormData = new FormData();
      uploadFormData.append('avatar', file);

      const res = await uploadAvatar(uploadFormData);
      if (res && res.success) {
        setCurrentAvatarUrl(res.avatar_url);
        setAvatarPreview(null);
        updateUserState({ avatar_url: res.avatar_url });
        setFeedback({
          type: 'success',
          message: 'Profile avatar updated successfully!',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Avatar upload failed',
      });
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // Banner file selection & upload
  const handleBannerChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_EXTENSIONS.includes(file.type)) {
      setFeedback({
        type: 'error',
        message: 'Invalid file format. Please select a JPEG, PNG, or WebP image.',
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFeedback({
        type: 'error',
        message: 'Banner image must not exceed 5 MB.',
      });
      return;
    }

    setBannerPreview(URL.createObjectURL(file));
    uploadBannerFile(file);
  };

  const uploadBannerFile = async (file) => {
    try {
      setUploadingBanner(true);
      setFeedback({ type: null, message: '' });
      const uploadFormData = new FormData();
      uploadFormData.append('banner', file);

      const res = await uploadBanner(uploadFormData);
      if (res && res.success) {
        setCurrentBannerUrl(res.banner_url);
        setBannerPreview(null);
        setFeedback({
          type: 'success',
          message: 'Profile banner updated successfully!',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Banner upload failed',
      });
      setBannerPreview(null);
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  // Profile text details submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.bio.length > 500) {
      setFeedback({
        type: 'error',
        message: 'Bio cannot exceed 500 characters',
      });
      return;
    }

    try {
      setSavingDetails(true);
      setFeedback({ type: null, message: '' });

      const res = await updateProfile(formData);
      if (res && res.success) {
        updateUserState({ display_name: formData.display_name });
        setFeedback({
          type: 'success',
          message: 'Profile details saved successfully!',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update profile',
      });
    } finally {
      setSavingDetails(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Loading profile settings...
        </p>
      </div>
    );
  }

  const activeAvatarSrc = avatarPreview || getMediaUrl(currentAvatarUrl);
  const activeBannerSrc = bannerPreview || getMediaUrl(currentBannerUrl);

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-4 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link to="/profile">
            <button
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Back to Profile"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Edit Profile
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Update your public profile, bio, and visual branding.
            </p>
          </div>
        </div>

        <Link to="/profile">
          <Button variant="outline" size="sm">
            View Profile
          </Button>
        </Link>
      </div>

      {/* Feedback Banner */}
      {feedback.message && (
        <div
          className={`rounded-2xl p-4 text-xs flex items-start space-x-3 animate-in fade-in duration-200 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
          )}
          <span className="leading-relaxed font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Media Uploads Card */}
      <Card className="p-6 sm:p-8 space-y-6">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800/80 pb-3">
          Profile Artwork
        </h2>

        {/* Banner Section */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Profile Banner <span className="text-slate-400 font-normal">(Max 5 MB • JPEG, PNG, WebP)</span>
          </label>

          <div className="relative h-36 sm:h-48 rounded-2xl overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 shadow-inner group">
            {activeBannerSrc ? (
              <img
                src={activeBannerSrc}
                alt="Banner Preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/70 text-xs font-medium">
                Default Gradient Banner
              </div>
            )}

            {/* Overlay button */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => bannerInputRef.current?.click()}
                isLoading={uploadingBanner}
                leftIcon={<ImageIcon className="w-4 h-4" />}
              >
                {uploadingBanner ? 'Uploading...' : 'Change Banner'}
              </Button>
            </div>
          </div>

          <input
            type="file"
            ref={bannerInputRef}
            onChange={handleBannerChange}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
          />
        </div>

        {/* Avatar Section */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Profile Avatar <span className="text-slate-400 font-normal">(Max 5 MB • JPEG, PNG, WebP)</span>
          </label>

          <div className="flex items-center space-x-4">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-2 ring-indigo-500/20 bg-slate-100 dark:bg-slate-800 flex-shrink-0">
              {activeAvatarSrc ? (
                <img
                  src={activeAvatarSrc}
                  alt="Avatar Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold">
                  {formData.display_name.slice(0, 2).toUpperCase() || 'U'}
                </div>
              )}

              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => avatarInputRef.current?.click()}
                isLoading={uploadingAvatar}
                leftIcon={<Camera className="w-4 h-4" />}
              >
                Change Avatar
              </Button>
              <p className="text-[11px] text-slate-400">
                Square format recommended (e.g. 500x500 px)
              </p>
            </div>

            <input
              type="file"
              ref={avatarInputRef}
              onChange={handleAvatarChange}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />
          </div>
        </div>
      </Card>

      {/* Details Form Card */}
      <Card className="p-6 sm:p-8 space-y-6">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800/80 pb-3">
          Profile Details
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Display Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Display Name
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                name="display_name"
                value={formData.display_name}
                onChange={handleChange}
                maxLength={100}
                placeholder="How your name appears publicly"
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <Smile className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Biography
              </label>
              <span className={`text-[11px] ${formData.bio.length > 450 ? 'text-amber-500 font-semibold' : 'text-slate-400'}`}>
                {formData.bio.length}/500
              </span>
            </div>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              maxLength={500}
              rows={4}
              placeholder="Tell viewers and collaborators about yourself..."
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-y"
            />
          </div>

          {/* Location & Website Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Location */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Location
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  maxLength={100}
                  placeholder="e.g. San Francisco, USA"
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              </div>
            </div>

            {/* Website */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Website URL
              </label>
              <div className="relative flex items-center">
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  maxLength={255}
                  placeholder="https://yourwebsite.com"
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <Globe className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end space-x-3">
            <Link to="/profile">
              <Button variant="ghost" size="md" disabled={savingDetails}>
                Cancel
              </Button>
            </Link>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={savingDetails}
              disabled={savingDetails}
            >
              {savingDetails ? 'Saving Changes...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default EditProfile;
