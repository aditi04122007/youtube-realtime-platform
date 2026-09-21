import api from './api';

/**
 * 1. Create a Razorpay payment order
 * @param {Object} data
 * @param {string} data.planCode - Target plan tier ('BRONZE', 'SILVER', 'GOLD')
 * @param {string} [data.billingCycle='MONTHLY'] - 'MONTHLY' or 'YEARLY'
 */
export const createPaymentOrder = async ({ planCode, billingCycle = 'MONTHLY' }) => {
  const response = await api.post('/payments/create-order', {
    planCode,
    billingCycle,
  });
  return response.data;
};

/**
 * 2. Cryptographically verify payment and activate subscription
 * @param {Object} data
 * @param {string} data.razorpay_order_id
 * @param {string} data.razorpay_payment_id
 * @param {string} data.razorpay_signature
 */
export const verifyPayment = async ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) => {
  const response = await api.post('/payments/verify', {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });
  return response.data;
};

/**
 * 3. Fetch authenticated user's payment history
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=10]
 */
export const getPaymentHistory = async (params = {}) => {
  const response = await api.get('/payments/history', { params });
  return response.data;
};

/**
 * 4. Admin: Fetch paginated payment ledger
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.status]
 * @param {string} [params.plan]
 * @param {string} [params.search]
 * @param {string} [params.sort='newest']
 */
export const getAdminPayments = async (params = {}) => {
  const response = await api.get('/admin/payments', { params });
  return response.data;
};

/**
 * 5. Admin: Fetch single payment detail by ID
 * @param {number|string} paymentId
 */
export const getAdminPaymentById = async (paymentId) => {
  const response = await api.get(`/admin/payments/${paymentId}`);
  return response.data;
};
