import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { resetPassword } from '../services/api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const resetToken = searchParams.get('token') || '';

  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!resetToken) {
      setError('Missing reset token. Please request a new password reset link.');
      return;
    }

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
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[75vh] px-4 py-8">
      <Card className="w-full max-w-md p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-cyan-400 mx-auto flex items-center justify-center shadow-sm">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {success ? 'Password Reset Complete' : 'Set New Password'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {success
              ? 'Your password has been successfully updated.'
              : 'Choose a strong password to secure your StreamWave account.'}
          </p>
        </div>

        {error && (
          <div className="rounded-xl p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {!resetToken && !success ? (
          <div className="text-center space-y-4">
            <p className="text-xs text-slate-500">
              No reset token detected. Please start by requesting a password reset code.
            </p>
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => navigate('/forgot-password')}
            >
              Go to Forgot Password
            </Button>
          </div>
        ) : !success ? (
          <form onSubmit={handleSubmit} className="space-y-4">
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
                Confirm Password
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
        ) : (
          <div className="text-center space-y-4 pt-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              You can now sign in with your new password. All prior sessions have been safely logged out.
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

        <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
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

export default ResetPassword;
