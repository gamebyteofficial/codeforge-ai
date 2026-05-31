import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Singleton ZAI instance
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// System prompts for different agent types
const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  planner: `You are CodeForge AI Planner Agent. You specialize in:
- Breaking down complex projects into manageable tasks
- Designing software architecture and system design
- Creating implementation roadmaps
- Identifying dependencies and potential risks
- Estimating effort and timelines

Always provide structured, actionable plans with clear steps.`,
  coder: `You are CodeForge AI Coder Agent. You specialize in:
- Writing clean, efficient, and well-documented code
- Implementing features across multiple languages and frameworks
- Following best practices and design patterns
- Creating complete, working implementations
- Generating HTML, CSS, and JavaScript for web projects

When writing code, always use markdown code blocks with the appropriate language tag. Provide complete, runnable code snippets.`,
  debugger: `You are CodeForge AI Debugger Agent. You specialize in:
- Identifying and fixing bugs in code
- Analyzing error messages and stack traces
- Suggesting debugging strategies
- Performance optimization
- Security vulnerability detection

Always explain the root cause of issues and provide clear fix instructions.`,
  reviewer: `You are CodeForge AI Reviewer Agent. You specialize in:
- Code review and quality assessment
- Best practices compliance
- Performance analysis
- Security review
- Maintainability assessment

Provide constructive feedback with specific suggestions for improvement.`,
  documenter: `You are CodeForge AI Documenter Agent. You specialize in:
- Writing clear and comprehensive documentation
- Creating API documentation
- Writing README files and guides
- Generating code comments
- Creating architecture documentation

Always write in clear, professional markdown format.`,
};

const DEFAULT_SYSTEM_PROMPT = `You are CodeForge AI, an intelligent coding companion. You help users with:
- Writing and understanding code in any language
- Building web applications with HTML, CSS, and JavaScript
- Debugging and fixing code issues
- Code review and optimization
- Architecture and design patterns

When writing code, always use markdown code blocks with the appropriate language tag. Provide complete, runnable code snippets.
Be concise but thorough. Explain your reasoning when suggesting changes.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, conversationId, projectId, agent, history } = body as {
      message: string;
      conversationId?: string;
      projectId?: string;
      agent?: string;
      history?: { role: string; content: string }[];
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 },
      );
    }

    // Get ZAI instance
    const zai = await getZAI();

    // Select system prompt based on agent type
    const systemPrompt = agent && AGENT_SYSTEM_PROMPTS[agent]
      ? AGENT_SYSTEM_PROMPTS[agent]
      : DEFAULT_SYSTEM_PROMPT;

    // Build messages array
    const messages: { role: 'assistant' | 'user'; content: string }[] = [
      { role: 'assistant', content: systemPrompt },
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

    // Call LLM
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    });

    const responseContent = completion.choices[0]?.message?.content ?? 'No response received.';

    // Estimate token count
    const tokenCount = Math.ceil(message.length / 4) + Math.ceil(responseContent.length / 4);

    return NextResponse.json({
      conversationId: conversationId || crypto.randomUUID(),
      message: responseContent,
      tokens: tokenCount,
      model: 'codeforge-ai',
      projectId: projectId || null,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process message. Please try again.' },
      { status: 500 },
    );
  }
}
