const crypto = require('crypto');

const REVIEW_QUEUE_KEY = 'risk_calculator_review_queue';
const REVIEWER_ROLES = new Set(['function_admin', 'bu_admin', 'admin']);
const HOLDING_COMPANY_ROLE = 'admin';
const SHARED_ASSESSMENT_FIELDS = [
  'id', 'scenarioTitle', 'buName', 'narrative',
  'structuredScenario', 'citations', 'recommendations',
  'completedAt', 'results', 'lifecycleStatus', 'comparisonBaselineId'
];

const { sendApiError, requireSession, readAccountsDirectory } = require('./_apiAuth');
const { applyCorsHeaders, getUnexpectedFields, isAllowedOrigin, isPlainObject, parseRequestBody } = require('./_request');
const { get: kvGet, set: kvSet, withLock: withKvLock } = require('./_kvStore');

function normaliseQueueArray(value) {
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
}

async function readQueue() {
  try {
    const raw = await kvGet(REVIEW_QUEUE_KEY);
    if (!raw) return [];
    return normaliseQueueArray(JSON.parse(raw));
  } catch (error) {
    console.error('api/review-queue.readQueue failed to parse stored review queue:', error);
    return [];
  }
}

async function writeQueue(arr) {
  await kvSet(REVIEW_QUEUE_KEY, JSON.stringify(normaliseQueueArray(arr)));
}

function toSafeString(value) {
  return String(value || '').trim();
}

function toSafeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function toNumberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function isReviewerRole(role = '') {
  return REVIEWER_ROLES.has(String(role || '').trim().toLowerCase());
}

function sameBusinessUnit(left = {}, right = {}) {
  const leftBuId = toSafeString(left.businessUnitEntityId || left.buId);
  const rightBuId = toSafeString(right.businessUnitEntityId || right.buId);
  return !!leftBuId && leftBuId === rightBuId;
}

function sameDepartment(left = {}, right = {}) {
  const leftDepartmentId = toSafeString(left.departmentEntityId);
  const rightDepartmentId = toSafeString(right.departmentEntityId);
  return !!leftDepartmentId && leftDepartmentId === rightDepartmentId;
}

function sanitiseSharedAssessment(sharedAssessment = {}, assessment = {}) {
  const source = isPlainObject(sharedAssessment) ? sharedAssessment : {};
  const fallbackAssessment = isPlainObject(assessment) ? assessment : {};
  const payload = {};
  SHARED_ASSESSMENT_FIELDS.forEach((field) => {
    if (source[field] !== undefined) payload[field] = source[field];
  });
  if (!payload.id) payload.id = toSafeString(fallbackAssessment.id);
  if (!payload.scenarioTitle) payload.scenarioTitle = toSafeString(fallbackAssessment.scenarioTitle);
  if (!payload.buName) payload.buName = toSafeString(fallbackAssessment.buName);
  if (!payload.narrative) {
    payload.narrative = toSafeString(fallbackAssessment.enhancedNarrative || fallbackAssessment.narrative);
  }
  if (!isPlainObject(payload.results) && isPlainObject(fallbackAssessment.results)) {
    payload.results = fallbackAssessment.results;
  }
  return payload.id ? payload : null;
}

function deriveReviewScopeForTarget(session = {}, target = {}) {
  if (String(target.role || '').trim().toLowerCase() === HOLDING_COMPANY_ROLE) return 'holding_company';
  if (sameDepartment(session, target)) return 'function';
  if (sameBusinessUnit(session, target)) return 'business_unit';
  return 'holding_company';
}

function sortTargetsForSession(session = {}, targets = [], { action = 'submit' } = {}) {
  const currentUsername = toSafeUsername(session.username);
  const scored = (Array.isArray(targets) ? targets : []).map((target) => {
    const safeTarget = {
      ...target,
      username: toSafeUsername(target.username),
      role: String(target.role || '').trim().toLowerCase(),
      displayName: toSafeString(target.displayName) || toSafeUsername(target.username)
    };
    let score = 0;
    if (safeTarget.username === currentUsername && (session.role === 'bu_admin' || session.role === 'admin')) score += 800;
    if (action === 'escalate') {
      if (safeTarget.role === HOLDING_COMPANY_ROLE) score += 400;
    } else if (session.role === 'user') {
      if (safeTarget.role === 'function_admin' && sameDepartment(session, safeTarget)) score += 500;
      else if (safeTarget.role === 'bu_admin' && sameBusinessUnit(session, safeTarget)) score += 350;
      else if (safeTarget.role === 'function_admin' && sameBusinessUnit(session, safeTarget)) score += 200;
    } else if (session.role === 'function_admin') {
      if (safeTarget.role === 'bu_admin' && sameBusinessUnit(session, safeTarget)) score += 500;
      else if (safeTarget.role === 'function_admin' && sameBusinessUnit(session, safeTarget)) score += 250;
    } else if (session.role === 'bu_admin') {
      if (safeTarget.role === 'bu_admin' && sameBusinessUnit(session, safeTarget)) score += 500;
      else if (safeTarget.role === 'function_admin' && sameBusinessUnit(session, safeTarget)) score += 250;
    } else if (session.role === 'admin') {
      if (safeTarget.role === 'admin') score += 500;
      else if (safeTarget.role === 'bu_admin') score += 250;
    }
    if (sameDepartment(session, safeTarget)) score += 60;
    if (sameBusinessUnit(session, safeTarget)) score += 30;
    return {
      target: {
        username: safeTarget.username,
        displayName: safeTarget.displayName,
        role: safeTarget.role,
        businessUnitEntityId: toSafeString(safeTarget.businessUnitEntityId),
        departmentEntityId: toSafeString(safeTarget.departmentEntityId),
        reviewScope: deriveReviewScopeForTarget(session, safeTarget)
      },
      score
    };
  });
  return scored
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.target.displayName.localeCompare(right.target.displayName);
    })
    .map(entry => entry.target);
}

function buildTargetList(session = {}, accounts = [], { action = 'submit' } = {}) {
  const reviewerAccounts = (Array.isArray(accounts) ? accounts : []).filter(account => account?.username && isReviewerRole(account.role));
  let rawTargets = [];
  if (action === 'escalate') {
    if (String(session.role || '').trim().toLowerCase() !== 'bu_admin') {
      return { targets: [], defaultTargetUsername: '' };
    }
    rawTargets = reviewerAccounts.filter(account => String(account.role || '').trim().toLowerCase() === HOLDING_COMPANY_ROLE);
  } else if (session.role === 'admin') {
    rawTargets = reviewerAccounts;
  } else if (session.role === 'bu_admin') {
    rawTargets = reviewerAccounts.filter(account => sameBusinessUnit(session, account));
  } else if (session.role === 'function_admin') {
    rawTargets = reviewerAccounts.filter(account => sameBusinessUnit(session, account));
  } else {
    const sameDepartmentTargets = reviewerAccounts.filter(account => sameDepartment(session, account));
    rawTargets = sameDepartmentTargets.length
      ? sameDepartmentTargets
      : reviewerAccounts.filter(account => sameBusinessUnit(session, account));
  }
  const targets = sortTargetsForSession(session, rawTargets, { action });
  return {
    targets,
    defaultTargetUsername: targets[0]?.username || ''
  };
}

function buildAccountsByUsername(accounts = []) {
  return new Map((Array.isArray(accounts) ? accounts : []).map(account => [toSafeUsername(account.username), account]));
}

function isLegacyScopeViewer(session = {}, item = {}) {
  if (!session?.role) return false;
  if (session.role === 'admin') return true;
  if (session.role === 'bu_admin') {
    return !!toSafeString(session.businessUnitEntityId) && toSafeString(session.businessUnitEntityId) === toSafeString(item.buId);
  }
  if (session.role === 'function_admin') {
    return !!toSafeString(session.departmentEntityId) && toSafeString(session.departmentEntityId) === toSafeString(item.departmentEntityId);
  }
  return false;
}

function isReviewAwaitingDecision(item = {}) {
  const reviewStatus = toSafeString(item.reviewStatus).toLowerCase();
  return !reviewStatus || reviewStatus === 'pending' || reviewStatus === 'escalated';
}

function canViewQueueItem(session = {}, item = {}) {
  const currentUsername = toSafeUsername(session.username);
  if (!currentUsername) return false;
  if (session.role === 'admin') return true;
  if (currentUsername === toSafeUsername(item.submittedBy)) return true;
  if (currentUsername === toSafeUsername(item.assignedReviewerUsername)) return true;
  return isLegacyScopeViewer(session, item);
}

function canReviewQueueItem(session = {}, item = {}) {
  const currentUsername = toSafeUsername(session.username);
  if (!currentUsername) return false;
  if (!isReviewAwaitingDecision(item)) return false;
  if (session.role === 'admin') return true;
  if (!toSafeUsername(item.assignedReviewerUsername)) return isLegacyScopeViewer(session, item);
  return currentUsername === toSafeUsername(item.assignedReviewerUsername);
}

function canEscalateQueueItem(session = {}, item = {}) {
  if (String(session.role || '').trim().toLowerCase() !== 'bu_admin') return false;
  if (!isReviewAwaitingDecision(item)) return false;
  return !!toSafeString(session.businessUnitEntityId)
    && toSafeString(session.businessUnitEntityId) === toSafeString(item.buId);
}

function decorateQueueItemForSession(session = {}, item = {}) {
  return {
    ...item,
    currentUserCanReview: canReviewQueueItem(session, item),
    currentUserCanEscalate: canEscalateQueueItem(session, item),
    currentUserCanView: canViewQueueItem(session, item),
    isAssignedToCurrentUser: toSafeUsername(session.username) === toSafeUsername(item.assignedReviewerUsername),
    hasSharedAssessment: !!(item.sharedAssessment && typeof item.sharedAssessment === 'object' && item.sharedAssessment.id)
  };
}

function scopeQueueForSession(session = {}, queue = []) {
  return normaliseQueueArray(queue)
    .filter(item => canViewQueueItem(session, item))
    .map(item => decorateQueueItemForSession(session, item));
}

function buildReviewItem(assessment = {}, session = {}, assignee = {}, sharedAssessment = null) {
  const results = isPlainObject(assessment.results) ? assessment.results : {};
  const eventLoss = isPlainObject(results.eventLoss) ? results.eventLoss : {};
  const ale = isPlainObject(results.ale) ? results.ale : {};
  return {
    id: `rq_${crypto.randomUUID()}`,
    assessmentId: toSafeString(assessment.id),
    submittedBy: toSafeUsername(session.username),
    submittedByDisplayName: toSafeString(session.displayName) || toSafeUsername(session.username),
    submittedAt: Date.now(),
    buId: toSafeString(session.businessUnitEntityId || assessment.buId),
    buName: toSafeString(assessment.buName),
    departmentEntityId: toSafeString(session.departmentEntityId || assessment.departmentEntityId || assessment.functionId || assessment.functionKey),
    scenarioTitle: toSafeString(assessment.scenarioTitle),
    toleranceBreached: !!results.toleranceBreached,
    nearTolerance: !!results.nearTolerance,
    annualReviewTriggered: !!results.annualReviewTriggered,
    p90Loss: toNumberOrZero(eventLoss.p90),
    aleMean: toNumberOrZero(ale.mean),
    assignedReviewerUsername: toSafeUsername(assignee.username),
    assignedReviewerDisplayName: toSafeString(assignee.displayName) || toSafeUsername(assignee.username),
    assignedReviewerRole: String(assignee.role || '').trim().toLowerCase(),
    reviewScope: deriveReviewScopeForTarget(session, assignee),
    reviewStatus: 'pending',
    reviewNote: '',
    reviewedBy: '',
    reviewedAt: 0,
    escalatedTo: '',
    escalatedBy: '',
    escalatedAt: 0,
    sharedAssessment
  };
}

module.exports = async function handler(req, res) {
  const body = parseRequestBody(req);
  applyCorsHeaders(req, res, {
    methods: 'GET,POST,PATCH,OPTIONS',
    headers: 'content-type,x-session-token'
  });

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    sendApiError(res, 403, 'FORBIDDEN', 'Request origin is not allowed.');
    return;
  }

  if ((req.method === 'POST' || req.method === 'PATCH') && !req.headers['content-type']?.includes('application/json')) {
    sendApiError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
    return;
  }

  if ((req.method === 'POST' || req.method === 'PATCH') && !isPlainObject(body)) {
    sendApiError(res, 400, 'VALIDATION_ERROR', 'Invalid request body.');
    return;
  }

  try {
    if (req.method === 'GET') {
      const session = await requireSession(req, res);
      if (!session) return;
      const view = toSafeString(req.query?.view).toLowerCase();
      if (view === 'targets') {
        const action = toSafeString(req.query?.action || 'submit').toLowerCase() === 'escalate'
          ? 'escalate'
          : 'submit';
        const { accounts } = await readAccountsDirectory();
        const targetState = buildTargetList(session, accounts, { action });
        res.status(200).json({
          action,
          targets: targetState.targets,
          defaultTargetUsername: targetState.defaultTargetUsername
        });
        return;
      }
      const queue = await readQueue();
      const buId = toSafeString(req.query?.buId);
      const scopedQueue = scopeQueueForSession(session, queue);
      const items = buId ? scopedQueue.filter(item => toSafeString(item.buId) === buId) : scopedQueue;
      res.status(200).json({ items });
      return;
    }

    if (req.method === 'POST') {
      const session = await requireSession(req, res);
      if (!session) return;
      if (getUnexpectedFields(body, ['assessment', 'assignedReviewerUsername', 'sharedAssessment']).length) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'Unexpected fields were included in the review submission.');
        return;
      }
      const assessment = isPlainObject(body.assessment) ? body.assessment : null;
      if (!assessment) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'assessment payload is required.');
        return;
      }
      const assessmentId = toSafeString(assessment.id);
      if (!assessmentId) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'Assessment id is required.');
        return;
      }
      const assignedReviewerUsername = toSafeUsername(body.assignedReviewerUsername);
      if (!assignedReviewerUsername) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'assignedReviewerUsername is required.');
        return;
      }
      const { accounts } = await readAccountsDirectory();
      const targetState = buildTargetList(session, accounts, { action: 'submit' });
      const accountsByUsername = buildAccountsByUsername(accounts);
      const assignee = targetState.targets.find(target => target.username === assignedReviewerUsername) || accountsByUsername.get(assignedReviewerUsername) || null;
      if (!assignee || !targetState.targets.some(target => target.username === assignedReviewerUsername)) {
        sendApiError(res, 403, 'FORBIDDEN', 'You are not allowed to submit this assessment to that reviewer.');
        return;
      }
      const sharedAssessment = sanitiseSharedAssessment(body.sharedAssessment, assessment);
      const result = await withKvLock(REVIEW_QUEUE_KEY, async () => {
        const queue = await readQueue();
        const duplicate = queue.find(entry => toSafeString(entry.assessmentId) === assessmentId && ['pending', 'escalated'].includes(toSafeString(entry.reviewStatus).toLowerCase()));
        if (duplicate) return { duplicate };
        const nextItem = buildReviewItem(assessment, session, assignee, sharedAssessment);
        queue.unshift(nextItem);
        await writeQueue(queue);
        return { item: decorateQueueItemForSession(session, nextItem) };
      }, {
        prefix: 'lock::review-queue::',
        waitTimeoutMs: 2500
      });
      if (result?.duplicate) {
        sendApiError(res, 409, 'ALREADY_SUBMITTED', 'Assessment is already pending review.');
        return;
      }
      res.status(200).json({ item: result?.item || null });
      return;
    }

    if (req.method === 'PATCH') {
      const session = await requireSession(req, res);
      if (!session) return;
      if (getUnexpectedFields(body, ['escalatedTo', 'id', 'reviewNote', 'reviewStatus', 'reviewedBy']).length) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'Unexpected fields were included in the review update.');
        return;
      }
      const reviewId = toSafeString(body.id);
      const reviewStatus = toSafeString(body.reviewStatus).toLowerCase();
      const validStatuses = new Set(['approved', 'changes_requested', 'escalated']);
      if (!reviewId) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'Review id is required.');
        return;
      }
      if (!validStatuses.has(reviewStatus)) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'reviewStatus must be approved, changes_requested, or escalated.');
        return;
      }
      const { accounts } = await readAccountsDirectory();
      const result = await withKvLock(REVIEW_QUEUE_KEY, async () => {
        const queue = await readQueue();
        const index = queue.findIndex(item => toSafeString(item.id) === reviewId);
        if (index < 0) return { missing: true };
        const current = queue[index];
        if (reviewStatus === 'escalated') {
          if (!canEscalateQueueItem(session, current)) return { forbidden: true };
        } else if (!canReviewQueueItem(session, current)) {
          return { forbidden: true };
        }
        let nextAssignedReviewer = {
          username: toSafeUsername(current.assignedReviewerUsername),
          displayName: toSafeString(current.assignedReviewerDisplayName),
          role: String(current.assignedReviewerRole || '').trim().toLowerCase()
        };
        let escalatedTo = toSafeUsername(current.escalatedTo);
        let escalatedBy = toSafeUsername(current.escalatedBy);
        let escalatedAt = toNumberOrZero(current.escalatedAt);
        if (reviewStatus === 'escalated') {
          const escalationTargets = buildTargetList(session, accounts, { action: 'escalate' }).targets;
          const requestedTarget = toSafeUsername(body.escalatedTo);
          const target = escalationTargets.find(item => item.username === requestedTarget) || null;
          if (!target) return { invalidTarget: true };
          nextAssignedReviewer = {
            username: target.username,
            displayName: target.displayName,
            role: target.role
          };
          escalatedTo = target.username;
          escalatedBy = toSafeUsername(session.username);
          escalatedAt = Date.now();
        }
        const updated = {
          ...current,
          reviewStatus,
          reviewNote: toSafeString(body.reviewNote),
          reviewedBy: toSafeUsername(session.username),
          reviewedAt: Date.now(),
          assignedReviewerUsername: nextAssignedReviewer.username,
          assignedReviewerDisplayName: nextAssignedReviewer.displayName,
          assignedReviewerRole: nextAssignedReviewer.role,
          reviewScope: reviewStatus === 'escalated'
            ? 'holding_company'
            : (current.reviewScope || deriveReviewScopeForTarget(session, nextAssignedReviewer)),
          escalatedTo,
          escalatedBy,
          escalatedAt
        };
        queue[index] = updated;
        await writeQueue(queue);
        return { item: decorateQueueItemForSession(session, updated) };
      }, {
        prefix: 'lock::review-queue::',
        waitTimeoutMs: 2500
      });
      if (result?.missing) {
        sendApiError(res, 404, 'NOT_FOUND', 'Review item was not found.');
        return;
      }
      if (result?.invalidTarget) {
        sendApiError(res, 403, 'FORBIDDEN', 'You are not allowed to escalate this assessment to that reviewer.');
        return;
      }
      if (result?.forbidden) {
        sendApiError(res, 403, 'FORBIDDEN', 'You are not allowed to update this review item.');
        return;
      }
      res.status(200).json({ item: result.item });
      return;
    }

    sendApiError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  } catch (error) {
    console.error('Review queue request failed.', error);
    sendApiError(res, 500, 'REVIEW_QUEUE_ERROR', 'The review queue could not be processed.');
  }
};
