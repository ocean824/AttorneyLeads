import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Smartphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TrustedDevice {
  id: string;
  label: string;
  expiresAt: string;
  lastUsedAt: string;
  createdAt: string;
}

export default function DevicesPage() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ devices: TrustedDevice[] }>({
    queryKey: ["/api/auth/trusted-devices"],
  });

  const revokeMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      await apiRequest("DELETE", `/api/auth/trusted-devices/${deviceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/trusted-devices"] });
      toast({
        title: "Device revoked",
        description: "This device will require 2FA verification on next login.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke device",
        variant: "destructive",
      });
    },
  });

  const devices = data?.devices || [];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
          Trusted Devices
        </h1>
        <p className="text-muted-foreground">
          Manage devices that can skip 2FA verification. Trusted devices remain valid for 30 days from last use.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : devices.length === 0 ? (
        <Card data-testid="card-no-devices">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Smartphone className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No trusted devices</h3>
              <p className="text-muted-foreground">
                When you enable "Trust this device" during 2FA verification, it will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {devices.map((device) => (
            <Card key={device.id} data-testid={`card-device-${device.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg" data-testid={`text-device-label-${device.id}`}>
                        {device.label}
                      </CardTitle>
                      <CardDescription>
                        <div className="space-y-1 mt-1">
                          <div data-testid={`text-device-created-${device.id}`}>
                            Added {formatDistanceToNow(new Date(device.createdAt), { addSuffix: true })}
                          </div>
                          <div data-testid={`text-device-lastused-${device.id}`}>
                            Last used {formatDistanceToNow(new Date(device.lastUsedAt), { addSuffix: true })}
                          </div>
                          <div data-testid={`text-device-expires-${device.id}`}>
                            Expires {formatDistanceToNow(new Date(device.expiresAt), { addSuffix: true })}
                          </div>
                        </div>
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => revokeMutation.mutate(device.id)}
                    disabled={revokeMutation.isPending}
                    data-testid={`button-revoke-${device.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
