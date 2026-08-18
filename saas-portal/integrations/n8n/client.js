const http = require('http');
const https = require('https');
const { URL } = require('url');

class N8nClient {
  constructor(config = {}) {
    this.baseUrl = (process.env.N8N_BASE_URL || config.baseUrl || 'http://localhost:5678').replace(/\/$/, '');
    this.apiKey = process.env.N8N_API_KEY || config.apiKey || '';
    this.timeout = config.timeout || 30000;
  }

  /**
   * Internal request helper
   */
  async _request(endpoint, options = {}) {
    const targetUrl = new URL(`${this.baseUrl}${endpoint}`);
    const isHttps = targetUrl.protocol === 'https:';
    const httpLib = isHttps ? https : http;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    if (this.apiKey) {
      headers['X-N8N-API-KEY'] = this.apiKey;
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const req = httpLib.request(targetUrl, {
        method: options.method || 'GET',
        headers,
        timeout: this.timeout
      }, res => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => {
          const latency = Date.now() - startTime;
          let parsed = null;
          try {
            parsed = body ? JSON.parse(body) : null;
          } catch {
            parsed = { raw: body };
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ data: parsed, statusCode: res.statusCode, latency });
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            const err = new Error('n8n API authentication failed. Verify N8N_API_KEY.');
            err.code = 'N8N_AUTH_FAILED';
            err.statusCode = res.statusCode;
            reject(err);
          } else if (res.statusCode === 404) {
            const err = new Error('n8n resource not found.');
            err.code = 'N8N_RESOURCE_NOT_FOUND';
            err.statusCode = 404;
            reject(err);
          } else {
            const err = new Error(parsed?.message || `n8n request failed with status ${res.statusCode}`);
            err.code = 'N8N_API_ERROR';
            err.statusCode = res.statusCode;
            err.details = parsed;
            reject(err);
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const err = new Error('n8n request timed out.');
        err.code = 'N8N_TIMEOUT';
        reject(err);
      });

      req.on('error', err => {
        const error = new Error(`Could not connect to n8n at ${this.baseUrl}: ${err.message}`);
        error.code = 'N8N_CONNECTION_FAILED';
        reject(error);
      });

      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }
      req.end();
    });
  }

  /**
   * Health check for n8n instance
   */
  async checkHealth() {
    const startTime = Date.now();
    try {
      // Test root or public workflows endpoint
      const res = await this._request('/api/v1/workflows?limit=1');
      return {
        success: true,
        status: 'CONNECTED',
        latency_ms: res.latency || (Date.now() - startTime),
        version: 'v1.0'
      };
    } catch (err) {
      return {
        success: false,
        status: 'DISCONNECTED',
        code: err.code || 'N8N_CONNECTION_FAILED',
        error: err.message
      };
    }
  }

  /**
   * Create a new workflow in n8n
   */
  async createWorkflow(workflowData) {
    try {
      const res = await this._request('/api/v1/workflows', {
        method: 'POST',
        body: workflowData
      });
      return {
        success: true,
        workflow: res.data
      };
    } catch (err) {
      const error = new Error(`Failed to create n8n workflow: ${err.message}`);
      error.code = err.code || 'N8N_WORKFLOW_CREATE_FAILED';
      throw error;
    }
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(workflowId) {
    try {
      const res = await this._request(`/api/v1/workflows/${workflowId}`);
      return {
        success: true,
        workflow: res.data
      };
    } catch (err) {
      const error = new Error(`Failed to get n8n workflow ${workflowId}: ${err.message}`);
      error.code = err.code || 'N8N_WORKFLOW_NOT_FOUND';
      throw error;
    }
  }

  /**
   * Update workflow in n8n
   */
  async updateWorkflow(workflowId, workflowData) {
    try {
      const res = await this._request(`/api/v1/workflows/${workflowId}`, {
        method: 'PUT',
        body: workflowData
      });
      return {
        success: true,
        workflow: res.data
      };
    } catch (err) {
      const error = new Error(`Failed to update n8n workflow ${workflowId}: ${err.message}`);
      error.code = err.code || 'N8N_WORKFLOW_UPDATE_FAILED';
      throw error;
    }
  }

  /**
   * Delete workflow from n8n
   */
  async deleteWorkflow(workflowId) {
    try {
      await this._request(`/api/v1/workflows/${workflowId}`, {
        method: 'DELETE'
      });
      return { success: true };
    } catch (err) {
      const error = new Error(`Failed to delete n8n workflow ${workflowId}: ${err.message}`);
      error.code = err.code || 'N8N_WORKFLOW_DELETE_FAILED';
      throw error;
    }
  }

  /**
   * Activate a workflow in n8n
   */
  async activateWorkflow(workflowId) {
    try {
      const res = await this._request(`/api/v1/workflows/${workflowId}/activate`, {
        method: 'POST'
      });
      return { success: true, workflow: res.data };
    } catch (err) {
      const error = new Error(`Failed to activate workflow: ${err.message}`);
      error.code = 'N8N_ACTIVATION_FAILED';
      throw error;
    }
  }

  /**
   * Deactivate a workflow in n8n
   */
  async deactivateWorkflow(workflowId) {
    try {
      const res = await this._request(`/api/v1/workflows/${workflowId}/deactivate`, {
        method: 'POST'
      });
      return { success: true, workflow: res.data };
    } catch (err) {
      const error = new Error(`Failed to deactivate workflow: ${err.message}`);
      error.code = 'N8N_DEACTIVATION_FAILED';
      throw error;
    }
  }

  /**
   * Execute a workflow manually in n8n (or via webhook)
   */
  async executeWorkflow(workflowId, inputData = {}) {
    try {
      // In n8n API v1, manual execution or webhook execution triggers the flow
      const res = await this._request(`/api/v1/workflows/${workflowId}/execute`, {
        method: 'POST',
        body: { data: inputData }
      });

      return {
        success: true,
        execution_id: res.data?.id || res.data?.executionId || ('n8n_exec_' + Math.random().toString(36).substring(2, 10)),
        status: res.data?.finished ? (res.data?.status === 'error' ? 'FAILED' : 'SUCCESS') : 'RUNNING',
        data: res.data
      };
    } catch (err) {
      // If direct manual execution endpoint is not enabled, attempt webhook or trigger simulation
      const error = new Error(`Failed to trigger n8n execution: ${err.message}`);
      error.code = err.code || 'N8N_EXECUTION_FAILED';
      throw error;
    }
  }

  /**
   * Retrieve execution details & logs from n8n
   */
  async getExecution(executionId) {
    try {
      const res = await this._request(`/api/v1/executions/${executionId}`);
      const execution = res.data;
      const status = execution.finished 
        ? (execution.status === 'error' || execution.stoppedAt && !execution.data?.resultData?.runData ? 'FAILED' : 'SUCCESS') 
        : 'RUNNING';

      return {
        success: true,
        execution_id: execution.id || executionId,
        status,
        started_at: execution.startedAt,
        stopped_at: execution.stoppedAt,
        data: execution.data || {}
      };
    } catch (err) {
      const error = new Error(`Execution ${executionId} not found: ${err.message}`);
      error.code = 'N8N_EXECUTION_NOT_FOUND';
      throw error;
    }
  }

  /**
   * List executions for a workflow
   */
  async listExecutions(workflowId) {
    try {
      const query = workflowId ? `?workflowId=${workflowId}&limit=20` : '?limit=20';
      const res = await this._request(`/api/v1/executions${query}`);
      return {
        success: true,
        executions: res.data?.data || res.data || []
      };
    } catch (err) {
      return { success: false, executions: [] };
    }
  }
}

module.exports = N8nClient;
