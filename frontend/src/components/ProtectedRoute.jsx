import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Button from './common/Button';

/**
 * Protected Route Guard
 * Handles authentication checks and admin role verification
 */
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Verifying authentication...
        </p>
      </div>
    );
  }

  // Not logged in -> redirect to /login with return location
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admin-only route guard
  if (adminOnly && user.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="max-w-md w-full p-8 text-center bg-white dark:bg-[#0f172a] rounded-3xl border border-rose-200 dark:border-rose-900/40 shadow-xl space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Access Denied
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Admin access is required to view this dashboard. Your current role is{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {user.role}
              </span>
              .
            </p>
          </div>

          <div className="pt-2">
            <Link to="/">
              <Button
                variant="outline"
                size="md"
                className="w-full"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Return to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
