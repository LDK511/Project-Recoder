import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Checkout({ cart }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    address: '',
    cardNumber: '',
    expiryDate: '',
    cvv: ''
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const orderData = {
        user_id: 1,
        items: cart,
        total_price: total,
        payment_method: 'credit_card'
      };

      const orderResponse = await axios.post(`${API_URL}/api/orders`, orderData);
      const orderId = orderResponse.data.id;

      const paymentData = {
        order_id: orderId,
        card_number: formData.cardNumber,
        amount: total
      };

      await axios.post(`${API_URL}/api/payment`, paymentData);

      setMessage(`✅ Order placed successfully! Order ID: ${orderId}`);
      setTimeout(() => navigate('/'), 3000);
    } catch (error) {
      setMessage(`❌ Payment failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="container">
        <p>Your cart is empty. Please add items before checkout.</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h2>Checkout</h2>
      <div className="checkout-form">
        <h3>Order Summary</h3>
        <p>Total: <strong>${total.toFixed(2)}</strong></p>
        <hr />
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Address</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Card Number</label>
            <input
              type="text"
              name="cardNumber"
              value={formData.cardNumber}
              onChange={handleChange}
              placeholder="1234567890123456"
              required
            />
          </div>
          <div className="form-group">
            <label>Expiry Date</label>
            <input
              type="text"
              name="expiryDate"
              value={formData.expiryDate}
              onChange={handleChange}
              placeholder="MM/YY"
              required
            />
          </div>
          <div className="form-group">
            <label>CVV</label>
            <input
              type="text"
              name="cvv"
              value={formData.cvv}
              onChange={handleChange}
              placeholder="123"
              required
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Processing...' : 'Complete Payment'}
          </button>
        </form>
        {message && (
          <div className={message.includes('✅') ? 'success-message' : 'error-message'}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default Checkout;
