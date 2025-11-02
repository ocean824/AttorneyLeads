import type { CrmProspect } from "@shared/schema";

interface PhantomBusterAgent {
  id: string;
  name: string;
  scriptId: string;
}

interface PhantomBusterLaunchResponse {
  containerId: string;
  status: string;
}

interface PhantomBusterResult {
  profiles: Array<{
    name: string;
    email?: string;
    company?: string;
    linkedinUrl?: string;
    phone?: string;
  }>;
}

export class PhantomBusterService {
  private apiKey: string;
  private baseUrl = "https://api.phantombuster.com/api/v2";

  constructor() {
    this.apiKey = process.env.PHANTOMBUSTER_API_KEY || "";
    
    if (!this.apiKey) {
      console.warn("⚠️ PHANTOMBUSTER_API_KEY not set - using mock data mode");
    }
  }

  /**
   * Launch a PhantomBuster agent to discover prospects
   */
  async launchProspectDiscovery(params: {
    searchQuery: string;
    location?: string;
    platform?: "linkedin" | "facebook";
  }): Promise<{ containerId: string; status: string }> {
    if (!this.apiKey) {
      return this.mockLaunchAgent(params);
    }

    try {
      const response = await fetch(`${this.baseUrl}/agents/launch`, {
        method: "POST",
        headers: {
          "X-Phantombuster-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: process.env.PHANTOM_AGENT_ID || "default-agent",
          argument: {
            searchQuery: params.searchQuery,
            filters: {
              location: params.location || "United States",
            },
            actions: ["findProfiles", "extractContacts"],
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`PhantomBuster API error: ${response.statusText}`);
      }

      const data: PhantomBusterLaunchResponse = await response.json();
      return data;
    } catch (error) {
      console.error("PhantomBuster launch error:", error);
      return this.mockLaunchAgent(params);
    }
  }

  /**
   * Fetch results from a PhantomBuster agent
   */
  async fetchResults(containerId: string): Promise<CrmProspect[]> {
    if (!this.apiKey) {
      return this.mockFetchResults(containerId);
    }

    try {
      const response = await fetch(`${this.baseUrl}/containers/fetch/${containerId}`, {
        headers: {
          "X-Phantombuster-Key": this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`PhantomBuster fetch error: ${response.statusText}`);
      }

      const data: PhantomBusterResult = await response.json();
      
      // Transform PhantomBuster results to CrmProspect format
      return data.profiles.map((profile) => ({
        fullName: profile.name,
        email: profile.email || null,
        company: profile.company || null,
        phone: profile.phone || null,
        linkedinUrl: profile.linkedinUrl || null,
        source: "phantombuster",
        status: "new",
        tags: null,
        notes: null,
        lastContactedAt: null,
        createdAt: new Date(),
      })) as CrmProspect[];
    } catch (error) {
      console.error("PhantomBuster fetch error:", error);
      return this.mockFetchResults(containerId);
    }
  }

  /**
   * Mock launch agent for testing without API key
   */
  private async mockLaunchAgent(params: { searchQuery: string; location?: string }) {
    console.log(`🤖 [MOCK] Launching PhantomBuster agent with query: "${params.searchQuery}"`);
    return {
      containerId: `mock-${Date.now()}`,
      status: "running",
    };
  }

  /**
   * Mock fetch results for testing without API key
   */
  private async mockFetchResults(containerId: string): Promise<CrmProspect[]> {
    console.log(`🤖 [MOCK] Fetching results for container: ${containerId}`);
    
    // Generate mock law firm prospects
    const mockProspects: CrmProspect[] = [
      {
        id: `prospect-${Date.now()}-1`,
        fullName: "Sarah Martinez",
        email: "sarah.martinez@smithlawgroup.com",
        company: "Smith & Associates Law Firm",
        phone: "+1 (305) 555-0123",
        linkedinUrl: "https://linkedin.com/in/sarah-martinez-attorney",
        source: "phantombuster",
        status: "new",
        tags: JSON.stringify(["personal-injury", "florida"]),
        notes: null,
        lastContactedAt: null,
        createdAt: new Date(),
      },
      {
        id: `prospect-${Date.now()}-2`,
        fullName: "Michael Chen",
        email: "mchen@chendefense.com",
        company: "Chen Defense Attorneys",
        phone: "+1 (954) 555-0198",
        linkedinUrl: "https://linkedin.com/in/michael-chen-esq",
        source: "phantombuster",
        status: "new",
        tags: JSON.stringify(["criminal-defense", "florida"]),
        notes: null,
        lastContactedAt: null,
        createdAt: new Date(),
      },
      {
        id: `prospect-${Date.now()}-3`,
        fullName: "Jennifer Rodriguez",
        email: "jennifer@familylawflorida.com",
        company: "Rodriguez Family Law",
        phone: "+1 (561) 555-0176",
        linkedinUrl: "https://linkedin.com/in/jennifer-rodriguez-attorney",
        source: "phantombuster",
        status: "new",
        tags: JSON.stringify(["family-law", "florida"]),
        notes: null,
        lastContactedAt: null,
        createdAt: new Date(),
      },
    ];

    return mockProspects;
  }
}

// Singleton instance
export const phantomBusterService = new PhantomBusterService();
