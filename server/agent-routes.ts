import type { Express, Request, Response } from "express";
import { agentService } from "./agent-service";
import { chatMessageSchema } from "@shared/schema";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import { checkLLMHealth } from "./llm/router";

// Authentication middleware
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

export function registerAgentRoutes(app: Express): void {
  /**
   * POST /api/agent/chat
   * Send a message to the AI agent
   */
  app.post("/api/agent/chat", requireAuth, async (req, res) => {
    try {
      const validation = chatMessageSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: validation.error.errors 
        });
      }

      const { sessionId, message, arrestRecordId } = validation.data;
      const userId = req.session.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "User ID not found in session" });
      }
      
      // Generate new session ID if not provided
      const finalSessionId = sessionId || randomUUID();
      
      // If session ID was provided (not new), verify ownership
      if (sessionId) {
        const owner = await storage.getSessionOwner(sessionId);
        if (owner && owner !== userId) {
          return res.status(403).json({ error: "Access denied to this session" });
        }
      }
      
      // Fetch arrest record if ID provided
      let arrestRecord;
      if (arrestRecordId) {
        arrestRecord = await storage.getArrestRecord(arrestRecordId);
        if (!arrestRecord) {
          return res.status(404).json({ error: "Arrest record not found" });
        }
      }

      // Call agent service
      const response = await agentService.chat({
        sessionId: finalSessionId,
        userId,
        message,
        arrestRecordId,
        arrestRecord
      });

      res.json(response);

    } catch (error: any) {
      console.error("Agent chat error:", error);
      res.status(500).json({ 
        error: "Failed to process chat message",
        details: error.message 
      });
    }
  });

  /**
   * GET /api/agent/sessions/:sessionId
   * Get conversation history for a session
   */
  app.get("/api/agent/sessions/:sessionId", requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.session.user?.id;
      
      // Verify session ownership
      const owner = await storage.getSessionOwner(sessionId);
      if (owner && owner !== userId) {
        return res.status(403).json({ error: "Access denied to this session" });
      }
      
      const history = await agentService.getSessionHistory(sessionId);
      
      res.json({ 
        sessionId,
        interactions: history,
        count: history.length
      });

    } catch (error: any) {
      console.error("Get session error:", error);
      res.status(500).json({ 
        error: "Failed to fetch session history",
        details: error.message 
      });
    }
  });

  /**
   * POST /api/agent/sessions/:sessionId/clear
   * Clear conversation history for a session
   */
  app.post("/api/agent/sessions/:sessionId/clear", requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.session.user?.id;
      
      // Verify session ownership
      const owner = await storage.getSessionOwner(sessionId);
      if (owner && owner !== userId) {
        return res.status(403).json({ error: "Access denied to this session" });
      }
      
      const deletedCount = await agentService.clearSession(sessionId);
      
      res.json({ 
        success: true,
        deletedCount,
        message: "Session cleared successfully"
      });

    } catch (error: any) {
      console.error("Clear session error:", error);
      res.status(500).json({ 
        error: "Failed to clear session",
        details: error.message 
      });
    }
  });

  /**
   * GET /api/agent/llm/health
   * Check health status of all LLM providers
   */
  app.get("/api/agent/llm/health", requireAuth, async (req, res) => {
    try {
      const health = await checkLLMHealth();
      const anyHealthy = Object.values(health).some(status => status);
      
      res.json({
        healthy: anyHealthy,
        providers: health,
        message: anyHealthy 
          ? "At least one LLM provider is available" 
          : "All LLM providers are unavailable"
      });
    } catch (error: any) {
      console.error("LLM health check error:", error);
      res.status(500).json({ 
        error: "Failed to check LLM health",
        details: error.message 
      });
    }
  });

  /**
   * GET /api/agent/sessions
   * List all session IDs for the current user (unique sessionIds from agent_interactions)
   */
  app.get("/api/agent/sessions", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "User ID not found in session" });
      }
      
      // Get only this user's interactions
      const userInteractions = await storage.getAgentInteractions(undefined, undefined, userId);
      
      // Get unique session IDs with metadata
      const sessionMap = new Map<string, { lastMessage: string; lastTimestamp: Date; messageCount: number }>();
      
      for (const interaction of userInteractions) {
        const existing = sessionMap.get(interaction.sessionId);
        if (!existing || interaction.createdAt > existing.lastTimestamp) {
          sessionMap.set(interaction.sessionId, {
            lastMessage: interaction.message.substring(0, 100),
            lastTimestamp: interaction.createdAt,
            messageCount: (existing?.messageCount || 0) + 1
          });
        }
      }
      
      const sessions = Array.from(sessionMap.entries()).map(([sessionId, data]) => ({
        sessionId,
        ...data
      })).sort((a, b) => b.lastTimestamp.getTime() - a.lastTimestamp.getTime());
      
      res.json({ 
        sessions,
        count: sessions.length
      });

    } catch (error: any) {
      console.error("List sessions error:", error);
      res.status(500).json({ 
        error: "Failed to list sessions",
        details: error.message 
      });
    }
  });
}
