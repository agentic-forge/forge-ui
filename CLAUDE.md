# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
bun dev              # Start dev server at http://localhost:5173

# Build & Check
bun run build        # Type-check then build (vue-tsc -b && vite build)
bun run type-check   # Type-check only (vue-tsc --noEmit)
bun run lint         # ESLint with auto-fix

# Preview production build
bun run preview
```

## Architecture

Vue 3 chat interface for the Agentic Forge platform. Communicates with `forge-orchestrator` backend via REST + Server-Sent Events.

### Key Patterns

**Singleton Composable Pattern**: `useConversation()` uses module-level refs to maintain global state across components. All conversation state (messages, streaming status, tool calls) lives here.

**SSE Streaming**: `useSSE()` handles real-time streaming from the orchestrator. Events flow: `token` → `thinking` → `tool_call` → `tool_result` → `complete`. The composable exposes debug events for the debug panel.

**Type Alignment**: Types in `src/types/` mirror Python Pydantic models in `forge-orchestrator`. When backend schemas change, update both.

### Structure

```
src/
├── composables/          # Shared state and logic
│   ├── useConversation   # Global conversation state (singleton)
│   ├── useSSE            # SSE connection management
│   └── useTheme          # Dark/light mode toggle
├── types/                # TypeScript interfaces
│   ├── messages          # SSE event types
│   └── conversation      # API types (match orchestrator)
├── views/ChatView        # Main chat view
└── components/           # UI components
```

### Backend Integration

Connects to `forge-orchestrator` (Pydantic AI agent loop) which routes to `forge-armory` (MCP gateway) for tools.

```
forge-ui → forge-orchestrator → forge-armory → MCP servers
         (REST+SSE)           (MCP client)    (weather, search, etc.)
```

**API URL**: `VITE_API_URL` env var or defaults to `http://localhost:8001`

**Key Endpoints** (see `forge-orchestrator/README.md` for full list):
- `POST /conversations` - Create conversation (returns `{ id, model, system_prompt }`, NOT full conversation)
- `GET /conversations/{id}` - Get full conversation with `{ metadata, messages }`
- `GET /conversations/{id}/stream?message=...` - SSE streaming
- `PATCH /conversations/{id}/system-prompt` - Update system prompt (returns full conversation)
- `DELETE /conversations/{id}/messages/{n}` - Delete from message N (returns full conversation)
- `GET /health` - Returns `{ status: "ok", armory_available: bool }`
- `POST /tools/refresh` - Reload tools from Armory

**SSE Events**: `token`, `thinking`, `tool_call`, `tool_result`, `complete`, `error`, `ping`

**API Response Notes**:
- `POST /conversations` returns minimal response - must call `GET /conversations/{id}` to get full data
- Health status is `"ok"` not `"healthy"`, field is `armory_available` not `armory_connected`

### UI Framework

PrimeVue 4 with Aura theme, customized with violet primary color. Dark mode via `.app-dark` class on `<html>`.
