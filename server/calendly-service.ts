import type { ScheduledMeeting } from "@shared/schema";

interface CalendlyEventType {
  uri: string;
  name: string;
  scheduling_url: string;
}

interface CalendlyScheduledEvent {
  uri: string;
  name: string;
  start_time: string;
  end_time: string;
  location: {
    type: string;
    join_url?: string;
  };
  invitees_counter: {
    total: number;
  };
}

export class CalendlyService {
  private apiKey: string;
  private baseUrl = "https://api.calendly.com";
  private userUri: string;

  constructor() {
    this.apiKey = process.env.CALENDLY_API_KEY || "";
    this.userUri = process.env.CALENDLY_USER_URI || "";
    
    if (!this.apiKey) {
      console.warn("⚠️ CALENDLY_API_KEY not set - using mock data mode");
    }
  }

  /**
   * Get available event types (e.g., Demo Call, Consultation)
   */
  async getEventTypes(): Promise<CalendlyEventType[]> {
    if (!this.apiKey || !this.userUri) {
      return this.mockGetEventTypes();
    }

    try {
      const response = await fetch(`${this.baseUrl}/event_types?user=${this.userUri}`, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Calendly API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.collection || [];
    } catch (error) {
      console.error("Calendly get event types error:", error);
      return this.mockGetEventTypes();
    }
  }

  /**
   * Create a scheduling link for a prospect
   */
  async createSchedulingLink(params: {
    prospectEmail: string;
    prospectName: string;
    eventType?: string;
  }): Promise<{ schedulingUrl: string }> {
    if (!this.apiKey || !this.userUri) {
      return this.mockCreateSchedulingLink(params);
    }

    try {
      const eventTypes = await this.getEventTypes();
      const eventType = eventTypes.find(et => 
        et.name.toLowerCase().includes(params.eventType?.toLowerCase() || "demo")
      ) || eventTypes[0];

      if (!eventType) {
        throw new Error("No event types found");
      }

      // Generate a personalized scheduling link
      const schedulingUrl = `${eventType.scheduling_url}?name=${encodeURIComponent(params.prospectName)}&email=${encodeURIComponent(params.prospectEmail)}`;

      return { schedulingUrl };
    } catch (error) {
      console.error("Calendly create scheduling link error:", error);
      return this.mockCreateSchedulingLink(params);
    }
  }

  /**
   * Get scheduled events
   */
  async getScheduledEvents(params?: {
    minStartTime?: string;
    maxStartTime?: string;
  }): Promise<ScheduledMeeting[]> {
    if (!this.apiKey || !this.userUri) {
      return this.mockGetScheduledEvents();
    }

    try {
      const queryParams = new URLSearchParams({
        user: this.userUri,
        ...(params?.minStartTime && { min_start_time: params.minStartTime }),
        ...(params?.maxStartTime && { max_start_time: params.maxStartTime }),
      });

      const response = await fetch(`${this.baseUrl}/scheduled_events?${queryParams}`, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Calendly API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform Calendly events to ScheduledMeeting format
      return (data.collection || []).map((event: CalendlyScheduledEvent) => ({
        prospectId: null,
        prospectEmail: "unknown@example.com", // Would need to fetch invitee details
        prospectName: event.name || "Unknown",
        meetingType: "demo",
        calendlyEventUri: event.uri,
        scheduledAt: new Date(event.start_time),
        status: "scheduled",
        meetingUrl: event.location?.join_url || null,
        notes: null,
        createdAt: new Date(),
      })) as ScheduledMeeting[];
    } catch (error) {
      console.error("Calendly get scheduled events error:", error);
      return this.mockGetScheduledEvents();
    }
  }

  /**
   * Cancel a scheduled event
   */
  async cancelEvent(eventUri: string, reason?: string): Promise<{ success: boolean }> {
    if (!this.apiKey) {
      return this.mockCancelEvent(eventUri);
    }

    try {
      const response = await fetch(`${this.baseUrl}/scheduled_events/${eventUri}/cancellation`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: reason || "Cancelled by host",
        }),
      });

      if (!response.ok) {
        throw new Error(`Calendly API error: ${response.statusText}`);
      }

      return { success: true };
    } catch (error) {
      console.error("Calendly cancel event error:", error);
      return { success: false };
    }
  }

  /**
   * Mock methods for testing without API key
   */
  private mockGetEventTypes(): CalendlyEventType[] {
    return [
      {
        uri: "https://api.calendly.com/event_types/mock-demo",
        name: "Demo Call - 30 Minutes",
        scheduling_url: "https://calendly.com/mock-user/demo",
      },
      {
        uri: "https://api.calendly.com/event_types/mock-consultation",
        name: "Consultation - 15 Minutes",
        scheduling_url: "https://calendly.com/mock-user/consultation",
      },
    ];
  }

  private mockCreateSchedulingLink(params: { prospectEmail: string; prospectName: string }) {
    console.log(`📅 [MOCK] Creating scheduling link for ${params.prospectName} (${params.prospectEmail})`);
    return {
      schedulingUrl: `https://calendly.com/mock-user/demo?name=${encodeURIComponent(params.prospectName)}&email=${encodeURIComponent(params.prospectEmail)}`,
    };
  }

  private mockGetScheduledEvents(): ScheduledMeeting[] {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return [
      {
        id: `meeting-${Date.now()}-1`,
        prospectId: null,
        prospectEmail: "sarah.martinez@smithlawgroup.com",
        prospectName: "Sarah Martinez",
        meetingType: "demo",
        calendlyEventUri: "https://api.calendly.com/scheduled_events/mock-1",
        scheduledAt: tomorrow,
        status: "scheduled",
        meetingUrl: "https://zoom.us/j/123456789",
        notes: null,
        createdAt: now,
      },
      {
        id: `meeting-${Date.now()}-2`,
        prospectId: null,
        prospectEmail: "mchen@chendefense.com",
        prospectName: "Michael Chen",
        meetingType: "consultation",
        calendlyEventUri: "https://api.calendly.com/scheduled_events/mock-2",
        scheduledAt: nextWeek,
        status: "scheduled",
        meetingUrl: "https://meet.google.com/abc-defg-hij",
        notes: null,
        createdAt: now,
      },
    ] as ScheduledMeeting[];
  }

  private mockCancelEvent(eventUri: string) {
    console.log(`📅 [MOCK] Cancelling event: ${eventUri}`);
    return { success: true };
  }
}

// Singleton instance
export const calendlyService = new CalendlyService();
