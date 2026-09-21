import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ArrowRight,
} from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';

/**
 * Razorpay Card Payment Modal
 * Provides an interactive card checkout and 3D-Secure OTP verification flow
 * for Razorpay sandbox test mode when placeholder credentials are used.
 */
const RazorpayCardModal = ({
  isOpen,
  onClose,
  orderData,
  onPaymentSuccess,
  isProcessing = false,
}) => {
  // Step 1: 'card' (Card Details) | Step 2: 'otp' (Bank 3D-Secure OTP)
  const [step, setStep] = useState('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [otp, setOtp] = useState('');
  const [formError, setFormError] = useState('');

  // Reset form when modal opens with new order
  useEffect(() => {
    if (isOpen) {
      setStep('card');
      setCardNumber('');
      setExpiry('');
      setCvv('');
      setCardholderName('');
      setOtp('');
      setFormError('');
    }
  }, [isOpen]);

  if (!isOpen || !orderData) return null;

  const rawAmount = orderData.amount || 0;
  const displayAmount = (rawAmount / 100).toFixed(2);
  const planName = orderData.plan?.name || 'Membership Plan';
  const billingCycle = (orderData.billingCycle || 'monthly').toUpperCase();

  // Format Card Number (adds spaces every 4 digits)
  const handleCardNumberChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    setCardNumber(formatted);
    if (formError) setFormError('');
  };

  // Format Expiry (MM/YY)
  const handleExpiryChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      setExpiry(`${raw.slice(0, 2)}/${raw.slice(2)}`);
    } else {
      setExpiry(raw);
    }
    if (formError) setFormError('');
  };

  // Format CVV (max 3-4 digits)
  const handleCvvChange = (e) => {
    setCvv(e.target.value.replace(/\D/g, '').slice(0, 4));
    if (formError) setFormError('');
  };

  // Pre-fill test card details helper
  const handleFillTestCard = () => {
    setCardNumber('4111 1111 1111 1111');
    setExpiry('12/28');
    setCvv('123');
    setCardholderName('Test Subscriber');
    setFormError('');
  };

  // Validate Step 1: Card Details
  const handleProceedToOtp = (e) => {
    e.preventDefault();
    setFormError('');

    const rawCard = cardNumber.replace(/\s+/g, '');
    if (rawCard.length < 16) {
      setFormError('Please enter a valid 16-digit card number (e.g. 4111 1111 1111 1111).');
      return;
    }

    if (!expiry || expiry.length < 5) {
      setFormError('Please enter a valid expiry date (MM/YY, e.g. 12/28).');
      return;
    }

    const [monthStr, yearStr] = expiry.split('/');
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    if (isNaN(month) || month < 1 || month > 12) {
      setFormError('Invalid expiry month. Enter a month between 01 and 12.');
      return;
    }
    if (isNaN(year) || year < 24) {
      setFormError('Card has expired. Enter a future year (e.g. 28).');
      return;
    }

    if (!cvv || cvv.length < 3) {
      setFormError('Please enter a 3-digit CVV security code.');
      return;
    }

    if (!cardholderName.trim()) {
      setFormError('Please enter the cardholder name.');
      return;
    }

    // Move to 3D-Secure OTP verification
    setStep('otp');
    setOtp('');
  };

  // Validate Step 2: OTP Verification & Submit
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      setFormError('Please enter the 6-digit OTP code.');
      return;
    }

    // In Razorpay Test Mode, standard OTP is 123456
    if (trimmedOtp !== '123456') {
      setFormError('Incorrect OTP. In test sandbox mode, please enter 123456.');
      return;
    }

    // Trigger authentic backend verification
    const simPayment = orderData.simulatedPayment || {};
    const verifyPayload = {
      razorpay_order_id: orderData.orderId,
      razorpay_payment_id: simPayment.paymentId || `pay_card_${Date.now()}`,
      razorpay_signature: simPayment.signature || '',
    };

    await onPaymentSuccess(verifyPayload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isProcessing && onClose()}
      title="Razorpay Test Payment Gateway"
    >
      <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
        {/* Gateway Brand & Security Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              RZP
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white leading-tight">
                StreamWave Payments
              </p>
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-3 h-3" />
                <span>256-bit SSL Encrypted Sandbox</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total Due</p>
            <p className="font-black text-slate-900 dark:text-white text-base text-indigo-600 dark:text-indigo-400">
              ₹{displayAmount}
            </p>
          </div>
        </div>

        {/* Plan Summary Pill */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-slate-900 dark:text-white">{planName}</span>
            <span className="text-slate-500 ml-1.5 font-medium">({billingCycle})</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">
            {orderData.orderId}
          </span>
        </div>

        {/* Error Alert */}
        {formError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
            <div>{formError}</div>
          </div>
        )}

        {/* STEP 1: CARD DETAILS FORM */}
        {step === 'card' && (
          <form onSubmit={handleProceedToOtp} className="space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Card Information
              </label>
              <button
                type="button"
                onClick={handleFillTestCard}
                className="text-[11px] font-bold text-indigo-600 dark:text-cyan-400 hover:underline"
              >
                Auto-fill Test Card
              </button>
            </div>

            {/* Card Number */}
            <div className="relative">
              <input
                type="text"
                placeholder="4111 1111 1111 1111"
                value={cardNumber}
                onChange={handleCardNumberChange}
                maxLength={19}
                className="w-full px-3.5 py-2.5 pl-10 text-xs sm:text-sm font-mono tracking-wider bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white placeholder-slate-400"
                disabled={isProcessing}
                autoFocus
              />
              <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>

            {/* Expiry & CVV */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Expiry Date
                </label>
                <input
                  type="text"
                  placeholder="MM/YY (12/28)"
                  value={expiry}
                  onChange={handleExpiryChange}
                  maxLength={5}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white placeholder-slate-400"
                  disabled={isProcessing}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  CVV / CVC
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="123"
                    value={cvv}
                    onChange={handleCvvChange}
                    maxLength={4}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white placeholder-slate-400"
                    disabled={isProcessing}
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5" />
                </div>
              </div>
            </div>

            {/* Cardholder Name */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Name on Card
              </label>
              <input
                type="text"
                placeholder="Cardholder Name"
                value={cardholderName}
                onChange={(e) => {
                  setCardholderName(e.target.value);
                  if (formError) setFormError('');
                }}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white placeholder-slate-400"
                disabled={isProcessing}
              />
            </div>

            {/* Test Credentials Helper Banner */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-200 text-xs">
              <p className="font-semibold">Razorpay Sandbox Credentials:</p>
              <p className="text-[11px] mt-0.5 font-mono">
                Card: <strong>4111 1111 1111 1111</strong> &bull; Expiry: <strong>12/28</strong> &bull; CVV: <strong>123</strong>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isProcessing}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isProcessing}
              >
                <span>Proceed to Pay ₹{displayAmount}</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: BANK 3D-SECURE OTP VERIFICATION */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-indigo-900 dark:text-indigo-200 text-xs">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Bank 3D-Secure Authentication
              </p>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-1">
                Enter the One-Time Password (OTP) sent to your registered mobile number for card ending in{' '}
                <strong className="font-mono">
                  •••• {cardNumber.replace(/\s+/g, '').slice(-4) || '1111'}
                </strong>
                .
              </p>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-1">
                Razorpay Test OTP: <strong className="font-mono bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 rounded">123456</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                One-Time Password (OTP)
              </label>
              <input
                type="text"
                placeholder="123456"
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (formError) setFormError('');
                }}
                maxLength={6}
                className="w-full px-3.5 py-2.5 text-center text-base sm:text-lg font-mono font-bold tracking-widest bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white placeholder-slate-300"
                disabled={isProcessing}
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isProcessing}
                onClick={() => setStep('card')}
              >
                Back to Card
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isProcessing || otp.length < 6}
              >
                {isProcessing ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Verifying Payment...
                  </span>
                ) : (
                  <span>Submit OTP & Upgrade</span>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default RazorpayCardModal;
