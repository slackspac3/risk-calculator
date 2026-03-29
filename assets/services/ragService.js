/**
 * ragService.js — Retrieval-Augmented Generation service stub
 * 
 * PoC: Uses simple keyword matching against local docs.json.
 * 
 * TODO: Replace with real vector search (Azure Cognitive Search,
 * or SharePoint Embedded vector store) for production.
 * [RAG-INTEGRATION] marks integration points.
 */

const RAGService = (() => {
  let _docs = [];
  let _buData = [];
  const LENS_TAGS = [
    'strategic',
    'operational',
    'cyber',
    'third-party',
    'regulatory',
    'financial',
    'esg',
    'compliance',
    'supply-chain',
    'procurement',
    'business-continuity',
    'hse'
  ];

  const TOPIC_RULES = [
    {
      key: 'privacy',
      patterns: ['privacy', 'personal data', 'pii', 'phi', 'data protection', 'gdpr', 'pdpl', 'data subject', 'biometric', 'health data'],
      docTags: ['privacy', 'data-protection', 'pims'],
      docIds: ['doc-iso27018-18', 'doc-iso27701-19', 'doc-data-05', 'doc-gdpr-06', 'doc-cls-07']
    },
    {
      key: 'business-continuity',
      patterns: ['business continuity', 'continuity', 'resilience', 'disruption', 'downtime', 'outage', 'disaster recovery', 'recovery'],
      docTags: ['business-continuity', 'resilience', 'bcp', 'dr'],
      docIds: ['doc-iso22301-20', 'doc-iso22313-21', 'doc-bcp-10']
    },
    {
      key: 'supply-chain',
      patterns: ['supplier', 'third-party', 'third party', 'vendor', 'supply chain', 'fourth party', 'outsourcing'],
      docTags: ['supply-chain', 'third-party', 'supplier', 'vendor'],
      docIds: ['doc-iso27036-22', 'doc-iso28000-23', 'doc-3p-08']
    },
    {
      key: 'risk-management',
      patterns: ['risk management', 'risk appetite', 'risk assessment', 'governance', 'rmf', 'nist', 'control baseline', 'enterprise risk'],
      docTags: ['risk-management', 'enterprise-risk', 'governance', 'controls', 'rmf', 'nist'],
      docIds: ['doc-nist-rmf-14', 'doc-nist-80053-13', 'doc-iso31000-24', 'doc-iso27005-16', 'doc-iso-02']
    },
    {
      key: 'cloud',
      patterns: ['cloud', 'tenant', 'saas', 'iac', 'public cloud', 'configuration drift'],
      docTags: ['cloud'],
      docIds: ['doc-cloud-04', 'doc-iso27017-17', 'doc-iso27018-18']
    }
  ];

  function init(docs, buData) {
    _docs = docs;
    _buData = buData;
  }

  function _queryIncludesAny(query, patterns = []) {
    const q = String(query || '').toLowerCase();
    return patterns.some(pattern => q.includes(String(pattern || '').toLowerCase()));
  }

  function _getMatchingLensTags(query = '') {
    const q = String(query || '').toLowerCase();
    const aliases = new Map([
      ['third-party', ['third-party', 'third party', 'vendor', 'supplier']],
      ['supply-chain', ['supply-chain', 'supply chain', 'logistics', 'inventory']],
      ['business-continuity', ['business-continuity', 'business continuity', 'continuity', 'recovery', 'disaster recovery', 'rto', 'rpo']],
      ['esg', ['esg', 'sustainability', 'climate']],
      ['hse', ['hse', 'health and safety', 'safety', 'environmental']],
      ['cyber', ['cyber', 'identity', 'phishing', 'ransomware', 'cloud', 'breach']],
      ['operational', ['operational', 'process failure', 'breakdown', 'service failure']],
      ['strategic', ['strategic', 'strategy', 'market', 'transformation']],
      ['regulatory', ['regulatory', 'regulator', 'licence', 'license', 'sanction', 'export control']],
      ['financial', ['financial', 'fraud', 'payment', 'treasury', 'capital']],
      ['compliance', ['compliance', 'non-compliance', 'policy breach', 'ethics']],
      ['procurement', ['procurement', 'sourcing', 'tender', 'bid', 'contract award']]
    ]);
    return LENS_TAGS.filter(tag => (aliases.get(tag) || [tag]).some(pattern => q.includes(pattern)));
  }

  function _classifyDocSource(doc) {
    const tags = Array.isArray(doc.tags) ? doc.tags.map(tag => String(tag || '').toLowerCase()) : [];
    const text = `${doc.title || ''} ${doc.url || ''} ${tags.join(' ')}`.toLowerCase();
    if (tags.includes('regulatory') || /pdpl|gdpr|regulat|authority|ministry|policy|law|nist|iso/.test(text)) return 'Standards / regulatory';
    if (tags.includes('all-bu') || tags.includes('internal') || /playbook|policy|framework|baseline|mapping|program|standard/.test(text)) return 'Internal reference';
    if (/news|reuters|bloomberg|forbes|cnbc|zawya|gulf|khaleej|arabianbusiness/.test(text)) return 'External source';
    return 'Reference source';
  }

  function _buildRelevanceReasons(doc, query, buId) {
    const tags = Array.isArray(doc.tags) ? doc.tags.map(tag => String(tag || '').toLowerCase()) : [];
    const reasons = [];
    const matchingLensTags = _getMatchingLensTags(query);
    const exactLensMatches = matchingLensTags.filter(tag => tags.includes(tag));
    if (exactLensMatches.length) {
      reasons.push(`Exact ${exactLensMatches[0].replace(/-/g, ' ')} lens match`);
    }
    TOPIC_RULES.forEach(rule => {
      if (!_queryIncludesAny(query, rule.patterns)) return;
      if ((rule.docIds || []).includes(doc.id) || (rule.docTags || []).some(tag => tags.includes(tag))) {
        reasons.push(`Matches ${rule.key.replace(/-/g, ' ')} context`);
      }
    });
    const bu = _buData.find(b => b.id === buId);
    if (bu && bu.docIds && bu.docIds.includes(doc.id)) {
      reasons.push('Mapped to the selected business unit');
    }
    if (Array.isArray(doc.buIds) && doc.buIds.includes(buId)) {
      reasons.push('Mapped to the selected business unit');
    }
    if ((doc.tags || []).includes('all-bu')) {
      reasons.push('Applies across the organisation');
    }
    if ((doc.tags || []).includes('nist') || (doc.tags || []).includes('iso')) {
      reasons.push('Recognised control or governance standard');
    }
    if (!reasons.length && tags.length) {
      reasons.push(`Relevant tags: ${tags.slice(0, 2).join(', ')}`);
    }
    return reasons.slice(0, 2);
  }

  function _topicBoost(doc, query) {
    const tags = Array.isArray(doc.tags) ? doc.tags.map(tag => String(tag || '').toLowerCase()) : [];
    let boost = 0;
    TOPIC_RULES.forEach(rule => {
      if (!_queryIncludesAny(query, rule.patterns)) return;
      if ((rule.docIds || []).includes(doc.id)) boost += 8;
      if ((rule.docTags || []).some(tag => tags.includes(tag))) boost += 5;
    });
    return boost;
  }

  function _sourcePriority(doc) {
    const label = _classifyDocSource(doc);
    if (label === 'Standards / regulatory') return 0;
    if (label === 'Internal reference') return 1;
    if (label === 'Reference source') return 2;
    return 3;
  }

  // Simple TF-IDF-like keyword scoring with topic-aware standard boosts
  function scoreDoc(doc, query, buId) {
    let score = 0;
    const q = query.toLowerCase();
    const words = q.split(/\W+/).filter(w => w.length > 3);
    const tags = Array.isArray(doc.tags) ? doc.tags.map(tag => String(tag || '').toLowerCase()) : [];
    const matchingLensTags = _getMatchingLensTags(query);

    const text = `${doc.title} ${doc.contentExcerpt || ''} ${doc.contentFull || ''} ${tags.join(' ')}`.toLowerCase();

    words.forEach(w => {
      const hits = (text.match(new RegExp(w, 'g')) || []).length;
      score += hits * 1.5;
    });

    const bu = _buData.find(b => b.id === buId);
    if (bu && bu.docIds && bu.docIds.includes(doc.id)) {
      score += 5;
    }

    const riskKeywords = ['breach', 'ransomware', 'phishing', 'attack', 'malware',
      'data', 'loss', 'incident', 'vulnerability', 'access', 'cloud', 'payment',
      'regulatory', 'compliance', 'third-party', 'insider', 'supply', 'privacy', 'continuity', 'resilience', 'risk'];
    riskKeywords.forEach(kw => {
      if (q.includes(kw) && tags.some(t => t.includes(kw.split('-')[0]))) {
        score += 3;
      }
    });

    // Keep the weighting modest: exact lens alignment should nudge ranking, not overwhelm textual relevance.
    matchingLensTags.forEach(tag => {
      if (tags.includes(tag)) score += 4;
    });

    score += _topicBoost(doc, query);

    if (tags.includes('all-bu')) score += 0.75;
    if (tags.includes('nist') || tags.includes('iso')) score += 0.5;

    const daysSince = (Date.now() - new Date(doc.lastUpdated).getTime()) / 86400000;
    score += Math.max(0, 1 - daysSince / 365);

    return score;
  }

  /**
   * Retrieve relevant docs for a BU + narrative query
   * [RAG-INTEGRATION] Replace with Azure Cognitive Search vector query
   */
  async function retrieveRelevantDocs(buId, query, topK = 4) {
    await _simulateLatency(400);

    const scored = _docs.map(doc => ({
      ...doc,
      _score: scoreDoc(doc, query, buId)
    }));

    scored.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      const sourceDiff = _sourcePriority(a) - _sourcePriority(b);
      if (sourceDiff !== 0) return sourceDiff;
      return new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime();
    });
    const results = scored.filter(d => d._score > 0).slice(0, Math.max(topK, 6));

    return results.slice(0, topK).map((d, index) => ({
      docId: d.id,
      title: d.title,
      url: d.url,
      excerpt: d.contentExcerpt,
      contentFull: index < 2
        ? (String(d.contentFull || '').trim() || '')
        : '',
      tags: d.tags,
      score: d._score,
      lastUpdated: d.lastUpdated,
      sourceType: _classifyDocSource(d),
      relevanceReason: _buildRelevanceReasons(d, query, buId).join(' · ')
    }));
  }

  /**
   * Get BU-specific docs
   */
  function getDocsForBU(buId) {
    const bu = _buData.find(b => b.id === buId);
    if (!bu) return [];
    return _docs.filter(d => bu.docIds && bu.docIds.includes(d.id));
  }

  function addDocument(doc) {
    if (!doc || !doc.id) return;
    const existing = _docs.findIndex(d => d.id === doc.id);
    const normalised = {
      id: String(doc.id || '').trim(),
      title: String(doc.title || '').trim(),
      url: String(doc.url || '').trim(),
      contentExcerpt: String(doc.contentExcerpt || doc.excerpt || '').slice(0, 500).trim(),
      contentFull: String(doc.contentFull || doc.content || doc.contentExcerpt || '').slice(0, 8000).trim(),
      tags: Array.isArray(doc.tags) ? doc.tags.map(String).filter(Boolean) : [],
      lastUpdated: doc.lastUpdated || new Date().toISOString(),
      buIds: Array.isArray(doc.buIds) ? doc.buIds : []
    };
    if (existing >= 0) {
      _docs[existing] = normalised;
    } else {
      _docs.push(normalised);
    }
  }

  function bulkAddDocuments(docs = []) {
    (Array.isArray(docs) ? docs : []).forEach(doc => addDocument(doc));
  }

  function _simulateLatency(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  return { init, retrieveRelevantDocs, getDocsForBU, addDocument, bulkAddDocuments };
})();
