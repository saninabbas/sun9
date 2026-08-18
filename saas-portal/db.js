const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default initial database state
const defaultData = {
  users: [
    {
      id: 'usr_admin_root',
      name: 'Root Administrator',
      email: 'admin@sun9.io',
      passwordHash: bcrypt.hashSync('admin123456', 10),
      role: 'admin',
      plan: 'Scale Plan',
      planTier: 'scale',
      planPrice: '$199/mo',
      status: 'Active',
      workflowsLimit: 250,
      executionsLimit: 100000,
      executionsUsed: 4210,
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'usr_9x72k',
      name: 'Alex Rivera',
      email: 'alex@company.com',
      passwordHash: bcrypt.hashSync('password123', 10),
      role: 'user',
      plan: 'Pro Plan',
      planTier: 'pro',
      planPrice: '$29/mo',
      status: 'Active',
      workflowsLimit: 50,
      executionsLimit: 25000,
      executionsUsed: 8421,
      createdAt: '2026-07-12T10:30:00.000Z'
    },
    {
      id: 'usr_8b31a',
      name: 'Devin Vance',
      email: 'devin@fintechcorp.io',
      passwordHash: bcrypt.hashSync('password123', 10),
      role: 'user',
      plan: 'Scale Plan',
      planTier: 'scale',
      planPrice: '$199/mo',
      status: 'Active',
      workflowsLimit: 250,
      executionsLimit: 100000,
      executionsUsed: 12400,
      createdAt: '2026-06-01T08:15:00.000Z'
    }
  ],
  apiKeys: [
    {
      id: 'key_prod_1',
      userId: 'usr_9x72k',
      name: 'Production Server',
      prefix: 'sun9_live_',
      masked: '••••••••••••9F2A',
      fullKey: 'sun9_live_9f83a8b27c194a5e982189F2A',
      created: 'Aug 18, 2026',
      lastUsed: '2 mins ago',
      status: 'Active'
    }
  ],
  workflows: [
    {
      id: 'wf_101',
      userId: 'usr_9x72k',
      name: 'Lead Enrichment Agent',
      n8n_workflow_id: 'n8n_wf_101',
      status: 'active',
      definition: {
        nodes: [
          { id: 'n1', type: 'webhook', name: 'Webhook Intake', parameters: { path: 'incoming-leads' } },
          { id: 'n2', type: 'ai_agent', name: 'Claude 3.5 Sonnet', parameters: { model: 'claude-3-5-sonnet' } },
          { id: 'n3', type: 'condition', name: 'Score Filter', parameters: { operation: 'greaterThan' } },
          { id: 'n4', type: 'database', name: 'PostgreSQL Upsert', parameters: { query: 'INSERT INTO leads VALUES ($1)' } }
        ]
      },
      createdAt: '2026-08-10T14:00:00.000Z',
      updatedAt: '2026-08-18T12:00:00.000Z'
    },
    {
      id: 'wf_102',
      userId: 'usr_9x72k',
      name: 'Stripe Invoice Router',
      n8n_workflow_id: 'n8n_wf_102',
      status: 'active',
      definition: {
        nodes: [
          { id: 'n1', type: 'webhook', name: 'Stripe Hook', parameters: {} },
          { id: 'n2', type: 'slack', name: 'Slack Alert', parameters: {} }
        ]
      },
      createdAt: '2026-08-12T11:00:00.000Z',
      updatedAt: '2026-08-18T12:00:00.000Z'
    }
  ],
  workflowExecutions: [
    {
      id: 'exec_8421',
      workflowId: 'wf_101',
      workflowName: 'Lead Enrichment Agent',
      userId: 'usr_9x72k',
      n8nExecutionId: '12891',
      status: 'SUCCESS',
      startedAt: '2026-08-18T14:38:12.000Z',
      finishedAt: '2026-08-18T14:38:12.240Z',
      durationMs: 240,
      timeline: [
        { node: 'Webhook Intake', status: 'SUCCESS', durationMs: 28 },
        { node: 'Claude 3.5 Sonnet', status: 'SUCCESS', durationMs: 110 },
        { node: 'Score Filter', status: 'SUCCESS', durationMs: 14 },
        { node: 'PostgreSQL Upsert', status: 'SUCCESS', durationMs: 88 }
      ],
      createdAt: '2026-08-18T14:38:12.000Z'
    },
    {
      id: 'exec_8420',
      workflowId: 'wf_102',
      workflowName: 'Stripe Invoice Router',
      userId: 'usr_9x72k',
      n8nExecutionId: '12890',
      status: 'SUCCESS',
      startedAt: '2026-08-18T14:34:00.000Z',
      finishedAt: '2026-08-18T14:34:00.180Z',
      durationMs: 180,
      timeline: [
        { node: 'Stripe Hook', status: 'SUCCESS', durationMs: 40 },
        { node: 'Slack Alert', status: 'SUCCESS', durationMs: 140 }
      ],
      createdAt: '2026-08-18T14:34:00.000Z'
    }
  ],
  settings: {
    maintenanceMode: false,
    allowNewSignups: true,
    globalRateLimit: 1200,
    n8nEngineEndpoint: process.env.N8N_BASE_URL || 'http://localhost:5678',
    stripeLiveMode: false,
    polarLiveMode: true
  }
};

// Initialize persistent storage
function loadData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed.workflowExecutions) parsed.workflowExecutions = defaultData.workflowExecutions;
      return parsed;
    }
  } catch (err) {
    console.error('Error reading db.json, re-initializing:', err.message);
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
  return defaultData;
}

function saveData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving db.json:', err.message);
  }
}

// PostgreSQL Connection Pool
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL || (process.env.DB_POSTGRESDB_HOST ? `postgresql://${process.env.DB_POSTGRESDB_USER}:${process.env.DB_POSTGRESDB_PASSWORD}@${process.env.DB_POSTGRESDB_HOST}:5432/${process.env.DB_POSTGRESDB_DATABASE}` : null)
});

async function initPostgres() {
  if (!process.env.DATABASE_URL && !process.env.DB_POSTGRESDB_HOST) return;
  try {
    const client = await pgPool.connect();
    console.log('✓ PostgreSQL connected successfully.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(32) DEFAULT 'user',
        plan VARCHAR(64) DEFAULT 'Free Plan',
        plan_tier VARCHAR(32) DEFAULT 'free',
        plan_price VARCHAR(32) DEFAULT '$0',
        status VARCHAR(32) DEFAULT 'Active',
        workflows_limit INT DEFAULT 10,
        executions_limit INT DEFAULT 1000,
        executions_used INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        prefix VARCHAR(32) NOT NULL,
        masked VARCHAR(64) NOT NULL,
        full_key VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used VARCHAR(64) DEFAULT 'Never',
        status VARCHAR(32) DEFAULT 'Active'
      );

      CREATE TABLE IF NOT EXISTS workflows (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        n8n_workflow_id VARCHAR(64),
        status VARCHAR(32) DEFAULT 'active',
        definition JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS workflow_executions (
        id VARCHAR(64) PRIMARY KEY,
        workflow_id VARCHAR(64) REFERENCES workflows(id) ON DELETE CASCADE,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        n8n_execution_id VARCHAR(64),
        status VARCHAR(32) NOT NULL,
        started_at TIMESTAMP,
        finished_at TIMESTAMP,
        duration_ms INT,
        timeline JSONB,
        error_code VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    client.release();
  } catch (err) {
    console.log('ℹ Using embedded persistent database storage (data/db.json).');
  }
}

initPostgres();

// =========================================================================
// USER & AUTH METHODS
// =========================================================================

async function findUserByEmail(email) {
  const data = loadData();
  const normalizedEmail = (email || '').toLowerCase().trim();
  return data.users.find(u => u.email.toLowerCase() === normalizedEmail) || null;
}

async function findUserById(id) {
  const data = loadData();
  return data.users.find(u => u.id === id) || null;
}

async function findUserByApiKey(fullKey) {
  const data = loadData();
  const keyRecord = data.apiKeys.find(k => k.fullKey === fullKey && k.status === 'Active');
  if (!keyRecord) return null;
  keyRecord.lastUsed = 'Just now';
  saveData(data);
  return data.users.find(u => u.id === keyRecord.userId) || null;
}

async function createUser({ name, email, password, role = 'user', planTier = 'free' }) {
  const data = loadData();
  const normalizedEmail = (email || '').toLowerCase().trim();

  if (data.users.find(u => u.email.toLowerCase() === normalizedEmail)) {
    throw new Error('An account with this email address already exists.');
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const newUserId = 'usr_' + Math.random().toString(36).substring(2, 10);

  const plan = planTier === 'scale' ? 'Scale Plan' : planTier === 'pro' ? 'Pro Plan' : 'Free Plan';
  const planPrice = planTier === 'scale' ? '$199/mo' : planTier === 'pro' ? '$29/mo' : '$0';
  const workflowsLimit = planTier === 'scale' ? 250 : planTier === 'pro' ? 50 : 10;
  const executionsLimit = planTier === 'scale' ? 100000 : planTier === 'pro' ? 25000 : 1000;

  const newUser = {
    id: newUserId,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role,
    plan,
    planTier,
    planPrice,
    status: 'Active',
    workflowsLimit,
    executionsLimit,
    executionsUsed: 0,
    createdAt: new Date().toISOString()
  };

  data.users.push(newUser);

  // Generate initial default API Key
  const hex = Math.random().toString(36).substring(2, 6).toUpperCase();
  data.apiKeys.push({
    id: 'key_' + Math.random().toString(36).substring(2, 8),
    userId: newUserId,
    name: 'Default Workspace Key',
    prefix: 'sun9_live_',
    masked: '••••••••••••' + hex,
    fullKey: 'sun9_live_' + Math.random().toString(36).substring(2, 18) + hex,
    created: 'Just now',
    lastUsed: 'Never',
    status: 'Active'
  });

  saveData(data);
  return newUser;
}

async function updateUserPlan(userId, planTier) {
  const data = loadData();
  const user = data.users.find(u => u.id === userId);
  if (!user) throw new Error('User not found');

  user.planTier = planTier;
  user.plan = planTier === 'scale' ? 'Scale Plan' : planTier === 'pro' ? 'Pro Plan' : 'Free Plan';
  user.planPrice = planTier === 'scale' ? '$199/mo' : planTier === 'pro' ? '$29/mo' : '$0';
  user.workflowsLimit = planTier === 'scale' ? 250 : planTier === 'pro' ? 50 : 10;
  user.executionsLimit = planTier === 'scale' ? 100000 : planTier === 'pro' ? 25000 : 1000;

  saveData(data);
  return user;
}

// =========================================================================
// WORKFLOW METHODS (TENANT-SCOPED)
// =========================================================================

async function createWorkflow(userId, workflowData) {
  const data = loadData();
  const user = data.users.find(u => u.id === userId);
  if (!user) throw new Error('User not found');

  const userWfCount = data.workflows.filter(w => w.userId === userId).length;
  if (userWfCount >= user.workflowsLimit) {
    const err = new Error(`Workflow limit reached (${user.workflowsLimit} max for ${user.plan}). Please upgrade your subscription.`);
    err.code = 'QUOTA_EXCEEDED';
    throw err;
  }

  const workflowId = 'wf_' + Math.random().toString(36).substring(2, 10);
  const newWorkflow = {
    id: workflowId,
    userId,
    name: workflowData.name || 'Untitled Workflow',
    n8n_workflow_id: workflowData.n8n_workflow_id || null,
    status: 'active',
    definition: workflowData.definition || { nodes: [], connections: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  data.workflows.push(newWorkflow);
  saveData(data);
  return newWorkflow;
}

async function getWorkflowsByUser(userId) {
  const data = loadData();
  return data.workflows.filter(w => w.userId === userId);
}

async function getWorkflowById(userId, workflowId) {
  const data = loadData();
  return data.workflows.find(w => w.userId === userId && w.id === workflowId) || null;
}

async function updateWorkflow(userId, workflowId, updates) {
  const data = loadData();
  const wf = data.workflows.find(w => w.userId === userId && w.id === workflowId);
  if (!wf) return null;

  if (updates.name) wf.name = updates.name;
  if (updates.definition) wf.definition = updates.definition;
  if (updates.n8n_workflow_id) wf.n8n_workflow_id = updates.n8n_workflow_id;
  if (updates.status) wf.status = updates.status;
  wf.updatedAt = new Date().toISOString();

  saveData(data);
  return wf;
}

async function deleteWorkflow(userId, workflowId) {
  const data = loadData();
  const initialLen = data.workflows.length;
  data.workflows = data.workflows.filter(w => !(w.userId === userId && w.id === workflowId));
  saveData(data);
  return data.workflows.length < initialLen;
}

// =========================================================================
// EXECUTION & QUOTA METHODS (TENANT-SCOPED)
// =========================================================================

async function checkAndDeductQuota(userId) {
  const data = loadData();
  const user = data.users.find(u => u.id === userId);
  if (!user) throw new Error('User not found');

  const used = user.executionsUsed || 0;
  const limit = user.executionsLimit || 1000;

  if (used >= limit) {
    const err = new Error(`Monthly execution quota exceeded (${used.toLocaleString()} / ${limit.toLocaleString()}). Upgrade your plan to run more workflows.`);
    err.code = 'QUOTA_EXCEEDED';
    err.statusCode = 429;
    throw err;
  }

  user.executionsUsed = used + 1;
  saveData(data);
  return { used: user.executionsUsed, limit };
}

async function recordExecution(executionData) {
  const data = loadData();
  const execId = executionData.id || ('exec_' + Math.random().toString(36).substring(2, 10));

  const newExec = {
    id: execId,
    workflowId: executionData.workflowId,
    workflowName: executionData.workflowName || 'Workflow Execution',
    userId: executionData.userId,
    n8nExecutionId: executionData.n8nExecutionId || null,
    status: executionData.status || 'RUNNING',
    startedAt: executionData.startedAt || new Date().toISOString(),
    finishedAt: executionData.finishedAt || null,
    durationMs: executionData.durationMs || 0,
    timeline: executionData.timeline || [],
    errorCode: executionData.errorCode || null,
    createdAt: new Date().toISOString()
  };

  data.workflowExecutions.unshift(newExec);
  saveData(data);
  return newExec;
}

async function updateExecution(executionId, updates) {
  const data = loadData();
  const exec = data.workflowExecutions.find(e => e.id === executionId);
  if (!exec) return null;

  if (updates.status) exec.status = updates.status;
  if (updates.finishedAt) exec.finishedAt = updates.finishedAt;
  if (updates.durationMs) exec.durationMs = updates.durationMs;
  if (updates.timeline) exec.timeline = updates.timeline;
  if (updates.errorCode) exec.errorCode = updates.errorCode;
  if (updates.n8nExecutionId) exec.n8nExecutionId = updates.n8nExecutionId;

  saveData(data);
  return exec;
}

async function getExecutionById(userId, executionId) {
  const data = loadData();
  return data.workflowExecutions.find(e => e.userId === userId && e.id === executionId) || null;
}

async function getWorkflowExecutions(userId, workflowId) {
  const data = loadData();
  return data.workflowExecutions.filter(e => e.userId === userId && (!workflowId || e.workflowId === workflowId));
}

// =========================================================================
// API KEYS & TENANTS
// =========================================================================

async function getUserApiKeys(userId) {
  const data = loadData();
  return data.apiKeys.filter(k => k.userId === userId);
}

async function createApiKey(userId, name) {
  const data = loadData();
  const keyId = 'key_' + Math.random().toString(36).substring(2, 8);
  const hex = Math.random().toString(36).substring(2, 6).toUpperCase();
  const newKey = {
    id: keyId,
    userId,
    name: name || 'API Key ' + (data.apiKeys.filter(k => k.userId === userId).length + 1),
    prefix: 'sun9_live_',
    masked: '••••••••••••' + hex,
    fullKey: 'sun9_live_' + Math.random().toString(36).substring(2, 18) + hex,
    created: 'Just now',
    lastUsed: 'Never',
    status: 'Active'
  };
  data.apiKeys.unshift(newKey);
  saveData(data);
  return newKey;
}

async function revokeApiKey(userId, keyId) {
  const data = loadData();
  data.apiKeys = data.apiKeys.filter(k => !(k.userId === userId && k.id === keyId));
  saveData(data);
  return true;
}

async function getAllTenants() {
  const data = loadData();
  return data.users.map(u => {
    const wfCount = data.workflows.filter(w => w.userId === u.id).length;
    const execCount = (u.executionsUsed || 0) + 420;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      plan: u.plan,
      planTier: u.planTier,
      workflows: wfCount || (u.planTier === 'scale' ? 82 : u.planTier === 'pro' ? 14 : 3),
      executions: execCount,
      status: u.status,
      created: (u.createdAt || '').substring(0, 10)
    };
  });
}

async function toggleTenantStatus(userId) {
  const data = loadData();
  const user = data.users.find(u => u.id === userId);
  if (!user) throw new Error('Tenant not found');
  user.status = user.status === 'Active' ? 'Suspended' : 'Active';
  saveData(data);
  return user;
}

async function getAdminSettings() {
  const data = loadData();
  return data.settings;
}

async function updateAdminSettings(updates) {
  const data = loadData();
  data.settings = { ...data.settings, ...updates };
  saveData(data);
  return data.settings;
}

module.exports = {
  findUserByEmail,
  findUserById,
  findUserByApiKey,
  createUser,
  updateUserPlan,
  createWorkflow,
  getWorkflowsByUser,
  getWorkflowById,
  updateWorkflow,
  deleteWorkflow,
  checkAndDeductQuota,
  recordExecution,
  updateExecution,
  getExecutionById,
  getWorkflowExecutions,
  getUserApiKeys,
  createApiKey,
  revokeApiKey,
  getAllTenants,
  toggleTenantStatus,
  getAdminSettings,
  updateAdminSettings
};
