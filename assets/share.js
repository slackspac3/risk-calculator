/**
 * share.js — Results sharing via URL-encoded state
 *
 * Encodes a compressed assessment summary into the URL hash so
 * colleagues can open a read-only results view directly.
 *
 * Approach: JSON → base64 encode → append to hash as ?share=<base64>
 * No server required. Works on GitHub Pages and SharePoint embeds.
 *
 * Size limit: browsers support ~2000 chars in URL. We store only
 * the results + metadata, not full fairParams, to stay under limit.
 */

const ShareService = (() => {

  // Fields included in the shareable payload (keep small)
  const SHARE_FIELDS = [
    'id', 'scenarioTitle', 'buName', 'narrative',
    'structuredScenario', 'citations', 'recommendations',
    'completedAt', 'results', 'lifecycleStatus', 'comparisonBaselineId'
  ];

  function _pick(obj, keys) {
    const out = {};
    keys.forEach(k => { if (obj[k] !== undefined) out[k] = obj[k]; });
    return out;
  }

  function buildSharePayload(assessment) {
    if (!assessment || typeof assessment !== 'object') return null;
    const payload = _pick(assessment, SHARE_FIELDS);
    const resolvedScenarioTitle = typeof resolveScenarioDisplayTitle === 'function'
      ? resolveScenarioDisplayTitle({
          ...assessment,
          narrative: String(assessment?.narrative || '').trim(),
          enhancedNarrative: String(assessment?.enhancedNarrative || assessment?.narrative || '').trim()
        })
      : String(payload.scenarioTitle || '').trim();
    const currentNarrative = String(assessment?.enhancedNarrative || assessment?.narrative || payload.narrative || '').trim();
    if (resolvedScenarioTitle) payload.scenarioTitle = resolvedScenarioTitle;
    if (currentNarrative) payload.narrative = currentNarrative;

    if (payload.results) {
      payload.results = {
        lm: payload.results.lm,
        ale: payload.results.ale,
        toleranceBreached: payload.results.toleranceBreached,
        toleranceDetail: payload.results.toleranceDetail,
        threshold: payload.results.threshold,
        iterations: payload.results.iterations,
        histogram: payload.results.histogram?.slice(0, 40),
        lec: payload.results.lec?.slice(0, 50)
      };
    }
    if (payload.recommendations?.length > 6) {
      payload.recommendations = payload.recommendations.slice(0, 6);
    }
    if (payload.citations?.length > 5) {
      payload.citations = payload.citations.slice(0, 5);
    }
    if (payload.narrative?.length > 500) {
      payload.narrative = payload.narrative.substring(0, 500) + '…';
    }

    return payload;
  }

  /**
   * Generate a shareable URL for an assessment
   */
  function generateShareURL(assessment) {
    const payload = buildSharePayload(assessment);
    if (!payload?.id) return null;

    try {
      const json = JSON.stringify(payload);
      const encoded = btoa(unescape(encodeURIComponent(json)));
      const base = window.location.href.split('#')[0];
      return `${base}#/results/${payload.id}?share=${encoded}`;
    } catch (e) {
      console.error('ShareService: encode failed', e);
      return null;
    }
  }

  /**
   * Parse a shared payload from the current URL hash
   * Returns assessment object or null
   */
  function parseShareFromURL() {
    const hash = window.location.hash;
    const match = hash.match(/[?&]share=([^&]+)/);
    if (!match) return null;
    try {
      const json = decodeURIComponent(escape(atob(match[1])));
      return JSON.parse(json);
    } catch (e) {
      console.error('ShareService: decode failed', e);
      return null;
    }
  }

  /**
   * Copy share URL to clipboard and show toast
   */
  async function copyShareLink(assessment) {
    const url = generateShareURL(assessment);
    if (!url) {
      UI.toast('Could not generate share link — results may be too large.', 'danger');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      UI.toast('Share link copied to clipboard. Send to colleagues — no login required.', 'success', 5000);
    } catch {
      // Fallback: show in modal
      UI.modal({
        title: 'Share Results Link',
        body: `<p style="margin-bottom:12px;font-size:.85rem;color:var(--text-secondary)">Copy this link and share with colleagues. They can open it directly in their browser — no login or account needed.</p>
          <textarea class="form-textarea" style="font-family:var(--font-mono);font-size:.75rem" rows="4" readonly onclick="this.select()">${url}</textarea>`
      });
    }
  }

  return { buildSharePayload, generateShareURL, parseShareFromURL, copyShareLink };
})();
