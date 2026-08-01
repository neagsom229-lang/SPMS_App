// frontend/src/pages/Checkout.jsx
import { useState } from 'react';
import KHQRPayment from '../components/QRPayment';

const Checkout = () => {
  const [paymentMethod, setPaymentMethod] = useState(null);

  return (
    <div>
      <h2>Choose Payment Method</h2>

      {/* Option 1: KHQR */}
      <div>
        <h3>🇰🇭 Pay with KHQR (ABA/Bakong)</h3>
        <button onClick={() => setPaymentMethod('khqr')}>
          Show QR Code
        </button>
        {paymentMethod === 'khqr' && (
          <KHQRPayment
            amount={19.00}
            orderId="ORDER-123"
            onSuccess={() => alert('Payment confirmed!')}
          />
        )}
      </div>

      {/* Option 2: Stripe */}
      <div>
        <h3>💳 Pay with Card (Stripe)</h3>
        <a
          href="https://buy.stripe.com/test_8x25kw6Bv5SLd3u5tZ0co00"
          target="_blank"
          rel="noopener noreferrer"
        >
          Pay with Credit Card
        </a>
      </div>
    </div>
  );
};

export default Checkout;