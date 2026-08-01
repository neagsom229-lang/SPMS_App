// frontend/src/pages/Pricing.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import apiClient from '../api/client'; // ✅ use the shared, correctly-configured client
import { 
  Check, 
  Sparkles, 
  Building2, 
  Store, 
  Users, 
  TrendingUp,
  Shield,
  Zap,
  Crown,
  ArrowRight,
  Loader2
} from 'lucide-react';

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const plans = [
    {
      id: 'market-stall',
      name: 'Market Stall',
      icon: Store,
      price: 0,
      period: '/month',
      description: 'One counter, kept honest',
      features: [
        '1 staff account',
        '150 sales/month',
        'Basic daily report',
        'Community support',
      ],
      color: 'from-green-500 to-emerald-500',
      borderColor: 'border-green-200 dark:border-green-800',
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
      borderColor: 'border-blue-500 dark:border-blue-400',
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
      borderColor: 'border-purple-500 dark:border-purple-400',
      buttonColor: 'bg-purple-600 hover:bg-purple-700',
      popular: false,
      free: false,
    },
  ];

  // ===== HANDLE SUBSCRIBE =====
  const handleSubscribe = async (plan) => {
    setSelectedPlan(plan.id);
    setLoading(plan.id);

    // If free plan
    if (plan.free) {
      toast.success('✅ Free plan selected! Create your account to get started.');
      setTimeout(() => navigate('/register'), 1000);
      setLoading(null);
      return;
    }

    // If not logged in
    if (!user) {
      toast.error('Please login or create an account first');
      setTimeout(() => navigate('/login'), 1000);
      setLoading(null);
      return;
    }

    // ✅ Guard against missing email (backend login doesn't return one yet)
    if (!user.email) {
      toast.error('Your account is missing an email address. Please update your profile first.');
      setLoading(null);
      return;
    }

    try {
      // ✅ Use the shared apiClient so this hits the real backend, not the Vite dev server
      const response = await apiClient.post('/create-checkout-session', {
        plan: plan.id,
        customerEmail: user.email,
        customerName: user.fullname || user.username,
      });

      const data = response.data;

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Payment setup failed');
        setLoading(null);
      }
    } catch (error) {
      console.error('❌ Payment error:', error.response?.data || error.message);
      toast.error(error.response?.data?.error || 'Payment setup failed. Please try again.');
      setLoading(null);
    }
  };

  const getPlanIcon = (plan) => {
    const Icon = plan.icon;
    return <Icon className="w-8 h-8" />;
  };

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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isLoading = loading === plan.id;

            return (
              <div
                key={plan.id}
                className={`
                  relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden
                  border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1
                  ${plan.popular ? 'border-blue-500 dark:border-blue-400 shadow-xl' : 'border-gray-200 dark:border-gray-700'}
                  ${isSelected ? 'ring-4 ring-blue-500/50' : ''}
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

                  <button
                    onClick={() => handleSubscribe(plan)}
                    disabled={isLoading}
                    className={`
                      w-full mt-8 py-3 rounded-xl font-semibold text-white
                      transition-all duration-300 flex items-center justify-center gap-2
                      ${plan.buttonColor}
                      ${plan.popular ? 'shadow-lg shadow-blue-500/30' : ''}
                      hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <span>Choose {plan.name}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="mt-4 text-center">
                    <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1">
                      <Shield className="w-3 h-3" />
                      Secure checkout powered by Stripe
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            All plans include a 14-day free trial. No credit card required.
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
    </div>
  );
};

export default Pricing;