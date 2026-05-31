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
