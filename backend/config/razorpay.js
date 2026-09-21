const Razorpay = require('razorpay');
const config = require('./index');

const keyId = process.env.RAZORPAY_KEY_ID || config.razorpay?.keyId || '';
const keySecret = process.env.RAZORPAY_KEY_SECRET || config.razorpay?.keySecret || '';

if (!keyId || !keySecret || keyId === 'rzp_test_placeholderKey123') {
  console.warn('[Razorpay] Warning: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured in environment variables.');
}

let razorpayInstance = null;

if (keyId && keySecret) {
  try {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  } catch (err) {
    console.warn('[Razorpay] SDK initialization notice:', err.message);
  }
}

module.exports = razorpayInstance;
