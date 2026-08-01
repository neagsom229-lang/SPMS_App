// frontend/src/components/KHQRPayment.jsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

const QRPayment = ({ amount, orderId, onSuccess, onCancel }) => {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState('pending'); // pending, paid, expired
  const [checking, setChecking] = useState(false);

  // Load QR data
  const loadQR = async () => {
    setLoading(true);
    setStatus('pending');
    try {
      const response = await fetch(
        `/api/payment/khqr?amount=${amount}&orderId=${orderId}`
      );
      const data = await response.json();
      setQrData(data);
      setSessionId(data.sessionId);
      setTimeLeft(data.expiresIn || 300);
      
      // Start timer
      startTimer();
      
      // Start status checking
      startStatusCheck(data.sessionId);
    } catch (error) {
      console.error('Error loading QR:', error);
      toast.error('Failed to load payment information');
    }
    setLoading(false);
  };

  // Timer for expiry
  const startTimer = () => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setStatus('expired');
          toast.error('QR code expired. Please generate a new one.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Check payment status periodically
  const startStatusCheck = (id) => {
    setChecking(true);
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/payment/status/${id}`);
        const data = await response.json();
        
        if (data.success && data.status === 'paid') {
          clearInterval(interval);
          setChecking(false);
          setStatus('paid');
          toast.success('✅ Payment confirmed!');
          setTimeout(() => onSuccess?.(), 1000);
        } else if (data.status === 'expired') {
          clearInterval(interval);
          setChecking(false);
          setStatus('expired');
          toast.error('QR code has expired');
        }
      } catch (error) {
        console.error('Status check error:', error);
      }
    }, 3000); // Check every 3 seconds

    // Stop checking after 5 minutes
    setTimeout(() => {
      clearInterval(interval);
      setChecking(false);
    }, 5 * 60 * 1000);
  };

  // Load QR on mount
  useEffect(() => {
    loadQR();
    return () => {
      // Cleanup
      setStatus('expired');
    };
  }, []);

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Copy account number
  const copyAccount = (account) => {
    navigator.clipboard.writeText(account);
    setCopied(true);
    toast.success('Account number copied!');
    setTimeout(() => setCopied(false), 3000);
  };

  // Manual payment confirmation
  const confirmPayment = async () => {
    if (!sessionId) {
      toast.error('No active payment session');
      return;
    }

    try {
      const response = await fetch('/api/payment/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('✅ Payment confirmed! Processing...');
        setStatus('paid');
        setTimeout(() => onSuccess?.(), 1000);
      } else {
        toast.error(data.message || 'Payment confirmation failed');
        if (data.message?.includes('expired')) {
          setStatus('expired');
        }
      }
    } catch (error) {
      console.error('Confirm payment error:', error);
      toast.error('Failed to confirm payment');
    }
  };

  // Regenerate QR
  const regenerateQR = () => {
    loadQR();
    toast.info('🔄 Generating new QR code...');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Expired state
  if (status === 'expired') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl max-w-md mx-auto text-center">
        <div className="text-6xl mb-4">⏰</div>
        <h3 className="text-xl font-bold text-red-600">QR Code Expired</h3>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          The payment QR code has expired after 5 minutes.
        </p>
        <button
          onClick={regenerateQR}
          className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          🔄 Generate New QR
        </button>
      </div>
    );
  }

  // Paid state
  if (status === 'paid') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl max-w-md mx-auto text-center">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="text-xl font-bold text-green-600">Payment Successful!</h3>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Your order has been confirmed.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl max-w-md mx-auto">
      <h3 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
        Pay with KHQR
      </h3>
      <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
        Amount: <span className="font-bold text-xl text-blue-600">
          ${parseFloat(amount || 0).toFixed(2)}
        </span>
      </p>

      {/* Timer */}
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-full">
          <span className="text-sm text-gray-600 dark:text-gray-400">⏱️ Expires in:</span>
          <span className={`font-mono font-bold ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-gray-900 dark:text-white'}`}>
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      {/* QR Code */}
      {qrData?.khqr && (
        <div className="flex justify-center mb-6">
          <div className="bg-white p-4 rounded-xl border-2 border-blue-200">
            <img
              src={qrData.khqr}
              alt="KHQR Payment Code"
              className="w-48 h-48"
            />
          </div>
        </div>
      )}

      {/* Payment Info */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-6 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Merchant</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {qrData?.merchantName}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Account</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-gray-900 dark:text-white">
              {qrData?.khqrAccount}
            </span>
            <button
              onClick={() => copyAccount(qrData?.khqrAccount)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              📋
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Amount</span>
          <span className="font-bold text-blue-600">
            ${parseFloat(amount || 0).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
        <p>📱 Scan with <strong>ABA Mobile</strong> or <strong>Bakong</strong> app</p>
        <p className="mt-1">💰 Transfer the exact amount shown above</p>
        <p className="mt-1">✅ Click confirm after payment</p>
        {checking && (
          <p className="mt-2 text-blue-600 animate-pulse">
            ⏳ Waiting for confirmation...
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={confirmPayment}
          disabled={status === 'paid'}
          className="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 transition disabled:opacity-50"
        >
          ✅ I Have Paid
        </button>

        <div className="flex gap-3">
          <button
            onClick={regenerateQR}
            className="flex-1 text-blue-600 hover:text-blue-700 py-2 text-sm border border-blue-600 rounded-lg"
          >
            🔄 New QR
          </button>
          <button
            onClick={onCancel}
            className="flex-1 text-gray-500 hover:text-gray-700 py-2 text-sm border rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRPayment;