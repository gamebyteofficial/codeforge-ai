import { NextResponse } from 'next/server';

// Generate cloud deployment configuration for CodeForge AI
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform') || 'vercel';

  const configs: Record<string, Record<string, string>> = {
    vercel: {
      'vercel.json': JSON.stringify({
        framework: 'nextjs',
        buildCommand: 'npm run build',
        installCommand: 'npm install',
        outputDirectory: '.next',
      }, null, 2),
      '.env.example': `OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
DATABASE_URL=postgresql://user:pass@host:5432/codeforge
NEXTAUTH_SECRET=openssl rand -base64 32`,
    },
    railway: {
      'railway.json': JSON.stringify({
        '$schema': 'https://railway.app/railway.schema.json',
        build: { builder: 'NIXPACKS', buildCommand: 'npm run build' },
        deploy: { startCommand: 'npm run start', restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: 10 },
      }, null, 2),
      '.env.example': `OPENAI_API_KEY=your-key
DATABASE_URL=auto-from-railway-postgres
NEXTAUTH_SECRET=openssl rand -base64 32`,
    },
    render: {
      'render.yaml': `services:
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
    plan: free`,
      '.env.example': `OPENAI_API_KEY=your-key
DATABASE_URL=from-render-postgres
NODE_ENV=production`,
    },
    flyio: {
      'fly.toml': `app = "codeforge-ai"
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
  min_machines_running = 0`,
      'Dockerfile': `FROM node:20-slim AS base
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
CMD ["node", "server.js"]`,
    },
    aws: {
      'amplify.yml': `version: 1
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
      - .next/cache/**/*`,
    },
    gcp: {
      'Dockerfile': `FROM node:20-slim AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]`,
      'cloudbuild.yaml': `steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/codeforge-ai', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/codeforge-ai']
  - name: 'gcr.io/cloud-builders/gcloud'
    args: ['run', 'deploy', 'codeforge-ai', '--image', 'gcr.io/$PROJECT_ID/codeforge-ai', '--region', 'us-central1', '--allow-unauthenticated']`,
    },
  };

  const config = configs[platform];
  if (!config) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 400 });
  }

  return NextResponse.json({
    platform,
    files: config,
    dbMigration: {
      schema: `datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}`,
      steps: [
        'Change prisma/schema.prisma: provider = "postgresql"',
        'Set DATABASE_URL env var to your cloud Postgres URL',
        'Run: npx prisma migrate dev --name init',
        'Run: npx prisma generate',
      ],
    },
  });
}
