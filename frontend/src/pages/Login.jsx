import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { Lock, Mail, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { login, completeLoginWithOtp, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Step-up OTP state (Phase 5)
  const [requireOtp, setRequireOtp] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpMessage, setOtpMessage] = useState('');

  // If already logged in, redirect
  const redirectTarget = location.state?.from?.pathname || '/';

  React.useEffect(() => {
    if (user) {
      navigate(redirectTarget, { replace: true });
    }
  }, [user, navigate, redirectTarget]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!formData.password) {
      setError('Please enter your password');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await login({
        email: formData.email.trim(),
        password: formData.password,
      });

      // Suspicious login / step-up OTP challenge
      if (res && res.requireOtp) {
        setRequireOtp(true);
        setTempToken(res.tempToken);
        setOtpMessage(res.message || 'Security verification required. Enter the code sent to your email.');
        return;
      }

      navigate(redirectTarget, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLoginOtp = async (e) => {
    e.preventDefault();

    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setError('Please enter a valid 6-digit verification code');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await completeLoginWithOtp({
        tempToken,
        otp: otpCode.trim(),
      });
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[75vh] px-4 py-8">
      <Card className="w-full max-w-md p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-cyan-400 mx-auto flex items-center justify-center shadow-sm">
            {requireOtp ? <ShieldCheck className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {requireOtp ? 'Two-Factor Verification' : 'Welcome Back'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {requireOtp
              ? otpMessage || 'Enter the 6-digit code sent to your email to verify your sign in.'
              : 'Sign in to access your subscriptions, saved playlists, and call rooms.'}
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="rounded-xl p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Standard Password Login Form */}
        {!requireOtp ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <div className="relative flex items-center">
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                  autoComplete="email"
                  disabled={loading}
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-60"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] text-indigo-600 dark:text-cyan-400 hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full h-10 pl-9 pr-10 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-60"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute right-2.5 rounded-lg focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
        ) : (
          /* Step-Up OTP Verification Form */
          <form onSubmit={handleVerifyLoginOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                6-Digit Login Verification Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                autoFocus
                className="w-full h-12 text-center tracking-widest text-xl font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              isLoading={loading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Verify & Complete Sign In
            </Button>

            <button
              type="button"
              onClick={() => {
                setRequireOtp(false);
                setOtpCode('');
                setError(null);
              }}
              className="w-full flex items-center justify-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 pt-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Credentials</span>
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="text-indigo-600 dark:text-cyan-400 font-semibold hover:underline"
          >
            Register here
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default Login;
