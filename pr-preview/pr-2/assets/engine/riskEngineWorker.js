importScripts('../engine/riskEngine.js');

self.onmessage = async function (e) {
  const data = e?.data && typeof e.data === 'object' ? e.data : {};
  if (data.type !== 'RUN') return;

  try {
    const params = data.params && typeof data.params === 'object' ? data.params : {};
    const result = await RiskEngine.runAsync(params, {
      yieldEvery: 0,
      onProgress: (ratio, completed, total) => {
        self.postMessage({
          type: 'PROGRESS',
          ratio,
          completed,
          total
        });
      }
    });
    self.postMessage({
      type: 'RESULT',
      result
    });
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      code: error?.code || 'SIM_ERROR',
      message: error?.message
    });
  }
};
