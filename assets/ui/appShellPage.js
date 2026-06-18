(function(global) {
  'use strict';

  function buildPlatformVersionLabel() {
    const release = global.__RISK_CALCULATOR_RELEASE__ || {};
    const rawVersion = String(release.version || '0.10.0-pilot.1').trim();
    const channel = String(release.channel || 'pilot').trim();
    const versionMatch = rawVersion.match(/^(\d+\.\d+)/);
    const versionLabel = versionMatch ? versionMatch[1] : rawVersion.replace(/-.+$/, '') || '0.10';
    return `Risk Intelligence Engine v${versionLabel}${channel ? ` ${channel}` : ''}`;
  }

  const PLATFORM_VERSION_LABEL = buildPlatformVersionLabel();
  const pageCleanupHandlers = new Set();
  const STAGE_TRANSITION_MS = 560;
  let stageTransitionTimer = 0;

  function getWizardStepNumber(route = '') {
    const value = String(route || '').trim();
    const match = value.match(/^\/wizard\/([1-5])(?:$|[/?#])/);
    if (match) return Number(match[1]);
    if (value === '/wizard/review') return 5;
    return 0;
  }

  function isBasicExperienceMode() {
    if (typeof global.isAdvancedExperienceMode === 'function') {
      return !global.isAdvancedExperienceMode();
    }
    return document.documentElement?.getAttribute('data-experience-mode') === 'basic';
  }

  function buildWizardStepBarMarkup(currentStep) {
    const basicMode = isBasicExperienceMode();
    const steps = basicMode
      ? [
          { number: 1, label: 'Quick Assessment', routeStep: 2 },
          { number: 2, label: 'Scenario', routeStep: 3 },
          { number: 3, label: 'Estimate', routeStep: 4 },
          { number: 4, label: 'Review & Run', routeStep: 5 }
        ]
      : [
          { number: 1, label: 'Guide', routeStep: 1 },
          { number: 2, label: 'Intake', routeStep: 2 },
          { number: 3, label: 'Scenario', routeStep: 3 },
          { number: 4, label: 'Estimate', routeStep: 4 },
          { number: 5, label: 'Review & Run', routeStep: 5 }
        ];
    const activeNumber = basicMode
      ? Math.max(1, steps.find(step => step.routeStep === currentStep)?.number || 1)
      : currentStep;
    const getStepClass = (stepNumber) => {
      if (stepNumber < activeNumber) return 'wizard-step wizard-step--complete';
      if (stepNumber === activeNumber) return 'wizard-step wizard-step--active';
      return 'wizard-step';
    };
    const activeStep = steps.find(step => step.number === activeNumber) || steps[0];
    return `<nav class="wizard-step-bar" aria-label="Assessment progress">
      <div class="wizard-step-bar__inner">
        <div class="wizard-step-bar__intro">
          <div class="wizard-step-bar__eyebrow">Assessment flow</div>
          <div class="wizard-step-bar__headline">${basicMode ? activeStep.label : `Step ${activeStep.number} of ${steps.length} · ${activeStep.label}`}</div>
        </div>
        <div class="wizard-step-track">
          ${steps.map((step, index) => `
            <div class="${getStepClass(step.number)}" data-step="${step.number}">
              <div class="wizard-step__dot">${step.number}</div>
              <div class="wizard-step__label">${step.label}</div>
            </div>
            ${index < steps.length - 1 ? '<div class="wizard-step-connector"></div>' : ''}
          `).join('')}
        </div>
      </div>
    </nav>`;
  }

  function getRoutePageClass(route = '') {
    const value = String(route || '');
    if (value.startsWith('/results')) return 'page--results';
    if (value.startsWith('/wizard')) return 'page--wizard';
    if (value.startsWith('/admin')) return 'page--admin';
    return 'page--dashboard';
  }

  function normaliseRouteValue(route = '') {
    const value = String(route || '').trim();
    if (!value) return '/';
    return value.startsWith('#') ? (value.slice(1) || '/') : value;
  }

  function getRouteSurface(route = '') {
    return getRoutePageClass(route).replace('page--', '');
  }

  function escapeShellText(value) {
    return UI.escapeHtml(value);
  }

  function resolveStageTransition(route = '', routeMeta = null) {
    const meta = routeMeta && typeof routeMeta === 'object' ? routeMeta : (window.__RISK_ROUTE_META__ || {});
    const currentRoute = normaliseRouteValue(route || meta.currentHash);
    const previousRoute = normaliseRouteValue(meta.previousHash);
    if (!previousRoute || previousRoute === currentRoute) {
      return String(meta.navigationKind || '').trim().toLowerCase() === 'refresh' ? 'pulse' : 'settle';
    }
    const currentWizardStep = getWizardStepNumber(currentRoute);
    const previousWizardStep = getWizardStepNumber(previousRoute);
    if (currentWizardStep && previousWizardStep) {
      if (currentWizardStep > previousWizardStep) return 'forward';
      if (currentWizardStep < previousWizardStep) return 'backward';
    }
    const currentSurface = getRouteSurface(currentRoute);
    const previousSurface = getRouteSurface(previousRoute);
    if (currentSurface !== previousSurface) {
      return currentSurface === 'results' ? 'lift' : 'crossfade';
    }
    return 'crossfade';
  }

  function buildStageAmbientMarkup(surface = 'dashboard') {
    return `<div class="app-stage__ambient app-stage__ambient--${escapeShellText(surface)}" aria-hidden="true">
      <div class="app-stage__mesh"></div>
      <div class="app-stage__beam app-stage__beam--primary"></div>
      <div class="app-stage__beam app-stage__beam--secondary"></div>
      <div class="app-stage__orbit app-stage__orbit--alpha"></div>
      <div class="app-stage__orbit app-stage__orbit--beta"></div>
      <div class="app-stage__telemetry app-stage__telemetry--primary"></div>
      <div class="app-stage__telemetry app-stage__telemetry--secondary"></div>
      <div class="app-stage__node-cluster">
        <span class="app-stage__node app-stage__node--1"></span>
        <span class="app-stage__node app-stage__node--2"></span>
        <span class="app-stage__node app-stage__node--3"></span>
      </div>
      <div class="app-stage__pulse"></div>
    </div>`;
  }

  function buildAgenticRailMarkup(model = null) {
    if (!model || !model.visible) return '';
    const metrics = Array.isArray(model.metrics)
      ? model.metrics.filter(item => item && String(item.value || '').trim()).slice(0, 3)
      : [];
    const notes = Array.isArray(model.notes)
      ? model.notes.filter(item => String(item || '').trim()).slice(0, 2)
      : [];
    const timeline = Array.isArray(model.timeline)
      ? model.timeline.filter(item => item && item.label).slice(0, 4)
      : [];
    const tone = String(model.statusTone || 'neutral').trim().toLowerCase() || 'neutral';
    const telemetrySource = Array.isArray(model.telemetryRows) && model.telemetryRows.length
      ? model.telemetryRows
      : [
          { label: 'Surface', value: model.routeLabel || 'workspace' },
          { label: 'State', value: model.statusLabel || model.workingCopy || 'tracking current state' },
          { label: 'Checkpoint', value: model.actionCopy || 'awaiting next decision' }
        ];
    const telemetryRows = telemetrySource
      .filter(item => item && String(item.value || '').trim())
      .slice(0, 3);
    return `<aside class="app-agent-rail" aria-label="Agent workspace">
      <div class="app-agent-rail__panel card card--elevated">
        <div class="app-agent-rail__live">
          <div class="app-agent-rail__live-core">
            <span class="app-agent-rail__live-dot" aria-hidden="true"></span>
            <span class="app-agent-rail__live-label">Agent loop active</span>
          </div>
          <div class="app-agent-rail__live-wave" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        <div class="app-agent-rail__head">
          <div class="app-agent-rail__head-copy">
            <div class="app-agent-rail__eyebrow">${escapeShellText(model.eyebrow || 'Agent workspace')}</div>
            <div class="app-agent-rail__route">${escapeShellText(model.routeLabel || 'Workspace')}</div>
          </div>
          <div class="app-agent-rail__head-status">
            <span class="app-agent-rail__status app-agent-rail__status--${escapeShellText(tone)}">${escapeShellText(model.statusLabel || 'Live')}</span>
          </div>
        </div>
        <p class="app-agent-rail__title">${escapeShellText(model.title || 'Risk scenario')}</p>
        <p class="app-agent-rail__goal">${escapeShellText(model.goal || 'Keep the current decision moving without losing context.')}</p>

        ${metrics.length ? `<div class="app-agent-rail__metrics">
          ${metrics.map(item => `<div class="app-agent-rail__metric">
            <span>${escapeShellText(item.label || 'Signal')}</span>
            <strong>${escapeShellText(item.value || '')}</strong>
          </div>`).join('')}
        </div>` : ''}

        ${telemetryRows.length ? `<section class="app-agent-rail__section app-agent-rail__section--telemetry">
          <div class="app-agent-rail__section-label">Live telemetry</div>
          <div class="app-agent-rail__telemetry-list">
            ${telemetryRows.map((item, index) => `<div class="app-agent-rail__telemetry-row">
              <div class="app-agent-rail__telemetry-copy">
                <strong>${escapeShellText(item.label || 'Signal')}</strong>
                <span>${escapeShellText(item.value || '')}</span>
              </div>
              <div class="app-agent-rail__telemetry-track" aria-hidden="true">
                <span style="--telemetry-index:${index + 1}"></span>
              </div>
            </div>`).join('')}
          </div>
        </section>` : ''}

        ${timeline.length ? `<section class="app-agent-rail__section">
          <div class="app-agent-rail__section-label">Run state</div>
          <div class="app-agent-rail__timeline">
            ${timeline.map(item => `<div class="app-agent-rail__timeline-item app-agent-rail__timeline-item--${escapeShellText(item.state || 'pending')}">
              <span class="app-agent-rail__timeline-dot" aria-hidden="true"></span>
              <div>
                <strong>${escapeShellText(item.label || 'Step')}</strong>
                <span>${escapeShellText(item.copy || '')}</span>
              </div>
            </div>`).join('')}
          </div>
        </section>` : ''}

        <section class="app-agent-rail__section">
          <div class="app-agent-rail__section-label">${escapeShellText(model.workingLabel || 'Working on')}</div>
          <p>${escapeShellText(model.workingCopy || 'Monitoring the current route state and carrying the latest context forward.')}</p>
        </section>

        <section class="app-agent-rail__section">
          <div class="app-agent-rail__section-label">${escapeShellText(model.waitingLabel || 'Waiting on you')}</div>
          <p>${escapeShellText(model.waitingCopy || 'Make the next high-value decision to keep the workflow moving.')}</p>
        </section>

        ${notes.length ? `<section class="app-agent-rail__section">
          <div class="app-agent-rail__section-label">Signal highlights</div>
          <div class="app-agent-rail__note-list">
            ${notes.map(note => `<div class="app-agent-rail__note">${escapeShellText(note)}</div>`).join('')}
          </div>
        </section>` : ''}

        <section class="app-agent-rail__section app-agent-rail__section--accent">
          <div class="app-agent-rail__section-label">${escapeShellText(model.actionLabel || 'Recommended next move')}</div>
          <p>${escapeShellText(model.actionCopy || 'Keep the current draft moving toward a clear decision.')}</p>
        </section>
      </div>
    </aside>`;
  }

  function buildStageMarkup(html, route = '', runtimeModel = null) {
    const surface = getRouteSurface(route);
    const transition = resolveStageTransition(route);
    const ambientMarkup = isBasicExperienceMode() ? '' : buildStageAmbientMarkup(surface);
    const hasRail = !!(runtimeModel && runtimeModel.visible);
    return `<div class="app-stage-shell app-stage-shell--${escapeShellText(surface)} app-stage-shell--${escapeShellText(transition)} app-stage-shell--entering${hasRail ? ' app-stage-shell--with-rail' : ''}" data-route-surface="${escapeShellText(surface)}" data-transition="${escapeShellText(transition)}">
      ${ambientMarkup}
      <div class="app-stage__content${hasRail ? ' app-stage__content--with-rail' : ''}">
        <div class="app-stage__page-slot">${html}</div>
        ${buildAgenticRailMarkup(runtimeModel)}
      </div>
    </div>`;
  }

  function ensureStageHost(root) {
    let stack = root.querySelector('.app-stage-stack');
    let notice = stack?.querySelector('#app-passive-state-notice') || null;
    let version = root.querySelector('.app-platform-version');
    if (stack && notice && version) return { stack, notice, version };
    root.innerHTML = `<div class="app-stage-stack"><div id="app-passive-state-notice"></div></div>
      <div class="app-platform-version" aria-label="Platform version">${PLATFORM_VERSION_LABEL}</div>`;
    stack = root.querySelector('.app-stage-stack');
    notice = stack.querySelector('#app-passive-state-notice');
    version = root.querySelector('.app-platform-version');
    return { stack, notice, version };
  }

  function runPageCleanupHandlers() {
    Array.from(pageCleanupHandlers).forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.warn('AppShellPage cleanup failed:', error);
      }
    });
    pageCleanupHandlers.clear();
  }

  const pageShell = {
    registerCleanup(handler) {
      if (typeof handler !== 'function') return () => {};
      pageCleanupHandlers.add(handler);
      return () => pageCleanupHandlers.delete(handler);
    },

    updateWizardProgressBar(step) {
      const bar = document.getElementById('app-bar');
      if (!bar) return;
      const route = String(step || '').trim();
      const isWizardRoute = route.startsWith('/wizard/');
      const existingBar = bar.querySelector('.wizard-step-bar');
      bar.style.setProperty('--wizard-progress', '0%');
      if (!isWizardRoute) {
        existingBar?.remove();
        bar.classList.remove('app-bar--wizard-steps');
        return;
      }
      const currentStep = getWizardStepNumber(route);
      bar.classList.add('app-bar--wizard-steps');
      const markup = buildWizardStepBarMarkup(currentStep);
      if (existingBar) {
        existingBar.outerHTML = markup;
        return;
      }
      const barInner = bar.querySelector('.bar-inner');
      if (barInner) {
        barInner.insertAdjacentHTML('afterend', markup);
        return;
      }
      bar.insertAdjacentHTML('beforeend', markup);
    },

    setPage(html) {
      const root = document.getElementById('main-content');
      if (!root) return;
      const route = normaliseRouteValue(window.location.hash || '/');
      const runtimeModel = typeof window.getAgenticShellModel === 'function'
        ? window.getAgenticShellModel(route)
        : null;
      runPageCleanupHandlers();
      const passiveNoticeMarkup = typeof window.buildPassiveStateNoticeMarkup === 'function'
        ? window.buildPassiveStateNoticeMarkup()
        : '';
      const { stack, notice } = ensureStageHost(root);
      notice.innerHTML = passiveNoticeMarkup;
      stack.style.setProperty('--app-passive-stack-height', `${notice.getBoundingClientRect().height || 0}px`);
      Array.from(stack.querySelectorAll('.app-stage-shell--exiting')).forEach(node => node.remove());
      const wrapper = document.createElement('div');
      wrapper.innerHTML = buildStageMarkup(html, route, runtimeModel);
      const nextStage = wrapper.firstElementChild;
      nextStage?.classList.add('is-current');
      const previousStage = stack.querySelector('.app-stage-shell.is-current') || null;
      let exitStage = null;
      const previousHeight = previousStage?.getBoundingClientRect?.().height || 0;
      if (previousStage) {
        exitStage = previousStage.cloneNode(true);
        exitStage.classList.remove('is-current', 'app-stage-shell--active', 'app-stage-shell--entering');
        exitStage.classList.add('app-stage-shell--exiting');
        exitStage.setAttribute('aria-hidden', 'true');
        if (exitStage.id) exitStage.removeAttribute('id');
        exitStage.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
        previousStage.remove();
        stack.appendChild(exitStage);
      }
      stack.appendChild(nextStage);
      const nextHeight = nextStage.getBoundingClientRect().height || 0;
      if (exitStage) {
        stack.style.minHeight = `${Math.max(previousHeight, nextHeight)}px`;
      }
      if (typeof window.refreshLiveTimestampNodes === 'function') {
        window.refreshLiveTimestampNodes(nextStage);
      }
      const routePageClass = getRoutePageClass(route);
      const pageNode = nextStage.querySelector('.page');
      if (pageNode) {
        pageNode.classList.remove('page--dashboard', 'page--wizard', 'page--results', 'page--admin');
        pageNode.classList.add(routePageClass);
      }
      const pageShellNode = nextStage.querySelector('.page, .dashboard-shell, .wizard-layout, .admin-shell');
      window.requestAnimationFrame(() => {
        nextStage.classList.add('app-stage-shell--active');
        if (pageShellNode) {
          pageShellNode.classList.add('page-enter-active');
          window.setTimeout(() => {
            pageShellNode.classList.remove('page-enter-active');
          }, 320);
        }
      });
      window.clearTimeout(stageTransitionTimer);
      stageTransitionTimer = window.setTimeout(() => {
        Array.from(stack.querySelectorAll('.app-stage-shell')).forEach(node => {
          if (!node.classList.contains('is-current')) node.remove();
        });
        stack.style.minHeight = '';
        stack.style.removeProperty('--app-passive-stack-height');
      }, STAGE_TRANSITION_MS);
      if (typeof bindDisclosureState === 'function') bindDisclosureState(nextStage);
      if (typeof applyPageNavigationEffects === 'function') applyPageNavigationEffects(nextStage);
      pageShell.updateWizardProgressBar(route);
      document.getElementById('boot-skeleton-nav')?.remove();
      document.getElementById('boot-skeleton-content')?.remove();
    }
  };

  global.AppShellPage = pageShell;
})(window);
