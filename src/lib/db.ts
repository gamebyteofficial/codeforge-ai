import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger'
import { createClient, type Client } from '@libsql/client'

// ── Types compatible with what the API routes expect ──

export interface DbClient {
  project: {
    findMany(args?: any): Promise<any[]>
    findUnique(args: { where: { id: string }; include?: any }): Promise<any | null>
    findFirst(args: { where: any }): Promise<any | null>
    create(args: { data: any }): Promise<any>
    update(args: { where: { id: string }; data: any }): Promise<any>
    delete(args: { where: { id: string } }): Promise<any>
  }
  conversation: {
    findMany(args?: any): Promise<any[]>
    findUnique(args: { where: { id: string }; include?: any }): Promise<any | null>
    create(args: { data: any }): Promise<any>
    update(args: { where: { id: string }; data: any }): Promise<any>
    delete(args: { where: { id: string } }): Promise<any>
  }
  message: {
    create(args: { data: any }): Promise<any>
    findMany(args?: any): Promise<any[]>
  }
  file: {
    findMany(args?: any): Promise<any[]>
    findFirst(args: { where: any }): Promise<any | null>
    findUnique(args: { where: { id: string } }): Promise<any | null>
    create(args: { data: any }): Promise<any>
    update(args: { where: { id: string }; data: any }): Promise<any>
    delete(args: { where: { id: string } }): Promise<any>
    deleteMany(args: { where: { projectId: string } }): Promise<any>
  }
  task: {
    findMany(args?: any): Promise<any[]>
    create(args: { data: any }): Promise<any>
    createMany(args: { data: any[] }): Promise<any>
    update(args: { where: { id: string }; data: any }): Promise<any>
    delete(args: { where: { id: string } }): Promise<any>
  }
  memory: {
    findMany(args?: any): Promise<any[]>
    create(args: { data: any }): Promise<any>
    createMany(args: { data: any[] }): Promise<any>
    delete(args: { where: { id: string } }): Promise<any>
  }
  setting: {
    findMany(): Promise<any[]>
    upsert(args: { where: { key: string }; update: { value: string }; create: { key: string; value: string } }): Promise<any>
    deleteMany(args: { where: { key: string } }): Promise<any>
  }
  $disconnect(): Promise<void>
}

// ── Prisma wrapper (local SQLite) ──

class PrismaDb implements DbClient {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  get project() {
    return this.prisma.project as unknown as DbClient['project']
  }
  get conversation() {
    return this.prisma.conversation as unknown as DbClient['conversation']
  }
  get message() {
    return this.prisma.message as unknown as DbClient['message']
  }
  get file() {
    return this.prisma.file as unknown as DbClient['file']
  }
  get task() {
    return this.prisma.task as unknown as DbClient['task']
  }
  get memory() {
    return this.prisma.memory as unknown as DbClient['memory']
  }
  get setting() {
    return this.prisma.setting as unknown as DbClient['setting']
  }

  async $disconnect() {
    await this.prisma.$disconnect()
  }
}

// ── SQL helpers (pure functions) ──

function buildWhere(where: Record<string, unknown>, values: unknown[]): string {
  const clauses: string[] = []
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue
    if (value === null) {
      clauses.push(`${key} IS NULL`)
    } else {
      clauses.push(`${key} = ?`)
      values.push(value)
    }
  }
  return clauses.join(' AND ')
}

function buildOrderBy(orderBy: any): string {
  if (!orderBy) return ''
  if (typeof orderBy === 'object' && !Array.isArray(orderBy)) {
    const parts: string[] = []
    for (const [key, dir] of Object.entries(orderBy)) {
      parts.push(`${key} ${String(dir).toUpperCase()}`)
    }
    return ` ORDER BY ${parts.join(', ')}`
  }
  return ''
}

function rowToObject(row: Record<string, unknown>, columns: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (const key of columns) {
    obj[key] = row[key]
  }
  return obj
}

// SQLite stores booleans as 0/1 integers. Convert known boolean fields.
const BOOLEAN_FIELDS: Record<string, Set<string>> = {
  File: new Set(['isFolder']),
}

function convertBooleans(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const fields = BOOLEAN_FIELDS[table]
  if (!fields) return row
  for (const field of fields) {
    if (field in row && typeof row[field] === 'number') {
      row[field] = row[field] !== 0
    }
  }
  return row
}

// ── libSQL / Turso implementation ──

class LibsqlDb implements DbClient {
  private client: Client

  constructor(client: Client) {
    this.client = client
  }

  // Helper: run a SELECT and return rows as plain objects
  private async select(sql: string, args: unknown[] = []): Promise<any[]> {
    const result = await this.client.execute({ sql, args })
    return result.rows.map((row) => rowToObject(row as Record<string, unknown>, result.columns))
  }

  // Helper: run a SELECT and return first row or null
  private async selectOne(sql: string, args: unknown[] = []): Promise<any | null> {
    const rows = await this.select(sql, args)
    return rows[0] || null
  }

  // Helper: run a write statement with RETURNING *
  private async insertReturning(sql: string, args: unknown[] = []): Promise<any> {
    const result = await this.client.execute({ sql, args })
    if (result.rows.length > 0) {
      return rowToObject(result.rows[0] as Record<string, unknown>, result.columns)
    }
    return {}
  }

  // ── Project ──

  get project() {
    const client = this.client
    const select = (sql: string, args: unknown[] = []) => this.select(sql, args)
    const selectOne = (sql: string, args: unknown[] = []) => this.selectOne(sql, args)
    const insertReturning = (sql: string, args: unknown[] = []) => this.insertReturning(sql, args)

    return {
      async findMany(args?: any): Promise<any[]> {
        let sql = 'SELECT * FROM Project'
        const values: unknown[] = []

        if (args?.where) {
          const clauses = buildWhere(args.where, values)
          if (clauses) sql += ` WHERE ${clauses}`
        }

        if (args?.orderBy) {
          sql += buildOrderBy(args.orderBy)
        } else {
          sql += ' ORDER BY updatedAt DESC'
        }

        const rows = await select(sql, values)

        // Handle include._count — batch with GROUP BY to avoid N+1 queries
        if (args?.include?._count) {
          const countSelects = args.include._count.select || {}
          const projectIds = rows.map((r: any) => r.id)
          if (projectIds.length > 0) {
            const placeholders = projectIds.map(() => '?').join(', ')

            if (countSelects.files) {
              const r = await client.execute({ sql: `SELECT projectId, COUNT(*) as cnt FROM File WHERE projectId IN (${placeholders}) GROUP BY projectId`, args: projectIds })
              const map = new Map(r.rows.map((row: any) => [row.projectId, Number(row.cnt)]))
              for (const row of rows) { (row as any)._count = { ...((row as any)._count || {}), files: map.get(row.id) || 0 } }
            }
            if (countSelects.tasks) {
              const r = await client.execute({ sql: `SELECT projectId, COUNT(*) as cnt FROM Task WHERE projectId IN (${placeholders}) GROUP BY projectId`, args: projectIds })
              const map = new Map(r.rows.map((row: any) => [row.projectId, Number(row.cnt)]))
              for (const row of rows) { (row as any)._count = { ...((row as any)._count || {}), tasks: map.get(row.id) || 0 } }
            }
            if (countSelects.conversations) {
              const r = await client.execute({ sql: `SELECT projectId, COUNT(*) as cnt FROM Conversation WHERE projectId IN (${placeholders}) GROUP BY projectId`, args: projectIds })
              const map = new Map(r.rows.map((row: any) => [row.projectId, Number(row.cnt)]))
              for (const row of rows) { (row as any)._count = { ...((row as any)._count || {}), conversations: map.get(row.id) || 0 } }
            }
          }
        }

        return rows
      },

      async findUnique(args: { where: { id: string }; include?: any }): Promise<any | null> {
        const row = await selectOne('SELECT * FROM Project WHERE id = ?', [args.where.id])
        if (!row) return null

        if (args.include) {
          if (args.include.files) {
            const files = await select('SELECT * FROM File WHERE projectId = ? ORDER BY path ASC', [args.where.id])
            row.files = files.map((f: any) => convertBooleans('File', f))
          }
          if (args.include.tasks) {
            row.tasks = await select('SELECT * FROM Task WHERE projectId = ? ORDER BY createdAt DESC', [args.where.id])
          }
          if (args.include.conversations) {
            row.conversations = await select('SELECT * FROM Conversation WHERE projectId = ? ORDER BY updatedAt DESC', [args.where.id])
          }
          if (args.include.memories) {
            row.memories = await select('SELECT * FROM Memory WHERE projectId = ? ORDER BY createdAt DESC', [args.where.id])
          }
        }

        return row
      },

      async findFirst(args: { where: any }): Promise<any | null> {
        let sql = 'SELECT * FROM Project'
        const values: unknown[] = []
        const clauses = buildWhere(args.where, values)
        if (clauses) sql += ` WHERE ${clauses}`
        sql += ' LIMIT 1'
        return selectOne(sql, values)
      },

      async create(args: { data: any }): Promise<any> {
        const data = { ...args.data }
        const id = crypto.randomUUID()
        const now = new Date().toISOString()

        // Check for nested creates (e.g., files: { create: [...] })
        const nestedCreates: { createFn: (item: any) => Promise<any>; data: any[] }[] = []
        if (data.files?.create) {
          const fileCreate = (item: any) => insertReturning(
            'INSERT INTO File (id, name, path, content, language, isFolder, projectId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
            [crypto.randomUUID(), item.name, item.path, item.content || '', item.language || 'text', item.isFolder || false, id, now, now]
          )
          nestedCreates.push({ createFn: fileCreate, data: data.files.create })
          delete data.files
        }
        if (data.tasks?.create) {
          const taskCreate = (item: any) => insertReturning(
            'INSERT INTO Task (id, title, description, status, agent, result, progress, projectId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
            [crypto.randomUUID(), item.title, item.description || null, item.status || 'pending', item.agent || null, item.result || null, item.progress || 0, id, now, now]
          )
          nestedCreates.push({ createFn: taskCreate, data: data.tasks.create })
          delete data.tasks
        }
        if (data.conversations?.create) {
          const convCreate = (item: any) => insertReturning(
            'INSERT INTO Conversation (id, title, projectId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?) RETURNING *',
            [crypto.randomUUID(), item.title || 'New Chat', id, now, now]
          )
          nestedCreates.push({ createFn: convCreate, data: data.conversations.create })
          delete data.conversations
        }
        if (data.memories?.create) {
          const memCreate = (item: any) => insertReturning(
            'INSERT INTO Memory (id, type, category, key, value, projectId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
            [crypto.randomUUID(), item.type || 'short_term', item.category || null, item.key, item.value, id, now, now]
          )
          nestedCreates.push({ createFn: memCreate, data: data.memories.create })
          delete data.memories
        }

        const fields = ['id', 'createdAt', 'updatedAt']
        const values: unknown[] = [id, now, now]
        const placeholders = ['?', '?', '?']

        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) {
            fields.push(key)
            values.push(value === null ? null : value)
            placeholders.push('?')
          }
        }

        const sql = `INSERT INTO Project (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`
        const row = await insertReturning(sql, values)

        // Handle nested creates
        for (const nested of nestedCreates) {
          for (const item of nested.data) {
            await nested.createFn(item)
          }
        }

        return row
      },

      async update(args: { where: { id: string }; data: any }): Promise<any> {
        const sets: string[] = ['updatedAt = ?']
        const values: unknown[] = [new Date().toISOString()]

        for (const [key, value] of Object.entries(args.data)) {
          if (value !== undefined && key !== 'id' && key !== 'createdAt') {
            sets.push(`${key} = ?`)
            values.push(value === null ? null : value)
          }
        }

        values.push(args.where.id)
        const sql = `UPDATE Project SET ${sets.join(', ')} WHERE id = ? RETURNING *`
        return insertReturning(sql, values)
      },

      async delete(args: { where: { id: string } }): Promise<any> {
        const row = await selectOne('SELECT * FROM Project WHERE id = ?', [args.where.id])
        await client.execute({ sql: 'DELETE FROM Project WHERE id = ?', args: [args.where.id] })
        return row || { id: args.where.id }
      },
    }
  }

  // ── Conversation ──

  get conversation() {
    const select = (sql: string, args: unknown[] = []) => this.select(sql, args)
    const selectOne = (sql: string, args: unknown[] = []) => this.selectOne(sql, args)
    const insertReturning = (sql: string, args: unknown[] = []) => this.insertReturning(sql, args)
    const doDelete = (id: string) => this.client.execute({ sql: 'DELETE FROM Conversation WHERE id = ?', args: [id] })

    return {
      async findMany(args?: any): Promise<any[]> {
        let sql = 'SELECT * FROM Conversation'
        const values: unknown[] = []

        if (args?.where) {
          const clauses = buildWhere(args.where, values)
          if (clauses) sql += ` WHERE ${clauses}`
        }

        if (args?.orderBy) {
          sql += buildOrderBy(args.orderBy)
        } else {
          sql += ' ORDER BY updatedAt DESC'
        }

        return select(sql, values)
      },

      async findUnique(args: { where: { id: string }; include?: any }): Promise<any | null> {
        const row = await selectOne('SELECT * FROM Conversation WHERE id = ?', [args.where.id])
        if (!row) return null

        if (args.include?.messages) {
          const orderBy = args.include.messages.orderBy
          const orderSql = orderBy ? buildOrderBy(orderBy) : ' ORDER BY createdAt ASC'
          row.messages = await select(
            `SELECT * FROM Message WHERE conversationId = ?${orderSql}`,
            [args.where.id]
          )
        }

        return row
      },

      async create(args: { data: any }): Promise<any> {
        const data = args.data
        const id = crypto.randomUUID()
        const now = new Date().toISOString()

        const fields = ['id', 'createdAt', 'updatedAt']
        const values: unknown[] = [id, now, now]
        const placeholders = ['?', '?', '?']

        if (data.title === undefined) {
          fields.push('title')
          values.push('New Chat')
          placeholders.push('?')
        }

        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) {
            fields.push(key)
            values.push(value === null ? null : value)
            placeholders.push('?')
          }
        }

        const sql = `INSERT INTO Conversation (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`
        return insertReturning(sql, values)
      },

      async update(args: { where: { id: string }; data: any }): Promise<any> {
        const sets: string[] = ['updatedAt = ?']
        const values: unknown[] = [new Date().toISOString()]

        for (const [key, value] of Object.entries(args.data)) {
          if (value !== undefined && key !== 'id' && key !== 'createdAt') {
            sets.push(`${key} = ?`)
            values.push(value === null ? null : value)
          }
        }

        values.push(args.where.id)
        const sql = `UPDATE Conversation SET ${sets.join(', ')} WHERE id = ? RETURNING *`
        return insertReturning(sql, values)
      },

      async delete(args: { where: { id: string } }): Promise<any> {
        const row = await selectOne('SELECT * FROM Conversation WHERE id = ?', [args.where.id])
        await doDelete(args.where.id)
        return row || { id: args.where.id }
      },
    }
  }

  // ── Message ──

  get message() {
    const select = (sql: string, args: unknown[] = []) => this.select(sql, args)
    const insertReturning = (sql: string, args: unknown[] = []) => this.insertReturning(sql, args)

    return {
      async create(args: { data: any }): Promise<any> {
        const data = args.data
        const id = crypto.randomUUID()
        const now = new Date().toISOString()

        const fields = ['id', 'createdAt']
        const values: unknown[] = [id, now]
        const placeholders = ['?', '?']

        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) {
            fields.push(key)
            values.push(value === null ? null : value)
            placeholders.push('?')
          }
        }

        const sql = `INSERT INTO Message (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`
        return insertReturning(sql, values)
      },

      async findMany(args?: any): Promise<any[]> {
        let sql = 'SELECT * FROM Message'
        const values: unknown[] = []

        if (args?.where) {
          const clauses = buildWhere(args.where, values)
          if (clauses) sql += ` WHERE ${clauses}`
        }

        if (args?.orderBy) {
          sql += buildOrderBy(args.orderBy)
        } else {
          sql += ' ORDER BY createdAt ASC'
        }

        return select(sql, values)
      },
    }
  }

  // ── File ──

  get file() {
    const client = this.client
    const select = (sql: string, args: unknown[] = []) => this.select(sql, args)
    const selectOne = (sql: string, args: unknown[] = []) => this.selectOne(sql, args)
    const insertReturning = (sql: string, args: unknown[] = []) => this.insertReturning(sql, args)

    // Convert boolean fields for File rows
    const convertFile = (row: any) => convertBooleans('File', row)
    const convertFileRows = (rows: any[]) => rows.map(convertFile)

    return {
      async findMany(args?: any): Promise<any[]> {
        let sql = 'SELECT * FROM File'
        const values: unknown[] = []

        if (args?.where) {
          const clauses = buildWhere(args.where, values)
          if (clauses) sql += ` WHERE ${clauses}`
        }

        if (args?.orderBy) {
          sql += buildOrderBy(args.orderBy)
        } else {
          sql += ' ORDER BY path ASC'
        }

        return convertFileRows(await select(sql, values))
      },

      async findFirst(args: { where: any }): Promise<any | null> {
        let sql = 'SELECT * FROM File'
        const values: unknown[] = []
        const clauses = buildWhere(args.where, values)
        if (clauses) sql += ` WHERE ${clauses}`
        sql += ' LIMIT 1'
        const row = await selectOne(sql, values)
        return row ? convertFile(row) : null
      },

      async findUnique(args: { where: { id: string } }): Promise<any | null> {
        const row = await selectOne('SELECT * FROM File WHERE id = ?', [args.where.id])
        return row ? convertFile(row) : null
      },

      async create(args: { data: any }): Promise<any> {
        const data = args.data
        const id = crypto.randomUUID()
        const now = new Date().toISOString()

        const fields = ['id', 'createdAt', 'updatedAt']
        const values: unknown[] = [id, now, now]
        const placeholders = ['?', '?', '?']

        if (data.content === undefined) {
          fields.push('content')
          values.push('')
          placeholders.push('?')
        }
        if (data.isFolder === undefined) {
          fields.push('isFolder')
          values.push(false)
          placeholders.push('?')
        }

        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) {
            fields.push(key)
            values.push(value === null ? null : value)
            placeholders.push('?')
          }
        }

        const sql = `INSERT INTO File (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`
        return convertFile(await insertReturning(sql, values))
      },

      async update(args: { where: { id: string }; data: any }): Promise<any> {
        const sets: string[] = ['updatedAt = ?']
        const values: unknown[] = [new Date().toISOString()]

        for (const [key, value] of Object.entries(args.data)) {
          if (value !== undefined && key !== 'id' && key !== 'createdAt') {
            sets.push(`${key} = ?`)
            values.push(value === null ? null : value)
          }
        }

        values.push(args.where.id)
        const sql = `UPDATE File SET ${sets.join(', ')} WHERE id = ? RETURNING *`
        return convertFile(await insertReturning(sql, values))
      },

      async delete(args: { where: { id: string } }): Promise<any> {
        const row = await selectOne('SELECT * FROM File WHERE id = ?', [args.where.id])
        await client.execute({ sql: 'DELETE FROM File WHERE id = ?', args: [args.where.id] })
        return row ? convertFile(row) : { id: args.where.id }
      },

      async deleteMany(args: { where: { projectId: string } }): Promise<any> {
        const result = await client.execute({ sql: 'DELETE FROM File WHERE projectId = ?', args: [args.where.projectId] })
        return { count: result.rowsAffected }
      },
    }
  }

  // ── Task ──

  get task() {
    const client = this.client
    const select = (sql: string, args: unknown[] = []) => this.select(sql, args)
    const selectOne = (sql: string, args: unknown[] = []) => this.selectOne(sql, args)
    const insertReturning = (sql: string, args: unknown[] = []) => this.insertReturning(sql, args)

    const taskCreateFromData = async (itemData: any): Promise<any> => {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      const fields = ['id', 'createdAt', 'updatedAt']
      const values: unknown[] = [id, now, now]
      const placeholders = ['?', '?', '?']

      if (itemData.status === undefined) {
        fields.push('status')
        values.push('pending')
        placeholders.push('?')
      }
      if (itemData.progress === undefined) {
        fields.push('progress')
        values.push(0)
        placeholders.push('?')
      }

      for (const [key, value] of Object.entries(itemData)) {
        if (value !== undefined) {
          fields.push(key)
          values.push(value === null ? null : value)
          placeholders.push('?')
        }
      }

      const sql = `INSERT INTO Task (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`
      return insertReturning(sql, values)
    }

    return {
      async findMany(args?: any): Promise<any[]> {
        let sql = 'SELECT * FROM Task'
        const values: unknown[] = []

        if (args?.where) {
          const clauses = buildWhere(args.where, values)
          if (clauses) sql += ` WHERE ${clauses}`
        }

        if (args?.orderBy) {
          sql += buildOrderBy(args.orderBy)
        } else {
          sql += ' ORDER BY createdAt DESC'
        }

        return select(sql, values)
      },

      async create(args: { data: any }): Promise<any> {
        return taskCreateFromData(args.data)
      },

      async createMany(args: { data: any[] }): Promise<any> {
        let count = 0
        for (const item of args.data) {
          await taskCreateFromData(item)
          count++
        }
        return { count }
      },

      async update(args: { where: { id: string }; data: any }): Promise<any> {
        const sets: string[] = ['updatedAt = ?']
        const values: unknown[] = [new Date().toISOString()]

        for (const [key, value] of Object.entries(args.data)) {
          if (value !== undefined && key !== 'id' && key !== 'createdAt') {
            sets.push(`${key} = ?`)
            values.push(value === null ? null : value)
          }
        }

        values.push(args.where.id)
        const sql = `UPDATE Task SET ${sets.join(', ')} WHERE id = ? RETURNING *`
        return insertReturning(sql, values)
      },

      async delete(args: { where: { id: string } }): Promise<any> {
        const row = await selectOne('SELECT * FROM Task WHERE id = ?', [args.where.id])
        await client.execute({ sql: 'DELETE FROM Task WHERE id = ?', args: [args.where.id] })
        return row || { id: args.where.id }
      },
    }
  }

  // ── Memory ──

  get memory() {
    const client = this.client
    const select = (sql: string, args: unknown[] = []) => this.select(sql, args)
    const selectOne = (sql: string, args: unknown[] = []) => this.selectOne(sql, args)
    const insertReturning = (sql: string, args: unknown[] = []) => this.insertReturning(sql, args)

    const memoryCreateFromData = async (itemData: any): Promise<any> => {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      const fields = ['id', 'createdAt', 'updatedAt']
      const values: unknown[] = [id, now, now]
      const placeholders = ['?', '?', '?']

      if (itemData.type === undefined) {
        fields.push('type')
        values.push('short_term')
        placeholders.push('?')
      }

      for (const [key, value] of Object.entries(itemData)) {
        if (value !== undefined) {
          fields.push(key)
          values.push(value === null ? null : value)
          placeholders.push('?')
        }
      }

      const sql = `INSERT INTO Memory (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`
      return insertReturning(sql, values)
    }

    return {
      async findMany(args?: any): Promise<any[]> {
        let sql = 'SELECT * FROM Memory'
        const values: unknown[] = []

        if (args?.where) {
          const clauses = buildWhere(args.where, values)
          if (clauses) sql += ` WHERE ${clauses}`
        }

        if (args?.orderBy) {
          sql += buildOrderBy(args.orderBy)
        } else {
          sql += ' ORDER BY createdAt DESC'
        }

        return select(sql, values)
      },

      async create(args: { data: any }): Promise<any> {
        return memoryCreateFromData(args.data)
      },

      async createMany(args: { data: any[] }): Promise<any> {
        let count = 0
        for (const item of args.data) {
          await memoryCreateFromData(item)
          count++
        }
        return { count }
      },

      async delete(args: { where: { id: string } }): Promise<any> {
        const row = await selectOne('SELECT * FROM Memory WHERE id = ?', [args.where.id])
        await client.execute({ sql: 'DELETE FROM Memory WHERE id = ?', args: [args.where.id] })
        return row || { id: args.where.id }
      },
    }
  }

  // ── Setting ──

  get setting() {
    const select = (sql: string, args: unknown[] = []) => this.select(sql, args)
    const client = this.client

    return {
      async findMany(): Promise<any[]> {
        return select('SELECT * FROM Setting')
      },

      async upsert(args: { where: { key: string }; update: { value: string }; create: { key: string; value: string } }): Promise<any> {
        const id = crypto.randomUUID()
        const sql = 'INSERT INTO Setting (id, key, value) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = ? RETURNING *'
        const result = await client.execute({
          sql,
          args: [id, args.create.key, args.create.value, args.update.value],
        })

        if (result.rows.length > 0) {
          return rowToObject(result.rows[0] as Record<string, unknown>, result.columns)
        }

        return { id, key: args.create.key, value: args.update.value }
      },

      async deleteMany(args: { where: { key: string } }): Promise<any> {
        const result = await client.execute({ sql: 'DELETE FROM Setting WHERE key = ?', args: [args.where.key] })
        return { count: result.rowsAffected }
      },
    }
  }

  async $disconnect() {
    this.client.close()
  }
}

// ── Client creation ──

const globalForDb = globalThis as unknown as {
  db: DbClient | undefined
}

function createDbClient(): DbClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL || ''
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN || ''

  if (tursoUrl && tursoAuthToken) {
    logger.log('[DB] ☁️  Connecting to Turso cloud database:', tursoUrl)
    const client = createClient({ url: tursoUrl, authToken: tursoAuthToken })
    return new LibsqlDb(client)
  }

  // Local SQLite fallback — use Prisma
  const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db'
  logger.log('[DB] 💾 Connecting to local SQLite:', databaseUrl)
  return new PrismaDb(new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
    datasources: { db: { url: databaseUrl } },
  }))
}

// Reuse existing client on hot-reload to avoid closing in-flight connections.
// But always recreate the DbClient wrapper so code changes are picked up.
const existingLibsqlClient = (globalForDb.db as any)?.client as Client | undefined
if (existingLibsqlClient) {
  // Hot-reload: reuse the existing libsql connection but wrap it in a fresh LibsqlDb
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    globalForDb.db = new LibsqlDb(existingLibsqlClient)
  }
}

export const db = globalForDb.db ?? createDbClient()

if (process.env.NODE_ENV !== 'production') globalForDb.db = db
