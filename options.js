document.addEventListener('DOMContentLoaded', () => {
  // Load saved profile
  chrome.storage.local.get(['profile'], (result) => {
    if (result.profile) {
      const p = result.profile;
      document.getElementById('firstName').value = p.firstName || '';
      document.getElementById('lastName').value = p.lastName || '';
      document.getElementById('email').value = p.email || '';
      document.getElementById('phone').value = p.phone || '';
      document.getElementById('linkedin').value = p.linkedin || '';
      document.getElementById('github').value = p.github || '';
      document.getElementById('portfolio').value = p.portfolio || '';
      document.getElementById('apiKey').value = p.apiKey || '';
      document.getElementById('resumeText').value = p.resumeText || '';

      if (p.customQA && Array.isArray(p.customQA)) {
        p.customQA.forEach(qa => addQAItem(qa.q, qa.a));
      }
    }
  });

  function addQAItem(q = '', a = '') {
    const container = document.getElementById('qa-container');
    const item = document.createElement('div');
    item.className = 'qa-item';
    item.innerHTML = `
      <div class="qa-inputs">
        <input type="text" class="qa-q" placeholder="Question (e.g., Are you authorized to work in the US?)" value="${q.replace(/"/g, '&quot;')}">
        <textarea class="qa-a" rows="2" placeholder="Answer (e.g., Yes, I am authorized...)">${a.replace(/</g, '&lt;')}</textarea>
      </div>
      <button type="button" class="remove-btn">X</button>
    `;
    item.querySelector('.remove-btn').addEventListener('click', () => item.remove());
    container.appendChild(item);
  }

  document.getElementById('add-qa-btn').addEventListener('click', () => addQAItem());

  // Save profile
  document.getElementById('profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const profile = {
      firstName: document.getElementById('firstName').value,
      lastName: document.getElementById('lastName').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      linkedin: document.getElementById('linkedin').value,
      github: document.getElementById('github').value,
      portfolio: document.getElementById('portfolio').value,
      apiKey: document.getElementById('apiKey').value,
      resumeText: document.getElementById('resumeText').value,
      customQA: Array.from(document.querySelectorAll('.qa-item')).map(item => ({
        q: item.querySelector('.qa-q').value,
        a: item.querySelector('.qa-a').value
      })).filter(qa => qa.q.trim() !== '')
    };

    chrome.storage.local.set({ profile }, () => {
      const status = document.getElementById('save-status');
      status.textContent = 'Profile saved successfully!';
      status.className = 'status-msg success show';
      setTimeout(() => {
        status.className = 'status-msg';
      }, 3000);
    });
  });

  // Handle PDF upload
  const resumeFileInput = document.getElementById('resumeFile');
  if (resumeFileInput) {
    resumeFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.type !== 'application/pdf') {
        alert('Please select a valid PDF file.');
        return;
      }
      
      const status = document.getElementById('save-status');
      status.textContent = 'Extracting text from PDF...';
      status.className = 'status-msg show';
      
      try {
        // Set worker src
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n\n';
        }
        
        document.getElementById('resumeText').value = fullText.trim();
        status.textContent = 'PDF text extracted! Please review and click Save.';
        status.className = 'status-msg success show';
        setTimeout(() => {
          status.className = 'status-msg';
        }, 4000);
      } catch (err) {
        console.error('Error parsing PDF:', err);
        status.textContent = 'Error parsing PDF. Try pasting text instead.';
        status.className = 'status-msg error show';
        setTimeout(() => {
          status.className = 'status-msg';
        }, 4000);
      }
    });
  }
});
