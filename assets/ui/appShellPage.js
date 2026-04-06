(function(global) {
  'use strict';

  const PLATFORM_VERSION_LABEL = 'Risk Intelligence Engine v0.8';
  const pageCleanupHandlers = new Set();

  function getWizardStepNumber(route = '') {
    const value = String(route || '').trim();
    const match = value.match(/^\/wizard\/([1-4])(?:$|[/?#])/);
    if (match) return Number(match[1]);
    if (value === '/wizard/review') return 4;
    return 0;
  }

  function buildWizardStepBarMarkup(currentStep) {
    const steps = [
      { number: 1, label: 'Risks' },
      { number: 2, label: 'Scenario' },
      { number: 3, label: 'Estimate' },
      { number: 4, label: 'Run Model' }
    ];
    const getStepClass = (stepNumber) => {
      if (stepNumber < currentStep) return 'wizard-step wizard-step--complete';
      if (stepNumber === currentStep) return 'wizard-step wizard-step--active';
      return 'wizard-step';
    };
    const activeStep = steps.find(step => step.number === currentStep) || steps[0];
    return `<nav class="wizard-step-bar" aria-label="Assessment progress">
      <div class="wizard-step-bar__inner">
        <div class="wizard-step-bar__intro">
          <div class="wizard-step-bar__eyebrow">Assessment flow</div>
          <div class="wizard-step-bar__headline">Step ${activeStep.number} of ${steps.length} · ${activeStep.label}</div>
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
      runPageCleanupHandlers();
      root.innerHTML = `${html}
        <div class="app-platform-version" aria-label="Platform version">${PLATFORM_VERSION_LABEL}</div>`;
      const routePageClass = getRoutePageClass(window.location.hash.replace('#', ''));
      const pageNode = root.querySelector('.page');
      if (pageNode) {
        pageNode.classList.remove('page--dashboard', 'page--wizard', 'page--results', 'page--admin');
        pageNode.classList.add(routePageClass);
      }
      // Route transitions were handled ad hoc in app.js; centralising the page mount keeps polish logic in one place.
      const pageShellNode = root.querySelector('.page, .dashboard-shell, .wizard-layout, .admin-shell');
      if (pageShellNode) {
        window.requestAnimationFrame(() => {
          pageShellNode.classList.add('page-enter-active');
          window.setTimeout(() => {
            pageShellNode.classList.remove('page-enter-active');
          }, 280);
        });
      }
      if (typeof bindDisclosureState === 'function') bindDisclosureState(root);
      if (typeof applyPageNavigationEffects === 'function') applyPageNavigationEffects(root);
      pageShell.updateWizardProgressBar(window.location.hash.replace('#', ''));
      document.getElementById('boot-skeleton-nav')?.remove();
      document.getElementById('boot-skeleton-content')?.remove();
    }
  };

  global.AppShellPage = pageShell;
})(window);
