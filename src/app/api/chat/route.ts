import { NextRequest, NextResponse } from 'next/server';
import { streamLLM, getApiKeyForProvider, type ProviderKey, type StreamChunk } from '@/lib/llm';
import { db } from '@/lib/db';

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
  planner: `You are CodeForge AI Planner Agent. You specialize in:
- Breaking down complex projects into manageable tasks
- Designing software architecture and system design
- Creating implementation roadmaps
- Identifying dependencies and potential risks
- Estimating effort and timelines

Always provide structured, actionable plans with clear steps.
When outputting code or file structures as part of a plan, always specify the file path before each code block using the 📄 **filepath** format so files can be auto-created.`,
  coder: `You are CodeForge AI Coder Agent — an expert autonomous programmer. You specialize in:
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
  debugger: `You are CodeForge AI Debugger Agent. You specialize in:
- Identifying and fixing bugs in code
- Analyzing error messages and stack traces
- Suggesting debugging strategies
- Performance optimization
- Security vulnerability detection

Always explain the root cause of issues and provide clear fix instructions.
When providing code fixes, always specify the file path before each code block using the 📄 **filepath** format so the fix can be auto-applied to the correct file.
Provide the COMPLETE fixed file, not just the changed lines.`,
  reviewer: `You are CodeForge AI Reviewer Agent. You specialize in:
- Code review and quality assessment
- Best practices compliance
- Performance analysis
- Security review
- Maintainability assessment

Provide constructive feedback with specific suggestions for improvement.
When suggesting code changes, always specify the file path before each code block using the 📄 **filepath** format so changes can be auto-applied.`,
  documenter: `You are CodeForge AI Documenter Agent. You specialize in:
- Writing clear and comprehensive documentation
- Creating API documentation
- Writing README files and guides
- Generating code comments
- Creating architecture documentation

Always write in clear, professional markdown format.
When creating documentation files, always specify the file path before each content block using the 📄 **filepath** format (e.g., 📄 **README.md**, 📄 **docs/api.md**) so files can be auto-created.`,
};

const DEFAULT_SYSTEM_PROMPT = `You are CodeForge AI, an autonomous intelligent coding agent. You help users with:
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

/**
 * Build a context string from existing project files
 */
async function buildProjectContext(projectId?: string): Promise<string> {
  if (!projectId) return '';

  try {
    const files = await db.file.findMany({
      where: { projectId },
      select: { name: true, path: true, language: true, content: true },
      orderBy: { name: 'asc' },
    });

    if (files.length === 0) return '';

    const fileList = files
      .map(f => `  - ${f.path || f.name} (${f.language || 'unknown'}, ${f.content.length} chars)`)
      .join('\n');

    // Include content of small files (under 2000 chars) for context
    const smallFiles = files.filter(f => f.content.length < 2000);
    const fileContents = smallFiles
      .map(f => `\n📄 **${f.path || f.name}**\n\`\`\`${f.language || ''}\n${f.content}\n\`\`\``)
      .join('');

    return `\n\nCURRENT PROJECT FILES:\n${fileList}\n\nEXISTING FILE CONTENTS (for reference):\n${fileContents}`;
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest) {
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
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 },
      );
    }

    // Select system prompt based on agent type, always append FILE_AWARE_PROMPT
    const basePrompt = agent && AGENT_SYSTEM_PROMPTS[agent]
      ? AGENT_SYSTEM_PROMPTS[agent]
      : DEFAULT_SYSTEM_PROMPT;

    // Build project context if projectId is provided
    const projectContext = await buildProjectContext(projectId);

    const systemPrompt = basePrompt + '\n\n' + FILE_AWARE_PROMPT + projectContext;

    // Build messages array with proper system prompt
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history if provided
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    // Use provided model or default to openrouter/auto (works with any provider)
    const selectedModel = model || 'openrouter/auto';

    console.log(`[Chat API] Request: model=${selectedModel}, agent=${agent || 'default'}, messageLength=${message.length}, hasProjectContext=${!!projectContext}`);

    // Pre-check API key availability for faster error response
    const settingsRows = await db.setting.findMany();
    const settingsMap: Record<string, string> = {};
    settingsRows.forEach((s) => { settingsMap[s.key] = s.value; });
    const configuredProvider = (settingsMap.provider || 'openrouter') as ProviderKey;
    const hasPrimaryKey = !!getApiKeyForProvider(settingsMap, configuredProvider);
    const secondaryProvider = settingsMap.provider2 as ProviderKey | undefined;
    const hasSecondaryKey = secondaryProvider ? !!getApiKeyForProvider(settingsMap, secondaryProvider) : false;

    if (!hasPrimaryKey && !hasSecondaryKey) {
      console.warn(`[Chat API] No API key found for provider=${configuredProvider} or secondary=${secondaryProvider || 'none'}`);
      if (shouldStream) {
        const encoder = new TextEncoder();
        const errorStream = new ReadableStream({
          start(controller) {
            const errorMsg = JSON.stringify({ error: `No API key configured for ${configuredProvider}. Please add your API key in ⚙️ Settings.` });
            controller.enqueue(encoder.encode(`data: ${errorMsg}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        });
        return new Response(errorStream, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        });
      } else {
        return NextResponse.json(
          { error: `No API key configured for ${configuredProvider}. Please add your API key in ⚙️ Settings.` },
          { status: 401 },
        );
      }
    }

    console.log(`[Chat API] API key resolved: primary=${hasPrimaryKey} (${configuredProvider}), secondary=${hasSecondaryKey} (${secondaryProvider || 'none'})`);

    if (shouldStream) {
      // ─── Streaming Response ───────────────────────────────────────────
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          let closed = false;

          const safeEnqueue = (data: Uint8Array) => {
            if (!closed) {
              try {
                controller.enqueue(data);
              } catch {
                // Controller already closed — ignore
              }
            }
          };

          const safeClose = () => {
            if (!closed) {
              closed = true;
              try {
                controller.close();
              } catch {
                // Controller already closed — ignore
              }
            }
          };

          try {
            for await (const chunk of streamLLM({
              model: selectedModel,
              messages,
              temperature: temperature ?? 0.7,
              maxTokens: maxTokens ?? 4096,
            })) {
              if (closed) break; // Stop processing if stream was closed

              if (chunk.error) {
                console.error(`[Chat API] LLM stream error: ${chunk.error}`);
                const errorMsg = JSON.stringify({ error: chunk.error });
                safeEnqueue(encoder.encode(`data: ${errorMsg}\n\n`));
                safeEnqueue(encoder.encode('data: [DONE]\n\n'));
                safeClose();
                return;
              }

              if (chunk.content) {
                const sseMessage = JSON.stringify({
                  content: chunk.content,
                  model: chunk.model || selectedModel,
                });
                safeEnqueue(encoder.encode(`data: ${sseMessage}\n\n`));
              }

              if (chunk.done) {
                safeEnqueue(encoder.encode('data: [DONE]\n\n'));
                safeClose();
                return;
              }
            }

            // Fallback close if no done signal
            safeEnqueue(encoder.encode('data: [DONE]\n\n'));
            safeClose();
          } catch (error) {
            console.error('[Chat API] Stream error:', error);
            if (!closed) {
              const errMsg = error instanceof Error ? error.message : 'Stream interrupted unexpectedly';
              const errorMsg = JSON.stringify({ error: errMsg });
              safeEnqueue(encoder.encode(`data: ${errorMsg}\n\n`));
              safeEnqueue(encoder.encode('data: [DONE]\n\n'));
              safeClose();
            }
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // ─── Non-Streaming Response ─────────────────────────────────────────
    const result = await callLLMNonStreaming({
      model: selectedModel,
      messages,
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 4096,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      conversationId: conversationId || crypto.randomUUID(),
      message: result.content || 'No response received.',
      tokens: Math.ceil(message.length / 4) + Math.ceil((result.content || '').length / 4),
      model: result.model || selectedModel,
      projectId: projectId || null,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Chat API] Unhandled error: ${errorMsg}`);

    // Provide specific, actionable error messages
    const isNoApiKey = errorMsg.toLowerCase().includes('no api key') || errorMsg.toLowerCase().includes('api key');
    const isNetworkError = errorMsg.toLowerCase().includes('network') ||
      errorMsg.toLowerCase().includes('econnrefused') ||
      errorMsg.toLowerCase().includes('enotfound') ||
      errorMsg.toLowerCase().includes('fetch failed');
    const isTimeout = errorMsg.toLowerCase().includes('timeout') || errorMsg.toLowerCase().includes('aborted');
    const isRateLimit = errorMsg.toLowerCase().includes('rate limit') || errorMsg.includes('429');

    let userMessage: string;
    if (isNoApiKey) {
      userMessage = 'No API key configured. Please add your API key in ⚙️ Settings.';
    } else if (isNetworkError) {
      userMessage = 'Network error: Could not reach the AI provider. Check your internet connection and API key in ⚙️ Settings, or try a different provider.';
    } else if (isTimeout) {
      userMessage = 'Request timed out. The provider might be slow or unavailable. Try a different model or provider.';
    } else if (isRateLimit) {
      userMessage = 'Rate limit reached. Please wait a moment and try again, or switch to a different provider in ⚙️ Settings.';
    } else {
      userMessage = `Failed to process message: ${errorMsg}. Check your API key in ⚙️ Settings and try again.`;
    }

    return NextResponse.json(
      { error: userMessage },
      { status: 500 },
    );
  }
}

/**
 * Helper: non-streaming LLM call
 */
async function callLLMNonStreaming(options: {
  model: string;
  messages: { role: string; content: string }[];
  temperature: number;
  maxTokens: number;
}): Promise<{ content: string; model: string; error?: string }> {
  let fullContent = '';
  let lastModel = options.model;

  for await (const chunk of streamLLM(options)) {
    if (chunk.error) {
      return { content: fullContent, model: lastModel, error: chunk.error };
    }
    fullContent += chunk.content;
    if (chunk.model) lastModel = chunk.model;
  }

  return { content: fullContent, model: lastModel };
}
