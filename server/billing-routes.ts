import { Router, raw } from "express";
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

    const result = await billingService.createCheckoutSession({
      userId: user.id,
      plan: plan as PlanTier,
      successUrl,
      cancelUrl,
    });

    res.json({
      sessionId: result.sessionId,
      url: result.url,
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
 * IMPORTANT: This route must receive raw body for signature verification
 * The raw body middleware must be applied before this route in the parent router
 */
router.post("/webhook", raw({ type: "application/json" }), async (req, res) => {
  try {
    const stripe = getStripeClient();
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured - rejecting webhook");
      return res.status(400).json({ error: "Webhook secret not configured" });
    }

    if (!sig) {
      console.error("No stripe-signature header found");
      return res.status(400).json({ error: "No signature header" });
    }

    let event;
    try {
      // req.body should be raw Buffer from raw() middleware
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
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
