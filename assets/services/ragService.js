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

    const text = `${doc.title} ${doc.contentExcerpt} ${doc.tags.join(' ')}`.toLowerCase();

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
      if (q.includes(kw) && doc.tags.some(t => t.includes(kw.split('-')[0]))) {
        score += 3;
      }
    });

    score += _topicBoost(doc, query);

    if ((doc.tags || []).includes('all-bu')) score += 0.75;
    if ((doc.tags || []).includes('nist') || (doc.tags || []).includes('iso')) score += 0.5;

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

    return results.slice(0, topK).map(d => ({
      docId: d.id,
      title: d.title,
      url: d.url,
      excerpt: d.contentExcerpt,
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

  function _simulateLatency(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  return { init, retrieveRelevantDocs, getDocsForBU };
})();
