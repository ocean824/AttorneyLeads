import OpenAI from "openai";
import type { ArrestRecord } from "../shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface EnhancedRecord {
  confidenceScore: number;
  chargeCategories: string[];
  normalizedCharges: string;
  riskLevel: "low" | "medium" | "high";
}

interface ChargeClassification {
  category: string;
  type: string;
  severity: string;
}

export async function enhanceArrestRecord(record: ArrestRecord): Promise<EnhancedRecord> {
  try {
    const prompt = `Analyze this arrest record and provide structured enhancement data:

Record Details:
- Name: ${record.fullName}
- Charges: ${record.charges}
- Bond Amount: ${record.bondAmount || "Not specified"}
- County: ${record.county}
- Booking Date: ${record.bookingDate}

Please analyze and return ONLY a JSON object (no markdown, no code blocks) with:
{
  "confidenceScore": <0-100 integer based on data completeness and quality>,
  "chargeCategories": [<array of charge types like "felony", "misdemeanor", "violent", "property", "drug", "traffic">],
  "normalizedCharges": "<standardized charge description>",
  "riskLevel": "<low|medium|high based on charge severity>"
}

Scoring Guidelines:
- 90-100: Complete data, serious felony charges
- 70-89: Good data quality, moderate charges
- 50-69: Incomplete data or minor charges
- Below 50: Poor data quality

Risk Level Guidelines:
- High: Violent crimes, serious felonies, high bonds ($50k+)
- Medium: Non-violent felonies, moderate bonds ($5k-$50k)
- Low: Misdemeanors, low bonds (under $5k)`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a legal data analyst specializing in arrest record classification. Always respond with valid JSON only, no markdown formatting.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || "{}";
    
    // Remove markdown code blocks if present
    const jsonText = responseText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(jsonText);

    return {
      confidenceScore: Math.min(100, Math.max(0, parsed.confidenceScore || 50)),
      chargeCategories: Array.isArray(parsed.chargeCategories) ? parsed.chargeCategories : [],
      normalizedCharges: parsed.normalizedCharges || record.charges,
      riskLevel: ["low", "medium", "high"].includes(parsed.riskLevel) 
        ? parsed.riskLevel 
        : "medium",
    };
  } catch (error) {
    console.error("AI enhancement error:", error);
    
    // Fallback to basic categorization
    return {
      confidenceScore: 50,
      chargeCategories: categorizeCharges(record.charges),
      normalizedCharges: record.charges,
      riskLevel: assessRiskLevel(record.bondAmount),
    };
  }
}

// Fallback charge categorization (rule-based)
function categorizeCharges(charges: string): string[] {
  const categories: string[] = [];
  const lowerCharges = charges.toLowerCase();

  if (lowerCharges.includes("felony")) categories.push("felony");
  if (lowerCharges.includes("misdemeanor")) categories.push("misdemeanor");
  
  if (lowerCharges.match(/assault|battery|murder|robbery|weapon/)) {
    categories.push("violent");
  }
  if (lowerCharges.match(/theft|burglary|fraud|forgery/)) {
    categories.push("property");
  }
  if (lowerCharges.match(/drug|narcotic|controlled substance|marijuana|cocaine/)) {
    categories.push("drug");
  }
  if (lowerCharges.match(/dui|dwi|traffic|driving/)) {
    categories.push("traffic");
  }

  return categories.length > 0 ? categories : ["other"];
}

// Fallback risk assessment based on bond amount
function assessRiskLevel(bondAmount: string | null): "low" | "medium" | "high" {
  if (!bondAmount) return "medium";

  const amount = parseFloat(bondAmount.replace(/[^0-9.]/g, ""));
  
  if (amount >= 50000) return "high";
  if (amount >= 5000) return "medium";
  return "low";
}

// Batch enhancement for multiple records
export async function enhanceRecordsBatch(
  records: ArrestRecord[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, EnhancedRecord>> {
  const results = new Map<string, EnhancedRecord>();
  
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    try {
      const enhanced = await enhanceArrestRecord(record);
      results.set(record.id, enhanced);
      
      if (onProgress) {
        onProgress(i + 1, records.length);
      }
      
      // Rate limiting: wait 100ms between requests to avoid overwhelming API
      if (i < records.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Failed to enhance record ${record.id}:`, error);
    }
  }
  
  return results;
}

// Test OpenAI connection
export async function testAIConnection(): Promise<boolean> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Test" }],
      max_tokens: 5,
    });
    return !!response.choices[0]?.message?.content;
  } catch (error) {
    console.error("AI connection test failed:", error);
    return false;
  }
}
