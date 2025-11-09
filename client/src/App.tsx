import { Switch, Route } from "wouter";
import { PrivateRoute } from "@/components/auth/private-route";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/layout/header";
import LoginLanding from "@/pages/login-landing";
import Dashboard from "@/pages/dashboard";
import Records from "@/pages/records";
import Jobs from "@/pages/jobs";
import Duplicates from "@/pages/duplicates";
import Analytics from "@/pages/analytics";
import CRM from "@/pages/crm";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import AdminUsers from "@/pages/admin-users";
import Forgot from "@/pages/forgot";
import Reset from "@/pages/reset";
import TwoFA from "@/pages/2fa";
import Fallback2FA from "@/pages/2fa-fallback";
import AccountSecurity from "@/pages/account-security";
import Devices from "@/pages/devices";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={LoginLanding} />
      <Route path="/login" component={Login} />
      <Route path="/forgot" component={Forgot} />
      <Route path="/reset" component={Reset} />
      <Route path="/2fa" component={TwoFA} />
      <Route path="/2fa-fallback" component={Fallback2FA} />
      
      {/* Protected routes */}
      <Route path="/dashboard" >
        <PrivateRoute><Dashboard /></PrivateRoute>
      </Route>
      <Route path="/records" >
        <PrivateRoute><Records /></PrivateRoute>
      </Route>
      <Route path="/jobs" >
        <PrivateRoute><Jobs /></PrivateRoute>
      </Route>
      <Route path="/duplicates" >
        <PrivateRoute><Duplicates /></PrivateRoute>
      </Route>
      <Route path="/analytics" >
        <PrivateRoute><Analytics /></PrivateRoute>
      </Route>
      <Route path="/crm" >
        <PrivateRoute><CRM /></PrivateRoute>
      </Route>
      <Route path="/account/security" >
        <PrivateRoute><AccountSecurity /></PrivateRoute>
      </Route>
      <Route path="/account/devices" >
        <PrivateRoute><Devices /></PrivateRoute>
      </Route>
      <Route path="/admin/users" >
        <PrivateRoute><AdminUsers /></PrivateRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <Header />
          <Router />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
