const razorpay = require('../../config/razorpay');
const razorpayService = require('../razorpayService');

function getRazorpayClient() {
  return razorpay;
}

async function createOrder(params) {
  return razorpayService.createOrder(params);
}

function verifyPaymentSignature(params) {
  return razorpayService.verifyPaymentSignature(params);
}

function verifyWebhookSignature(params) {
  return razorpayService.verifyWebhookSignature(params);
}

module.exports = {
  getRazorpayClient,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
};
