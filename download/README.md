# CodeForge AI

A powerful, multi-provider AI coding assistant built with Next.js 16. CodeForge AI brings together multiple LLM providers into a single, cohesive chat interface with real-time streaming, live code preview, and a modern developer experience.

---

## Features

- **Multi-LLM Provider Support** — Seamlessly switch between OpenAI, Anthropic, Google Gemini, OpenRouter, OpenCode Zen, DeepSeek, Qwen, and Mistral
- **Streaming Chat with SSE** — Real-time token-by-token responses via Server-Sent Events for a fluid conversation experience
- **Live Preview** — Instantly preview generated HTML, CSS, and JavaScript in an embedded sandboxed iframe
- **App Router Architecture** — Built on Next.js 16 App Router with React Server Components for optimal performance
- **TypeScript 5** — Full type safety across the entire codebase
- **Tailwind CSS 4 + shadcn/ui** — Utility-first styling with beautifully crafted, accessible UI components
- **Prisma ORM + SQLite** — Zero-config database setup with type-safe queries and easy migrations
- **Zustand State Management** — Lightweight, scalable client-side state with minimal boilerplate

---

## Prerequisites

| Requirement | Version  |
|-------------|----------|
| Node.js     | 18+      |
| Bun         | 1.0+ (recommended) or npm 9+ |

> **Why Bun?** Bun offers significantly faster installs and native TypeScript execution. npm works as a fallback if you prefer.

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-org/codeforge-ai.git
cd codeforge-ai
```

### 2. Install dependencies

Using **Bun** (recommended):

```bash
bun install
```

Using **npm**:

```bash
npm install
```

### 3. Set up the database

```bash
# Generate the Prisma client
bunx prisma generate

# Run migrations to create the SQLite database
bunx prisma db push
```

If you prefer npm, replace `bunx` with `npx`:

```bash
npx prisma generate
npx prisma db push
```

---

## Environment Setup

Create a `.env.local` file in the project root and add your API keys for the providers you want to use:

```env
# ── LLM Provider API Keys ──────────────────────────────
# Add only the keys for providers you intend to use.

OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GEMINI_API_KEY=AIza...
OPENROUTER_API_KEY=sk-or-...
OPENCODE_ZEN_API_KEY=...
DEEPSEEK_API_KEY=sk-...
QWEN_API_KEY=sk-...
MISTRAL_API_KEY=...

# ── App Configuration ──────────────────────────────────
# The base URL of your running application (used for SSE callbacks).
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Tip:** You don't need every key — only configure the providers you plan to use. The app gracefully handles missing keys and will show only the available providers in the UI.

---

## Running the Dev Server

### Start the development server

Using **Bun**:

```bash
bun dev
```

Using **npm**:

```bash
npm run dev
```

The app will be available at **http://localhost:3000**.

### Useful scripts

| Command               | Description                              |
|-----------------------|------------------------------------------|
| `bun dev`             | Start the development server             |
| `bun build`           | Create an optimized production build     |
| `bun start`           | Start the production server              |
| `bunx prisma studio`  | Open Prisma Studio to browse your DB     |

---

## Project Structure (Overview)

```
codeforge-ai/
├── prisma/               # Prisma schema and migrations
│   └── schema.prisma     # Database schema (SQLite)
├── src/
│   ├── app/              # Next.js App Router pages & layouts
│   ├── components/       # Reusable UI components (shadcn/ui)
│   ├── lib/              # Utilities, helpers, and configurations
│   ├── stores/           # Zustand state stores
│   └── types/            # Shared TypeScript type definitions
├── public/               # Static assets
├── .env.local            # Environment variables (create this)
├── next.config.ts        # Next.js configuration
├── tailwind.config.ts    # Tailwind CSS configuration
└── tsconfig.json         # TypeScript configuration
```

---

## License

MIT
