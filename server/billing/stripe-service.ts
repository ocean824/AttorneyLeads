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
   * Create or update subscription
   */
  async createSubscription(params: {
    userId: string;
    plan: PlanTier;
  }): Promise<{
    subscriptionId: string;
    clientSecret: string;
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
    
    // Cancel existing subscription if any
    if (user.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      } catch (err) {
        console.warn('Failed to cancel existing subscription:', err);
      }
    }
    
    // Create new subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price: planConfig.stripePriceId,
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId: params.userId,
        plan: params.plan,
      },
    });
    
    // Extract payment intent from expanded invoice
    const latestInvoice: any = subscription.latest_invoice;
    const paymentIntent: any = latestInvoice?.payment_intent;
    
    // Update user record
    await storage.updateUserStripeInfo(params.userId, {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      plan: params.plan,
      subscriptionCurrentPeriodEnd: subscription.current_period_end as number,
    });
    
    return {
      subscriptionId: subscription.id,
      clientSecret: paymentIntent?.client_secret || '',
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
      subscriptionCurrentPeriodEnd: subscription.current_period_end as number,
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
