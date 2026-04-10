/**
 * Custom Anthropic HTTP Client
 *
 * Replaces the @anthropic-ai/sdk with a lightweight fetch-based implementation
 * that sends Anthropic-compatible requests to a custom backend.
 */

import { randomUUID } from 'crypto';
import type {
  BetaMessage,
  BetaMessageStreamParams,
  BetaRawMessageStreamEvent,
  BetaToolUnion,
  ClientOptions,
  Stream,
  APIError,
  APIConnectionTimeoutError,
  APIUserAbortError,
} from '../../types/anthropic-compat.js';

// Re-export error types for compatibility
export { APIError, APIConnectionTimeoutError, APIUserAbortError };

/**
 * Custom HTTP client that implements the Anthropic SDK interface
 */
export class CustomAnthropicClient {
  private apiKey: string;
  private baseURL: string;
  private maxRetries: number;
  private timeout: number;
  private defaultHeaders: Record<string, string>;
  private fetchImpl: typeof fetch;
  private logger?: ClientOptions['logger'];

  constructor(options: ClientOptions = {}) {
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.baseURL = (
      options.baseURL ||
      process.env.ANTHROPIC_BASE_URL ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
    this.maxRetries = options.maxRetries ?? 3;
    this.timeout = options.timeout ?? 600000; // 10 minutes default
    this.defaultHeaders = options.defaultHeaders || {};
    this.fetchImpl = options.fetch || globalThis.fetch.bind(globalThis);
    this.logger = options.logger;

    if (!this.apiKey) {
      throw new Error('API key is required. Set ANTHROPIC_API_KEY environment variable.');
    }

    if (!this.baseURL) {
      throw new Error('Base URL is required. Set ANTHROPIC_BASE_URL environment variable.');
    }

    this.log('info', `[CustomClient] Initialized with baseURL: ${this.baseURL}`);
  }

  /**
   * Main messages API namespace
   */
  get messages() {
    return {
      create: async (
        params: BetaMessageStreamParams
      ): Promise<Stream<BetaRawMessageStreamEvent>> => {
        return this.createMessageStream(params);
      },
    };
  }

  /**
   * Beta namespace (used by Claude Code)
   */
  get beta() {
    return {
      messages: {
        create: async (
          params: BetaMessageStreamParams
        ): Promise<Stream<BetaRawMessageStreamEvent>> => {
          return this.createMessageStream(params);
        },
      },
    };
  }

  /**
   * Create a streaming message request
   */
  private async createMessageStream(
    params: BetaMessageStreamParams
  ): Promise<Stream<BetaRawMessageStreamEvent>> {
    const url = `${this.baseURL}/v1/messages`;
    const requestId = randomUUID();

    // Build request body
    const body = this.buildRequestBody(params);

    // Build headers
    const headers = this.buildHeaders(params, requestId);

    this.log('debug', `[CustomClient] Request ${requestId}:`, {
      model: params.model,
      messageCount: params.messages.length,
    });

    // Make the request with retries
    const response = await this.fetchWithRetry(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      },
      requestId
    );

    // Return streaming interface
    return this.createStream(response, requestId);
  }

  /**
   * Build the request body from params
   */
  private buildRequestBody(params: BetaMessageStreamParams): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: params.model,
      messages: params.messages,
      max_tokens: params.max_tokens,
      stream: true,
    };

    // Add optional parameters
    if (params.system !== undefined) {
      body.system = params.system;
    }

    if (params.tools !== undefined && params.tools.length > 0) {
      body.tools = this.formatTools(params.tools);
    }

    if (params.tool_choice !== undefined) {
      body.tool_choice = params.tool_choice;
    }

    if (params.temperature !== undefined) {
      body.temperature = params.temperature;
    }

    if (params.top_p !== undefined) {
      body.top_p = params.top_p;
    }

    if (params.top_k !== undefined) {
      body.top_k = params.top_k;
    }

    if (params.metadata !== undefined) {
      body.metadata = params.metadata;
    }

    // Add thinking configuration if present
    if (params.thinking !== undefined) {
      body.thinking = params.thinking;
    }

    return body;
  }

  /**
   * Format tools for the API request
   */
  private formatTools(tools: BetaToolUnion[]): unknown[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
      // Include optional properties for advanced features
      ...(tool.cache_control && { cache_control: tool.cache_control }),
      ...(tool.defer_loading && { defer_loading: tool.defer_loading }),
      ...(tool.eager_input_streaming && { eager_input_streaming: tool.eager_input_streaming }),
      ...(tool.strict !== undefined && { strict: tool.strict }),
    }));
  }

  /**
   * Build request headers
   */
  private buildHeaders(params: BetaMessageStreamParams, requestId: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'X-Client-Request-Id': requestId,
      'User-Agent': 'Claude-Code-Custom/1.0',
      Accept: 'text/event-stream',
      ...this.defaultHeaders,
    };

    // Add beta headers
    if (params.betas && params.betas.length > 0) {
      headers['anthropic-beta'] = params.betas.join(',');
    }

    // Add thinking beta if thinking is enabled
    if (params.thinking?.type === 'enabled') {
      if (!headers['anthropic-beta']?.includes('interleaved-thinking')) {
        headers['anthropic-beta'] = headers['anthropic-beta']
          ? `${headers['anthropic-beta']},interleaved-thinking-2025-05-14`
          : 'interleaved-thinking-2025-05-14';
      }
    }

    // Add tool search beta if tools present
    if (params.tools && params.tools.length > 0) {
      if (!headers['anthropic-beta']?.includes('advanced-tool-use')) {
        headers['anthropic-beta'] = headers['anthropic-beta']
          ? `${headers['anthropic-beta']},advanced-tool-use-2025-11-20`
          : 'advanced-tool-use-2025-11-20';
      }
    }

    return headers;
  }

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    requestId: string,
    attempt: number = 1
  ): Promise<Response> {
    try {
      this.log('debug', `[CustomClient] Fetch attempt ${attempt} for ${requestId}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        this.log(
          'error',
          `[CustomClient] HTTP error ${response.status} for ${requestId}:`,
          errorText
        );

        // Retry on 5xx errors or rate limits
        if ((response.status >= 500 && response.status < 600) || response.status === 429) {
          if (attempt < this.maxRetries) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            this.log('info', `[CustomClient] Retrying after ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            return this.fetchWithRetry(url, init, requestId, attempt + 1);
          }
        }

        throw new APIError(
          response.status,
          { message: errorText },
          `HTTP ${response.status}: ${errorText}`,
          Object.fromEntries(response.headers.entries())
        );
      }

      this.log('debug', `[CustomClient] Fetch successful for ${requestId}`);
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new APIConnectionTimeoutError({ message: `Request timeout after ${this.timeout}ms` });
      }

      if (error instanceof APIError) {
        throw error;
      }

      // Retry on network errors
      if (attempt < this.maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        this.log('info', `[CustomClient] Network error, retrying after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, init, requestId, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Create a streaming interface from response
   */
  private createStream(response: Response, requestId: string): Stream<BetaRawMessageStreamEvent> {
    const self = this;
    let isAborted = false;

    const stream: Stream<BetaRawMessageStreamEvent> = {
      async *[Symbol.asyncIterator](): AsyncGenerator<BetaRawMessageStreamEvent> {
        if (!response.body) {
          throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (!isAborted) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();

              // Handle SSE format: data: {...}
              if (trimmed.startsWith('data: ')) {
                const data = trimmed.slice(6);

                if (data === '[DONE]') {
                  self.log('debug', `[CustomClient] Stream complete for ${requestId}`);
                  return;
                }

                try {
                  const event = JSON.parse(data) as BetaRawMessageStreamEvent;
                  self.log('debug', `[CustomClient] Event ${event.type} for ${requestId}`);
                  yield event;
                } catch (parseError) {
                  self.log('error', `[CustomClient] Failed to parse event for ${requestId}:`, data);
                  // Continue processing other events
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      },

      // Allow aborting the stream
      get controller() {
        const controller = new AbortController();
        return {
          get signal() {
            return controller.signal;
          },
          abort() {
            isAborted = true;
            controller.abort();
          },
        } as AbortController;
      },
    };

    return stream;
  }

  /**
   * Helper for logging
   */
  private log(level: 'error' | 'warn' | 'info' | 'debug', message: string, ...args: unknown[]) {
    if (this.logger) {
      this.logger[level](message, ...args);
    }
  }
}

/**
 * Factory function to create a client (matches Anthropic SDK pattern)
 */
export function createCustomClient(options?: ClientOptions): CustomAnthropicClient {
  return new CustomAnthropicClient(options);
}

// Default export for compatibility
export default CustomAnthropicClient;
