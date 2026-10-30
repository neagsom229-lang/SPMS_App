import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle, Clock, Shield, RefreshCw, ExternalLink } from 'lucide-react';

const BakongPayment = ({ amount, planId, userId, onSuccess }) => {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes countdown
  const [status, setStatus] = useState('pending');

  const timerIntervalRef = useRef(null);
  const isMounted = useRef(true);

  // Clear timer on unmount
  const clearTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
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

  const generateKHQR = useCallback(() => {
    clearTimer();
    setLoading(true);
    setStatus('pending');

    try {
      // Your active PayWay Checkout Link from the ABA Dashboard
      const PAYWAY_CHECKOUT_LINK = "https://link.payway.com.kh/ABAPAYD7541141U";

      // Generate a beautiful QR Code pointing to the PayWay link
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(PAYWAY_CHECKOUT_LINK)}`;

      setQrData({ qrImageUrl, checkoutUrl: PAYWAY_CHECKOUT_LINK });
      setTimeLeft(600);
      startTimer();

      // Note: Since this is a static link, we simulate a successful payment
      // for the UI demo after 5 seconds (Remove this in real production if you want).
      // setTimeout(() => setStatus('paid'), 5000);

    } catch (error) {
      console.error('Error generating QR:', error);
      toast.error('Failed to generate QR code');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    generateKHQR();

    return () => {
      isMounted.current = false;
      clearTimer();
    };
  }, [generateKHQR]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOpenCheckout = () => {
    if (qrData?.checkoutUrl) {
      window.location.href = qrData.checkoutUrl;
    }
  };

  // ================= RENDER STATES =================

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md mx-auto text-center shadow-2xl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
        <p className="text-slate-400 text-sm">Generating secure QR code...</p>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md mx-auto text-center shadow-2xl">
        <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/30">
          <Clock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-white mb-2">QR Code Expired</h3>
        <p className="text-slate-400 text-sm mb-6">
          The payment session has timed out. Please generate a new QR code.
        </p>
        <button
          onClick={generateKHQR}
          className="w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-black rounded-xl uppercase tracking-wider text-xs shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Generate New QR</span>
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

  // ================= MAIN QR RENDER =================

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md mx-auto shadow-2xl text-slate-100">

      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-3">
          <Shield className="w-3.5 h-3.5" />
          <span>ABA PayWay Checkout</span>
        </div>
        <h3 className="text-2xl font-black text-white tracking-tight">Scan to Pay</h3>
        <p className="text-slate-400 text-xs mt-1">
          Amount Due: <span className="text-cyan-400 font-bold">${parseFloat(amount || 0).toFixed(2)}</span>
        </p>
      </div>

      {/* Timer */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
          <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>Expires in: <strong className={timeLeft < 60 ? 'text-red-400' : 'text-cyan-400'}>{formatTime(timeLeft)}</strong></span>
        </div>
      </div>

      {/* QR Code Image */}
      {qrData?.qrImageUrl && (
        <div className="flex justify-center mb-6 bg-white p-4 rounded-2xl shadow-inner border border-slate-800">
          <img
            src={qrData.qrImageUrl}
            alt="PayWay Checkout QR"
            className="w-56 h-56 object-contain rounded-xl"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3 mb-6">
        <button
          onClick={handleOpenCheckout}
          className="w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center space-x-2 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:opacity-90"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Open Checkout Page</span>
        </button>
      </div>

      {/* Footer Info */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center text-xs text-slate-400 leading-relaxed">
        <p className="font-bold text-slate-200 mb-1">Secure Payment Gateway</p>
        Scan the QR code with ABA Mobile, or click the button above to pay securely.
      </div>

    </div>
  );
};

export default BakongPayment;
