import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Film,
  Flag,
  Video,
  CreditCard,
  Crown,
  Download,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  Clock,
  Calendar,
  AlertCircle,
  Tv,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { getAdminStats, getAdminCharts } from '../services/adminService';
import { AdminAreaChart, AdminBarChart } from '../components/admin/AdminCharts';

const AdminDashboard = () => {
  const [period, setPeriod] = useState('30d');
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async (p = period) => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, chartsRes] = await Promise.all([
        getAdminStats({ period: p }),
        getAdminCharts({ period: p }),
      ]);
      setStats(statsRes.stats);
      setCharts(chartsRes.charts);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
      setError(err.message || 'Failed to load platform telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(period);
  }, [period]);

  const periods = [
    { label: 'Today', value: 'today' },
    { label: 'Last 7 Days', value: '7d' },
    { label: 'Last 30 Days', value: '30d' },
    { label: 'Last 90 Days', value: '90d' },
    { label: 'Last Year', value: 'year' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header & Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2.5">
            <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Platform Overview & Analytics</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time platform health, monetization, content metrics, and live telemetry
          </p>
        </div>

        {/* Date Filter Buttons */}
        <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm self-start sm:self-auto overflow-x-auto">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                period === p.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => fetchData(period)}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="xs" variant="outline" onClick={() => fetchData(period)}>
            Retry
          </Button>
        </div>
      )}

      {/* 2. Primary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <Card className="p-4 sm:p-5 relative overflow-hidden group hover:border-indigo-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Users</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {loading ? '...' : stats?.users?.total?.toLocaleString() || 0}
            </h3>
            <div className="flex items-center space-x-2 mt-1 text-[11px] text-slate-500">
              <span className="text-emerald-600 font-semibold">{stats?.users?.active || 0} active</span>
              <span>•</span>
              <span className="text-rose-500">{stats?.users?.banned || 0} banned</span>
            </div>
          </div>
          <Link
            to="/admin/users"
            className="mt-3 flex items-center text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition"
          >
            <span>Manage users</span>
            <ArrowRight className="w-3 h-3 ml-1" />
          </Link>
        </Card>

        {/* Published Videos */}
        <Card className="p-4 sm:p-5 relative overflow-hidden group hover:border-cyan-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Published Videos</span>
            <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400">
              <Film className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {loading ? '...' : stats?.videos?.published?.toLocaleString() || 0}
            </h3>
            <div className="flex items-center space-x-2 mt-1 text-[11px] text-slate-500">
              <span>{stats?.videos?.totalViews?.toLocaleString() || 0} views</span>
              <span>•</span>
              <span className="text-amber-500">{stats?.videos?.hidden || 0} hidden</span>
            </div>
          </div>
          <Link
            to="/admin/videos"
            className="mt-3 flex items-center text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 group-hover:translate-x-0.5 transition"
          >
            <span>Manage videos</span>
            <ArrowRight className="w-3 h-3 ml-1" />
          </Link>
        </Card>

        {/* Pending Reports */}
        <Card className="p-4 sm:p-5 relative overflow-hidden group hover:border-rose-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pending Reports</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <Flag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
              {loading ? '...' : stats?.reports?.pending || 0}
            </h3>
            <div className="flex items-center space-x-2 mt-1 text-[11px] text-slate-500">
              <span>{stats?.reports?.resolved || 0} resolved</span>
              <span>•</span>
              <span>{stats?.reports?.dismissed || 0} dismissed</span>
            </div>
          </div>
          <Link
            to="/admin/reports"
            className="mt-3 flex items-center text-[11px] font-semibold text-rose-600 dark:text-rose-400 group-hover:translate-x-0.5 transition"
          >
            <span>Review reports</span>
            <ArrowRight className="w-3 h-3 ml-1" />
          </Link>
        </Card>

        {/* Platform Revenue */}
        <Card className="p-4 sm:p-5 relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Revenue</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {loading ? '...' : `₹${stats?.revenue?.totalRevenue?.toLocaleString() || 0}`}
            </h3>
            <div className="flex items-center space-x-2 mt-1 text-[11px] text-slate-500">
              <span className="text-emerald-600 font-semibold">{stats?.revenue?.successfulPayments || 0} orders</span>
              <span>•</span>
              <span>{stats?.subscriptions?.paid || 0} subscribers</span>
            </div>
          </div>
          <Link
            to="/admin/payments"
            className="mt-3 flex items-center text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition"
          >
            <span>Payment ledger</span>
            <ArrowRight className="w-3 h-3 ml-1" />
          </Link>
        </Card>
      </div>

      {/* 3. Secondary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600">
            <Tv className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-medium">Channels</div>
            <div className="text-base font-bold text-slate-900 dark:text-white">
              {stats?.channels?.total || 0}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-medium">Comments</div>
            <div className="text-base font-bold text-slate-900 dark:text-white">
              {stats?.comments?.total || 0}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600">
            <Download className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-medium">Downloads</div>
            <div className="text-base font-bold text-slate-900 dark:text-white">
              {stats?.downloads?.total || 0}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-medium">Active Call Rooms</div>
            <div className="text-base font-bold text-slate-900 dark:text-white">
              {stats?.calls?.active || 0}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Interactive Analytics Charts (SVG Based) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Registrations Trend */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>User Registrations Trend</span>
              </h3>
              <p className="text-[11px] text-slate-500">Daily accounts created over selected period</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
              +{stats?.users?.newInPeriod || 0} new
            </span>
          </div>
          <AdminAreaChart
            data={charts?.userTrend || []}
            color="#6366f1"
            gradientFrom="#6366f1"
            gradientTo="#a5b4fc"
            valueSuffix=" users"
          />
        </Card>

        {/* Video Upload Trend */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Film className="w-4 h-4 text-cyan-600" />
                <span>Video Uploads Activity</span>
              </h3>
              <p className="text-[11px] text-slate-500">Daily video submissions and publications</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
              +{stats?.videos?.newInPeriod || 0} uploaded
            </span>
          </div>
          <AdminAreaChart
            data={charts?.videoTrend || []}
            color="#06b6d4"
            gradientFrom="#06b6d4"
            gradientTo="#67e8f9"
            valueSuffix=" videos"
          />
        </Card>

        {/* Revenue Growth Trend */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>Monetization & Revenue Trend</span>
              </h3>
              <p className="text-[11px] text-slate-500">Daily successful subscription payment volume</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              ₹{stats?.revenue?.periodRevenue?.toLocaleString() || 0}
            </span>
          </div>
          <AdminBarChart
            data={charts?.revenueTrend || []}
            color="#10b981"
            valuePrefix="₹"
          />
        </Card>

        {/* Moderation & Reports Volume */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Flag className="w-4 h-4 text-rose-600" />
                <span>Flagged Content Trend</span>
              </h3>
              <p className="text-[11px] text-slate-500">Content reports filed across comments, videos, & users</p>
            </div>
            <Link
              to="/admin/reports"
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400"
            >
              View Queue
            </Link>
          </div>
          <AdminBarChart
            data={charts?.reportTrend || []}
            color="#f43f5e"
            valueSuffix=" reports"
          />
        </Card>
      </div>

      {/* 5. Quick Access & Recent Platform Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Admin Audit Logs */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Recent Administrative Actions</span>
            </h3>
            <Link to="/admin/activity" className="text-xs text-indigo-600 hover:underline font-semibold">
              View All Logs
            </Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {stats?.recentActivity?.adminActions?.length > 0 ? (
              stats.recentActivity.adminActions.map((action) => (
                <div key={action.id} className="py-2.5 flex items-start justify-between text-xs">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {action.adminUsername || 'Admin'}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold">
                        {action.action_type}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 line-clamp-1">
                      {action.description || action.reason || 'Administrative action'}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap ml-3">
                    {new Date(action.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                No administrative actions logged yet
              </div>
            )}
          </div>
        </Card>

        {/* Pending Reports Quick Queue */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Flag className="w-4 h-4 text-rose-600" />
              <span>Pending Moderation Queue</span>
            </h3>
            <Link to="/admin/reports" className="text-xs text-rose-600 hover:underline font-semibold">
              Resolve Queue
            </Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {stats?.recentActivity?.reports?.length > 0 ? (
              stats.recentActivity.reports.map((report) => (
                <div key={report.id} className="py-2.5 flex items-start justify-between text-xs">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                        {report.targetType}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {report.reason}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Reported by @{report.reporterUsername || 'user'}
                    </p>
                  </div>
                  <Link
                    to="/admin/reports"
                    className="text-[11px] font-semibold text-indigo-600 hover:underline whitespace-nowrap ml-3"
                  >
                    Inspect
                  </Link>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                🎉 Moderation queue is completely clear!
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
