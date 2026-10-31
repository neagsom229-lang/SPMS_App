import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import apiClient from '../api/client';
import { CheckCircle, Shield, AlertTriangle, RefreshCw, Clock } from 'lucide-react';

const BakongPayment = ({ amount, planId, userId, onSuccess }) => {
  const [qrPayload, setQrPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('pending');

  // Timer state (15 minutes)
  const [timeLeft, setTimeLeft] = useState(900);
  const [checking, setChecking] = useState(false);

  const isMounted = useRef(true);
  const timerIntervalRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const [md5, setMd5] = useState(null);

  // 1. Generate Dynamic QR via Backend
  const fetchDynamicQR = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTimeLeft(900); // Reset timer to 15 minutes

    if (!userId) {
      setError("Please log in to generate a payment QR.");
      setLoading(false);
      return;
    }

    try {
      const { data } = await apiClient.post('/payment/bakong/create-qr', {
        amount: Number(amount),
        planId: planId,
        userId: userId
      });

      if (data?.success && data?.qr && data?.md5) {
        setQrPayload(data.qr);
        setMd5(data.md5);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Error fetching QR:', err);
      setError(err.response?.data?.error || 'Failed to generate KHQR code');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [amount, planId, userId]);

  // 2. Poll for Payment Status every 4 seconds
  const startPolling = useCallback(() => {
    if (!md5) return;
    pollIntervalRef.current = setInterval(async () => {
      try {
        setChecking(true);
        const { data } = await apiClient.get(`/payment/bakong/check/${md5}`);

        if (data.status === 'PAID') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          setStatus('paid');
          toast.success('🎉 Payment successful! Plan activated.');
          setTimeout(() => onSuccess?.(), 1500);
        }
      } catch (err) {
        console.warn('Polling error:', err.response?.data?.error || err.message);
      } finally {
        setChecking(false);
      }
    }, 4000);
  }, [md5, onSuccess]);

  // 3. Initialize on mount
  useEffect(() => {
    isMounted.current = true;
    fetchDynamicQR();

    return () => {
      isMounted.current = false;
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchDynamicQR]);

  // 4. Countdown Timer & Polling trigger
  useEffect(() => {
    if (qrPayload && status === 'pending') {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setStatus('expired');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      startPolling();
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [qrPayload, status, startPolling]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md mx-auto text-center shadow-2xl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
        <p className="text-slate-400 text-sm">Generating secure Bakong Dynamic KHQR...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md mx-auto text-center shadow-2xl">
        <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/30">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-white mb-2">Payment Error</h3>
        <p className="text-slate-400 text-sm mb-6">{error}</p>
        <button
          onClick={fetchDynamicQR}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md mx-auto text-center shadow-2xl">
        <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
          <Clock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-white mb-2">QR Code Expired</h3>
        <p className="text-slate-400 text-sm mb-6">
          This payment session has expired after 15 minutes.
        </p>
        <button
          onClick={fetchDynamicQR}
          className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Generate New QR
        </button>
      </div>
    );
  }

  if (status === 'paid') {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md mx-auto text-center shadow-2xl">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
          <CheckCircle className="w-8 h-8 animate-bounce" />
        </div>
        <h3 className="text-xl font-black text-white mb-2">Payment Successful!</h3>
        <p className="text-slate-400 text-sm">
          Plan activated successfully. Redirecting to your dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md mx-auto shadow-2xl text-slate-100">
      <div className="text-center mb-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-3">
          <Shield className="w-3.5 h-3.5" />
          <span>Bakong KHQR Checkout</span>
        </div>
        <h3 className="text-2xl font-black text-white tracking-tight">Scan with ABA / Bakong App</h3>

        <p className="text-slate-400 text-xs mt-2">
          Amount: <strong className="text-cyan-400 text-sm">${parseFloat(amount || 0).toFixed(2)}</strong> · Expires in{' '}
          <span className="text-red-400 font-bold font-mono">{formatTime(timeLeft)}</span>
        </p>
      </div>

      {/* QR CODE WITH LOGO OVERLAY */}
      {qrPayload && (
        <div className="relative flex justify-center mb-6 bg-white p-4 rounded-2xl shadow-inner border border-slate-800">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrPayload)}`}
            alt="Bakong KHQR Code"
            className="w-56 h-56 object-contain rounded-xl"
          />

          {/* ABA / Bakong Logo Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white p-1 rounded-xl shadow-md border border-gray-100">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/ABA_Bank_logo.svg/2560px-ABA_Bank_logo.svg.png"
                alt="ABA Logo"
                className="w-10 h-10 object-contain"
              />
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
        {checking && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-cyan-400"></div>}
        <span>Waiting for payment confirmation...</span>
      </div>

      <div className="mt-6 border-t border-slate-800 pt-4">
        <button
          onClick={async () => {
            try {
              await apiClient.post(`/payment/bakong/simulate-payment/${md5}`);
              toast.success('Simulating payment... waiting for poll.');
            } catch (err) {
              toast.error('Failed to simulate');
            }
          }}
          className="w-full py-3 bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition"
        >
          (Dev) Simulate Bakong Transfer
        </button>
      </div>
    </div>
  );
};

export default BakongPayment;
