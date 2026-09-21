import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import {
  UserPlus,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Smile,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const { register, login, user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    email: '',
    password: '',
    confirm_password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // If already logged in, redirect
  React.useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  // Password requirements calculation
  const passwordChecks = useMemo(() => {
    const p = formData.password;
    return {
      hasMinLength: p.length >= 8,
      hasLetter: /[a-zA-Z]/.test(p),
      hasNumber: /[0-9]/.test(p),
      hasSpecial: /[^a-zA-Z0-9]/.test(p),
      matchesConfirm: p.length > 0 && p === formData.confirm_password,
    };
  }, [formData.password, formData.confirm_password]);

  // Password Strength Score (0 to 4)
  const strengthScore = useMemo(() => {
    let score = 0;
    if (formData.password.length >= 8) score++;
    if (/[a-z]/.test(formData.password) && /[A-Z]/.test(formData.password)) score++;
    if (/[0-9]/.test(formData.password)) score++;
    if (/[^a-zA-Z0-9]/.test(formData.password)) score++;
    return score;
  }, [formData.password]);

  const strengthConfig = useMemo(() => {
    switch (strengthScore) {
      case 1:
        return { label: 'Weak', color: 'bg-rose-500', text: 'text-rose-500', width: 'w-1/4' };
      case 2:
        return { label: 'Fair', color: 'bg-amber-500', text: 'text-amber-500', width: 'w-2/4' };
      case 3:
        return { label: 'Good', color: 'bg-indigo-500', text: 'text-indigo-500', width: 'w-3/4' };
      case 4:
        return { label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-500', width: 'w-full' };
      default:
        return { label: '', color: 'bg-slate-200 dark:bg-slate-800', text: '', width: 'w-0' };
    }
  }, [strengthScore]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Client-side validations
    const trimmedUsername = formData.username.trim();
    if (!trimmedUsername || trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }
    if (trimmedUsername.length > 30) {
      setError('Username must not exceed 30 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      setError('Username may only contain letters, numbers, underscores, and hyphens');
      return;
    }

    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please provide a valid email address');
      return;
    }

    if (!passwordChecks.hasMinLength) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!passwordChecks.hasLetter || !passwordChecks.hasNumber) {
      setError('Password must contain both letters and numbers');
      return;
    }

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Execute Registration
      await register({
        username: trimmedUsername,
        display_name: formData.display_name.trim() || trimmedUsername,
        email: trimmedEmail,
        password: formData.password,
      });

      // 2. Seamlessly authenticate the new user
      await login({
        email: trimmedEmail,
        password: formData.password,
      });

      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[85vh] px-4 py-8">
      <Card className="w-full max-w-lg p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-cyan-400 mx-auto flex items-center justify-center shadow-sm">
            <UserPlus className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Create an Account
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Join the platform to share videos, subscribe to creators, and join call rooms.
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="rounded-xl p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Username <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  name="username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="john_doe"
                  disabled={loading}
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-60"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              </div>
            </div>

            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Display Name <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  name="display_name"
                  value={formData.display_name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  disabled={loading}
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-60"
                />
                <Smile className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="name@example.com"
                disabled={loading}
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-60"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                disabled={loading}
                className="w-full h-10 pl-9 pr-10 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-60"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute right-2.5 rounded-lg focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Strength Meter */}
            {formData.password && (
              <div className="pt-1.5 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">Password strength:</span>
                  <span className={`font-semibold ${strengthConfig.text}`}>
                    {strengthConfig.label}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${strengthConfig.color} ${strengthConfig.width} transition-all duration-300`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Confirm Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirm_password"
                required
                value={formData.confirm_password}
                onChange={handleChange}
                placeholder="••••••••"
                disabled={loading}
                className="w-full h-10 pl-9 pr-10 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-60"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute right-2.5 rounded-lg focus:outline-none"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Requirements Checklist */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-800/80 text-[11px] space-y-1.5 text-slate-600 dark:text-slate-400">
            <div className="flex items-center space-x-2">
              {passwordChecks.hasMinLength ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
              )}
              <span className={passwordChecks.hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                At least 8 characters
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {passwordChecks.hasLetter && passwordChecks.hasNumber ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
              )}
              <span
                className={
                  passwordChecks.hasLetter && passwordChecks.hasNumber
                    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                    : ''
                }
              >
                Contains letters and numbers
              </span>
            </div>

            {formData.confirm_password && (
              <div className="flex items-center space-x-2">
                {passwordChecks.matchesConfirm ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                )}
                <span
                  className={
                    passwordChecks.matchesConfirm
                      ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                      : 'text-rose-600 dark:text-rose-400 font-medium'
                  }
                >
                  {passwordChecks.matchesConfirm ? 'Passwords match' : 'Passwords do not match'}
                </span>
              </div>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full mt-2"
            isLoading={loading}
            disabled={loading}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </form>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-indigo-600 dark:text-cyan-400 font-semibold hover:underline"
          >
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default Register;
