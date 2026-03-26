'use strict';

(function attachLlmResponseExtractor(globalScope) {
  function coerceTextContent(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      const joined = value
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item.text === 'string') return item.text;
          if (item && typeof item.content === 'string') return item.content;
          return '';
        })
        .filter(Boolean)
        .join('\n')
        .trim();
      return joined || null;
    }
    if (value && typeof value.text === 'string') return value.text;
    if (value && typeof value.content === 'string') return value.content;
    return null;
  }

  function extractLlmTextResponse(data = {}) {
    const choices = Array.isArray(data?.choices) ? data.choices : [];
    for (const choice of choices) {
      const directMessage = coerceTextContent(choice?.message?.content);
      if (directMessage) return directMessage;

      const directOutput = coerceTextContent(choice?.content);
      if (directOutput) return directOutput;

      const textField = coerceTextContent(choice?.text);
      if (textField) return textField;
    }

    const outputText = coerceTextContent(data?.output_text);
    if (outputText) return outputText;

    const responsesOutput = Array.isArray(data?.output) ? data.output : [];
    for (const item of responsesOutput) {
      const content = Array.isArray(item?.content) ? item.content : [];
      const joined = content
        .map((part) => coerceTextContent(part?.text || part))
        .filter(Boolean)
        .join('\n')
        .trim();
      if (joined) return joined;
    }

    return null;
  }

  const api = {
    coerceTextContent,
    extractLlmTextResponse
  };

  Object.assign(globalScope, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
