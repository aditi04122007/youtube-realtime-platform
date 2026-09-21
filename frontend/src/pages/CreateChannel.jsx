import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import {
  Tv,
  AtSign,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Eye,
  CheckCircle,
} from 'lucide-react';
import { createChannel } from '../services/api';
import { useAuth } from '../context/AuthContext';

const HANDLE_REGEX = /^[a-zA-Z0-9_.-]{3,50}$/;

const CreateChannel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    channel_name: '',
    handle: '',
    description: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cleanHandle = useMemo(() => {
    return formData.handle.replace(/^@+/, '').trim().toLowerCase();
  }, [formData.handle]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleHandleChange = (e) => {
    // Automatically sanitize handle input as user types
    const raw = e.target.value.replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    setFormData((prev) => ({ ...prev, handle: raw }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedName = formData.channel_name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError('Channel name must be at least 2 characters long');
      return;
    }

    if (!cleanHandle || !HANDLE_REGEX.test(cleanHandle)) {
      setError('Channel handle must be 3-50 characters and contain only letters, numbers, hyphens, and underscores');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await createChannel({
        channel_name: trimmedName,
        handle: cleanHandle,
        description: formData.description.trim() || null,
      });

      if (res && res.success && res.channel) {
        navigate(`/channel/${res.channel.handle || res.channel.id}`, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  const avatarInitial = (formData.channel_name.trim() || user?.display_name || 'C')
    .slice(0, 1)
    .toUpperCase();

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-4 py-6 pb-16">
      {/* Header */}
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
            Create Your Channel
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Set up your brand identity, unique handle, and start publishing content.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-2xl p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-3 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed font-medium">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Creation Form */}
        <Card className="lg:col-span-7 p-6 sm:p-8 space-y-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800/80 pb-3 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>Channel Details</span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Channel Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Channel Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  name="channel_name"
                  required
                  value={formData.channel_name}
                  onChange={handleChange}
                  maxLength={100}
                  placeholder="e.g. John's Tech Lab"
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <Tv className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              </div>
            </div>

            {/* Handle */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Unique Handle <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  name="handle"
                  required
                  value={formData.handle}
                  onChange={handleHandleChange}
                  maxLength={50}
                  placeholder="e.g. johnstechlab"
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <AtSign className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              </div>
              <p className="text-[11px] text-slate-400">
                Will be accessible as <span className="font-mono text-indigo-500">@{cleanHandle || 'handle'}</span>
              </p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  {formData.description.length}/1000
                </span>
              </div>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                maxLength={1000}
                rows={4}
                placeholder="What is your channel about? What content can viewers expect?"
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-y"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-3"
              isLoading={loading}
              disabled={loading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {loading ? 'Creating Channel...' : 'Create Channel'}
            </Button>
          </form>
        </Card>

        {/* Live Visual Preview */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 px-1">
            <Eye className="w-3.5 h-3.5" />
            <span>Live Channel Preview</span>
          </div>

          <Card className="overflow-hidden shadow-md">
            {/* Simulated Banner */}
            <div className="h-28 bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 relative" />

            {/* Channel Info */}
            <div className="p-5 pt-0 relative space-y-3">
              <div className="flex items-end space-x-3 -mt-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center text-white text-2xl font-bold ring-4 ring-white dark:ring-[#0f172a] shadow-md flex-shrink-0">
                  {avatarInitial}
                </div>
                <div className="pb-1">
                  <div className="flex items-center space-x-1.5">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                      {formData.channel_name.trim() || 'Your Channel Name'}
                    </h3>
                    <CheckCircle className="w-3.5 h-3.5 text-cyan-500 fill-current flex-shrink-0" />
                  </div>
                  <p className="text-[11px] font-semibold text-indigo-600 dark:text-cyan-400">
                    @{cleanHandle || 'handle'}
                  </p>
                </div>
              </div>

              <div className="text-[11px] text-slate-400">
                0 subscribers • 0 videos
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3">
                {formData.description.trim() || 'Your channel description will appear here...'}
              </p>

              <div className="pt-2">
                <div className="inline-block px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-400 cursor-not-allowed">
                  Subscribe (Preview)
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateChannel;
