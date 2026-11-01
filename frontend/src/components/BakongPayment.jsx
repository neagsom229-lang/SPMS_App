import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import apiClient from '../api/client';
import { CheckCircle, Shield, AlertTriangle, RefreshCw, Clock } from 'lucide-react';

const BakongPayment = ({ amount, planId, userId, currency = 'USD', onSuccess }) => {
  const [qrPayload, setQrPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('pending'); // pending | paid | expired | verifying_error

  // Timer state (15 minutes expiry)
  const [timeLeft, setTimeLeft] = useState(900);
  const [checking, setChecking] = useState(false);
  const [md5, setMd5] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);

  const isMounted = useRef(true);
  const timerIntervalRef = useRef(null);
  const pollTimeoutRef = useRef(null);
  const pollStartTime = useRef(Date.now());

  // 1. Generate Dynamic QR via Backend
  const fetchDynamicQR = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTimeLeft(900);
    pollStartTime.current = Date.now();

    if (!userId) {
      setError("Please log in to generate a payment QR.");
      setLoading(false);
      return;
    }

    try {
      const { data } = await apiClient.post('/payment/bakong/create-qr', {
        amount: Number(amount),
        planId: planId || 'Standard',
        userId: userId,
        currency: currency
      });

      if (data?.success && data?.qrImage && data?.md5) {
        setQrPayload(data.qrImage);
        setMd5(data.md5);
        if (data.expiresAt) {
          setExpiresAt(data.expiresAt);
        }
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Error fetching QR:', err);
      setError(err.response?.data?.error || 'Failed to generate KHQR code');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [amount, planId, userId, currency]);

  // 2. Adaptive Polling (every 4s for first 2 minutes, then every 10s)
  const pollStatus = useCallback(async () => {
    if (!md5 || status !== 'pending') return;

    // Pause polling if tab is hidden
    if (document.visibilityState === 'hidden') {
      const interval = 4000;
      pollTimeoutRef.current = setTimeout(pollStatus, interval);
      return;
    }

    try {
      setChecking(true);
      const { data } = await apiClient.get(`/payment/bakong/check/${md5}`);

      if (data.status === 'PAID') {
        setStatus('paid');
        toast.success('🎉 Payment successful! Plan activated.');
        // Refetch subscription from backend
        try {
          await apiClient.get('/payment/subscription');
        } catch (subErr) {
          console.warn('Failed to refetch subscription:', subErr.message);
        }
        setTimeout(() => onSuccess?.(), 1500);
        return;
      }
    } catch (err) {
      console.warn('Polling check error:', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setChecking(false);
    }

    // Determine interval: 4s for first 2 minutes (120,000ms), then 10s
    const elapsed = Date.now() - pollStartTime.current;
    const interval = elapsed < 120000 ? 4000 : 10000;

    if (status === 'pending') {
      pollTimeoutRef.current = setTimeout(pollStatus, interval);
    }
  }, [md5, status, onSuccess]);

  // 3. Initialize on mount
  useEffect(() => {
    isMounted.current = true;
    fetchDynamicQR();

    return () => {
      isMounted.current = false;
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [fetchDynamicQR]);

  // 4. Countdown Timer & Polling trigger
  useEffect(() => {
    if (qrPayload && status === 'pending') {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
            setStatus('expired');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      pollStatus();
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [qrPayload, status, pollStatus]);

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
          QR expired, create a new one.
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

        <div className="mt-2 text-slate-300 text-xs space-y-1">
          <p>Plan: <strong className="text-white">{planId || 'Standard'}</strong></p>
          <p>
            Amount: <strong className="text-cyan-400 text-sm">${parseFloat(amount || 0).toFixed(2)} {currency}</strong>
          </p>
          <p>
            Expires in: <span className="text-red-400 font-bold font-mono">{formatTime(timeLeft)}</span>
          </p>
        </div>
      </div>

      {/* QR CODE RENDERING (BASE64 FROM BACKEND) WITH BAKONG LOGO OVERLAY */}
      {qrPayload && (
        <div className="relative flex justify-center mb-6 bg-white p-4 rounded-2xl shadow-inner border border-slate-800">
          <img
            src={qrPayload}
            alt="Bakong KHQR Code"
            className="w-56 h-56 object-contain rounded-xl"
          />

          {/* Official Bakong Logo Overlay (High-Fidelity SVG) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white p-1 rounded-full shadow-md border border-gray-100">
              <svg width="44" height="44" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="50" fill="#D31145" />
                <path d="M50 15C50 15 54 35 70 40C70 40 55 48 50 65C50 65 45 48 30 40C30 40 46 35 50 15Z" fill="white"/>
                <path d="M85 50C85 50 65 54 60 70C60 70 52 55 35 50C35 50 52 45 60 30C60 30 65 46 85 50Z" fill="white"/>
                <path d="M50 85C50 85 46 65 30 60C30 60 45 52 50 35C50 35 55 52 70 60C70 60 54 65 50 85Z" fill="white"/>
                <path d="M15 50C15 50 35 46 40 30C40 30 48 45 65 50C65 50 48 55 40 70C40 70 35 54 15 50Z" fill="white"/>
                <circle cx="50" cy="50" r="6" fill="#D31145" />
              </svg>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
        {checking && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-cyan-400"></div>}
        <span>Waiting for payment confirmation...</span>
      </div>

      {/* Simulate button only when import.meta.env.DEV */}
      {import.meta.env.DEV && (
        <div className="mt-6 border-t border-slate-800 pt-4">
          <button
            onClick={async () => {
              try {
                await apiClient.post(`/payment/simulate-payment/${md5}`);
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
      )}
    </div>
  );
};

export default BakongPayment;
