# CodeForge AI 🚀

**Autonomous AI Coding Agent** — Build apps, websites, and games from natural language instructions.

![CodeForge AI](https://img.shields.io/badge/Next.js-16-black?logo=next.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript) ![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- 🤖 **AI Code Generation** — Multi-provider LLM streaming (OpenAI, Anthropic, Google, etc.)
- 🎨 **Live Preview** — Real-time HTML/CSS/JS rendering with iframe sandbox
- 📁 **Project Management** — Create, organize, and manage multiple projects
- ✏️ **Code Editor** — Built-in editor with syntax highlighting
- 🖥️ **Desktop App** — Installable via PWA or Electron
- ☁️ **Cloud Deploy** — One-click deploy to Vercel, Railway, Render
- 📱 **Responsive** — Works on desktop, tablet, and mobile
- 🌙 **Dark Mode** — Beautiful dark theme with emerald accents

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ or [Bun](https://bun.sh)
- An API key from any supported LLM provider

### Install & Run

```bash
# Clone the repo
git clone https://github.com/YOUR-USERNAME/codeforge-ai.git
cd codeforge-ai

# Install dependencies
npm install

# Set up database
npx prisma db push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter your API key!

## ☁️ Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR-USERNAME/codeforge-ai&env=DATABASE_URL,OPENAI_API_KEY&project-name=codeforge-ai&repository-name=codeforge-ai)

### Environment Variables for Vercel

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `OPENAI_API_KEY` | ✅ | Your OpenAI API key |
| `ANTHROPIC_API_KEY` | ⬜ | Anthropic API key (optional) |
| `NEXTAUTH_SECRET` | ✅ | Random secret (`openssl rand -base64 32`) |

### Vercel Postgres Setup
1. After deploying, go to **Storage** tab in Vercel dashboard
2. Click **Create Database** → **Postgres** (Free tier)
3. Vercel auto-adds `DATABASE_URL` to your env vars
4. Run `prisma migrate deploy` via Vercel CLI or add to build command

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| Next.js 16 | React framework with App Router |
| TypeScript 5 | Type-safe development |
| Prisma | Database ORM (SQLite/PostgreSQL) |
| Tailwind CSS 4 | Utility-first styling |
| shadcn/ui | UI component library |
| Zustand | State management |
| Framer Motion | Animations |
| z-ai-web-dev-sdk | AI integration SDK |

## 📦 Desktop App

### PWA Install (Recommended)
1. Open CodeForge AI in Chrome/Edge
2. Click the install icon in the address bar
3. Or click **"Desktop App"** → **"Install as Desktop App"**

### Electron Build
```bash
# Development
npm run electron:dev

# Build for production
npm run electron:build
```

## 🤝 Supported LLM Providers

| Provider | Free Models | Paid Models |
|----------|------------|-------------|
| OpenCode Zen | ✅ 6 free models | ✅ Claude, GPT-4, etc. |
| OpenRouter | ⬜ | ✅ 200+ models |
| OpenAI | ⬜ | ✅ GPT-4o, GPT-4 |
| Anthropic | ⬜ | ✅ Claude 3.5 Sonnet |
| Google | ⬜ | ✅ Gemini Pro |
| Groq | ⬜ | ✅ Llama 3.3 70B |
| Together AI | ⬜ | ✅ Open-source models |

## 📄 License

MIT License — feel free to use, modify, and distribute.
