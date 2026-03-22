// Keep the API call separate from page logic.
window.ToxiSenseApi = (() => {
  async function predictText(text) {
    const response = await fetch(window.TOXISENSE_CONFIG.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error(`Prediction request failed with status ${response.status}`);
    }

    const data = await response.json();
    const prediction = String(data.prediction || "").toLowerCase();
    const severity = String(data.severity || "").toLowerCase();

    // Normalize the response once so the content script can stay simple.
    return {
      prediction,
      severity,
      isBullying: prediction === "bullying"
    };
  }

  return {
    predictText
  };
})();
