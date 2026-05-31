import { NextRequest, NextResponse } from 'next/server';
import { streamLLM, type StreamChunk } from '@/lib/llm';

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

This format allows the code to be automatically saved to files. Always use this format when creating or modifying files.`;

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  planner: `You are CodeForge AI Planner Agent. You specialize in:
- Breaking down complex projects into manageable tasks
- Designing software architecture and system design
- Creating implementation roadmaps
- Identifying dependencies and potential risks
- Estimating effort and timelines

Always provide structured, actionable plans with clear steps.
When outputting code or file structures as part of a plan, always specify the file path before each code block using the 📄 **filepath** format so files can be auto-created.`,
  coder: `You are CodeForge AI Coder Agent. You specialize in:
- Writing clean, efficient, and well-documented code
- Implementing features across multiple languages and frameworks
- Following best practices and design patterns
- Creating complete, working implementations
- Generating HTML, CSS, and JavaScript for web projects

When writing code, always use markdown code blocks with the appropriate language tag. Provide complete, runnable code snippets.
CRITICAL: When generating code for a project, ALWAYS specify the file path/filename before each code block using the 📄 **filepath** format. Each file must have its own 📄 header. When building web projects, create separate HTML, CSS, and JS files with appropriate 📄 headers.`,
  debugger: `You are CodeForge AI Debugger Agent. You specialize in:
- Identifying and fixing bugs in code
- Analyzing error messages and stack traces
- Suggesting debugging strategies
- Performance optimization
- Security vulnerability detection

Always explain the root cause of issues and provide clear fix instructions.
When providing code fixes, always specify the file path before each code block using the 📄 **filepath** format so the fix can be auto-applied to the correct file.`,
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

const DEFAULT_SYSTEM_PROMPT = `You are CodeForge AI, an intelligent coding companion. You help users with:
- Writing and understanding code in any language
- Building web applications with HTML, CSS, and JavaScript
- Debugging and fixing code issues
- Code review and optimization
- Architecture and design patterns

When writing code, always use markdown code blocks with the appropriate language tag. Provide complete, runnable code snippets.
CRITICAL: When generating code for a project, ALWAYS specify the file path/filename before each code block using the 📄 **filepath** format. Each file must have its own 📄 header. When building web projects, create separate HTML, CSS, and JS files with appropriate 📄 headers. This format allows the code to be automatically saved to files.
Be concise but thorough. Explain your reasoning when suggesting changes.`;

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
    const systemPrompt = basePrompt + '\n\n' + FILE_AWARE_PROMPT;

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

    console.log(`[Chat API] Request: model=${selectedModel}, agent=${agent || 'default'}, messageLength=${message.length}`);

    if (shouldStream) {
      // ─── Streaming Response ───────────────────────────────────────────
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamLLM({
              model: selectedModel,
              messages,
              temperature: temperature ?? 0.7,
              maxTokens: maxTokens ?? 4096,
            })) {
              if (chunk.error) {
                const errorMsg = JSON.stringify({ error: chunk.error });
                controller.enqueue(encoder.encode(`data: ${errorMsg}\n\n`));
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
                return;
              }

              if (chunk.content) {
                const sseMessage = JSON.stringify({
                  content: chunk.content,
                  model: chunk.model || selectedModel,
                });
                controller.enqueue(encoder.encode(`data: ${sseMessage}\n\n`));
              }

              if (chunk.done) {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
                return;
              }
            }

            // Fallback close if no done signal
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            console.error('Stream error:', error);
            const errorMsg = JSON.stringify({ error: 'Stream interrupted unexpectedly' });
            controller.enqueue(encoder.encode(`data: ${errorMsg}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
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
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process message. Please check your API key and try again.' },
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
