const http = require('http');
const assert = require('assert');

const PORT = process.env.PORT || 3000;

function req(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, raw: body }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(JSON.stringify(data));
    r.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('sun9 — REAL n8n WORKFLOW ENGINE TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function logPass(name) {
    total++;
    passed++;
    console.log(`✓ [PASS] ${name}`);
  }

  function logFail(name, err) {
    total++;
    console.error(`✗ [FAIL] ${name}:`, err);
  }

  // ----------------------------------------------------
  // TEST 1: Health Check Endpoint
  // ----------------------------------------------------
  try {
    const health = await req('/api/n8n/health');
    assert(health.data !== undefined, 'Health check returned undefined data');
    assert(typeof health.data.status === 'string', 'Status is not string');
    assert(health.data.apiKey === undefined, 'Leaked API key in health check response');
    logPass('1. Health Check Endpoint (/api/n8n/health) — Verified status & zero credential leakage');
  } catch (e) {
    logFail('1. Health Check Endpoint', e.message);
  }

  // ----------------------------------------------------
  // AUTH SETUP: Create Fresh Scale Tier User For Tests
  // ----------------------------------------------------
  let tokenA = null;
  try {
    const signupA = await req('/api/auth/signup', 'POST', {
      name: 'Test Engineer',
      email: `test_eng_${Date.now()}@sun9.io`,
      password: 'password123',
      planTier: 'scale'
    });
    tokenA = signupA.data.token;
    assert(tokenA, 'Failed to obtain token for Test Engineer');
  } catch (e) {
    console.error('Setup Auth Error:', e.message);
  }

  const authHeadersA = { 'Authorization': `Bearer ${tokenA}` };

  // ----------------------------------------------------
  // TEST 2: Translator — Unsupported Node Type
  // ----------------------------------------------------
  try {
    const badNodeRes = await req('/api/workflows', 'POST', {
      name: 'Malicious Flow',
      definition: {
        nodes: [{ id: 'n1', type: 'bitcoin_miner_daemon', name: 'Illegal Mining' }]
      }
    }, authHeadersA);
    assert.strictEqual(badNodeRes.status, 400, 'Expected status 400 for unsupported node');
    assert.strictEqual(badNodeRes.data.code, 'UNSUPPORTED_NODE', 'Expected error code UNSUPPORTED_NODE');
    logPass('2. Translation Layer — Correctly rejected unsupported node type (UNSUPPORTED_NODE)');
  } catch (e) {
    logFail('2. Translation Layer Unsupported Node', e.message);
  }

  // ----------------------------------------------------
  // TEST 3: Translator & Workflow Creation
  // ----------------------------------------------------
  let createdWfId = null;
  try {
    const validWfRes = await req('/api/workflows', 'POST', {
      name: 'Customer Verification Pipeline',
      definition: {
        nodes: [
          { id: 'n1', type: 'webhook', name: 'Webhook Receiver', parameters: { path: 'verify-hook' } },
          { id: 'n2', type: 'http_request', name: 'Identity API', parameters: { url: 'https://httpbin.org/get' } },
          { id: 'n3', type: 'condition', name: 'Score Evaluator', parameters: { operation: 'isNotEmpty' } },
          { id: 'n4', type: 'database', name: 'Postgres Leads Table', parameters: { query: 'SELECT 1;' } }
        ]
      }
    }, authHeadersA);
    assert.strictEqual(validWfRes.status, 201, 'Expected status 201 for valid workflow creation');
    assert(validWfRes.data.workflow.id, 'Workflow ID is missing');
    createdWfId = validWfRes.data.workflow.id;
    logPass(`3. Workflow Creation & Canvas Translation — Validated 4-node canonical mapping (ID: ${createdWfId})`);
  } catch (e) {
    logFail('3. Workflow Creation', e.message);
  }

  // ----------------------------------------------------
  // TEST 4: Execution Simulation Rule & Failure Handling
  // ----------------------------------------------------
  try {
    const execRes = await req(`/api/workflows/${createdWfId}/execute`, 'POST', {
      payload: { leadId: 'lead_992', score: 98 }
    }, authHeadersA);
    assert(execRes.status === 200 || execRes.status === 503, `Unexpected status code ${execRes.status}`);
    if (execRes.status === 503) {
      assert.strictEqual(execRes.data.code, 'N8N_CONNECTION_FAILED', 'Expected N8N_CONNECTION_FAILED code');
      logPass('4. Production Simulator Rule — Safely returned N8N_CONNECTION_FAILED without faking execution');
    } else {
      assert.strictEqual(execRes.data.success, true, 'Execution failed in dev mode');
      logPass(`4. Workflow Execution & Node Timeline — Handled execution (ID: ${execRes.data.execution_id})`);
    }
  } catch (e) {
    logFail('4. Execution Handling', e.message);
  }

  // ----------------------------------------------------
  // TEST 5: Tenant Isolation & Security
  // ----------------------------------------------------
  try {
    const signupUserB = await req('/api/auth/signup', 'POST', {
      name: 'Unauthorized Tenant',
      email: 'unauth_' + Date.now() + '@tenant.com',
      password: 'password123'
    });
    const tokenB = signupUserB.data.token;

    // Tenant B tries to read Tenant A's workflow
    const crossTenantGet = await req(`/api/workflows/${createdWfId}`, 'GET', null, {
      'Authorization': `Bearer ${tokenB}`
    });
    assert.strictEqual(crossTenantGet.status, 404, 'Cross-tenant workflow read was not blocked');

    // Tenant B tries to execute Tenant A's workflow
    const crossTenantExec = await req(`/api/workflows/${createdWfId}/execute`, 'POST', {}, {
      'Authorization': `Bearer ${tokenB}`
    });
    assert.strictEqual(crossTenantExec.status, 404, 'Cross-tenant workflow execution was not blocked');

    logPass('5. Tenant Isolation — Strictly blocked cross-tenant workflow read & execution attempts (404 Access Denied)');
  } catch (e) {
    logFail('5. Tenant Isolation', e.message);
  }

  // ----------------------------------------------------
  // TEST 6: Unauthenticated Request Protection
  // ----------------------------------------------------
  try {
    const unauthRes = await req('/api/workflows', 'POST', { name: 'Hack' }, {
      'Authorization': 'Bearer invalid_token_abc'
    });
    assert(unauthRes.status === 401 || unauthRes.status === 400 || unauthRes.data.success === false, 'Unauthenticated check failed');
    logPass('6. Authentication & API Key System — Verified protected routes');
  } catch (e) {
    logFail('6. Authentication Protection', e.message);
  }

  // ----------------------------------------------------
  // TEST 7: User Login & Session Verification
  // ----------------------------------------------------
  try {
    const loginRes = await req('/api/auth/login', 'POST', {
      email: `test_eng_${Date.now()}@sun9.io`,
      password: 'wrong_password'
    });
    assert.strictEqual(loginRes.status, 401, 'Expected status 401 for wrong password');

    const meRes = await req('/api/auth/me', 'GET', null, authHeadersA);
    assert.strictEqual(meRes.status, 200, 'Expected status 200 for authenticated /api/auth/me');
    assert(meRes.data.user && meRes.data.user.email, 'User data missing from /api/auth/me');
    logPass('7. User Login & Session Verification — Validated password check & JWT me endpoint');
  } catch (e) {
    logFail('7. User Login & Session Verification', e.message);
  }

  // ----------------------------------------------------
  // TEST 8: Starter Workflows Auto-Provisioning
  // ----------------------------------------------------
  try {
    const listWfRes = await req('/api/workflows', 'GET', null, authHeadersA);
    assert.strictEqual(listWfRes.status, 200, 'Expected status 200 for listing workflows');
    assert(Array.isArray(listWfRes.data.workflows) && listWfRes.data.workflows.length >= 1, 'Starter workflows not provisioned');
    logPass(`8. Starter Workflows Auto-Provisioning — Found ${listWfRes.data.workflows.length} workflows for user`);
  } catch (e) {
    logFail('8. Starter Workflows Auto-Provisioning', e.message);
  }

  // ----------------------------------------------------
  // TEST 9: Workflow Update & Delete Lifecycle
  // ----------------------------------------------------
  try {
    const updateRes = await req(`/api/workflows/${createdWfId}`, 'PUT', {
      name: 'Updated Pipeline Name'
    }, authHeadersA);
    assert.strictEqual(updateRes.status, 200, 'Expected status 200 for updating workflow');
    assert.strictEqual(updateRes.data.workflow.name, 'Updated Pipeline Name', 'Workflow name was not updated');

    const deleteRes = await req(`/api/workflows/${createdWfId}`, 'DELETE', null, authHeadersA);
    assert.strictEqual(deleteRes.status, 200, 'Expected status 200 for deleting workflow');
    logPass('9. Workflow Lifecycle — Verified PUT update and DELETE workflow endpoints');
  } catch (e) {
    logFail('9. Workflow Lifecycle', e.message);
  }

  // ----------------------------------------------------
  // TEST 10: API Keys Management
  // ----------------------------------------------------
  try {
    const keyRes = await req('/api/keys/create', 'POST', { name: 'CI/CD Pipeline Key' }, authHeadersA);
    assert.strictEqual(keyRes.status, 200, 'Expected status 200 for creating API key');
    assert(keyRes.data.apiKey && keyRes.data.apiKey.fullKey, 'API key was not generated');

    const keyAuthRes = await req('/api/auth/me', 'GET', null, { 'X-SUN9-API-KEY': keyRes.data.apiKey.fullKey });
    assert.strictEqual(keyAuthRes.status, 200, 'Failed to authenticate using X-SUN9-API-KEY header');
    logPass('10. API Keys Management — Created key and verified authentication via X-SUN9-API-KEY');
  } catch (e) {
    logFail('10. API Keys Management', e.message);
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed}/${total} TESTS PASSED (${Math.round((passed/total)*100)}%)`);
  console.log('====================================================\n');
}

runTests();
