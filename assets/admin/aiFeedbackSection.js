const AdminAiFeedbackSection = (() => {
  function escape(value = '') {
    return typeof escapeHtml === 'function' ? escapeHtml(value) : String(value || '');
  }

  function getTuning(settings = {}) {
    return typeof getAiFeedbackTuningSettings === 'function'
      ? getAiFeedbackTuningSettings(settings)
      : {
          alignmentPriority: 'strict',
          draftStyle: 'executive-brief',
          shortlistDiscipline: 'strict',
          learningSensitivity: 'balanced'
        };
  }

  function getDefaultTuning() {
    return {
      alignmentPriority: 'strict',
      draftStyle: 'executive-brief',
      shortlistDiscipline: 'strict',
      learningSensitivity: 'balanced'
    };
  }

  function getDashboardModel(settings = {}) {
    return typeof OrgIntelligenceService !== 'undefined' && OrgIntelligenceService && typeof OrgIntelligenceService.buildFeedbackDashboardModel === 'function'
      ? OrgIntelligenceService.buildFeedbackDashboardModel({}, settings)
      : {
          totalEvents: 0,
          liveAiEvents: 0,
          liveSharePct: 0,
          distinctUsers: 0,
          latestAt: 0,
          profile: {
            draft: { count: 0, averageScore: 0 },
            shortlist: { count: 0, averageScore: 0 },
            risk: { count: 0, averageScore: 0 },
            topPositiveRisks: [],
            topNegativeRisks: [],
            topPositiveDocs: [],
            topNegativeDocs: []
          },
          thresholds: {
            learningSensitivity: 'balanced',
            function: { minEvents: 3, minUsers: 2 },
            businessUnit: { minEvents: 4, minUsers: 2 },
            global: { minEvents: 8, minUsers: 4 }
          },
          runtimeBreakdown: [],
          lensBreakdown: [],
          functionBreakdown: [],
          businessUnitBreakdown: [],
          recentEvents: [],
          lowScoreLiveEvents: [],
          topIssues: []
        };
  }

  function formatAverage(bucket = {}) {
    return Number(bucket?.count || 0) ? `${Number(bucket.averageScore || 0).toFixed(1)} / 5` : 'No ratings yet';
  }

  function formatRelative(timestamp) {
    return typeof formatRelativePilotTime === 'function'
      ? formatRelativePilotTime(timestamp, 'No signal yet')
      : (timestamp ? 'Recently updated' : 'No signal yet');
  }

  function formatReasonLabel(reason = '') {
    const raw = String(reason || '').replace(/^(draft|shortlist):/, '').replace(/-/g, ' ').trim();
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Issue';
  }

  function renderMetricCard(label, value, foot = '') {
    return `<div class="admin-overview-card">
      <div class="admin-overview-label">${escape(label)}</div>
      <div class="admin-overview-value">${escape(value)}</div>
      <div class="admin-overview-foot">${escape(foot)}</div>
    </div>`;
  }

  function formatEventTarget(target = '') {
    const safe = String(target || '').trim().toLowerCase();
    if (safe === 'shortlist') return 'Shortlist';
    if (safe === 'risk') return 'Per-risk';
    return 'Draft';
  }

  function formatRuntimeMode(mode = '') {
    const safe = String(mode || '').trim().toLowerCase();
    if (safe === 'live_ai') return 'Live AI';
    if (safe === 'fallback') return 'Fallback';
    return 'Local';
  }

  function formatEventTimestamp(timestamp) {
    if (!timestamp) return 'Unknown time';
    try {
      return new Date(timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch {
      return 'Unknown time';
    }
  }

  function renderFeedbackEventList(events = [], { emptyLabel = 'No detailed feedback events yet.' } = {}) {
    if (!Array.isArray(events) || !events.length) {
      return `<div class="form-help">${escape(emptyLabel)}</div>`;
    }
    return `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">
      ${events.map((event) => {
        const reasons = Array.isArray(event.reasons) ? event.reasons : [];
        const citations = Array.isArray(event.citations) ? event.citations : [];
        return `<div style="padding:var(--sp-4);border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-canvas);display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:space-between;gap:var(--sp-3);align-items:flex-start;flex-wrap:wrap">
            <div>
              <div style="font-weight:700;color:var(--text-primary)">${escape(formatEventTarget(event.target))} · ${escape(`${Number(event.score || 0)} / 5`)}</div>
              <div class="form-help">${escape(formatEventTimestamp(event.recordedAt))} · ${escape(formatRuntimeMode(event.runtimeMode))} · ${escape(event.buName || 'Unscoped')} · ${escape(event.functionKey || 'general')}</div>
            </div>
            <div class="badge badge--neutral">${escape(String(event.lensKey || 'general').replace(/-/g, ' '))}</div>
          </div>
          ${event.riskTitle ? `<div><strong style="color:var(--text-primary)">Risk</strong><div class="form-help">${escape(event.riskTitle)}</div></div>` : ''}
          ${event.scenarioFingerprint ? `<div><strong style="color:var(--text-primary)">Scenario context</strong><div class="form-help">${escape(event.scenarioFingerprint)}</div></div>` : ''}
          ${(reasons.length || citations.length) ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
            ${reasons.map((reason) => `<span class="badge badge--neutral">${escape(formatReasonLabel(reason))}</span>`).join('')}
            ${citations.map((citation) => `<span class="badge badge--neutral">${escape(citation.title || citation.docId || 'Source')}</span>`).join('')}
          </div>` : ''}
          <div class="form-help">Submitted by ${escape(event.submittedBy || 'unknown')}.</div>
        </div>`;
      }).join('')}
    </div>`;
  }

  function renderBreakdownList(items = [], { emptyLabel = 'No signal yet', formatter = null } = {}) {
    if (!Array.isArray(items) || !items.length) {
      return `<div class="form-help">${escape(emptyLabel)}</div>`;
    }
    return `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">
      ${items.map((item) => {
        const value = typeof formatter === 'function'
          ? formatter(item)
          : `${Number(item.count || 0)} events · ${Number(item.averageScore || 0).toFixed(1)} / 5`;
        return `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-3);padding:var(--sp-3);border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-canvas)">
          <div>
            <div style="font-weight:700;color:var(--text-primary)">${escape(item.label || item.title || item.docId || 'Signal')}</div>
            <div class="form-help">${escape(value)}</div>
          </div>
          ${item.weight != null ? `<span class="badge badge--neutral">${escape(item.weight > 0 ? `+${Number(item.weight).toFixed(2)}` : Number(item.weight).toFixed(2))}</span>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }

  function renderImpactCards(tuning = {}) {
    const cards = [
      {
        title: 'Alignment priority',
        body: tuning.alignmentPriority === 'strict'
          ? 'Live AI treats event-path fidelity as the hard rule. Cloud, IT, or infrastructure language should not force cyber without explicit compromise evidence.'
          : 'Live AI still favours event-path fidelity, but it allows more adjacent-domain flexibility before it suppresses a candidate lens.'
      },
      {
        title: 'Draft style',
        body: tuning.draftStyle === 'executive-brief'
          ? 'Drafts are normalised toward a short management briefing: event, exposed area, primary driver, and consequence without taxonomy-heavy lead-ins.'
          : 'Drafts can remain slightly broader and more explanatory before the quality gate tightens them.'
      },
      {
        title: 'Shortlist discipline',
        body: tuning.shortlistDiscipline === 'strict'
          ? 'Recommended risks need to stay close to the same event tree and management discussion. Adjacent-domain suggestions are pushed into the secondary disclosure sooner.'
          : 'The shortlist stays more permissive, keeping more adjacent possibilities visible before the user narrows scope.'
      },
      {
        title: 'Learning sensitivity',
        body: tuning.learningSensitivity === 'accelerated'
          ? 'Live-AI feedback promotes into shared learning sooner, so function, BU, and global priors adapt faster.'
          : tuning.learningSensitivity === 'conservative'
            ? 'Shared learning waits for stronger corroboration, reducing the risk that a small sample shifts the platform too quickly.'
            : 'Shared learning uses the balanced thresholds currently recommended for pilot operation.'
      }
    ];
    return `<div class="help-mini-grid">
      ${cards.map((card) => `<div class="help-mini-card"><strong>${escape(card.title)}</strong><p>${escape(card.body)}</p></div>`).join('')}
    </div>`;
  }

  function buildSnapshot(settings = {}) {
    const tuning = getTuning(settings);
    const dashboard = getDashboardModel(settings);
    return {
      exportedAt: Date.now(),
      tuning,
      dashboard
    };
  }

  function renderSection({ settings }) {
    const tuning = getTuning(settings);
    const dashboard = getDashboardModel(settings);
    const profile = dashboard.profile || {};
    const liveTierSummary = dashboard.thresholds || {
      function: { minEvents: 3, minUsers: 2 },
      businessUnit: { minEvents: 4, minUsers: 2 },
      global: { minEvents: 8, minUsers: 4 }
    };
    const liveAiMeta = dashboard.liveAiEvents
      ? `${dashboard.liveAiEvents} live-AI event${dashboard.liveAiEvents === 1 ? '' : 's'}`
      : 'No live-AI signal yet';
    return renderSettingsSection({
      title: 'AI Feedback & Tuning',
      scope: 'admin-settings',
      open: true,
      description: 'Monitor how users rate generated drafts, shortlists, and individual risk cards, then tune alignment, writing quality, shortlist discipline, and shared-learning sensitivity without guessing.',
      meta: liveAiMeta,
      body: `<div class="admin-workbench-strip admin-workbench-strip--compact">
        <div>
          <div class="admin-workbench-strip__label">Measure first, tune second</div>
          <strong>Use live-AI signal as the primary quality input. Fallback guidance remains visible for continuity, but it should not drive shared tuning decisions.</strong>
          <span>The controls below adjust the live AI gate, shortlist selectivity, and how quickly repeated live-AI feedback promotes from user to shared tiers.</span>
        </div>
        <div class="flex items-center gap-3" style="flex-wrap:wrap">
          <button class="btn btn--secondary" id="btn-refresh-ai-feedback-dashboard" type="button">Refresh now</button>
          <button class="btn btn--ghost" id="btn-export-ai-feedback-dashboard" type="button">Export feedback snapshot</button>
          <button class="btn btn--ghost" id="btn-reset-ai-feedback-dashboard" type="button">Reset feedback &amp; tuning</button>
        </div>
      </div>
      <div class="admin-overview-grid" style="margin-top:var(--sp-4)">
        ${renderMetricCard('Feedback events', String(dashboard.totalEvents || 0), `Updated ${formatRelative(dashboard.latestAt)}`)}
        ${renderMetricCard('Live AI share', `${Number(dashboard.liveSharePct || 0).toFixed(1)}%`, `${dashboard.liveAiEvents || 0} of ${dashboard.totalEvents || 0} events`)}
        ${renderMetricCard('Draft quality', formatAverage(profile.draft), `${Number(profile.draft?.count || 0)} rating${Number(profile.draft?.count || 0) === 1 ? '' : 's'}`)}
        ${renderMetricCard('Shortlist quality', formatAverage(profile.shortlist), `${Number(profile.shortlist?.count || 0)} rating${Number(profile.shortlist?.count || 0) === 1 ? '' : 's'}`)}
        ${renderMetricCard('Per-risk quality', formatAverage(profile.risk), `${Number(profile.risk?.count || 0)} rating${Number(profile.risk?.count || 0) === 1 ? '' : 's'}`)}
        ${renderMetricCard('Distinct submitters', String(dashboard.distinctUsers || 0), 'Broader corroboration makes shared tuning safer')}
      </div>
      <div class="grid-2 mt-6">
        <div class="card card--elevated">
          <div class="context-panel-title">Tuning controls</div>
          <div class="context-panel-copy" style="margin-top:var(--sp-2)">These settings are saved with the normal platform settings flow. Change one parameter at a time, review downstream impact, then save.</div>
          <div class="grid-2" style="margin-top:var(--sp-4)">
            <div class="form-group">
              <label class="form-label" for="admin-ai-alignment-priority">Alignment priority</label>
              <select class="form-select" id="admin-ai-alignment-priority">
                <option value="strict" ${tuning.alignmentPriority === 'strict' ? 'selected' : ''}>Strict</option>
                <option value="balanced" ${tuning.alignmentPriority === 'balanced' ? 'selected' : ''}>Balanced</option>
              </select>
              <span class="form-help">Use strict to keep the event path above generic cloud, IT, profile, or compliance language.</span>
            </div>
            <div class="form-group">
              <label class="form-label" for="admin-ai-draft-style">Draft style</label>
              <select class="form-select" id="admin-ai-draft-style">
                <option value="executive-brief" ${tuning.draftStyle === 'executive-brief' ? 'selected' : ''}>Executive brief</option>
                <option value="balanced" ${tuning.draftStyle === 'balanced' ? 'selected' : ''}>Balanced</option>
              </select>
              <span class="form-help">Executive brief keeps the draft short, concrete, and management-readable.</span>
            </div>
            <div class="form-group">
              <label class="form-label" for="admin-ai-shortlist-discipline">Shortlist discipline</label>
              <select class="form-select" id="admin-ai-shortlist-discipline">
                <option value="strict" ${tuning.shortlistDiscipline === 'strict' ? 'selected' : ''}>Strict</option>
                <option value="balanced" ${tuning.shortlistDiscipline === 'balanced' ? 'selected' : ''}>Balanced</option>
              </select>
              <span class="form-help">Strict pushes adjacent-domain risks into the secondary disclosure sooner.</span>
            </div>
            <div class="form-group">
              <label class="form-label" for="admin-ai-learning-sensitivity">Learning sensitivity</label>
              <select class="form-select" id="admin-ai-learning-sensitivity">
                <option value="conservative" ${tuning.learningSensitivity === 'conservative' ? 'selected' : ''}>Conservative</option>
                <option value="balanced" ${tuning.learningSensitivity === 'balanced' ? 'selected' : ''}>Balanced</option>
                <option value="accelerated" ${tuning.learningSensitivity === 'accelerated' ? 'selected' : ''}>Accelerated</option>
              </select>
              <span class="form-help">Only repeated live-AI signals promote upward. This control changes how much corroboration is required.</span>
            </div>
          </div>
        </div>
        <div class="card card--elevated">
          <div class="context-panel-title">Current tuning impact</div>
          <div class="context-panel-copy" style="margin-top:var(--sp-2)">This is how the current admin policy is shaping the live Step 1 AI path and shared-learning thresholds.</div>
          <div style="margin-top:var(--sp-4)">${renderImpactCards(tuning)}</div>
        </div>
      </div>
      <div class="grid-2 mt-6">
        <div class="card card--elevated">
          <div class="context-panel-title">Shared-learning thresholds</div>
          <div class="context-panel-copy" style="margin-top:var(--sp-2)">These thresholds only apply to repeated live-AI feedback when the same pattern shows up across multiple users.</div>
          <div class="admin-overview-grid" style="margin-top:var(--sp-4)">
            ${renderMetricCard('Function tier', `${liveTierSummary.function.minEvents} events`, `${liveTierSummary.function.minUsers} distinct users needed`)}
            ${renderMetricCard('BU tier', `${liveTierSummary.businessUnit.minEvents} events`, `${liveTierSummary.businessUnit.minUsers} distinct users needed`)}
            ${renderMetricCard('Global tier', `${liveTierSummary.global.minEvents} events`, `${liveTierSummary.global.minUsers} distinct users needed`)}
          </div>
        </div>
        <div class="card card--elevated">
          <div class="context-panel-title">Top review issues</div>
          <div class="context-panel-copy" style="margin-top:var(--sp-2)">These are the most common reasons users gave when they marked generated output as weak.</div>
          <div style="margin-top:var(--sp-4)">
            ${renderBreakdownList(dashboard.topIssues, {
              emptyLabel: 'No reason-tag signal yet.',
              formatter: (item) => `${Number(item.count || 0)} rating${Number(item.count || 0) === 1 ? '' : 's'}`
            })}
          </div>
        </div>
      </div>
      <div class="grid-2 mt-6">
        <div class="card card--elevated">
          <div class="context-panel-title">Where feedback is landing</div>
          <div class="context-panel-copy" style="margin-top:var(--sp-2)">Use this to see whether the signal is concentrated in one lens, function, business unit, or runtime mode.</div>
          <div class="grid-2" style="margin-top:var(--sp-4)">
            <div>
              <div class="form-help" style="margin-bottom:var(--sp-2)">Runtime mix</div>
              ${renderBreakdownList(dashboard.runtimeBreakdown, { emptyLabel: 'No runtime signal yet.', formatter: (item) => `${item.count} event${item.count === 1 ? '' : 's'}` })}
            </div>
            <div>
              <div class="form-help" style="margin-bottom:var(--sp-2)">Top lenses</div>
              ${renderBreakdownList(dashboard.lensBreakdown, { emptyLabel: 'No lens breakdown yet.' })}
            </div>
            <div>
              <div class="form-help" style="margin-bottom:var(--sp-2)">Top functions</div>
              ${renderBreakdownList(dashboard.functionBreakdown, { emptyLabel: 'No function breakdown yet.' })}
            </div>
            <div>
              <div class="form-help" style="margin-bottom:var(--sp-2)">Top business units</div>
              ${renderBreakdownList(dashboard.businessUnitBreakdown, { emptyLabel: 'No BU breakdown yet.' })}
            </div>
          </div>
        </div>
        <div class="card card--elevated">
          <div class="context-panel-title">What the system is learning</div>
          <div class="context-panel-copy" style="margin-top:var(--sp-2)">These weighted lists come from repeated live-AI feedback, not from fallback-mode ratings.</div>
          <div class="grid-2" style="margin-top:var(--sp-4)">
            <div>
              <div class="form-help" style="margin-bottom:var(--sp-2)">Most reinforced risks</div>
              ${renderBreakdownList(profile.topPositiveRisks, {
                emptyLabel: 'No reinforced risk pattern yet.',
                formatter: (item) => `Weight ${Number(item.weight || 0).toFixed(2)}`
              })}
            </div>
            <div>
              <div class="form-help" style="margin-bottom:var(--sp-2)">Most suppressed risks</div>
              ${renderBreakdownList(profile.topNegativeRisks, {
                emptyLabel: 'No suppressed risk pattern yet.',
                formatter: (item) => `Weight ${Number(item.weight || 0).toFixed(2)}`
              })}
            </div>
            <div>
              <div class="form-help" style="margin-bottom:var(--sp-2)">Most reinforced sources</div>
              ${renderBreakdownList(profile.topPositiveDocs, {
                emptyLabel: 'No reinforced document pattern yet.',
                formatter: (item) => `Weight ${Number(item.weight || 0).toFixed(2)}`
              })}
            </div>
            <div>
              <div class="form-help" style="margin-bottom:var(--sp-2)">Most suppressed sources</div>
              ${renderBreakdownList(profile.topNegativeDocs, {
                emptyLabel: 'No suppressed document pattern yet.',
                formatter: (item) => `Weight ${Number(item.weight || 0).toFixed(2)}`
              })}
            </div>
          </div>
        </div>
      </div>`
      + `<div class="card card--elevated mt-6">
        <div class="context-panel-title">Drill into recent signal</div>
        <div class="context-panel-copy" style="margin-top:var(--sp-2)">Inspect recent shared events before you change a tuning control. These details stay bounded to the admin workbench and do not create a new inference path.</div>
        <div style="display:flex;flex-direction:column;gap:var(--sp-3);margin-top:var(--sp-4)">
          <details class="wizard-disclosure" open>
            <summary>Recent feedback events <span class="badge badge--neutral">${Number((dashboard.recentEvents || []).length || 0)}</span></summary>
            <div class="wizard-disclosure-body">${renderFeedbackEventList(dashboard.recentEvents, { emptyLabel: 'No recent feedback events yet.' })}</div>
          </details>
          <details class="wizard-disclosure">
            <summary>Low-scoring live-AI events <span class="badge badge--neutral">${Number((dashboard.lowScoreLiveEvents || []).length || 0)}</span></summary>
            <div class="wizard-disclosure-body">${renderFeedbackEventList(dashboard.lowScoreLiveEvents, { emptyLabel: 'No low-scoring live-AI events yet.' })}</div>
          </details>
        </div>
      </div>`
    });
  }

  function bind({ settings, rerenderCurrentAdminSection }) {
    document.getElementById('btn-refresh-ai-feedback-dashboard')?.addEventListener('click', async () => {
      const button = document.getElementById('btn-refresh-ai-feedback-dashboard');
      button.disabled = true;
      button.textContent = 'Refreshing…';
      try {
        if (typeof OrgIntelligenceService !== 'undefined' && OrgIntelligenceService && typeof OrgIntelligenceService.refresh === 'function') {
          await OrgIntelligenceService.refresh(true);
        }
        rerenderCurrentAdminSection();
        UI.toast('AI feedback signals refreshed.', 'success');
      } catch (error) {
        console.error('AdminAiFeedbackSection refresh failed:', error);
        UI.toast('The feedback dashboard could not be refreshed right now.', 'warning');
      } finally {
        button.disabled = false;
        button.textContent = 'Refresh now';
      }
    });

    document.getElementById('btn-export-ai-feedback-dashboard')?.addEventListener('click', () => {
      try {
        if (typeof ExportService !== 'undefined' && ExportService && typeof ExportService.exportDataAsJson === 'function') {
          ExportService.exportDataAsJson(buildSnapshot(settings), 'risk-calculator-ai-feedback-snapshot.json');
          UI.toast('AI feedback snapshot exported.', 'success');
        }
      } catch (error) {
        console.error('AdminAiFeedbackSection export failed:', error);
        UI.toast('The feedback snapshot could not be exported right now.', 'warning');
      }
    });

    document.getElementById('btn-reset-ai-feedback-dashboard')?.addEventListener('click', async () => {
      const confirmed = typeof confirmDestructiveAction === 'function'
        ? await confirmDestructiveAction({
            title: 'Reset platform AI feedback and tuning?',
            body: 'This clears the shared AI feedback history shown in this dashboard, removes saved user-tier AI feedback signals from user workspaces across the platform, and resets the AI tuning controls to their default values. It does not delete assessments or analyst-only notes.',
            confirmLabel: 'Reset feedback and tuning'
          })
        : await UI.confirm('Reset platform AI feedback and tuning? This clears shared feedback history, removes saved user-tier AI feedback signals, and returns the tuning controls to defaults.');
      if (!confirmed) return;
      const button = document.getElementById('btn-reset-ai-feedback-dashboard');
      if (button) {
        button.disabled = true;
        button.textContent = 'Resetting…';
      }
      try {
        const currentSettings = typeof getAdminSettings === 'function' ? getAdminSettings() : (settings || {});
        const nextSettings = JSON.parse(JSON.stringify(currentSettings || {}));
        nextSettings.aiFeedbackTuning = getDefaultTuning();
        const saved = typeof saveAdminSettings === 'function'
          ? await saveAdminSettings(nextSettings, {
              audit: {
                category: 'settings',
                eventType: 'ai_feedback_tuning_reset',
                target: 'ai_feedback_tuning'
              }
            })
          : false;
        if (!saved) {
          UI.toast('The tuning controls could not be reset right now.', 'warning');
          return;
        }
        const resetFeedback = typeof OrgIntelligenceService !== 'undefined'
          && OrgIntelligenceService
          && typeof OrgIntelligenceService.resetAiFeedback === 'function'
          ? await OrgIntelligenceService.resetAiFeedback({ includeUserTier: true })
          : false;
        rerenderCurrentAdminSection();
        if (!resetFeedback) {
          UI.toast('Tuning reset to defaults, but platform AI feedback could not be cleared right now.', 'warning', 5000);
          return;
        }
        const failedUsers = Array.isArray(resetFeedback.userTierReset?.failedUsers) ? resetFeedback.userTierReset.failedUsers : [];
        if (failedUsers.length) {
          UI.toast(`Tuning reset to defaults, but ${failedUsers.length} user workspace ${failedUsers.length === 1 ? 'signal reset failed' : 'signal resets failed'}.`, 'warning', 5000);
          return;
        }
        const clearedUsers = Number(resetFeedback.userTierReset?.clearedUsers || 0);
        UI.toast(clearedUsers
          ? `AI feedback and tuning reset across ${clearedUsers} user ${clearedUsers === 1 ? 'workspace' : 'workspaces'}.`
          : 'AI feedback and tuning reset.', 'success');
      } catch (error) {
        console.error('AdminAiFeedbackSection reset failed:', error);
        UI.toast('The feedback reset could not be completed right now.', 'warning');
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = 'Reset feedback & tuning';
        }
      }
    });
  }

  return { renderSection, bind };
})();
