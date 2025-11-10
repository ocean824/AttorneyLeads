import type { AgentInteraction, ArrestRecord } from "@shared/schema";
import { storage } from "./storage";
import { getResponse, type LLMProvider, type LLMResponse } from "./llm/router";

// Validate LLM environment variables
function validateLLMConfig(): void {
  const hasOpenAI = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const hasAnthropic = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL && process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  const hasGemini = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  
  if (!hasOpenAI && !hasAnthropic && !hasGemini) {
    console.warn("Warning: No LLM providers configured. Agent chat will fail until at least one provider is set up.");
  } else {
    const configured = [];
    if (hasOpenAI) configured.push("OpenAI");
    if (hasAnthropic) configured.push("Claude");
    if (hasGemini) configured.push("Gemini");
    console.log(`✓ LLM providers configured: ${configured.join(", ")}`);
  }
}

validateLLMConfig();

const SYSTEM_PROMPT = `You are an intelligent assistant for AttorneyLeads, a Florida arrest records platform for legal professionals.

Your expertise includes:
- Explaining Florida arrest codes and statutes (FSS)
- Analyzing charge severity and implications
- Providing context about bond amounts and conditions
- Identifying potential case patterns or red flags
- Answering questions about arrest records and legal processes

Guidelines:
- Be professional and factual
- Cite Florida Statutes when relevant
- Avoid providing specific legal advice (users are legal professionals, you're providing information)
- When analyzing arrest records, focus on data quality, patterns, and lead potential
- If you don't know something, acknowledge it clearly

Available data context:
- Arrest records from 20 major Florida counties
- Charge descriptions, bond amounts, booking dates
- Defendant demographics and case metadata
- Lead scoring (0-100 based on charge severity)`;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AgentResponse {
  message: string;
  tokensUsed: number;
  sessionId: string;
  interactionId: string;
}

export class AgentService {
  /**
   * Send a message to the AI agent with optional arrest record context
   */
  async chat(params: {
    sessionId: string;
    userId: string;
    message: string;
    arrestRecordId?: string;
    arrestRecord?: ArrestRecord;
  }): Promise<AgentResponse> {
    const { sessionId, userId, message, arrestRecordId, arrestRecord } = params;

    // Build conversation history from database (scoped to user for security)
    const history = await storage.getAgentInteractions(sessionId, undefined, userId);
    
    // Build messages array with system prompt
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT }
    ];

    // Add conversation history
    for (const interaction of history) {
      messages.push({
        role: interaction.role as "user" | "assistant",
        content: interaction.message
      });
    }

    // Add arrest record context if provided
    if (arrestRecord) {
      const contextMessage = this.buildRecordContext(arrestRecord);
      messages.push({
        role: "system",
        content: `Context: User is asking about the following arrest record:\n${contextMessage}`
      });
    }

    // Add user's new message
    messages.push({
      role: "user",
      content: message
    });

    // Store user message
    const userInteraction = await storage.createAgentInteraction({
      sessionId,
      userId,
      arrestRecordId: arrestRecordId || null,
      role: "user",
      message,
      model: null,
      tokensUsed: null,
      actionTaken: null,
      actionResult: null
    });

    try {
      // Build prompt from messages (extract user message from last item)
      const userPrompt = message;
      const conversationContext = messages
        .slice(1, -1) // Skip system prompt and current user message
        .map(m => `${m.role}: ${m.content}`)
        .join("\n\n");
      
      const fullPrompt = conversationContext 
        ? `Previous conversation:\n${conversationContext}\n\nUser: ${userPrompt}`
        : userPrompt;

      // Call Multi-LLM router with automatic fallback
      // Tries OpenAI -> Claude -> Gemini in order
      const fallbackOrder: LLMProvider[] = ['openai', 'claude', 'gemini'];
      const llmResponse: LLMResponse = await getResponse(
        fullPrompt,
        SYSTEM_PROMPT,
        fallbackOrder,
        {
          openai: { maxTokens: 2048, temperature: 0.7 },
          claude: { maxTokens: 2048, temperature: 0.7 },
          gemini: { maxTokens: 2048, temperature: 0.7 },
        }
      );

      const assistantMessage = llmResponse.content || "I apologize, but I couldn't generate a response.";
      const tokensUsed = llmResponse.tokensUsed || 0;
      const modelUsed = `${llmResponse.provider}/${llmResponse.model}`;

      // Store assistant response
      const assistantInteraction = await storage.createAgentInteraction({
        sessionId,
        userId,
        arrestRecordId: arrestRecordId || null,
        role: "assistant",
        message: assistantMessage,
        model: modelUsed,
        tokensUsed,
        actionTaken: null,
        actionResult: JSON.stringify({ 
          provider: llmResponse.provider, 
          latencyMs: llmResponse.latencyMs 
        })
      });

      return {
        message: assistantMessage,
        tokensUsed,
        sessionId,
        interactionId: assistantInteraction.id
      };

    } catch (error: any) {
      console.error("LLM API error:", error);
      
      // Store error in assistant interaction
      await storage.createAgentInteraction({
        sessionId,
        userId,
        arrestRecordId: arrestRecordId || null,
        role: "assistant",
        message: "I encountered an error processing your request. All AI providers are currently unavailable. Please try again later.",
        model: "error",
        tokensUsed: null,
        actionTaken: "error",
        actionResult: JSON.stringify({ error: error.message })
      });

      throw new Error(`AI Agent error: ${error.message}`);
    }
  }

  /**
   * Build formatted context from arrest record
   */
  private buildRecordContext(record: ArrestRecord): string {
    const parts = [
      `Name: ${record.fullName}`,
      `County: ${record.county}`,
      `Booking Date: ${record.bookingDate}`,
      `Charges: ${record.charges}`,
    ];

    if (record.bondAmount) {
      parts.push(`Bond Amount: ${record.bondAmount}`);
    }

    if (record.age !== null) {
      parts.push(`Age: ${record.age}`);
    }

    if (record.leadScore !== null) {
      parts.push(`Lead Score: ${record.leadScore}/100`);
    }

    if (record.chargeCategories) {
      parts.push(`Charge Categories: ${record.chargeCategories}`);
    }

    if (record.riskLevel) {
      parts.push(`Risk Level: ${record.riskLevel}`);
    }

    if (record.normalizedCharges) {
      parts.push(`Normalized Charges: ${record.normalizedCharges}`);
    }

    return parts.join("\n");
  }

  /**
   * Get conversation history for a session
   */
  async getSessionHistory(sessionId: string): Promise<AgentInteraction[]> {
    return storage.getAgentInteractions(sessionId);
  }

  /**
   * Clear conversation history for a session
   */
  async clearSession(sessionId: string): Promise<number> {
    const deletedCount = await storage.deleteAgentInteractions(sessionId);
    return deletedCount;
  }
}

export const agentService = new AgentService();
