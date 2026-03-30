/**
 * ragService.js — Retrieval-Augmented Generation service
 *
 * PoC: still local-file based, but now uses concept expansion and
 * semantic-style overlap scoring rather than pure literal keyword hits.
 *
 * TODO: Replace with real vector search (Azure Cognitive Search,
 * or SharePoint Embedded vector store) for production.
 * [RAG-INTEGRATION] marks integration points.
 */

const RAGService = (() => {
  let _docs = [];
  let _buData = [];
  let _indexedDocs = [];

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

  const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have',
    'if', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'their',
    'them', 'there', 'this', 'to', 'with', 'within', 'would', 'could', 'should',
    'after', 'before', 'under', 'over', 'than', 'then', 'when', 'while', 'your'
  ]);

  const CONCEPT_RULES = [
    {
      key: 'procurement-governance',
      patterns: ['procurement', 'sourcing', 'tender', 'bid', 'bid rigging', 'contract award', 'supplier selection', 'purchasing', 'purchase order'],
      docTags: ['procurement', 'sourcing', 'governance', 'compliance'],
      docIds: ['doc-iso20400-29', 'doc-uncitral-proc-46', 'doc-worldbank-proc-47', 'doc-iso37001-57']
    },
    {
      key: 'supply-chain-dependency',
      patterns: ['supply chain', 'sub-tier', 'sub tier', 'upstream', 'logistics', 'inventory', 'shipment', 'single source', 'sole source', 'concentration risk'],
      docTags: ['supply-chain', 'third-party', 'procurement', 'business-continuity'],
      docIds: ['doc-3p-08', 'doc-iso28000-23', 'doc-nist-800161-53', 'doc-worldbank-proc-47']
    },
    {
      key: 'human-rights-diligence',
      patterns: ['human rights', 'modern slavery', 'forced labour', 'forced labor', 'exploitative labour', 'exploitative labor', 'child labour', 'child labor', 'labour practices', 'labor practices', 'worker welfare'],
      docTags: ['human-rights', 'procurement', 'supply-chain', 'esg', 'compliance'],
      docIds: ['doc-oecd-rbc-48', 'doc-ungp-49', 'doc-iso20400-29', 'doc-ilo-osh-54']
    },
    {
      key: 'anti-bribery-integrity',
      patterns: ['bribery', 'corruption', 'kickback', 'kick back', 'collusion', 'conflict of interest', 'facilitation payment'],
      docTags: ['compliance', 'procurement', 'anti-bribery', 'governance'],
      docIds: ['doc-iso37001-57', 'doc-worldbank-proc-47', 'doc-uncitral-proc-46']
    },
    {
      key: 'business-continuity-crisis',
      patterns: ['business continuity', 'continuity', 'crisis management', 'recovery', 'downtime', 'outage', 'incident communications', 'emergency response'],
      docTags: ['business-continuity', 'resilience', 'crisis-management', 'operational'],
      docIds: ['doc-bcp-10', 'doc-iso22301-20', 'doc-iso22313-21', 'doc-nfpa1600-32', 'doc-iso22361-51']
    },
    {
      key: 'hse-incident',
      patterns: ['health and safety', 'worker safety', 'contractor safety', 'injury', 'fatality', 'near miss', 'spill', 'environmental release', 'hazard', 'site shutdown'],
      docTags: ['hse', 'environment', 'health-safety', 'operations', 'business-continuity'],
      docIds: ['doc-iso45001-30', 'doc-iso14001-31', 'doc-abu-dhabi-ehsms-44', 'doc-uae-fire-life-45', 'doc-ilo-osh-54']
    },
    {
      key: 'sustainability-disclosure',
      patterns: ['esg', 'sustainability', 'climate', 'emissions', 'scope 1', 'scope 2', 'scope 3', 'greenwashing', 'transition plan', 'nature-related'],
      docTags: ['esg', 'sustainability', 'reporting', 'environment', 'strategic'],
      docIds: ['doc-ifrs-s1s2-27', 'doc-gri-28', 'doc-csrd-esrs-36', 'doc-sasb-55', 'doc-tnfd-56']
    },
    {
      key: 'financial-control',
      patterns: ['invoice fraud', 'payment fraud', 'treasury', 'liquidity', 'financial control', 'financial reporting', 'misstatement', 'journal entry', 'revenue recognition'],
      docTags: ['financial', 'compliance', 'controls', 'governance', 'data'],
      docIds: ['doc-coso-ic-33', 'doc-bcbs239-41']
    },
    {
      key: 'ot-resilience',
      patterns: ['operational technology', 'industrial control', 'ics', 'scada', 'plant network', 'site systems', 'ot security'],
      docTags: ['operational', 'cyber', 'hse', 'facilities', 'business-continuity'],
      docIds: ['doc-iec62443-52', 'doc-uae-fire-life-45']
    },
    {
      key: 'risk-method',
      patterns: ['risk assessment', 'risk techniques', 'risk method', 'control baseline', 'enterprise risk', 'scenario analysis'],
      docTags: ['risk-management', 'enterprise-risk', 'governance', 'controls'],
      docIds: ['doc-iso31000-24', 'doc-coso-erm-25', 'doc-iso31010-50', 'doc-nist-rmf-14']
    }
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
      patterns: ['business continuity', 'continuity', 'resilience', 'disruption', 'downtime', 'outage', 'disaster recovery', 'recovery', 'crisis management'],
      docTags: ['business-continuity', 'resilience', 'bcp', 'dr', 'crisis-management'],
      docIds: ['doc-iso22301-20', 'doc-iso22313-21', 'doc-bcp-10', 'doc-nfpa1600-32', 'doc-iso22361-51']
    },
    {
      key: 'supply-chain',
      patterns: ['supplier', 'third-party', 'third party', 'vendor', 'supply chain', 'sub-tier', 'single source', 'fourth party', 'outsourcing', 'logistics'],
      docTags: ['supply-chain', 'third-party', 'supplier', 'vendor', 'procurement'],
      docIds: ['doc-iso27036-22', 'doc-iso28000-23', 'doc-3p-08', 'doc-nist-800161-53']
    },
    {
      key: 'procurement',
      patterns: ['procurement', 'sourcing', 'tender', 'bid', 'contract award', 'supplier selection', 'collusion', 'kickback'],
      docTags: ['procurement', 'sourcing', 'governance', 'anti-bribery'],
      docIds: ['doc-iso20400-29', 'doc-worldbank-proc-47', 'doc-uncitral-proc-46', 'doc-iso37001-57']
    },
    {
      key: 'human-rights',
      patterns: ['human rights', 'forced labour', 'forced labor', 'modern slavery', 'exploitative labour', 'exploitative labor', 'worker welfare', 'child labour', 'child labor'],
      docTags: ['human-rights', 'esg', 'procurement', 'supply-chain', 'compliance'],
      docIds: ['doc-oecd-rbc-48', 'doc-ungp-49', 'doc-ilo-osh-54', 'doc-iso20400-29']
    },
    {
      key: 'esg',
      patterns: ['esg', 'sustainability', 'climate', 'emissions', 'greenwashing', 'transition', 'disclosure', 'nature-related'],
      docTags: ['esg', 'sustainability', 'reporting', 'environment'],
      docIds: ['doc-ifrs-s1s2-27', 'doc-gri-28', 'doc-csrd-esrs-36', 'doc-sasb-55', 'doc-tnfd-56']
    },
    {
      key: 'hse',
      patterns: ['hse', 'health and safety', 'worker safety', 'contractor safety', 'injury', 'spill', 'hazard', 'environmental'],
      docTags: ['hse', 'environment', 'health-safety', 'operations'],
      docIds: ['doc-iso45001-30', 'doc-iso14001-31', 'doc-abu-dhabi-ehsms-44', 'doc-uae-fire-life-45', 'doc-ilo-osh-54']
    },
    {
      key: 'risk-management',
      patterns: ['risk management', 'risk appetite', 'risk assessment', 'governance', 'rmf', 'nist', 'control baseline', 'enterprise risk'],
      docTags: ['risk-management', 'enterprise-risk', 'governance', 'controls', 'rmf', 'nist'],
      docIds: ['doc-nist-rmf-14', 'doc-nist-80053-13', 'doc-iso31000-24', 'doc-iso27005-16', 'doc-iso-02', 'doc-iso31010-50']
    },
    {
      key: 'cloud',
      patterns: ['cloud', 'tenant', 'saas', 'iac', 'public cloud', 'configuration drift'],
      docTags: ['cloud'],
      docIds: ['doc-cloud-04', 'doc-iso27017-17', 'doc-iso27018-18']
    }
  ];

  function init(docs, buData) {
    _docs = Array.isArray(docs) ? docs : [];
    _buData = Array.isArray(buData) ? buData : [];
    _indexedDocs = _docs.map(doc => _buildDocIndex(doc));
  }

  function _normaliseText(text = '') {
    return String(text || '')
      .normalize('NFKD')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function _stemToken(token = '') {
    let value = String(token || '').trim();
    if (value.length <= 4) return value;
    if (value.endsWith('ies')) return `${value.slice(0, -3)}y`;
    if (value.endsWith('ing')) return value.slice(0, -3);
    if (value.endsWith('ed')) return value.slice(0, -2);
    if (value.endsWith('es')) return value.slice(0, -2);
    if (value.endsWith('s')) return value.slice(0, -1);
    return value;
  }

  function _tokenise(text = '') {
    return Array.from(new Set(
      _normaliseText(text)
        .split(/\s+/)
        .map(_stemToken)
        .filter(token => token.length > 2 && !STOP_WORDS.has(token))
    ));
  }

  function _queryIncludesAny(query, patterns = []) {
    const q = _normaliseText(query);
    return patterns.some(pattern => q.includes(_normaliseText(pattern)));
  }

  function _extractConceptKeys(text = '') {
    const normalized = _normaliseText(text);
    return CONCEPT_RULES
      .filter(rule => (rule.patterns || []).some(pattern => normalized.includes(_normaliseText(pattern))))
      .map(rule => rule.key);
  }

  function _getMatchingLensTags(query = '') {
    const q = _normaliseText(query);
    const aliases = new Map([
      ['third-party', ['third-party', 'third party', 'vendor', 'supplier', 'outsourcing']],
      ['supply-chain', ['supply-chain', 'supply chain', 'logistics', 'inventory', 'sub-tier', 'single source', 'upstream']],
      ['business-continuity', ['business-continuity', 'business continuity', 'continuity', 'recovery', 'disaster recovery', 'crisis management', 'rto', 'rpo']],
      ['esg', ['esg', 'sustainability', 'climate', 'emissions', 'greenwashing', 'human rights']],
      ['hse', ['hse', 'health and safety', 'worker safety', 'injury', 'environmental', 'spill', 'hazard']],
      ['cyber', ['cyber', 'identity', 'phishing', 'ransomware', 'cloud', 'breach', 'ics', 'ot security']],
      ['operational', ['operational', 'process failure', 'breakdown', 'service failure', 'backlog', 'quality failure']],
      ['strategic', ['strategic', 'strategy', 'market', 'transformation', 'portfolio', 'investment']],
      ['regulatory', ['regulatory', 'regulator', 'licence', 'license', 'sanction', 'export control', 'filing']],
      ['financial', ['financial', 'fraud', 'payment', 'treasury', 'capital', 'misstatement']],
      ['compliance', ['compliance', 'non-compliance', 'policy breach', 'anti bribery', 'corruption', 'ethics', 'conduct']],
      ['procurement', ['procurement', 'sourcing', 'tender', 'bid', 'contract award', 'supplier due diligence', 'collusion']]
    ]);
    return LENS_TAGS.filter(tag => (aliases.get(tag) || [tag]).some(pattern => q.includes(_normaliseText(pattern))));
  }

  function _expandQuery(query = '') {
    const raw = String(query || '');
    const normalized = _normaliseText(raw);
    const concepts = Array.from(new Set(_extractConceptKeys(raw)));
    const lensTags = Array.from(new Set(_getMatchingLensTags(raw)));
    const phrases = Array.from(new Set(
      CONCEPT_RULES
        .flatMap(rule => rule.patterns || [])
        .filter(pattern => normalized.includes(_normaliseText(pattern)) && _normaliseText(pattern).includes(' '))
    ));
    const expandedTerms = new Set(_tokenise(raw));

    lensTags.forEach(tag => {
      _tokenise(tag).forEach(term => expandedTerms.add(term));
    });

    concepts.forEach(key => {
      const rule = CONCEPT_RULES.find(item => item.key === key);
      (rule?.patterns || []).forEach(pattern => {
        _tokenise(pattern).forEach(term => expandedTerms.add(term));
      });
      (rule?.docTags || []).forEach(tag => {
        _tokenise(tag).forEach(term => expandedTerms.add(term));
      });
    });

    TOPIC_RULES.forEach(rule => {
      if (!_queryIncludesAny(raw, rule.patterns)) return;
      (rule.patterns || []).forEach(pattern => {
        _tokenise(pattern).forEach(term => expandedTerms.add(term));
      });
      (rule.docTags || []).forEach(tag => {
        _tokenise(tag).forEach(term => expandedTerms.add(term));
      });
    });

    return {
      raw,
      normalized,
      concepts,
      lensTags,
      phrases,
      expandedTerms: Array.from(expandedTerms)
    };
  }

  function _buildDocIndex(doc = {}) {
    const tags = Array.isArray(doc.tags) ? doc.tags.map(tag => String(tag || '').toLowerCase()) : [];
    const text = `${doc.title || ''} ${doc.contentExcerpt || ''} ${doc.contentFull || ''} ${tags.join(' ')}`;
    return {
      doc,
      tags,
      normalizedText: _normaliseText(text),
      tokens: new Set(_tokenise(text)),
      concepts: new Set(_extractConceptKeys(`${text} ${tags.join(' ')}`))
    };
  }

  function _classifyDocSource(doc) {
    const tags = Array.isArray(doc.tags) ? doc.tags.map(tag => String(tag || '').toLowerCase()) : [];
    const text = `${doc.title || ''} ${doc.url || ''} ${tags.join(' ')}`.toLowerCase();
    if (tags.includes('regulatory') || /pdpl|gdpr|regulat|authority|ministry|policy|law|nist|iso|iec|oecd|ilo|ungp|united nations|ifrs|gri|tnfd|sasb|basel|bcbs/.test(text)) return 'Standards / regulatory';
    if (tags.includes('all-bu') || tags.includes('internal') || /playbook|policy|framework|baseline|mapping|program|standard/.test(text)) return 'Internal reference';
    if (/news|reuters|bloomberg|forbes|cnbc|zawya|gulf|khaleej|arabianbusiness/.test(text)) return 'External source';
    return 'Reference source';
  }

  function _buildRelevanceReasons(indexedDoc, queryInfo, buId) {
    const tags = indexedDoc.tags;
    const reasons = [];
    const exactLensMatches = (queryInfo.lensTags || []).filter(tag => tags.includes(tag));
    if (exactLensMatches.length) {
      reasons.push(`Exact ${exactLensMatches[0].replace(/-/g, ' ')} lens match`);
    }
    const semanticMatches = (queryInfo.concepts || []).filter(concept => indexedDoc.concepts.has(concept));
    if (semanticMatches.length) {
      reasons.push(`Semantic match: ${semanticMatches[0].replace(/-/g, ' ')}`);
    }
    TOPIC_RULES.forEach(rule => {
      if (!_queryIncludesAny(queryInfo.raw, rule.patterns)) return;
      if ((rule.docIds || []).includes(indexedDoc.doc.id) || (rule.docTags || []).some(tag => tags.includes(tag))) {
        reasons.push(`Matches ${rule.key.replace(/-/g, ' ')} context`);
      }
    });
    const bu = _buData.find(b => b.id === buId);
    if (bu && bu.docIds && bu.docIds.includes(indexedDoc.doc.id)) {
      reasons.push('Mapped to the selected business unit');
    }
    if (Array.isArray(indexedDoc.doc.buIds) && indexedDoc.doc.buIds.includes(buId)) {
      reasons.push('Mapped to the selected business unit');
    }
    if (tags.includes('all-bu')) {
      reasons.push('Applies across the organisation');
    }
    if (tags.includes('nist') || tags.includes('iso') || tags.includes('oecd') || tags.includes('iec')) {
      reasons.push('Recognised control or governance reference');
    }
    if (!reasons.length && tags.length) {
      reasons.push(`Relevant tags: ${tags.slice(0, 2).join(', ')}`);
    }
    return reasons.slice(0, 2);
  }

  function _topicBoost(indexedDoc, query) {
    const tags = indexedDoc.tags;
    let boost = 0;
    TOPIC_RULES.forEach(rule => {
      if (!_queryIncludesAny(query, rule.patterns)) return;
      if ((rule.docIds || []).includes(indexedDoc.doc.id)) boost += 8;
      if ((rule.docTags || []).some(tag => tags.includes(tag))) boost += 5;
    });
    return boost;
  }

  function _semanticBoost(indexedDoc, queryInfo) {
    let boost = 0;

    const conceptOverlap = (queryInfo.concepts || []).filter(concept => indexedDoc.concepts.has(concept));
    boost += conceptOverlap.length * 5;
    conceptOverlap.forEach(concept => {
      const rule = CONCEPT_RULES.find(item => item.key === concept);
      if ((rule?.docIds || []).includes(indexedDoc.doc.id)) boost += 5;
      if ((rule?.docTags || []).some(tag => indexedDoc.tags.includes(tag))) boost += 4;
    });

    (queryInfo.phrases || []).forEach(phrase => {
      const normalizedPhrase = _normaliseText(phrase);
      if (normalizedPhrase && indexedDoc.normalizedText.includes(normalizedPhrase)) {
        boost += normalizedPhrase.split(' ').length > 1 ? 4 : 2;
      }
    });

    const tokenOverlap = (queryInfo.expandedTerms || []).filter(term => indexedDoc.tokens.has(term));
    boost += Math.min(tokenOverlap.length, 10) * 1.15;

    return boost;
  }

  function _sourcePriority(indexedDoc) {
    const label = _classifyDocSource(indexedDoc.doc);
    if (label === 'Standards / regulatory') return 0;
    if (label === 'Internal reference') return 1;
    if (label === 'Reference source') return 2;
    return 3;
  }

  // Semantic-style overlap scoring with concept and phrase expansion
  function scoreDoc(indexedDoc, query, buId) {
    const queryInfo = typeof query === 'string' ? _expandQuery(query) : query;
    let score = 0;

    (queryInfo.expandedTerms || []).forEach(term => {
      const hits = (indexedDoc.normalizedText.match(new RegExp(`\\b${term}\\b`, 'g')) || []).length;
      score += hits * 1.4;
    });

    const bu = _buData.find(b => b.id === buId);
    if (bu && bu.docIds && bu.docIds.includes(indexedDoc.doc.id)) {
      score += 5;
    }

    // Exact lens alignment should nudge ranking, not overwhelm textual relevance.
    (queryInfo.lensTags || []).forEach(tag => {
      if (indexedDoc.tags.includes(tag)) score += 4;
    });

    score += _semanticBoost(indexedDoc, queryInfo);
    score += _topicBoost(indexedDoc, queryInfo.raw);

    if (indexedDoc.tags.includes('all-bu')) score += 0.75;
    if (indexedDoc.tags.includes('nist') || indexedDoc.tags.includes('iso') || indexedDoc.tags.includes('oecd') || indexedDoc.tags.includes('iec')) score += 0.6;

    const daysSince = (Date.now() - new Date(indexedDoc.doc.lastUpdated).getTime()) / 86400000;
    score += Math.max(0, 1 - daysSince / 365);

    return score;
  }

  /**
   * Retrieve relevant docs for a BU + narrative query
   * [RAG-INTEGRATION] Replace with Azure Cognitive Search vector query
   */
  async function retrieveRelevantDocs(buId, query, topK = 4) {
    await _simulateLatency(400);

    const queryInfo = _expandQuery(query);
    const scored = _indexedDocs.map(indexed => ({
      ...indexed.doc,
      _score: scoreDoc(indexed, queryInfo, buId),
      _relevanceReason: _buildRelevanceReasons(indexed, queryInfo, buId).join(' · ')
    }));

    scored.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      const sourceDiff = _sourcePriority(_buildDocIndex(a)) - _sourcePriority(_buildDocIndex(b));
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
      relevanceReason: d._relevanceReason
    }));
  }

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
    _indexedDocs = _docs.map(item => _buildDocIndex(item));
  }

  function bulkAddDocuments(docs = []) {
    (Array.isArray(docs) ? docs : []).forEach(doc => addDocument(doc));
  }

  function _simulateLatency(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  return { init, retrieveRelevantDocs, getDocsForBU, addDocument, bulkAddDocuments };
})();
