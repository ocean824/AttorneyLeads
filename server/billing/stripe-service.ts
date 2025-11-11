import Stripe from "stripe";
import { storage } from "../storage";

// Plan definitions based on reference materials
export const SUBSCRIPTION_PLANS = {
  free: {
    name: "Free",
    price: 0,
    stripePriceId: null,
    features: [
      "Limited record view",
      "AI agent summary only",
      "Export disabled",
      "CRM disabled",
    ],
  },
  basic: {
    name: "Basic",
    price: 29.95,
    stripePriceId: process.env.STRIPE_PRICE_BASIC, // Set via Stripe dashboard
    features: [
      "View-only AI Summary",
      "Alerts enabled",
      "Limited exports",
    ],
  },
  standard: {
    name: "Standard",
    price: 59.95,
    stripePriceId: process.env.STRIPE_PRICE_STANDARD,
    features: [
      "Full record access",
      "PDF/CSV export",
      "AI assistant",
      "CRM delivery",
    ],
  },
  pro: {
    name: "Pro",
    price: 89.95,
    stripePriceId: process.env.STRIPE_PRICE_PRO,
    features: [
      "Everything in Standard",
      "AI trainer access",
      "Fine-tune tools",
      "Advanced analytics",
    ],
  },
  elite: {
    name: "Elite",
    price: 189.95,
    stripePriceId: process.env.STRIPE_PRICE_ELITE,
    features: [
      "Everything in Pro",
      "Real-time court watch",
      "Appointment matching",
      "Priority support",
      "Multi-LLM access",
    ],
  },
} as const;

export type PlanTier = keyof typeof SUBSCRIPTION_PLANS;

// Initialize Stripe client
let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2025-10-29.clover",
    });
  }
  return stripeClient;
}

export class BillingService {
  /**
   * Create or retrieve Stripe customer for user
   */
  async ensureCustomer(userId: string, email: string, name?: string): Promise<string> {
    const user = await storage.getUserById(userId);
    
    if (user?.stripeCustomerId) {
      return user.stripeCustomerId;
    }
    
    const stripe = getStripeClient();
    const customer = await stripe.customers.create({
      email,
      name: name || email.split('@')[0],
      metadata: {
        userId,
      },
    });
    
    await storage.updateUserStripeInfo(userId, {
      stripeCustomerId: customer.id,
    });
    
    return customer.id;
  }

  /**
   * Create payment intent for one-time payment
   */
  async createPaymentIntent(params: {
    userId: string;
    amount: number;
    description: string;
  }): Promise<{ clientSecret: string; paymentIntentId: string }> {
    const stripe = getStripeClient();
    const user = await storage.getUserById(params.userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const customerId = await this.ensureCustomer(
      params.userId, 
      user.email, 
      user.email.split('@')[0]
    );
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(params.amount * 100), // Convert to cents
      currency: "usd",
      customer: customerId,
      description: params.description,
      metadata: {
        userId: params.userId,
      },
    });
    
    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };
  }

  /**
   * Create Stripe Checkout Session for subscription
   */
  async createCheckoutSession(params: {
    userId: string;
    plan: PlanTier;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{
    sessionId: string;
    url: string;
  }> {
    const stripe = getStripeClient();
    const user = await storage.getUserById(params.userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const planConfig = SUBSCRIPTION_PLANS[params.plan];
    
    if (params.plan === 'free' || !planConfig.stripePriceId) {
      throw new Error('Cannot create subscription for free plan or unconfigured plan');
    }
    
    const customerId = await this.ensureCustomer(
      params.userId,
      user.email,
      user.email.split('@')[0]
    );
    
    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{
        price: planConfig.stripePriceId,
        quantity: 1,
      }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        userId: params.userId,
        plan: params.plan,
      },
      subscription_data: {
        metadata: {
          userId: params.userId,
          plan: params.plan,
        },
      },
    });
    
    return {
      sessionId: session.id,
      url: session.url!,
    };
  }

  /**
   * Get or create billing portal session
   */
  async createPortalSession(params: {
    userId: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    const stripe = getStripeClient();
    const user = await storage.getUserById(params.userId);
    
    if (!user || !user.stripeCustomerId) {
      throw new Error('No Stripe customer found');
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: params.returnUrl,
    });
    
    return { url: session.url };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionChange(subscription);
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionCanceled(subscription);
        break;
      }
      
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Invoice paid: ${invoice.id} for customer ${invoice.customer}`);
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Invoice payment failed: ${invoice.id}`);
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle subscription change webhook
   */
  private async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.userId;
    const plan = subscription.metadata.plan as PlanTier || 'free';
    
    if (!userId) {
      console.warn('Subscription missing userId metadata:', subscription.id);
      return;
    }
    
    await storage.updateUserStripeInfo(userId, {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      plan,
      subscriptionCurrentPeriodEnd: (subscription as any).current_period_end as number,
    });
    
    console.log(`✓ Updated subscription for user ${userId}: ${plan} (${subscription.status})`);
  }

  /**
   * Handle subscription canceled webhook
   */
  private async handleSubscriptionCanceled(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.userId;
    
    if (!userId) {
      console.warn('Subscription missing userId metadata:', subscription.id);
      return;
    }
    
    await storage.updateUserStripeInfo(userId, {
      subscriptionStatus: 'canceled',
      plan: 'free',
      subscriptionCurrentPeriodEnd: null,
    });
    
    console.log(`✓ Canceled subscription for user ${userId}`);
  }
}

export const billingService = new BillingService();
