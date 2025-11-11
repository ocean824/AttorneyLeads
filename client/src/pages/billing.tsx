import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface Plan {
  id: string;
  name: string;
  price: number;
  stripePriceId: string | null;
  features: string[];
}

interface SubscriptionStatus {
  plan: string;
  status: string;
  currentPeriodEnd: number | null;
  features: string[];
}

const PLAN_ORDER = ["free", "basic", "standard", "pro", "elite"];

export default function Billing() {
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const { data: plans } = useQuery<{ plans: Record<string, Plan> }>({
    queryKey: ["/api/billing/plans"],
  });

  const { data: subscription, isLoading: subscriptionLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/billing/subscription"],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (plan: string) => {
      const response = await apiRequest("POST", "/api/billing/create-checkout-session", {
        plan,
        successUrl: `${window.location.origin}/billing?success=true`,
        cancelUrl: `${window.location.origin}/billing?canceled=true`,
      });
      return response;
    },
    onSuccess: (data: any) => {
      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Error",
          description: "Failed to create checkout session",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setLoadingPlan(null);
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/billing/create-portal-session", {
        returnUrl: window.location.href,
      });
      return response;
    },
    onSuccess: (data: any) => {
      // Redirect to Stripe Customer Portal
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal",
        variant: "destructive",
      });
    },
  });

  const handleSubscribe = async (planId: string) => {
    if (planId === "free") {
      toast({
        title: "Already on Free Plan",
        description: "You're currently on the free plan. Choose a paid plan to upgrade.",
      });
      return;
    }

    setLoadingPlan(planId);
    await checkoutMutation.mutateAsync(planId);
  };

  const handleManageBilling = () => {
    portalMutation.mutate();
  };

  if (!plans || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-billing" />
      </div>
    );
  }

  const currentPlan = subscription?.plan || "free";
  const sortedPlans = PLAN_ORDER.map(planId => ({ 
    planId, 
    ...plans.plans[planId as keyof typeof plans.plans] 
  }));

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4" data-testid="text-billing-title">
          Choose Your Plan
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Scale your attorney lead generation with powerful automation and AI-driven insights
        </p>
        {subscription && subscription.plan !== "free" && (
          <div className="mt-6">
            <Badge variant="secondary" className="text-sm" data-testid="badge-current-plan">
              Current Plan: {plans.plans[currentPlan]?.name}
              {subscription.status && ` (${subscription.status})`}
            </Badge>
            {subscription.currentPeriodEnd && (
              <p className="text-sm text-muted-foreground mt-2">
                Renews on {new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
        {sortedPlans.map((plan, index) => {
          const isCurrentPlan = plan.planId === currentPlan;
          const isPremium = plan.planId === "elite";
          const isPopular = plan.planId === "standard";

          return (
            <Card
              key={plan.planId}
              className={`relative flex flex-col ${
                isPremium ? "border-primary shadow-lg" : ""
              } ${isPopular ? "border-primary/50" : ""}`}
              data-testid={`card-plan-${plan.planId}`}
            >
              {isPopular && (
                <Badge
                  className="absolute -top-3 left-1/2 -translate-x-1/2"
                  data-testid="badge-popular"
                >
                  Most Popular
                </Badge>
              )}
              {isPremium && (
                <Badge
                  variant="default"
                  className="absolute -top-3 left-1/2 -translate-x-1/2"
                  data-testid="badge-premium"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Premium
                </Badge>
              )}

              <CardHeader className="text-center">
                <CardTitle className="text-2xl" data-testid={`text-plan-name-${plan.planId}`}>
                  {plan.name}
                </CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold" data-testid={`text-plan-price-${plan.planId}`}>
                    ${plan.price}
                  </span>
                  {plan.price > 0 && <span className="text-muted-foreground">/month</span>}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm" data-testid={`text-feature-${plan.planId}-${i}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-4">
                {isCurrentPlan ? (
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled
                    data-testid={`button-current-plan-${plan.planId}`}
                  >
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={isPremium ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan.planId)}
                    disabled={loadingPlan !== null || plan.planId === "free"}
                    data-testid={`button-subscribe-${plan.planId}`}
                  >
                    {loadingPlan === plan.planId ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {plan.planId === "free" ? "Downgrade" : "Upgrade"}
                        {plan.planId !== "free" && <ArrowRight className="h-4 w-4 ml-2" />}
                      </>
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {subscription && subscription.plan !== "free" && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={handleManageBilling}
            disabled={portalMutation.isPending}
            data-testid="button-manage-billing"
          >
            {portalMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Opening Portal...
              </>
            ) : (
              "Manage Billing & Subscription"
            )}
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            Update payment method, view invoices, or cancel subscription
          </p>
        </div>
      )}
    </div>
  );
}
