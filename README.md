# 🚀 Job Application Autofiller Extension

An intelligent, privacy-first Google Chrome extension that automates and streamlines the tedious job application process. Powered by the completely free Google Gemini API, this extension not only autofills standard form fields but uses AI to generate tailored answers for complex, multi-line questions based on your unique resume and profile.

## ✨ Features

- **⚡ Rule-Based Autofill:** Instantly populates standard fields like First Name, Last Name, Email, Phone, LinkedIn, and GitHub by intelligently matching labels and placeholders.
- **🤖 Full-Page AI Scanning:** With one click, the extension reads the entire job application and maps your profile data into complex, non-standard fields.
- **💡 Context-Aware AI Suggestions:** Injects a "✨ Suggest" button directly over text areas on job boards (like Greenhouse, Lever, Workday). The extension reads the job description and your profile to generate highly relevant, personalized answers.
- **🛡️ Privacy First (Human-in-the-Loop):** Your data never leaves your browser unless being sent securely to the Google API. All AI-generated responses appear in a beautifully designed, draggable Shadow DOM panel for you to review and edit before inserting.
- **⚙️ Robust API Fallbacks:** Engineered with an automatic failover system that seamlessly switches between Gemini models (`gemini-3.8-flash`, `gemini-flash-latest`, `gemini-3.5-flash`) to guarantee 100% uptime even during Google API high-demand spikes.
- **🎨 Modern Dashboard:** Features a sleek, responsive Options page for managing your profile, Custom Q&As, and your API Key securely.

## 📁 Project Structure

- `manifest.json`: Configuration file defining permissions (storage, activeTab), content scripts, and background service workers for Manifest V3.
- `background.js`: The powerhouse service worker that handles secure communication with the Google Gemini API, parses JSON responses, and executes the intelligent model-fallback logic.
- `content.js`: The frontend script injected into web pages. It parses form fields, implements Shadow DOM for styling isolation, handles dragging logic for the AI panel, and seamlessly inserts text into React-controlled inputs.
- `options.html` / `options.css` / `options.js`: A visually stunning dashboard where users configure their personal profile data, paste their resume, set custom Q&As, and manage their API key.
- `popup.html` / `popup.js`: The lightweight extension popup that triggers full-page AI scans and reports errors gracefully.
- `pdf.js`: Bundled locally to securely parse user resumes directly in the browser.

## 🚀 Setup Instructions

1. **Clone or Download** this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top right corner.
4. Click **Load unpacked** and select the `Job-Application-AutoFiller` directory.
5. Click the extension icon in your browser toolbar and select **Options** (or "Edit Profile").
6. **Get your API Key:** Follow the link in the options page to get a completely free API key from Google AI Studio. Paste it in.
7. Fill out your Personal Information, Resume, and any Custom Q&As. Click **Save**.

## 🛠️ Usage

1. Navigate to any supported job application board (e.g., Greenhouse, Lever).
2. The extension will automatically highlight standard fields it has populated.
3. For custom questions, look for the **✨ Suggest** button on text areas. Click it, drag the panel out of the way if needed, and let the AI draft a perfect response!
4. Click the extension icon in the Chrome toolbar and select **Auto-Fill Application** for a full-page AI sweep.

## 📜 License
MIT License
