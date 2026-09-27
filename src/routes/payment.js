const express = require('express');
const router = express.Router();
const axios = require('axios');
const Order = require('../models/Order');
const auth = require('../middleware/auth');

const IAMPORT_KEY = process.env.IAMPORT_KEY;
const IAMPORT_SECRET = process.env.IAMPORT_SECRET;

if (!IAMPORT_KEY || !IAMPORT_SECRET) {
  console.warn('Warning: IAMPORT_KEY or IAMPORT_SECRET not set');
}

// 아임포트 토큰 발급
const getIamportToken = async () => {
  try {
    const response = await axios.post('https://api.iamport.kr/users/getToken', {
      imp_key: IAMPORT_KEY,
      imp_secret: IAMPORT_SECRET
    });
    return response.data.response.access_token;
  } catch (error) {
    throw new Error('Failed to get Iamport token: ' + error.message);
  }
};

// 결제 검증
router.post('/verify', auth, async (req, res) => {
  try {
    const { impUid, orderId } = req.body;
    const userId = req.userId;

    if (!impUid || !orderId) {
      return res.status(400).json({ success: false, error: 'Missing impUid or orderId' });
    }

    // 주문 확인
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order.userId.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // 아임포트 토큰 발급
    const token = await getIamportToken();

    // 결제 정보 조회
    const paymentResponse = await axios.get(
      `https://api.iamport.kr/payments/${impUid}`,
      {
        headers: {
          Authorization: token
        }
      }
    );

    const paymentData = paymentResponse.data.response;

    // 결제 금액 검증
    if (paymentData.amount !== order.totalPrice) {
      return res.status(400).json({
        success: false,
        error: 'Payment amount mismatch',
        expected: order.totalPrice,
        actual: paymentData.amount
      });
    }

    // 결제 상태 확인
    if (paymentData.status !== 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Payment not completed',
        status: paymentData.status
      });
    }

    // 주문 상태 업데이트
    order.status = 'completed';
    order.paymentId = impUid;
    await order.save();

    res.json({
      success: true,
      orderId: order._id,
      amount: paymentData.amount,
      status: 'completed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 결제 취소
router.post('/cancel', auth, async (req, res) => {
  try {
    const { impUid, orderId, reason } = req.body;
    const userId = req.userId;

    if (!impUid || !orderId) {
      return res.status(400).json({ success: false, error: 'Missing impUid or orderId' });
    }

    // 주문 확인
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order.userId.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // 아임포트 토큰 발급
    const token = await getIamportToken();

    // 결제 취소
    const cancelResponse = await axios.post(
      'https://api.iamport.kr/payments/cancel',
      {
        imp_uid: impUid,
        reason: reason || 'Customer request'
      },
      {
        headers: {
          Authorization: token
        }
      }
    );

    if (cancelResponse.data.code !== 0) {
      return res.status(400).json({
        success: false,
        error: cancelResponse.data.message
      });
    }

    // 주문 상태 업데이트
    order.status = 'cancelled';
    await order.save();

    res.json({
      success: true,
      orderId: order._id,
      status: 'cancelled'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;