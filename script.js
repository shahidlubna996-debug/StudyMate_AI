// ---- Tab switching ----
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

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
    document.getElementById(outputId).innerHTML = `<div class="answer-card">${escapeHtml(text)}</div>`;
  }catch(err){
    showError(outputId, err.message || 'AI request failed');
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
    document.getElementById(outputId).innerHTML = `<div class="answer-card">${escapeHtml(text)}</div>`;
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