import React, { useState, useEffect } from 'react';
import {
  Settings,
  Server,
  Database,
  Activity,
  Cpu,
  Clock,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { getAdminSystemInfo } from '../services/adminService';

const AdminSettings = () => {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminSystemInfo();
      setInfo(res.info);
    } catch (err) {
      console.error('Error fetching system info:', err);
      setError(err.message || 'Failed to fetch platform health metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfo();
  }, []);

  const formatUptime = (seconds) => {
    if (!seconds) return '0m';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${seconds % 60}s`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2.5">
            <Settings className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>System Information & Health</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time backend infrastructure diagnostics, database connection latency, and runtime environment
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={fetchInfo}
          disabled={loading}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          Ping Server
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Diagnostics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Service Status</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-2 flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{info?.status || 'ONLINE'}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            API Gateway Operational
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Database Pool</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-2">
            {info?.dbConnection || 'HEALTHY'}
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-mono font-semibold">
            {info?.dbLatencyMs !== undefined ? `${info.dbLatencyMs}ms ping latency` : '—'}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Server Uptime</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-2">
            {formatUptime(info?.uptimeSeconds)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Continuous process run
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Memory Footprint</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-2">
            {info?.memoryUsageMb ? `${info.memoryUsageMb} MB` : '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            V8 Heap allocation
          </div>
        </Card>
      </div>

      {/* Environment & Policy Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <Server className="w-4 h-4 text-indigo-600" />
            <span>Host Environment Information</span>
          </h3>

          <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-500">Runtime Version</dt>
              <dd className="font-mono font-semibold text-slate-900 dark:text-white">
                Node.js {info?.nodeVersion || process.version}
              </dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-500">Host OS Platform</dt>
              <dd className="font-mono font-semibold text-slate-900 dark:text-white">
                {info?.platform || 'Windows / win32'}
              </dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-500">Database Engine</dt>
              <dd className="font-mono font-semibold text-slate-900 dark:text-white">
                MySQL 8.0+ (InnoDB)
              </dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-500">Real-Time Engine</dt>
              <dd className="font-mono font-semibold text-slate-900 dark:text-white">
                Socket.IO + WebSockets
              </dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-500">Server Time (UTC)</dt>
              <dd className="font-mono text-slate-700 dark:text-slate-300">
                {info?.serverTimestamp || new Date().toISOString()}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Platform Governance Policies</span>
          </h3>

          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="font-semibold text-slate-900 dark:text-white">
                Admin Privilege Guard
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                The platform prevents demoting, banning, or suspending the last remaining active administrator.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="font-semibold text-slate-900 dark:text-white">
                Immutable Audit Logging
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                All administrative actions are append-only and recorded in the database with timestamps, reasons, and admin attribution.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="font-semibold text-slate-900 dark:text-white">
                Session Revocation on Suspension
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Suspending or banning a user immediately revokes all database-backed session tokens across all devices.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettings;
