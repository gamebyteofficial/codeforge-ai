'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Cloud,
  Server,
  Globe,
  Database,
  Copy,
  CheckCircle2,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Shield,
  Zap,
  DollarSign,
  HardDrive,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Cloud platform definitions ──
interface CloudPlatform {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Advanced';
  free: boolean;
  price: string;
  url: string;
  features: string[];
  steps: string[];
  envVars: { key: string; desc: string }[];
  commands: string[];
}

const CLOUD_PLATFORMS: CloudPlatform[] = [
  {
    id: 'vercel',
    name: 'Vercel',
    icon: '▲',
    color: 'text-zinc-100',
    description: 'Zero-config deployment. Best for Next.js apps.',
    difficulty: 'Easy',
    free: true,
    price: 'Free tier: 100GB bandwidth/mo',
    url: 'https://vercel.com/new',
    features: ['Auto-deploy from Git', 'Edge functions', 'Preview deployments', 'Custom domains', 'SSL included'],
    steps: [
      'Push your code to GitHub/GitLab/Bitbucket',
      'Go to vercel.com/new and import your repo',
      'Add environment variables (API keys)',
      'Click Deploy — done in 60 seconds!',
    ],
    envVars: [
      { key: 'OPENAI_API_KEY', desc: 'Your OpenAI API key' },
      { key: 'ANTHROPIC_API_KEY', desc: 'Your Anthropic API key (optional)' },
      { key: 'DATABASE_URL', desc: 'PostgreSQL connection string (Vercel Postgres)' },
    ],
    commands: [
      'npm i -g vercel',
      'vercel login',
      'vercel --prod',
    ],
  },
  {
    id: 'railway',
    name: 'Railway',
    icon: '🚂',
    color: 'text-purple-400',
    description: 'Full-stack platform with database. Easy deploy from GitHub.',
    difficulty: 'Easy',
    free: true,
    price: 'Free trial: $5 credit, then usage-based',
    url: 'https://railway.app/new',
    features: ['Auto-deploy from Git', 'Built-in PostgreSQL', 'Persistent volumes', 'Cron jobs', 'Private networking'],
    steps: [
      'Go to railway.app/new and sign up',
      'Click "Deploy from GitHub repo"',
      'Select your CodeForge AI repo',
      'Add a PostgreSQL database service',
      'Add environment variables',
      'Railway auto-deploys on push!',
    ],
    envVars: [
      { key: 'OPENAI_API_KEY', desc: 'Your LLM API key' },
      { key: 'DATABASE_URL', desc: 'Auto-provided by Railway Postgres' },
      { key: 'NEXTAUTH_SECRET', desc: 'Random secret for auth (openssl rand -base64 32)' },
    ],
    commands: [
      'npm i -g @railway/cli',
      'railway login',
      'railway init',
      'railway up',
    ],
  },
  {
    id: 'render',
    name: 'Render',
    icon: '🟢',
    color: 'text-green-400',
    description: 'Cloud platform with free tier. Great for full-stack apps.',
    difficulty: 'Easy',
    free: true,
    price: 'Free tier available (web service)',
    url: 'https://render.com',
    features: ['Auto-deploy from Git', 'Free PostgreSQL (90 days)', 'Background workers', 'Cron jobs', 'Docker support'],
    steps: [
      'Go to dashboard.render.com and sign up',
      'Click "New" → "Web Service"',
      'Connect your GitHub repo',
      'Build Command: npm run build',
      'Start Command: npm run start',
      'Add environment variables and deploy',
    ],
    envVars: [
      { key: 'OPENAI_API_KEY', desc: 'Your LLM API key' },
      { key: 'DATABASE_URL', desc: 'Render PostgreSQL connection string' },
      { key: 'NODE_ENV', desc: 'production' },
    ],
    commands: [
      '# Deploy via Render Dashboard',
      '# Or use render.yaml in repo root:',
      'render deploy',
    ],
  },
  {
    id: 'flyio',
    name: 'Fly.io',
    icon: '🪁',
    color: 'text-red-400',
    description: 'Run apps close to users. Fast global deployment.',
    difficulty: 'Medium',
    free: true,
    price: 'Free tier: 3 shared VMs',
    url: 'https://fly.io',
    features: ['Global edge deployment', 'Persistent volumes', 'Built-in Postgres', 'Private networking', 'Docker-based'],
    steps: [
      'Install flyctl: curl -L https://fly.io/install.sh | sh',
      'Run: flyctl auth login',
      'Run: flyctl launch (auto-detects Next.js)',
      'Add a PostgreSQL database: flyctl postgres create',
      'Set secrets: flyctl secrets set KEY=VALUE',
      'Deploy: flyctl deploy',
    ],
    envVars: [
      { key: 'OPENAI_API_KEY', desc: 'Your LLM API key' },
      { key: 'DATABASE_URL', desc: 'Fly.io Postgres connection string' },
    ],
    commands: [
      'curl -L https://fly.io/install.sh | sh',
      'flyctl auth login',
      'flyctl launch',
      'flyctl postgres create',
      'flyctl secrets set OPENAI_API_KEY=sk-xxx',
      'flyctl deploy',
    ],
  },
  {
    id: 'aws',
    name: 'AWS (Amplify)',
    icon: '☁️',
    color: 'text-orange-400',
    description: 'Enterprise-grade. Full AWS ecosystem access.',
    difficulty: 'Advanced',
    free: true,
    price: 'Free tier: 12 months (EC2 micro)',
    url: 'https://aws.amazon.com/amplify/',
    features: ['Auto-scaling', 'RDS PostgreSQL', 'S3 storage', 'CloudFront CDN', 'IAM security'],
    steps: [
      'Go to AWS Amplify Console',
      'Click "New app" → "Host web app"',
      'Connect your GitHub/GitLab repo',
      'Configure build settings (auto-detected)',
      'Add environment variables in Amplify console',
      'Deploy — AWS handles the rest',
    ],
    envVars: [
      { key: 'OPENAI_API_KEY', desc: 'Your LLM API key' },
      { key: 'DATABASE_URL', desc: 'RDS PostgreSQL connection string' },
      { key: 'AWS_REGION', desc: 'e.g., us-east-1' },
    ],
    commands: [
      'npm i -g @aws-amplify/cli',
      'amplify init',
      'amplify add hosting',
      'amplify publish',
    ],
  },
  {
    id: 'gcp',
    name: 'Google Cloud',
    icon: '🌐',
    color: 'text-blue-400',
    description: 'Run on Cloud Run. Serverless with auto-scaling.',
    difficulty: 'Advanced',
    free: true,
    price: 'Free tier: 2M requests/mo on Cloud Run',
    url: 'https://cloud.google.com/run',
    features: ['Cloud Run serverless', 'Cloud SQL Postgres', 'Firestore', 'Global CDN', 'IAM security'],
    steps: [
      'Install gcloud CLI',
      'Create a GCP project: gcloud projects create codeforge-ai',
      'Build Docker image: gcloud builds submit --tag gcr.io/PROJECT_ID/codeforge',
      'Deploy to Cloud Run: gcloud run deploy --image gcr.io/PROJECT_ID/codeforge',
      'Set environment variables in Cloud Run console',
      'Your app is live at .run.app URL',
    ],
    envVars: [
      { key: 'OPENAI_API_KEY', desc: 'Your LLM API key' },
      { key: 'DATABASE_URL', desc: 'Cloud SQL connection string' },
      { key: 'GOOGLE_CLOUD_PROJECT', desc: 'Your GCP project ID' },
    ],
    commands: [
      'gcloud auth login',
      'gcloud config set project codeforge-ai',
      'gcloud builds submit --tag gcr.io/codeforge-ai/app',
      'gcloud run deploy codeforge-ai --image gcr.io/codeforge-ai/app',
    ],
  },
];

// ── Database migration info ──
const DB_MIGRATION = {
  title: 'Database Setup for Cloud',
  steps: [
    'Schema already uses PostgreSQL (done!)',
    'Set DATABASE_URL env var to your cloud Postgres URL',
    'Run: npx prisma migrate dev --name init',
    'Run: npx prisma generate',
  ],
  schema: `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}`,
};

export default function CloudSetup() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('vercel');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isGeneratingConfig, setIsGeneratingConfig] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const platform = CLOUD_PLATFORMS.find((p) => p.id === selectedPlatform) ?? CLOUD_PLATFORMS[0];

  const handleCopy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  const handleDeployClick = useCallback(() => {
    window.open(platform.url, '_blank', 'noopener,noreferrer');
    toast.success(`Opening ${platform.name}...`, {
      description: 'Complete the deployment on their website.',
    });
  }, [platform]);

  const handleDownloadConfig = useCallback(async () => {
    setIsGeneratingConfig(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const folder = zip.folder(`codeforge-cloud-${platform.id}`)!;

      // Platform-specific config files
      if (platform.id === 'vercel') {
        folder.file('vercel.json', JSON.stringify({
          framework: 'nextjs',
          buildCommand: 'npm run build',
          installCommand: 'npm install',
          outputDirectory: '.next',
          env: Object.fromEntries(platform.envVars.map((v) => [v.key, ''])),
        }, null, 2));
      }

      if (platform.id === 'flyio') {
        folder.file('fly.toml', `app = "codeforge-ai"
primary_region = "sjc"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0
`);
        folder.file('Dockerfile', `FROM node:20-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
`);
      }

      if (platform.id === 'render') {
        folder.file('render.yaml', `services:
  - type: web
    name: codeforge-ai
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npm run start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: codeforge-db
          property: connectionString
      - key: OPENAI_API_KEY
        sync: false

databases:
  - name: codeforge-db
    plan: free
`);
      }

      if (platform.id === 'aws') {
        folder.file('amplify.yml', `version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
        - npx prisma generate
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
`);
      }

      if (platform.id === 'gcp') {
        folder.file('Dockerfile', `FROM node:20-slim AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
`);
        folder.file('.gcloudignore', `node_modules
.next
.git
*.log
`);
        folder.file('cloudbuild.yaml', `steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/codeforge-ai', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/codeforge-ai']
  - name: 'gcr.io/cloud-builders/gcloud'
    args: ['run', 'deploy', 'codeforge-ai', '--image', 'gcr.io/$PROJECT_ID/codeforge-ai', '--region', 'us-central1', '--allow-unauthenticated']
`);
      }

      if (platform.id === 'railway') {
        folder.file('railway.json', JSON.stringify({
          '$schema': 'https://railway.app/railway.schema.json',
          build: {
            builder: 'NIXPACKS',
            buildCommand: 'npm run build',
          },
          deploy: {
            startCommand: 'npm run start',
            restartPolicyType: 'ON_FAILURE',
            restartPolicyMaxRetries: 10,
          },
        }, null, 2));
      }

      // Common files
      folder.file('.env.example', platform.envVars.map((v) => `${v.key}=your-value-here`).join('\n'));

      folder.file('DEPLOY.md', `# Deploy CodeForge AI to ${platform.name}

## Quick Deploy
${platform.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## Environment Variables
${platform.envVars.map((v) => `- \`${v.key}\` — ${v.desc}`).join('\n')}

## CLI Commands
\`\`\`bash
${platform.commands.join('\n')}
\`\`\`

## Database Migration (SQLite → PostgreSQL)
For production cloud deployment, switch from SQLite to PostgreSQL:

${DB_MIGRATION.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Update your \`prisma/schema.prisma\`:
\`\`\`prisma
${DB_MIGRATION.schema}
\`\`\`

## URLs
- Deploy: ${platform.url}
- Pricing: ${platform.price}
`);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `codeforge-cloud-${platform.id}-config.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Cloud config downloaded!', {
        description: `codeforge-cloud-${platform.id}-config.zip`,
      });
    } catch (error) {
      console.error('Config generation failed:', error);
      toast.error('Failed to generate config');
    } finally {
      setIsGeneratingConfig(false);
    }
  }, [platform]);

  const difficultyColor = (d: string) => {
    if (d === 'Easy') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (d === 'Medium') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    return 'text-red-400 bg-red-500/10 border-red-500/20';
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-zinc-400 hover:text-emerald-400"
        >
          <Cloud className="size-3.5" />
          <span className="hidden sm:inline">Cloud</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="border-zinc-700 bg-zinc-900 sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Cloud className="size-5 text-emerald-400" />
            Deploy to Cloud
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Deploy CodeForge AI to any cloud platform. Choose your preferred provider below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-4">
          {/* ── One-Click Deploy to Vercel ── */}
          <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-zinc-900 ring-1 ring-zinc-700">
                <span className="text-lg font-bold">▲</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">One-Click Deploy to Vercel</h3>
                <p className="text-[11px] text-zinc-400">Fastest way to go live — free tier available</p>
              </div>
            </div>
            <p className="text-xs text-zinc-400 mb-3">
              Push your code to GitHub first, then click below. Vercel auto-detects Next.js and handles everything.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => {
                  window.open('https://vercel.com/new', '_blank', 'noopener,noreferrer');
                  toast.success('Opening Vercel...', { description: 'Import your GitHub repo to deploy.' });
                }}
                className="flex-1 bg-zinc-100 text-zinc-900 hover:bg-white gap-2 font-semibold"
              >
                <span className="text-base">▲</span>
                Deploy to Vercel
              </Button>
              <Button
                onClick={async () => {
                  // Generate a complete deployment package
                  try {
                    const JSZip = (await import('jszip')).default;
                    const zip = new JSZip();
                    
                    // Full .env.example
                    zip.file('.env.example', `# Required for Vercel
DATABASE_URL=postgresql://user:password@host:5432/dbname
OPENAI_API_KEY=sk-your-key
NEXTAUTH_SECRET=run-openssl-rand-base64-32

# Optional
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
OPENROUTER_API_KEY=
`);
                    
                    // vercel.json
                    zip.file('vercel.json', JSON.stringify({
                      framework: 'nextjs',
                      buildCommand: 'prisma generate && next build',
                      installCommand: 'npm install',
                    }, null, 2));
                    
                    // Step-by-step instructions
                    zip.file('DEPLOY-STEPS.md', `# Deploy CodeForge AI to Vercel

## Prerequisites
- GitHub account
- Vercel account (free at vercel.com)

## Steps

### 1. Push to GitHub
\`\`\`bash
git init
git add .
git commit -m "CodeForge AI"
git remote add origin https://github.com/YOUR-USERNAME/codeforge-ai.git
git push -u origin main
\`\`\`

### 2. Go to vercel.com/new
- Click "Import" on your repo
- Framework: Next.js (auto-detected)

### 3. Add Environment Variables
| Key | Value |
|-----|-------|
| DATABASE_URL | Your PostgreSQL URL |
| OPENAI_API_KEY | Your API key |
| NEXTAUTH_SECRET | Random secret |

### 4. Create Vercel Postgres Database
- Go to Storage tab → Create Database → Postgres (Free)
- Vercel auto-adds DATABASE_URL

### 5. Click Deploy!
Your app will be live in ~60 seconds.

## Post-Deploy
- Run migrations: vercel env pull && npx prisma migrate deploy
- Custom domain: Settings → Domains
`);

                    const blob = await zip.generateAsync({ type: 'blob' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'codeforge-vercel-deploy.zip';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    toast.success('Deployment guide downloaded!');
                  } catch (err) {
                    console.error(err);
                    toast.error('Failed to generate deployment package');
                  }
                }}
                variant="outline"
                className="flex-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-2"
              >
                <HardDrive className="size-4" />
                Download Deploy Guide
              </Button>
            </div>
          </div>

          {/* ── Platform selector ── */}
          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Choose Platform
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {CLOUD_PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlatform(p.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all ${
                    selectedPlatform === p.id
                      ? 'border-emerald-500/40 bg-emerald-500/10 ring-1 ring-emerald-500/20'
                      : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600 hover:bg-zinc-800/60'
                  }`}
                >
                  <span className="text-lg">{p.icon}</span>
                  <span className="text-[10px] font-medium text-zinc-300 truncate w-full text-center">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Selected platform details ── */}
          <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-4 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-zinc-800 text-xl">
                  {platform.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">{platform.name}</h3>
                  <p className="text-xs text-zinc-400">{platform.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${difficultyColor(platform.difficulty)}`}>
                  {platform.difficulty}
                </span>
                {platform.free && (
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    Free tier
                  </span>
                )}
              </div>
            </div>

            {/* Features */}
            <div className="flex flex-wrap gap-1.5">
              {platform.features.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 rounded-md bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-400"
                >
                  <Zap className="size-2.5 text-emerald-500/60" />
                  {f}
                </span>
              ))}
            </div>

            {/* Price */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <DollarSign className="size-3" />
              {platform.price}
            </div>
          </div>

          {/* ── Step-by-step guide ── */}
          <div>
            <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <ArrowRight className="size-3" />
              Deployment Steps
            </h4>
            <div className="space-y-1.5">
              {platform.steps.map((step, i) => (
                <button
                  key={i}
                  onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                  className="flex w-full items-start gap-2.5 rounded-lg border border-zinc-700/30 bg-zinc-800/20 p-2.5 text-left transition-colors hover:bg-zinc-800/40"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-bold text-emerald-400">
                    {i + 1}
                  </span>
                  <span className="text-xs text-zinc-300 pt-0.5">{step}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── CLI Commands ── */}
          <div>
            <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Server className="size-3" />
              CLI Commands
            </h4>
            <div className="relative rounded-lg border border-zinc-700/50 bg-zinc-950/80 p-3">
              <pre className="font-mono text-[11px] text-zinc-400 whitespace-pre-wrap">
                {platform.commands.join('\n')}
              </pre>
              <button
                onClick={() => handleCopy(platform.commands.join('\n'), 'commands')}
                className="absolute right-2 top-2 rounded-md bg-zinc-800 p-1.5 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300"
              >
                {copiedKey === 'commands' ? (
                  <CheckCircle2 className="size-3 text-emerald-400" />
                ) : (
                  <Copy className="size-3" />
                )}
              </button>
            </div>
          </div>

          {/* ── Environment Variables ── */}
          <div>
            <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Shield className="size-3" />
              Environment Variables
            </h4>
            <div className="space-y-1.5">
              {platform.envVars.map((ev) => (
                <div
                  key={ev.key}
                  className="flex items-center gap-2 rounded-md border border-zinc-700/30 bg-zinc-800/20 px-3 py-2"
                >
                  <code className="shrink-0 font-mono text-[11px] text-emerald-400">{ev.key}</code>
                  <span className="text-[10px] text-zinc-600">—</span>
                  <span className="text-[11px] text-zinc-500">{ev.desc}</span>
                  <button
                    onClick={() => handleCopy(ev.key, ev.key)}
                    className="ml-auto shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    {copiedKey === ev.key ? (
                      <CheckCircle2 className="size-3 text-emerald-400" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Database Migration ── */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Database className="size-4 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">Database Setup</span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">✓ PostgreSQL ready</span>
            </div>
            <p className="text-[11px] text-zinc-400 mb-2">
              Your Prisma schema is already configured for PostgreSQL. Just set the DATABASE_URL:
            </p>
            <div className="relative rounded-md bg-zinc-950/60 p-2">
              <pre className="font-mono text-[10px] text-zinc-500 whitespace-pre">{DB_MIGRATION.schema}</pre>
              <button
                onClick={() => handleCopy(DB_MIGRATION.schema, 'db-schema')}
                className="absolute right-1.5 top-1.5 rounded bg-zinc-800 p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                {copiedKey === 'db-schema' ? (
                  <CheckCircle2 className="size-3 text-emerald-400" />
                ) : (
                  <Copy className="size-3" />
                )}
              </button>
            </div>
          </div>

          {/* ── Action buttons ── */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleDeployClick}
              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-500 gap-2"
            >
              <ExternalLink className="size-4" />
              Deploy on {platform.name}
            </Button>
            <Button
              onClick={handleDownloadConfig}
              disabled={isGeneratingConfig}
              variant="outline"
              className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 gap-2"
            >
              {isGeneratingConfig ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <HardDrive className="size-4" />
              )}
              Download Config
            </Button>
          </div>

          {/* ── Comparison table ── */}
          <div>
            <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Globe className="size-3" />
              Quick Comparison
            </h4>
            <div className="overflow-x-auto rounded-lg border border-zinc-700/50">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-zinc-700/50 bg-zinc-800/40">
                    <th className="px-3 py-2 text-left text-zinc-400 font-medium">Platform</th>
                    <th className="px-3 py-2 text-left text-zinc-400 font-medium">Difficulty</th>
                    <th className="px-3 py-2 text-left text-zinc-400 font-medium">Free Tier</th>
                    <th className="px-3 py-2 text-left text-zinc-400 font-medium">Database</th>
                  </tr>
                </thead>
                <tbody>
                  {CLOUD_PLATFORMS.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-b border-zinc-800/50 cursor-pointer transition-colors ${
                        selectedPlatform === p.id ? 'bg-emerald-500/5' : 'hover:bg-zinc-800/30'
                      }`}
                      onClick={() => setSelectedPlatform(p.id)}
                    >
                      <td className="px-3 py-2 text-zinc-300">
                        <span className="mr-1.5">{p.icon}</span>
                        {p.name}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${difficultyColor(p.difficulty)}`}>
                          {p.difficulty}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-400">
                        {p.free ? '✅ Yes' : '❌ No'}
                      </td>
                      <td className="px-3 py-2 text-zinc-400">
                        {p.id === 'vercel' ? 'Vercel Postgres' :
                         p.id === 'railway' ? 'Built-in Postgres' :
                         p.id === 'render' ? 'Free Postgres (90d)' :
                         p.id === 'flyio' ? 'Built-in Postgres' :
                         p.id === 'aws' ? 'RDS Postgres' :
                         'Cloud SQL'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
