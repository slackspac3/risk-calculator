'use strict';

(function attachLlmResponseExtractor(globalScope) {
  function sanitizeAiText(value = '', { maxChars = 20000 } = {}) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxChars);
  }

  function extractBalancedJsonCandidate(text = '') {
    const source = String(text || '');
    const start = source.search(/[\[{]/);
    if (start < 0) return '';
    const stack = [];
    let inString = false;
    let escapeNext = false;
    for (let index = start; index < source.length; index += 1) {
      const ch = source[index];
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (ch === '\\') {
        if (inString) escapeNext = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{' || ch === '[') {
        stack.push(ch);
        continue;
      }
      if (ch === '}' || ch === ']') {
        const expected = ch === '}' ? '{' : '[';
        if (stack[stack.length - 1] !== expected) break;
        stack.pop();
        if (!stack.length) {
          return source.slice(start, index + 1);
        }
      }
    }
    return '';
  }

  function extractJsonFromLlmResponse(raw = '') {
    const text = String(raw || '').trim();
    const fenceMatch = text.match(/```(?:json)?\s*\r?\n?([\s\S]*?)```/i);
    if (fenceMatch) {
      const candidate = fenceMatch[1].trim();
      if (candidate.startsWith('{') || candidate.startsWith('[')) return candidate;
    }
    const objectMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (objectMatch) return objectMatch[1].trim();
    return text;
  }

  function coerceTextContent(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      const joined = value
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item.text === 'string') return item.text;
          if (item && item.text && typeof item.text.value === 'string') return item.text.value;
          if (item && item.text && typeof item.text.content === 'string') return item.text.content;
          if (item && item.type === 'output_text' && typeof item.value === 'string') return item.value;
          if (item && typeof item.content === 'string') return item.content;
          if (item && Array.isArray(item.content)) return coerceTextContent(item.content);
          return '';
        })
        .filter(Boolean)
        .join('\n')
        .trim();
      return joined || null;
    }
    if (value && typeof value.text === 'string') return value.text;
    if (value && value.text && typeof value.text.value === 'string') return value.text.value;
    if (value && typeof value.content === 'string') return value.content;
    if (value && Array.isArray(value.content)) return coerceTextContent(value.content);
    if (value && typeof value.value === 'string') return value.value;
    return null;
  }

  function describeLlmResponse(data = {}) {
    const choices = Array.isArray(data?.choices) ? data.choices : [];
    for (const choice of choices) {
      const directMessage = coerceTextContent(choice?.message?.content);
      if (directMessage) return {
        text: directMessage,
        diagnostic: 'assistant message content found'
      };

      const directOutput = coerceTextContent(choice?.content);
      if (directOutput) return {
        text: directOutput,
        diagnostic: 'choice content found'
      };

      const textField = coerceTextContent(choice?.text);
      if (textField) return {
        text: textField,
        diagnostic: 'choice text found'
      };

      const finishReason = String(choice?.finish_reason || '').trim();
      const messageKeys = choice?.message && typeof choice.message === 'object'
        ? Object.keys(choice.message).slice(0, 8).join(', ')
        : '';
      const choiceKeys = choice && typeof choice === 'object'
        ? Object.keys(choice).slice(0, 8).join(', ')
        : '';
      return {
        text: null,
        diagnostic: `choices[0] had no usable text${finishReason ? `; finish_reason: ${finishReason}` : ''}${messageKeys ? `; message keys: ${messageKeys}` : ''}${choiceKeys ? `; choice keys: ${choiceKeys}` : ''}`.trim()
      };
    }

    const outputText = coerceTextContent(data?.output_text);
    if (outputText) return {
      text: outputText,
      diagnostic: 'output_text found'
    };

    const responsesOutput = Array.isArray(data?.output) ? data.output : [];
    for (const item of responsesOutput) {
      const content = Array.isArray(item?.content) ? item.content : [];
      const joined = content
        .map((part) => coerceTextContent(part?.text || part))
        .filter(Boolean)
        .join('\n')
        .trim();
      if (joined) return {
        text: joined,
        diagnostic: 'responses output content found'
      };
    }

    const topKeys = Object.keys(data || {}).slice(0, 8).join(', ');
    return {
      text: null,
      diagnostic: `no supported content fields found; top-level keys: ${topKeys || '(none)'}`
    };
  }

  function extractLlmTextResponse(data = {}) {
    return describeLlmResponse(data).text;
  }

  const api = {
    sanitizeAiText,
    extractBalancedJsonCandidate,
    extractJsonFromLlmResponse,
    coerceTextContent,
    describeLlmResponse,
    extractLlmTextResponse
  };

  Object.assign(globalScope, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
