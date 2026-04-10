# OpenCode - Custom Claude Code Backend

This is a modified version of Claude Code that connects to a custom backend instead of Anthropic's API.

## Overview

OpenCode allows you to run Claude Code with your own LLM backend while maintaining full feature compatibility:

- ✅ All Claude Code features (Thinking, Computer Use, Tool Search, Prompt Caching)
- ✅ 60+ built-in tools (Bash, FileEdit, Glob, Grep, etc.)
- ✅ Custom model IDs (`opencode-sonnet-4`, `opencode-opus-4`, `opencode-haiku-4`)
- ✅ Streaming responses
- ✅ No Anthropic API calls (analytics, telemetry disabled)
- ✅ No OAuth required (API key auth)

## Quick Start

### 1. Configure Environment

```bash
cp .env.example .env
# Edit .env with your backend URL and API key
```

### 2. Setup Your Backend

Your backend must implement the Anthropic Messages API:

```
POST /v1/messages
Content-Type: application/json
Authorization: Bearer your-api-key
```

Request body:

```json
{
  "model": "opencode-sonnet-4",
  "messages": [{"role": "user", "content": "Hello"}],
  "max_tokens": 4096,
  "tools": [...],
  "thinking": {"type": "enabled", "budget_tokens": 16000}
}
```

Response (streaming SSE):

```
data: {"type": "content_block_start", "index": 0, "content_block": {"type": "thinking", "thinking": ""}}
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "I should analyze..."}}
data: {"type": "content_block_stop", "index": 0}
data: {"type": "content_block_start", "index": 1, "content_block": {"type": "text", "text": ""}}
data: {"type": "content_block_delta", "index": 1, "delta": {"type": "text_delta", "text": "Here's my analysis..."}}
data: [DONE]
```

### 3. Run Claude Code

```bash
# Build the project
npm install
npm run build

# Run with custom backend
./dist/main.js
```

## Backend Requirements

### Minimal Implementation

For basic functionality, your backend needs:

1. **POST /v1/messages** endpoint
2. **Anthropic-compatible request/response format**
3. **SSE streaming support**
4. **Tool use support** (optional but recommended)

### Full Feature Support

For complete Claude Code compatibility:

| Feature        | API Requirement                   | Beta Header                       |
| -------------- | --------------------------------- | --------------------------------- |
| Thinking       | `thinking` parameter in request   | `interleaved-thinking-2025-05-14` |
| Computer Use   | Image input/output blocks         | `computer-use-2025-01-24`         |
| Tool Search    | `defer_loading` in tool schema    | `advanced-tool-use-2025-11-20`    |
| Prompt Caching | `cache_control` in content blocks | `prompt-caching-2025-05-14`       |

### Example Backend (Node.js/Express)

```javascript
const express = require('express');
const app = express();

app.post('/v1/messages', async (req, res) => {
  const { model, messages, tools, thinking, max_tokens } = req.body;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Stream thinking (if enabled)
  if (thinking?.type === 'enabled') {
    res.write(
      `data: ${JSON.stringify({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'thinking', thinking: '' },
      })}\n\n`
    );

    // Stream thinking deltas...
  }

  // Stream response text
  res.write(
    `data: ${JSON.stringify({
      type: 'content_block_start',
      index: 1,
      content_block: { type: 'text', text: '' },
    })}\n\n`
  );

  // Send text deltas...

  // End stream
  res.write('data: [DONE]\n\n');
  res.end();
});

app.listen(3000);
```

## Architecture Changes

### New Files

- `types/anthropic-compat.ts` - Standalone TypeScript types (replaces SDK imports)
- `services/api/custom-client.ts` - HTTP client for custom backend

### Modified Files

- `services/api/client.ts` - Added custom provider support
- `utils/auth.ts` - Added `isCustomMode()` and OAuth bypass
- `utils/model/providers.ts` - Added 'custom' provider type
- `utils/model/configs.ts` - Added OpenCode model configs
- `services/analytics/index.ts` - Skip analytics in custom mode
- `services/analytics/growthbook.ts` - Skip feature flags in custom mode
- `services/mcp/officialRegistry.ts` - Skip MCP registry fetch
- `utils/telemetry/bigqueryExporter.ts` - Skip telemetry in custom mode

### Environment Variables

| Variable                     | Description                 | Required    |
| ---------------------------- | --------------------------- | ----------- |
| `CLAUDE_CODE_USE_CUSTOM`     | Enable custom mode          | Yes         |
| `ANTHROPIC_BASE_URL`         | Your backend URL            | Yes         |
| `ANTHROPIC_API_KEY`          | API key for your backend    | Yes         |
| `OPEN_CODE_DISABLE_EXTERNAL` | Disable Anthropic analytics | Recommended |
| `OPENCODE_DEFAULT_*_MODEL`   | Default model IDs           | No          |

## Model IDs

OpenCode uses custom model IDs that your backend should recognize:

| OpenCode ID         | Description    | Capabilities                  |
| ------------------- | -------------- | ----------------------------- |
| `opencode-sonnet-4` | Balanced model | Thinking, Tools, Computer Use |
| `opencode-opus-4`   | Powerful model | Thinking, Tools, Computer Use |
| `opencode-haiku-4`  | Fast model     | Tools                         |

You can map these to any underlying model in your backend:

```javascript
const MODEL_MAP = {
  'opencode-sonnet-4': 'gpt-4',
  'opencode-opus-4': 'gpt-4-turbo',
  'opencode-haiku-4': 'gpt-3.5-turbo',
  // Or use local models...
  'opencode-sonnet-4': 'llama-3-70b',
};
```

## Troubleshooting

### Connection Errors

```
CLAUDE_CODE_USE_CUSTOM=true
ANTHROPIC_BASE_URL=http://localhost:3000
DEBUG=true
```

### Feature Not Working

Check if your backend sends the correct beta headers:

```javascript
// Request should include:
headers['anthropic-beta'] = 'interleaved-thinking-2025-05-14,advanced-tool-use-2025-11-20';
```

### OAuth Bypass Not Working

Make sure `CLAUDE_CODE_USE_CUSTOM=true` is set before any auth checks:

```bash
export CLAUDE_CODE_USE_CUSTOM=true
export ANTHROPIC_API_KEY=your-key
./claude-code
```

## Development

### Building

```bash
npm install
npm run build
```

### Testing

```bash
# Test with mock backend
npm run test:custom-client

# Test full integration
npm run test:integration
```

### Adding New Models

1. Edit `utils/model/configs.ts`:

```typescript
export const OPENCODE_NEW_MODEL_CONFIG = {
  firstParty: 'new-model',
  bedrock: 'new-model',
  vertex: 'new-model',
  foundry: 'new-model',
  custom: 'opencode-new-model',
} as const satisfies ModelConfig;
```

2. Add to `ALL_MODEL_CONFIGS`

## License

This is a modification of the original Claude Code. Please respect the original license terms.

## Support

For issues related to the custom backend integration:

- Check your backend logs
- Enable `DEBUG=true` in environment
- Verify API format matches Anthropic Messages API
