import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Crown,
  Edit2,
  Users,
  DollarSign,
  ArrowLeft,
  RefreshCw,
  HardDrive,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import { timeAgo } from '../utils/timeAgo';
import {
  getAdminSubscriptionPlans,
  updateAdminSubscriptionPlan,
  getAdminSubscriptionStats,
  getAdminUserSubscriptions,
} from '../services/subscriptionService';

const AdminSubscriptions = () => {
  const [activeTab, setActiveTab] = useState('plans'); // 'plans' | 'users'
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Edit Plan Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    monthlyPrice: 0,
    yearlyPrice: 0,
    maxVideoUploads: 10,
    maxStorageGb: 5,
    downloadLimit: 0,
    premiumAccess: false,
    prioritySupport: false,
    status: 'ACTIVE',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Subscribers List State
  const [users, setUsers] = useState([]);
  const [userPagination, setUserPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Load Plans & Stats
  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [plansRes, statsRes] = await Promise.all([
        getAdminSubscriptionPlans(),
        getAdminSubscriptionStats(),
      ]);

      if (plansRes && plansRes.plans) {
        setPlans(plansRes.plans);
      }
      if (statsRes && statsRes.stats) {
        setStats(statsRes.stats);
      }
    } catch (err) {
      console.error('Failed to load admin subscription data:', err);
      setErrorMsg(err?.message || 'Failed to load subscription administration data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load Users
  const loadUsers = useCallback(async (page = 1) => {
    setIsLoadingUsers(true);
    try {
      const res = await getAdminUserSubscriptions({ page, limit: userPagination.limit });
      if (res && res.users) {
        setUsers(res.users);
        setUserPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
      }
    } catch (err) {
      console.error('Failed to load subscribed users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [userPagination.limit]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers(1);
    }
  }, [activeTab, loadUsers]);

  const handleOpenEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name || '',
      description: plan.description || '',
      monthlyPrice: plan.monthlyPrice ?? plan.price ?? 0,
      yearlyPrice: plan.yearlyPrice ?? 0,
      maxVideoUploads: plan.maxVideoUploads ?? 10,
      maxStorageGb: plan.maxStorageGb ?? 5,
      downloadLimit: plan.downloadLimit ?? 0,
      premiumAccess: Boolean(plan.premiumAccess),
      prioritySupport: Boolean(plan.prioritySupport),
      status: plan.status || 'ACTIVE',
    });
    setSaveError('');
    setEditModalOpen(true);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!editingPlan) return;
    setIsSaving(true);
    setSaveError('');
    try {
      await updateAdminSubscriptionPlan(editingPlan.id, formData);
      setEditModalOpen(false);
      await loadAdminData();
    } catch (err) {
      console.error('Failed to update plan:', err);
      setSaveError(err?.message || 'Failed to update plan.');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
            Active
          </span>
        );
      case 'DISABLED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
            Disabled
          </span>
        );
      case 'HIDDEN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
            Hidden
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
            <Link
              to="/admin"
              className="inline-flex items-center space-x-1 hover:text-indigo-600 dark:hover:text-cyan-400 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Admin Dashboard</span>
            </Link>
            <span>/</span>
            <span>Subscriptions</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Crown className="w-6 h-6 text-amber-500" />
            <span>Subscription Plan Management</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure tier pricing, quotas, storage caps, and review subscriber metrics.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('plans')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'plans'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Plan Tiers</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'users'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Subscribers</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Row */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total Subscribers</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {stats.totalSubscribers}
              </h3>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Paid Subscribers</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {stats.paidSubscribers}
              </h3>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <Crown className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Free Tier Users</p>
              <h3 className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">
                {stats.freeSubscribers}
              </h3>
            </div>
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500">
              <Shield className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Est. Monthly Revenue</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                ₹{stats.estimatedMonthlyRevenue}
              </h3>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'plans' ? (
        /* Plans Table */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Layers className="w-5 h-5 text-indigo-500" />
              <span>Configurable Tiers</span>
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAdminData}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh Plans
            </Button>
          </div>

          {isLoading ? (
            <div className="py-16">
              <Loading text="Loading subscription tiers..." />
            </div>
          ) : errorMsg ? (
            <div className="p-8 text-center text-rose-500 space-y-2">
              <AlertTriangle className="w-8 h-8 mx-auto" />
              <p className="text-sm font-semibold">{errorMsg}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plans.map((p) => (
                <Card key={p.id} className="p-5 space-y-4 border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-black text-slate-400 uppercase">
                          {p.code}
                        </span>
                        {getStatusBadge(p.status)}
                      </div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                        {p.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {p.description}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(p)}
                      leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                    >
                      Edit
                    </Button>
                  </div>

                  {/* Pricing & Quota Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px]">Monthly</span>
                      <p className="font-black text-slate-900 dark:text-white">
                        ₹{p.monthlyPrice}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px]">Yearly</span>
                      <p className="font-black text-slate-900 dark:text-white">
                        ₹{p.yearlyPrice}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px]">Storage</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {p.maxStorageGb === 0 ? 'Unlimited' : `${p.maxStorageGb} GB`}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px]">Uploads</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {p.maxVideoUploads === 0 ? 'Unlimited' : p.maxVideoUploads}
                      </p>
                    </div>
                  </div>

                  {/* Active Subscribers Indicator */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-500">
                    <span>Active Subscribers:</span>
                    <span className="font-extrabold text-indigo-600 dark:text-cyan-400">
                      {p.activeSubscriberCount} members
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Subscribers Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Users className="w-5 h-5 text-indigo-500" />
              <span>Subscribed Users</span>
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadUsers(1)}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
          </div>

          {isLoadingUsers ? (
            <div className="py-16">
              <Loading text="Loading subscribed users..." />
            </div>
          ) : users.length === 0 ? (
            <Card className="p-12 text-center">
              <EmptyState
                icon={<Users className="w-12 h-12 text-slate-400 mx-auto" />}
                title="No Subscribers Found"
                description="No users are currently registered in the database."
              />
            </Card>
          ) : (
            <Card className="overflow-x-auto shadow-sm">
              <table className="w-full text-xs text-left border-collapse min-w-[650px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500">
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Plan</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Provider</th>
                    <th className="p-3.5">Start Date</th>
                    <th className="p-3.5">Renewal Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {users.map((u) => (
                    <tr key={u.userId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {u.displayName || u.username}
                        </div>
                        <div className="text-[11px] text-slate-400">@{u.username} • {u.email}</div>
                      </td>
                      <td className="p-3.5 font-extrabold text-slate-800 dark:text-slate-200">
                        {u.planName}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                          {u.subscriptionStatus}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                        {u.paymentProvider || 'SYSTEM'}
                      </td>
                      <td className="p-3.5 text-slate-400">
                        {u.startDate ? new Date(u.startDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-3.5 text-slate-400">
                        {u.endDate ? new Date(u.endDate).toLocaleDateString() : 'Lifetime'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* Pagination */}
          {userPagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 text-xs text-slate-500">
              <span>
                Page {userPagination.page} of {userPagination.totalPages} ({userPagination.total} users)
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={userPagination.page <= 1}
                  onClick={() => loadUsers(userPagination.page - 1)}
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={userPagination.page >= userPagination.totalPages}
                  onClick={() => loadUsers(userPagination.page + 1)}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Plan Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => !isSaving && setEditModalOpen(false)}
        title={editingPlan ? `Edit ${editingPlan.name} (${editingPlan.code})` : 'Edit Plan'}
      >
        <form onSubmit={handleSavePlan} className="space-y-4 pt-2 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Monthly Price (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.monthlyPrice}
                onChange={(e) => setFormData({ ...formData, monthlyPrice: parseFloat(e.target.value) || 0 })}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Yearly Price (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.yearlyPrice}
                onChange={(e) => setFormData({ ...formData, yearlyPrice: parseFloat(e.target.value) || 0 })}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Storage (GB, 0=unlimited)
              </label>
              <input
                type="number"
                min="0"
                value={formData.maxStorageGb}
                onChange={(e) => setFormData({ ...formData, maxStorageGb: parseInt(e.target.value, 10) || 0 })}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Uploads (0=unlimited)
              </label>
              <input
                type="number"
                min="0"
                value={formData.maxVideoUploads}
                onChange={(e) => setFormData({ ...formData, maxVideoUploads: parseInt(e.target.value, 10) || 0 })}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Downloads (0=unlimited)
              </label>
              <input
                type="number"
                min="0"
                value={formData.downloadLimit}
                onChange={(e) => setFormData({ ...formData, downloadLimit: parseInt(e.target.value, 10) || 0 })}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.premiumAccess}
                onChange={(e) => setFormData({ ...formData, premiumAccess: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Premium Access
              </span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.prioritySupport}
                onChange={(e) => setFormData({ ...formData, prioritySupport: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                VIP Priority Support
              </span>
            </label>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Availability Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            >
              <option value="ACTIVE">ACTIVE (Visible & Selectable)</option>
              <option value="DISABLED">DISABLED (Existing users keep tier, new subscriptions blocked)</option>
              <option value="HIDDEN">HIDDEN (Concealed from public comparison)</option>
            </select>
          </div>

          {saveError && <p className="text-rose-500 font-semibold">{saveError}</p>}

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={() => setEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSaving}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminSubscriptions;
