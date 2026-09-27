import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';
import { CartContext } from '../context/CartContext';
import '../styles/Checkout.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const CheckoutForm = ({ cartTotal, cartItems }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { clearCart } = useContext(CartContext);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    if (!email) {
      setError('이메일을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 백엔드에서 결제 의도 생성
      const checkoutResponse = await axios.post('http://localhost:3001/api/checkout', {
        cartId: 'temp-cart-id',
        email,
        amount: cartTotal,
        items: cartItems,
      });

      const { clientSecret } = checkoutResponse.data;

      // 카드 정보 확인
      const cardElement = elements.getElement(CardElement);
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: { email },
        },
      });

      if (stripeError) {
        setError(stripeError.message);
      } else if (paymentIntent.status === 'succeeded') {
        setSuccess(true);
        clearCart();
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || '결제 처리 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="checkout-form">
      <div className="form-group">
        <label htmlFor="email">이메일:</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="card">카드 정보:</label>
        <CardElement
          id="card"
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
        />
      </div>

      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">✓ 결제가 완료되었습니다! 곧 홈으로 이동합니다.</p>}

      <button type="submit" disabled={!stripe || loading} className="pay-button">
        {loading ? '처리 중...' : `₩${cartTotal.toLocaleString()} 결제하기`}
      </button>
    </form>
  );
};

const Checkout = () => {
  const navigate = useNavigate();
  const { cart, getCartTotal } = useContext(CartContext);
  const cartTotal = getCartTotal();

  if (cart.length === 0) {
    return (
      <div className="checkout-container">
        <h1>결제</h1>
        <p>장바구니가 비어있습니다.</p>
        <button onClick={() => navigate('/')}>상품 목록으로</button>
      </div>
    );
  }

  return (
    <div className="checkout-container">
      <h1>결제</h1>
      <div className="checkout-content">
        <div className="order-summary">
          <h2>주문 요약</h2>
          <div className="order-items">
            {cart.map((item) => (
              <div key={item.productId} className="order-item">
                <span>{item.name}</span>
                <span>수량: {item.quantity}</span>
                <span>₩{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="order-total">
            <strong>총액: ₩{cartTotal.toLocaleString()}</strong>
          </div>
        </div>

        <div className="payment-form-wrapper">
          <Elements stripe={stripePromise}>
            <CheckoutForm cartTotal={cartTotal} cartItems={cart} />
          </Elements>
        </div>
      </div>
    </div>
  );
};

export default Checkout;