import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Shield,
  ShieldAlert,
  Ban,
  CheckCircle,
  RefreshCw,
  Eye,
  MoreVertical,
  LogOut,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
  Smartphone,
  History,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import AdminConfirmModal from '../components/admin/AdminConfirmModal';
import {
  getAdminUsers,
  getAdminUserById,
  suspendUser,
  unsuspendUser,
  banUser,
  updateUserRole,
  revokeUserSessions,
} from '../services/adminService';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // User details drawer state
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    confirmVariant: 'danger',
    requireReason: false,
    action: null,
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminUsers({
        page,
        limit: 20,
        search,
        role,
        status,
      });
      setUsers(res.users || []);
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to load user accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, role, status]);

  const openUserDetails = async (userId) => {
    try {
      setSelectedUserId(userId);
      setDetailsLoading(true);
      const res = await getAdminUserById(userId);
      setUserDetails(res.user);
    } catch (err) {
      alert(err.message || 'Failed to fetch user profile details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleAction = async (actionType, targetUser) => {
    if (actionType === 'SUSPEND') {
      setConfirmModal({
        isOpen: true,
        title: `Suspend Account: @${targetUser.username}`,
        message: 'Suspending this user will revoke active login sessions and block authenticated platform access.',
        confirmText: 'Suspend User',
        confirmVariant: 'warning',
        requireReason: true,
        action: async (reason) => {
          setActionLoading(true);
          try {
            await suspendUser(targetUser.id, reason);
            setConfirmModal({ ...confirmModal, isOpen: false });
            fetchUsers(pagination.page);
            if (selectedUserId === targetUser.id) openUserDetails(targetUser.id);
          } catch (err) {
            alert(err.message || 'Failed to suspend user');
          } finally {
            setActionLoading(false);
          }
        },
      });
    } else if (actionType === 'UNSUSPEND') {
      setConfirmModal({
        isOpen: true,
        title: `Restore Account: @${targetUser.username}`,
        message: 'This will reactivate the account to ACTIVE status, restoring sign-in ability.',
        confirmText: 'Restore Account',
        confirmVariant: 'primary',
        requireReason: false,
        action: async (reason) => {
          setActionLoading(true);
          try {
            await unsuspendUser(targetUser.id, reason);
            setConfirmModal({ ...confirmModal, isOpen: false });
            fetchUsers(pagination.page);
            if (selectedUserId === targetUser.id) openUserDetails(targetUser.id);
          } catch (err) {
            alert(err.message || 'Failed to restore user');
          } finally {
            setActionLoading(false);
          }
        },
      });
    } else if (actionType === 'BAN') {
      setConfirmModal({
        isOpen: true,
        title: `Permanently Ban User: @${targetUser.username}`,
        message: 'This will set account status to BANNED, terminate all sessions, and block all access indefinitely.',
        confirmText: 'Permanently Ban',
        confirmVariant: 'danger',
        requireReason: true,
        action: async (reason) => {
          setActionLoading(true);
          try {
            await banUser(targetUser.id, reason);
            setConfirmModal({ ...confirmModal, isOpen: false });
            fetchUsers(pagination.page);
            if (selectedUserId === targetUser.id) openUserDetails(targetUser.id);
          } catch (err) {
            alert(err.message || 'Failed to ban user');
          } finally {
            setActionLoading(false);
          }
        },
      });
    } else if (actionType === 'REVOKE_SESSIONS') {
      setConfirmModal({
        isOpen: true,
        title: `Revoke Active Sessions: @${targetUser.username}`,
        message: 'Force log out all active browser sessions and registered devices for this user.',
        confirmText: 'Revoke Sessions',
        confirmVariant: 'warning',
        requireReason: false,
        action: async (reason) => {
          setActionLoading(true);
          try {
            await revokeUserSessions(targetUser.id, reason);
            setConfirmModal({ ...confirmModal, isOpen: false });
            alert('User sessions revoked successfully');
            if (selectedUserId === targetUser.id) openUserDetails(targetUser.id);
          } catch (err) {
            alert(err.message || 'Failed to revoke sessions');
          } finally {
            setActionLoading(false);
          }
        },
      });
    }
  };

  const handleChangeRole = (targetUser, newRole) => {
    setConfirmModal({
      isOpen: true,
      title: `Update Role: @${targetUser.username}`,
      message: `Are you sure you want to change this user's platform role to ${newRole}?`,
      confirmText: 'Update Role',
      confirmVariant: 'primary',
      requireReason: false,
      action: async (reason) => {
        setActionLoading(true);
        try {
          await updateUserRole(targetUser.id, newRole, reason);
          setConfirmModal({ ...confirmModal, isOpen: false });
          fetchUsers(pagination.page);
          if (selectedUserId === targetUser.id) openUserDetails(targetUser.id);
        } catch (err) {
          alert(err.message || 'Failed to update user role');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2.5">
            <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>User Management</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Search, inspect, moderate accounts, assign roles, and manage session states
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchUsers(pagination.page)}
            disabled={loading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        {/* Search */}
        <div className="sm:col-span-6 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username, email, display name, or user ID..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
          />
        </div>

        {/* Role Filter */}
        <div className="sm:col-span-3">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
          >
            <option value="ALL">All Roles</option>
            <option value="USER">Standard Users (USER)</option>
            <option value="CREATOR">Creators (CREATOR)</option>
            <option value="ADMIN">Administrators (ADMIN)</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="sm:col-span-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="SUSPENDED">Suspended Only</option>
            <option value="BANNED">Banned Only</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Channel / Videos</th>
                <th className="py-3 px-4">Subscription</th>
                <th className="py-3 px-4">Joined</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                    <span>Loading platform users...</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No users matching the specified query or filters
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    {/* User */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
                          {u.displayName?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 cursor-pointer" onClick={() => openUserDetails(u.id)}>
                            {u.displayName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3 px-4">
                      <div className="text-slate-800 dark:text-slate-200">{u.email}</div>
                      <div className="text-[10px] text-slate-400">
                        {u.emailVerified ? (
                          <span className="text-emerald-500 flex items-center space-x-1">
                            <CheckCircle className="w-3 h-3" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="text-amber-500">Unverified</span>
                        )}
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                            : u.role === 'CREATOR'
                            ? 'bg-cyan-100 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                            : u.status === 'SUSPENDED'
                            ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                            : 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>

                    {/* Channel / Videos */}
                    <td className="py-3 px-4">
                      {u.channel ? (
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                            {u.channel.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {u.videoCount} videos
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No channel</span>
                      )}
                    </td>

                    {/* Subscription */}
                    <td className="py-3 px-4">
                      <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                        {u.subscriptionPlan}
                      </span>
                    </td>

                    {/* Joined */}
                    <td className="py-3 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => openUserDetails(u.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Inspect profile & sessions"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {u.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleAction('SUSPEND', u)}
                            className="p-1.5 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition"
                            title="Suspend user"
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAction('UNSUSPEND', u)}
                            className="p-1.5 rounded-lg text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                            title="Restore account"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}

                        {u.status !== 'BANNED' && (
                          <button
                            onClick={() => handleAction('BAN', u)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            title="Permanently ban"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {users.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="xs"
              variant="outline"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchUsers(pagination.page - 1)}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              size="xs"
              variant="outline"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchUsers(pagination.page + 1)}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* User Details Drawer / Modal */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            {detailsLoading || !userDetails ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                <span>Loading profile details...</span>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                      {userDetails.profile?.displayName?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        {userDetails.profile?.displayName}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono">@{userDetails.username} • ID: #{userDetails.id}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedUserId(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Account Status & Role Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Account Role</span>
                    <div className="flex items-center space-x-2">
                      <select
                        value={userDetails.role}
                        onChange={(e) => handleChangeRole(userDetails, e.target.value)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="USER">USER</option>
                        <option value="CREATOR">CREATOR</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                      <span className="text-[11px] text-slate-400">Platform privileges</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Account Status</span>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                          userDetails.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : userDetails.status === 'SUSPENDED'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                      >
                        {userDetails.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-base font-black text-slate-900 dark:text-white">
                      {userDetails.metrics?.totalVideos || 0}
                    </div>
                    <div className="text-[10px] text-slate-400">Videos Uploaded</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-base font-black text-slate-900 dark:text-white">
                      {userDetails.metrics?.totalViews?.toLocaleString() || 0}
                    </div>
                    <div className="text-[10px] text-slate-400">Total Video Views</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-base font-black text-slate-900 dark:text-white">
                      {userDetails.metrics?.totalComments || 0}
                    </div>
                    <div className="text-[10px] text-slate-400">Comments Posted</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-base font-black text-rose-600">
                      {userDetails.metrics?.reportsReceived || 0}
                    </div>
                    <div className="text-[10px] text-slate-400">Reports Received</div>
                  </div>
                </div>

                {/* Active Sessions & Devices */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                      <Smartphone className="w-4 h-4 text-indigo-500" />
                      <span>Registered Devices & Sessions</span>
                    </h4>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleAction('REVOKE_SESSIONS', userDetails)}
                      leftIcon={<LogOut className="w-3 h-3 text-rose-500" />}
                    >
                      Revoke All Sessions
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {userDetails.devices?.length > 0 ? (
                      userDetails.devices.map((d) => (
                        <div
                          key={d.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {d.device_name || d.browser || 'Browser Session'}
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {d.operating_system} • IP: {d.ip_address || 'Unknown'}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              d.is_revoked
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {d.is_revoked ? 'Revoked' : 'Active'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">No registered device records</p>
                    )}
                  </div>
                </div>

                {/* Action Bar inside Drawer */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-2">
                  {userDetails.status === 'ACTIVE' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction('SUSPEND', userDetails)}
                      className="text-amber-600 border-amber-300"
                    >
                      Suspend Account
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleAction('UNSUSPEND', userDetails)}
                    >
                      Restore Account
                    </Button>
                  )}

                  {userDetails.status !== 'BANNED' && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleAction('BAN', userDetails)}
                    >
                      Permanently Ban
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <AdminConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmVariant={confirmModal.confirmVariant}
        requireReason={confirmModal.requireReason}
        onConfirm={confirmModal.action}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        loading={actionLoading}
      />
    </div>
  );
};

export default AdminUsers;
