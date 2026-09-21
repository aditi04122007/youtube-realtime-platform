import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Flag,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  EyeOff,
  Trash2,
  Clock,
  ExternalLink,
  RefreshCw,
  History,
  FileText,
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  User,
  Film,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import { timeAgo } from '../utils/timeAgo';
import {
  getAdminReports,
  getReportReasons,
  dismissReport,
  reviewReport,
  takeModerationAction,
  getAdminAuditLogs,
} from '../services/moderationService';

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All Reports' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'REVIEWING', label: 'In Review' },
  { id: 'REVIEWED', label: 'Reviewed' },
  { id: 'ACTION_TAKEN', label: 'Action Taken' },
  { id: 'DISMISSED', label: 'Dismissed' },
];

const AdminModeration = () => {
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'audit'
  
  // Reports Queue State
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [reportError, setReportError] = useState('');
  
  // Filters
  const [selectedStatus, setSelectedStatus] = useState('PENDING');
  const [selectedReason, setSelectedReason] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [reasonsList, setReasonsList] = useState([]);

  // Action Modal State
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [moderationAction, setModerationAction] = useState('HIDE_COMMENT'); // 'HIDE_COMMENT' | 'REMOVE_COMMENT' | 'NO_ACTION'
  const [actionNote, setActionNote] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionModalError, setActionModalError] = useState('');

  // Dismiss Modal State
  const [dismissModalOpen, setDismissModalOpen] = useState(false);
  const [dismissReportTarget, setDismissReportTarget] = useState(null);
  const [dismissNote, setDismissNote] = useState('');
  const [isDismissing, setIsDismissing] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Fetch Report Reasons on Mount
  useEffect(() => {
    const fetchReasons = async () => {
      try {
        const res = await getReportReasons();
        if (res?.reasons) {
          setReasonsList(res.reasons);
        }
      } catch (err) {
        console.error('Failed to fetch report reasons:', err);
      }
    };
    fetchReasons();
  }, []);

  // Fetch Reports
  const fetchReports = useCallback(async (page = 1) => {
    setIsLoadingReports(true);
    setReportError('');
    try {
      const params = {
        page,
        limit: pagination.limit,
        sort: sortOrder,
      };
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      if (selectedReason !== 'ALL') params.reason = selectedReason;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const data = await getAdminReports(params);
      setReports(data.reports || []);
      setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load moderation reports:', err);
      setReportError(err?.message || 'Failed to load moderation reports.');
    } finally {
      setIsLoadingReports(false);
    }
  }, [pagination.limit, selectedStatus, selectedReason, searchQuery, sortOrder]);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async (page = 1) => {
    setIsLoadingAudit(true);
    try {
      const data = await getAdminAuditLogs({ page, limit: auditPagination.limit });
      setAuditLogs(data.logs || []);
      setAuditPagination(data.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  }, [auditPagination.limit]);

  useEffect(() => {
    if (activeTab === 'queue') {
      fetchReports(1);
    } else {
      fetchAuditLogs(1);
    }
  }, [activeTab, fetchReports, fetchAuditLogs]);

  // Handlers for quick actions
  const handleMarkReviewing = async (reportId) => {
    try {
      await reviewReport(reportId, 'Report marked as under active review');
      fetchReports(pagination.page);
    } catch (err) {
      console.error('Failed to mark reviewing:', err);
      alert(err?.message || 'Failed to update report status.');
    }
  };

  const handleOpenDismissModal = (report) => {
    setDismissReportTarget(report);
    setDismissNote('');
    setDismissModalOpen(true);
  };

  const handleConfirmDismiss = async () => {
    if (!dismissReportTarget) return;
    setIsDismissing(true);
    try {
      await dismissReport(dismissReportTarget.id, dismissNote);
      setDismissModalOpen(false);
      fetchReports(pagination.page);
    } catch (err) {
      console.error('Failed to dismiss report:', err);
      alert(err?.message || 'Failed to dismiss report.');
    } finally {
      setIsDismissing(false);
    }
  };

  const handleOpenActionModal = (report) => {
    setSelectedReport(report);
    setModerationAction('HIDE_COMMENT');
    setActionNote('');
    setActionModalError('');
    setActionModalOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedReport) return;
    setIsSubmittingAction(true);
    setActionModalError('');
    try {
      await takeModerationAction(selectedReport.id, moderationAction, actionNote);
      setActionModalOpen(false);
      fetchReports(pagination.page);
    } catch (err) {
      console.error('Failed to submit moderation action:', err);
      setActionModalError(err?.message || 'Failed to execute moderation action.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
            Pending
          </span>
        );
      case 'REVIEWING':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 border border-sky-300 dark:border-sky-800">
            In Review
          </span>
        );
      case 'REVIEWED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800">
            Reviewed
          </span>
        );
      case 'ACTION_TAKEN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
            Action Taken
          </span>
        );
      case 'DISMISSED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
            Dismissed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {status}
          </span>
        );
    }
  };

  const getCommentStatusBadge = (status) => {
    switch (status) {
      case 'VISIBLE':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            VISIBLE
          </span>
        );
      case 'HIDDEN':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            HIDDEN
          </span>
        );
      case 'REMOVED':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
            REMOVED
          </span>
        );
      case 'DELETED':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
            DELETED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
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
            <span>Moderation</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            <span>Content Moderation Queue</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage reported comments and replies, protect community safety, and review audit logs.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'queue'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Report Queue</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'audit'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>
        </div>
      </div>

      {activeTab === 'queue' ? (
        <>
          {/* Status Filter Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedStatus(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  selectedStatus === f.id
                    ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search and Secondary Filter Bar */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Search Bar */}
              <div className="md:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search comments, authors, or reporters..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchReports(1)}
                  className="w-full h-10 pl-9 pr-3 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Reason Selector */}
              <div>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">All Categories</option>
                  {reasonsList.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Order & Refresh */}
              <div className="flex items-center space-x-2">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="flex-1 h-10 px-3 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="DESC">Newest First</option>
                  <option value="ASC">Oldest First</option>
                </select>

                <Button
                  variant="outline"
                  size="md"
                  onClick={() => fetchReports(1)}
                  className="h-10 px-3"
                  title="Refresh Reports"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Reports List */}
          {isLoadingReports ? (
            <div className="py-16">
              <Loading text="Loading reported content..." />
            </div>
          ) : reportError ? (
            <Card className="p-8 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{reportError}</p>
              <Button size="sm" variant="outline" onClick={() => fetchReports(1)}>
                Retry
              </Button>
            </Card>
          ) : reports.length === 0 ? (
            <Card className="p-12 text-center">
              <EmptyState
                icon={<CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />}
                title="Moderation Queue is Clear"
                description={
                  selectedStatus === 'PENDING'
                    ? 'No pending reports require administrator attention at this time.'
                    : 'No reports matched your current filter criteria.'
                }
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {reports.map((item) => {
                const comment = item.comment;
                const reporter = item.reporter;
                const author = comment?.user;

                return (
                  <Card key={item.id} className="p-5 space-y-4">
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center space-x-2.5 flex-wrap">
                        <span className="text-xs font-extrabold text-slate-500">#{item.id}</span>
                        {getStatusBadge(item.status)}
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
                          {item.reasonLabel || item.reason}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center space-x-1">
                          <Clock className="w-3 h-3 inline" />
                          <span>{timeAgo(item.createdAt)}</span>
                        </span>
                      </div>

                      {/* Right side status indicator */}
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="text-slate-400">Comment status:</span>
                        {getCommentStatusBadge(comment?.status)}
                      </div>
                    </div>

                    {/* Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                      {/* Left 2 Cols: Reported Comment Details & Context */}
                      <div className="lg:col-span-2 space-y-3">
                        {/* Video Reference */}
                        {comment?.video && (
                          <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                            <Film className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                            <span className="font-semibold text-slate-500">Video:</span>
                            <Link
                              to={`/watch/${comment.video.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-indigo-600 dark:text-cyan-400 hover:underline inline-flex items-center space-x-1 truncate max-w-sm"
                            >
                              <span>{comment.video.title}</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </Link>
                          </div>
                        )}

                        {/* Author Reference */}
                        <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                          <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="font-semibold text-slate-500">Author:</span>
                          {author ? (
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {author.displayName || author.username}{' '}
                              <span className="text-slate-400 font-normal">(@{author.username})</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Unknown or Removed</span>
                          )}
                        </div>

                        {/* Comment Content Preview */}
                        <div className="bg-slate-50 dark:bg-slate-900/80 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                            Reported Content
                          </p>
                          <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed font-normal">
                            {comment?.content || (
                              <span className="text-slate-400 italic">[Comment unavailable or deleted]</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Right 1 Col: Reporter Note & Resolution Info */}
                      <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/60 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-400 font-semibold">
                            <Flag className="w-3.5 h-3.5 text-rose-500" />
                            <span>Reporter Details</span>
                          </div>
                          <p className="text-slate-700 dark:text-slate-300">
                            {reporter ? (
                              <>
                                <span className="font-medium">{reporter.displayName || reporter.username}</span>{' '}
                                <span className="text-slate-400">(@{reporter.username})</span>
                              </>
                            ) : (
                              <span className="text-slate-400 italic">Anonymous</span>
                            )}
                          </p>

                          {item.description ? (
                            <div className="mt-2 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-700/60">
                              <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Reporter Note:</p>
                              <p className="italic leading-normal break-words">{item.description}</p>
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">No additional note provided.</p>
                          )}

                          {item.resolutionNote && (
                            <div className="mt-2 text-slate-600 dark:text-slate-400 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-200/50 dark:border-emerald-900/40">
                              <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">
                                Resolution Note:
                              </p>
                              <p className="leading-normal break-words">{item.resolutionNote}</p>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center gap-2">
                          {item.status === 'PENDING' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkReviewing(item.id)}
                            >
                              Mark Reviewing
                            </Button>
                          )}

                          {(item.status === 'PENDING' || item.status === 'REVIEWING' || item.status === 'REVIEWED') && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenDismissModal(item)}
                            >
                              Dismiss
                            </Button>
                          )}

                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleOpenActionModal(item)}
                          >
                            Take Action
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              <span>
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total reports)
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchReports(pagination.page - 1)}
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchReports(pagination.page + 1)}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Audit Logs View */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <History className="w-5 h-5 text-indigo-500" />
              <span>Administrative Moderation History</span>
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAuditLogs(1)}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh Logs
            </Button>
          </div>

          {isLoadingAudit ? (
            <div className="py-16">
              <Loading text="Loading audit records..." />
            </div>
          ) : auditLogs.length === 0 ? (
            <Card className="p-12 text-center">
              <EmptyState
                icon={<FileText className="w-12 h-12 text-slate-400 mx-auto" />}
                title="No Moderation Logs"
                description="No administrator moderation actions have been recorded yet."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <Card key={log.id} className="p-4 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <span className="font-extrabold text-slate-400">#{log.id}</span>
                      <span className="px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                        {log.action}
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {log.targetType} #{log.targetId}
                      </span>
                    </div>
                    <span className="text-slate-400">{timeAgo(log.createdAt)}</span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-4 text-slate-500 dark:text-slate-400">
                    <div>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Admin: </span>
                      {log.admin ? (
                        <span>
                          {log.admin.displayName || log.admin.username} (@{log.admin.username})
                        </span>
                      ) : (
                        <span>ID #{log.adminId}</span>
                      )}
                    </div>
                    {log.reason && (
                      <div>
                        <span className="font-semibold text-slate-600 dark:text-slate-300">Reason: </span>
                        <span>{log.reason}</span>
                      </div>
                    )}
                  </div>

                  {log.metadata && (
                    <div className="mt-2 text-[11px] bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800 break-words">
                      {typeof log.metadata === 'string'
                        ? log.metadata
                        : JSON.stringify(log.metadata, null, 2)}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* Audit Pagination */}
          {auditPagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              <span>
                Showing page {auditPagination.page} of {auditPagination.totalPages}
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={auditPagination.page <= 1}
                  onClick={() => fetchAuditLogs(auditPagination.page - 1)}
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={auditPagination.page >= auditPagination.totalPages}
                  onClick={() => fetchAuditLogs(auditPagination.page + 1)}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Moderation Action Modal */}
      <Modal
        isOpen={actionModalOpen}
        onClose={() => !isSubmittingAction && setActionModalOpen(false)}
        title="Execute Moderation Action"
      >
        <div className="space-y-4 pt-2">
          {selectedReport && (
            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <span className="font-bold text-slate-500">Reported Content:</span>
              <p className="text-slate-700 dark:text-slate-300 italic line-clamp-3">
                "{selectedReport.comment?.content}"
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Choose Action
            </label>
            <div className="space-y-2">
              <label
                className={`flex items-start space-x-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                  moderationAction === 'HIDE_COMMENT'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <input
                  type="radio"
                  name="moderationAction"
                  value="HIDE_COMMENT"
                  checked={moderationAction === 'HIDE_COMMENT'}
                  onChange={() => setModerationAction('HIDE_COMMENT')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                    <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                    <span>Hide Comment (Temporarily Unavailable)</span>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Masks comment text for general viewers while preserving reply trees and translation cache invalidation.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start space-x-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                  moderationAction === 'REMOVE_COMMENT'
                    ? 'border-rose-600 bg-rose-50/50 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <input
                  type="radio"
                  name="moderationAction"
                  value="REMOVE_COMMENT"
                  checked={moderationAction === 'REMOVE_COMMENT'}
                  onChange={() => setModerationAction('REMOVE_COMMENT')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Remove Comment (Soft Moderation Removal)</span>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Replaces comment text with "[This comment has been removed by a moderator.]", disallows likes/replies, and purges translations.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start space-x-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                  moderationAction === 'NO_ACTION'
                    ? 'border-slate-600 bg-slate-50 dark:bg-slate-800'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <input
                  type="radio"
                  name="moderationAction"
                  value="NO_ACTION"
                  checked={moderationAction === 'NO_ACTION'}
                  onChange={() => setModerationAction('NO_ACTION')}
                  className="mt-0.5 text-slate-600 focus:ring-slate-500"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>No Action (Keep Comment Visible)</span>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Dismisses flags and resolves the report without modifying the comment state.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Administrative Resolution Note
            </label>
            <textarea
              rows={3}
              placeholder="Explain rationale for this action (stored in audit log)..."
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {actionModalError && (
            <p className="text-xs text-rose-500 font-medium">{actionModalError}</p>
          )}

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              disabled={isSubmittingAction}
              onClick={() => setActionModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant={moderationAction === 'REMOVE_COMMENT' ? 'danger' : 'primary'}
              size="sm"
              isLoading={isSubmittingAction}
              onClick={handleConfirmAction}
            >
              Confirm Action
            </Button>
          </div>
        </div>
      </Modal>

      {/* Dismiss Report Modal */}
      <Modal
        isOpen={dismissModalOpen}
        onClose={() => !isDismissing && setDismissModalOpen(false)}
        title="Dismiss Report"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Dismissing this report marks it as reviewed with no violation found. The comment will remain visible.
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Optional Dismissal Note
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Reviewed and determined to not violate community guidelines."
              value={dismissNote}
              onChange={(e) => setDismissNote(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              disabled={isDismissing}
              onClick={() => setDismissModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              isLoading={isDismissing}
              onClick={handleConfirmDismiss}
            >
              Confirm Dismissal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminModeration;
