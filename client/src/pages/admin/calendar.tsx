import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Calendar, Clock } from "lucide-react";
import type { AppointmentSlot, AppointmentBooking } from "@shared/schema";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

export default function AdminCalendar() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<AppointmentSlot | null>(null);

  const { data: slotsData, isLoading: slotsLoading } = useQuery<{ slots: AppointmentSlot[] }>({
    queryKey: ["/api/appointments/admin/slots"],
  });

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery<{ bookings: AppointmentBooking[] }>({
    queryKey: ["/api/appointments/bookings"],
  });

  const createSlotMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/appointments/admin/slots", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/admin/slots"] });
      setIsCreateOpen(false);
      toast({
        title: "Success",
        description: "Appointment slot created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create slot",
        variant: "destructive",
      });
    },
  });

  const updateSlotMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/appointments/admin/slots/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/admin/slots"] });
      setEditingSlot(null);
      toast({
        title: "Success",
        description: "Appointment slot updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update slot",
        variant: "destructive",
      });
    },
  });

  const deleteSlotMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/appointments/admin/slots/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/admin/slots"] });
      toast({
        title: "Success",
        description: "Appointment slot deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete slot",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      dayOfWeek: parseInt(formData.get("dayOfWeek") as string),
      startTime: formData.get("startTime") as string,
      endTime: formData.get("endTime") as string,
      duration: parseInt(formData.get("duration") as string),
      timezone: formData.get("timezone") as string,
      isActive: formData.get("isActive") === "on" ? 1 : 0,
      maxBookings: parseInt(formData.get("maxBookings") as string),
    };

    if (editingSlot) {
      updateSlotMutation.mutate({ id: editingSlot.id, data });
    } else {
      createSlotMutation.mutate(data);
    }
  };

  const slots = slotsData?.slots || [];
  const bookings = bookingsData?.bookings || [];

  const slotsByDay = DAYS_OF_WEEK.map((day) => ({
    ...day,
    slots: slots.filter((slot) => slot.dayOfWeek === day.value),
  }));

  const upcomingBookings = bookings.filter(
    (booking) => booking.status === "confirmed" && new Date(booking.appointmentDate) >= new Date()
  ).slice(0, 10);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-admin-calendar-title">Appointment Calendar Management</h1>
          <p className="text-muted-foreground">Configure availability and manage bookings</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-slot">
              <Plus className="mr-2 h-4 w-4" />
              Create Slot
            </Button>
          </DialogTrigger>
          <SlotFormDialog
            onSubmit={handleSubmit}
            isPending={createSlotMutation.isPending}
            onCancel={() => setIsCreateOpen(false)}
          />
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Availability</CardTitle>
              <CardDescription>Manage appointment slots for each day of the week</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {slotsLoading ? (
                <p className="text-muted-foreground">Loading slots...</p>
              ) : (
                slotsByDay.map((day) => (
                  <div key={day.value} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm" data-testid={`text-day-${day.value}`}>{day.label}</h3>
                      <Badge variant="outline" data-testid={`badge-slot-count-${day.value}`}>
                        {day.slots.length} {day.slots.length === 1 ? "slot" : "slots"}
                      </Badge>
                    </div>
                    
                    {day.slots.length === 0 ? (
                      <p className="text-sm text-muted-foreground pl-4">No slots configured</p>
                    ) : (
                      <div className="space-y-2 pl-4">
                        {day.slots.map((slot) => (
                          <Card key={slot.id} className="p-3" data-testid={`card-slot-${slot.id}`}>
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium" data-testid={`text-slot-time-${slot.id}`}>
                                    {slot.startTime} - {slot.endTime}
                                  </span>
                                  <Badge variant={slot.isActive === 1 ? "default" : "secondary"} data-testid={`badge-slot-status-${slot.id}`}>
                                    {slot.isActive === 1 ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {slot.duration} min slots • Max {slot.maxBookings} booking{slot.maxBookings > 1 ? "s" : ""} • {slot.timezone}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Dialog open={editingSlot?.id === slot.id} onOpenChange={(open) => !open && setEditingSlot(null)}>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setEditingSlot(slot)}
                                      data-testid={`button-edit-slot-${slot.id}`}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <SlotFormDialog
                                    slot={slot}
                                    onSubmit={handleSubmit}
                                    isPending={updateSlotMutation.isPending}
                                    onCancel={() => setEditingSlot(null)}
                                  />
                                </Dialog>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm("Are you sure you want to delete this slot?")) {
                                      deleteSlotMutation.mutate(slot.id);
                                    }
                                  }}
                                  data-testid={`button-delete-slot-${slot.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Bookings
              </CardTitle>
              <CardDescription>Next {upcomingBookings.length} confirmed appointments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {bookingsLoading ? (
                <p className="text-sm text-muted-foreground">Loading bookings...</p>
              ) : upcomingBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming bookings</p>
              ) : (
                upcomingBookings.map((booking) => (
                  <Card key={booking.id} className="p-3" data-testid={`card-booking-${booking.id}`}>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm" data-testid={`text-booking-name-${booking.id}`}>
                          {booking.visitorName}
                        </span>
                        <Badge variant="outline" data-testid={`badge-booking-status-${booking.id}`}>
                          {booking.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {booking.appointmentDate} at {booking.appointmentTime}
                      </p>
                      {booking.caseType && (
                        <Badge variant="secondary" className="text-xs">
                          {booking.caseType}
                        </Badge>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SlotFormDialog({
  slot,
  onSubmit,
  isPending,
  onCancel,
}: {
  slot?: AppointmentSlot;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  return (
    <DialogContent data-testid="dialog-slot-form">
      <DialogHeader>
        <DialogTitle>{slot ? "Edit Appointment Slot" : "Create Appointment Slot"}</DialogTitle>
        <DialogDescription>
          Configure the time slot availability for appointments
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dayOfWeek">Day of Week</Label>
            <Select name="dayOfWeek" defaultValue={slot?.dayOfWeek?.toString() || "1"}>
              <SelectTrigger data-testid="select-day-of-week">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((day) => (
                  <SelectItem key={day.value} value={day.value.toString()}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                defaultValue={slot?.startTime || "09:00"}
                required
                data-testid="input-start-time"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                name="endTime"
                type="time"
                defaultValue={slot?.endTime || "17:00"}
                required
                data-testid="input-end-time"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                name="duration"
                type="number"
                defaultValue={slot?.duration || 30}
                min={15}
                step={15}
                required
                data-testid="input-duration"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxBookings">Max Bookings</Label>
              <Input
                id="maxBookings"
                name="maxBookings"
                type="number"
                defaultValue={slot?.maxBookings || 1}
                min={1}
                required
                data-testid="input-max-bookings"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select name="timezone" defaultValue={slot?.timezone || "America/New_York"}>
              <SelectTrigger data-testid="select-timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              name="isActive"
              defaultChecked={slot?.isActive === 1}
              data-testid="switch-is-active"
            />
            <Label htmlFor="isActive">Active</Label>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} data-testid="button-submit">
            {isPending ? "Saving..." : slot ? "Update Slot" : "Create Slot"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
