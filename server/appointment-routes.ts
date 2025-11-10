import { Router } from "express";
import { storage } from "./storage";
import { insertAppointmentSlotSchema, insertAppointmentBookingSchema } from "@shared/schema";
import { z } from "zod";

export const appointmentRouter = Router();

// Public: Get available appointment slots for a specific date
appointmentRouter.get("/availability", async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date || typeof date !== "string") {
      return res.status(400).json({ error: "Date parameter is required (YYYY-MM-DD format)" });
    }

    // Parse the date to get day of week (0=Sunday, 6=Saturday)
    const targetDate = new Date(date + "T00:00:00");
    const dayOfWeek = targetDate.getDay();

    // Get all active slots for this day of week
    const slots = await storage.getAppointmentSlots({ isActive: true, dayOfWeek });

    // For each slot, calculate available time slots and check booking counts
    const availableSlots = await Promise.all(
      slots.map(async (slot) => {
        // Get current booking count for this slot and date
        const bookingCount = await storage.getBookingCountForSlot(slot.id, date);
        const isAvailable = bookingCount < slot.maxBookings;

        return {
          id: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          duration: slot.duration,
          timezone: slot.timezone,
          available: isAvailable,
          remainingSlots: Math.max(0, slot.maxBookings - bookingCount),
        };
      })
    );

    // Filter to only show available slots
    const filteredSlots = availableSlots.filter((slot) => slot.available);

    res.json({ 
      date, 
      dayOfWeek,
      slots: filteredSlots,
    });
  } catch (error) {
    console.error("Error fetching availability:", error);
    res.status(500).json({ error: "Failed to fetch availability" });
  }
});

// Public: Book an appointment
appointmentRouter.post("/book", async (req, res) => {
  try {
    const bookingData = insertAppointmentBookingSchema.parse(req.body);

    // Validate the slot exists and is active
    const slot = await storage.getAppointmentSlot(bookingData.slotId!);
    if (!slot) {
      return res.status(404).json({ error: "Appointment slot not found" });
    }
    if (slot.isActive !== 1) {
      return res.status(400).json({ error: "Appointment slot is not active" });
    }

    // Check if the slot is still available
    const bookingCount = await storage.getBookingCountForSlot(
      bookingData.slotId!,
      bookingData.appointmentDate
    );
    
    if (bookingCount >= slot.maxBookings) {
      return res.status(409).json({ error: "This time slot is fully booked" });
    }

    // Create the booking
    const booking = await storage.createAppointmentBooking(bookingData);

    res.status(201).json({ 
      success: true,
      booking,
      message: "Appointment booked successfully"
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid booking data", details: error.errors });
    }
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// Admin: Get all bookings with optional filters
appointmentRouter.get("/bookings", async (req, res) => {
  try {
    const { status, appointmentDate } = req.query;
    
    const filters: { status?: string; appointmentDate?: string } = {};
    if (status && typeof status === "string") {
      filters.status = status;
    }
    if (appointmentDate && typeof appointmentDate === "string") {
      filters.appointmentDate = appointmentDate;
    }

    const bookings = await storage.getAppointmentBookings(filters);
    res.json({ bookings });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// Admin: Update booking status
appointmentRouter.patch("/bookings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = await storage.updateAppointmentBooking(id, updates);
    
    if (!updated) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json({ booking: updated });
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({ error: "Failed to update booking" });
  }
});

// Admin: Get all appointment slots
appointmentRouter.get("/admin/slots", async (req, res) => {
  try {
    const { isActive, dayOfWeek } = req.query;
    
    const filters: { isActive?: boolean; dayOfWeek?: number } = {};
    if (isActive !== undefined) {
      filters.isActive = isActive === "true";
    }
    if (dayOfWeek !== undefined && typeof dayOfWeek === "string") {
      filters.dayOfWeek = parseInt(dayOfWeek, 10);
    }

    const slots = await storage.getAppointmentSlots(filters);
    res.json({ slots });
  } catch (error) {
    console.error("Error fetching slots:", error);
    res.status(500).json({ error: "Failed to fetch slots" });
  }
});

// Admin: Create a new appointment slot
appointmentRouter.post("/admin/slots", async (req, res) => {
  try {
    const slotData = insertAppointmentSlotSchema.parse(req.body);
    const slot = await storage.createAppointmentSlot(slotData);
    res.status(201).json({ slot });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid slot data", details: error.errors });
    }
    console.error("Error creating slot:", error);
    res.status(500).json({ error: "Failed to create slot" });
  }
});

// Admin: Update an appointment slot
appointmentRouter.put("/admin/slots/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = await storage.updateAppointmentSlot(id, updates);
    
    if (!updated) {
      return res.status(404).json({ error: "Slot not found" });
    }

    res.json({ slot: updated });
  } catch (error) {
    console.error("Error updating slot:", error);
    res.status(500).json({ error: "Failed to update slot" });
  }
});

// Admin: Delete an appointment slot
appointmentRouter.delete("/admin/slots/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await storage.deleteAppointmentSlot(id);
    
    if (!deleted) {
      return res.status(404).json({ error: "Slot not found" });
    }

    res.json({ success: true, message: "Slot deleted successfully" });
  } catch (error) {
    console.error("Error deleting slot:", error);
    res.status(500).json({ error: "Failed to delete slot" });
  }
});
