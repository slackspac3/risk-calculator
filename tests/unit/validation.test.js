const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateBody } = require('../../api/_validation');

describe('validateBody', () => {
  it('returns no errors for valid input', () => {
    const { errors } = validateBody(
      { name: 'test', count: 5, tags: ['a', 'b'] },
      {
        name: { type: 'string', maxLength: 100 },
        count: { type: 'number', min: 1, max: 10 },
        tags: { type: 'array', maxItems: 5, itemType: 'string' }
      }
    );
    assert.equal(errors.length, 0);
  });

  it('rejects non-object body', () => {
    const { errors } = validateBody('not an object', {});
    assert.equal(errors.length, 1);
    assert.match(errors[0], /JSON object/);
  });

  it('rejects array body', () => {
    const { errors } = validateBody([1, 2, 3], {});
    assert.equal(errors.length, 1);
  });

  it('rejects missing required fields', () => {
    const { errors } = validateBody({}, { name: { type: 'string', required: true } });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /Missing required/);
  });

  it('skips optional absent fields', () => {
    const { errors } = validateBody({}, { name: { type: 'string' } });
    assert.equal(errors.length, 0);
  });

  it('rejects wrong type - string expected', () => {
    const { errors } = validateBody({ name: 123 }, { name: { type: 'string' } });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /type string/);
  });

  it('rejects wrong type - number expected', () => {
    const { errors } = validateBody({ count: 'five' }, { count: { type: 'number' } });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /type number/);
  });

  it('rejects wrong type - array expected', () => {
    const { errors } = validateBody({ tags: 'a,b' }, { tags: { type: 'array' } });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /type array/);
  });

  it('enforces string maxLength', () => {
    const { errors } = validateBody({ name: 'abcdef' }, { name: { type: 'string', maxLength: 3 } });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /maximum length/);
  });

  it('enforces string minLength', () => {
    const { errors } = validateBody({ name: 'ab' }, { name: { type: 'string', minLength: 5 } });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /at least 5/);
  });

  it('enforces string enum', () => {
    const { errors } = validateBody({ mode: 'turbo' }, { mode: { type: 'string', enum: ['fast', 'slow'] } });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /one of/);
  });

  it('enforces number min/max', () => {
    const r1 = validateBody({ count: 0 }, { count: { type: 'number', min: 1 } });
    assert.equal(r1.errors.length, 1);
    assert.match(r1.errors[0], /at least 1/);

    const r2 = validateBody({ count: 200 }, { count: { type: 'number', max: 100 } });
    assert.equal(r2.errors.length, 1);
    assert.match(r2.errors[0], /at most 100/);
  });

  it('rejects non-finite numbers', () => {
    const { errors } = validateBody({ count: Infinity }, { count: { type: 'number' } });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /finite/);
  });

  it('enforces array maxItems', () => {
    const { errors } = validateBody({ tags: ['a', 'b', 'c'] }, { tags: { type: 'array', maxItems: 2 } });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /maximum of 2/);
  });

  it('enforces array itemType', () => {
    const { errors } = validateBody({ tags: ['a', 123] }, { tags: { type: 'array', itemType: 'string' } });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /must be a string/);
  });

  it('enforces array itemMaxLength', () => {
    const { errors } = validateBody(
      { tags: ['ok', 'this-is-way-too-long'] },
      { tags: { type: 'array', itemType: 'string', itemMaxLength: 5 } }
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0], /maximum length/);
  });

  it('validates object type', () => {
    const { errors } = validateBody({ opts: [1, 2] }, { opts: { type: 'object' } });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /type object/);
  });

  it('accepts valid object type', () => {
    const { errors } = validateBody({ opts: { a: 1 } }, { opts: { type: 'object' } });
    assert.equal(errors.length, 0);
  });

  it('collects multiple errors', () => {
    const { errors } = validateBody(
      { name: 123, count: 'five' },
      { name: { type: 'string' }, count: { type: 'number' } }
    );
    assert.equal(errors.length, 2);
  });
});
