import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Key,
  Laptop,
  Smartphone,
  Tablet,
  LogOut,
  RefreshCw,
  Clock,
  ArrowLeft,
  Lock,
  Eye,
  EyeOff,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  sendVerificationOtp,
  verifyEmail,
  changePassword,
  getSecurityDevices,
  logoutDeviceById,
  logoutAllDevices,
  getSecurityEvents,
} from '../services/api';

const Security = () => {
  const { user, updateUserState, logout } = useAuth();
  const navigate = useNavigate();

  // Email verification state
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [emailFeedback, setEmailFeedback] = useState({ type: null, message: '' });

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    revokeOtherSessions: true,
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState({ type: null, message: '' });

  // Devices state
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [deviceFeedback, setDeviceFeedback] = useState({ type: null, message: '' });

  // Events state
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Load devices and events
  const fetchSecurityData = async () => {
    try {
      setLoadingDevices(true);
      const devRes = await getSecurityDevices();
      if (devRes.success) {
        setDevices(devRes.devices || []);
      }
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoadingDevices(false);
    }

    try {
      setLoadingEvents(true);
      const evRes = await getSecurityEvents();
      if (evRes.success) {
        setEvents(evRes.events || []);
      }
    } catch (err) {
      console.error('Failed to load security events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  // Handle Send Verification Code
  const handleSendOtp = async () => {
    try {
      setSendingOtp(true);
      setEmailFeedback({ type: null, message: '' });
      const res = await sendVerificationOtp();
      setOtpSent(true);
      setOtpCooldown(60);
      setEmailFeedback({ type: 'success', message: res.message || 'Verification code sent to your email.' });
    } catch (err) {
      setEmailFeedback({ type: 'error', message: err.message || 'Failed to send verification code.' });
    } finally {
      setSendingOtp(false);
    }
  };

  // Handle Verify Code
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.length !== 6) {
      setEmailFeedback({ type: 'error', message: 'Please enter a valid 6-digit code.' });
      return;
    }

    try {
      setVerifyingOtp(true);
      setEmailFeedback({ type: null, message: '' });
      const res = await verifyEmail(otpCode.trim());
      updateUserState({ email_verified: true });
      setEmailFeedback({ type: 'success', message: res.message || 'Email verified successfully!' });
      setOtpSent(false);
      setOtpCode('');
      fetchSecurityData();
    } catch (err) {
      setEmailFeedback({ type: 'error', message: err.message || 'Verification failed. Please check the code.' });
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordFeedback({ type: 'error', message: 'All fields are required.' });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'New passwords do not match.' });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordFeedback({ type: 'error', message: 'New password must be at least 8 characters.' });
      return;
    }

    try {
      setChangingPassword(true);
      setPasswordFeedback({ type: null, message: '' });
      const res = await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });

      setPasswordFeedback({ type: 'success', message: res.message || 'Password updated successfully!' });
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        revokeOtherSessions: true,
      });
      fetchSecurityData();
    } catch (err) {
      setPasswordFeedback({ type: 'error', message: err.message || 'Failed to update password.' });
    } finally {
      setChangingPassword(false);
    }
  };

  // Handle Log Out Specific Device
  const handleLogoutDevice = async (deviceId) => {
    try {
      setDeviceFeedback({ type: null, message: '' });
      await logoutDeviceById(deviceId);
      setDeviceFeedback({ type: 'success', message: 'Device session has been revoked.' });
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      fetchSecurityData();
    } catch (err) {
      setDeviceFeedback({ type: 'error', message: err.message || 'Failed to revoke device.' });
    }
  };

  // Handle Log Out All Devices
  const handleLogoutAll = async () => {
    if (window.confirm('Are you sure you want to log out of all devices? You will be signed out immediately.')) {
      try {
        await logoutAllDevices();
        await logout();
        navigate('/login');
      } catch (err) {
        setDeviceFeedback({ type: 'error', message: err.message || 'Failed to log out all devices.' });
      }
    }
  };

  const getDeviceIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-5 h-5 text-indigo-500" />;
      case 'tablet':
        return <Tablet className="w-5 h-5 text-indigo-500" />;
      default:
        return <Laptop className="w-5 h-5 text-indigo-500" />;
    }
  };

  const formatEventBadge = (eventType) => {
    let color = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    if (eventType.includes('SUCCESS') || eventType.includes('VERIFIED')) {
      color = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
    } else if (eventType.includes('FAILED') || eventType.includes('LOCKED')) {
      color = 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
    } else if (eventType.includes('OTP') || eventType.includes('REVOKED')) {
      color = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
    }

    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>
        {eventType.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header & Back Link */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <Link
              to="/settings"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Back to Settings"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Shield className="w-6 h-6 text-indigo-500" />
              <span>Security & Devices</span>
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 ml-8">
            Manage your active sessions, account verification, password security, and audit activity.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchSecurityData}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
      </div>

      {/* 1. Account Verification Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-cyan-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Email Verification</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
            </div>
          </div>

          <div>
            {user?.email_verified ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                Not Verified
              </span>
            )}
          </div>
        </div>

        {emailFeedback.message && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
              emailFeedback.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60'
            }`}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{emailFeedback.message}</span>
          </div>
        )}

        {!user?.email_verified && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Verify your email address to enable password recovery, security notifications, and full creator tools.
            </p>

            {!otpSent ? (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSendOtp}
                isLoading={sendingOtp}
                disabled={otpCooldown > 0}
              >
                {otpCooldown > 0 ? `Resend Code in ${otpCooldown}s` : 'Send Verification Code'}
              </Button>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3 max-w-sm">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Enter 6-Digit Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full h-10 px-3 text-center tracking-widest text-lg font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Button type="submit" variant="primary" size="sm" isLoading={verifyingOtp}>
                    Verify Code
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSendOtp}
                    disabled={otpCooldown > 0}
                  >
                    {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend Code'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Card>

      {/* 2. Password Management Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-cyan-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Password & Authentication</h3>
            <p className="text-xs text-slate-500">Update your master account password</p>
          </div>
        </div>

        {passwordFeedback.message && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
              passwordFeedback.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60'
            }`}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{passwordFeedback.message}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3 max-w-md pt-2">
          {/* Current Password */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                required
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                placeholder="••••••••"
                className="w-full h-10 px-3 pr-10 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="At least 8 characters (letters & numbers)"
                className="w-full h-10 px-3 pr-10 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              placeholder="Re-enter new password"
              className="w-full h-10 px-3 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>

          <Button type="submit" variant="primary" size="sm" isLoading={changingPassword}>
            Update Password
          </Button>
        </form>
      </Card>

      {/* 3. Active Devices & Sessions Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-cyan-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Active Devices & Sessions</h3>
              <p className="text-xs text-slate-500">Devices currently logged into your StreamWave account</p>
            </div>
          </div>

          {devices.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogoutAll}
              className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              Log Out All Devices
            </Button>
          )}
        </div>

        {deviceFeedback.message && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
              deviceFeedback.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{deviceFeedback.message}</span>
          </div>
        )}

        {loadingDevices ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading active sessions...</div>
        ) : devices.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">No active devices found.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {devices.map((device) => (
              <div key={device.id} className="py-3.5 flex items-center justify-between">
                <div className="flex items-center space-x-3.5">
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                    {getDeviceIcon(device.device_type)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                        {device.device_name}
                      </h4>
                      {device.is_current && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-cyan-300">
                          This Device
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      IP: {device.ip_address} • Last active:{' '}
                      {device.last_active_at
                        ? new Date(device.last_active_at).toLocaleString()
                        : 'Active now'}
                    </p>
                  </div>
                </div>

                {!device.is_current && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLogoutDevice(device.id)}
                    className="text-xs text-slate-600 hover:text-rose-600"
                  >
                    Log Out
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 4. Security Audit Log Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-cyan-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Security Activity</h3>
            <p className="text-xs text-slate-500">Audit trail of logins, verification, and security events</p>
          </div>
        </div>

        {loadingEvents ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading security log...</div>
        ) : events.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">No security events logged yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-medium">
                  <th className="pb-2">Event</th>
                  <th className="pb-2">Device / System</th>
                  <th className="pb-2">IP Address</th>
                  <th className="pb-2 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {events.slice(0, 15).map((ev) => (
                  <tr key={ev.id} className="py-2.5">
                    <td className="py-2.5 pr-2">{formatEventBadge(ev.event_type)}</td>
                    <td className="py-2.5 px-2 text-slate-700 dark:text-slate-300 truncate max-w-[160px]">
                      {ev.device}
                    </td>
                    <td className="py-2.5 px-2 text-slate-500 dark:text-slate-400">{ev.ip_address}</td>
                    <td className="py-2.5 pl-2 text-right text-slate-500 dark:text-slate-400 text-[11px]">
                      {new Date(ev.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Security;
