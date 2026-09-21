import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import {
  KeyRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { forgotPassword, verifyResetOtp, resetPassword } from '../services/api';

const ForgotPassword = () => {
  const navigate = useNavigate();

  // Multi-step progress (1: Email, 2: OTP, 3: New Password, 4: Success)
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend timer countdown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Step 1: Request Reset Code
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await forgotPassword(email.trim());
      setStep(2);
      setResendCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to request reset code');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await verifyResetOtp({ email: email.trim(), otp: otp.trim() });
      if (res.success && res.resetToken) {
        setResetToken(res.resetToken);
        setStep(3);
      } else {
        setError(res.message || 'Invalid code');
      }
    } catch (err) {
      setError(err.message || 'Failed to verify code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!passwords.newPassword || passwords.newPassword.length < 8) {
      setError('New password must be at least 8 characters with letters and numbers');
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await resetPassword({
        resetToken,
        newPassword: passwords.newPassword,
        confirmPassword: passwords.confirmPassword,
      });
      setStep(4);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[75vh] px-4 py-8">
      <Card className="w-full max-w-md p-6 sm:p-8 space-y-6">
        {/* Progress Step Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-cyan-400 mx-auto flex items-center justify-center shadow-sm">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {step === 1 && 'Reset Your Password'}
            {step === 2 && 'Enter Verification Code'}
            {step === 3 && 'Choose a New Password'}
            {step === 4 && 'Password Reset Complete!'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {step === 1 && "Enter your email address and we'll send a 6-digit reset code."}
            {step === 2 && `We sent a code to ${email}. Enter it below.`}
            {step === 3 && 'Create a strong, secure password for your account.'}
            {step === 4 && 'Your password has been updated. All previous sessions have been revoked.'}
          </p>
        </div>

        {/* Step Indicators */}
        {step < 4 && (
          <div className="flex items-center justify-center space-x-2 py-1">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-8 bg-indigo-600 dark:bg-cyan-400'
                    : s < step
                    ? 'w-4 bg-emerald-500'
                    : 'w-4 bg-slate-200 dark:bg-slate-800'
                }`}
              />
            ))}
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="rounded-xl p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Step 1: Email Form */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <div className="relative flex items-center">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              isLoading={loading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Send Reset Code
            </Button>
          </form>
        )}

        {/* Step 2: OTP Form */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                6-Digit Reset Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
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
              Verify Code
            </Button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Change Email
              </button>
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={resendCooldown > 0}
                className="text-indigo-600 dark:text-cyan-400 font-semibold disabled:opacity-50"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: New Password Form */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                  placeholder="At least 8 characters (letters & numbers)"
                  className="w-full h-10 pl-9 pr-10 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                  placeholder="Confirm password"
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              isLoading={loading}
            >
              Reset Password
            </Button>
          </form>
        )}

        {/* Step 4: Success State */}
        {step === 4 && (
          <div className="text-center space-y-4 pt-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              You can now sign in to your StreamWave account using your new password.
            </p>
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => navigate('/login')}
            >
              Sign In Now
            </Button>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          Remember your password?{' '}
          <Link
            to="/login"
            className="text-indigo-600 dark:text-cyan-400 font-semibold hover:underline"
          >
            Back to Sign In
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPassword;
