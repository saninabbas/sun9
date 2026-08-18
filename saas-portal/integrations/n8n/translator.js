/**
 * sun9 to n8n Workflow Translation Layer
 * Converts provider-agnostic sun9 workflow models into valid n8n workflow JSON schemas.
 */

const SUPPORTED_NODE_TYPES = [
  'trigger',
  'webhook',
  'http_request',
  'ai_agent',
  'condition',
  'code',
  'database',
  'slack',
  'email',
  'youtube',
  'telegram'
];

/**
 * Translates a single sun9 node to an n8n node definition
 */
function translateNode(sun9Node, index) {
  const type = (sun9Node.type || '').toLowerCase();
  const name = sun9Node.name || `Node ${index + 1}`;
  const params = sun9Node.parameters || {};
  const position = sun9Node.position || [250 + index * 200, 300];

  switch (type) {
    case 'trigger':
      return {
        id: sun9Node.id || `node_${index + 1}`,
        name: name,
        type: 'n8n-nodes-base.manualTrigger',
        typeVersion: 1,
        position: position,
        parameters: {}
      };

    case 'webhook':
      return {
        id: sun9Node.id || `node_${index + 1}`,
        name: name,
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        position: position,
        parameters: {
          httpMethod: params.httpMethod || 'POST',
          path: params.path || `sun9-webhook-${sun9Node.id || index + 1}`,
          responseMode: 'onReceived',
          responseData: 'allEntries'
        }
      };

    case 'http_request':
      return {
        id: sun9Node.id || `node_${index + 1}`,
        name: name,
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: position,
        parameters: {
          url: params.url || 'https://httpbin.org/post',
          method: params.method || 'POST',
          sendBody: true,
          bodyParameters: {
            parameters: params.bodyParameters || []
          }
        }
      };

    case 'ai_agent':
      return {
        id: sun9Node.id || `node_${index + 1}`,
        name: name,
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: position,
        parameters: {
          url: 'https://api.anthropic.com/v1/messages',
          method: 'POST',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: 'anthropic-version', value: '2023-06-01' },
              { name: 'content-type', value: 'application/json' }
            ]
          },
          sendBody: true,
          specifyBody: 'json',
          jsonBody: JSON.stringify({
            model: params.model || 'claude-3-5-sonnet-20241022',
            max_tokens: params.maxTokens || 1024,
            messages: [{ role: 'user', content: params.prompt || 'Process input payload' }]
          })
        }
      };

    case 'condition':
      return {
        id: sun9Node.id || `node_${index + 1}`,
        name: name,
        type: 'n8n-nodes-base.if',
        typeVersion: 2,
        position: position,
        parameters: {
          conditions: {
            string: [
              {
                value1: params.value1 || '={{ $json.score }}',
                operation: params.operation || 'isNotEmpty'
              }
            ]
          }
        }
      };

    case 'code':
      return {
        id: sun9Node.id || `node_${index + 1}`,
        name: name,
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: position,
        parameters: {
          language: params.language || 'javaScript',
          jsCode: params.code || 'return $input.all();'
        }
      };

    case 'database':
      return {
        id: sun9Node.id || `node_${index + 1}`,
        name: name,
        type: 'n8n-nodes-base.postgres',
        typeVersion: 2.4,
        position: position,
        parameters: {
          operation: params.operation || 'executeQuery',
          query: params.query || 'SELECT NOW();'
        }
      };

    case 'slack':
      return {
        id: sun9Node.id || `node_${index + 1}`,
        name: name,
        type: 'n8n-nodes-base.slack',
        typeVersion: 2.1,
        position: position,
        parameters: {
          resource: 'message',
          operation: 'post',
          channel: params.channel || '#general',
          text: params.message || 'Workflow notification from sun9'
        }
      };

    case 'email':
      return {
        id: sun9Node.id || `node_${index + 1}`,
        name: name,
        type: 'n8n-nodes-base.emailSend',
        typeVersion: 2.1,
        position: position,
        parameters: {
          toEmail: params.toEmail || 'user@example.com',
          subject: params.subject || 'sun9 Automated Notification',
          message: params.message || 'Automated message body.'
        }
      };

    case 'youtube':
      return {
        id: sun9Node.id || `node_${index + 1}`,
        name: name,
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: position,
        parameters: {
          url: `https://www.youtube.com/feeds/videos.xml?channel_id=${params.channelId || 'UC_x5XG1OV2P6uZZ5FSM9Ttw'}`,
          method: 'GET',
          options: { response: { response: { fullResponse: false } } }
        }
      };

    case 'telegram':
      return {
        id: sun9Node.id || `node_${index + 1}`,
        name: name,
        type: 'n8n-nodes-base.telegram',
        typeVersion: 1.2,
        position: position,
        parameters: {
          resource: 'message',
          operation: 'sendMessage',
          chatId: params.chatId || '@my_channel',
          text: params.text || 'New YouTube automation update from sun9'
        }
      };

    default:
      throw new Error(`Unsupported node type: ${type}`);
  }
}

/**
 * Converts a sun9 workflow schema into a complete n8n workflow payload
 */
function workflowToN8n(sun9Workflow) {
  if (!sun9Workflow) {
    return {
      success: false,
      code: 'WORKFLOW_INVALID',
      message: 'Workflow payload is empty or invalid.'
    };
  }

  const nodes = sun9Workflow.nodes || [];
  const rawConnections = sun9Workflow.connections || [];

  // 1. Validate that all nodes belong to supported types
  for (const node of nodes) {
    const nodeType = (node.type || '').toLowerCase();
    if (!SUPPORTED_NODE_TYPES.includes(nodeType)) {
      return {
        success: false,
        code: 'UNSUPPORTED_NODE',
        message: `Node "${node.name || node.id}" contains unsupported type "${nodeType}". Supported types: ${SUPPORTED_NODE_TYPES.join(', ')}`
      };
    }
  }

  try {
    // 2. Translate Nodes
    const n8nNodes = nodes.map((node, i) => translateNode(node, i));

    // 3. Build n8n Connections Map
    const connections = {};

    if (rawConnections.length > 0) {
      for (const conn of rawConnections) {
        const fromNode = n8nNodes.find(n => n.id === conn.source || n.name === conn.source);
        const toNode = n8nNodes.find(n => n.id === conn.target || n.name === conn.target);

        if (fromNode && toNode) {
          if (!connections[fromNode.name]) {
            connections[fromNode.name] = { main: [[]] };
          }
          connections[fromNode.name].main[0].push({
            node: toNode.name,
            type: 'main',
            index: conn.targetIndex || 0
          });
        }
      }
    } else if (n8nNodes.length > 1) {
      // Default linear connection chaining if no explicit connections passed
      for (let i = 0; i < n8nNodes.length - 1; i++) {
        const curr = n8nNodes[i];
        const next = n8nNodes[i + 1];
        connections[curr.name] = {
          main: [
            [
              {
                node: next.name,
                type: 'main',
                index: 0
              }
            ]
          ]
        };
      }
    }

    const n8nPayload = {
      name: sun9Workflow.name || 'sun9 Automated Workflow',
      nodes: n8nNodes,
      connections: connections,
      settings: {
        executionOrder: 'v1',
        saveManualExecutions: true,
        saveExecutionProgress: true,
        saveDataErrorExecution: 'all',
        saveDataSuccessExecution: 'all'
      }
    };

    return {
      success: true,
      n8nWorkflow: n8nPayload
    };
  } catch (err) {
    return {
      success: false,
      code: 'TRANSLATION_ERROR',
      message: err.message
    };
  }
}

module.exports = {
  workflowToN8n,
  SUPPORTED_NODE_TYPES
};
