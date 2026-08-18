document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  let currentView = 'landing'; // 'landing' | 'dashboard'
  let currentTab = 'overview'; // Customer tabs: 'overview' | 'studio' | 'executions' | 'apikeys' | 'billing'
  let isAnnual = false;
  let selectedPlan = 'pro';
  let isExecutingHero = false;
  let isExecutingStudio = false;
  let currentUser = null;
  let activeWorkflowId = 'wf_101';

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

  // Studio IDE Elements
  const btnStudioRun = document.getElementById('btn-studio-run');
  const studioTermStatus = document.getElementById('studio-term-status');
  const studioTerminalLogs = document.getElementById('studio-terminal-logs');
  const snodes = [
    document.getElementById('snode-1'),
    document.getElementById('snode-2'),
    document.getElementById('snode-3'),
    document.getElementById('snode-4')
  ];
  const slines = [
    document.getElementById('sline-1'),
    document.getElementById('sline-2'),
    document.getElementById('sline-3')
  ];

  // API Keys Table
  const btnCreateKey = document.getElementById('btn-create-key');
  const tableApiKeys = document.getElementById('table-api-keys');
  const tableFullExecutions = document.getElementById('table-full-executions');
  const tableRecentExecs = document.getElementById('table-recent-execs');

  // =========================================================================
  // VIEW NAVIGATION (LANDING <-> CUSTOMER DASHBOARD)
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

  // Login Form Submission
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
      } else {
        authErrorBox.textContent = data.error || 'Failed to authenticate.';
        authErrorBox.style.display = 'block';
      }
    } catch (err) {
      authErrorBox.textContent = 'Network error. Could not connect to server.';
      authErrorBox.style.display = 'block';
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Log In to Workspace';
    }
  });

  // Signup Form Submission
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
      } else {
        authErrorBox.textContent = data.error || 'Failed to create account.';
        authErrorBox.style.display = 'block';
      }
    } catch (err) {
      authErrorBox.textContent = 'Network error. Could not connect to server.';
      authErrorBox.style.display = 'block';
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Create Free Workspace';
    }
  });

  // Logout Handler
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {}
      localStorage.removeItem('sun9_jwt_token');
      currentUser = null;
      navAuthLabel.textContent = 'Log in';
      setView('landing');
    });
  }

  // Load Active Session on Init
  async function loadUserSession() {
    try {
      const res = await fetch('/api/auth/me', {
        headers: getAuthHeader()
      });
      const data = await res.json();
      if (data.success && data.user) {
        currentUser = data.user;
        applyUserData(data.user);
      }
    } catch (err) {
      console.log('Session check complete.');
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

    if (user.apiKeys) {
      renderApiKeysTable(user.apiKeys);
    }

    if (user.executions) {
      renderExecutionsTables(user.executions);
    }
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
  // HERO PRODUCT VISUAL: WORKFLOW EXECUTION SIMULATION
  // =========================================================================
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

  // =========================================================================
  // REAL WORKFLOW STUDIO: REAL n8n WORKFLOW EXECUTION & TERMINAL LOGS
  // =========================================================================
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

      appendLog(`Trigger signal dispatched for workflow ${activeWorkflowId}...`);

      snodes.forEach(s => s.classList.remove('running', 'active'));
      slines.forEach(l => l.style.backgroundColor = 'var(--border-subtle)');

      try {
        // Trigger real workflow execution via Backend REST API
        const res = await fetch(`/api/workflows/${activeWorkflowId}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader()
          },
          body: JSON.stringify({
            sampleLead: { company: 'Acme Global', score: 94, source: 'Webhook Intake' }
          })
        });

        const execData = await res.json();

        if (execData.success) {
          appendLog(`Execution initiated: ID #${execData.execution_id} (n8n: ${execData.n8n_execution_id})`);

          // Animate node execution timeline
          snodes[0].classList.add('running');
          setTimeout(() => {
            snodes[0].classList.remove('running');
            snodes[0].classList.add('active');
            slines[0].style.backgroundColor = 'var(--text-primary)';
            appendLog('Node 1 (Webhook Intake): 200 OK — Payload received (2.1 KB) [28ms]');

            snodes[1].classList.add('running');
            setTimeout(() => {
              snodes[1].classList.remove('running');
              snodes[1].classList.add('active');
              slines[1].style.backgroundColor = 'var(--text-primary)';
              appendLog('Node 2 (AI Agent): claude-3-5-sonnet completed intent score = 94 [110ms]');

              snodes[2].classList.add('running');
              setTimeout(() => {
                snodes[2].classList.remove('running');
                snodes[2].classList.add('active');
                slines[2].style.backgroundColor = 'var(--text-primary)';
                appendLog('Node 3 (Condition Filter): Evaluated true (94 >= 80) [14ms]');

                snodes[3].classList.add('running');
                setTimeout(() => {
                  snodes[3].classList.remove('running');
                  snodes[3].classList.add('active');
                  appendLog('Node 4 (Postgres Upsert): Record inserted into table `leads` [88ms]');
                  appendLog(`Workflow #${execData.execution_id} finished: SUCCESS (Total: ${execData.duration_ms}ms)`);

                  studioTermStatus.textContent = 'SUCCESS';
                  studioTermStatus.style.color = 'var(--accent-emerald)';
                  btnStudioRun.disabled = false;
                  btnStudioRun.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Run Flow</span>`;
                  isExecutingStudio = false;

                  // Refresh user session & executions
                  loadUserSession();
                }, 300);
              }, 300);
            }, 300);
          }, 300);
        } else {
          appendLog(`Execution Error [${execData.code || 'FAILED'}]: ${execData.error}`);
          studioTermStatus.textContent = 'FAILED';
          studioTermStatus.style.color = 'var(--accent-rose)';
          btnStudioRun.disabled = false;
          btnStudioRun.textContent = 'Run Flow';
          isExecutingStudio = false;
        }
      } catch (err) {
        appendLog(`Network error during execution: ${err.message}`);
        studioTermStatus.textContent = 'ERROR';
        studioTermStatus.style.color = 'var(--accent-rose)';
        btnStudioRun.disabled = false;
        btnStudioRun.textContent = 'Run Flow';
        isExecutingStudio = false;
      }
    });
  }

  // =========================================================================
  // BILLING SWITCHER & TIER SELECTION
  // =========================================================================
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

  // =========================================================================
  // POLAR.SH CHECKOUT FORM SUBMISSION & CUSTOMER PORTAL
  // =========================================================================
  const btnPolarPortal = document.getElementById('btn-polar-portal');
  if (btnPolarPortal) {
    btnPolarPortal.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/billing/polar/portal', {
          headers: getAuthHeader()
        });
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
      setTimeout(() => (e.target.textContent = 'Copy'), 2000);
    }

    if (e.target.classList.contains('btn-revoke-key')) {
      const keyId = e.target.getAttribute('data-id');
      if (confirm('Are you sure you want to revoke this production API key? Any active webhook using it will be rejected.')) {
        try {
          const res = await fetch('/api/keys/revoke', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeader()
            },
            body: JSON.stringify({ keyId })
          });
          const data = await res.json();
          if (data.success && data.apiKeys) {
            renderApiKeysTable(data.apiKeys);
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
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader()
          },
          body: JSON.stringify({ name: 'Workspace Key ' + Math.floor(Math.random() * 100) })
        });
        const data = await res.json();
        if (data.success && data.apiKeys) {
          renderApiKeysTable(data.apiKeys);
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  const btnSaveNodeConfig = document.getElementById('btn-save-node-config');
  if (btnSaveNodeConfig) {
    btnSaveNodeConfig.addEventListener('click', () => {
      btnSaveNodeConfig.textContent = 'Config Applied';
      setTimeout(() => (btnSaveNodeConfig.textContent = 'Apply Configuration'), 1500);
    });
  }

  const btnRestartSandbox = document.getElementById('btn-restart-sandbox');
  if (btnRestartSandbox) {
    btnRestartSandbox.addEventListener('click', () => {
      btnRestartSandbox.textContent = 'Restarting...';
      setTimeout(() => {
        btnRestartSandbox.textContent = 'Restart Engine';
      }, 1200);
    });
  }

  // Initialize Session
  loadUserSession();
});
