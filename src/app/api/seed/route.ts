import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Check if demo project already exists
    const existing = await db.project.findFirst({ where: { name: 'Demo Project' } });
    if (existing) {
      return NextResponse.json({ message: 'Seed data already exists', project: existing });
    }

    // Create demo project
    const project = await db.project.create({
      data: {
        name: 'Demo Project',
        description: 'A sample project to demonstrate CodeForge AI capabilities',
        language: 'typescript',
        framework: 'nextjs',
        files: {
          create: [
            {
              name: 'package.json',
              path: 'package.json',
              content: `{
  "name": "demo-project",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}`,
              language: 'json',
            },
            {
              name: 'index.tsx',
              path: 'src/pages/index.tsx',
              content: `import React from 'react';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-4xl font-bold">Hello, CodeForge AI!</h1>
    </div>
  );
}`,
              language: 'typescript',
            },
            {
              name: 'App.tsx',
              path: 'src/App.tsx',
              content: `import React, { useState } from 'react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (!input.trim()) return;
    setTodos([...todos, { id: Date.now(), text: input, completed: false }]);
    setInput('');
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    ));
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Todo App</h1>
      <div className="flex gap-2 mb-4">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a todo..."
          className="flex-1 border rounded px-2 py-1"
        />
        <button onClick={addTodo} className="bg-blue-500 text-white px-4 py-1 rounded">
          Add
        </button>
      </div>
      <ul className="space-y-2">
        {todos.map(todo => (
          <li
            key={todo.id}
            onClick={() => toggleTodo(todo.id)}
            className={\`p-2 border rounded cursor-pointer \${
              todo.completed ? 'line-through text-gray-400' : ''
            }\`}
          >
            {todo.text}
          </li>
        ))}
      </ul>
    </div>
  );
}`,
              language: 'typescript',
            },
            {
              name: 'api.ts',
              path: 'src/api.ts',
              content: `import express from 'express';

const app = express();
const PORT = 3001;

app.use(express.json());

interface Item {
  id: number;
  name: string;
  description: string;
}

let items: Item[] = [
  { id: 1, name: 'Item 1', description: 'First item' },
  { id: 2, name: 'Item 2', description: 'Second item' },
];

// GET all items
app.get('/api/items', (req, res) => {
  res.json({ items });
});

// GET single item
app.get('/api/items/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const item = items.find(i => i.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.json({ item });
});

// POST new item
app.post('/api/items', (req, res) => {
  const { name, description } = req.body;
  const newItem = {
    id: Date.now(),
    name,
    description,
  };
  items.push(newItem);
  res.status(201).json({ item: newItem });
});

// DELETE item
app.delete('/api/items/:id', (req, res) => {
  const id = parseInt(req.params.id);
  items = items.filter(i => i.id !== id);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});`,
              language: 'typescript',
            },
            {
              name: 'styles.css',
              path: 'src/styles.css',
              content: `/* Global Styles */
:root {
  --primary: #10b981;
  --bg-dark: #0a0a0a;
  --bg-card: #18181b;
  --text: #f4f4f5;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background-color: var(--bg-dark);
  color: var(--text);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.card {
  background: var(--bg-card);
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid #27272a;
}`,
              language: 'css',
            },
            {
              name: 'index.html',
              path: 'public/index.html',
              content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeForge AI - Live Preview</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <header class="hero">
      <div class="hero-badge">✨ CodeForge AI</div>
      <h1>Build Anything with AI</h1>
      <p>Your intelligent coding companion that understands, plans, and creates.</p>
      <div class="hero-buttons">
        <button class="btn btn-primary" onclick="handleGetStarted()">Get Started</button>
        <button class="btn btn-secondary" onclick="handleLearnMore()">Learn More</button>
      </div>
    </header>
    
    <section class="features">
      <div class="feature-card">
        <div class="feature-icon">🧠</div>
        <h3>Smart Code</h3>
        <p>AI-powered code generation with context awareness</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">⚡</div>
        <h3>Fast & Reliable</h3>
        <p>Real-time code execution and live preview</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🔒</div>
        <h3>Secure</h3>
        <p>Sandboxed execution with safety checks</p>
      </div>
    </section>

    <section class="counter-section">
      <h2>Interactive Counter</h2>
      <div class="counter">
        <button class="counter-btn" onclick="decrement()">−</button>
        <span id="counter-value" class="counter-value">0</span>
        <button class="counter-btn" onclick="increment()">+</button>
      </div>
      <p class="counter-label">Click the buttons to interact!</p>
    </section>
  </div>
</body>
</html>`,
              language: 'html',
            },
            {
              name: 'preview.css',
              path: 'public/styles.css',
              content: `/* Live Preview Styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
  color: #f4f4f5;
  min-height: 100vh;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.hero {
  text-align: center;
  padding: 3rem 0;
}

.hero-badge {
  display: inline-block;
  padding: 0.4rem 1rem;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 999px;
  font-size: 0.875rem;
  color: #10b981;
  margin-bottom: 1.5rem;
}

.hero h1 {
  font-size: 2.5rem;
  font-weight: 800;
  background: linear-gradient(135deg, #f4f4f5, #10b981);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1rem;
}

.hero p {
  font-size: 1.125rem;
  color: #a1a1aa;
  margin-bottom: 2rem;
}

.hero-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #10b981;
  color: white;
}

.btn-primary:hover {
  background: #059669;
  transform: translateY(-1px);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #f4f4f5;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.feature-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
  padding: 1.5rem;
  text-align: center;
  transition: all 0.2s ease;
}

.feature-card:hover {
  border-color: rgba(16, 185, 129, 0.3);
  transform: translateY(-2px);
}

.feature-icon {
  font-size: 2rem;
  margin-bottom: 0.75rem;
}

.feature-card h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.feature-card p {
  font-size: 0.875rem;
  color: #a1a1aa;
}

.counter-section {
  text-align: center;
  padding: 3rem 0;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 2rem;
}

.counter-section h2 {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
}

.counter {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
}

.counter-btn {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: 2px solid rgba(16, 185, 129, 0.5);
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.counter-btn:hover {
  background: rgba(16, 185, 129, 0.2);
  border-color: #10b981;
  transform: scale(1.1);
}

.counter-btn:active {
  transform: scale(0.95);
}

.counter-value {
  font-size: 3rem;
  font-weight: 800;
  color: #10b981;
  min-width: 4rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.counter-label {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: #71717a;
}`,
              language: 'css',
            },
            {
              name: 'preview.js',
              path: 'public/script.js',
              content: `// Interactive counter for the live preview demo
let count = 0;

function updateDisplay() {
  const el = document.getElementById('counter-value');
  if (el) {
    el.textContent = count;
    // Add a subtle animation
    el.style.transform = 'scale(1.2)';
    setTimeout(() => {
      el.style.transform = 'scale(1)';
    }, 150);
  }
}

function increment() {
  count++;
  updateDisplay();
}

function decrement() {
  count--;
  updateDisplay();
}

function handleGetStarted() {
  alert('Welcome to CodeForge AI! Start chatting with the AI to generate code.');
}

function handleLearnMore() {
  alert('CodeForge AI is an intelligent coding companion that helps you build, debug, and review code.');
}

// Initialize
console.log('CodeForge AI - Live Preview loaded!');`,
              language: 'javascript',
            },
            {
              name: 'utils.py',
              path: 'src/utils.py',
              content: `"""Utility functions for the project."""

from typing import List, Optional
import json
import os


def load_config(path: str = "config.json") -> dict:
    """Load configuration from a JSON file."""
    if not os.path.exists(path):
        return {}
    with open(path, "r") as f:
        return json.load(f)


def save_config(config: dict, path: str = "config.json") -> None:
    """Save configuration to a JSON file."""
    with open(path, "w") as f:
        json.dump(config, f, indent=2)


def filter_items(items: List[dict], key: str, value: str) -> List[dict]:
    """Filter a list of dictionaries by a key-value pair."""
    return [item for item in items if item.get(key) == value]


def sort_items(items: List[dict], key: str, reverse: bool = False) -> List[dict]:
    """Sort a list of dictionaries by a key."""
    return sorted(items, key=lambda x: x.get(key, ""), reverse=reverse)


if __name__ == "__main__":
    items = [
        {"name": "Alice", "age": 30, "city": "New York"},
        {"name": "Bob", "age": 25, "city": "London"},
    ]
    print(filter_items(items, "city", "New York"))`,
              language: 'python',
            },
          ],
        },
      },
    });

    // Create demo tasks
    await db.task.createMany({
      data: [
        {
          title: 'Set up project structure',
          description: 'Create the initial project structure with all necessary directories and configuration files',
          status: 'completed',
          agent: 'planner',
          result: 'Project structure created with src/, public/, and config files',
          progress: 100,
          projectId: project.id,
        },
        {
          title: 'Implement REST API endpoints',
          description: 'Create CRUD endpoints for the items resource',
          status: 'completed',
          agent: 'coder',
          result: 'API endpoints created: GET, POST, DELETE for /api/items',
          progress: 100,
          projectId: project.id,
        },
        {
          title: 'Add authentication middleware',
          description: 'Implement JWT-based authentication for the API',
          status: 'running',
          agent: 'coder',
          progress: 65,
          projectId: project.id,
        },
        {
          title: 'Write unit tests',
          description: 'Write comprehensive unit tests for all API endpoints',
          status: 'pending',
          agent: 'coder',
          projectId: project.id,
        },
        {
          title: 'Code review for security',
          description: 'Review all code for security vulnerabilities and best practices',
          status: 'pending',
          agent: 'reviewer',
          projectId: project.id,
        },
      ],
    });

    // Create demo memories
    await db.memory.createMany({
      data: [
        {
          type: 'long_term',
          category: 'project_structure',
          key: 'tech_stack',
          value: 'Next.js 16 with TypeScript, Express.js backend, PostgreSQL database, Tailwind CSS for styling',
          projectId: project.id,
        },
        {
          type: 'long_term',
          category: 'user_preference',
          key: 'code_style',
          value: 'TypeScript strict mode, 2-space indentation, single quotes, trailing commas, explicit return types',
          projectId: project.id,
        },
        {
          type: 'short_term',
          category: 'context',
          key: 'current_sprint',
          value: 'Sprint 3: Implementing authentication and authorization features. Focus on JWT tokens and role-based access control.',
          projectId: project.id,
        },
        {
          type: 'long_term',
          category: 'decision',
          key: 'auth_strategy',
          value: 'Decided to use JWT with refresh tokens. Access tokens expire in 15 minutes, refresh tokens in 7 days.',
          projectId: project.id,
        },
        {
          type: 'short_term',
          category: 'completed_task',
          key: 'api_implementation',
          value: 'REST API fully implemented with CRUD operations for items resource.',
          projectId: project.id,
        },
      ],
    });

    // Create demo settings
    await db.setting.upsert({
      where: { key: 'provider' },
      update: { value: 'openai' },
      create: { key: 'provider', value: 'openai' },
    });
    await db.setting.upsert({
      where: { key: 'model' },
      update: { value: 'gpt-4o' },
      create: { key: 'model', value: 'gpt-4o' },
    });
    await db.setting.upsert({
      where: { key: 'temperature' },
      update: { value: '0.7' },
      create: { key: 'temperature', value: '0.7' },
    });

    return NextResponse.json({ 
      message: 'Seed data created successfully', 
      project,
      filesCount: 6,
      tasksCount: 5,
      memoriesCount: 5,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Failed to seed data' }, { status: 500 });
  }
}
