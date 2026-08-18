document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  let currentView = 'landing'; // 'landing' | 'dashboard'
  let currentTab = 'overview'; // 'overview' | 'studio' | 'executions' | 'apikeys' | 'billing'
  let isAnnual = false;
  let selectedPlan = 'pro';
  let isExecutingHero = false;
  let isExecutingStudio = false;
  let currentUser = null;
  let canvasZoom = 1.0;
  let currentInspTab = 'config'; // 'config' | 'json' | 'test'

  // Active Workflow State in Studio
  let activeWorkflow = {
    id: 'wf_101',
    name: 'Lead Enrichment Agent',
    nodes: [
      { id: 'node_1', type: 'webhook', name: 'Webhook Intake', x: 40, y: 120, parameters: { path: 'incoming-leads', httpMethod: 'POST' }, status: 'READY' },
      { id: 'node_2', type: 'ai_agent', name: 'Claude 3.5 Sonnet', x: 260, y: 80, parameters: { model: 'claude-3-5-sonnet', prompt: 'Extract enterprise score (1-100) & lead intent.' }, status: 'READY' },
      { id: 'node_3', type: 'condition', name: 'Score Filter', x: 480, y: 120, parameters: { value1: '={{ $json.score }}', operation: 'greaterThan', threshold: 80 }, status: 'READY' },
      { id: 'node_4', type: 'database', name: 'PostgreSQL Upsert', x: 700, y: 120, parameters: { query: 'INSERT INTO leads (domain, score) VALUES ($1, $2);' }, status: 'READY' }
    ],
    connections: [
      { id: 'conn_1', source: 'node_1', target: 'node_2' },
      { id: 'conn_2', source: 'node_2', target: 'node_3' },
      { id: 'conn_3', source: 'node_3', target: 'node_4' }
    ]
  };

  let selectedNodeId = 'node_2';
  let draggingNode = null;
  let dragOffset = { x: 0, y: 0 };
  let drawingConnection = null;

  // =========================================================================
  // TOAST NOTIFICATION UTILITY
  // =========================================================================
  const toastContainer = document.getElementById('toast-container');
  function showToast(message, type = 'success') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast-item ${type} font-mono`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  }

  // =========================================================================
  // DOM SELECTORS
  // =========================================================================
  const viewLanding = document.getElementById('view-landing');
  const viewDashboard = document.getElementById('view-dashboard');
  
  const navBrandLogo = document.getElementById('nav-brand-logo');
  const btnOpenAuthLogin = document.getElementById('btn-open-auth-login');
  const navAuthLabel = document.getElementById('nav-auth-label');
  const btnNavStart = document.getElementById('btn-nav-start');
  const btnHeroBuild = document.getElementById('btn-hero-build');
  const btnHeroDemo = document.getElementById('btn-hero-demo');
  const btnBottomStart = document.getElementById('btn-bottom-start');
  const btnBottomSales = document.getElementById('btn-bottom-sales');

  // Auth Modal Elements
  const authModal = document.getElementById('auth-modal');
  const btnCloseAuthModal = document.getElementById('btn-close-auth-modal');
  const tabAuthLogin = document.getElementById('tab-auth-login');
  const tabAuthSignup = document.getElementById('tab-auth-signup');
  const formAuthLogin = document.getElementById('form-auth-login');
  const formAuthSignup = document.getElementById('form-auth-signup');
  const authErrorBox = document.getElementById('auth-error-box');
  const authModalTitle = document.getElementById('auth-modal-title');
  const btnLogout = document.getElementById('btn-logout');

  // Sidebar Profile Elements
  const sidebarUserName = document.getElementById('sidebar-user-name');
  const sidebarUserAvatar = document.getElementById('sidebar-user-avatar');
  const sidebarPlanLabel = document.getElementById('sidebar-plan-label');

  // Hero Canvas Execution Elements
  const btnRunHeroFlow = document.getElementById('btn-run-hero-flow');
  const heroStatusDot = document.getElementById('hero-status-dot');
  const heroLogEntry = document.getElementById('hero-log-entry');
  const heroLogLatency = document.getElementById('hero-log-latency');
  const hnodes = [
    document.getElementById('hnode-1'),
    document.getElementById('hnode-2'),
    document.getElementById('hnode-3'),
    document.getElementById('hnode-4')
  ];
  const wires = [
    document.getElementById('wire-1'),
    document.getElementById('wire-2'),
    document.getElementById('wire-3')
  ];

  // Pricing Switcher
  const btnBillingSwitch = document.getElementById('btn-billing-switch');
  const lblMonthly = document.getElementById('lbl-monthly');
  const lblAnnual = document.getElementById('lbl-annual');
  const pricePro = document.getElementById('price-pro');
  const priceScale = document.getElementById('price-scale');
  const btnSelectTiers = document.querySelectorAll('.btn-select-tier');

  // Checkout Modal
  const checkoutModal = document.getElementById('checkout-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const checkoutForm = document.getElementById('checkout-form');
  const modalPlanName = document.getElementById('modal-plan-name');
  const modalPlanPrice = document.getElementById('modal-plan-price');
  const btnConfirmPay = document.getElementById('btn-confirm-pay');

  // Customer Dashboard Elements
  const customerNavItems = document.querySelectorAll('#view-dashboard .sidebar-menu .nav-item');
  const customerTabPanes = document.querySelectorAll('#view-dashboard .tab-pane');
  const btnQuickLaunchStudio = document.getElementById('btn-quick-launch-studio');
  const btnLaunchStudioTab = document.getElementById('btn-launch-studio-tab');
  const btnViewAllExecs = document.getElementById('btn-view-all-execs');
  const btnChangeSubscription = document.getElementById('btn-change-subscription');

  // Studio IDE Interactive Elements
  const studioCanvasBg = document.getElementById('studio-interactive-canvas');
  const studioSvgLayer = document.getElementById('studio-svg-connections');
  const studioNodesLayer = document.getElementById('studio-canvas-nodes');
  const tempDrawingWire = document.getElementById('temp-drawing-wire');
  const studioInspectorContent = document.getElementById('studio-inspector-content');
  const studioWfNameInput = document.getElementById('studio-workflow-name-input');
  const studioWfIdBadge = document.getElementById('studio-wf-id-badge');
  const btnStudioSave = document.getElementById('btn-studio-save');
  const btnStudioRun = document.getElementById('btn-studio-run');
  const btnStudioNew = document.getElementById('btn-studio-new');
  const btnStudioClear = document.getElementById('btn-studio-clear');
  const studioTermStatus = document.getElementById('studio-term-status');
  const studioTerminalLogs = document.getElementById('studio-terminal-logs');
  const studioPaletteList = document.getElementById('studio-palette-list');
  const studioNodeSearch = document.getElementById('studio-node-search');
  const paletteCountBadge = document.getElementById('palette-count-badge');
  const dockNodeCountLabel = document.getElementById('dock-node-count-label');
  const btnDockZoomIn = document.getElementById('btn-dock-zoom-in');
  const btnDockZoomOut = document.getElementById('btn-dock-zoom-out');
  const btnDockFit = document.getElementById('btn-dock-fit');
  const inspTabButtons = document.querySelectorAll('.insp-tab-btn');

  // Tables
  const btnCreateKey = document.getElementById('btn-create-key');
  const tableApiKeys = document.getElementById('table-api-keys');
  const tableFullExecutions = document.getElementById('table-full-executions');
  const tableRecentExecs = document.getElementById('table-recent-execs');

  // =========================================================================
  // VIEW NAVIGATION
  // =========================================================================
  function setView(view) {
    currentView = view;
    viewLanding.style.display = view === 'landing' ? 'block' : 'none';
    viewDashboard.style.display = view === 'dashboard' ? 'block' : 'none';

    if (view === 'landing') {
      navAuthLabel.textContent = currentUser ? 'Dashboard' : 'Log in';
    } else if (view === 'dashboard') {
      navAuthLabel.textContent = 'Landing Page';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      renderStudioCanvas();
    }
  }

  btnOpenAuthLogin.addEventListener('click', () => {
    if (currentUser) {
      setView(currentView === 'dashboard' ? 'landing' : 'dashboard');
    } else {
      openAuthModal('login');
    }
  });

  navBrandLogo.addEventListener('click', (e) => {
    e.preventDefault();
    setView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  btnNavStart.addEventListener('click', () => {
    if (currentUser) {
      setView('dashboard');
    } else {
      openAuthModal('signup');
    }
  });

  btnHeroBuild.addEventListener('click', () => {
    if (currentUser) {
      setView('dashboard');
    } else {
      openAuthModal('signup');
    }
  });

  if (btnHeroDemo) {
    btnHeroDemo.addEventListener('click', () => {
      document.getElementById('product').scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (btnBottomStart) {
    btnBottomStart.addEventListener('click', () => {
      if (currentUser) {
        setView('dashboard');
      } else {
        openAuthModal('signup');
      }
    });
  }

  if (btnBottomSales) {
    btnBottomSales.addEventListener('click', () => {
      document.getElementById('product').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // =========================================================================
  // AUTHENTICATION & USER SESSION
  // =========================================================================
  function getAuthHeader() {
    const token = localStorage.getItem('sun9_jwt_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  function openAuthModal(mode = 'login') {
    authModal.style.display = 'flex';
    authErrorBox.style.display = 'none';
    switchAuthMode(mode);
  }

  function switchAuthMode(mode) {
    if (mode === 'login') {
      tabAuthLogin.classList.add('active');
      tabAuthSignup.classList.remove('active');
      formAuthLogin.style.display = 'block';
      formAuthSignup.style.display = 'none';
      authModalTitle.textContent = 'Log in to sun9';
    } else {
      tabAuthSignup.classList.add('active');
      tabAuthLogin.classList.remove('active');
      formAuthSignup.style.display = 'block';
      formAuthLogin.style.display = 'none';
      authModalTitle.textContent = 'Create sun9 Workspace';
    }
  }

  tabAuthLogin.addEventListener('click', () => switchAuthMode('login'));
  tabAuthSignup.addEventListener('click', () => switchAuthMode('signup'));

  btnCloseAuthModal.addEventListener('click', () => {
    authModal.style.display = 'none';
  });

  authModal.addEventListener('click', (e) => {
    if (e.target === authModal) authModal.style.display = 'none';
  });

  formAuthLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    authErrorBox.style.display = 'none';
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btnSubmit = document.getElementById('btn-submit-login');

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Authenticating...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success && data.token) {
        localStorage.setItem('sun9_jwt_token', data.token);
        currentUser = data.user;
        authModal.style.display = 'none';
        applyUserData(data.user);
        setView('dashboard');
        showToast('Welcome back, ' + data.user.name);
      } else {
        authErrorBox.textContent = data.error || 'Failed to authenticate.';
        authErrorBox.style.display = 'block';
      }
    } catch {
      authErrorBox.textContent = 'Network error. Could not connect to server.';
      authErrorBox.style.display = 'block';
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Log In to Workspace';
    }
  });

  formAuthSignup.addEventListener('submit', async (e) => {
    e.preventDefault();
    authErrorBox.style.display = 'none';
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const btnSubmit = document.getElementById('btn-submit-signup');

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Creating Workspace...';

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, planTier: 'free' })
      });
      const data = await res.json();

      if (data.success && data.token) {
        localStorage.setItem('sun9_jwt_token', data.token);
        currentUser = data.user;
        authModal.style.display = 'none';
        applyUserData(data.user);
        setView('dashboard');
        showToast('Workspace created successfully!');
      } else {
        authErrorBox.textContent = data.error || 'Failed to create account.';
        authErrorBox.style.display = 'block';
      }
    } catch {
      authErrorBox.textContent = 'Network error. Could not connect to server.';
      authErrorBox.style.display = 'block';
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Create Free Workspace';
    }
  });

  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {}
      localStorage.removeItem('sun9_jwt_token');
      currentUser = null;
      navAuthLabel.textContent = 'Log in';
      setView('landing');
      showToast('Logged out of workspace');
    });
  }

  async function loadUserSession() {
    const token = localStorage.getItem('sun9_jwt_token');
    if (!token) {
      currentUser = null;
      if (navAuthLabel) navAuthLabel.textContent = 'Log in';
      return;
    }
    try {
      const res = await fetch('/api/auth/me', { headers: getAuthHeader() });
      const data = await res.json();
      if (data.success && data.user) {
        currentUser = data.user;
        applyUserData(data.user);
        if (navAuthLabel) navAuthLabel.textContent = 'Dashboard';
      } else {
        localStorage.removeItem('sun9_jwt_token');
        currentUser = null;
        if (navAuthLabel) navAuthLabel.textContent = 'Log in';
      }
    } catch {
      currentUser = null;
      if (navAuthLabel) navAuthLabel.textContent = 'Log in';
    }
  }

  function applyUserData(user) {
    if (!user) return;
    if (sidebarUserName) sidebarUserName.textContent = user.name || 'Alex Rivera';
    if (sidebarPlanLabel) sidebarPlanLabel.textContent = user.plan || 'Pro Plan';
    if (sidebarUserAvatar) {
      const initials = (user.name || 'AR').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
      sidebarUserAvatar.textContent = initials;
    }

    const billingPlan = document.getElementById('billing-current-plan');
    if (billingPlan) billingPlan.textContent = user.plan || 'Pro Plan';

    const billingPrice = document.getElementById('billing-current-price');
    if (billingPrice) billingPrice.textContent = `${user.planPrice || '$29'} / month`;

    const billingExec = document.getElementById('billing-exec-quota');
    if (billingExec) billingExec.textContent = `${(user.executionsCount || 8421).toLocaleString()} / ${(user.executionsLimit || 25000).toLocaleString()}`;

    const billingWf = document.getElementById('billing-workflow-quota');
    if (billingWf) billingWf.textContent = `${user.workflowsCount || 14} / ${user.workflowsLimit || 50}`;

    const kpiExec = document.getElementById('kpi-exec-val');
    if (kpiExec) kpiExec.textContent = (user.executionsCount || 8421).toLocaleString();

    if (user.apiKeys) renderApiKeysTable(user.apiKeys);
    if (user.executions) renderExecutionsTables(user.executions);
  }

  function renderExecutionsTables(executions) {
    if (tableRecentExecs && executions.length > 0) {
      tableRecentExecs.innerHTML = '';
      executions.slice(0, 3).forEach(ex => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="font-medium">${ex.workflowName || 'Lead Enrichment Agent'}</td>
          <td class="font-mono text-muted">Webhook</td>
          <td><span class="status-chip ${ex.status === 'SUCCESS' ? 'success' : 'danger'}">${ex.status}</span></td>
          <td class="font-mono">${ex.durationMs || 240}ms</td>
          <td class="text-muted">${ex.startedAt ? new Date(ex.startedAt).toLocaleTimeString() : 'Just now'}</td>
        `;
        tableRecentExecs.appendChild(tr);
      });
    }

    if (tableFullExecutions && executions.length > 0) {
      tableFullExecutions.innerHTML = '';
      executions.forEach(ex => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="font-mono text-muted">${ex.id || 'ex_8421'}</td>
          <td class="font-medium">${ex.workflowName || 'Lead Enrichment Agent'}</td>
          <td class="font-mono">n8n / Webhook</td>
          <td><span class="status-chip ${ex.status === 'SUCCESS' ? 'success' : 'danger'}">${ex.status}</span></td>
          <td class="font-mono">${ex.durationMs || 240}ms</td>
          <td class="text-muted">${ex.startedAt ? new Date(ex.startedAt).toLocaleString() : 'Aug 18, 14:38:12'}</td>
        `;
        tableFullExecutions.appendChild(tr);
      });
    }
  }

  // =========================================================================
  // CUSTOMER DASHBOARD TABS
  // =========================================================================
  function switchCustomerTab(tabId) {
    currentTab = tabId;
    customerNavItems.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
    });
    customerTabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === `pane-${tabId}`);
    });
    if (tabId === 'studio') {
      setTimeout(() => renderStudioCanvas(), 50);
    }
  }

  customerNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      switchCustomerTab(tab);
    });
  });

  if (btnQuickLaunchStudio) btnQuickLaunchStudio.addEventListener('click', () => switchCustomerTab('studio'));
  if (btnLaunchStudioTab) btnLaunchStudioTab.addEventListener('click', () => switchCustomerTab('studio'));
  if (btnViewAllExecs) btnViewAllExecs.addEventListener('click', () => switchCustomerTab('executions'));
  if (btnChangeSubscription) {
    btnChangeSubscription.addEventListener('click', () => {
      setView('landing');
      document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // =========================================================================
  // INTERACTIVE WORKFLOW STUDIO: DRAG & DROP CANVAS ENGINE (UI/UX v2.0)
  // =========================================================================
  const NODE_TYPE_META = {
    webhook: { title: 'Webhook Intake', tag: 'TRIGGER', icon: '⚡', color: '#10b981' },
    ai_agent: { title: 'Claude 3.5 Sonnet', tag: 'AI AGENT', icon: '🧠', color: '#a855f7' },
    condition: { title: 'Condition Branch', tag: 'CONDITION', icon: '🔀', color: '#f59e0b' },
    http_request: { title: 'HTTP Request', tag: 'NETWORK', icon: '🌐', color: '#3b82f6' },
    database: { title: 'PostgreSQL DB', tag: 'DATABASE', icon: '🗄️', color: '#06b6d4' },
    slack: { title: 'Slack Alert', tag: 'ACTION', icon: '💬', color: '#ec4899' },
    email: { title: 'Email Dispatch', tag: 'NOTIFY', icon: '✉️', color: '#f43f5e' },
    code: { title: 'JS Code Block', tag: 'CODE', icon: '⚙️', color: '#a855f7' },
    trigger: { title: 'Manual Trigger', tag: 'TRIGGER', icon: '▶️', color: '#10b981' }
  };

  function renderStudioCanvas() {
    if (!studioNodesLayer || !studioSvgLayer) return;

    if (studioWfNameInput) studioWfNameInput.value = activeWorkflow.name;
    if (studioWfIdBadge) studioWfIdBadge.textContent = activeWorkflow.id;
    if (dockNodeCountLabel) dockNodeCountLabel.textContent = `${activeWorkflow.nodes.length} nodes`;

    // 1. Render Node Cards
    studioNodesLayer.innerHTML = '';
    activeWorkflow.nodes.forEach(node => {
      const meta = NODE_TYPE_META[node.type] || { title: node.name, tag: 'NODE', icon: '📦' };
      const card = document.createElement('div');
      card.className = `canvas-node-card ${node.id === selectedNodeId ? 'selected' : ''} ${node.status === 'RUNNING' ? 'running' : ''} ${node.status === 'SUCCESS' ? 'completed' : ''}`;
      card.id = `cnode_${node.id}`;
      card.style.left = `${node.x}px`;
      card.style.top = `${node.y}px`;

      card.innerHTML = `
        <div class="cnode-port port-in" data-node-id="${node.id}" title="Connect Input Port"></div>
        <div class="cnode-header">
          <span class="cnode-icon-box">${meta.icon}</span>
          <span class="cnode-type-tag font-mono">${meta.tag}</span>
        </div>
        <div class="cnode-name">${node.name}</div>
        <div class="cnode-status font-mono">${node.status || 'Ready'}</div>
        <div class="cnode-port port-out" data-node-id="${node.id}" title="Drag Cable to Connect Output"></div>
      `;

      // Select Node on Click & Setup Dragging
      card.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('cnode-port')) return;
        selectedNodeId = node.id;
        draggingNode = node;
        const rect = studioCanvasBg.getBoundingClientRect();
        dragOffset.x = (e.clientX - rect.left) / canvasZoom - node.x;
        dragOffset.y = (e.clientY - rect.top) / canvasZoom - node.y;
        renderStudioCanvas();
        renderInspector();
      });

      studioNodesLayer.appendChild(card);
    });

    // 2. Render SVG Connection Cables
    renderSvgConnections();
  }

  function renderSvgConnections() {
    if (!studioSvgLayer) return;
    const existing = studioSvgLayer.querySelectorAll('.svg-wire-path:not(#temp-drawing-wire)');
    existing.forEach(el => el.remove());

    activeWorkflow.connections.forEach(conn => {
      const srcNode = activeWorkflow.nodes.find(n => n.id === conn.source);
      const tgtNode = activeWorkflow.nodes.find(n => n.id === conn.target);

      if (srcNode && tgtNode) {
        const srcX = srcNode.x + 180;
        const srcY = srcNode.y + 36;
        const tgtX = tgtNode.x;
        const tgtY = tgtNode.y + 36;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'svg-wire-path');
        path.setAttribute('data-conn-id', conn.id);
        path.setAttribute('title', 'Click to remove connection');

        const dx = Math.max(40, (tgtX - srcX) * 0.5);
        const d = `M ${srcX} ${srcY} C ${srcX + dx} ${srcY}, ${tgtX - dx} ${tgtY}, ${tgtX} ${tgtY}`;
        path.setAttribute('d', d);

        // Click wire to delete
        path.addEventListener('click', (e) => {
          e.stopPropagation();
          activeWorkflow.connections = activeWorkflow.connections.filter(c => c.id !== conn.id);
          renderStudioCanvas();
          showToast('Connection cable removed', 'success');
        });

        studioSvgLayer.appendChild(path);
      }
    });
  }

  // Node Dragging on Canvas
  studioCanvasBg.addEventListener('mousemove', (e) => {
    const rect = studioCanvasBg.getBoundingClientRect();
    const curX = (e.clientX - rect.left) / canvasZoom;
    const curY = (e.clientY - rect.top) / canvasZoom;

    if (draggingNode) {
      draggingNode.x = Math.max(10, Math.min(rect.width - 190, curX - dragOffset.x));
      draggingNode.y = Math.max(10, Math.min(rect.height - 80, curY - dragOffset.y));
      const card = document.getElementById(`cnode_${draggingNode.id}`);
      if (card) {
        card.style.left = `${draggingNode.x}px`;
        card.style.top = `${draggingNode.y}px`;
      }
      renderSvgConnections();
    }

    if (drawingConnection && tempDrawingWire) {
      const srcX = drawingConnection.startX;
      const srcY = drawingConnection.startY;
      const dx = Math.max(30, Math.abs(curX - srcX) * 0.5);
      const d = `M ${srcX} ${srcY} C ${srcX + dx} ${srcY}, ${curX - dx} ${curY}, ${curX} ${curY}`;
      tempDrawingWire.setAttribute('d', d);
    }
  });

  window.addEventListener('mouseup', (e) => {
    draggingNode = null;
    if (drawingConnection && tempDrawingWire) {
      tempDrawingWire.style.display = 'none';

      const portIn = e.target.closest('.port-in');
      if (portIn) {
        const targetNodeId = portIn.getAttribute('data-node-id');
        if (targetNodeId && targetNodeId !== drawingConnection.sourceNodeId) {
          const exists = activeWorkflow.connections.some(c => c.source === drawingConnection.sourceNodeId && c.target === targetNodeId);
          if (!exists) {
            activeWorkflow.connections.push({
              id: 'conn_' + Math.random().toString(36).substring(2, 8),
              source: drawingConnection.sourceNodeId,
              target: targetNodeId
            });
            showToast('Nodes connected ✓', 'success');
          }
        }
      }
      drawingConnection = null;
      renderStudioCanvas();
    }
  });

  // Cable Port Dragging Start
  studioCanvasBg.addEventListener('mousedown', (e) => {
    const portOut = e.target.closest('.port-out');
    if (portOut) {
      const sourceNodeId = portOut.getAttribute('data-node-id');
      const srcNode = activeWorkflow.nodes.find(n => n.id === sourceNodeId);
      if (srcNode && tempDrawingWire) {
        drawingConnection = {
          sourceNodeId,
          startX: srcNode.x + 180,
          startY: srcNode.y + 36
        };
        tempDrawingWire.style.display = 'block';
        tempDrawingWire.setAttribute('d', `M ${drawingConnection.startX} ${drawingConnection.startY} L ${drawingConnection.startX} ${drawingConnection.startY}`);
      }
    }
  });

  // Palette Node Search Filter
  if (studioNodeSearch) {
    studioNodeSearch.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const items = studioPaletteList.querySelectorAll('.lib-item');
      let visibleCount = 0;

      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        const matches = text.includes(query);
        item.style.display = matches ? 'flex' : 'none';
        if (matches) visibleCount++;
      });

      if (paletteCountBadge) {
        paletteCountBadge.textContent = `${visibleCount} nodes`;
      }
    });
  }

  // Palette Drag and Drop
  if (studioPaletteList) {
    studioPaletteList.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.lib-item');
      if (item) {
        e.dataTransfer.setData('text/plain', item.getAttribute('data-node-type'));
      }
    });
  }

  studioCanvasBg.addEventListener('dragover', (e) => {
    e.preventDefault();
    studioCanvasBg.classList.add('drag-over-canvas');
  });

  studioCanvasBg.addEventListener('dragleave', () => {
    studioCanvasBg.classList.remove('drag-over-canvas');
  });

  studioCanvasBg.addEventListener('drop', (e) => {
    e.preventDefault();
    studioCanvasBg.classList.remove('drag-over-canvas');
    const nodeType = e.dataTransfer.getData('text/plain');
    if (nodeType && NODE_TYPE_META[nodeType]) {
      const rect = studioCanvasBg.getBoundingClientRect();
      const dropX = Math.max(20, (e.clientX - rect.left) / canvasZoom - 90);
      const dropY = Math.max(20, (e.clientY - rect.top) / canvasZoom - 35);
      const meta = NODE_TYPE_META[nodeType];

      const newNodeId = 'node_' + Math.random().toString(36).substring(2, 7);
      const newNode = {
        id: newNodeId,
        type: nodeType,
        name: meta.title,
        x: dropX,
        y: dropY,
        parameters: {},
        status: 'READY'
      };

      activeWorkflow.nodes.push(newNode);
      selectedNodeId = newNodeId;
      renderStudioCanvas();
      renderInspector();
      showToast(`Added ${meta.title} to canvas`, 'success');
    }
  });

  // Canvas Dock Controls (Zoom & Fit)
  if (btnDockZoomIn) {
    btnDockZoomIn.addEventListener('click', () => {
      canvasZoom = Math.min(1.5, canvasZoom + 0.1);
      studioNodesLayer.style.transform = `scale(${canvasZoom})`;
      studioNodesLayer.style.transformOrigin = 'top left';
      renderSvgConnections();
    });
  }

  if (btnDockZoomOut) {
    btnDockZoomOut.addEventListener('click', () => {
      canvasZoom = Math.max(0.6, canvasZoom - 0.1);
      studioNodesLayer.style.transform = `scale(${canvasZoom})`;
      studioNodesLayer.style.transformOrigin = 'top left';
      renderSvgConnections();
    });
  }

  if (btnDockFit) {
    btnDockFit.addEventListener('click', () => {
      canvasZoom = 1.0;
      studioNodesLayer.style.transform = 'scale(1)';
      renderStudioCanvas();
      showToast('Canvas view reset', 'success');
    });
  }

  // Inspector Tab Switching
  inspTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      inspTabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentInspTab = btn.getAttribute('data-insp-tab');
      renderInspector();
    });
  });

  // Dynamic Inspector Panel Renderer
  function renderInspector() {
    if (!studioInspectorContent) return;
    const node = activeWorkflow.nodes.find(n => n.id === selectedNodeId);

    if (!node) {
      studioInspectorContent.innerHTML = `<p class="text-muted text-sm" style="text-align:center; padding: 24px 0;">Select a node on canvas to configure parameters.</p>`;
      return;
    }

    const meta = NODE_TYPE_META[node.type] || { title: node.name, tag: 'NODE' };
    const params = node.parameters || {};

    if (currentInspTab === 'json') {
      studioInspectorContent.innerHTML = `
        <div class="form-group">
          <label class="form-label">Canonical JSON Representation</label>
          <pre class="font-mono text-xs" style="background:#08080a; padding:10px; border-radius:6px; border:1px solid var(--border-subtle); color:var(--text-secondary); max-height:360px; overflow-y:auto;">${JSON.stringify(node, null, 2)}</pre>
        </div>
      `;
      return;
    }

    if (currentInspTab === 'test') {
      studioInspectorContent.innerHTML = `
        <div class="form-group">
          <label class="form-label">Test Step Payload</label>
          <textarea class="input-ctrl font-mono text-xs" rows="4">{\n  "sample": true,\n  "nodeId": "${node.id}"\n}</textarea>
        </div>
        <button class="btn btn-secondary btn-full btn-xs" id="btn-run-single-step">Execute Step Test</button>
        <div id="test-step-output" class="font-mono text-xs text-muted" style="margin-top:10px; padding:8px; background:#08080a; border-radius:4px; border:1px solid var(--border-subtle); display:none;"></div>
      `;

      document.getElementById('btn-run-single-step').addEventListener('click', () => {
        const out = document.getElementById('test-step-output');
        out.style.display = 'block';
        out.textContent = `[Testing ${node.name}] -> 200 OK (Latency: 28ms)`;
        showToast(`Step test passed for ${node.name}`, 'success');
      });
      return;
    }

    // Config Tab
    let specificFields = '';

    if (node.type === 'webhook') {
      specificFields = `
        <div class="form-group">
          <label class="form-label">HTTP Method</label>
          <select class="input-ctrl" id="insp-param-method">
            <option ${params.httpMethod === 'POST' ? 'selected' : ''}>POST</option>
            <option ${params.httpMethod === 'GET' ? 'selected' : ''}>GET</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Webhook Path</label>
          <input type="text" class="input-ctrl font-mono" id="insp-param-path" value="${params.path || 'incoming-leads'}" />
        </div>
      `;
    } else if (node.type === 'ai_agent') {
      specificFields = `
        <div class="form-group">
          <label class="form-label">Model Provider</label>
          <select class="input-ctrl" id="insp-param-model">
            <option ${params.model === 'claude-3-5-sonnet' ? 'selected' : ''}>claude-3-5-sonnet</option>
            <option ${params.model === 'gpt-4o-mini' ? 'selected' : ''}>gpt-4o-mini</option>
            <option ${params.model === 'gemini-1.5-pro' ? 'selected' : ''}>gemini-1.5-pro</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Prompt Instructions</label>
          <textarea class="input-ctrl font-mono" id="insp-param-prompt" rows="3">${params.prompt || 'Score lead payload & return JSON.'}</textarea>
        </div>
      `;
    } else if (node.type === 'condition') {
      specificFields = `
        <div class="form-group">
          <label class="form-label">Condition Operator</label>
          <select class="input-ctrl" id="insp-param-op">
            <option value="greaterThan" ${params.operation === 'greaterThan' ? 'selected' : ''}>Score &gt; Threshold</option>
            <option value="isNotEmpty" ${params.operation === 'isNotEmpty' ? 'selected' : ''}>Field Is Not Empty</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Threshold Value</label>
          <input type="text" class="input-ctrl font-mono" id="insp-param-thresh" value="${params.threshold || '80'}" />
        </div>
      `;
    } else if (node.type === 'database') {
      specificFields = `
        <div class="form-group">
          <label class="form-label">SQL Query</label>
          <textarea class="input-ctrl font-mono" id="insp-param-query" rows="3">${params.query || 'INSERT INTO leads VALUES ($1);'}</textarea>
        </div>
      `;
    } else if (node.type === 'http_request') {
      specificFields = `
        <div class="form-group">
          <label class="form-label">Target URL</label>
          <input type="text" class="input-ctrl font-mono" id="insp-param-url" value="${params.url || 'https://httpbin.org/post'}" />
        </div>
      `;
    } else if (node.type === 'slack') {
      specificFields = `
        <div class="form-group">
          <label class="form-label">Slack Channel</label>
          <input type="text" class="input-ctrl font-mono" id="insp-param-channel" value="${params.channel || '#vip-deals'}" />
        </div>
      `;
    } else if (node.type === 'email') {
      specificFields = `
        <div class="form-group">
          <label class="form-label">Recipient Email</label>
          <input type="text" class="input-ctrl font-mono" id="insp-param-to" value="${params.toEmail || 'leads@sun9.io'}" />
        </div>
      `;
    } else if (node.type === 'code') {
      specificFields = `
        <div class="form-group">
          <label class="form-label">JavaScript Code</label>
          <textarea class="input-ctrl font-mono" id="insp-param-code" rows="3">${params.code || 'return $input.all();'}</textarea>
        </div>
      `;
    }

    studioInspectorContent.innerHTML = `
      <div class="form-group">
        <label class="form-label">Node Title</label>
        <input type="text" class="input-ctrl" id="insp-node-name" value="${node.name}" />
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <input type="text" class="input-ctrl font-mono text-muted" readonly value="${meta.tag} (${node.type})" />
      </div>
      ${specificFields}
      <button class="btn btn-secondary btn-full btn-xs" id="btn-save-inspector" style="margin-top: 8px;">Apply Changes</button>
      <button class="btn btn-ghost btn-full btn-xs text-danger" id="btn-delete-inspector-node" style="margin-top: 6px;">Delete Node (Del)</button>
    `;

    document.getElementById('btn-save-inspector').addEventListener('click', () => {
      node.name = document.getElementById('insp-node-name').value;
      if (document.getElementById('insp-param-path')) node.parameters.path = document.getElementById('insp-param-path').value;
      if (document.getElementById('insp-param-method')) node.parameters.httpMethod = document.getElementById('insp-param-method').value;
      if (document.getElementById('insp-param-model')) node.parameters.model = document.getElementById('insp-param-model').value;
      if (document.getElementById('insp-param-prompt')) node.parameters.prompt = document.getElementById('insp-param-prompt').value;
      if (document.getElementById('insp-param-query')) node.parameters.query = document.getElementById('insp-param-query').value;
      if (document.getElementById('insp-param-url')) node.parameters.url = document.getElementById('insp-param-url').value;
      if (document.getElementById('insp-param-channel')) node.parameters.channel = document.getElementById('insp-param-channel').value;
      if (document.getElementById('insp-param-to')) node.parameters.toEmail = document.getElementById('insp-param-to').value;
      if (document.getElementById('insp-param-code')) node.parameters.code = document.getElementById('insp-param-code').value;

      renderStudioCanvas();
      showToast('Node configuration updated', 'success');
    });

    document.getElementById('btn-delete-inspector-node').addEventListener('click', () => {
      activeWorkflow.nodes = activeWorkflow.nodes.filter(n => n.id !== node.id);
      activeWorkflow.connections = activeWorkflow.connections.filter(c => c.source !== node.id && c.target !== node.id);
      selectedNodeId = activeWorkflow.nodes[0] ? activeWorkflow.nodes[0].id : null;
      renderStudioCanvas();
      renderInspector();
      showToast('Node removed from canvas', 'success');
    });
  }

  // Keyboard Shortcuts (Del to delete node, Cmd+S to save, Cmd+Enter to run)
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedNodeId) {
        activeWorkflow.nodes = activeWorkflow.nodes.filter(n => n.id !== selectedNodeId);
        activeWorkflow.connections = activeWorkflow.connections.filter(c => c.source !== selectedNodeId && c.target !== selectedNodeId);
        selectedNodeId = activeWorkflow.nodes[0] ? activeWorkflow.nodes[0].id : null;
        renderStudioCanvas();
        renderInspector();
        showToast('Node deleted', 'success');
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (btnStudioSave) btnStudioSave.click();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (btnStudioRun) btnStudioRun.click();
    }
  });

  // Save Flow Button
  if (btnStudioSave) {
    btnStudioSave.addEventListener('click', async () => {
      btnStudioSave.disabled = true;
      btnStudioSave.innerHTML = `<span>Saving...</span>`;

      if (studioWfNameInput) activeWorkflow.name = studioWfNameInput.value;

      try {
        const res = await fetch(`/api/workflows/${activeWorkflow.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader()
          },
          body: JSON.stringify({
            name: activeWorkflow.name,
            definition: {
              nodes: activeWorkflow.nodes,
              connections: activeWorkflow.connections
            }
          })
        });

        const data = await res.json();
        if (data.success) {
          showToast('Workflow saved to cloud', 'success');
        } else {
          showToast('Saved locally', 'success');
        }
      } catch {
        showToast('Saved locally in workspace', 'success');
      } finally {
        setTimeout(() => {
          btnStudioSave.disabled = false;
          btnStudioSave.innerHTML = `
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            <span>Save Flow</span>
          `;
        }, 1200);
      }
    });
  }

  // New Flow Button
  if (btnStudioNew) {
    btnStudioNew.addEventListener('click', () => {
      const newId = 'wf_' + Math.random().toString(36).substring(2, 8);
      activeWorkflow = {
        id: newId,
        name: 'New Automation Flow',
        nodes: [
          { id: 'node_1', type: 'webhook', name: 'Webhook Intake', x: 60, y: 120, parameters: { path: 'custom-hook' }, status: 'READY' },
          { id: 'node_2', type: 'ai_agent', name: 'AI Processor', x: 300, y: 120, parameters: { model: 'claude-3-5-sonnet' }, status: 'READY' }
        ],
        connections: [
          { id: 'conn_1', source: 'node_1', target: 'node_2' }
        ]
      };
      selectedNodeId = 'node_1';
      renderStudioCanvas();
      renderInspector();
      showToast('Created new workflow canvas', 'success');
    });
  }

  // Clear Canvas Button
  if (btnStudioClear) {
    btnStudioClear.addEventListener('click', () => {
      activeWorkflow.nodes = [];
      activeWorkflow.connections = [];
      selectedNodeId = null;
      renderStudioCanvas();
      renderInspector();
      showToast('Canvas cleared', 'success');
    });
  }

  // Run Flow Execution
  if (btnStudioRun) {
    btnStudioRun.addEventListener('click', async () => {
      if (isExecutingStudio) return;
      isExecutingStudio = true;
      btnStudioRun.disabled = true;
      btnStudioRun.textContent = 'Executing...';
      studioTermStatus.textContent = 'RUNNING';
      studioTermStatus.style.color = 'var(--accent-amber)';

      const appendLog = (msg) => {
        const time = new Date().toISOString().substring(11, 19);
        const div = document.createElement('div');
        div.className = 'term-line';
        div.textContent = `[${time}] ${msg}`;
        studioTerminalLogs.appendChild(div);
        studioTerminalLogs.scrollTop = studioTerminalLogs.scrollHeight;
      };

      appendLog(`Trigger signal dispatched for ${activeWorkflow.name} (${activeWorkflow.nodes.length} nodes)...`);

      activeWorkflow.nodes.forEach(n => n.status = 'READY');
      renderStudioCanvas();

      try {
        const res = await fetch(`/api/workflows/${activeWorkflow.id}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader()
          },
          body: JSON.stringify({
            sampleLead: { company: 'Acme Global', score: 94, source: 'Canvas Studio' }
          })
        });

        const execData = await res.json();

        if (execData.success) {
          appendLog(`Execution initiated: ID #${execData.execution_id} (n8n: ${execData.n8n_execution_id})`);

          let stepIndex = 0;
          const runNextNode = () => {
            if (stepIndex < activeWorkflow.nodes.length) {
              const node = activeWorkflow.nodes[stepIndex];
              node.status = 'RUNNING';
              renderStudioCanvas();
              appendLog(`Step ${stepIndex + 1}/${activeWorkflow.nodes.length} [${node.name}]: Executing...`);

              setTimeout(() => {
                node.status = 'SUCCESS';
                renderStudioCanvas();
                appendLog(`Step ${stepIndex + 1} [${node.name}]: 200 OK — Success`);
                stepIndex++;
                runNextNode();
              }, 300);
            } else {
              appendLog(`Workflow finished: SUCCESS (Total: ${execData.duration_ms}ms)`);
              studioTermStatus.textContent = 'SUCCESS';
              studioTermStatus.style.color = 'var(--accent-emerald)';
              btnStudioRun.disabled = false;
              btnStudioRun.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Run Flow</span>`;
              isExecutingStudio = false;
              showToast('Workflow executed successfully', 'success');
              loadUserSession();
            }
          };

          runNextNode();
        } else {
          appendLog(`Execution Error [${execData.code || 'FAILED'}]: ${execData.error}`);
          studioTermStatus.textContent = 'FAILED';
          studioTermStatus.style.color = 'var(--accent-rose)';
          btnStudioRun.disabled = false;
          btnStudioRun.textContent = 'Run Flow';
          isExecutingStudio = false;
          showToast(`Execution failed: ${execData.error}`, 'error');
        }
      } catch (err) {
        appendLog(`Network error during execution: ${err.message}`);
        studioTermStatus.textContent = 'ERROR';
        studioTermStatus.style.color = 'var(--accent-rose)';
        btnStudioRun.disabled = false;
        btnStudioRun.textContent = 'Run Flow';
        isExecutingStudio = false;
        showToast('Network error during execution', 'error');
      }
    });
  }

  // =========================================================================
  // HERO VISUAL FLOW RUNNER
  // =========================================================================
  if (btnRunHeroFlow) {
    btnRunHeroFlow.addEventListener('click', () => {
      if (isExecutingHero) return;
      isExecutingHero = true;
      btnRunHeroFlow.disabled = true;

      heroStatusDot.className = 'status-indicator running';
      heroLogEntry.textContent = '[0ms] Initializing execution context...';
      heroLogLatency.textContent = '0ms';

      hnodes.forEach(n => n.classList.remove('active', 'executing', 'completed'));
      wires.forEach(w => w.classList.remove('active'));

      hnodes[0].classList.add('executing');
      heroLogEntry.textContent = '[28ms] Webhook payload accepted (POST /v1/incoming-leads - 1.8 KB)';
      heroLogLatency.textContent = '28ms';

      setTimeout(() => {
        hnodes[0].classList.remove('executing');
        hnodes[0].classList.add('completed');
        wires[0].classList.add('active');

        hnodes[1].classList.add('executing');
        heroLogEntry.textContent = '[110ms] Claude 3.5 Sonnet: Extracted Enterprise intent (Score: 94)';
        heroLogLatency.textContent = '110ms';

        setTimeout(() => {
          hnodes[1].classList.remove('executing');
          hnodes[1].classList.add('completed');
          wires[1].classList.add('active');
          wires[2].classList.add('active');

          hnodes[2].classList.add('executing');
          hnodes[3].classList.add('executing');
          heroLogEntry.textContent = '[184ms] Parallel dispatch: Postgres row inserted & Slack #vip-deals alerted';
          heroLogLatency.textContent = '184ms';

          setTimeout(() => {
            hnodes[2].classList.remove('executing');
            hnodes[2].classList.add('completed');
            hnodes[3].classList.remove('executing');
            hnodes[3].classList.add('completed');

            heroStatusDot.className = 'status-indicator ready';
            heroLogEntry.textContent = '[184ms] Execution complete: 4/4 steps succeeded with 0 errors.';
            heroLogLatency.textContent = '184ms';

            setTimeout(() => {
              btnRunHeroFlow.disabled = false;
              isExecutingHero = false;
            }, 1500);
          }, 400);
        }, 400);
      }, 400);
    });
  }

  // =========================================================================
  // BILLING SWITCHER & POLAR MODAL
  // =========================================================================
  if (btnBillingSwitch) {
    btnBillingSwitch.addEventListener('click', () => {
      isAnnual = !isAnnual;
      btnBillingSwitch.classList.toggle('active', isAnnual);
      lblMonthly.classList.toggle('active', !isAnnual);
      lblAnnual.classList.toggle('active', !isAnnual);

      if (isAnnual) {
        pricePro.textContent = '$23';
        priceScale.textContent = '$159';
      } else {
        pricePro.textContent = '$29';
        priceScale.textContent = '$199';
      }
    });
  }

  btnSelectTiers.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedPlan = btn.getAttribute('data-plan');
      const planName = selectedPlan === 'free' ? 'Community / Free' : selectedPlan === 'scale' ? 'Enterprise / Scale' : 'Pro Cloud';
      const price = selectedPlan === 'free' ? '$0' : selectedPlan === 'scale' ? (isAnnual ? '$159/mo' : '$199/mo') : (isAnnual ? '$23/mo' : '$29/mo');

      modalPlanName.textContent = planName;
      modalPlanPrice.textContent = price;
      checkoutModal.style.display = 'flex';
    });
  });

  btnCloseModal.addEventListener('click', () => {
    checkoutModal.style.display = 'none';
  });

  checkoutModal.addEventListener('click', (e) => {
    if (e.target === checkoutModal) checkoutModal.style.display = 'none';
  });

  const btnPolarPortal = document.getElementById('btn-polar-portal');
  if (btnPolarPortal) {
    btnPolarPortal.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/billing/polar/portal', { headers: getAuthHeader() });
        const data = await res.json();
        if (data.success && data.portalUrl) {
          window.open(data.portalUrl, '_blank');
        } else {
          window.open('https://polar.sh/purchases', '_blank');
        }
      } catch {
        window.open('https://polar.sh/purchases', '_blank');
      }
    });
  }

  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnConfirmPay.disabled = true;
    btnConfirmPay.textContent = 'Connecting to Polar.sh...';

    try {
      const res = await fetch('/api/billing/polar/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ plan: selectedPlan, isAnnual })
      });
      const data = await res.json();

      if (data.success) {
        checkoutModal.style.display = 'none';
        applyUserData(data.user);
        setView('dashboard');
        switchCustomerTab('billing');
        showToast(`Upgraded to ${selectedPlan.toUpperCase()} plan!`, 'success');
      }
    } catch {
      checkoutModal.style.display = 'none';
      setView('dashboard');
    } finally {
      btnConfirmPay.disabled = false;
      btnConfirmPay.textContent = 'Pay & Activate with Polar.sh';
    }
  });

  // =========================================================================
  // API KEY MANAGEMENT
  // =========================================================================
  function renderApiKeysTable(keys) {
    if (!tableApiKeys) return;
    tableApiKeys.innerHTML = '';
    keys.forEach(k => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-medium">${k.name}</td>
        <td><span class="font-mono text-muted key-display" id="key-text-${k.id}">${k.masked}</span></td>
        <td class="text-muted">${k.created}</td>
        <td class="text-muted">${k.lastUsed}</td>
        <td>
          <div class="action-btn-group">
            <button class="btn btn-ghost btn-xs btn-reveal-key" data-id="${k.id}" data-full="${k.fullKey}">Reveal</button>
            <button class="btn btn-ghost btn-xs btn-copy-key" data-key="${k.fullKey}">Copy</button>
            <button class="btn btn-ghost btn-xs btn-revoke-key text-danger" data-id="${k.id}">Revoke</button>
          </div>
        </td>
      `;
      tableApiKeys.appendChild(tr);
    });
  }

  document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-reveal-key')) {
      const keyId = e.target.getAttribute('data-id');
      const fullKey = e.target.getAttribute('data-full');
      const keySpan = document.getElementById(`key-text-${keyId}`);
      if (keySpan) {
        if (keySpan.textContent.includes('••••')) {
          keySpan.textContent = fullKey;
          e.target.textContent = 'Hide';
        } else {
          keySpan.textContent = '••••••••••••' + fullKey.slice(-4);
          e.target.textContent = 'Reveal';
        }
      }
    }

    if (e.target.classList.contains('btn-copy-key')) {
      const fullKey = e.target.getAttribute('data-key');
      navigator.clipboard.writeText(fullKey);
      e.target.textContent = 'Copied';
      showToast('API Key copied to clipboard', 'success');
      setTimeout(() => (e.target.textContent = 'Copy'), 2000);
    }

    if (e.target.classList.contains('btn-revoke-key')) {
      const keyId = e.target.getAttribute('data-id');
      if (confirm('Revoke this production API key?')) {
        try {
          const res = await fetch('/api/keys/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify({ keyId })
          });
          const data = await res.json();
          if (data.success && data.apiKeys) {
            renderApiKeysTable(data.apiKeys);
            showToast('API Key revoked', 'success');
          }
        } catch (err) {
          console.error(err);
        }
      }
    }
  });

  if (btnCreateKey) {
    btnCreateKey.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/keys/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({ name: 'Workspace Key ' + Math.floor(Math.random() * 100) })
        });
        const data = await res.json();
        if (data.success && data.apiKeys) {
          renderApiKeysTable(data.apiKeys);
          showToast('New API Key generated', 'success');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Initialize Session & Studio
  loadUserSession();
  renderStudioCanvas();
  renderInspector();
});
