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

  function init(docs, buData) {
    _docs = docs;
    _buData = buData;
  }

  // Simple TF-IDF-like keyword scoring
  function scoreDoc(doc, query, buId) {
    let score = 0;
    const q = query.toLowerCase();
    const words = q.split(/\W+/).filter(w => w.length > 3);

    const text = `${doc.title} ${doc.contentExcerpt} ${doc.tags.join(' ')}`.toLowerCase();

    // Keyword hits
    words.forEach(w => {
      const hits = (text.match(new RegExp(w, 'g')) || []).length;
      score += hits * 1.5;
    });

    // BU relevance boost
    const bu = _buData.find(b => b.id === buId);
    if (bu && bu.docIds && bu.docIds.includes(doc.id)) {
      score += 5;
    }

    // Tag matches
    const riskKeywords = ['breach', 'ransomware', 'phishing', 'attack', 'malware',
      'data', 'loss', 'incident', 'vulnerability', 'access', 'cloud', 'payment',
      'regulatory', 'compliance', 'third-party', 'insider', 'supply'];
    riskKeywords.forEach(kw => {
      if (q.includes(kw) && doc.tags.some(t => t.includes(kw.split('-')[0]))) {
        score += 3;
      }
    });

    // Recency boost (newer docs slightly preferred)
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

    scored.sort((a, b) => b._score - a._score);
    const results = scored.slice(0, topK).filter(d => d._score > 0);

    // Return as citation objects
    return results.map(d => ({
      docId: d.id,
      title: d.title,
      url: d.url,
      excerpt: d.contentExcerpt,
      tags: d.tags,
      score: d._score,
      lastUpdated: d.lastUpdated
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
