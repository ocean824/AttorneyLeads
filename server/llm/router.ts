import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

// LLM Provider Types
export type LLMProvider = 'openai' | 'claude' | 'gemini';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  tokensUsed?: number;
  latencyMs: number;
}

export interface LLMError {
  provider: LLMProvider;
  error: string;
  retryable: boolean;
}

// Default configurations for each provider
const DEFAULT_CONFIGS: Record<LLMProvider, LLMConfig> = {
  openai: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    maxTokens: 1000,
    temperature: 0.7,
    timeoutMs: 15000,
  },
  claude: {
    provider: 'claude',
    model: 'claude-sonnet-4-5',
    maxTokens: 1000,
    temperature: 0.7,
    timeoutMs: 15000,
  },
  gemini: {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    maxTokens: 1000,
    temperature: 0.7,
    timeoutMs: 15000,
  },
};

// Initialize clients (lazy loading)
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;
let geminiClient: GoogleGenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    
    if (!apiKey || !baseURL) {
      throw new Error('OpenAI AI Integrations not configured');
    }
    
    openaiClient = new OpenAI({ apiKey, baseURL });
  }
  return openaiClient;
}

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
    
    if (!apiKey || !baseURL) {
      throw new Error('Anthropic AI Integrations not configured');
    }
    
    anthropicClient = new Anthropic({ apiKey, baseURL });
  }
  return anthropicClient;
}

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Gemini AI Integrations not configured');
    }
    
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

// Call OpenAI with timeout
async function callOpenAI(
  prompt: string,
  systemPrompt: string,
  config: LLMConfig
): Promise<LLMResponse> {
  const startTime = Date.now();
  const client = getOpenAIClient();
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
  
  try {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    }, { signal: controller.signal });
    
    clearTimeout(timeoutId);
    
    return {
      content: response.choices[0]?.message?.content || '',
      provider: 'openai',
      model: config.model,
      tokensUsed: response.usage?.total_tokens,
      latencyMs: Date.now() - startTime,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Call Anthropic with timeout
async function callAnthropic(
  prompt: string,
  systemPrompt: string,
  config: LLMConfig
): Promise<LLMResponse> {
  const startTime = Date.now();
  const client = getAnthropicClient();
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
  
  try {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens || 1000,
      temperature: config.temperature,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt },
      ],
    }, { signal: controller.signal });
    
    clearTimeout(timeoutId);
    
    const content = response.content[0];
    return {
      content: content.type === 'text' ? content.text : '',
      provider: 'claude',
      model: config.model,
      tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
      latencyMs: Date.now() - startTime,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Call Gemini with timeout
async function callGemini(
  prompt: string,
  systemPrompt: string,
  config: LLMConfig
): Promise<LLMResponse> {
  const startTime = Date.now();
  const client = getGeminiClient();
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Timeout')), config.timeoutMs);
  });
  
  try {
    const result = await Promise.race([
      client.models.generateContent({
        model: config.model,
        contents: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,
        config: {
          maxOutputTokens: config.maxTokens,
          temperature: config.temperature,
        },
      }),
      timeoutPromise,
    ]);
    
    return {
      content: result.text || '',
      provider: 'gemini',
      model: config.model,
      tokensUsed: result.usageMetadata?.totalTokenCount,
      latencyMs: Date.now() - startTime,
    };
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get AI response with automatic fallback between providers
 * @param prompt - User prompt
 * @param systemPrompt - System instructions
 * @param fallbackOrder - Order of providers to try (default: openai -> claude -> gemini)
 * @param customConfigs - Optional custom configs per provider
 */
export async function getResponse(
  prompt: string,
  systemPrompt: string = '',
  fallbackOrder: LLMProvider[] = ['openai', 'claude', 'gemini'],
  customConfigs?: Partial<Record<LLMProvider, Partial<LLMConfig>>>
): Promise<LLMResponse> {
  const errors: LLMError[] = [];
  
  for (const provider of fallbackOrder) {
    const defaultConfig = DEFAULT_CONFIGS[provider];
    const customConfig = customConfigs?.[provider] || {};
    const config: LLMConfig = { ...defaultConfig, ...customConfig };
    
    try {
      let response: LLMResponse;
      
      switch (provider) {
        case 'openai':
          response = await callOpenAI(prompt, systemPrompt, config);
          break;
        case 'claude':
          response = await callAnthropic(prompt, systemPrompt, config);
          break;
        case 'gemini':
          response = await callGemini(prompt, systemPrompt, config);
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
      
      // Success! Return immediately
      console.log(`✓ LLM Response from ${provider} (${response.latencyMs}ms, ${response.tokensUsed} tokens)`);
      return response;
      
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      const isRetryable = 
        errorMsg.includes('timeout') ||
        errorMsg.includes('429') || 
        errorMsg.includes('quota') ||
        errorMsg.includes('overloaded') ||
        errorMsg.includes('rate limit');
      
      errors.push({
        provider,
        error: errorMsg,
        retryable: isRetryable,
      });
      
      console.warn(`✗ LLM ${provider} failed: ${errorMsg} (retryable: ${isRetryable})`);
      
      // Continue to next provider
      continue;
    }
  }
  
  // All providers failed
  throw new Error(
    `All LLM providers failed. Errors: ${JSON.stringify(errors, null, 2)}`
  );
}

/**
 * Check health of all configured LLM providers
 */
export async function checkLLMHealth(): Promise<Record<LLMProvider, boolean>> {
  const health: Record<LLMProvider, boolean> = {
    openai: false,
    claude: false,
    gemini: false,
  };
  
  const testPrompt = "Say 'OK'";
  const testSystem = "You are a test assistant.";
  
  // Test each provider in parallel
  const tests = [
    (async () => {
      try {
        await callOpenAI(testPrompt, testSystem, { 
          ...DEFAULT_CONFIGS.openai, 
          timeoutMs: 5000 
        });
        health.openai = true;
      } catch (e) {
        // Ignore
      }
    })(),
    (async () => {
      try {
        await callAnthropic(testPrompt, testSystem, { 
          ...DEFAULT_CONFIGS.claude, 
          timeoutMs: 5000 
        });
        health.claude = true;
      } catch (e) {
        // Ignore
      }
    })(),
    (async () => {
      try {
        await callGemini(testPrompt, testSystem, { 
          ...DEFAULT_CONFIGS.gemini, 
          timeoutMs: 5000 
        });
        health.gemini = true;
      } catch (e) {
        // Ignore
      }
    })(),
  ];
  
  await Promise.allSettled(tests);
  
  return health;
}
