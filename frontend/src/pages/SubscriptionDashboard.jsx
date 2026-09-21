import React, { useState, useEffect, useCallback } from 'react';
import {
  Crown,
  CreditCard,
  History,
  Layers,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Loading from '../components/common/Loading';
import ErrorMessage from '../components/common/ErrorMessage';

// Subscription Components
import CurrentPlanCard from '../components/subscriptions/CurrentPlanCard';
import UsageCard from '../components/subscriptions/UsageCard';
import BillingCard from '../components/subscriptions/BillingCard';
import PlanComparison from '../components/subscriptions/PlanComparison';
import PaymentHistory from '../components/subscriptions/PaymentHistory';
import SubscriptionHistory from '../components/subscriptions/SubscriptionHistory';
import RazorpayCardModal from '../components/subscriptions/RazorpayCardModal';

// API Services
import {
  getSubscriptionDashboard,
  getSubscriptionPlans,
  updateAutoRenew,
  changeSubscription,
  getSubscriptionHistory,
  createPaymentOrder,
  verifyPayment,
  getPaymentHistory,
} from '../services/api';

const SubscriptionDashboard = () => {
  const { user } = useAuth();

  // Core Dashboard State
  const [dashboardData, setDashboardData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [payPagination, setPayPagination] = useState({});
  const [history, setHistory] = useState([]);
  const [histPagination, setHistPagination] = useState({});

  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error'|'info', text: string }
  const [activeTab, setActiveTab] = useState('plans'); // 'plans' | 'payments' | 'history'

  // Auto-Renew Updating State
  const [isTogglingAutoRenew, setIsTogglingAutoRenew] = useState(false);

  // Downgrade / Change Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingPlanSelection, setPendingPlanSelection] = useState(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [modalError, setModalError] = useState('');
  const [sandboxModalData, setSandboxModalData] = useState(null);

  // Helper to dynamically load official Razorpay Checkout SDK
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Fetch all dashboard data
  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [dashRes, plansRes, payRes, histRes] = await Promise.allSettled([
        getSubscriptionDashboard(),
        getSubscriptionPlans(),
        getPaymentHistory({ page: 1, limit: 10 }),
        getSubscriptionHistory({ page: 1, limit: 10 }),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value?.success) {
        setDashboardData(dashRes.value);
      } else {
        throw new Error(dashRes.reason?.message || 'Failed to load subscription dashboard.');
      }

      if (plansRes.status === 'fulfilled' && plansRes.value?.plans) {
        setPlans(plansRes.value.plans);
      }

      if (payRes.status === 'fulfilled' && payRes.value?.payments) {
        setPayments(payRes.value.payments);
        setPayPagination(payRes.value.pagination || {});
      }

      if (histRes.status === 'fulfilled' && histRes.value?.history) {
        setHistory(histRes.value.history);
        setHistPagination(histRes.value.pagination || {});
      }
    } catch (err) {
      console.error('Subscription dashboard loading error:', err);
      setErrorMsg(err.message || 'Unable to connect to subscription services.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Handle Auto-Renew Toggle
  const handleToggleAutoRenew = async (newSetting) => {
    setIsTogglingAutoRenew(true);
    setFeedback(null);
    try {
      const res = await updateAutoRenew(newSetting);
      if (res && res.success) {
        setDashboardData((prev) => ({
          ...prev,
          currentSubscription: {
            ...prev.currentSubscription,
            autoRenew: res.autoRenew,
          },
        }));
        setFeedback({
          type: 'success',
          text: res.message || `Auto-renew has been turned ${res.autoRenew ? 'ON' : 'OFF'}.`,
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to update auto-renew preference.',
      });
    } finally {
      setIsTogglingAutoRenew(false);
    }
  };

  // Handle Plan Selection (Upgrade vs Downgrade)
  const handleSelectPlan = async ({ plan, billingCycle, actionType }) => {
    setFeedback(null);

    // If downgrading to FREE or lower plan, show confirmation modal
    if (actionType === 'DOWNGRADE' || plan.code === 'FREE') {
      setPendingPlanSelection({ plan, billingCycle, actionType });
      setModalError('');
      setModalOpen(true);
      return;
    }

    // Otherwise, initiate Razorpay Test Checkout
    await initiateRazorpayCheckout(plan, billingCycle);
  };

  // Execute Razorpay Test Checkout
  const initiateRazorpayCheckout = async (plan, billingCycle) => {
    setIsExecutingAction(true);
    setFeedback(null);
    try {
      // 1. Ensure Razorpay SDK is available
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Unable to load Razorpay Checkout. Please check your internet connection and try again.');
      }

      // 2. Authoritative Order Creation on Backend
      const cycle = (billingCycle || 'monthly').toUpperCase();
      const orderRes = await createPaymentOrder({
        planCode: plan.code,
        billingCycle: cycle,
      });

      if (!orderRes) {
        throw new Error('Failed to generate checkout order.');
      }

      const key = orderRes.keyId || orderRes.razorpay?.keyId;
      const orderId = orderRes.orderId || orderRes.order_id || orderRes.order?.id;
      const amount = orderRes.amount || orderRes.order?.amount;
      const currency = orderRes.currency || orderRes.order?.currency || 'INR';
      const description = orderRes.description || `${plan.name} Subscription (${cycle})`;

      if (!key) {
        throw new Error('Razorpay public key is missing.');
      }

      // If simulated mode (e.g. placeholder keys), show Sandbox Test Simulator Modal
      if (orderRes.isSimulated || key.includes('placeholder')) {
        console.log('[Razorpay] Using test sandbox simulator (placeholder keys detected)');
        setSandboxModalData({
          plan,
          billingCycle: cycle,
          orderId,
          amount,
          currency,
          description,
          simulatedPayment: orderRes.simulatedPayment,
        });
        setIsExecutingAction(false);
        return;
      }

      // 3. Configure Razorpay modal options
      const options = {
        key,
        amount,
        currency,
        name: 'StreamWave',
        description,
        order_id: orderId,
        prefill: {
          name: user?.display_name || user?.username || '',
          email: user?.email || '',
        },
        theme: {
          color: '#4f46e5',
        },
        handler: async (response) => {
          console.log('[Razorpay] Payment response received');
          try {
            setFeedback({ type: 'info', text: 'Verifying payment with gateway...' });

            const verifyRes = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes && verifyRes.success) {
              setFeedback({
                type: 'success',
                text: 'Payment successful! Your subscription is now active.',
              });
              // Reload complete dashboard with updated subscription
              await loadDashboard();
            } else {
              throw new Error(verifyRes?.message || 'Payment could not be verified. Your subscription was not activated.');
            }
          } catch (vErr) {
            console.error('[Razorpay] Verification error:', vErr);
            setFeedback({
              type: 'error',
              text: vErr.response?.data?.message || 'Payment could not be verified. Your subscription was not activated.',
            });
          } finally {
            setIsExecutingAction(false);
          }
        },
        modal: {
          ondismiss: () => {
            console.log('[Razorpay] Checkout closed by user');
            setIsExecutingAction(false);
            setFeedback({
              type: 'info',
              text: 'Payment cancelled.',
            });
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.on('payment.failed', (failResp) => {
        console.error('[Razorpay] Payment failed:', failResp?.error);
        setIsExecutingAction(false);
        setFeedback({
          type: 'error',
          text: 'Payment failed. Please try again.',
        });
      });

      razorpayInstance.open();
      console.log('[Razorpay] Checkout opened');
    } catch (err) {
      console.error('[Razorpay] Checkout error:', err);
      setIsExecutingAction(false);
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Payment failed. Please try again.',
      });
    }
  };

  // Confirm Downgrade / Free plan switch
  const handleConfirmDowngrade = async () => {
    if (!pendingPlanSelection) return;
    setIsExecutingAction(true);
    setModalError('');
    try {
      const res = await changeSubscription(pendingPlanSelection.plan.code);
      if (res && res.success) {
        setModalOpen(false);
        setFeedback({
          type: 'success',
          text: `Successfully switched to the ${pendingPlanSelection.plan.name} tier.`,
        });
        await loadDashboard();
      } else {
        throw new Error(res?.message || 'Failed to switch subscription tier.');
      }
    } catch (err) {
      console.error('Downgrade error:', err);
      setModalError(err.response?.data?.message || err.message || 'Failed to switch plan.');
    } finally {
      setIsExecutingAction(false);
    }
  };

  // Pagination Handlers
  const handlePayPageChange = async (newPage) => {
    try {
      const res = await getPaymentHistory({ page: newPage, limit: 10 });
      if (res && res.payments) {
        setPayments(res.payments);
        setPayPagination(res.pagination || {});
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleHistPageChange = async (newPage) => {
    try {
      const res = await getSubscriptionHistory({ page: newPage, limit: 10 });
      if (res && res.history) {
        setHistory(res.history);
        setHistPagination(res.pagination || {});
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Loading text="Loading your subscription dashboard..." />
      </div>
    );
  }

  if (errorMsg && !dashboardData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <ErrorMessage
          message={errorMsg}
          actionLabel="Retry Loading"
          onAction={loadDashboard}
        />
      </div>
    );
  }

  const { currentSubscription, usage, limits } = dashboardData || {};
  const currentPlanCode = currentSubscription?.plan?.code || 'FREE';

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#070b13] pb-16">
      {/* Dashboard Header Bar */}
      <div className="bg-white dark:bg-[#0a0e17] border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-cyan-400">
                  <Crown className="w-6 h-6" />
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  Subscription & Billing Dashboard
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Manage your membership tier, resource quotas, renewal preferences, and transaction ledger.
              </p>
            </div>

            {/* Test Mode Badge */}
            <div className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Razorpay Test Mode Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Dynamic Feedback Banner */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border text-xs sm:text-sm flex items-start justify-between gap-3 animate-in fade-in duration-200 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
                : feedback.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
                : 'bg-indigo-50 border-indigo-200 text-indigo-900 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-indigo-500" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold ml-2"
            >
              &times;
            </button>
          </div>
        )}

        {/* Section 1: Current Plan Overview */}
        <CurrentPlanCard
          subscription={currentSubscription}
          onToggleAutoRenew={handleToggleAutoRenew}
          isTogglingAutoRenew={isTogglingAutoRenew}
          onExplorePlans={() => setActiveTab('plans')}
        />

        {/* Section 2: Real Usage & Limits */}
        <UsageCard usage={usage} limits={limits} />

        {/* Section 3: Billing & Invoicing Summary */}
        <BillingCard subscription={currentSubscription} />

        {/* Section 4: Interactive Tabs (Plans, Payments, History) */}
        <div className="space-y-6">
          {/* Tab Selector */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('plans')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === 'plans'
                  ? 'border-indigo-600 text-indigo-600 dark:border-cyan-400 dark:text-cyan-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Membership Plans</span>
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === 'payments'
                  ? 'border-indigo-600 text-indigo-600 dark:border-cyan-400 dark:text-cyan-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Payment History ({payPagination.total || payments.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === 'history'
                  ? 'border-indigo-600 text-indigo-600 dark:border-cyan-400 dark:text-cyan-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Plan Changes</span>
            </button>
          </div>

          {/* Tab 1: Plan Comparison & Upgrade/Downgrade Flow */}
          {activeTab === 'plans' && (
            <PlanComparison
              plans={plans}
              currentPlanCode={currentPlanCode}
              onSelectPlan={handleSelectPlan}
              isProcessing={isExecutingAction}
            />
          )}

          {/* Tab 2: Payment History Ledger */}
          {activeTab === 'payments' && (
            <PaymentHistory
              payments={payments}
              pagination={payPagination}
              onPageChange={handlePayPageChange}
            />
          )}

          {/* Tab 3: Subscription Transition History */}
          {activeTab === 'history' && (
            <SubscriptionHistory
              history={history}
              pagination={histPagination}
              onPageChange={handleHistPageChange}
            />
          )}
        </div>
      </div>

      {/* Downgrade Confirmation Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !isExecutingAction && setModalOpen(false)}
        title="Confirm Plan Change"
      >
        <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
          <p>
            You are requesting to change your current tier from{' '}
            <strong className="text-slate-900 dark:text-white">
              {currentSubscription?.plan?.name || currentPlanCode}
            </strong>{' '}
            to{' '}
            <strong className="text-indigo-600 dark:text-cyan-400">
              {pendingPlanSelection?.plan?.name}
            </strong>
            .
          </p>

          {pendingPlanSelection?.plan?.code === 'FREE' ? (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-amber-800 dark:text-amber-200 text-xs">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <strong>Downgrading to Free Starter:</strong> Your premium quotas (higher upload limits, expanded storage) will revert to baseline Free rules (10 uploads, 5GB storage).
                </div>
              </div>
            </div>
          ) : (
            <p>
              Your plan will transition immediately and an audit log will be recorded in your subscription history.
            </p>
          )}

          {modalError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
              {modalError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              disabled={isExecutingAction}
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isExecutingAction}
              onClick={handleConfirmDowngrade}
            >
              {isExecutingAction ? (
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Updating...
                </span>
              ) : (
                'Confirm Change'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Razorpay Interactive Card & OTP Payment Modal (Active when using placeholder test keys) */}
      <RazorpayCardModal
        isOpen={Boolean(sandboxModalData)}
        onClose={() => {
          setSandboxModalData(null);
          setFeedback({ type: 'info', text: 'Payment cancelled.' });
        }}
        orderData={sandboxModalData}
        isProcessing={isExecutingAction}
        onPaymentSuccess={async (verifyPayload) => {
          setIsExecutingAction(true);
          try {
            console.log('[Razorpay] Payment response received');
            const verifyRes = await verifyPayment(verifyPayload);

            if (verifyRes && verifyRes.success) {
              setFeedback({
                type: 'success',
                text: 'Payment successful! Your subscription is now active.',
              });
              setSandboxModalData(null);
              await loadDashboard();
            } else {
              throw new Error(verifyRes?.message || 'Payment could not be verified. Your subscription was not activated.');
            }
          } catch (vErr) {
            console.error('[Razorpay] Verification error:', vErr);
            setFeedback({
              type: 'error',
              text: vErr.response?.data?.message || 'Payment could not be verified. Your subscription was not activated.',
            });
          } finally {
            setIsExecutingAction(false);
          }
        }}
      />
    </div>
  );
};

export default SubscriptionDashboard;
