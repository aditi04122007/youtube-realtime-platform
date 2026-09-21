const paymentService = require('../services/paymentService');

/**
 * POST /api/payments/create-order
 * Create a new Razorpay order for subscription upgrade
 */
const createPaymentOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { planCode, billingCycle } = req.body || {};

    const result = await paymentService.createOrder({
      userId,
      planCode,
      billingCycle,
    });

    return res.status(200).json({
      success: true,
      message: 'Payment order created successfully',
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/payments/verify
 * Cryptographically verify Razorpay payment and activate subscription
 */
const verifyPayment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
      paymentId,
      signature,
    } = req.body || {};

    const result = await paymentService.verifyPayment({
      userId,
      orderId: razorpay_order_id || orderId,
      paymentId: razorpay_payment_id || paymentId,
      signature: razorpay_signature || signature,
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/payments/history
 * Fetch authenticated user's payment history
 */
const getPaymentHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page, limit } = req.query;

    const result = await paymentService.getUserPayments({
      userId,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/payments/webhook
 * Public endpoint for Razorpay webhook callbacks
 */
const handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    const result = await paymentService.handleWebhookEvent({
      rawBody,
      signature,
      eventData: req.body,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('[Webhook] Error processing webhook:', err.message);
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message || 'Webhook processing failed',
    });
  }
};

/**
 * GET /api/admin/payments
 * Administrative ledger of all payments across users
 */
const getAdminPayments = async (req, res, next) => {
  try {
    const { page, limit, status, plan, search, sort } = req.query;

    const result = await paymentService.getAdminPayments({
      page,
      limit,
      status,
      plan,
      search,
      sort,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/payments/:id
 * Detailed payment inspection for administrator
 */
const getAdminPaymentById = async (req, res, next) => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    if (isNaN(paymentId) || paymentId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payment ID' });
    }

    const payment = await paymentService.getAdminPaymentById(paymentId);

    return res.status(200).json({
      success: true,
      payment,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPaymentOrder,
  verifyPayment,
  getPaymentHistory,
  handleWebhook,
  getAdminPayments,
  getAdminPaymentById,
};
