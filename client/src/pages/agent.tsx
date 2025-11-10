import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, Plus, Trash2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  role: "user" | "assistant";
  message: string;
  createdAt: string;
  tokensUsed?: number | null;
  arrestRecordId?: string | null;
}

interface Session {
  sessionId: string;
  lastMessage: string;
  lastTimestamp: Date;
  messageCount: number;
}

interface ChatResponse {
  message: string;
  tokensUsed: number;
  sessionId: string;
  interaction: Message;
}

export default function AgentPage() {
  const { toast } = useToast();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load last session from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem("agent_last_session");
    if (savedSession) {
      setCurrentSessionId(savedSession);
    }
  }, []);

  // Save current session to localStorage (skip temp IDs)
  useEffect(() => {
    if (currentSessionId && !currentSessionId.startsWith("temp-")) {
      localStorage.setItem("agent_last_session", currentSessionId);
    }
  }, [currentSessionId]);

  // Fetch sessions list
  const { data: sessionsData } = useQuery<{ sessions: Session[] }>({
    queryKey: ["/api/agent/sessions"],
  });

  // Fetch current session history
  const { data: historyData, isLoading: historyLoading } = useQuery<{
    sessionId: string;
    interactions: Message[];
    count: number;
  }>({
    queryKey: ["/api/agent/sessions", currentSessionId],
    enabled: !!currentSessionId,
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/agent/chat", {
        sessionId: currentSessionId || undefined,
        message,
      });
      return response as unknown as ChatResponse;
    },
    onMutate: async (message) => {
      // Generate temporary session ID for new conversations
      const tempSessionId = currentSessionId || `temp-${Date.now()}`;
      
      // Cancel outgoing queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ["/api/agent/sessions", currentSessionId] });
      await queryClient.cancelQueries({ queryKey: ["/api/agent/sessions"] });

      // Create optimistic user message
      const optimisticUserMessage: Message = {
        id: `temp-user-${Date.now()}`,
        role: "user",
        message,
        createdAt: new Date().toISOString(),
        tokensUsed: null,
        arrestRecordId: null,
      };

      // Get current history (or create new one for new sessions)
      const previousHistory = queryClient.getQueryData<{
        sessionId: string;
        interactions: Message[];
        count: number;
      }>(["/api/agent/sessions", currentSessionId]);

      // Get previous sessions list
      const previousSessions = queryClient.getQueryData<{ sessions: Session[] }>(["/api/agent/sessions"]);

      // Optimistically update session history
      if (currentSessionId && previousHistory) {
        // Existing session - append message
        queryClient.setQueryData(["/api/agent/sessions", currentSessionId], {
          ...previousHistory,
          interactions: [...previousHistory.interactions, optimisticUserMessage],
          count: previousHistory.count + 1,
        });
      } else {
        // New session - create cache entry and set as current
        setCurrentSessionId(tempSessionId);
        queryClient.setQueryData(["/api/agent/sessions", tempSessionId], {
          sessionId: tempSessionId,
          interactions: [optimisticUserMessage],
          count: 1,
        });
      }

      // Optimistically update sessions list
      if (!currentSessionId) {
        const newSession: Session = {
          sessionId: tempSessionId,
          lastMessage: message,
          lastTimestamp: new Date(),
          messageCount: 1,
        };
        
        // Always create optimistic entry, even for first session
        if (previousSessions) {
          queryClient.setQueryData(["/api/agent/sessions"], {
            sessions: [newSession, ...previousSessions.sessions],
          });
        } else {
          // First session ever - create sessions cache
          queryClient.setQueryData(["/api/agent/sessions"], {
            sessions: [newSession],
          });
        }
      }

      // Clear input immediately
      setInputMessage("");

      // Return context for rollback
      return { previousHistory, previousSessions, tempSessionId, wasNewSession: !currentSessionId };
    },
    onSuccess: (data, variables, context) => {
      // Update current session with real ID from server
      if (context?.wasNewSession && context?.tempSessionId) {
        // Get current sessions list
        const currentSessions = queryClient.getQueryData<{ sessions: Session[] }>(["/api/agent/sessions"]);
        
        // Swap temp session with real session in sidebar
        if (currentSessions) {
          const updatedSessions = currentSessions.sessions.map(session =>
            session.sessionId === context.tempSessionId
              ? { ...session, sessionId: data.sessionId }
              : session
          );
          queryClient.setQueryData(["/api/agent/sessions"], {
            sessions: updatedSessions,
          });
        }
        
        // Get optimistic history cache
        const tempHistory = queryClient.getQueryData<{
          sessionId: string;
          interactions: Message[];
          count: number;
        }>(["/api/agent/sessions", context.tempSessionId]);
        
        // Move history from temp to real session
        if (tempHistory) {
          queryClient.setQueryData(["/api/agent/sessions", data.sessionId], {
            ...tempHistory,
            sessionId: data.sessionId,
          });
        }
        
        // Remove temporary session cache
        queryClient.removeQueries({ queryKey: ["/api/agent/sessions", context.tempSessionId] });
        
        // Set real session ID
        setCurrentSessionId(data.sessionId);
      }
      
      // Invalidate queries to get real server data
      queryClient.invalidateQueries({ queryKey: ["/api/agent/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/sessions", data.sessionId] });
    },
    onError: (error: Error, variables, context) => {
      // Rollback optimistic updates
      if (context?.previousHistory && !context?.wasNewSession) {
        queryClient.setQueryData(["/api/agent/sessions", currentSessionId], context.previousHistory);
      } else if (context?.tempSessionId && context?.wasNewSession) {
        // Remove temporary session cache
        queryClient.removeQueries({ queryKey: ["/api/agent/sessions", context.tempSessionId] });
        // Reset session ID and clear from localStorage
        setCurrentSessionId(null);
        localStorage.removeItem("agent_last_session");
      }
      
      // Rollback sessions list
      if (context?.wasNewSession) {
        if (context?.previousSessions) {
          // Restore previous sessions list
          queryClient.setQueryData(["/api/agent/sessions"], context.previousSessions);
        } else {
          // Was first session ever - remove cache entirely
          queryClient.removeQueries({ queryKey: ["/api/agent/sessions"] });
        }
      }
      
      // Restore input
      setInputMessage(variables);
      
      toast({
        variant: "destructive",
        title: "Chat Error",
        description: error.message,
      });
    },
  });

  // Clear session mutation
  const clearMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return await apiRequest("POST", `/api/agent/sessions/${sessionId}/clear`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/sessions", currentSessionId] });
      toast({
        title: "Conversation Cleared",
        description: "Chat history has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Clear Failed",
        description: error.message,
      });
    },
  });

  const handleSend = () => {
    if (!inputMessage.trim()) return;
    sendMutation.mutate(inputMessage);
  };

  const handleNewSession = () => {
    setCurrentSessionId(null);
    localStorage.removeItem("agent_last_session");
  };

  const handleClearSession = () => {
    if (!currentSessionId) return;
    clearMutation.mutate(currentSessionId);
  };

  const sessions = sessionsData?.sessions || [];
  const messages = historyData?.interactions || [];

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, sendMutation.isPending]);

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-4 p-6 bg-background">
      {/* Left Panel - Session List */}
      <Card className="w-80 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Sessions
          </CardTitle>
          <Button
            size="sm"
            onClick={handleNewSession}
            data-testid="button-new-session"
          >
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full px-6">
            <div className="space-y-2 pb-4">
              {sessions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No conversations yet
                </p>
              )}
              {sessions.map((session) => (
                <button
                  key={session.sessionId}
                  onClick={() => setCurrentSessionId(session.sessionId)}
                  data-testid={`button-session-${session.sessionId}`}
                  className={`w-full text-left p-3 rounded-md transition-colors hover-elevate active-elevate-2 ${
                    currentSessionId === session.sessionId
                      ? "bg-accent"
                      : "bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium line-clamp-1">
                      {session.lastMessage}
                    </p>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {session.messageCount}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(session.lastTimestamp), { addSuffix: true })}
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right Panel - Chat Interface */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4 border-b">
          <CardTitle className="text-lg">
            {currentSessionId ? "AI Assistant" : "New Conversation"}
          </CardTitle>
          {currentSessionId && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleClearSession}
              disabled={clearMutation.isPending}
              data-testid="button-clear-session"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-6">
          <ScrollArea className="h-full pr-4">
            {historyLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-3/4" />
                <Skeleton className="h-20 w-3/4 ml-auto" />
                <Skeleton className="h-20 w-3/4" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3">
                  <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="text-lg font-medium">Start a Conversation</p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Ask questions about arrest records, Florida statutes, or get help navigating the platform.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                      data-testid={`message-${msg.role}-${msg.id}`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs opacity-70">
                        <span>
                          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        </span>
                        {msg.tokensUsed && (
                          <span>• {msg.tokensUsed} tokens</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {sendMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-4 max-w-[80%]">
                      <div className="flex gap-1">
                        <Skeleton className="h-2 w-2 rounded-full" />
                        <Skeleton className="h-2 w-2 rounded-full" />
                        <Skeleton className="h-2 w-2 rounded-full" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={scrollRef} />
              </div>
            )}
          </ScrollArea>
        </CardContent>

        <CardFooter className="border-t p-4">
          <div className="flex gap-2 w-full">
            <Textarea
              placeholder="Type your message..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={sendMutation.isPending}
              className="resize-none min-h-[60px]"
              data-testid="input-chat-message"
            />
            <Button
              onClick={handleSend}
              disabled={!inputMessage.trim() || sendMutation.isPending}
              size="icon"
              className="shrink-0 h-[60px] w-[60px]"
              data-testid="button-send-message"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
