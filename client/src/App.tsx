import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import RehashOptimizerPage from '@/pages/rehash-optimizer';

function Router() {
  return (
    <Switch>
      <Route path="/" element={<Home} / />}
      <Route element={N<otFound} / />}
              <Route path="/rehash-optimizer" element={<RehashOptimizerPage} / />}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
