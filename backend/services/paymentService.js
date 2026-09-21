const crypto = require('crypto');
const { pool } = require('../config/db');
const config = require('../config');
const razorpayProvider = require('./paymentProviders/razorpayProvider');

/**
 * Format plan code safely
 */
function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

/**
 * 1. Create a payment order for subscription upgrade
 */
async function createOrder({ userId, planCode, billingCycle = 'MONTHLY' }) {
  const normalizedPlanCode = normalizeCode(planCode);
  const normalizedCycle = billingCycle.toUpperCase() === 'YEARLY' ? 'YEARLY' : 'MONTHLY';

  if (!normalizedPlanCode) {
    const error = new Error('Plan code is required');
    error.statusCode = 400;
    throw error;
  }

  if (normalizedPlanCode === 'FREE') {
    const error = new Error('Free plan does not require payment. Please use the direct subscription switch.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Fetch authoritative plan details from database
  const [planRows] = await pool.query(
    `SELECT id, name, slug, code, price, monthly_price, yearly_price, duration_days, status 
     FROM subscription_plans 
     WHERE (code = ? OR slug = ?) 
     LIMIT 1`,
    [normalizedPlanCode, normalizedPlanCode]
  );

  if (planRows.length === 0) {
    const error = new Error(`Subscription plan '${normalizedPlanCode}' not found`);
    error.statusCode = 404;
    throw error;
  }

  const plan = planRows[0];

  if (plan.status !== 'ACTIVE') {
    const error = new Error(`Subscription plan '${plan.name}' is currently unavailable`);
    error.statusCode = 400;
    throw error;
  }

  // 2. Authoritative price calculation (strictly from database, never from client)
  let priceInRupees = 0;
  if (normalizedCycle === 'YEARLY') {
    priceInRupees = Number(plan.yearly_price) > 0 
      ? Number(plan.yearly_price) 
      : (Number(plan.monthly_price || plan.price || 0) * 10);
  } else {
    priceInRupees = Number(plan.monthly_price || plan.price || 0);
  }

  if (priceInRupees <= 0) {
    const error = new Error('Invalid plan pricing configuration');
    error.statusCode = 400;
    throw error;
  }

  const amountInPaise = Math.round(priceInRupees * 100);

  // 3. Check current user subscription
  const [currentSubRows] = await pool.query(
    `SELECT us.id, us.plan_id, us.status, sp.code AS current_code, sp.name AS current_name
     FROM user_subscriptions us
     JOIN subscription_plans sp ON us.plan_id = sp.id
     WHERE us.user_id = ? AND us.status = 'ACTIVE'
     ORDER BY us.id DESC LIMIT 1`,
    [userId]
  );

  const currentSub = currentSubRows[0];
  if (currentSub && currentSub.plan_id === plan.id) {
    const error = new Error(`You are already actively subscribed to the ${plan.name} plan`);
    error.statusCode = 400;
    throw error;
  }

  // 4. Generate internal receipt reference
  const receipt = `RCPT_${Date.now()}_${userId}`.slice(0, 40);

  // 5. Create internal payment record in CREATED state
  const [insertResult] = await pool.query(
    `INSERT INTO payments 
       (user_id, plan_id, amount, currency, payment_gateway, provider, receipt, billing_cycle, status, created_at)
     VALUES (?, ?, ?, 'INR', 'RAZORPAY', 'RAZORPAY', ?, ?, 'CREATED', NOW())`,
    [userId, plan.id, priceInRupees, receipt, normalizedCycle]
  );

  const paymentId = insertResult.insertId;

  // 6. Invoke Razorpay Order API via provider
  try {
    const razorpayOrder = await razorpayProvider.createOrder({
      amountInPaise,
      currency: 'INR',
      receipt,
      notes: {
        userId: String(userId),
        planCode: plan.code,
        paymentId: String(paymentId),
      },
    });

    // 7. Update internal payment record with provider order ID
    await pool.query(
      `UPDATE payments 
       SET provider_order_id = ?, gateway_order_id = ?, updated_at = NOW() 
       WHERE id = ?`,
      [razorpayOrder.id, razorpayOrder.id, paymentId]
    );

    const publicRazorpayKey = process.env.RAZORPAY_KEY_ID || config.razorpay?.keyId || 'rzp_test_placeholder';
    const isPlaceholder = !publicRazorpayKey || publicRazorpayKey.includes('placeholder');
    const isSimulated = !razorpayOrder.isLiveOrder || isPlaceholder;

    let simulatedPayment = null;
    if (isSimulated) {
      const secret = process.env.RAZORPAY_KEY_SECRET || config.razorpay?.keySecret || 'testSecret_sampleSecretKey456';
      const simPaymentId = `pay_sim_${paymentId}_${Date.now()}`;
      const simSignature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpayOrder.id}|${simPaymentId}`)
        .digest('hex');

      simulatedPayment = {
        paymentId: simPaymentId,
        signature: simSignature,
      };
    }

    return {
      orderId: razorpayOrder.id,
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: publicRazorpayKey,
      description: `${plan.name} Subscription (${normalizedCycle})`,
      isSimulated,
      simulatedPayment,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        isLiveOrder: Boolean(razorpayOrder.isLiveOrder),
      },
      payment: {
        id: paymentId,
        receipt,
        status: 'CREATED',
        amount: priceInRupees,
        billingCycle: normalizedCycle,
        plan: {
          id: plan.id,
          code: plan.code,
          name: plan.name,
        },
      },
      razorpay: {
        keyId: publicRazorpayKey,
      },
    };
  } catch (err) {
    // Mark payment as failed if order creation failed
    await pool.query(
      `UPDATE payments SET status = 'FAILED', failure_reason = ?, updated_at = NOW() WHERE id = ?`,
      [String(err.message || 'Razorpay order creation failed').slice(0, 250), paymentId]
    );
    throw err;
  }
}

/**
 * 2. Cryptographically verify payment and activate subscription in a MySQL transaction
 */
async function verifyPayment({ userId, orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) {
    const error = new Error('Missing required payment verification parameters (orderId, paymentId, signature)');
    error.statusCode = 400;
    throw error;
  }

  // 1. Cryptographic HMAC SHA256 signature verification
  const isValidSignature = razorpayProvider.verifyPaymentSignature({
    orderId,
    order_id: orderId,
    paymentId,
    payment_id: paymentId,
    signature,
  });

  if (!isValidSignature) {
    // Record verification failure for audit
    await pool.query(
      `UPDATE payments 
       SET status = 'VERIFICATION_FAILED', 
           failure_reason = 'Cryptographic signature mismatch',
           provider_payment_id = ?,
           provider_signature = ?,
           updated_at = NOW() 
       WHERE (provider_order_id = ? OR gateway_order_id = ?) AND user_id = ?`,
      [paymentId, signature, orderId, orderId, userId]
    ).catch(() => {});

    const error = new Error('Payment could not be verified. Your subscription was not activated.');
    error.statusCode = 400;
    throw error;
  }

  // 2. Run atomic MySQL transaction to activate subscription
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    // 3. Find and lock the payment record
    const [paymentRows] = await connection.query(
      `SELECT p.*, sp.code AS plan_code, sp.name AS plan_name, sp.duration_days
       FROM payments p
       JOIN subscription_plans sp ON p.plan_id = sp.id
       WHERE (p.provider_order_id = ? OR p.gateway_order_id = ?) AND p.user_id = ?
       FOR UPDATE`,
      [orderId, orderId, userId]
    );

    if (paymentRows.length === 0) {
      await connection.rollback();
      const error = new Error('Payment record not found or does not belong to the authenticated user');
      error.statusCode = 404;
      throw error;
    }

    const payment = paymentRows[0];

    // 4. Idempotency guard: If already PAID, return clean idempotent response
    if (payment.status === 'PAID') {
      await connection.commit();
      return {
        success: true,
        alreadyProcessed: true,
        message: 'Payment has already been verified and processed.',
        payment: {
          id: payment.id,
          status: 'PAID',
          amount: Number(payment.amount),
          currency: payment.currency,
          providerOrderId: payment.provider_order_id,
          providerPaymentId: payment.provider_payment_id,
        },
      };
    }

    // 5. Prevent duplicate provider_payment_id across different payments
    const [dupRows] = await connection.query(
      `SELECT id FROM payments WHERE provider_payment_id = ? AND id != ?`,
      [paymentId, payment.id]
    );
    if (dupRows.length > 0) {
      await connection.rollback();
      const error = new Error('Duplicate payment transaction ID detected.');
      error.statusCode = 409;
      throw error;
    }

    // 6. Mark payment as PAID
    await connection.query(
      `UPDATE payments 
       SET status = 'PAID',
           provider_payment_id = ?,
           gateway_payment_id = ?,
           provider_signature = ?,
           paid_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [paymentId, paymentId, signature, payment.id]
    );

    // 7. Deactivate any currently active subscriptions for this user
    const [oldSubRows] = await connection.query(
      `SELECT id, plan_id FROM user_subscriptions WHERE user_id = ? AND status = 'ACTIVE'`,
      [userId]
    );
    const oldPlanId = oldSubRows[0]?.plan_id || null;

    await connection.query(
      `UPDATE user_subscriptions 
       SET status = 'CANCELLED', updated_at = NOW() 
       WHERE user_id = ? AND status = 'ACTIVE'`,
      [userId]
    );

    // 8. Calculate expiration date based on billing cycle
    const durationDays = payment.billing_cycle === 'YEARLY' ? 365 : 30;

    // 9. Insert new ACTIVE subscription
    const [subResult] = await connection.query(
      `INSERT INTO user_subscriptions 
         (user_id, plan_id, status, start_date, end_date, auto_renew, billing_cycle, payment_provider, payment_reference)
       VALUES (?, ?, 'ACTIVE', NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), 1, ?, 'RAZORPAY', ?)`,
      [userId, payment.plan_id, durationDays, payment.billing_cycle || 'MONTHLY', paymentId]
    );
    const newSubId = subResult.insertId;

    // 10. Link subscription_id in payments table
    await connection.query(
      `UPDATE payments SET subscription_id = ? WHERE id = ?`,
      [newSubId, payment.id]
    );

    // 11. Record in subscription_history
    await connection.query(
      `INSERT INTO subscription_history 
         (user_id, previous_plan_id, new_plan_id, action, reason, created_at)
       VALUES (?, ?, ?, 'UPGRADED', ?, NOW())`,
      [
        userId,
        oldPlanId,
        payment.plan_id,
        `Upgraded to ${payment.plan_name} via Razorpay Test Payment (${payment.billing_cycle})`,
      ]
    );

    await connection.commit();

    console.log(`[Razorpay] Subscription activated`);

    // Dispatch SUBSCRIPTION_STARTED or SUBSCRIPTION_CHANGED notification
    try {
      const notificationService = require('./notificationService');
      notificationService.createNotification({
        userId,
        actorUserId: null,
        type: oldPlanId
          ? notificationService.NOTIFICATION_TYPES.SUBSCRIPTION_CHANGED
          : notificationService.NOTIFICATION_TYPES.SUBSCRIPTION_STARTED,
        title: oldPlanId ? 'Subscription Updated' : 'Subscription Activated',
        message: `Welcome to StreamWave ${payment.plan_name}! Your subscription is now active.`,
        entityType: 'subscription',
        entityId: newSubId,
        dataJson: {
          subscription_id: newSubId,
          plan_name: payment.plan_name,
          billing_cycle: payment.billing_cycle,
          amount: Number(payment.amount),
          currency: payment.currency,
        },
      }).catch((e) => console.error('[Notification] Failed to send payment notification:', e.message));
    } catch (notifErr) {
      console.error('[Notification] Error dispatching payment notification:', notifErr.message);
    }

    return {
      success: true,
      alreadyProcessed: false,
      message: 'Payment successful! Your subscription is now active.',
      payment: {
        id: payment.id,
        status: 'PAID',
        amount: Number(payment.amount),
        currency: payment.currency,
        receipt: payment.receipt,
        billingCycle: payment.billing_cycle,
        providerOrderId: orderId,
        providerPaymentId: paymentId,
      },
      subscription: {
        id: newSubId,
        status: 'ACTIVE',
        plan: {
          id: payment.plan_id,
          code: payment.plan_code,
          name: payment.plan_name,
        },
      },
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * 3. Retrieve authenticated user's payment history
 */
async function getUserPayments({ userId, page = 1, limit = 10 }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const offset = (pageNum - 1) * limitNum;

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM payments WHERE user_id = ?`,
    [userId]
  );
  const total = Number(countRows[0]?.total || 0);

  const [rows] = await pool.query(
    `SELECT 
       p.id,
       p.amount,
       p.currency,
       p.status,
       p.payment_method AS paymentMethod,
       p.receipt,
       p.billing_cycle AS billingCycle,
       p.provider,
       p.provider_order_id AS providerOrderId,
       p.provider_payment_id AS providerPaymentId,
       p.paid_at AS paidAt,
       p.created_at AS createdAt,
       sp.code AS planCode,
       sp.name AS planName
     FROM payments p
     JOIN subscription_plans sp ON p.plan_id = sp.id
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT ? OFFSET ?`,
    [userId, limitNum, offset]
  );

  const payments = rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    currency: r.currency,
    status: r.status,
    paymentMethod: r.paymentMethod || 'RAZORPAY',
    receipt: r.receipt,
    billingCycle: r.billingCycle,
    provider: r.provider,
    providerOrderId: r.providerOrderId,
    providerPaymentId: r.providerPaymentId,
    paidAt: r.paidAt,
    createdAt: r.createdAt,
    plan: {
      code: r.planCode,
      name: r.planName,
    },
  }));

  return {
    payments,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
}

/**
 * 4. Retrieve admin payment ledger
 */
async function getAdminPayments({ page = 1, limit = 20, status, plan, search, sort = 'newest' }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const values = [];

  if (status && status !== 'ALL') {
    conditions.push('p.status = ?');
    values.push(status.toUpperCase());
  }

  if (plan && plan !== 'ALL') {
    conditions.push('sp.code = ?');
    values.push(plan.toUpperCase());
  }

  if (search && search.trim()) {
    conditions.push('(u.username LIKE ? OR u.email LIKE ? OR p.provider_order_id LIKE ? OR p.provider_payment_id LIKE ? OR p.receipt LIKE ?)');
    const term = `%${search.trim()}%`;
    values.push(term, term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sortClause = sort === 'oldest' ? 'ORDER BY p.id ASC' : 'ORDER BY p.id DESC';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total 
     FROM payments p 
     JOIN users u ON p.user_id = u.id 
     JOIN subscription_plans sp ON p.plan_id = sp.id 
     ${whereClause}`,
    values
  );
  const total = Number(countRows[0]?.total || 0);

  const [rows] = await pool.query(
    `SELECT 
       p.id,
       p.amount,
       p.currency,
       p.status,
       p.payment_method AS paymentMethod,
       p.receipt,
       p.billing_cycle AS billingCycle,
       p.provider,
       p.provider_order_id AS providerOrderId,
       p.provider_payment_id AS providerPaymentId,
       p.failure_reason AS failureReason,
       p.paid_at AS paidAt,
       p.created_at AS createdAt,
       u.id AS userId,
       u.username,
       u.email,
       sp.code AS planCode,
       sp.name AS planName
     FROM payments p
     JOIN users u ON p.user_id = u.id
     JOIN subscription_plans sp ON p.plan_id = sp.id
     ${whereClause}
     ${sortClause}
     LIMIT ? OFFSET ?`,
    [...values, limitNum, offset]
  );

  const payments = rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    currency: r.currency,
    status: r.status,
    paymentMethod: r.paymentMethod,
    receipt: r.receipt,
    billingCycle: r.billingCycle,
    provider: r.provider,
    providerOrderId: r.providerOrderId,
    providerPaymentId: r.providerPaymentId,
    failureReason: r.failureReason,
    paidAt: r.paidAt,
    createdAt: r.createdAt,
    user: {
      id: r.userId,
      username: r.username,
      email: r.email,
    },
    plan: {
      code: r.planCode,
      name: r.planName,
    },
  }));

  // Overview stats for header
  const [statsRows] = await pool.query(`
    SELECT 
      COUNT(*) as totalTransactions,
      SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paidCount,
      SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END) as totalVolume,
      SUM(CASE WHEN status IN ('FAILED', 'VERIFICATION_FAILED') THEN 1 ELSE 0 END) as failedCount
    FROM payments
  `);

  return {
    payments,
    stats: {
      totalTransactions: Number(statsRows[0]?.totalTransactions || 0),
      paidCount: Number(statsRows[0]?.paidCount || 0),
      totalVolume: Number(statsRows[0]?.totalVolume || 0),
      failedCount: Number(statsRows[0]?.failedCount || 0),
    },
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
}

/**
 * 5. Retrieve payment detail by ID for admin
 */
async function getAdminPaymentById(paymentId) {
  const [rows] = await pool.query(
    `SELECT 
       p.*,
       u.username,
       u.email,
       sp.code AS plan_code,
       sp.name AS plan_name,
       us.status AS sub_status,
       us.start_date AS sub_start_date,
       us.end_date AS sub_end_date
     FROM payments p
     JOIN users u ON p.user_id = u.id
     JOIN subscription_plans sp ON p.plan_id = sp.id
     LEFT JOIN user_subscriptions us ON p.subscription_id = us.id
     WHERE p.id = ?`,
    [paymentId]
  );

  if (rows.length === 0) {
    const error = new Error('Payment record not found');
    error.statusCode = 404;
    throw error;
  }

  const p = rows[0];
  return {
    id: p.id,
    amount: Number(p.amount),
    currency: p.currency,
    status: p.status,
    paymentGateway: p.payment_gateway,
    provider: p.provider,
    providerOrderId: p.provider_order_id,
    providerPaymentId: p.provider_payment_id,
    receipt: p.receipt,
    billingCycle: p.billing_cycle,
    failureReason: p.failure_reason,
    metadata: p.metadata,
    paidAt: p.paid_at,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    user: {
      id: p.user_id,
      username: p.username,
      email: p.email,
    },
    plan: {
      id: p.plan_id,
      code: p.plan_code,
      name: p.plan_name,
    },
    subscription: p.subscription_id ? {
      id: p.subscription_id,
      status: p.sub_status,
      startDate: p.sub_start_date,
      endDate: p.sub_end_date,
    } : null,
  };
}

/**
 * 6. Idempotently process Razorpay webhook events
 */
async function handleWebhookEvent({ rawBody, signature, eventData }) {
  // 1. Verify webhook signature
  const isValid = razorpayProvider.verifyWebhookSignature({
    rawBody,
    signature,
  });

  if (!isValid) {
    const error = new Error('Invalid webhook signature');
    error.statusCode = 400;
    throw error;
  }

  const event = eventData?.event;
  const payload = eventData?.payload;

  console.log(`[Webhook] Received Razorpay event: ${event}`);

  if (event === 'payment.captured' || event === 'order.paid') {
    const paymentObj = payload?.payment?.entity;
    const orderId = paymentObj?.order_id || payload?.order?.entity?.id;
    const paymentId = paymentObj?.id;

    if (!orderId) {
      return { processed: false, reason: 'Missing order_id in webhook payload' };
    }

    // Check payment record
    const [rows] = await pool.query(
      `SELECT * FROM payments WHERE provider_order_id = ? OR gateway_order_id = ?`,
      [orderId, orderId]
    );

    if (rows.length === 0) {
      return { processed: false, reason: 'Payment not found in local database' };
    }

    const localPayment = rows[0];

    // Idempotent: If already PAID, ignore
    if (localPayment.status === 'PAID') {
      return { processed: true, idempotent: true, message: 'Already marked as PAID' };
    }

    // Activate subscription via transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      await connection.query(
        `UPDATE payments 
         SET status = 'PAID', 
             provider_payment_id = COALESCE(?, provider_payment_id),
             paid_at = NOW(),
             updated_at = NOW() 
         WHERE id = ?`,
        [paymentId || null, localPayment.id]
      );

      // Deactivate existing active
      await connection.query(
        `UPDATE user_subscriptions SET status = 'CANCELLED', updated_at = NOW() WHERE user_id = ? AND status = 'ACTIVE'`,
        [localPayment.user_id]
      );

      const durationDays = localPayment.billing_cycle === 'YEARLY' ? 365 : 30;

      const [subResult] = await connection.query(
        `INSERT INTO user_subscriptions 
           (user_id, plan_id, status, start_date, end_date, auto_renew, billing_cycle, payment_provider, payment_reference)
         VALUES (?, ?, 'ACTIVE', NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), 1, ?, 'RAZORPAY_WEBHOOK', ?)`,
        [localPayment.user_id, localPayment.plan_id, durationDays, localPayment.billing_cycle || 'MONTHLY', paymentId || `WH_${orderId}`]
      );

      await connection.query(
        `UPDATE payments SET subscription_id = ? WHERE id = ?`,
        [subResult.insertId, localPayment.id]
      );

      await connection.query(
        `INSERT INTO subscription_history 
           (user_id, previous_plan_id, new_plan_id, action, reason, created_at)
         VALUES (?, NULL, ?, 'UPGRADED', 'Subscription activated via Razorpay webhook', NOW())`,
        [localPayment.user_id, localPayment.plan_id]
      );

      await connection.commit();
      return { processed: true, message: 'Subscription successfully activated via webhook' };
    } catch (txErr) {
      await connection.rollback();
      throw txErr;
    } finally {
      connection.release();
    }
  } else if (event === 'payment.failed') {
    const paymentObj = payload?.payment?.entity;
    const orderId = paymentObj?.order_id;
    const reason = paymentObj?.error_description || 'Payment failed at gateway';

    if (orderId) {
      await pool.query(
        `UPDATE payments 
         SET status = 'FAILED', failure_reason = ?, updated_at = NOW() 
         WHERE (provider_order_id = ? OR gateway_order_id = ?) AND status != 'PAID'`,
        [String(reason).slice(0, 250), orderId, orderId]
      );
    }
    return { processed: true, message: 'Payment marked as failed' };
  }

  return { processed: true, message: `Ignored unhandled event: ${event}` };
}

module.exports = {
  createOrder,
  verifyPayment,
  getUserPayments,
  getAdminPayments,
  getAdminPaymentById,
  handleWebhookEvent,
};
