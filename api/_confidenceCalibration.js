'use strict';

function uniqueStrings(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)));
}

function clampScore(value = 0) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function bandFromConfidenceScore(score = 0) {
  const value = clampScore(score);
  if (value >= 78) return 'high';
  if (value >= 50) return 'medium';
  return 'low';
}

function calibrateClassificationConfidence(input = {}) {
  const ambiguityFlags = uniqueStrings(input.ambiguityFlags || []);
  const reasonCodes = uniqueStrings(input.reasonCodes || []);
  const bestScore = Number(input.bestScore || 0);
  const secondScore = Number(input.secondScore || 0);
  const signalCount = Number(input.matchedSignalCount || 0);
  const strongSignalCount = Number(input.strongSignalCount || 0);
  const mechanismCount = Number(input.mechanismCount || 0);
  const antiSignalCount = Number(input.antiSignalCount || 0);
  const blockedByAntiSignalCount = Number(input.blockedByAntiSignalCount || 0);
  const precedenceAppliedCount = Number(input.precedenceAppliedCount || 0);
  const topDomainCount = Math.max(0, Number(input.topDomainCount || 0));
  const hasUsablePrimary = Boolean(input.hasUsablePrimary);
  const weakExplicitPrimary = Boolean(input.weakExplicitPrimary);
  const hasExplicitPrimarySignals = Boolean(input.hasExplicitPrimarySignals);
  const requiredSignalsMet = Boolean(input.requiredSignalsMet);
  const overlayHeavy = Boolean(input.overlayHeavy);
  const usedHintFallback = Boolean(input.usedHintFallback);
  const consequenceHeavy = overlayHeavy || ambiguityFlags.includes('CONSEQUENCE_HEAVY_TEXT');
  const weakEventPath = ambiguityFlags.includes('WEAK_EVENT_PATH');
  const mixedDomain = topDomainCount > 1 || ambiguityFlags.includes('MIXED_DOMAIN_SIGNALS') || reasonCodes.includes('MIXED_DOMAIN_SIGNALS');
  const margin = bestScore - secondScore;
  const drivers = [];
  let score = hasUsablePrimary ? 48 : (weakExplicitPrimary ? 34 : 18);

  if (strongSignalCount >= 3) {
    score += 18;
    drivers.push('STRONG_PRIMARY_SIGNALS');
  } else if (strongSignalCount >= 2) {
    score += 12;
    drivers.push('STRONG_PRIMARY_SIGNALS');
  } else if (hasExplicitPrimarySignals) {
    score += 7;
  }

  if (requiredSignalsMet) {
    score += 8;
    drivers.push('REQUIRED_SIGNALS_MET');
  }
  if (requiredSignalsMet && hasExplicitPrimarySignals) score += 4;

  if (bestScore >= 24) score += 12;
  else if (bestScore >= 18) score += 8;
  else if (bestScore >= 12) score += 4;

  if (margin >= 6 || secondScore <= 0) {
    score += 12;
    drivers.push('NO_STRONG_COMPETING_FAMILY');
  } else if (margin >= 3) {
    score += 5;
  } else if (secondScore > 0) {
    score -= 8;
  }

  if (signalCount >= 6) score += 5;
  else if (signalCount >= 3) score += 2;

  if (mechanismCount >= 2) {
    score += 5;
    drivers.push('MECHANISM_SUPPORT');
  } else if (mechanismCount === 1) {
    score += 3;
    drivers.push('MECHANISM_SUPPORT');
  }

  if (antiSignalCount > 0 || blockedByAntiSignalCount > 0 || reasonCodes.includes('BLOCKED_BY_ANTI_SIGNAL')) {
    score -= Math.min(16, antiSignalCount * 3 + blockedByAntiSignalCount * 5);
    drivers.push('BLOCKED_BY_ANTI_SIGNAL');
  }

  if (precedenceAppliedCount > 0 || reasonCodes.includes('PRECEDENCE_RULE_APPLIED')) {
    score -= 4;
    drivers.push('PRECEDENCE_RULE_NEEDED');
  }

  if (consequenceHeavy) {
    score -= 12;
    drivers.push('CONSEQUENCE_HEAVY_TEXT');
  }

  if (mixedDomain) {
    score -= Math.min(12, Math.max(1, topDomainCount - 1) * 5);
    drivers.push('MIXED_DOMAIN_SIGNALS');
  }

  if (weakEventPath) {
    score -= 14;
    drivers.push('WEAK_EVENT_PATH');
  }

  if (usedHintFallback) score -= 10;
  if (!hasUsablePrimary) score -= 6;

  const confidenceScore = clampScore(score);
  return {
    confidenceScore,
    confidenceBand: bandFromConfidenceScore(confidenceScore),
    confidenceDrivers: uniqueStrings(drivers),
    calibrationMode: 'classification_confidence_v1'
  };
}

function calibrateCoherenceConfidence(input = {}) {
  const mode = String(input.mode || 'accepted').trim() || 'accepted';
  const sourceMode = String(input.sourceMode || 'live').trim() || 'live';
  const outputType = String(input.outputType || 'coherence').trim() || 'coherence';
  const reasonCodes = uniqueStrings(input.reasonCodes || []);
  const totalCount = Math.max(0, Number(input.totalCount || 0));
  const alignedCount = Math.max(0, Number(input.alignedCount || 0));
  const blockedCount = Math.max(0, Number(input.blockedCount || 0));
  const weakOverlayOnlyCount = Math.max(0, Number(input.weakOverlayOnlyCount || 0));
  const correctedSectionCount = Math.max(0, Number(input.correctedSectionCount || 0));
  const usedFallback = Boolean(input.usedFallback) || sourceMode === 'deterministic_fallback';
  const dominantFamilyAligned = input.dominantFamilyAligned !== false;
  const lowAnchorOverlap = Boolean(input.lowAnchorOverlap)
    || reasonCodes.includes('LOW_EVENT_ANCHOR_OVERLAP')
    || reasonCodes.includes('LOW_SCENARIO_ANCHOR');
  const strongAlignment = Boolean(input.strongAlignment);
  const alignmentRatio = totalCount > 0
    ? alignedCount / totalCount
    : (strongAlignment ? 1 : 0);
  const drivers = [];
  let score = mode === 'manual'
    ? 18
    : mode === 'fallback_replaced'
      ? 28
      : (mode === 'corrected'
          ? 60
          : (mode === 'filtered' ? 58 : 76));

  if (mode === 'manual') drivers.push('MANUAL_MODE');
  if (mode === 'corrected') drivers.push('OUTPUT_CORRECTED');
  if (mode === 'fallback_replaced') drivers.push('OUTPUT_REPLACED');

  if (usedFallback) {
    score -= 14;
    drivers.push('FALLBACK_USED');
  }

  if (correctedSectionCount > 0 && mode !== 'corrected') {
    score -= Math.min(8, correctedSectionCount * 2);
    drivers.push('OUTPUT_CORRECTED');
  }

  if (outputType === 'shortlist') {
    if (mode === 'accepted' && alignmentRatio >= 0.8 && blockedCount === 0 && weakOverlayOnlyCount === 0) {
      score += 10;
      drivers.push('HIGH_SHORTLIST_ALIGNMENT');
    } else if (mode !== 'accepted' || alignmentRatio < 0.8) {
      score -= 8;
      drivers.push('LOW_SHORTLIST_ALIGNMENT');
    }
  } else if (mode === 'accepted' && strongAlignment && blockedCount === 0 && !lowAnchorOverlap) {
    score += 8;
    drivers.push('HIGH_OUTPUT_ALIGNMENT');
  }

  if (blockedCount > 0) score -= Math.min(16, blockedCount * 5);
  if (weakOverlayOnlyCount > 0) {
    score -= Math.min(12, weakOverlayOnlyCount * 4);
    drivers.push('CONSEQUENCE_HEAVY_TEXT');
  }
  if (!dominantFamilyAligned) score -= 10;
  if (lowAnchorOverlap) {
    score -= outputType === 'shortlist' ? 8 : 4;
    drivers.push('LOW_ANCHOR_OVERLAP');
  }

  const confidenceScore = clampScore(score);
  return {
    confidenceScore,
    confidenceBand: bandFromConfidenceScore(confidenceScore),
    confidenceDrivers: uniqueStrings(drivers),
    calibrationMode: `${outputType}_confidence_v1`
  };
}

module.exports = {
  bandFromConfidenceScore,
  calibrateClassificationConfidence,
  calibrateCoherenceConfidence
};
