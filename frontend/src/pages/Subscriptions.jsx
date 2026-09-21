import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Crown,
  Check,
  Zap,
  Shield,
  Sparkles,
  HardDrive,
  Upload,
  Download,
  AlertCircle,
  History,
  Tv,
  ArrowRight,
  ChevronRight,
  Clock,
  CheckCircle2,
  RefreshCw,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import RazorpayCardModal from '../components/subscriptions/RazorpayCardModal';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import { timeAgo } from '../utils/timeAgo';
import {
  getSubscriptionPlans,
  getCurrentSubscription,
  changeSubscription,
  getSubscriptionHistory,
} from '../services/subscriptionService';
import {
  createPaymentOrder,
  verifyPayment,
  getPaymentHistory,
} from '../services/paymentService';

// Fallback channels from Phase 1
const mockChannels = [
  { id: 'codecraft', name: 'CodeCraft', initial: 'C' },
  { id: 'techvanguard', name: 'TechVanguard', initial: 'T' },
  { id: 'devmastery', name: 'DevMastery', initial: 'D' },
  { id: 'pixelcraft', name: 'PixelCraft', initial: 'P' },
  { id: 'cloudnative', name: 'CloudNative', initial: 'C' },
];

const PLAN_RANKS = {
  FREE: 0,
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
};

const Subscriptions = () => {
  const { isAuthenticated, user } = useAuth();

  // Tabs: 'membership' | 'payments' | 'channels'
  const [activeTab, setActiveTab] = useState('membership');

  // Plans & Current Subscription State
  const [plans, setPlans] = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [history, setHistory] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [errorMsg, setErrorMsg] = useState('');

  // Upgrade/Downgrade Confirmation Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [targetPlan, setTargetPlan] = useState(null);
  const [isChanging, setIsChanging] = useState(false);
  const [modalError, setModalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [cardModalData, setCardModalData] = useState(null);

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

  // Fetch all subscription and payment data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      // 1. Fetch public plans
      const plansRes = await getSubscriptionPlans();
      if (plansRes && plansRes.plans) {
        setPlans(plansRes.plans);
      }

      // 2. Fetch current subscription, history & payments if authenticated
      if (isAuthenticated) {
        const [subRes, histRes, payRes] = await Promise.allSettled([
          getCurrentSubscription(),
          getSubscriptionHistory({ limit: 10 }),
          getPaymentHistory({ limit: 10 }),
        ]);

        if (subRes.status === 'fulfilled' && subRes.value?.subscription) {
          setCurrentSub(subRes.value.subscription);
        }
        if (histRes.status === 'fulfilled' && histRes.value?.history) {
          setHistory(histRes.value.history);
        }
        if (payRes.status === 'fulfilled' && payRes.value?.payments) {
          setPaymentHistory(payRes.value.payments);
        }
      }
    } catch (err) {
      console.error('Failed to load subscription data:', err);
      setErrorMsg(err?.message || 'Failed to load subscription plans.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open confirmation modal
  const handleSelectPlan = (plan) => {
    setTargetPlan(plan);
    setModalError('');
    setModalOpen(true);
  };

  const currentCode = currentSub?.plan?.code || 'FREE';
  const currentRank = PLAN_RANKS[currentCode] ?? 0;

  // Confirm plan change or trigger Razorpay Checkout
  const handleConfirmChange = async () => {
    if (!targetPlan) return;
    setIsChanging(true);
    setModalError('');

    const targetRank = PLAN_RANKS[targetPlan.code] ?? 0;
    const isPaidUpgrade = targetPlan.code !== 'FREE' && targetRank > currentRank;

    try {
      if (isPaidUpgrade) {
        // --- RAZORPAY TEST PAYMENT FLOW ---
        // 1. Create order on backend (authoritative amount from MySQL)
        const orderRes = await createPaymentOrder({
          planCode: targetPlan.code,
          billingCycle: billingCycle.toUpperCase(),
        });

        const key = orderRes.keyId || orderRes.razorpay?.keyId || '';
        const orderId = orderRes.orderId || orderRes.order_id || orderRes.order?.id;
        const amount = orderRes.amount || orderRes.order?.amount;
        const currency = orderRes.currency || orderRes.order?.currency || 'INR';

        // If simulated mode (e.g. placeholder keys), open interactive Card Payment Modal
        if (orderRes.isSimulated || key.includes('placeholder')) {
          console.log('[Razorpay] Using test sandbox simulator (placeholder keys detected)');
          setCardModalData({
            orderId,
            amount,
            currency,
            plan: targetPlan,
            billingCycle,
            simulatedPayment: orderRes.simulatedPayment,
          });
          setModalOpen(false);
          setIsChanging(false);
          return;
        }

        // 2. Load Razorpay Checkout Script
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded || !window.Razorpay) {
          setModalError('Unable to load Razorpay Checkout. Please check your internet connection and try again.');
          setIsChanging(false);
          return;
        }

        // 3. Launch official Razorpay Checkout Modal
        const options = {
          key,
          amount,
          currency,
          name: 'StreamWave',
          description: orderRes.description || `${targetPlan.name} Subscription (${billingCycle.toUpperCase()})`,
          order_id: orderId,
          prefill: {
            name: user?.username || '',
            email: user?.email || '',
          },
          theme: {
            color: '#6366f1',
          },
          handler: async (response) => {
            console.log('[Razorpay] Payment response received');
            setIsChanging(true);
            try {
              // 4. Send payment details to backend for cryptographic signature verification
              const verifyRes = await verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });

              setSuccessMessage('Payment successful! Your subscription is now active.');
              setModalOpen(false);
              await loadData();
              setTimeout(() => setSuccessMessage(''), 6000);
            } catch (vErr) {
              console.error('[Razorpay] Verification error:', vErr);
              setModalError('Payment could not be verified. Your subscription was not activated.');
            } finally {
              setIsChanging(false);
            }
          },
          modal: {
            ondismiss: () => {
              console.log('[Razorpay] Checkout closed by user');
              setModalError('Payment cancelled.');
              setIsChanging(false);
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (failResp) => {
          console.error('[Razorpay] Payment failed:', failResp?.error);
          setModalError('Payment failed. Please try again.');
          setIsChanging(false);
        });
        rzp.open();
        console.log('[Razorpay] Checkout opened');
      } else {
        // --- DIRECT DEMO / DOWNGRADE FLOW ---
        const res = await changeSubscription(targetPlan.code);
        setSuccessMessage(res.message || `Successfully transitioned to ${targetPlan.name}!`);
        setModalOpen(false);
        await loadData();
        setTimeout(() => setSuccessMessage(''), 5000);
        setIsChanging(false);
      }
    } catch (err) {
      console.error('Failed to process subscription:', err);
      setModalError(err?.message || 'Failed to update subscription. Please try again.');
      setIsChanging(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Tabs Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Crown className="w-6 h-6 text-amber-500" />
            <span>Subscriptions & Membership</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Upgrade your storage and creator limits, or follow creator channel uploads
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('membership')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'membership'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-500" />
            <span>Membership Plans</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'payments'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
            <span>Payment History</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('channels')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'channels'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Tv className="w-3.5 h-3.5 text-indigo-500" />
            <span>Followed Channels</span>
          </button>
        </div>
      </div>

      {activeTab === 'membership' && (
        <div className="space-y-8">
          {/* Success Banner */}
          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {/* Sandbox Info Banner */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-cyan-400 flex-shrink-0" />
              <span>
                <strong>Phase 15 Demo Sandbox:</strong> Plan upgrades and downgrades are enabled for testing with instant activation. Real payment gateways (Razorpay) will be connected in Phase 16.
              </span>
            </div>
            {user?.role === 'ADMIN' && (
              <Link
                to="/admin/subscriptions"
                className="text-[11px] font-bold text-indigo-600 dark:text-cyan-400 hover:underline flex items-center space-x-1 flex-shrink-0"
              >
                <span>Admin Settings</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {/* 1. CURRENT SUBSCRIPTION CARD */}
          {isAuthenticated && currentSub && (
            <Card className="p-6 relative overflow-hidden bg-gradient-to-br from-white to-slate-50/80 dark:from-[#0f172a] dark:to-[#111827] border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-5 border-b border-slate-100 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Current Plan
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                      {currentSub.status}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2">
                    <span>{currentSub.plan.name}</span>
                    {currentSub.plan.code === 'GOLD' && (
                      <Crown className="w-6 h-6 text-amber-500 fill-amber-500 inline" />
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 max-w-lg">
                    {currentSub.plan.description}
                  </p>
                </div>

                <div className="text-left md:text-right space-y-1">
                  <p className="text-xs text-slate-400">Billing Tier</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {currentSub.plan.monthlyPrice === 0
                      ? 'Free Forever'
                      : `₹${currentSub.plan.monthlyPrice} / mo`}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Member since {new Date(currentSub.startDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Usage Meters */}
              {currentSub.usage && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
                  {/* Storage Meter */}
                  <div className="bg-white dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center space-x-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Cloud Storage</span>
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {currentSub.usage.storageMaxGb === 0
                          ? `${currentSub.usage.storageUsedGb} GB / Unlimited`
                          : `${currentSub.usage.storageUsedGb} GB / ${currentSub.usage.storageMaxGb} GB`}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full transition-all"
                        style={{
                          width: `${
                            currentSub.usage.storageMaxGb === 0
                              ? 15
                              : Math.min(
                                  100,
                                  Math.round(
                                    (currentSub.usage.storageUsedGb / currentSub.usage.storageMaxGb) *
                                      100
                                  )
                                )
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Video Uploads Meter */}
                  <div className="bg-white dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center space-x-1.5">
                        <Upload className="w-3.5 h-3.5 text-cyan-500" />
                        <span>Uploaded Videos</span>
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {currentSub.usage.uploadsMax === 0
                          ? `${currentSub.usage.uploadsUsed} / Unlimited`
                          : `${currentSub.usage.uploadsUsed} / ${currentSub.usage.uploadsMax}`}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all"
                        style={{
                          width: `${
                            currentSub.usage.uploadsMax === 0
                              ? 20
                              : Math.min(
                                  100,
                                  Math.round(
                                    (currentSub.usage.uploadsUsed / currentSub.usage.uploadsMax) *
                                      100
                                  )
                                )
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Downloads Quota */}
                  <div className="bg-white dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center space-x-1.5">
                        <Download className="w-3.5 h-3.5 text-amber-500" />
                        <span>Monthly Offline Downloads</span>
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {currentSub.usage.downloadsMax === 0
                          ? currentSub.plan.code === 'GOLD'
                            ? 'Unlimited'
                            : '0 / None'
                          : `${currentSub.usage.downloadsUsed} / ${currentSub.usage.downloadsMax}`}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all"
                        style={{
                          width: `${
                            currentSub.usage.downloadsMax === 0
                              ? currentSub.plan.code === 'GOLD'
                                ? 10
                                : 0
                              : 5
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* 2. PLAN CARDS GRID */}
          <div className="space-y-6">
            <div className="text-center space-y-2 max-w-xl mx-auto">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Choose the Perfect Plan
              </h2>
              <p className="text-xs text-slate-500">
                Unlock higher storage limits, HD offline downloads, and dedicated support.
              </p>

              {/* Monthly vs Yearly Switcher */}
              <div className="pt-2 flex items-center justify-center space-x-3 text-xs">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3 py-1 rounded-full font-semibold transition-colors ${
                    billingCycle === 'monthly'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-3 py-1 rounded-full font-semibold transition-colors flex items-center space-x-1 ${
                    billingCycle === 'yearly'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>Annual Billing</span>
                  <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.2 rounded-full font-extrabold">
                    SAVE 17%
                  </span>
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="py-16">
                <Loading text="Loading membership plans..." />
              </div>
            ) : errorMsg ? (
              <div className="p-8 text-center text-rose-500 space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto" />
                <p className="text-sm font-semibold">{errorMsg}</p>
                <Button size="sm" variant="outline" onClick={loadData}>
                  Retry
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map((plan) => {
                  const isCurrent = currentCode === plan.code;
                  const planRank = PLAN_RANKS[plan.code] ?? 0;
                  const isUpgrade = planRank > currentRank;
                  const isDowngrade = planRank < currentRank;
                  const price =
                    billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

                  const isPopular = plan.code === 'SILVER';
                  const isGold = plan.code === 'GOLD';

                  return (
                    <Card
                      key={plan.id}
                      className={`p-6 flex flex-col justify-between relative transition-all duration-200 ${
                        isPopular
                          ? 'border-indigo-500 dark:border-cyan-400 ring-2 ring-indigo-500/20 shadow-md'
                          : isGold
                          ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-500/20'
                          : isCurrent
                          ? 'border-emerald-500 ring-1 ring-emerald-500/30'
                          : ''
                      }`}
                    >
                      {/* Top Badges */}
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-[10px] font-extrabold px-3 py-0.5 rounded-full shadow-sm tracking-wider uppercase">
                          Most Popular
                        </div>
                      )}
                      {isGold && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-extrabold px-3 py-0.5 rounded-full shadow-sm tracking-wider uppercase flex items-center space-x-1">
                          <Crown className="w-3 h-3 fill-white" />
                          <span>VIP Tier</span>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">
                              {plan.name}
                            </h3>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1 min-h-[32px]">
                            {plan.description}
                          </p>
                        </div>

                        {/* Price Display */}
                        <div className="pt-1 pb-3 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-baseline space-x-1">
                            <span className="text-3xl font-black text-slate-900 dark:text-white">
                              ₹{price}
                            </span>
                            <span className="text-xs text-slate-400">
                              {plan.monthlyPrice === 0
                                ? ''
                                : billingCycle === 'yearly'
                                ? '/ year'
                                : '/ month'}
                            </span>
                          </div>
                          {billingCycle === 'yearly' && plan.monthlyPrice > 0 && (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                              ≈ ₹{Math.round(plan.yearlyPrice / 12)} / mo billed annually
                            </p>
                          )}
                        </div>

                        {/* Feature List */}
                        <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                          {plan.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start space-x-2">
                              <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Action Button */}
                      <div className="pt-6">
                        {!isAuthenticated ? (
                          <Link to="/login" className="block">
                            <Button variant="outline" size="md" className="w-full">
                              Sign in to Select
                            </Button>
                          </Link>
                        ) : isCurrent ? (
                          <Button
                            variant="secondary"
                            size="md"
                            disabled={true}
                            className="w-full opacity-80"
                          >
                            Current Plan
                          </Button>
                        ) : isUpgrade ? (
                          <Button
                            variant="primary"
                            size="md"
                            className="w-full shadow-sm"
                            onClick={() => handleSelectPlan(plan)}
                          >
                            Upgrade to {plan.name}
                          </Button>
                        ) : isDowngrade ? (
                          <Button
                            variant="outline"
                            size="md"
                            className="w-full hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => handleSelectPlan(plan)}
                          >
                            Downgrade to {plan.name}
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="md"
                            className="w-full"
                            onClick={() => handleSelectPlan(plan)}
                          >
                            Select Plan
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. COMPARISON TABLE */}
          {plans.length > 0 && (
            <div className="space-y-4 pt-6">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Full Tier Feature Comparison
                </h3>
                <p className="text-xs text-slate-500">
                  Compare exact platform capabilities and limits across tiers
                </p>
              </div>

              <Card className="overflow-x-auto shadow-sm">
                <table className="w-full text-xs text-left border-collapse min-w-[650px]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                      <th className="p-3.5 font-bold text-slate-600 dark:text-slate-300">Feature</th>
                      {plans.map((p) => (
                        <th
                          key={p.id}
                          className={`p-3.5 font-bold text-center ${
                            currentCode === p.code
                              ? 'text-indigo-600 dark:text-cyan-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    <tr>
                      <td className="p-3 font-medium text-slate-600 dark:text-slate-400">
                        Monthly Price
                      </td>
                      {plans.map((p) => (
                        <td key={p.id} className="p-3 text-center font-semibold text-slate-900 dark:text-white">
                          {p.monthlyPrice === 0 ? 'Free' : `₹${p.monthlyPrice}`}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-slate-600 dark:text-slate-400">
                        Video Uploads Limit
                      </td>
                      {plans.map((p) => (
                        <td key={p.id} className="p-3 text-center font-semibold text-slate-900 dark:text-white">
                          {p.maxVideoUploads === 0 ? 'Unlimited' : `${p.maxVideoUploads} videos`}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-slate-600 dark:text-slate-400">
                        Cloud Storage
                      </td>
                      {plans.map((p) => (
                        <td key={p.id} className="p-3 text-center font-semibold text-slate-900 dark:text-white">
                          {p.maxStorageGb === 0 ? 'Unlimited' : `${p.maxStorageGb} GB`}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-slate-600 dark:text-slate-400">
                        Offline Downloads
                      </td>
                      {plans.map((p) => (
                        <td key={p.id} className="p-3 text-center font-semibold text-slate-900 dark:text-white">
                          {p.downloadLimit === 0
                            ? p.code === 'GOLD'
                              ? 'Unlimited'
                              : 'None'
                            : `${p.downloadLimit} / mo`}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-slate-600 dark:text-slate-400">
                        Premium Videos
                      </td>
                      {plans.map((p) => (
                        <td key={p.id} className="p-3 text-center">
                          {p.premiumAccess ? (
                            <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-slate-600 dark:text-slate-400">
                        VIP Priority Support
                      </td>
                      {plans.map((p) => (
                        <td key={p.id} className="p-3 text-center">
                          {p.prioritySupport ? (
                            <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* 4. SUBSCRIPTION HISTORY SECTION */}
          {isAuthenticated && history.length > 0 && (
            <div className="space-y-3 pt-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <History className="w-4 h-4 text-slate-500" />
                <span>Membership Activity & History</span>
              </h3>

              <div className="space-y-2">
                {history.map((item) => (
                  <Card key={item.id} className="p-3.5 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.action === 'UPGRADED'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            : item.action === 'DOWNGRADED'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'
                        }`}
                      >
                        {item.action}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {item.previousPlanName ? `${item.previousPlanName} → ` : ''}
                        {item.newPlanName}
                      </span>
                      {item.reason && (
                        <span className="text-slate-400 hidden sm:inline truncate max-w-xs">
                          ({item.reason})
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 flex items-center space-x-1 flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>{timeAgo(item.createdAt)}</span>
                    </span>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. PAYMENT HISTORY TAB */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-emerald-500" />
                <span>Payment & Transaction History</span>
              </h2>
              <p className="text-xs text-slate-500">
                Authoritative record of your Razorpay test subscription upgrades and invoices
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </Button>
          </div>

          {!isAuthenticated ? (
            <EmptyState
              icon={CreditCard}
              title="Sign in to View Payments"
              description="Please sign in with your account to access your transaction and billing history."
            />
          ) : paymentHistory.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No Payment Records Found"
              description="You haven't completed any subscription payments yet. Upgrades to paid tiers will appear here."
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Receipt / Reference</th>
                      <th className="py-3 px-4 font-semibold">Tier Plan</th>
                      <th className="py-3 px-4 font-semibold">Amount</th>
                      <th className="py-3 px-4 font-semibold">Payment Gateway</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {paymentHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-white">
                          {item.receipt || `#${item.id}`}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {item.plan?.name || item.plan?.code}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                          ₹{item.amount}
                          <span className="text-[10px] font-normal text-slate-400 block">
                            {item.billingCycle}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {item.provider || 'RAZORPAY'} <span className="text-[10px] text-amber-500 font-semibold">(Test Mode)</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                                : item.status === 'CREATED' || item.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                          {timeAgo(item.paidAt || item.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* 3. CREATOR CHANNELS TAB */}
      {activeTab === 'channels' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Followed Creators
              </h2>
              <p className="text-xs text-slate-500">
                Latest updates and content from your favorite channels
              </p>
            </div>
          </div>

          {/* Subscribed Channels Bar */}
          <div className="flex items-center space-x-4 overflow-x-auto pb-2 scrollbar-none">
            {mockChannels.map((chan) => (
              <Link
                key={chan.id}
                to={`/channel/${chan.id}`}
                className="flex flex-col items-center space-y-1.5 flex-shrink-0 group"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center text-white text-base font-bold ring-2 ring-indigo-500/40 group-hover:scale-105 transition-transform shadow-sm">
                  {chan.initial}
                </div>
                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium group-hover:underline">
                  {chan.name}
                </span>
              </Link>
            ))}
          </div>

          {/* Videos Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} hoverEffect className="overflow-hidden group">
                <Link to={`/watch/sub-vid-${i}`} className="relative aspect-video bg-slate-200 dark:bg-slate-800 block">
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[10px] text-white">
                    19:45
                  </span>
                </Link>
                <div className="p-4 space-y-1">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-cyan-400">
                    Creator Video #{i}: Modern Microservices & Event Streams
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    CodeCraft • 24K views • 2 days ago
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Plan Change & Razorpay Checkout Confirmation Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !isChanging && setModalOpen(false)}
        title={
          targetPlan
            ? (PLAN_RANKS[targetPlan.code] ?? 0) > currentRank && targetPlan.code !== 'FREE'
              ? `Upgrade to ${targetPlan.name} via Razorpay`
              : `Switch to ${targetPlan.name}`
            : 'Confirm Subscription Change'
        }
      >
        {targetPlan && (
          <div className="space-y-4 pt-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Selected Plan:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {currentSub?.plan?.name || 'Free Plan'} → {targetPlan.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Billing Cycle:</span>
                <span className="font-semibold text-slate-900 dark:text-white capitalize">
                  {billingCycle}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Price:</span>
                <span className="font-black text-base text-slate-900 dark:text-white">
                  {targetPlan.code === 'FREE'
                    ? 'Free'
                    : billingCycle === 'yearly'
                    ? `₹${targetPlan.yearlyPrice > 0 ? targetPlan.yearlyPrice : targetPlan.monthlyPrice * 10} / year`
                    : `₹${targetPlan.monthlyPrice} / month`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Storage Quota:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {targetPlan.maxStorageGb === 0 ? 'Unlimited' : `${targetPlan.maxStorageGb} GB`}
                </span>
              </div>
            </div>

            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {(PLAN_RANKS[targetPlan.code] ?? 0) < currentRank
                ? 'Your existing uploads and videos remain preserved. The new tier quotas will take effect immediately.'
                : 'Upgrading grants immediate quota expansion, higher storage limits, and full priority privileges.'}
            </p>

            {(PLAN_RANKS[targetPlan.code] ?? 0) > currentRank && targetPlan.code !== 'FREE' ? (
              <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-[11px] text-indigo-900 dark:text-indigo-200 flex items-center space-x-2">
                <Shield className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span>
                  <strong>Razorpay Test Mode:</strong> Safe sandbox checkout. Use official test cards or simulated payment. No real money will be charged.
                </span>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                ⚡ <strong>Free / Downgrade:</strong> No payment required.
              </div>
            )}

            {modalError && <p className="text-rose-500 font-semibold">{modalError}</p>}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                disabled={isChanging}
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isChanging}
                onClick={handleConfirmChange}
              >
                {targetPlan.code === 'FREE'
                  ? 'Confirm Free Tier'
                  : (PLAN_RANKS[targetPlan.code] ?? 0) < currentRank
                  ? `Downgrade to ${targetPlan.name}`
                  : `Pay & Upgrade to ${targetPlan.name}`}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Razorpay Interactive Card & OTP Payment Modal (Active when using placeholder test keys) */}
      <RazorpayCardModal
        isOpen={Boolean(cardModalData)}
        onClose={() => {
          setCardModalData(null);
          setModalError('Payment cancelled.');
        }}
        orderData={cardModalData}
        isProcessing={isChanging}
        onPaymentSuccess={async (verifyPayload) => {
          setIsChanging(true);
          try {
            console.log('[Razorpay] Payment response received');
            const verifyRes = await verifyPayment(verifyPayload);

            setSuccessMessage('Payment successful! Your subscription is now active.');
            setCardModalData(null);
            await loadData();
            setTimeout(() => setSuccessMessage(''), 6000);
          } catch (vErr) {
            console.error('[Razorpay] Verification error:', vErr);
            setModalError('Payment could not be verified. Your subscription was not activated.');
          } finally {
            setIsChanging(false);
          }
        }}
      />
    </div>
  );
};

export default Subscriptions;
