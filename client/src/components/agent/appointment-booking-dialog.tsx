import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { formatDate } from "date-fns";

interface AppointmentBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId?: string | null;
  arrestRecordId?: string | null;
}

interface AvailableSlot {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
  timezone: string;
  available: boolean;
  remainingSlots: number;
}

export function AppointmentBookingDialog({
  open,
  onOpenChange,
  sessionId,
  arrestRecordId,
}: AppointmentBookingDialogProps) {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [userTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "America/New_York";
    }
  });

  const { data: availabilityData, isLoading: availabilityLoading } = useQuery<{
    date: string;
    dayOfWeek: number;
    slots: AvailableSlot[];
  }>({
    queryKey: ["/api/appointments/availability", selectedDate],
    enabled: open && !!selectedDate,
  });

  const bookingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/appointments/book", data);
      return response;
    },
    onSuccess: () => {
      setBookingComplete(true);
      toast({
        title: "Appointment Booked!",
        description: "Your appointment has been confirmed. We'll send you a reminder.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to book appointment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSlot) {
      toast({
        title: "No Slot Selected",
        description: "Please select an available time slot",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData(e.currentTarget);
    
    bookingMutation.mutate({
      slotId: selectedSlot.id,
      appointmentDate: selectedDate,
      appointmentTime: formData.get("appointmentTime") as string,
      visitorName: formData.get("visitorName") as string,
      visitorEmail: formData.get("visitorEmail") as string,
      visitorPhone: formData.get("visitorPhone") as string || undefined,
      visitorTimezone: userTimezone,
      caseType: formData.get("caseType") as string || undefined,
      notes: formData.get("notes") as string || undefined,
      sessionId: sessionId || undefined,
      arrestRecordId: arrestRecordId || undefined,
    });
  };

  const handleClose = () => {
    setBookingComplete(false);
    setSelectedSlot(null);
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) {
      setBookingComplete(false);
      setSelectedSlot(null);
    }
  }, [open]);

  const availableSlots = availabilityData?.slots || [];
  const hasAvailability = availableSlots.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-appointment-booking">
        {bookingComplete ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <DialogTitle>Appointment Confirmed!</DialogTitle>
              </div>
              <DialogDescription>
                Your appointment has been successfully scheduled.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Card className="p-4 bg-muted">
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-semibold">Date:</span> {selectedDate}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Time:</span> {selectedSlot?.startTime} ({userTimezone})
                  </p>
                  {sessionId && (
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        Linked to chat session
                      </Badge>
                    </div>
                  )}
                </div>
              </Card>
              <p className="text-sm text-muted-foreground">
                A confirmation has been recorded. We'll send you a reminder before your appointment.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose} data-testid="button-close-confirmation">
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Schedule an Appointment
              </DialogTitle>
              <DialogDescription>
                Select a date and time that works for you. Timezone: {userTimezone}
              </DialogDescription>
              {sessionId && (
                <Badge variant="secondary" className="w-fit" data-testid="badge-linked-session">
                  Linked to current chat session
                </Badge>
              )}
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="appointmentDate">Date</Label>
                  <Input
                    id="appointmentDate"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedSlot(null);
                    }}
                    min={new Date().toISOString().split("T")[0]}
                    required
                    data-testid="input-appointment-date"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Available Time Slots</Label>
                  {availabilityLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading availability...
                    </div>
                  ) : !hasAvailability ? (
                    <p className="text-sm text-muted-foreground">
                      No available slots for this date. Please select another date.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2" data-testid="grid-time-slots">
                      {availableSlots.map((slot) => (
                        <Button
                          key={slot.id}
                          type="button"
                          variant={selectedSlot?.id === slot.id ? "default" : "outline"}
                          onClick={() => setSelectedSlot(slot)}
                          className="flex items-center gap-2"
                          data-testid={`button-slot-${slot.id}`}
                        >
                          <Clock className="h-3 w-3" />
                          {slot.startTime}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedSlot && (
                  <>
                    <input
                      type="hidden"
                      name="appointmentTime"
                      value={selectedSlot.startTime}
                    />

                    <div className="space-y-4 pt-4 border-t">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="visitorName">Full Name *</Label>
                          <Input
                            id="visitorName"
                            name="visitorName"
                            placeholder="John Doe"
                            required
                            data-testid="input-visitor-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="visitorEmail">Email *</Label>
                          <Input
                            id="visitorEmail"
                            name="visitorEmail"
                            type="email"
                            placeholder="john@example.com"
                            required
                            data-testid="input-visitor-email"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="visitorPhone">Phone (Optional)</Label>
                          <Input
                            id="visitorPhone"
                            name="visitorPhone"
                            type="tel"
                            placeholder="(555) 123-4567"
                            data-testid="input-visitor-phone"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="caseType">Case Type (Optional)</Label>
                          <Select name="caseType">
                            <SelectTrigger data-testid="select-case-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DUI">DUI</SelectItem>
                              <SelectItem value="Traffic">Traffic</SelectItem>
                              <SelectItem value="Criminal">Criminal Defense</SelectItem>
                              <SelectItem value="Consultation">General Consultation</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes">Additional Notes (Optional)</Label>
                        <Textarea
                          id="notes"
                          name="notes"
                          placeholder="Any additional information we should know..."
                          rows={3}
                          data-testid="input-notes"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  data-testid="button-cancel-booking"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!selectedSlot || bookingMutation.isPending}
                  data-testid="button-confirm-booking"
                >
                  {bookingMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Booking...
                    </>
                  ) : (
                    "Confirm Booking"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
