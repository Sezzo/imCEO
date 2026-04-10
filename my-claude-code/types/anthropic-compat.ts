/**
 * Anthropic SDK Type Replacements
 *
 * This file provides standalone TypeScript types that mirror the Anthropic SDK
 * without requiring the @anthropic-ai/sdk dependency.
 *
 * These types are used throughout Claude Code for message handling,
 * streaming responses, tool calls, and all other API interactions.
 */

import type { IncomingHttpHeaders } from 'http';

// ============================================================================
// Base Types
// ============================================================================

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

export type MessageRole = 'user' | 'assistant';

export type BetaStopReason = 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';

// ============================================================================
// Content Blocks (API Response Types)
// ============================================================================

export interface BetaTextBlock {
  type: 'text';
  text: string;
  citations?: BetaCitation[];
}

export interface BetaThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

export interface BetaRedactedThinkingBlock {
  type: 'redacted_thinking';
  data: string;
}

export interface BetaToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface BetaImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
    data: string;
  };
}

export interface BetaToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | BetaContentBlock[];
  is_error?: boolean;
  cache_control?: BetaCacheControlEphemeral;
}

export type BetaContentBlock =
  | BetaTextBlock
  | BetaThinkingBlock
  | BetaRedactedThinkingBlock
  | BetaToolUseBlock
  | BetaImageBlock;

export type BetaContentBlockParam =
  | BetaTextBlockParam
  | BetaImageBlockParam
  | BetaToolResultBlockParam
  | BetaToolUseBlockParam
  | BetaThinkingBlockParam
  | BetaRedactedThinkingBlockParam;

// ============================================================================
// Content Block Params (Request Types)
// ============================================================================

export interface BetaTextBlockParam {
  type: 'text';
  text: string;
  cache_control?: BetaCacheControlEphemeral;
}

export interface BetaThinkingBlockParam {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

export interface BetaRedactedThinkingBlockParam {
  type: 'redacted_thinking';
  data: string;
}

export interface BetaImageBlockParam {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
    data: string;
  };
}

export interface BetaToolUseBlockParam {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface BetaToolResultBlockParam {
  type: 'tool_result';
  tool_use_id: string;
  content: string | BetaContentBlock[];
  is_error?: boolean;
  cache_control?: BetaCacheControlEphemeral;
}

export interface BetaCacheControlEphemeral {
  type: 'ephemeral';
}

// ============================================================================
// Message Types
// ============================================================================

export interface BetaMessage {
  id: string;
  type: 'message';
  role: MessageRole;
  content: BetaContentBlock[];
  model: string;
  stop_reason: BetaStopReason | null;
  stop_sequence?: string | null;
  usage: BetaUsage;
}

export interface BetaMessageParam {
  role: MessageRole;
  content: string | BetaContentBlockParam[];
}

// Aliases for compatibility
export type MessageParam = BetaMessageParam;

// ============================================================================
// Usage & Cost Tracking
// ============================================================================

export interface BetaUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface BetaMessageDeltaUsage {
  output_tokens: number;
}

// ============================================================================
// Tool Types
// ============================================================================

export interface BetaTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface BetaToolUnion extends BetaTool {
  // Extended tool properties for advanced features
  cache_control?: BetaCacheControlEphemeral;
  defer_loading?: boolean;
  eager_input_streaming?: boolean;
  strict?: boolean;
}

export type BetaToolChoice = 'auto' | 'any' | BetaToolChoiceTool | BetaToolChoiceAuto;

export interface BetaToolChoiceAuto {
  type: 'auto';
  disable_parallel_tool_use?: boolean;
}

export interface BetaToolChoiceTool {
  type: 'tool';
  name: string;
  disable_parallel_tool_use?: boolean;
}

// ============================================================================
// Thinking Configuration
// ============================================================================

export interface BetaThinkingConfig {
  type: 'enabled';
  budget_tokens: number;
}

export interface BetaThinkingConfigDisabled {
  type: 'disabled';
}

export type BetaThinkingConfigEnabled = BetaThinkingConfig;

// ============================================================================
// Request Configuration
// ============================================================================

export interface BetaMessageStreamParams {
  model: string;
  messages: BetaMessageParam[];
  max_tokens: number;
  system?: string | BetaTextBlockParam[];
  tools?: BetaToolUnion[];
  tool_choice?: BetaToolChoice;
  temperature?: number;
  thinking?: BetaThinkingConfig | BetaThinkingConfigDisabled;
  betas?: string[];
  metadata?: Record<string, string>;
  stream?: boolean;
  timeout?: number;
  top_p?: number;
  top_k?: number;
}

// ============================================================================
// Stream Event Types (SSE Events from API)
// ============================================================================

export type BetaRawMessageStreamEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | PingEvent;

export interface MessageStartEvent {
  type: 'message_start';
  message: BetaMessage;
}

export interface ContentBlockStartEvent {
  type: 'content_block_start';
  index: number;
  content_block: BetaContentBlock;
}

export interface ContentBlockDeltaEvent {
  type: 'content_block_delta';
  index: number;
  delta:
    | TextDelta
    | ThinkingDelta
    | RedactedThinkingDelta
    | ToolUseDelta
    | InputJsonDelta
    | ImageDelta;
}

export interface ContentBlockStopEvent {
  type: 'content_block_stop';
  index: number;
}

export interface MessageDeltaEvent {
  type: 'message_delta';
  delta: {
    stop_reason?: BetaStopReason;
    stop_sequence?: string | null;
  };
  usage: BetaMessageDeltaUsage;
}

export interface MessageStopEvent {
  type: 'message_stop';
}

export interface PingEvent {
  type: 'ping';
}

// Delta types
export interface TextDelta {
  type: 'text_delta';
  text: string;
}

export interface ThinkingDelta {
  type: 'thinking_delta';
  thinking: string;
}

export interface RedactedThinkingDelta {
  type: 'redacted_thinking_delta';
  data: string;
}

export interface ToolUseDelta {
  type: 'tool_use_delta';
  partial_json: string;
}

export interface InputJsonDelta {
  type: 'input_json_delta';
  partial_json: string;
}

export interface ImageDelta {
  type: 'image_delta';
  data: string;
}

// ============================================================================
// Stream Type
// ============================================================================

export interface Stream<T> extends AsyncIterable<T> {
  [Symbol.asyncIterator](): AsyncIterator<T>;
  controller?: AbortController;
}

// ============================================================================
// Error Types
// ============================================================================

export class APIError extends Error {
  readonly status: number | undefined;
  readonly headers: IncomingHttpHeaders | undefined;
  readonly error: unknown;

  constructor(
    status: number | undefined,
    error: unknown,
    message: string | undefined,
    headers: IncomingHttpHeaders | undefined
  ) {
    super(`${APIError.makeMessage(status, error, message)}`);
    this.status = status;
    this.headers = headers;
    this.error = error;
  }

  private static makeMessage(
    status: number | undefined,
    error: unknown,
    message: string | undefined
  ): string {
    const msg = error?.['message'] ?? message ?? '(no message)';
    return status ? `${status} ${msg}` : msg;
  }
}

export class APIConnectionTimeoutError extends APIError {
  constructor({ message }: { message?: string } = {}) {
    super(undefined, { message }, message, undefined);
  }
}

export class APIUserAbortError extends APIError {
  constructor() {
    super(undefined, { message: 'Request was aborted' }, 'Request was aborted', undefined);
  }
}

export class RateLimitError extends APIError {
  constructor(
    status: number | undefined,
    error: unknown,
    message: string | undefined,
    headers: IncomingHttpHeaders | undefined
  ) {
    super(status, error, message, headers);
  }
}

// ============================================================================
// Client Options
// ============================================================================

export interface ClientOptions {
  apiKey?: string;
  authToken?: string;
  baseURL?: string;
  maxRetries?: number;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
  fetch?: typeof fetch;
  fetchOptions?: RequestInit;
  dangerouslyAllowBrowser?: boolean;
  logger?: {
    error: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    debug: (message: string, ...args: unknown[]) => void;
  };
}

// ============================================================================
// Legacy/Compatibility Types
// ============================================================================

export type TextBlockParam = BetaTextBlockParam;
export type ContentBlock = BetaContentBlock;
export type ContentBlockParam = BetaContentBlockParam;
export type ToolUseBlock = BetaToolUseBlock;
export type ToolResultBlockParam = BetaToolResultBlockParam;
export type ThinkingBlock = BetaThinkingBlock;
export type RedactedThinkingBlock = BetaRedactedThinkingBlock;
export type ThinkingBlockParam = BetaThinkingBlockParam;
export type RedactedThinkingBlockParam = BetaRedactedThinkingBlockParam;
export type StopReason = BetaStopReason;

// Tool reference for tool search feature
export interface BetaToolReference {
  type: 'tool_reference';
  id: string;
}

// Document blocks for extended context
export interface BetaRequestDocumentBlock {
  type: 'document';
  source: {
    type: 'base64' | 'text' | 'url';
    media_type: 'application/pdf' | 'text/plain';
    data?: string;
    url?: string;
  };
  title?: string;
  context?: string;
  citations?: { enabled: boolean };
}

// Citation types
export interface BetaCitation {
  type: 'char_location' | 'page_location';
  cited_text: string;
  document_index?: number;
  document_title?: string;
  start_char_index?: number;
  end_char_index?: number;
  start_page_number?: number;
  end_page_number?: number;
}

// Output configuration for structured outputs
export interface BetaJSONOutputFormat {
  type: 'json';
  json?: {
    name?: string;
    description?: string;
    schema?: Record<string, unknown>;
    strict?: boolean;
  };
}

export type BetaOutputConfig = BetaJSONOutputFormat | { type: 'text' };

// ============================================================================
// Re-export for convenience
// ============================================================================

export type {
  BetaMessage as Message,
  BetaMessageParam as MessageParam,
  BetaContentBlock as ContentBlock,
  BetaContentBlockParam as ContentBlockParam,
  BetaToolUseBlock as ToolUseBlock,
  BetaToolResultBlockParam as ToolResultBlockParam,
  BetaUsage as Usage,
};
