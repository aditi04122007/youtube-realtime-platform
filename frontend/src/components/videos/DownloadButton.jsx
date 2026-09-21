import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Loader2, Lock, LogIn, Crown, AlertCircle, X, ExternalLink, Gauge } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getVideoDownloadAccess, downloadVideo } from '../../services/videoService';
import { getDownloadQuota } from '../../services/downloadHistoryService';

const DownloadButton = ({ video, className = '', showQuotaBadge = true }) => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [loadingAccess, setLoadingAccess] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [accessState, setAccessState] = useState(null);
  const [quota, setQuota] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  // Refresh quota from server
  const refreshQuota = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const qRes = await getDownloadQuota();
      if (qRes && qRes.success && qRes.quota) {
        setQuota(qRes.quota);
      }
    } catch (err) {
      console.warn('[DownloadButton] Failed to refresh quota:', err.message);
    }
  }, [isAuthenticated]);

  // Check download eligibility whenever video or auth state changes
  useEffect(() => {
    let isMounted = true;

    if (!video || !video.id) {
      setAccessState(null);
      setQuota(null);
      return;
    }

    // Guest: login required immediately
    if (!isAuthenticated) {
      setAccessState({
        canDownload: false,
        requiresAuth: true,
        reason: 'LOGIN_REQUIRED',
      });
      setQuota(null);
      return;
    }

    const fetchAccess = async () => {
      setLoadingAccess(true);
      try {
        const res = await getVideoDownloadAccess(video.id);
        if (isMounted) {
          setAccessState({
            canDownload: Boolean(res.canDownload),
            reason: res.reason || res.code,
            code: res.code,
            planCode: res.planCode,
            requiresAuth: Boolean(res.requiresAuth),
            requiresSubscription: Boolean(res.requiresSubscription),
            isOwner: Boolean(res.isOwner),
          });
          if (res.quota) {
            setQuota(res.quota);
          } else {
            refreshQuota();
          }
        }
      } catch (err) {
        if (isMounted) {
          if (err.status === 401 || err.response?.status === 401) {
            setAccessState({
              canDownload: false,
              requiresAuth: true,
              reason: 'LOGIN_REQUIRED',
            });
          } else if (err.response?.data?.code === 'QUOTA_EXHAUSTED') {
            setAccessState({
              canDownload: false,
              requiresSubscription: false,
              reason: 'QUOTA_EXHAUSTED',
              code: 'QUOTA_EXHAUSTED',
            });
            if (err.response.data.quota) {
              setQuota(err.response.data.quota);
            }
          } else {
            setAccessState({
              canDownload: false,
              requiresSubscription: true,
              reason: 'DOWNLOADS_NOT_INCLUDED',
            });
          }
        }
      } finally {
        if (isMounted) {
          setLoadingAccess(false);
        }
      }
    };

    fetchAccess();

    return () => {
      isMounted = false;
    };
  }, [video?.id, isAuthenticated, user?.id, refreshQuota]);

  const handleDownloadClick = async () => {
    setErrorNotice(null);

    // 1. Not Authenticated -> redirect to login
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    // 2. Quota exhausted -> open quota exhausted dialog
    const isQuotaExhausted =
      accessState?.code === 'QUOTA_EXHAUSTED' ||
      accessState?.reason === 'QUOTA_EXHAUSTED' ||
      (quota && !quota.unlimited && quota.limit > 0 && quota.remaining <= 0);

    if (isQuotaExhausted) {
      setShowQuotaModal(true);
      return;
    }

    // 3. Not Allowed -> prompt upgrade
    if (!accessState?.canDownload) {
      setShowUpgradeModal(true);
      return;
    }

    // 4. Initiate authorized download
    setDownloading(true);
    try {
      await downloadVideo(video.id);
      // Section 21: Refresh quota after download begins
      await refreshQuota();
    } catch (err) {
      console.error('[DownloadButton] Download error:', err);
      const isExhausted = err.response?.data?.code === 'QUOTA_EXHAUSTED';
      if (isExhausted) {
        setShowQuotaModal(true);
      } else {
        const msg = err.response?.data?.message || err.message || 'Download unavailable';
        setErrorNotice(msg);
        setTimeout(() => setErrorNotice(null), 6000);
      }
    } finally {
      setDownloading(false);
    }
  };

  // Render quota text helper (Section 19)
  const renderQuotaText = () => {
    if (!isAuthenticated) {
      return 'Sign in to check download quota';
    }
    if (quota?.unlimited) {
      return 'Unlimited downloads';
    }
    if (quota && quota.limit > 0) {
      return `Downloads remaining: ${quota.remaining} / ${quota.limit}`;
    }
    return 'Downloads unavailable on your current plan';
  };

  // State 1: Checking access (Section 20: Loading)
  if (loadingAccess) {
    return (
      <div className="inline-flex flex-col items-start gap-1">
        <button
          type="button"
          disabled
          className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-semibold cursor-wait ${className}`}
          title="Checking download access..."
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
          <span>Checking download access...</span>
        </button>
      </div>
    );
  }

  // State 2: Not logged in (Section 20: No download permission)
  if (!isAuthenticated) {
    return (
      <div className="inline-flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={handleDownloadClick}
          className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all shadow-sm active:scale-95 ${className}`}
          title="Sign in to download this video"
        >
          <LogIn className="w-3.5 h-3.5 text-indigo-500" />
          <span>Sign in to download</span>
        </button>
      </div>
    );
  }

  // State 3: Quota Exhausted (Section 20: Quota exhausted)
  const isQuotaExhausted =
    accessState?.code === 'QUOTA_EXHAUSTED' ||
    accessState?.reason === 'QUOTA_EXHAUSTED' ||
    (quota && !quota.unlimited && quota.limit > 0 && quota.remaining <= 0);

  if (isQuotaExhausted) {
    return (
      <>
        <div className="inline-flex flex-col items-start gap-1">
          <button
            type="button"
            onClick={() => setShowQuotaModal(true)}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold transition-all shadow-sm active:scale-95 ${className}`}
            title="Monthly download quota exhausted"
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
            <span>Download limit reached</span>
          </button>
          {showQuotaBadge && (
            <span className="text-[11px] font-medium text-rose-500 dark:text-rose-400">
              {renderQuotaText()}
            </span>
          )}
        </div>

        {/* Quota Exhausted Modal */}
        {showQuotaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
              <button
                type="button"
                onClick={() => setShowQuotaModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Gauge className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Monthly Download Limit Reached
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  You have used all <strong>{quota?.limit || 20}</strong> downloads for your current{' '}
                  <strong>{quota?.planName || 'active'}</strong> monthly billing cycle.
                  Upgrade to <strong>Silver Creator</strong> (100 downloads) or <strong>Gold VIP</strong> (unlimited) to continue downloading.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuotaModal(false);
                    navigate('/subscription-dashboard');
                  }}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5"
                >
                  <span>Upgrade Plan</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowQuotaModal(false);
                    navigate('/download-history');
                  }}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
                >
                  View Downloads
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // State 4: Subscription Upgrade Required (Section 20: No download permission)
  if (accessState && !accessState.canDownload) {
    const isPremiumIssue = accessState.reason === 'PREMIUM_REQUIRED' || accessState.reason === 'UPGRADE_REQUIRED';

    return (
      <>
        <div className="inline-flex flex-col items-start gap-1">
          <button
            type="button"
            onClick={handleDownloadClick}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 text-xs font-semibold transition-all shadow-sm active:scale-95 ${className}`}
            title={isPremiumIssue ? 'Premium subscription required' : 'Downloads unavailable on your current plan'}
          >
            {isPremiumIssue ? (
              <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            )}
            <span>Upgrade to download</span>
          </button>
          {showQuotaBadge && (
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              {renderQuotaText()}
            </span>
          )}
        </div>

        {/* Upgrade / Subscription Information Modal */}
        {showUpgradeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Crown className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Downloads Require a Subscription
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Downloads are not included in your current plan. Upgrade to <strong>Bronze Supporter</strong> (20 downloads/mo), <strong>Silver Creator</strong> (100 downloads/mo), or <strong>Gold VIP</strong> (unlimited) to download videos for offline viewing.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowUpgradeModal(false);
                    navigate('/subscription-dashboard');
                  }}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5"
                >
                  <span>View Subscription Plans</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // State 5: Available & ready to download (or Starting download...)
  return (
    <div className="relative inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleDownloadClick}
        disabled={downloading}
        className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-75 disabled:cursor-wait ${className}`}
        title="Download video for offline viewing"
      >
        {downloading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
            <span>Starting download...</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-cyan-400" />
            <span>Download</span>
          </>
        )}
      </button>

      {/* Quota text display (Section 19) */}
      {showQuotaBadge && (
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {renderQuotaText()}
        </span>
      )}

      {/* Error notice tooltip/banner */}
      {errorNotice && (
        <div className="absolute top-full mt-2 left-0 z-40 w-64 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/90 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] shadow-lg flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 leading-snug">{errorNotice}</div>
          <button
            type="button"
            onClick={() => setErrorNotice(null)}
            className="text-rose-400 hover:text-rose-600 dark:hover:text-rose-200"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

export default DownloadButton;
