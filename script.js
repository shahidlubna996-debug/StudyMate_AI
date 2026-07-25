// ---- Tab switching ----
function moveIndicator(tabEl){
  const indicator = document.getElementById('tab-indicator');
  if(!indicator || !tabEl) return;
  indicator.style.left = tabEl.offsetLeft + 'px';
  indicator.style.width = tabEl.offsetWidth + 'px';
}
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    moveIndicator(tab);
  });
});
window.addEventListener('load', () => moveIndicator(document.querySelector('.tab.active')));
window.addEventListener('resize', () => moveIndicator(document.querySelector('.tab.active')));

// ---- Quote of the Day (uses a free public quotes API, no key needed) ----
async function loadDailyQuote(){
  const banner = document.getElementById('quote-banner');
  try{
    // Same "seed" all day = same quote all day, changes automatically at midnight
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const params = new URLSearchParams({ order: 'random', seed: today, limit: 1, category: 'motivation' });
    const res = await fetch(`https://quotesapi.prayushadhikari.com.np/api/quotes?${params}`);
    const { data } = await res.json();
    const q = data[0];
    banner.innerHTML = `"${escapeHtml(q.quote)}"<span class="quote-author">— ${escapeHtml(q.author)}</span>`;
  }catch(err){
    banner.innerHTML = `<span class="quote-loading">Stay curious — every topic makes sense eventually.</span>`;
  }
}
loadDailyQuote();

function fillTopic(inputId, value){
  document.getElementById(inputId).value = value;
}

function showLoading(outputId, text){
  document.getElementById(outputId).innerHTML =
    `<div class="loading">${text}<span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
}

function showError(outputId, msg){
  document.getElementById(outputId).innerHTML = `<div class="error">Something went wrong: ${msg}. Please try again.</div>`;
}

// ---- 1. Explain a topic ----
async function explainTopic(){
  const topic = document.getElementById('explain-input').value.trim();
  const outputId = 'explain-output';
  if(!topic){ showError(outputId, 'please type a topic first'); return; }

  showLoading(outputId, 'Thinking');
  try{
    const prompt = `Explain the concept "${topic}" in simple, plain language for a student who has never heard of it. 
Keep it under 150 words. Include one short, concrete example. Do not use markdown headers, just plain text with short paragraphs.`;

    const response = await puter.ai.chat(prompt, { model: 'claude-sonnet-5' });
    const text = extractText(response);
    document.getElementById(outputId).innerHTML = `
      <div class="answer-card">${escapeHtml(text)}</div>
      <button class="listen-btn" onclick="speakText(this, ${JSON.stringify(text)})">🔊 Read Aloud</button>
      <div class="wiki-card" id="wiki-card"><span class="quote-loading">Looking up Wikipedia...</span></div>
    `;
    loadWikipediaSummary(topic);
  }catch(err){
    showError(outputId, err.message || 'AI request failed');
  }
}

// ---- Read Aloud (built into the browser, no external API needed) ----
let cachedVoices = [];
function loadVoices(){
  cachedVoices = window.speechSynthesis.getVoices();
}
if('speechSynthesis' in window){
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices; // Chrome loads voices asynchronously
}

function speakText(button, text){
  if(!('speechSynthesis' in window)){
    button.textContent = 'Not supported in this browser';
    return;
  }
  window.speechSynthesis.cancel(); // stop anything already playing

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.volume = 1;
  utterance.pitch = 1;
  utterance.lang = 'en-US';

  const englishVoice = cachedVoices.find(v => v.lang && v.lang.startsWith('en'));
  if(englishVoice) utterance.voice = englishVoice;

  button.disabled = true;
  button.textContent = '🔊 Reading...';
  utterance.onend = () => { button.disabled = false; button.textContent = '🔊 Read Aloud'; };
  utterance.onerror = (e) => {
    console.error('Speech synthesis error:', e.error);
    button.disabled = false;
    button.textContent = '🔊 Read Aloud (error — see console)';
  };

  // Small delay works around a known Chrome bug where speak() right after cancel() can fail silently
  setTimeout(() => window.speechSynthesis.speak(utterance), 50);
}

// ---- Wikipedia lookup (free public API, no key needed) ----
async function loadWikipediaSummary(topic){
  const card = document.getElementById('wiki-card');
  if(!card) return;
  try{
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`);
    if(!res.ok) throw new Error('not found');
    const data = await res.json();
    card.innerHTML = `
      <span class="wiki-label">From Wikipedia</span>
      <p>${escapeHtml(data.extract || '')}</p>
      <a href="${data.content_urls?.desktop?.page || '#'}" target="_blank" rel="noopener">Read more on Wikipedia →</a>
    `;
  }catch(err){
    card.innerHTML = `<span class="wiki-label">From Wikipedia</span><p>No matching Wikipedia article found for this topic.</p>`;
  }
}

// ---- 2. Generate a quiz ----
async function generateQuiz(){
  const topic = document.getElementById('quiz-input').value.trim();
  const outputId = 'quiz-output';
  if(!topic){ showError(outputId, 'please type a topic first'); return; }

  showLoading(outputId, 'Building your quiz');
  try{
    const prompt = `Create exactly 5 multiple-choice practice questions about "${topic}" for a student.
Respond with ONLY valid JSON, no markdown fences, no extra text, in this exact format:
[{"question":"...", "options":["...","...","...","..."], "correctIndex":0}, ...]
Each question must have exactly 4 options and correctIndex must be the 0-based index of the correct option.`;

    const response = await puter.ai.chat(prompt, { model: 'claude-sonnet-5' });
    let text = extractText(response);
    text = text.trim().replace(/^```json/i, '').replace(/^```/,'').replace(/```$/,'').trim();

    const questions = JSON.parse(text);
    renderQuiz(questions, outputId);
  }catch(err){
    showError(outputId, 'could not generate quiz, try a simpler topic');
  }
}

function renderQuiz(questions, outputId){
  const container = document.getElementById(outputId);
  container.innerHTML = '';
  questions.forEach((q, qi) => {
    const qDiv = document.createElement('div');
    qDiv.className = 'quiz-q';
    const qText = document.createElement('div');
    qText.className = 'qtext';
    qText.textContent = `${qi+1}. ${q.question}`;
    qDiv.appendChild(qText);

    q.options.forEach((opt, oi) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-opt';
      btn.textContent = opt;
      btn.onclick = () => {
        const allOpts = qDiv.querySelectorAll('.quiz-opt');
        allOpts.forEach(b => b.disabled = true);
        if(oi === q.correctIndex){
          btn.classList.add('correct');
        } else {
          btn.classList.add('wrong');
          allOpts[q.correctIndex].classList.add('correct');
        }
      };
      qDiv.appendChild(btn);
    });
    container.appendChild(qDiv);
  });
}

// ---- 3. Summarize notes ----
async function summarizeNotes(){
  const notes = document.getElementById('notes-input').value.trim();
  const outputId = 'summarize-output';
  if(!notes){ showError(outputId, 'please paste some notes first'); return; }

  showLoading(outputId, 'Summarizing');
  try{
    const prompt = `Summarize these student notes. First give a 2-3 sentence overview, then a bullet list (using "- ") of the key points.
Keep it concise. Do not use markdown headers or bold.

Notes:
${notes}`;

    const response = await puter.ai.chat(prompt, { model: 'claude-sonnet-5' });
    const text = extractText(response);
    document.getElementById(outputId).innerHTML = `
      <div class="answer-card">${escapeHtml(text)}</div>
      <button class="listen-btn" onclick="speakText(this, ${JSON.stringify(text)})">🔊 Read Aloud</button>
    `;
  }catch(err){
    showError(outputId, err.message || 'AI request failed');
  }
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Pulls plain text out of whatever shape Puter's response comes back as.
function extractText(response){
  if (typeof response === 'string') return response;
  const msg = response.message || response;
  const content = msg.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(block => (typeof block === 'string' ? block : (block.text || ''))).join('');
  }
  return String(response);
}
