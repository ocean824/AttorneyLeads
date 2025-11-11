import { Router } from "express";
import { billingService, SUBSCRIPTION_PLANS, type PlanTier } from "./billing/stripe-service";
import { getStripeClient } from "./billing/stripe-service";
import { z } from "zod";

const router = Router();

/**
 * Get available subscription plans
 */
router.get("/plans", async (req, res) => {
  try {
    res.json({
      plans: SUBSCRIPTION_PLANS,
    });
  } catch (error: any) {
    console.error("Error fetching plans:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create checkout session for subscription
 */
router.post("/create-checkout-session", async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const schema = z.object({
      plan: z.enum(["basic", "standard", "pro", "elite"]),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
    });

    const { plan, successUrl, cancelUrl } = schema.parse(req.body);

    const result = await billingService.createSubscription({
      userId: user.id,
      plan: plan as PlanTier,
    });

    res.json({
      sessionId: result.subscriptionId,
      clientSecret: result.clientSecret,
    });
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create customer portal session
 */
router.post("/create-portal-session", async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const schema = z.object({
      returnUrl: z.string().url(),
    });

    const { returnUrl } = schema.parse(req.body);

    const result = await billingService.createPortalSession({
      userId: user.id,
      returnUrl,
    });

    res.json({ url: result.url });
  } catch (error: any) {
    console.error("Error creating portal session:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get current user's subscription status
 */
router.get("/subscription", async (req, res) => {
  try {
    const sessionUser = req.session.user;
    if (!sessionUser) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { storage } = await import("./storage");
    const user = await storage.getUserById(sessionUser.id);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      plan: user.plan || "free",
      status: user.subscriptionStatus || "inactive",
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      features: SUBSCRIPTION_PLANS[user.plan as PlanTier || "free"].features,
    });
  } catch (error: any) {
    console.error("Error fetching subscription:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Stripe webhook handler
 */
router.post("/webhook", async (req, res) => {
  const stripe = getStripeClient();
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    return res.status(400).send("Missing stripe-signature header");
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    let event;

    if (webhookSecret) {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
    } else {
      // For development/testing without webhook secret
      event = req.body;
    }

    // Handle the event
    await billingService.handleWebhook(event);

    res.json({ received: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

export default router;
