chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Job Autofiller Extension Installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GENERATE_SUGGESTIONS') {
    handleGenerateSuggestions(request.payload)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Indicates we will send a response asynchronously
  }
  
  if (request.action === 'AI_FILL_FORM') {
    handleAIFillForm(request.payload)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
      
    return true;
  }
});

async function handleGenerateSuggestions({ question, jobDescription, maxLength }) {
  const data = await chrome.storage.local.get(['profile']);
  const profile = data.profile || {};
  
  if (!profile.apiKey) {
    throw new Error('API Key not found. Please set it in the extension options.');
  }

  const resume = profile.resumeText || '';
  const customQA = profile.customQA || [];
  
  let customQAContext = '';
  if (customQA.length > 0) {
    customQAContext = 'Custom predefined Q&A pairs to prioritize:\n' + customQA.map(qa => `Q: ${qa.q}\nA: ${qa.a}`).join('\n\n') + '\n';
  }

  const systemInstruction = `You are helping the user fill out a job application.
Write in the first person ("I").
ONLY use facts from the provided profile and resume. Do not invent employers, dates, or skills.
If the profile lacks the information to answer, state "NEEDS INPUT".
Provide 3 variants of the answer (e.g., short, detailed, different angle).
Keep answers concise and professional.
${maxLength ? `Do not exceed ${maxLength} characters per answer.` : ''}

Output strictly in JSON format as an array of 3 strings. Example:
["Short answer...", "More detailed answer...", "Another angle..."]
`;

  const userPrompt = `
Profile Information:
${JSON.stringify(profile, null, 2)}

Resume Text:
${resume}

${customQAContext}

Job Description Context:
${jobDescription || 'None provided'}

Question on Application:
"${question}"
`;

  const textResponse = await callGeminiAPI(systemInstruction, userPrompt, profile);
  let cleanText = textResponse.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  
  try {
    const suggestions = JSON.parse(cleanText);
    if (Array.isArray(suggestions)) {
      return suggestions;
    }
    return [textResponse]; // Fallback
  } catch (e) {
    console.error("Failed to parse JSON:", e);
    return [textResponse]; // Fallback if it didn't return valid JSON
  }
}

async function handleAIFillForm({ fields, jobDescription }) {
  const data = await chrome.storage.local.get(['profile']);
  const profile = data.profile || {};
  
  if (!profile.apiKey) {
    throw new Error('API Key not found. Please set it in the extension options.');
  }

  const resume = profile.resumeText || '';
  const customQA = profile.customQA || [];
  
  let customQAContext = '';
  if (customQA.length > 0) {
    customQAContext = 'Custom predefined Q&A pairs to prioritize:\n' + customQA.map(qa => `Q: ${qa.q}\nA: ${qa.a}`).join('\n\n') + '\n';
  }

  const systemInstruction = `You are an AI Job Autofiller. 
Your task is to analyze a list of form fields and output a JSON object mapping each field's "id" to the correct value to fill in.
ONLY use facts from the provided profile, resume, and Custom Q&A. 
Do not invent employers, dates, skills, or answers. 
If you do not know the answer or the profile lacks the information, simply omit that field's ID from the returned JSON.
For selects/dropdowns, try to match one of the provided options exactly.
Output ONLY a raw JSON object. Do not include markdown formatting or backticks. Example:
{"ai-field-0": "Customer Support Specialist", "ai-field-1": "Walmart"}
`;

  const userPrompt = `
Profile Information:
${JSON.stringify(profile, null, 2)}

Resume Text:
${resume}

${customQAContext}

Form Fields to Fill (JSON Array):
${JSON.stringify(fields, null, 2)}
`;

  const textResponse = await callGeminiAPI(systemInstruction, userPrompt, profile);
  let cleanText = textResponse.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse JSON:", e);
    throw new Error("AI returned invalid JSON mapping.");
  }
}

async function callGeminiAPI(systemInstruction, userPrompt, profile) {
  const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];
  let lastErrorMsg = '';

  for (const model of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${profile.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      if (!response.ok) {
        const err = await response.json();
        const msg = err.error?.message || 'Unknown error';
        lastErrorMsg = msg;
        if (response.status === 503 || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('overloaded')) {
          console.warn(`Model ${model} overloaded. Falling back to next...`);
          continue; 
        }
        if (msg.includes('not found') || msg.includes('not supported')) {
          continue; 
        }
        throw new Error(msg); 
      }

      const result = await response.json();
      return result.candidates[0].content.parts[0].text;
    } catch (e) {
      if (e.message.includes('high demand') || e.message.includes('overloaded') || e.message.includes('not found')) {
         continue;
      }
      throw e;
    }
  }
  
  try {
    const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${profile.apiKey}`);
    const listResult = await listResp.json();
    const available = listResult.models?.map(m => m.name.split('/')[1]).filter(m => m.includes('gemini')).join(', ') || 'None';
    lastErrorMsg += `\n[AVAILABLE MODELS ON YOUR KEY: ${available}]`;
  } catch(e) {}
  
  throw new Error(lastErrorMsg || "All models are currently overloaded. Please try again later.");
}
