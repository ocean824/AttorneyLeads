# Stripe Integration Setup Guide

This guide will walk you through setting up Stripe billing for your Attorney Leads platform with 4-tier subscription pricing.

## Prerequisites

1. **Stripe Account**: Create a free account at [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
2. **API Keys**: You should have already added `STRIPE_SECRET_KEY` and `VITE_STRIPE_PUBLIC_KEY` to your Replit Secrets

## Step 1: Create Subscription Products in Stripe

Navigate to the Stripe Dashboard → Products → Create Product for each tier:

### Basic Plan - $29.95/month

1. Go to [https://dashboard.stripe.com/products](https://dashboard.stripe.com/products)
2. Click "Create product"
3. Fill in:
   - **Name**: Attorney Leads - Basic
   - **Description**: View-only AI Summary, Alerts enabled, Limited exports
   - **Pricing model**: Recurring
   - **Price**: $29.95 USD
   - **Billing period**: Monthly
4. Click "Save product"
5. **Copy the Price ID** (starts with `price_`) - you'll need this

### Standard Plan - $59.95/month

1. Create product:
   - **Name**: Attorney Leads - Standard
   - **Description**: Full record access, PDF/CSV export, AI assistant, CRM delivery
   - **Price**: $59.95 USD
   - **Billing period**: Monthly
2. **Copy the Price ID**

### Pro Plan - $89.95/month

1. Create product:
   - **Name**: Attorney Leads - Pro
   - **Description**: Everything in Standard, AI trainer access, Fine-tune tools, Advanced analytics
   - **Price**: $89.95 USD
   - **Billing period**: Monthly
2. **Copy the Price ID**

### Elite Plan - $189.95/month

1. Create product:
   - **Name**: Attorney Leads - Elite
   - **Description**: Everything in Pro, Real-time court watch, Appointment matching, Priority support, Multi-LLM access
   - **Price**: $189.95 USD
   - **Billing period**: Monthly
2. **Copy the Price ID**

## Step 2: Add Price IDs to Environment Variables

Add the following secrets to your Replit Secrets (Tool panel → Secrets):

```
STRIPE_PRICE_BASIC=price_xxxxxxxxxxxxx
STRIPE_PRICE_STANDARD=price_xxxxxxxxxxxxx
STRIPE_PRICE_PRO=price_xxxxxxxxxxxxx
STRIPE_PRICE_ELITE=price_xxxxxxxxxxxxx
```

Replace `price_xxxxxxxxxxxxx` with the actual Price IDs you copied from Stripe.

## Step 3: Configure Stripe Webhook (Production)

For production deployments, you'll need to set up webhooks to handle subscription events:

1. Go to [https://dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Enter your webhook URL: `https://your-app-url.replit.app/api/billing/webhook`
4. Select events to listen to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. **Copy the Webhook Signing Secret** (starts with `whsec_`)
7. Add to Replit Secrets:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

## Step 4: Test the Integration

### Using Stripe Test Mode

1. Make sure you're using **test mode** API keys (they have `_test_` in them)
2. Navigate to `/billing` in your app
3. Click "Upgrade" on any paid plan
4. Use Stripe test cards:
   - **Success**: `4242 4242 4242 4242`
   - **Decline**: `4000 0000 0000 0002`
   - Use any future expiry date (e.g., 12/34)
   - Use any 3-digit CVC
   - Use any ZIP code

### Test Webhook Events Locally

For local testing, use Stripe CLI:

```bash
# Install Stripe CLI (one-time)
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Forward webhooks to your local server
stripe listen --forward-to localhost:5000/api/billing/webhook
```

The CLI will give you a webhook signing secret for local testing. Add it temporarily to your environment:

```
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

## Step 5: Go Live

When you're ready to accept real payments:

1. **Complete Stripe account verification**:
   - Provide business details
   - Add bank account for payouts
   - Complete identity verification

2. **Switch to Live Mode**:
   - Get your **live** API keys from [https://dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
   - Update Replit Secrets with live keys:
     ```
     STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
     VITE_STRIPE_PUBLIC_KEY=pk_live_xxxxxxxxxxxxx
     ```

3. **Create live products**:
   - Repeat Step 1 in **Live Mode**
   - Update price IDs with live versions

4. **Configure live webhook**:
   - Add production webhook endpoint
   - Update `STRIPE_WEBHOOK_SECRET` with live secret

## API Endpoints

The following billing endpoints are available:

### GET `/api/billing/plans`
Returns all available subscription plans with features and pricing.

### GET `/api/billing/subscription`
Returns the current user's subscription status.

Response:
```json
{
  "plan": "standard",
  "status": "active",
  "currentPeriodEnd": 1234567890,
  "features": ["Full record access", "PDF/CSV export", ...]
}
```

### POST `/api/billing/create-checkout-session`
Creates a new Stripe Checkout Session for subscription signup.

Request:
```json
{
  "plan": "standard",
  "successUrl": "https://your-app.com/billing?success=true",
  "cancelUrl": "https://your-app.com/billing?canceled=true"
}
```

Response:
```json
{
  "sessionId": "cs_test_xxxxxxxxxxxxx",
  "url": "https://checkout.stripe.com/c/pay/cs_test_xxxxxxxxxxxxx"
}
```

The frontend should redirect to the `url` to complete payment on Stripe's hosted checkout page.

### POST `/api/billing/create-portal-session`
Creates a Stripe Customer Portal session for managing subscriptions.

Request:
```json
{
  "returnUrl": "https://your-app.com/billing"
}
```

Response:
```json
{
  "url": "https://billing.stripe.com/session/xxxxxxxxxxxxx"
}
```

### POST `/api/billing/webhook`
Handles Stripe webhook events (subscription updates, payment failures, etc).

## Features Implemented

✅ **4-Tier Subscription Model**: Free, Basic ($29.95), Standard ($59.95), Pro ($89.95), Elite ($189.95)
✅ **Stripe Checkout Integration**: Seamless subscription signup
✅ **Customer Portal**: Self-service billing management
✅ **Webhook Handling**: Automatic subscription status updates
✅ **Database Integration**: User subscription data stored in PostgreSQL
✅ **Subscription Gates**: Ready for feature restrictions based on plan tier

## Next Steps

1. **Implement Feature Gates**: Add plan-based restrictions to features:
   - Records export (limited on Basic, unlimited on Standard+)
   - CRM access (Standard+)
   - AI agent features (Standard+)
   - Advanced analytics (Pro+)
   - Multi-LLM access (Elite only)

2. **Add Usage Limits**: Implement metered billing or usage caps per plan

3. **Email Notifications**: Set up email notifications for:
   - Subscription confirmations
   - Payment failures
   - Subscription renewals

4. **Analytics Dashboard**: Track subscription metrics:
   - Monthly Recurring Revenue (MRR)
   - Churn rate
   - Subscription conversions

## Troubleshooting

### "STRIPE_SECRET_KEY not configured" error
- Ensure `STRIPE_SECRET_KEY` is added to Replit Secrets
- Restart the application after adding secrets

### Webhook events not received
- Verify webhook URL is publicly accessible
- Check webhook signing secret matches
- Review Stripe Dashboard → Developers → Webhooks for delivery logs

### Payment failed during testing
- Use valid Stripe test cards (see Step 4)
- Ensure test mode API keys are being used
- Check browser console for errors

## Support

- **Stripe Documentation**: [https://stripe.com/docs](https://stripe.com/docs)
- **Stripe Support**: [https://support.stripe.com](https://support.stripe.com)
- **Replit Discord**: For Replit-specific issues

---

**Last Updated**: November 2025
**Stripe API Version**: 2025-10-29.clover
