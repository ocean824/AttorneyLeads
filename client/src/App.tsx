import { Switch, Route } from "wouter";
import { PrivateRoute } from "@/components/auth/private-route";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/layout/header";
import Dashboard from "@/pages/dashboard";
import Records from "@/pages/records";
import Jobs from "@/pages/jobs";
import Duplicates from "@/pages/duplicates";
import Analytics from "@/pages/analytics";
import CRM from "@/pages/crm";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import AdminUsers from "@/pages/admin-users";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" >
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
