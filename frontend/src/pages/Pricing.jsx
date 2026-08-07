// frontend/src/pages/Pricing.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import apiClient from '../api/client';
import {
  Check,
  Sparkles,
  Building2,
  Store,
  Crown,
  ArrowRight,
  Shield,
  Zap,
  X,
  Copy,
  CheckCircle,
  LayoutDashboard,
} from 'lucide-react';

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [userSubscription, setUserSubscription] = useState(null);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);

  const pollIntervalRef = useRef(null);
  const qrFetchedRef = useRef(false);

  const plans = [
    {
      id: 'market-stall',
      name: 'Market Stall',
      icon: Store,
      price: 0,
      period: '/month',
      description: 'One counter, kept honest',
      features: ['1 staff account', '150 sales/month', 'Basic daily report', 'Community support'],
      color: 'from-green-500 to-emerald-500',
      buttonColor: 'bg-green-600 hover:bg-green-700',
      popular: false,
      free: true,
    },
    {
      id: 'shophouse',
      name: 'Shophouse',
      icon: Building2,
      price: 19,
      period: '/month',
      description: 'Most Cambodian SMEs start here',
      features: [
        '5 staff accounts',
        'Unlimited sales',
        'Inventory + supplier tracking',
        'Khmer & English reports',
        'ABA/Wing payment tracking',
        'Priority Telegram support',
      ],
      color: 'from-blue-500 to-purple-500',
      buttonColor: 'bg-blue-600 hover:bg-blue-700',
      popular: true,
      free: false,
    },
    {
      id: 'chain',
      name: 'Chain',
      icon: Crown,
      price: 49,
      period: '/month',
      description: 'For multi-branch operators',
      features: [
        'Unlimited staff',
        'Multi-branch dashboard',
        'Custom reports & exports',
        'API access',
        'Dedicated onboarding',
      ],
      color: 'from-purple-500 to-pink-500',
      buttonColor: 'bg-purple-600 hover:bg-purple-700',
      popular: false,
      free: false,
    },
  ];

  // Check user's current subscription
  useEffect(() => {
    const checkSubscription = async () => {
      if (user) {
        try {
          const { data } = await apiClient.get(`/users/${user.user_id}/subscription`);
          setUserSubscription(data);
        } catch (error) {
          // Expected if this hasn't been deployed/fixed yet on the backend —
          // leave userSubscription null rather than assume.
          console.error('Error fetching subscription:', error);
        }
      }
      setIsCheckingSubscription(false);
    };

    checkSubscription();
  }, [user]);

  const clearPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const startPaymentPolling = useCallback((sessionId, plan) => {
    clearPolling();
    setPaymentStatus('pending');

    pollIntervalRef.current = setInterval(async () => {
      try {
        const { data } = await apiClient.get(`/payment/status/${sessionId}`);

        if (data.status === 'paid') {
          clearPolling();
          setPaymentStatus('paid');
          handlePaymentSuccess(plan);
        } else if (data.status === 'expired') {
          clearPolling();
          setPaymentStatus('expired');
          toast.error('QR code expired. Please try again.');
        } else if (data.status === 'awaiting_verification') {
          setPaymentStatus('awaiting_verification');
        }
      } catch (error) {
        console.error('Payment verification error:', error);
      }
    }, 5000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => clearPolling();
  }, []);

  const fetchQRCode = useCallback(async (plan) => {
    if (!plan || !user) return;
    setLoading(true);
    setPaymentStatus('pending');
    try {
      const orderId = `sub-${user.user_id}-${plan.id}-${Date.now()}`;
      const { data } = await apiClient.get('/payment/khqr', {
        params: {
          amount: plan.price,
          orderId,
          userId: user.user_id,
          plan: plan.id,
        },
      });

      setQrData(data);
      startPaymentPolling(data.sessionId, plan);
    } catch (error) {
      console.error('Error loading QR:', error);
      toast.error(error.response?.data?.error || 'Failed to generate QR code');
      setQrData(null);
    } finally {
      setLoading(false);
    }
  }, [user, startPaymentPolling]);

  useEffect(() => {
    if (showQRModal && currentPlan && !currentPlan.free && !qrFetchedRef.current) {
      qrFetchedRef.current = true;
      fetchQRCode(currentPlan);
    }
    if (!showQRModal) {
      qrFetchedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQRModal, currentPlan]);

  const handlePaymentSuccess = async (plan) => {
    toast.success(`🎉 ${plan?.name} plan activated!`);
    setUserSubscription({
      plan: plan?.id,
      planName: plan?.name,
      status: 'active',
    });

    setTimeout(() => {
      closeModal();
      navigate('/dashboard');
    }, 2000);
  };

  const confirmPayment = async () => {
    if (!qrData?.sessionId) return;
    try {
      const { data } = await apiClient.post('/payment/confirm', {
        sessionId: qrData.sessionId,
      });
      if (data.success) {
        setPaymentStatus('awaiting_verification');
        toast.success(data.message || 'Payment noted — verifying now.');
      }
    } catch (error) {
      console.error('Confirm payment error:', error);
      toast.error(error.response?.data?.message || 'Failed to confirm payment');
    }
  };

  const handleSubscribe = (plan) => {
    setSelectedPlan(plan.id);

    if (user && userSubscription && userSubscription.status === 'active') {
      toast(`You're already on the ${userSubscription.planName || 'active'} plan!`);
      navigate('/dashboard');
      return;
    }

    if (plan.free) {
      if (user) {
        toast.success('✅ You\'re all set on the free plan!');
        navigate('/dashboard');
      } else {
        toast.success('✅ Free plan selected! Create your account to get started.');
        setTimeout(() => navigate('/register'), 1000);
      }
      return;
    }

    if (!user) {
      toast.error('Please login or create an account first');
      setTimeout(() => navigate('/login'), 1000);
      return;
    }

    setCurrentPlan(plan);
    setShowQRModal(true);
  };

  // Copies the raw EMV payload text (for pasting into a banking app that
  // accepts manual QR text entry). The scannable image is `khqrImage`.
  const copyPayload = async () => {
    if (!qrData?.khqr) return;
    try {
      await navigator.clipboard.writeText(qrData.khqr);
      setCopied(true);
      toast.success('KHQR payload copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      toast.error('Failed to copy payload');
    }
  };

  const closeModal = () => {
    clearPolling();
    setShowQRModal(false);
    setQrData(null);
    setCurrentPlan(null);
    setPaymentStatus('pending');
  };

  const getPlanIcon = (plan) => {
    const Icon = plan.icon;
    return <Icon className="w-8 h-8" />;
  };

  const hasActiveSubscription = (planId) => {
    return userSubscription &&
           userSubscription.status === 'active' &&
           userSubscription.plan === planId;
  };

  const renderActionButton = (plan) => {
    if (user && hasActiveSubscription(plan.id)) {
      return (
        <Link
          to="/dashboard"
          className="w-full mt-8 py-3 rounded-xl font-semibold text-white transition-all duration-300 flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Go to Dashboard</span>
        </Link>
      );
    }

    if (user && userSubscription && userSubscription.status === 'active') {
      return (
        <button
          onClick={() => {
            toast(`You're currently on the ${userSubscription.planName} plan`);
            navigate('/dashboard');
          }}
          className="w-full mt-8 py-3 rounded-xl font-semibold text-white transition-all duration-300 flex items-center justify-center gap-2 bg-gray-500 hover:bg-gray-600 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Go to Dashboard</span>
        </button>
      );
    }

    return (
      <button
        onClick={() => handleSubscribe(plan)}
        className={`
          w-full mt-8 py-3 rounded-xl font-semibold text-white
          transition-all duration-300 flex items-center justify-center gap-2
          ${plan.buttonColor}
          ${plan.popular ? 'shadow-lg shadow-blue-500/30' : ''}
          hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
        `}
      >
        <span>{plan.free ? 'Start Free' : `Choose ${plan.name}`}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    );
  };

  if (isCheckingSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-16 px-4">
      <div className="container mx-auto max-w-6xl">

        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-full text-sm text-blue-600 dark:text-blue-400 mb-4">
            <Sparkles className="w-4 h-4" />
            <span>Simple Pricing, In Dollars</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Priced for a first shop,
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              ready for ten
            </span>
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg max-w-2xl mx-auto">
            Choose the plan that fits your business. Start free, upgrade as you grow.
          </p>
          {user && userSubscription && userSubscription.status === 'active' && (
            <div className="mt-4 inline-flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-full text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span>Currently on the <strong>{userSubscription.planName}</strong> plan</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isActive = hasActiveSubscription(plan.id);

            return (
              <div
                key={plan.id}
                className={`
                  relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden
                  border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1
                  ${plan.popular ? 'border-blue-500 dark:border-blue-400 shadow-xl' : 'border-gray-200 dark:border-gray-700'}
                  ${isSelected ? 'ring-4 ring-blue-500/50' : ''}
                  ${isActive ? 'ring-2 ring-green-500' : ''}
                `}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-2xl flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      MOST POPULAR
                    </div>
                  </div>
                )}

                {plan.free && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-green-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-2xl flex items-center gap-1">
                      FREE
                    </div>
                  </div>
                )}

                {isActive && (
                  <div className="absolute top-0 left-0">
                    <div className="bg-green-500 text-white text-xs font-bold px-4 py-1.5 rounded-br-2xl flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      ACTIVE
                    </div>
                  </div>
                )}

                <div className="p-6">
                  <div className={`
                    w-14 h-14 rounded-2xl bg-gradient-to-r ${plan.color}
                    flex items-center justify-center text-white shadow-lg mb-4
                  `}>
                    {getPlanIcon(plan)}
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {plan.description}
                  </p>

                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      ${plan.price}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 mb-1">
                      {plan.period}
                    </span>
                  </div>

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {renderActionButton(plan)}

                  <div className="mt-4 text-center">
                    <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1">
                      <Shield className="w-3 h-3" />
                      {isActive ? 'Your subscription is active' : 'Secure checkout via KHQR'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            All plans include a 14-day free trial. No card required.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Questions? Contact us at{' '}
            <a href="mailto:support@spms.com" className="text-blue-600 hover:underline">
              support@spms.com
            </a>
          </p>
          {!user && (
            <div className="mt-4">
              <Link
                to="/register"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Create a free account →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ===== KHQR PAYMENT MODAL ===== */}
      {showQRModal && currentPlan && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={() => {
            if (paymentStatus !== 'pending') closeModal();
          }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {paymentStatus !== 'pending' && (
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            )}

            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Pay with ABA KHQR
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                Scan with ABA Mobile app to pay
              </p>
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Plan: <span className="font-semibold">{currentPlan.name}</span>
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                ${currentPlan.price}
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-500 dark:text-gray-400">Generating QR code...</p>
              </div>
            ) : paymentStatus === 'paid' ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h4 className="text-xl font-bold text-green-600">Payment Successful!</h4>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                  Your {currentPlan.name} plan is now active.
                </p>
              </div>
            ) : paymentStatus === 'awaiting_verification' ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <Shield className="w-8 h-8 text-blue-600" />
                </div>
                <h4 className="text-xl font-bold text-blue-600">Verifying Your Payment</h4>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                  We're checking this against our account. This will update automatically —
                  no need to refresh.
                </p>
              </div>
            ) : paymentStatus === 'expired' ? (
              <div className="flex flex-col items-center justify-center py-8">
                <p className="text-red-500 font-semibold">This QR code has expired</p>
                <button
                  onClick={() => fetchQRCode(currentPlan)}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Generate New QR
                </button>
              </div>
            ) : qrData?.khqrImage ? (
              <>
                <div className="flex justify-center mb-4">
                  <img
                    src={qrData.khqrImage}
                    alt="ABA KHQR Code"
                    className="w-64 h-64 object-contain"
                  />
                </div>

                <div className="flex gap-2 mb-4">
                  <button
                    onClick={copyPayload}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg transition-colors text-sm"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy KHQR'}
                  </button>
                </div>

                <button
                  onClick={confirmPayment}
                  className="w-full mb-3 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl transition-colors font-medium"
                >
                  ✅ I Have Paid
                </button>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-semibold">Waiting for payment...</span>
                    <br />
                    Open ABA Mobile app, scan the QR code, and complete the payment.
                  </p>
                </div>

                <button
                  onClick={closeModal}
                  className="mt-4 w-full py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors text-sm"
                >
                  Cancel
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <p className="text-red-500">Failed to generate QR code</p>
                <button
                  onClick={() => fetchQRCode(currentPlan)}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Pricing;