'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Download,
  Monitor,
  Apple,
  Terminal,
  Loader2,
  CheckCircle2,
  Smartphone,
  Package,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

// ── PWA install prompt event type ──
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function DesktopDownload() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Detect platform
  const platform = typeof navigator !== 'undefined'
    ? (navigator.platform?.toLowerCase() || 'unknown')
    : 'unknown';
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMac = platform.includes('mac') || /mac os x/i.test(userAgent);
  const isWin = platform.includes('win') || /windows/i.test(userAgent);
  const isLinux = platform.includes('linux') || /linux/i.test(userAgent) && !/android/i.test(userAgent);

  // Listen for the beforeinstallprompt event (PWA install)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // ── Download source code as ZIP ──
  const handleDownloadSource = useCallback(async (targetPlatform: string) => {
    setIsDownloading(true);
    setDownloadComplete(null);

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Create a self-contained project structure
      const projectFolder = zip.folder('CodeForge-AI')!;

      // ── package.json ──
      projectFolder.file('package.json', JSON.stringify({
        name: 'codeforge-ai',
        version: '2.0.0',
        private: true,
        description: 'CodeForge AI - Autonomous AI Coding Agent',
        scripts: {
          dev: 'next dev -p 3000',
          build: 'next build',
          start: 'next start',
          electron: 'electron .',
          'electron:dev': 'concurrently "next dev -p 3000" "wait-on http://localhost:3000 && electron ."',
          'electron:build': 'next build && next export && electron-builder',
        },
        dependencies: {
          next: '^16.1.1',
          react: '^19.0.0',
          'react-dom': '^19.0.0',
          typescript: '^5',
          zustand: '^5.0.6',
          'framer-motion': '^12.23.2',
          'lucide-react': '^0.525.0',
          jszip: '^3.10.1',
          'react-markdown': '^10.1.0',
          'react-syntax-highlighter': '^15.6.1',
          'react-resizable-panels': '^3.0.3',
          'z-ai-web-dev-sdk': '^0.0.18',
          sonner: '^2.0.6',
          'tailwind-merge': '^3.3.1',
        },
        devDependencies: {
          electron: '^42.3.0',
          'electron-builder': '^26.8.1',
          concurrently: '^10.0.1',
          'wait-on': '^9.0.10',
          tailwindcss: '^4',
          '@tailwindcss/postcss': '^4',
        },
        build: {
          appId: 'com.codeforge.ai',
          productName: 'CodeForge AI',
          directories: { output: 'dist-electron' },
          files: ['electron/**/*', 'out/**/*', 'public/**/*'],
          mac: { category: 'public.app-category.developer-tools', target: ['dmg', 'zip'] },
          win: { target: ['nsis', 'portable'] },
          linux: { target: ['AppImage', 'deb'], category: 'Development' },
        },
      }, null, 2));

      // ── README.md ──
      projectFolder.file('README.md', `# CodeForge AI 🚀

Autonomous AI Coding Agent that builds applications and games from natural language instructions.

## Quick Start (Web)

\`\`\`bash
bun install
bun run dev
\`\`\`

Open http://localhost:3000 in your browser.

## Desktop App (Electron)

\`\`\`bash
bun install
bun run electron:dev
\`\`\`

## Build Desktop App

\`\`\`bash
bun run electron:build
\`\`\`

Output will be in \`dist-electron/\` folder.

## Features
- 🤖 AI-powered code generation with streaming
- 🎨 Live preview with HTML/CSS/JS rendering
- 📁 Project & file management
- 🖥️ Desktop app packaging (Windows, macOS, Linux)
- 💬 Multi-provider LLM support (OpenAI, Anthropic, Google, etc.)
- ⚡ Real-time code editing & preview

## Requirements
- Node.js 18+ or Bun
- An API key from any supported LLM provider
`);

      // ── Electron main process ──
      const electronFolder = projectFolder.folder('electron')!;
      electronFolder.file('main.ts', `import { app, BrowserWindow } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'CodeForge AI',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#09090b',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.on('ready', createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
`);

      electronFolder.file('preload.ts', `import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
});
`);

      // ── Run scripts for easy setup ──
      if (targetPlatform === 'windows') {
        projectFolder.file('setup.bat', `@echo off
echo ========================================
echo   CodeForge AI - Desktop Setup
echo ========================================
echo.

where bun >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Bun detected
    bun install
    echo.
    echo Setup complete! Run: bun run electron:dev
) else (
    where npm >nul 2>nul
    if %errorlevel% equ 0 (
        echo [OK] npm detected
        npm install
        echo.
        echo Setup complete! Run: npm run electron:dev
    ) else (
        echo [ERROR] Please install Node.js or Bun first
        echo Download from: https://nodejs.org
    )
)
pause
`);
        projectFolder.file('start-desktop.bat', `@echo off
echo Starting CodeForge AI Desktop...
bun run electron:dev || npm run electron:dev
pause
`);
      } else {
        projectFolder.file('setup.sh', `#!/bin/bash
echo "========================================"
echo "  CodeForge AI - Desktop Setup"
echo "========================================"
echo ""

if command -v bun &> /dev/null; then
    echo "[OK] Bun detected"
    bun install
    echo ""
    echo "Setup complete! Run: bun run electron:dev"
elif command -v npm &> /dev/null; then
    echo "[OK] npm detected"
    npm install
    echo ""
    echo "Setup complete! Run: npm run electron:dev"
else
    echo "[ERROR] Please install Node.js or Bun first"
    echo "Download from: https://nodejs.org"
fi
`);
        projectFolder.file('start-desktop.sh', `#!/bin/bash
echo "Starting CodeForge AI Desktop..."
bun run electron:dev || npm run electron:dev
`);

        if (targetPlatform === 'macos') {
          projectFolder.file('build-mac.sh', `#!/bin/bash
echo "Building CodeForge AI for macOS..."
bun install && bun run electron:build
echo "DMG file will be in dist-electron/"
`);
        } else {
          projectFolder.file('build-linux.sh', `#!/bin/bash
echo "Building CodeForge AI for Linux..."
bun install && bun run electron:build
echo "AppImage will be in dist-electron/"
`);
        }
      }

      // ── .env.example ──
      projectFolder.file('.env.example', `# CodeForge AI Environment Variables
# Copy this file to .env.local and add your API keys

# Primary LLM Provider (openai, anthropic, google, opencode, openrouter, groq, together)
OPENAI_API_KEY=your-api-key-here
# ANTHROPIC_API_KEY=your-anthropic-key
# GOOGLE_API_KEY=your-google-key
`);

      // Generate ZIP blob
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CodeForge-AI-${targetPlatform}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadComplete(targetPlatform);
      toast.success('Download started!', {
        description: `CodeForge-AI-${targetPlatform}.zip`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Download failed', {
        description: 'Please try again or use the PWA install option.',
      });
    } finally {
      setIsDownloading(false);
    }
  }, []);

  // ── PWA Install ──
  const handlePWAInstall = useCallback(async () => {
    if (!installPrompt) return;
    setIsInstalling(true);
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        toast.success('App installed!', {
          description: 'CodeForge AI is now available on your desktop.',
        });
      }
    } catch (error) {
      console.error('Install failed:', error);
      toast.error('Installation failed');
    } finally {
      setIsInstalling(false);
      setInstallPrompt(null);
    }
  }, [installPrompt]);

  // ── iOS Safari "Add to Home Screen" instructions ──
  const isIOS = /ipad|iphone|ipod/i.test(userAgent) || (isMac && 'ontouchend' in document);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-zinc-400 hover:text-emerald-400"
        >
          <Download className="size-3.5" />
          <span className="hidden sm:inline">Desktop App</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="border-zinc-700 bg-zinc-900 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Monitor className="size-5 text-emerald-400" />
            Get CodeForge AI Desktop
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Install CodeForge AI as a desktop application for the best experience.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* ── PWA Install (Quick Install) ── */}
          {(installPrompt || isIOS) && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <SparkleIcon className="size-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">Quick Install</span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">RECOMMENDED</span>
              </div>
              <p className="text-xs text-zinc-400 mb-3">
                {isIOS
                  ? 'Tap the Share button in Safari, then "Add to Home Screen"'
                  : 'Install directly from your browser — no download needed!'}
              </p>
              {installPrompt && !isInstalled && (
                <Button
                  onClick={handlePWAInstall}
                  disabled={isInstalling}
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
                  size="sm"
                >
                  {isInstalling ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Download className="size-4 mr-2" />
                      Install as Desktop App
                    </>
                  )}
                </Button>
              )}
              {isInstalled && (
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="size-4" />
                  <span className="text-sm font-medium">App is installed!</span>
                </div>
              )}
              {isIOS && (
                <div className="mt-2 flex items-start gap-2 rounded-md bg-zinc-800/50 p-2">
                  <Smartphone className="size-4 text-zinc-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-zinc-400">
                    <strong className="text-zinc-300">Steps:</strong> Tap
                    <span className="mx-1 inline-flex items-center gap-0.5 rounded bg-zinc-700 px-1 py-0.5 text-[10px]">
                      <ExternalLink className="size-2.5" /> Share
                    </span>
                    → &quot;Add to Home Screen&quot;
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Detected platform ── */}
          <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3">
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              {isMac ? <Apple className="size-4" /> : isWin ? <Monitor className="size-4" /> : <Terminal className="size-4" />}
              <span>Detected: {isMac ? 'macOS' : isWin ? 'Windows' : isLinux ? 'Linux' : 'Unknown'}</span>
            </div>
          </div>

          {/* ── Download source code packages ── */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Package className="size-3" />
              Download Desktop Package
            </h4>
            <p className="text-[11px] text-zinc-500">
              Download the source package with Electron setup scripts for your platform.
            </p>

            {[
              { id: 'windows', platform: 'Windows', icon: Monitor, ext: '.zip', desc: 'Includes setup.bat & start-desktop.bat' },
              { id: 'macos', platform: 'macOS', icon: Apple, ext: '.zip', desc: 'Includes setup.sh & build-mac.sh' },
              { id: 'linux', platform: 'Linux', icon: Terminal, ext: '.zip', desc: 'Includes setup.sh & build-linux.sh' },
            ].map((item) => {
              const Icon = item.icon;
              const isComplete = downloadComplete === item.id;
              const isCurrentDownload = isDownloading && downloadComplete !== item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleDownloadSource(item.id)}
                  disabled={isDownloading}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                    isComplete
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-zinc-700/50 bg-zinc-800/30 hover:border-emerald-500/30 hover:bg-zinc-800/60'
                  } ${isDownloading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                >
                  <div className="flex size-9 items-center justify-center rounded-lg bg-zinc-800">
                    <Icon className="size-4 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200">{item.platform}</span>
                      {isComplete && <CheckCircle2 className="size-3.5 text-emerald-400" />}
                      {isCurrentDownload && <Loader2 className="size-3.5 animate-spin text-emerald-400" />}
                    </div>
                    <span className="text-xs text-zinc-500">{item.desc}</span>
                  </div>
                  <Download className="size-4 text-zinc-500" />
                </button>
              );
            })}
          </div>

          {/* ── Build from source instructions ── */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <h4 className="text-xs font-semibold text-zinc-400 mb-2">After Download</h4>
            <div className="space-y-1 font-mono text-[11px] text-zinc-500">
              <p>$ unzip CodeForge-AI-{isMac ? 'macos' : isWin ? 'windows' : 'linux'}.zip</p>
              <p>$ cd CodeForge-AI</p>
              <p>$ {isWin ? 'setup.bat' : 'chmod +x setup.sh && ./setup.sh'}</p>
              <p>$ {isWin ? 'start-desktop.bat' : './start-desktop.sh'}</p>
            </div>
          </div>

          {/* ── Requirements ── */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <h4 className="text-xs font-semibold text-zinc-400 mb-2">Requirements</h4>
            <ul className="space-y-1 text-[11px] text-zinc-500">
              <li className="flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-emerald-500" />
                Node.js 18+ or Bun runtime
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-emerald-500" />
                An API key from any supported LLM provider
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-yellow-500" />
                Desktop build requires full source code (npm/bun install)
              </li>
            </ul>
          </div>

          {/* Info */}
          <p className="text-[11px] text-zinc-600 text-center">
            Desktop app runs locally with full file system access and offline support.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Sparkle icon for "Quick Install" section ──
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
    </svg>
  );
}
