import { NextRequest, NextResponse } from 'next/server';
import { streamLLM, getApiKeyForProvider, type ProviderKey, type StreamChunk } from '@/lib/llm';
import { logger } from '@/lib/logger';

// System prompts for different agent types
const FILE_AWARE_PROMPT = `
FILE OUTPUT FORMAT:
When writing code for a project, ALWAYS specify the file path before each code block using this format:
📄 **filepath/filename.ext**
Then provide the complete code in a markdown code block with the appropriate language tag.

Examples:
📄 **index.html**
\`\`\`html
<html>...</html>
\`\`\`

📄 **styles.css**
\`\`\`css
body { ... }
\`\`\`

📄 **script.js**
\`\`\`javascript
console.log('hello');
\`\`\`

This format allows the code to be automatically saved to files. Always use this format when creating or modifying files.

IMPORTANT RULES:
1. Each file MUST have its own 📄 **filepath** header before the code block
2. Provide COMPLETE, FULL file contents — never use "..." or "// rest of code remains the same"
3. When building web projects, create separate HTML, CSS, and JS files
4. Make code production-ready with proper error handling and responsive design
5. For web projects, ensure the HTML file includes proper <!DOCTYPE html>, meta tags, and links to CSS/JS`;

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  planner: `You are Waziros AI Planner Agent. You specialize in:
- Breaking down complex projects into manageable tasks
- Designing software architecture and system design
- Creating implementation roadmaps
- Identifying dependencies and potential risks
- Estimating effort and timelines

Always provide structured, actionable plans with clear steps.
When outputting code or file structures as part of a plan, always specify the file path before each code block using the 📄 **filepath** format so files can be auto-created.`,
  coder: `You are Waziros AI Coder Agent — an expert autonomous programmer. You specialize in:
- Writing clean, efficient, and well-documented code
- Implementing features across multiple languages and frameworks
- Following best practices and design patterns
- Creating complete, working implementations from scratch
- Generating HTML, CSS, and JavaScript for web projects
- Building full-stack applications with proper architecture

When writing code, always use markdown code blocks with the appropriate language tag. Provide complete, runnable code snippets.
CRITICAL RULES:
1. When generating code for a project, ALWAYS specify the file path/filename before each code block using the 📄 **filepath** format
2. Each file must have its own 📄 header
3. When building web projects, create separate HTML, CSS, and JS files with appropriate 📄 headers
4. NEVER use placeholders like "// ... rest of code" — always provide COMPLETE implementations
5. Include proper error handling, responsive design, and accessibility
6. Make the code production-ready, not just demos`,
  debugger: `You are Waziros AI Debugger Agent. You specialize in:
- Identifying and fixing bugs in code
- Analyzing error messages and stack traces
- Suggesting debugging strategies
- Performance optimization
- Security vulnerability detection

Always explain the root cause of issues and provide clear fix instructions.
When providing code fixes, always specify the file path before each code block using the 📄 **filepath** format so the fix can be auto-applied to the correct file.
Provide the COMPLETE fixed file, not just the changed lines.`,
  reviewer: `You are Waziros AI Reviewer Agent. You specialize in:
- Code review and quality assessment
- Best practices compliance
- Performance analysis
- Security review
- Maintainability assessment

Provide constructive feedback with specific suggestions for improvement.
When suggesting code changes, always specify the file path before each code block using the 📄 **filepath** format so changes can be auto-applied.`,
  documenter: `You are Waziros AI Documenter Agent. You specialize in:
- Writing clear and comprehensive documentation
- Creating API documentation
- Writing README files and guides
- Generating code comments
- Creating architecture documentation

Always write in clear, professional markdown format.
When creating documentation files, always specify the file path before each content block using the 📄 **filepath** format (e.g., 📄 **README.md**, 📄 **docs/api.md**) so files can be auto-created.`,
};

const DEFAULT_SYSTEM_PROMPT = `You are Waziros AI, an autonomous intelligent coding agent. You help users with:
- Writing and understanding code in any language
- Building complete web applications with HTML, CSS, and JavaScript
- Debugging and fixing code issues
- Code review and optimization
- Architecture and design patterns
- Creating full project structures from natural language descriptions

When writing code, always use markdown code blocks with the appropriate language tag. Provide complete, runnable code snippets.
CRITICAL RULES:
1. When generating code for a project, ALWAYS specify the file path/filename before each code block using the 📄 **filepath** format
2. Each file must have its own 📄 header
3. When building web projects, create separate HTML, CSS, and JS files with appropriate 📄 headers
4. This format allows the code to be automatically saved to files
5. NEVER use placeholders like "// ... existing code" or "// rest remains the same"
6. Always provide COMPLETE, FULL file contents
7. Include proper error handling, responsive design, and accessibility
8. Make code production-ready

Be concise but thorough. Explain your reasoning when suggesting changes.`;

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const {
      message,
      conversationId,
      projectId,
      agent,
      history,
      model,
      temperature,
      maxTokens,
      stream: shouldStream = true,
      settings: clientSettings,
    } = body as {
      message: string;
      conversationId?: string;
      projectId?: string;
      agent?: string;
      history?: { role: string; content: string }[];
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      settings?: Record<string, string>;
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Select system prompt based on agent type
    const basePrompt = agent && AGENT_SYSTEM_PROMPTS[agent]
      ? AGENT_SYSTEM_PROMPTS[agent]
      : DEFAULT_SYSTEM_PROMPT;

    const systemPrompt = basePrompt + '\n\n' + FILE_AWARE_PROMPT;

    // Build messages array
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (history && Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    messages.push({ role: 'user', content: message });

    const selectedModel = model || 'openrouter/auto';

    // ── FAST PATH: Quick API key check from client settings ──
    // When client sends settings, use them directly — no DB read needed!
    const hasClientSettings = clientSettings && Object.keys(clientSettings).length > 0;

    if (hasClientSettings) {
      const configuredProvider = (clientSettings!.provider || 'openrouter') as ProviderKey;
      const hasPrimaryKey = !!getApiKeyForProvider(clientSettings!, configuredProvider);
      const secondaryProvider = clientSettings!.provider2 as ProviderKey | undefined;
      const hasSecondaryKey = secondaryProvider ? !!getApiKeyForProvider(clientSettings!, secondaryProvider) : false;

      if (!hasPrimaryKey && !hasSecondaryKey) {
        logger.warn(`[Chat API] No API key in client settings: provider=${configuredProvider}`);
        if (shouldStream) {
          const encoder = new TextEncoder();
          const errorStream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `No API key configured for ${configuredProvider}. Please add your API key in ⚙️ Settings.` })}\n\n`));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            },
          });
          return new Response(errorStream, {
            headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
          });
        }
        return NextResponse.json(
          { error: `No API key configured for ${configuredProvider}. Please add your API key in ⚙️ Settings.` },
          { status: 401 },
        );
      }
    }

    if (process.env.DEBUG) {
      logger.debug(`model=${selectedModel}, agent=${agent || 'default'}, fastPath=${hasClientSettings}`);
    }

    if (shouldStream) {
      // ─── Streaming Response ───────────────────────────────────────────
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          let closed = false;

          const safeEnqueue = (data: Uint8Array) => {
            if (!closed) {
              try { controller.enqueue(data); } catch {}
            }
          };

          const safeClose = () => {
            if (!closed) {
              closed = true;
              try { controller.close(); } catch {}
            }
          };

          try {
            // Use preferClientSettings=true for maximum speed — skips DB read entirely
            for await (const chunk of streamLLM({
              model: selectedModel,
              messages,
              temperature: temperature ?? 0.7,
              maxTokens: maxTokens ?? 4096,
              clientSettings: clientSettings || undefined,
              preferClientSettings: !!hasClientSettings,
            })) {
              if (closed) break;

              if (chunk.error) {
                logger.error(`[Chat API] LLM stream error: ${chunk.error}`);
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({ error: chunk.error })}\n\n`));
                safeEnqueue(encoder.encode('data: [DONE]\n\n'));
                safeClose();
                return;
              }

              if (chunk.content) {
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  content: chunk.content,
                  model: chunk.model || selectedModel,
                })}\n\n`));
              }

              if (chunk.done) {
                safeEnqueue(encoder.encode('data: [DONE]\n\n'));
                safeClose();
                return;
              }
            }

            safeEnqueue(encoder.encode('data: [DONE]\n\n'));
            safeClose();
          } catch (error) {
            logger.error('[Chat API] Stream error:', error);
            if (!closed) {
              const errMsg = error instanceof Error ? error.message : 'Stream interrupted unexpectedly';
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`));
              safeEnqueue(encoder.encode('data: [DONE]\n\n'));
              safeClose();
            }
          }
        },
      });

      const ttfb = Date.now() - startTime;

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-store',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no', // Disable nginx buffering for faster SSE
          'X-Response-Time': `${ttfb}ms`,
        },
      });
    }

    // ─── Non-Streaming Response ─────────────────────────────────────────
    let fullContent = '';
    let lastModel = selectedModel;

    for await (const chunk of streamLLM({
      model: selectedModel,
      messages,
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 4096,
      clientSettings: clientSettings || undefined,
      preferClientSettings: !!hasClientSettings,
    })) {
      if (chunk.error) {
        return NextResponse.json({ error: chunk.error }, { status: 500 });
      }
      fullContent += chunk.content;
      if (chunk.model) lastModel = chunk.model;
    }

    return NextResponse.json({
      conversationId: conversationId || crypto.randomUUID(),
      message: fullContent || 'No response received.',
      tokens: Math.ceil(message.length / 4) + Math.ceil((fullContent || '').length / 4),
      model: lastModel,
      projectId: projectId || null,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[Chat API] Unhandled error: ${errorMsg}`);

    const isNoApiKey = errorMsg.toLowerCase().includes('no api key') || errorMsg.toLowerCase().includes('api key');
    const isNetworkError = errorMsg.toLowerCase().includes('network') ||
      errorMsg.toLowerCase().includes('econnrefused') || errorMsg.toLowerCase().includes('fetch failed');
    const isTimeout = errorMsg.toLowerCase().includes('timeout') || errorMsg.toLowerCase().includes('aborted');
    const isRateLimit = errorMsg.toLowerCase().includes('rate limit') || errorMsg.includes('429');

    let userMessage: string;
    if (isNoApiKey) {
      userMessage = 'No API key configured. Please add your API key in ⚙️ Settings.';
    } else if (isNetworkError) {
      userMessage = 'Network error: Could not reach the AI provider. Check your connection or try a different provider.';
    } else if (isTimeout) {
      userMessage = 'Request timed out. Try a different model or provider.';
    } else if (isRateLimit) {
      userMessage = 'Rate limit reached. Please wait a moment and try again.';
    } else {
      userMessage = `Failed to process message: ${errorMsg}. Check your API key in ⚙️ Settings.`;
    }

    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
