const AiTraceRuntime = (() => {
  function safeTraceText(value = '', maxChars = 16000) {
    return String(value || '').trim().slice(0, Math.max(0, Number(maxChars || 0) || 0));
  }

  function normaliseTraceSources(sources = []) {
    return (Array.isArray(sources) ? sources : [])
      .filter(Boolean)
      .map((item) => ({
        title: safeTraceText(item?.title || item?.label || item?.sourceTitle || 'Untitled source', 160),
        url: safeTraceText(item?.url || '', 400),
        sourceType: safeTraceText(item?.sourceType || '', 80),
        relevanceReason: safeTraceText(item?.relevanceReason || '', 240)
      }))
      .filter((item) => item.title);
  }

  function createRuntime({ traceLimit = 20 } = {}) {
    const resolvedTraceLimit = Math.max(1, Number(traceLimit || 20));
    let traceEntries = [];

    function readEntries() {
      return Array.isArray(traceEntries) ? traceEntries.slice() : [];
    }

    function writeEntries(entries = []) {
      traceEntries = (Array.isArray(entries) ? entries : [])
        .filter(Boolean)
        .slice(-resolvedTraceLimit);
    }

    function storeEntry({ label = '', promptSummary = '', response = '', sources = [] } = {}) {
      const safeLabel = String(label || '').trim();
      if (!safeLabel) return null;
      const entry = {
        id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label: safeLabel,
        timestamp: Date.now(),
        promptSummary: safeTraceText(promptSummary, 12000),
        response: safeTraceText(response, 20000),
        sources: normaliseTraceSources(sources)
      };
      const next = readEntries();
      next.push(entry);
      if (next.length > resolvedTraceLimit) {
        next.splice(0, next.length - resolvedTraceLimit);
      }
      writeEntries(next);
      return entry;
    }

    function resolveTraceSources(options = {}) {
      const explicitSources = normaliseTraceSources(options.traceSources || []);
      if (explicitSources.length) return explicitSources;
      try {
        const windowSources = typeof window !== 'undefined' ? window._lastRagSources : [];
        return normaliseTraceSources(windowSources || []);
      } catch {
        return [];
      }
    }

    function buildPromptSummary(promptPayload = {}) {
      const priorMessages = Array.isArray(promptPayload.priorMessages) ? promptPayload.priorMessages : [];
      const priorSummary = priorMessages.length
        ? `Prior messages: ${priorMessages.map((item) => `${item.role}: ${item.content}`).join(' | ')}`
        : '';
      return safeTraceText([
        `System: ${promptPayload.systemPrompt || ''}`,
        priorSummary,
        `User: ${promptPayload.userPrompt || ''}`
      ].filter(Boolean).join('\n\n'), 12000);
    }

    function getLatestTrace(label = '') {
      const safeLabel = String(label || '').trim();
      const entries = readEntries();
      if (!safeLabel) return entries[entries.length - 1] || null;
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        if (String(entries[index]?.label || '').trim() === safeLabel) {
          return entries[index];
        }
      }
      return null;
    }

    return {
      readEntries,
      writeEntries,
      storeEntry,
      resolveTraceSources,
      buildPromptSummary,
      getLatestTrace
    };
  }

  return {
    createRuntime
  };
})();
