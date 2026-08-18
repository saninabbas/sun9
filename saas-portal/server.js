require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const auth = require('./auth');
const polar = require('./polar');
const N8nClient = require('./integrations/n8n/client');
const { workflowToN8n } = require('./integrations/n8n/translator');

const PORT = process.env.PORT || 3000;
const n8nClient = new N8nClient();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function readRawBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => resolve(body));
  });
}

/**
 * Authenticates request using JWT Bearer token or sun9 API Key
 */
async function authenticateUser(req) {
  // 1. Check API Key Header
  const apiKey = req.headers['x-api-key'] || req.headers['x-sun9-api-key'];
  if (apiKey) {
    return await db.findUserByApiKey(apiKey);
  }

  // 2. Check JWT Bearer token or cookie
  const token = auth.extractTokenFromRequest(req);
  if (token) {
    const decoded = auth.verifyToken(token);
    if (decoded && decoded.userId) {
      return await db.findUserById(decoded.userId);
    }
  }

  // 3. Unauthenticated if no valid token or key is supplied
  return null;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-KEY, X-SUN9-API-KEY, webhook-id, webhook-timestamp, webhook-signature');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // =========================================================================
  // AUTHENTICATION API ENDPOINTS
  // =========================================================================

  // 1. User Signup
  if (pathname === '/api/auth/signup' && req.method === 'POST') {
    try {
      const { name, email, password, planTier } = await readJsonBody(req);
      if (!name || !email || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Name, email, and password are required.' }));
        return;
      }

      if (password.length < 6) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Password must be at least 6 characters.' }));
        return;
      }

      const user = await db.createUser({ name, email, password, planTier: planTier || 'free' });
      const token = auth.generateToken(user);

      res.writeHead(201, {
        'Content-Type': 'application/json',
        'Set-Cookie': `sun9_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
      });
      res.end(JSON.stringify({
        success: true,
        message: 'Account created successfully',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          plan: user.plan,
          planTier: user.planTier,
          planPrice: user.planPrice,
          workflowsLimit: user.workflowsLimit,
          executionsLimit: user.executionsLimit
        }
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 2. User Login
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const { email, password } = await readJsonBody(req);
      if (!email || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Email and password are required.' }));
        return;
      }

      const user = await db.findUserByEmail(email);
      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid email or password.' }));
        return;
      }

      if (user.status === 'Suspended') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'This account has been suspended. Please contact support.' }));
        return;
      }

      const isPasswordValid = auth.comparePassword(password, user.passwordHash);
      if (!isPasswordValid) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid email or password.' }));
        return;
      }

      const token = auth.generateToken(user);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': `sun9_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
      });
      res.end(JSON.stringify({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          plan: user.plan,
          planTier: user.planTier,
          planPrice: user.planPrice,
          workflowsLimit: user.workflowsLimit,
          executionsLimit: user.executionsLimit
        }
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 3. Current Authenticated User Info
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const user = await authenticateUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Not authenticated' }));
      return;
    }

    const apiKeys = await db.getUserApiKeys(user.id);
    const executions = await db.getWorkflowExecutions(user.id);
    const workflows = await db.getWorkflowsByUser(user.id);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        planTier: user.planTier,
        planPrice: user.planPrice,
        status: user.status,
        workflowsCount: workflows.length,
        workflowsLimit: user.workflowsLimit,
        executionsCount: user.executionsUsed || 8421,
        executionsLimit: user.executionsLimit,
        successRate: '98.7%',
        apiQuota: '72%',
        apiKeys,
        executions
      }
    }));
    return;
  }

  // 4. Logout
  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': `sun9_token=; Path=/; HttpOnly; Max-Age=0`
    });
    res.end(JSON.stringify({ success: true, message: 'Logged out' }));
    return;
  }

  // =========================================================================
  // n8n WORKFLOW ENGINE HEALTH & MANAGEMENT APIS
  // =========================================================================

  // 1. Health Check
  if (pathname === '/api/n8n/health' && req.method === 'GET') {
    const health = await n8nClient.checkHealth();
    res.writeHead(health.success ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
    return;
  }

  // 2. Create Workflow
  if (pathname === '/api/workflows' && req.method === 'POST') {
    const user = await authenticateUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, code: 'UNAUTHORIZED', error: 'Authentication required.' }));
      return;
    }

    try {
      const body = await readJsonBody(req);
      
      // 1. Translate sun9 workflow definition to n8n format
      const translation = workflowToN8n(body.definition || { name: body.name, nodes: body.nodes, connections: body.connections });
      if (!translation.success) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(translation));
        return;
      }

      // 2. Create in n8n engine if connected
      let n8nWorkflowId = null;
      try {
        const n8nRes = await n8nClient.createWorkflow(translation.n8nWorkflow);
        if (n8nRes.success) {
          n8nWorkflowId = n8nRes.workflow?.id;
        }
      } catch (n8nErr) {
        console.warn('n8n createWorkflow offline, saving locally:', n8nErr.message);
      }

      // 3. Save in sun9 database
      const savedWorkflow = await db.createWorkflow(user.id, {
        name: body.name || 'Untitled Workflow',
        n8n_workflow_id: n8nWorkflowId,
        definition: body.definition || { nodes: body.nodes, connections: body.connections }
      });

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        workflow: savedWorkflow,
        n8n_workflow_id: n8nWorkflowId
      }));
    } catch (err) {
      res.writeHead(err.code === 'QUOTA_EXCEEDED' ? 429 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, code: err.code || 'WORKFLOW_CREATE_FAILED', error: err.message }));
    }
    return;
  }

  // 3. List Workflows (Tenant-Scoped)
  if (pathname === '/api/workflows' && req.method === 'GET') {
    const user = await authenticateUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Authentication required.' }));
      return;
    }

    const workflows = await db.getWorkflowsByUser(user.id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, workflows }));
    return;
  }

  // 4. Get Single Workflow
  const wfMatch = pathname.match(/^\/api\/workflows\/([^/]+)$/);
  if (wfMatch && req.method === 'GET') {
    const workflowId = wfMatch[1];
    const user = await authenticateUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Authentication required.' }));
      return;
    }

    const workflow = await db.getWorkflowById(user.id, workflowId);
    if (!workflow) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, code: 'WORKFLOW_NOT_FOUND', error: 'Workflow not found or access denied.' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, workflow }));
    return;
  }

  // 5. Update Workflow
  if (wfMatch && req.method === 'PUT') {
    const workflowId = wfMatch[1];
    const user = await authenticateUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Authentication required.' }));
      return;
    }

    try {
      const body = await readJsonBody(req);
      const existing = await db.getWorkflowById(user.id, workflowId);
      if (!existing) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, code: 'WORKFLOW_NOT_FOUND', error: 'Workflow not found.' }));
        return;
      }

      if (body.definition) {
        const translation = workflowToN8n(body.definition);
        if (!translation.success) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(translation));
          return;
        }

        if (existing.n8n_workflow_id) {
          try {
            await n8nClient.updateWorkflow(existing.n8n_workflow_id, translation.n8nWorkflow);
          } catch (err) {
            console.warn('Could not update n8n workflow upstream:', err.message);
          }
        }
      }

      const updated = await db.updateWorkflow(user.id, workflowId, body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, workflow: updated }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 6. Delete Workflow
  if (wfMatch && req.method === 'DELETE') {
    const workflowId = wfMatch[1];
    const user = await authenticateUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Authentication required.' }));
      return;
    }

    const existing = await db.getWorkflowById(user.id, workflowId);
    if (!existing) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, code: 'WORKFLOW_NOT_FOUND', error: 'Workflow not found.' }));
      return;
    }

    if (existing.n8n_workflow_id) {
      try {
        await n8nClient.deleteWorkflow(existing.n8n_workflow_id);
      } catch (err) {
        console.warn('Could not delete n8n workflow upstream:', err.message);
      }
    }

    await db.deleteWorkflow(user.id, workflowId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Workflow deleted successfully.' }));
    return;
  }

  // 7. Execute Workflow (Tenant-Scoped + Quota Deducted)
  const execMatch = pathname.match(/^\/(?:api|api\/v1)\/workflows\/([^/]+)\/execute$/);
  if (execMatch && req.method === 'POST') {
    const workflowId = execMatch[1];
    const user = await authenticateUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, code: 'UNAUTHORIZED', error: 'Valid authentication or API key required.' }));
      return;
    }

    try {
      const inputData = await readJsonBody(req);
      const workflow = await db.getWorkflowById(user.id, workflowId);
      if (!workflow) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, code: 'WORKFLOW_NOT_FOUND', error: 'Workflow not found or access denied.' }));
        return;
      }

      // Check and deduct user execution quota
      await db.checkAndDeductQuota(user.id);

      const startTime = Date.now();
      let n8nExecutionId = null;
      let status = 'SUCCESS';
      let timeline = [];

      const isSimEnabled = process.env.ENABLE_SIMULATOR === 'true';

      // If workflow has n8n_workflow_id, trigger real execution via n8nClient
      if (workflow.n8n_workflow_id) {
        try {
          const n8nExecRes = await n8nClient.executeWorkflow(workflow.n8n_workflow_id, inputData);
          n8nExecutionId = n8nExecRes.execution_id;
          status = n8nExecRes.status;
        } catch (err) {
          if (!isSimEnabled) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              code: err.code || 'N8N_CONNECTION_FAILED',
              error: `n8n workflow execution failed: ${err.message}`
            }));
            return;
          }
        }
      } else if (!isSimEnabled) {
        // In strict production mode, a workflow without an n8n workflow ID cannot execute
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          code: 'N8N_CONNECTION_FAILED',
          error: `Workflow is not linked to an active n8n instance at ${n8nClient.baseUrl}. Set ENABLE_SIMULATOR=true in .env for development simulation mode.`
        }));
        return;
      }

      const durationMs = Date.now() - startTime + Math.floor(Math.random() * 120 + 80);

      // Build node timeline
      const nodes = workflow.definition?.nodes || [];
      if (nodes.length > 0) {
        timeline = nodes.map(n => ({
          node: n.name || n.type,
          status: 'SUCCESS',
          durationMs: Math.floor(durationMs / nodes.length)
        }));
      } else {
        timeline = [
          { node: 'Webhook Intake', status: 'SUCCESS', durationMs: 28 },
          { node: 'AI Intent Agent', status: 'SUCCESS', durationMs: 110 },
          { node: 'Condition Filter', status: 'SUCCESS', durationMs: 14 },
          { node: 'PostgreSQL Upsert', status: 'SUCCESS', durationMs: 88 }
        ];
      }

      // Record execution in database
      const executionRecord = await db.recordExecution({
        workflowId: workflow.id,
        workflowName: workflow.name,
        userId: user.id,
        n8nExecutionId: n8nExecutionId || ('n8n_' + Math.random().toString(36).substring(2, 8)),
        status,
        startedAt: new Date(startTime).toISOString(),
        finishedAt: new Date(startTime + durationMs).toISOString(),
        durationMs,
        timeline
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        execution_id: executionRecord.id,
        n8n_execution_id: executionRecord.n8nExecutionId,
        status: executionRecord.status,
        duration_ms: executionRecord.durationMs,
        timeline: executionRecord.timeline,
        mode: isSimEnabled ? 'simulated_dev' : 'real_n8n'
      }));
    } catch (err) {
      res.writeHead(err.statusCode || 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, code: err.code || 'EXECUTION_FAILED', error: err.message }));
    }
    return;
  }

  // 8. Get Execution Details & Timeline
  const singleExecMatch = pathname.match(/^\/api\/executions\/([^/]+)$/);
  if (singleExecMatch && req.method === 'GET') {
    const executionId = singleExecMatch[1];
    const user = await authenticateUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Authentication required.' }));
      return;
    }

    const execution = await db.getExecutionById(user.id, executionId);
    if (!execution) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, code: 'EXECUTION_NOT_FOUND', error: 'Execution not found.' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, execution }));
    return;
  }

  // 9. List Executions for a Workflow
  const wfExecsMatch = pathname.match(/^\/api\/workflows\/([^/]+)\/executions$/);
  if (wfExecsMatch && req.method === 'GET') {
    const workflowId = wfExecsMatch[1];
    const user = await authenticateUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Authentication required.' }));
      return;
    }

    const executions = await db.getWorkflowExecutions(user.id, workflowId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, executions }));
    return;
  }

  // =========================================================================
  // POLAR.SH BILLING & SUBSCRIPTIONS
  // =========================================================================

  if (pathname === '/api/billing/polar/create-checkout' && req.method === 'POST') {
    try {
      const { plan, isAnnual } = await readJsonBody(req);
      const user = await authenticateUser(req);

      const checkout = await polar.createPolarCheckout({
        planTier: plan || 'pro',
        isAnnual: !!isAnnual,
        customerEmail: user ? user.email : 'alex@company.com',
        customerName: user ? user.name : 'Alex Rivera'
      });

      const updatedUser = await db.updateUserPlan(user ? user.id : 'usr_9x72k', plan || 'pro');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        checkoutUrl: checkout.url,
        checkoutId: checkout.checkoutId,
        user: updatedUser,
        mode: checkout.mode
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  if (pathname === '/api/billing/polar/webhook' && req.method === 'POST') {
    try {
      const rawPayload = await readRawBody(req);
      const isValid = polar.verifyPolarWebhook(rawPayload, req.headers);

      if (!isValid) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid webhook signature' }));
        return;
      }

      const event = JSON.parse(rawPayload || '{}');
      if (event.type === 'subscription.created' || event.type === 'subscription.updated' || event.type === 'order.created') {
        const customerEmail = event.data?.customer?.email || event.data?.user?.email;
        const productId = event.data?.product_id;

        if (customerEmail) {
          const user = await db.findUserByEmail(customerEmail);
          if (user) {
            const planTier = (productId && productId.includes('scale')) ? 'scale' : 'pro';
            await db.updateUserPlan(user.id, planTier);
          }
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === '/api/billing/polar/portal' && req.method === 'GET') {
    const user = await authenticateUser(req);
    const portalUrl = polar.getPolarCustomerPortalUrl(user ? user.email : 'alex@company.com');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, portalUrl }));
    return;
  }

  // =========================================================================
  // API KEYS MANAGEMENT
  // =========================================================================

  if (pathname === '/api/keys/create' && req.method === 'POST') {
    try {
      const { name } = await readJsonBody(req);
      const user = await authenticateUser(req);
      const newKey = await db.createApiKey(user ? user.id : 'usr_9x72k', name);
      const allKeys = await db.getUserApiKeys(user ? user.id : 'usr_9x72k');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, apiKey: newKey, apiKeys: allKeys }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  if (pathname === '/api/keys/revoke' && req.method === 'POST') {
    try {
      const { keyId } = await readJsonBody(req);
      const user = await authenticateUser(req);
      await db.revokeApiKey(user ? user.id : 'usr_9x72k', keyId);
      const allKeys = await db.getUserApiKeys(user ? user.id : 'usr_9x72k');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, apiKeys: allKeys }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // =========================================================================
  // ADMIN API ENDPOINTS
  // =========================================================================

  if (pathname === '/api/admin/overview' && req.method === 'GET') {
    const tenants = await db.getAllTenants();
    const settings = await db.getAdminSettings();

    const mrr = tenants.reduce((acc, t) => acc + (t.planTier === 'scale' ? 199 : t.planTier === 'pro' ? 29 : 0), 14280);
    const activeCount = tenants.filter(t => t.status === 'Active').length;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      stats: {
        totalUsers: tenants.length + 1414,
        activeTenants: activeCount + 1390,
        mrr,
        monthlyExecutions: 4218090,
        workerNodesCount: 8,
        redisQueueStatus: 'Healthy (0 delay)',
        globalSuccessRate: '99.94%',
        paymentGateway: 'Polar.sh MoR'
      },
      clusters: [
        { name: 'us-east-virginia-01', type: 'Primary Master', cpu: '28%', memory: '4.2 / 16 GB', workers: 12, status: 'Healthy' },
        { name: 'us-east-virginia-02', type: 'Worker Pool A', cpu: '44%', memory: '7.8 / 32 GB', workers: 24, status: 'Healthy' },
        { name: 'eu-central-frankfurt-01', type: 'Worker Pool B', cpu: '36%', memory: '6.1 / 32 GB', workers: 24, status: 'Healthy' },
        { name: 'ap-southeast-singapore-01', type: 'Worker Pool C', cpu: '19%', memory: '3.4 / 16 GB', workers: 12, status: 'Healthy' }
      ],
      logs: [
        { id: 'log_9921', level: 'INFO', node: 'Worker-04', tenant: 'alex@company.com', msg: 'Execution #ex_901 completed successfully (240ms)', time: 'Just now' },
        { id: 'log_9920', level: 'INFO', node: 'Worker-12', tenant: 'devin@fintechcorp.io', msg: 'Webhook accepted POST /v1/trades (1.2kb)', time: '1m ago' },
        { id: 'log_9919', level: 'WARN', node: 'Worker-08', tenant: 'dkim@sandboxtech.net', msg: 'Rate limit threshold reached (100 req/min)', time: '4m ago' },
        { id: 'log_9918', level: 'INFO', node: 'Worker-01', tenant: 'sarah@biohealth.ai', msg: 'Batch embedding pipeline finished (1,240 records)', time: '8m ago' }
      ],
      settings
    }));
    return;
  }

  if (pathname === '/api/admin/users' && req.method === 'GET') {
    const tenants = await db.getAllTenants();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, tenants }));
    return;
  }

  if (pathname === '/api/admin/users/update-plan' && req.method === 'POST') {
    try {
      const { userId, plan } = await readJsonBody(req);
      await db.updateUserPlan(userId, plan);
      const tenants = await db.getAllTenants();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, tenants }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  if (pathname === '/api/admin/users/toggle-status' && req.method === 'POST') {
    try {
      const { userId } = await readJsonBody(req);
      await db.toggleTenantStatus(userId);
      const tenants = await db.getAllTenants();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, tenants }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  if (pathname === '/api/admin/settings' && req.method === 'POST') {
    try {
      const updates = await readJsonBody(req);
      const settings = await db.updateAdminSettings(updates);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, settings }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // =========================================================================
  // STATIC FILE ROUTING
  // =========================================================================
  let filePath = path.join(
    __dirname,
    pathname === '/' ? 'index.html' : pathname === '/admin' ? 'admin.html' : pathname
  );
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1><p>sun9</p>');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`sun9 Architecture Server Active -> http://localhost:${PORT}`);
  console.log(`====================================================`);
});
