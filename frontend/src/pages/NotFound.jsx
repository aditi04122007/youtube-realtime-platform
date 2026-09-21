import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/common/Button';
import { Compass, Home } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-cyan-400 flex items-center justify-center mb-4 shadow-sm">
        <Compass className="w-8 h-8 animate-pulse" />
      </div>
      <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white">404</h1>
      <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 mt-1">Page Not Found</h2>
      <p className="text-xs text-slate-500 max-w-sm mt-2 mb-6">
        The route you are requesting does not exist or has been relocated.
      </p>
      <Link to="/">
        <Button variant="primary" size="md" leftIcon={<Home className="w-4 h-4" />}>
          Back to Home
        </Button>
      </Link>
    </div>
  );
};

export default NotFound;
