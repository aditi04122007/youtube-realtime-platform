import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { useTheme } from '../context/ThemeContext';
import { Settings as SettingsIcon, Sun, Moon, Shield, User, Edit3 } from 'lucide-react';

const Settings = () => {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <SettingsIcon className="w-5 h-5 text-indigo-500" />
          <span>Platform Settings</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Manage your preferences, display themes, profile, and security</p>
      </div>

      {/* Profile Management Card */}
      <Card className="p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <User className="w-4 h-4 text-indigo-500" />
          <span>Profile & Channel Management</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Update your public profile bio, location, personal website, avatar, and banner images.
        </p>
        <div className="flex items-center space-x-3 pt-1">
          <Link to="/settings/profile">
            <Button variant="primary" size="sm" leftIcon={<Edit3 className="w-3.5 h-3.5" />}>
              Edit Profile
            </Button>
          </Link>
          <Link to="/profile">
            <Button variant="outline" size="sm">
              View My Profile
            </Button>
          </Link>
        </div>
      </Card>

      {/* Theme Settings Card */}
      <Card className="p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          {isDark ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
          <span>Appearance & Theme</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Customize the look and feel of the platform. Currently using <span className="font-semibold capitalize text-indigo-600 dark:text-cyan-400">{theme} Mode</span>.
        </p>
        <div className="flex items-center space-x-3 pt-1">
          <Button
            variant={isDark ? 'primary' : 'outline'}
            size="sm"
            onClick={() => !isDark && toggleTheme()}
            leftIcon={<Moon className="w-3.5 h-3.5" />}
          >
            Dark Mode
          </Button>
          <Button
            variant={!isDark ? 'primary' : 'outline'}
            size="sm"
            onClick={() => isDark && toggleTheme()}
            leftIcon={<Sun className="w-3.5 h-3.5" />}
          >
            Light Mode
          </Button>
        </div>
      </Card>

      {/* Security & Device Management Card */}
      <Card className="p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <Shield className="w-4 h-4 text-indigo-500" />
          <span>Security & Device Tracking</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Manage your active device sessions, email verification, password security, and recent security logs.
        </p>
        <div className="pt-1">
          <Link to="/settings/security">
            <Button variant="primary" size="sm" leftIcon={<Shield className="w-3.5 h-3.5" />}>
              Manage Security & Devices
            </Button>
          </Link>
        </div>
      </Card>

    </div>
  );
};

export default Settings;
