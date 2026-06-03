import { NextRequest, NextResponse } from 'next/server';

const DANGEROUS_COMMANDS = [
  'rm -rf /', 'rm -rf /*', 'mkfs', 'dd if=', ':(){:|:&};:',
  'wget.*|.*sh', 'curl.*|.*sh', 'chmod -R 777 /',
  'shutdown', 'reboot', 'halt', 'init 0', 'init 6',
];

function isDangerousCommand(cmd: string): boolean {
  const normalized = cmd.toLowerCase().trim();
  return DANGEROUS_COMMANDS.some((pattern) => {
    try {
      return new RegExp(pattern, 'i').test(normalized);
    } catch {
      return normalized.includes(pattern);
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { command, cwd } = body;

    if (!command) {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    if (isDangerousCommand(command)) {
      return NextResponse.json({
        output: `⚠️ Command blocked for safety: "${command}"\nThis command has been flagged as potentially dangerous. If you need to run it, please use your local terminal directly.`,
        exitCode: 1,
        blocked: true,
      });
    }

    // Simulated terminal execution
    // In production, this would connect to a sandboxed environment
    const output = simulateCommand(command);

    return NextResponse.json({
      output,
      exitCode: 0,
      command,
      cwd: cwd || '/home/project',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Terminal error:', error);
    return NextResponse.json({ error: 'Failed to execute command' }, { status: 500 });
  }
}

function simulateCommand(command: string): string {
  const cmd = command.trim().toLowerCase();
  const parts = cmd.split(/\s+/);
  const baseCmd = parts[0];

  switch (baseCmd) {
    case 'ls':
      return 'src/\npublic/\npackage.json\ntsconfig.json\nREADME.md\n.gitignore\n';
    case 'pwd':
      return '/home/project\n';
    case 'echo':
      return parts.slice(1).join(' ').replace(/['"]/g, '') + '\n';
    case 'date':
      return new Date().toString() + '\n';
    case 'whoami':
      return 'waziros-ai\n';
    case 'node':
      if (parts[1] === '--version' || parts[1] === '-v') return 'v20.11.0\n';
      return 'Node.js runtime active\n';
    case 'npm':
    case 'bun':
      if (parts[1] === '--version' || parts[1] === '-v') return '1.0.0\n';
      if (parts[1] === 'install' || parts[1] === 'i') return '✓ Dependencies installed successfully\n';
      if (parts[1] === 'run') return `Running ${parts[2] || 'script'}...\n✓ Completed\n`;
      return `✓ ${baseCmd} command executed\n`;
    case 'git':
      if (parts[1] === 'status') return 'On branch main\nnothing to commit, working tree clean\n';
      if (parts[1] === 'log') return 'commit abc1234 (HEAD -> main)\nAuthor: Waziros AI\nDate: Today\n\n    Initial commit\n';
      if (parts[1] === 'init') return 'Initialized empty Git repository\n';
      return `✓ git ${parts[1] || ''} executed\n`;
    case 'python':
    case 'python3':
      if (parts[1] === '--version') return 'Python 3.12.0\n';
      return 'Python runtime active\n';
    case 'mkdir':
      return `✓ Directory ${parts[1] || ''} created\n`;
    case 'touch':
      return `✓ File ${parts[1] || ''} created\n`;
    case 'cat':
      return 'File content would be displayed here\n';
    case 'clear':
      return '';
    case 'help':
      return `Waziros AI Terminal v1.0
Available commands:
  ls          - List directory contents
  pwd         - Print working directory
  echo        - Print text
  cat         - Display file contents
  mkdir       - Create directory
  touch       - Create file
  node        - Node.js runtime
  python      - Python runtime
  npm/bun     - Package manager
  git         - Version control
  date        - Show current date
  whoami      - Show current user
  clear       - Clear terminal
  help        - Show this help message

⚠️ Dangerous commands are blocked for safety.\n`;
    default:
      return `$ ${command}\nCommand executed in simulated environment.\nNote: Connect to a real sandbox for full terminal support.\n`;
  }
}
