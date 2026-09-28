// Rule-based filler for basic form fields
const MAPPINGS = {
  firstName: ['first name', 'given name', 'fname'],
  lastName: ['last name', 'family name', 'lname'],
  email: ['email', 'e-mail'],
  phone: ['phone', 'mobile', 'telephone', 'cell'],
  linkedin: ['linkedin', 'linked in'],
  github: ['github', 'git hub'],
  portfolio: ['portfolio', 'website', 'personal site'],
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'FILL_FORM') {
    fillForm();
  }
});

async function fillForm() {
  const data = await chrome.storage.local.get(['profile']);
  if (!data.profile) {
    alert('Please set up your profile in the extension options first.');
    return;
  }
  const profile = data.profile;
  
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), select, textarea');
  
  let filledCount = 0;

  // 1. Rule-based pass for basic fields
  inputs.forEach(input => {
    const labelText = getFieldLabel(input).toLowerCase();
    for (const [key, keywords] of Object.entries(MAPPINGS)) {
      if (keywords.some(kw => labelText.includes(kw))) {
        if (profile[key] && !input.value) {
          setNativeValue(input, profile[key]);
          filledCount++;
          input.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
          input.style.border = '1px solid #3b82f6';
        }
        break;
      }
    }
  });

  // 2. AI pass for everything else
  showToast('✨ AI is scanning and filling remaining fields...');
  
  const fields = [];
  const fieldMap = new Map();
  let i = 0;
  
  inputs.forEach(input => {
    // Skip if already filled or has value (unless select, which often has placeholder)
    if (input.value && input.tagName.toLowerCase() !== 'select' && input.value.trim().length > 0) return;
    
    const label = getFieldLabel(input);
    if (!label || label.trim() === '') return;
    
    const aiId = `ai-field-${i++}`;
    fieldMap.set(aiId, input);
    
    const fieldData = {
      id: aiId,
      type: input.tagName.toLowerCase(),
      inputType: input.type,
      label: label
    };
    
    if (fieldData.type === 'select') {
      fieldData.options = Array.from(input.options).map(opt => opt.text).join(' | ');
    }
    
    fields.push(fieldData);
  });
  
  if (fields.length === 0) {
    showToast(filledCount > 0 ? `Autofilled ${filledCount} basic fields. No empty fields left for AI.` : 'No fillable fields found.');
    return;
  }
  
  try {
    chrome.runtime.sendMessage({
      action: 'AI_FILL_FORM',
      payload: { fields, jobDescription: document.body.innerText.substring(0, 3000) }
    }, response => {
      if (chrome.runtime.lastError) {
        showToast('Error: Connection lost. Please refresh the page.', true);
        return;
      }
      if (!response || !response.success) {
        showToast(`Error: ${response?.error || 'Unknown error'}`, true);
        return;
      }
      
      const mapping = response.data;
    let aiFilledCount = 0;
    
    for (const [aiId, value] of Object.entries(mapping)) {
      const el = fieldMap.get(aiId);
      if (el && value) {
        setNativeValue(el, value);
        el.style.backgroundColor = 'rgba(139, 92, 246, 0.1)';
        el.style.border = '1px solid #8b5cf6';
        aiFilledCount++;
      }
    }
    
    showToast(`✨ AI Autofilled ${aiFilledCount} advanced fields!`);
  });
  } catch (err) {
    showToast('Error: Connection lost. Please refresh the page.', true);
  }
}

function showToast(msg, isError = false) {
  let toast = document.getElementById('ai-autofill-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ai-autofill-toast';
    toast.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 9999999;
      background: #1e293b; color: #f8fafc; padding: 12px 20px;
      border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-family: sans-serif; font-size: 14px; border-left: 4px solid #8b5cf6;
      transition: opacity 0.3s;
    `;
    document.body.appendChild(toast);
  }
  toast.style.borderLeftColor = isError ? '#ef4444' : '#8b5cf6';
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 4000);
}

function getFieldLabel(input) {
  let text = '';
  // 1. Placeholder
  if (input.placeholder) text += ' ' + input.placeholder;
  // 2. Name attribute
  if (input.name) text += ' ' + input.name;
  // 3. ID attribute
  if (input.id) text += ' ' + input.id;
  // 4. aria-label
  if (input.getAttribute('aria-label')) text += ' ' + input.getAttribute('aria-label');
  
  // 5. Associated <label>
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) text += ' ' + label.textContent;
  }
  
  // 6. Closest parent label if nested
  const parentLabel = input.closest('label');
  if (parentLabel) text += ' ' + parentLabel.textContent;
  
  return text.trim();
}

// React and other frameworks override standard setters, so we need to bypass them to trigger events properly
function setNativeValue(element, value) {
  let lastValue = element.value;
  
  if (element.tagName.toLowerCase() === 'select') {
    let found = false;
    for (let i = 0; i < element.options.length; i++) {
      if (element.options[i].text.toLowerCase() === value.toLowerCase() || 
          element.options[i].value.toLowerCase() === value.toLowerCase()) {
        element.selectedIndex = i;
        found = true;
        break;
      }
    }
    if (!found) element.value = value;
  } else {
    element.value = value;
  }
  
  let event = new Event('input', { bubbles: true });
  // Hack for React 15/16
  event.simulated = true;
  // Hack for React 16 (Tracker object bypass)
  let tracker = element._valueTracker;
  if (tracker) {
    tracker.setValue(lastValue);
  }
  
  element.dispatchEvent(event);
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

// --- AI SUGGESTION FEATURE ---

function initSuggestButtons() {
  const textareas = document.querySelectorAll('textarea');
  textareas.forEach(textarea => {
    // Only add if not already added
    if (textarea.parentElement.querySelector('.ai-suggest-btn')) return;

    // Create wrapper if needed or just append next to it
    const btn = document.createElement('button');
    btn.textContent = '✨ Suggest';
    btn.className = 'ai-suggest-btn';
    btn.style.cssText = `
      position: absolute;
      right: 10px;
      top: 10px;
      z-index: 100;
      background: #8b5cf6;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      font-family: sans-serif;
    `;

    // Make sure parent is positioned so absolute positioning works
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'block';
    
    textarea.parentNode.insertBefore(wrapper, textarea);
    wrapper.appendChild(textarea);
    wrapper.appendChild(btn);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      showSuggestionPanel(textarea, btn);
    });
  });
}

async function showSuggestionPanel(textarea, btn) {
  const label = getFieldLabel(textarea);
  const maxLength = textarea.getAttribute('maxlength') || null;
  // Try to get page body context for job description
  const jobDescription = document.body.innerText.substring(0, 3000); // Send first 3000 chars as context

  // Create Shadow DOM panel
  let panelHost = document.getElementById('ai-suggest-panel-host');
  if (!panelHost) {
    panelHost = document.createElement('div');
    panelHost.id = 'ai-suggest-panel-host';
    document.body.appendChild(panelHost);
  }
  
  const shadow = panelHost.shadowRoot || panelHost.attachShadow({ mode: 'open' });
  
  // Position panel near the button
  const rect = btn.getBoundingClientRect();
  
  shadow.innerHTML = `
    <style>
      .panel {
        position: fixed;
        top: ${rect.bottom + window.scrollY + 10}px;
        left: ${rect.left + window.scrollX}px;
        width: 350px;
        background: #1e293b;
        color: #f8fafc;
        border: 1px solid #334155;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        font-family: 'Inter', sans-serif;
        z-index: 999999;
      }
      .panel-header {
        cursor: grab;
        padding: 14px 16px;
        border-bottom: 1px solid #334155;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #1e293b;
        border-radius: 8px 8px 0 0;
      }
      .panel-header:active {
        cursor: grabbing;
      }
      .panel h3 { margin: 0; font-size: 14px; user-select: none; }
      .panel-body { padding: 16px; max-height: 400px; overflow-y: auto; }
      .suggestion {
        background: #334155;
        padding: 10px;
        border-radius: 6px;
        margin-bottom: 10px;
        font-size: 13px;
      }
      .actions { display: flex; gap: 8px; margin-top: 8px; }
      button {
        background: #3b82f6; color: white; border: none; 
        padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;
      }
      button.copy { background: #475569; }
      .loading { text-align: center; color: #94a3b8; }
      .close-btn { background: transparent; color: #94a3b8; padding: 0; font-size: 18px; line-height: 1; cursor: pointer; }
      .close-btn:hover { color: #f8fafc; }
    </style>
    <div class="panel">
      <div class="panel-header" id="drag-handle">
        <h3>✨ AI Suggestions</h3>
        <button class="close-btn">&times;</button>
      </div>
      <div class="panel-body" id="content">
        <div class="loading">Generating ideas...</div>
      </div>
    </div>
  `;

  const closeBtn = shadow.querySelector('.close-btn');
  closeBtn.addEventListener('click', () => {
    panelHost.remove();
  });

  // Dragging logic
  const panel = shadow.querySelector('.panel');
  const dragHandle = shadow.getElementById('drag-handle');
  let isDragging = false;
  let initialX, initialY;
  let xOffset = rect.left + window.scrollX;
  let yOffset = rect.bottom + window.scrollY + 10;

  const mouseMoveHandler = (e) => drag(e);
  const mouseUpHandler = () => dragEnd();

  dragHandle.addEventListener('mousedown', (e) => {
    if (e.target === closeBtn) return;
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    isDragging = true;
    window.addEventListener('mousemove', mouseMoveHandler);
    window.addEventListener('mouseup', mouseUpHandler);
  });

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      xOffset = e.clientX - initialX;
      yOffset = e.clientY - initialY;
      panel.style.left = xOffset + 'px';
      panel.style.top = yOffset + 'px';
    }
  }

  function dragEnd() {
    isDragging = false;
    window.removeEventListener('mousemove', mouseMoveHandler);
    window.removeEventListener('mouseup', mouseUpHandler);
  }

  // Call Background Worker
  try {
    chrome.runtime.sendMessage({
      action: 'GENERATE_SUGGESTIONS',
      payload: { question: label, jobDescription, maxLength }
    }, response => {
      const content = shadow.getElementById('content');
      if (chrome.runtime.lastError) {
        content.innerHTML = `<div style="color: #ef4444;">Error: Extension updated. Please refresh the page.</div>`;
        return;
      }
      if (!response || !response.success) {
        content.innerHTML = `<div style="color: #ef4444;">Error: ${response?.error || 'Unknown error'}</div>`;
        return;
      }

      const suggestions = response.data;
    content.innerHTML = '';
    
    suggestions.forEach((text, i) => {
      const div = document.createElement('div');
      div.className = 'suggestion';
      
      const textSpan = document.createElement('div');
      // Highlight "NEEDS INPUT"
      textSpan.innerHTML = text.replace(/NEEDS INPUT/g, '<strong style="color: #fbbf24;">NEEDS INPUT</strong>');
      div.appendChild(textSpan);
      
      const actions = document.createElement('div');
      actions.className = 'actions';
      
      const insertBtn = document.createElement('button');
      insertBtn.textContent = 'Insert';
      insertBtn.onclick = () => {
        setNativeValue(textarea, text);
        panelHost.remove();
      };
      
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy';
      copyBtn.textContent = 'Copy';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(text);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy', 2000);
      };
      
      actions.appendChild(insertBtn);
      actions.appendChild(copyBtn);
      div.appendChild(actions);
      content.appendChild(div);
    });
  });
  } catch (err) {
    const content = shadow.getElementById('content');
    content.innerHTML = `<div style="color: #ef4444;">Error: Extension updated. Please refresh the page.</div>`;
  }
}

// Run initialization periodically to catch dynamically loaded fields
setInterval(initSuggestButtons, 2000);
