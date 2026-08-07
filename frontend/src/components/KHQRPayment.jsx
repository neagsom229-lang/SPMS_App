import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import apiClient from '../api/client';

const QRPayment = ({ amount, orderId, userId, plan, onSuccess, onCancel }) => {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState('pending');
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const timerIntervalRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const pollStopTimeoutRef = useRef(null);
  const isMounted = useRef(true);

  const clearAllTimers = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (pollStopTimeoutRef.current) clearTimeout(pollStopTimeoutRef.current);
    timerIntervalRef.current = null;
    pollIntervalRef.current = null;
    pollStopTimeoutRef.current = null;
  };

  const startTimer = () => {
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          if (isMounted.current) {
            setStatus('expired');
            toast.error('QR code expired. Please generate a new one.');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startStatusCheck = (id) => {
    setChecking(true);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const { data } = await apiClient.get(`/payment/status/${id}`);

        if (!isMounted.current) return;

        if (data.success && data.status === 'paid') {
          clearInterval(pollIntervalRef.current);
          setChecking(false);
          setStatus('paid');
          toast.success('✅ Payment confirmed!');
          setTimeout(() => onSuccess?.(), 1000);
        } else if (data.status === 'expired') {
          clearInterval(pollIntervalRef.current);
          setChecking(false);
          setStatus('expired');
          toast.error('QR code has expired');
        } else if (data.status === 'awaiting_verification') {
          setStatus('awaiting_verification');
        }
      } catch (error) {
        console.error('Status check error:', error);
      }
    }, 3000);

    pollStopTimeoutRef.current = setTimeout(() => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (isMounted.current) setChecking(false);
    }, 5 * 60 * 1000);
  };

  const loadQR = useCallback(async () => {
    clearAllTimers();
    setLoading(true);
    setStatus('pending');
    try {
      const { data } = await apiClient.get('/payment/khqr', {
        params: { amount, orderId, userId, plan },
      });

      if (!isMounted.current) return;

      setQrData(data);
      setSessionId(data.sessionId);
      setTimeLeft(data.expiresIn || 300);

      startTimer();
      startStatusCheck(data.sessionId);
    } catch (error) {
      console.error('Error loading QR:', error);
      toast.error(error.response?.data?.error || 'Failed to load payment information');
    }
    if (isMounted.current) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, orderId, userId, plan]);

  useEffect(() => {
    isMounted.current = true;
    loadQR();
    return () => {
      isMounted.current = false;
      clearAllTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const copyAccount = (account) => {
    navigator.clipboard.writeText(account);
    setCopied(true);
    toast.success('Account number copied!');
    setTimeout(() => setCopied(false), 3000);
  };

  const confirmPayment = async () => {
    if (!sessionId) {
      toast.error('No active payment session');
      return;
    }

    setConfirming(true);
    try {
      const { data } = await apiClient.post('/payment/confirm', { sessionId });

      if (data.success) {
        setStatus('awaiting_verification');
        toast.success(data.message || 'Payment noted — verifying now.');
      } else {
        toast.error(data.message || 'Payment confirmation failed');
      }
    } catch (error) {
      console.error('Confirm payment error:', error);
      const message = error.response?.data?.message;
      toast.error(message || 'Failed to confirm payment');
      if (message?.includes('expired')) {
        setStatus('expired');
      }
    } finally {
      setConfirming(false);
    }
  };

  const regenerateQR = () => {
    loadQR();
    toast('🔄 Generating new QR code...');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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

  if (status === 'awaiting_verification') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl max-w-md mx-auto text-center">
        <div className="text-6xl mb-4">⏳</div>
        <h3 className="text-xl font-bold text-blue-600">Verifying Your Payment</h3>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          We're checking your payment against our account. This page will update
          automatically — no need to refresh.
        </p>
        <button
          onClick={onCancel}
          className="mt-4 text-gray-500 hover:text-gray-700 text-sm border rounded-lg px-4 py-2"
        >
          Close
        </button>
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

      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-full">
          <span className="text-sm text-gray-600 dark:text-gray-400">⏱️ Expires in:</span>
          <span className={`font-mono font-bold ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-gray-900 dark:text-white'}`}>
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

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

      <div className="space-y-3">
        <button
          onClick={confirmPayment}
          disabled={confirming}
          className="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 transition disabled:opacity-50"
        >
          {confirming ? 'Submitting...' : '✅ I Have Paid'}
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