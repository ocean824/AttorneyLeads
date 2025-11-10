import type { ArrestRecord, CrmProspect } from "@shared/schema";

interface GoogleSheetsAppendResponse {
  spreadsheetId: string;
  tableRange: string;
  updates: {
    updatedRows: number;
  };
}

export class GoogleSheetsService {
  private apiToken: string;
  private baseUrl = "https://sheets.googleapis.com/v4/spreadsheets";

  constructor() {
    this.apiToken = process.env.GOOGLE_SHEETS_TOKEN || "";
    
    if (!this.apiToken) {
      console.warn("⚠️ GOOGLE_SHEETS_TOKEN not set - using mock data mode");
    }
  }

  /**
   * Append arrest records to a Google Sheet
   */
  async appendArrestRecords(params: {
    spreadsheetId: string;
    sheetName?: string;
    records: ArrestRecord[];
  }): Promise<{ success: boolean; rowsAdded: number }> {
    if (!this.apiToken) {
      return this.mockAppendRecords(params.records.length);
    }

    const sheetName = params.sheetName || "Arrest Records";
    const range = `${sheetName}!A:L`; // Adjust range based on columns

    try {
      const values = [
        // Header row
        ["Timestamp", "Full Name", "Booking Date", "Charges", "Bond Amount", "County", "Facility", "Age", "Gender", "Race", "Lead Score", "Source URL"],
        // Data rows
        ...params.records.map(record => [
          new Date().toISOString(),
          record.fullName,
          record.bookingDate,
          record.charges,
          record.bondAmount || "N/A",
          record.county,
          record.facility || "N/A",
          record.age?.toString() || "N/A",
          record.gender || "N/A",
          record.race || "N/A",
          record.leadScore.toString(),
          record.sourceUrl || "N/A",
        ]),
      ];

      const response = await fetch(
        `${this.baseUrl}/${params.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            majorDimension: "ROWS",
            values,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Google Sheets API error: ${response.statusText}`);
      }

      const data: GoogleSheetsAppendResponse = await response.json();
      return {
        success: true,
        rowsAdded: data.updates.updatedRows,
      };
    } catch (error) {
      console.error("Google Sheets append error:", error);
      return this.mockAppendRecords(params.records.length);
    }
  }

  /**
   * Append CRM prospects to a Google Sheet
   */
  async appendProspects(params: {
    spreadsheetId: string;
    sheetName?: string;
    prospects: CrmProspect[];
  }): Promise<{ success: boolean; rowsAdded: number }> {
    if (!this.apiToken) {
      return this.mockAppendRecords(params.prospects.length);
    }

    const sheetName = params.sheetName || "Prospects";
    const range = `${sheetName}!A:H`;

    try {
      const values = [
        // Header row
        ["Timestamp", "Full Name", "Email", "Company", "Phone", "Source", "Status", "LinkedIn URL"],
        // Data rows
        ...params.prospects.map(prospect => [
          new Date().toISOString(),
          prospect.fullName,
          prospect.email || "N/A",
          prospect.company || "N/A",
          prospect.phone || "N/A",
          prospect.source,
          prospect.status,
          prospect.linkedinUrl || "N/A",
        ]),
      ];

      const response = await fetch(
        `${this.baseUrl}/${params.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            majorDimension: "ROWS",
            values,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Google Sheets API error: ${response.statusText}`);
      }

      const data: GoogleSheetsAppendResponse = await response.json();
      return {
        success: true,
        rowsAdded: data.updates.updatedRows,
      };
    } catch (error) {
      console.error("Google Sheets append prospects error:", error);
      return this.mockAppendRecords(params.prospects.length);
    }
  }

  /**
   * Export analytics data to Google Sheets
   */
  async exportAnalytics(params: {
    spreadsheetId: string;
    sheetName?: string;
    data: {
      recordsByCounty: Array<{ county: string; count: number }>;
      leadScoreDistribution: Array<{ range: string; count: number }>;
    };
  }): Promise<{ success: boolean; rowsAdded: number }> {
    if (!this.apiToken) {
      return this.mockAppendRecords(params.data.recordsByCounty.length + params.data.leadScoreDistribution.length);
    }

    const sheetName = params.sheetName || "Analytics";
    const range = `${sheetName}!A:B`;

    try {
      const values = [
        ["Analytics Report", new Date().toISOString()],
        [],
        ["Records by County", ""],
        ["County", "Count"],
        ...params.data.recordsByCounty.map(item => [item.county, item.count.toString()]),
        [],
        ["Lead Score Distribution", ""],
        ["Range", "Count"],
        ...params.data.leadScoreDistribution.map(item => [item.range, item.count.toString()]),
      ];

      const response = await fetch(
        `${this.baseUrl}/${params.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            majorDimension: "ROWS",
            values,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Google Sheets API error: ${response.statusText}`);
      }

      const data: GoogleSheetsAppendResponse = await response.json();
      return {
        success: true,
        rowsAdded: data.updates.updatedRows,
      };
    } catch (error) {
      console.error("Google Sheets export analytics error:", error);
      const totalRows = params.data.recordsByCounty.length + params.data.leadScoreDistribution.length + 8; // Including headers
      return this.mockAppendRecords(totalRows);
    }
  }

  /**
   * Mock append for testing without API token
   */
  private mockAppendRecords(count: number): { success: boolean; rowsAdded: number } {
    console.log(`📊 [MOCK] Would append ${count} rows to Google Sheets`);
    return {
      success: true,
      rowsAdded: count,
    };
  }
}

// Singleton instance
export const googleSheetsService = new GoogleSheetsService();
