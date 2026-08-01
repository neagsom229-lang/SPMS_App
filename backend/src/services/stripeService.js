// backend/src/services/stripeService.js
const Stripe = require('stripe');

// Initialize Stripe with secret key
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Create a payment intent
const createPaymentIntent = async (amount, currency = 'usd', metadata = {}) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency,
      metadata: metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    return { success: true, clientSecret: paymentIntent.client_secret };
  } catch (error) {
    console.error('❌ Stripe error:', error.message);
    return { success: false, error: error.message };
  }
};

// Create a checkout session for subscription
const createCheckoutSession = async (plan, customerEmail) => {
  try {
    const prices = {
      'market-stall': 0,      // free plan — shouldn't normally reach Stripe at all
      'shophouse': 1900,      // $19.00
      'chain': 4900,          // $49.00
    };

    const planNames = {
      'market-stall': 'Market Stall',
      'shophouse': 'Shophouse',
      'chain': 'Chain',
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `SPMS ${planNames[plan] || plan} Plan`,
            description: `Monthly subscription for ${planNames[plan] || plan} plan`,
            tax_code: 'txcd_10103001', // SaaS - Software as a Service (business use)
          },
          unit_amount: prices[plan] ?? 1900,
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      customer_email: customerEmail,
      metadata: {
        plan: plan
      }
    });

    return { success: true, url: session.url };
  } catch (error) {
    console.error('❌ Stripe session error:', error.message);
    return { success: false, error: error.message };
  }
};

// Webhook handler for subscription events
const handleWebhook = async (payload, signature) => {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log(`✅ Payment successful for ${session.customer_email}`);
        // Update user subscription in database
        break;
      case 'invoice.paid':
        console.log('✅ Invoice paid');
        break;
      case 'invoice.payment_failed':
        console.log('❌ Payment failed');
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  createPaymentIntent,
  createCheckoutSession,
  handleWebhook
};