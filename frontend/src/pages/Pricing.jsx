import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import apiClient from '../api/client';
import BakongPayment from '../components/BakongPayment';
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
  LayoutDashboard,
} from 'lucide-react';

const Pricing = () => {
  const { user, loading: authLoading } = useAuth(); // Grab authLoading to prevent premature calls
  const navigate = useNavigate();

  const [currentPlan, setCurrentPlan] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [userSubscription, setUserSubscription] = useState(null);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);

  // Robust User ID extraction
  const safeUserId = user?.userid || user?.user_id || user?.id;

  // 1. Fetch Subscription Status safely
  useEffect(() => {
    let isMounted = true;

    const checkSubscription = async () => {
      // Wait for auth to finish loading
      if (authLoading) return;

      if (user && safeUserId) {
        try {
          const { data } = await apiClient.get(`/users/${safeUserId}/subscription`);
          if (isMounted) setUserSubscription(data);
        } catch (error) {
          // If it's a 401, the user's token is likely expired
          if (error.response?.status === 401) {
            console.warn('Token expired or invalid. Please log in again.');
            localStorage.removeItem('token');
          }
        }
      }

      if (isMounted) setIsCheckingSubscription(false);
    };

    checkSubscription();
    return () => { isMounted = false; };
  }, [user, safeUserId, authLoading]);

  // Memoize plans
  const plans = useMemo(() => [
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
  ], []);

  const handleSubscribe = useCallback((plan) => {
    if (user && userSubscription && userSubscription.status === 'active') {
      toast(`You're already on the ${userSubscription.planName || 'active'} plan!`);
      navigate('/dashboard');
      return;
    }

    if (plan.free) {
      if (user) {
        toast.success("✅ You're all set on the free plan!");
        navigate('/dashboard');
      } else {
        toast.success('✅ Free plan selected! Create your account to get started.');
        setTimeout(() => navigate('/register'), 1000);
      }
      return;
    }

    if (!user || !safeUserId) {
      toast.error('Please login or create an account first');
      setTimeout(() => navigate('/login'), 1000);
      return;
    }

    setCurrentPlan(plan);
    setShowQRModal(true);
  }, [user, safeUserId, userSubscription, navigate]);

  const hasActiveSubscription = useCallback((planId) => {
    return userSubscription && userSubscription.status === 'active' && userSubscription.plan === planId;
  }, [userSubscription]);

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

  if (authLoading || isCheckingSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-16 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
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
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan) => {
            const isActive = hasActiveSubscription(plan.id);

            return (
              <div
                key={plan.id}
                className={`
                  relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden
                  border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1
                  ${plan.popular ? 'border-blue-500 dark:border-blue-400 shadow-xl' : 'border-gray-200 dark:border-gray-700'}
                  ${isActive ? 'ring-2 ring-green-500' : ''}
                `}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-2xl flex items-center gap-1">
                      <Zap className="w-3 h-3" /> MOST POPULAR
                    </div>
                  </div>
                )}

                {plan.free && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-green-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-2xl">
                      FREE
                    </div>
                  </div>
                )}

                {isActive && (
                  <div className="absolute top-0 left-0">
                    <div className="bg-green-500 text-white text-xs font-bold px-4 py-1.5 rounded-br-2xl flex items-center gap-1">
                      <Check className="w-3 h-3" /> ACTIVE
                    </div>
                  </div>
                )}

                <div className="p-6">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-r ${plan.color} flex items-center justify-center text-white shadow-lg mb-4`}>
                    <plan.icon className="w-8 h-8" />
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{plan.description}</p>

                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">${plan.price}</span>
                    <span className="text-gray-500 dark:text-gray-400 mb-1">{plan.period}</span>
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
      </div>

      {/* ===== CHECKOUT MODAL ===== */}
      {showQRModal && currentPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowQRModal(false)}
        >
          <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-white flex items-center justify-center hover:bg-slate-700 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <BakongPayment
              amount={currentPlan.price}
              planId={currentPlan.id}
              userId={safeUserId} // Safe ID passed here
              onSuccess={() => {
                setShowQRModal(false);
                navigate('/dashboard');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Pricing;
