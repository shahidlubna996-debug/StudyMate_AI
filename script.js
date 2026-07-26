/* =========================================================
   StudyMate AI — script.js
   This file has 3 main jobs:
     1. Switch between the 3 tabs (Explain / Quiz / Summarize)
     2. Send the user's question to the AI using Puter.js
     3. Show the AI's answer back on the page
   ========================================================= */


/* ---------- 1. Tab switching ---------- */
// Find every button with class "tab" and listen for clicks on them.
var allTabs = document.querySelectorAll('.tab');

for (var i = 0; i < allTabs.length; i++) {
  allTabs[i].addEventListener('click', function () {

    // first, turn off "active" on every tab and every panel
    var tabs = document.querySelectorAll('.tab');
    var panels = document.querySelectorAll('.panel');
    for (var j = 0; j < tabs.length; j++) { tabs[j].classList.remove('active'); }
    for (var k = 0; k < panels.length; k++) { panels[k].classList.remove('active'); }

    // then turn "active" back on just for the one that was clicked
    this.classList.add('active');
    var panelName = this.dataset.tab; // "explain", "quiz", or "summarize"
    document.getElementById('panel-' + panelName).classList.add('active');
  });
}


/* ---------- Quote of the Day ----------
   This uses a free quotes API (no sign up, no API key needed).
   We use today's date as a "seed" so the quote stays the same
   all day and only changes once a day. */
async function loadDailyQuote() {
  var quoteBox = document.getElementById('quote-banner');

  try {
    var today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    var url = 'https://quotesapi.prayushadhikari.com.np/api/quotes?order=random&seed=' + today + '&limit=1&category=motivation';

    var response = await fetch(url);
    var result = await response.json();
    var quote = result.data[0];

    quoteBox.innerHTML = '"' + escapeHtml(quote.quote) + '"' +
      '<span class="quote-author">— ' + escapeHtml(quote.author) + '</span>';

  } catch (err) {
    // if the API is down or there's no internet, just show a backup message
    quoteBox.innerHTML = '<span class="quote-loading">Stay curious — every topic makes sense eventually.</span>';
  }
}
loadDailyQuote();


/* ---------- Small helper functions used in a few places ---------- */

// fills an input box with example text when you click a chip
function fillTopic(inputId, value) {
  document.getElementById(inputId).value = value;
}

// shows a "Thinking..." message while we wait for the AI to answer
function showLoading(outputId, message) {
  document.getElementById(outputId).innerHTML =
    '<div class="loading">' + message + '<span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
}

// shows a red error message if something goes wrong
function showError(outputId, message) {
  document.getElementById(outputId).innerHTML =
    '<div class="error">Something went wrong: ' + message + '. Please try again.</div>';
}

// makes sure the AI's text can't accidentally break our HTML
function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Puter's AI reply doesn't always come back as a simple string.
// Sometimes it's an object, sometimes the text is split into pieces.
// This function checks each possible shape and pulls the plain text out.
function extractText(response) {
  if (typeof response === 'string') {
    return response;
  }

  var message = response.message ? response.message : response;
  var content = message.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    var combined = '';
    for (var i = 0; i < content.length; i++) {
      var piece = content[i];
      if (typeof piece === 'string') {
        combined += piece;
      } else if (piece && piece.text) {
        combined += piece.text;
      }
    }
    return combined;
  }

  return String(response);
}


/* ---------- FEATURE 1: Explain a topic ---------- */
async function explainTopic() {
  var topic = document.getElementById('explain-input').value.trim();
  var outputId = 'explain-output';

  if (topic === '') {
    showError(outputId, 'please type a topic first');
    return;
  }

  showLoading(outputId, 'Thinking');

  try {
    var prompt = 'Explain the concept "' + topic + '" in simple, plain language for a student who has never heard of it. ' +
      'Keep it under 150 words. Include one short, concrete example. ' +
      'Do not use markdown headers, just plain text with short paragraphs.';

    var response = await puter.ai.chat(prompt, { model: 'claude-sonnet-5' });
    var text = extractText(response);

    document.getElementById(outputId).innerHTML =
      '<button class="listen-btn" onclick="speakFromElement(\'explain-answer-text\', this)">🔊 Read Aloud</button>' +
      '<div class="answer-card" id="explain-answer-text">' + escapeHtml(text) + '</div>' +
      '<div class="wiki-card" id="wiki-card"><span class="quote-loading">Looking up Wikipedia...</span></div>';

    // also look up this topic on Wikipedia while we're at it
    loadWikipediaSummary(topic);

  } catch (err) {
    showError(outputId, err.message || 'AI request failed');
  }
}


/* ---------- Wikipedia lookup ----------
   Free public API, no API key needed. This runs automatically
   after "Explain This" gives an answer. */
async function loadWikipediaSummary(topic) {
  var card = document.getElementById('wiki-card');
  if (!card) return;

  try {
    var url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(topic);
    var response = await fetch(url);

    if (!response.ok) {
      throw new Error('no article found');
    }

    var data = await response.json();

    // figure out the wikipedia link safely, without assuming it always exists
    var pageLink = '#';
    if (data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page) {
      pageLink = data.content_urls.desktop.page;
    }

    card.innerHTML =
      '<span class="wiki-label">From Wikipedia</span>' +
      '<p>' + escapeHtml(data.extract || '') + '</p>' +
      '<a href="' + pageLink + '" target="_blank" rel="noopener">Read more on Wikipedia →</a>';

    // Wikipedia sometimes gives us a small picture for the topic too.
    // If it's there, we add it above the answer text so the explanation
    // isn't just plain words.
    if (data.thumbnail && data.thumbnail.source) {
      var answerBox = document.getElementById('explain-answer-text');
      if (answerBox) {
        var img = document.createElement('img');
        img.className = 'topic-image';
        img.src = data.thumbnail.source;
        img.alt = topic;
        answerBox.parentNode.insertBefore(img, answerBox);
      }
    }

  } catch (err) {
    card.innerHTML = '<span class="wiki-label">From Wikipedia</span><p>No matching Wikipedia article found for this topic.</p>';
  }
}


/* ---------- Read Aloud ----------
   This uses the browser's own built-in text-to-speech feature
   (called the Web Speech API). No external service needed at all. */

// the list of available voices loads slightly late in some browsers,
// so we grab it as soon as it's ready and keep it saved here
var savedVoices = [];
function saveVoicesWhenReady() {
  savedVoices = window.speechSynthesis.getVoices();
}
if ('speechSynthesis' in window) {
  saveVoicesWhenReady();
  window.speechSynthesis.onvoiceschanged = saveVoicesWhenReady;
}

function speakFromElement(elementId, button) {
  var textElement = document.getElementById(elementId);
  if (!textElement) return;

  // read the text straight from the page instead of passing it through
  // an HTML attribute — this avoids the quote-escaping bug entirely
  var text = textElement.textContent;

  if (!('speechSynthesis' in window)) {
    button.textContent = 'Not supported in this browser';
    return;
  }

  window.speechSynthesis.cancel(); // stop anything that's already playing

  var utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.lang = 'en-US';

  // try to pick an English voice if one is available
  for (var i = 0; i < savedVoices.length; i++) {
    if (savedVoices[i].lang && savedVoices[i].lang.indexOf('en') === 0) {
      utterance.voice = savedVoices[i];
      break;
    }
  }

  button.disabled = true;
  button.textContent = '🔊 Reading...';

  utterance.onend = function () {
    button.disabled = false;
    button.textContent = '🔊 Read Aloud';
  };
  utterance.onerror = function () {
    button.disabled = false;
    button.textContent = '🔊 Read Aloud';
  };

  // a tiny delay here avoids a known Chrome bug where speak() right
  // after cancel() can silently do nothing
  setTimeout(function () {
    window.speechSynthesis.speak(utterance);
  }, 50);
}


/* ---------- FEATURE 2: Generate a quiz ---------- */
async function generateQuiz() {
  var topic = document.getElementById('quiz-input').value.trim();
  var outputId = 'quiz-output';

  if (topic === '') {
    showError(outputId, 'please type a topic first');
    return;
  }

  showLoading(outputId, 'Building your quiz');

  try {
    var prompt = 'Create exactly 5 multiple-choice practice questions about "' + topic + '" for a student.\n' +
      'Respond with ONLY valid JSON, no markdown fences, no extra text, in this exact format:\n' +
      '[{"question":"...", "options":["...","...","...","..."], "correctIndex":0}, ...]\n' +
      'Each question must have exactly 4 options and correctIndex must be the 0-based index of the correct option.';

    var response = await puter.ai.chat(prompt, { model: 'claude-sonnet-5' });
    var text = extractText(response);

    // sometimes the AI wraps its JSON answer in ```json fences, so we strip those off
    text = text.trim();
    text = text.replace(/^```json/i, '');
    text = text.replace(/^```/, '');
    text = text.replace(/```$/, '');
    text = text.trim();

    var questions = JSON.parse(text);
    renderQuiz(questions, outputId);

  } catch (err) {
    showError(outputId, 'could not generate quiz, try a simpler topic');
  }
}

// builds the actual clickable quiz questions on the page
function renderQuiz(questions, outputId) {
  var container = document.getElementById(outputId);
  container.innerHTML = '';

  for (var q = 0; q < questions.length; q++) {
    var question = questions[q];

    var questionBox = document.createElement('div');
    questionBox.className = 'quiz-q';

    var questionText = document.createElement('div');
    questionText.className = 'qtext';
    questionText.textContent = (q + 1) + '. ' + question.question;
    questionBox.appendChild(questionText);

    // this "closure trick" (wrapping in a function) makes sure each
    // button remembers its own question and option number correctly
    (function (question, questionBox) {
      for (var o = 0; o < question.options.length; o++) {
        (function (optionIndex) {
          var optionButton = document.createElement('button');
          optionButton.className = 'quiz-opt';
          optionButton.textContent = question.options[optionIndex];

          optionButton.onclick = function () {
            var allOptionButtons = questionBox.querySelectorAll('.quiz-opt');
            for (var a = 0; a < allOptionButtons.length; a++) {
              allOptionButtons[a].disabled = true;
            }

            if (optionIndex === question.correctIndex) {
              optionButton.classList.add('correct');
            } else {
              optionButton.classList.add('wrong');
              allOptionButtons[question.correctIndex].classList.add('correct');
            }
          };

          questionBox.appendChild(optionButton);
        })(o);
      }
    })(question, questionBox);

    container.appendChild(questionBox);
  }
}


/* ---------- FEATURE 3: Summarize notes ---------- */
async function summarizeNotes() {
  var notes = document.getElementById('notes-input').value.trim();
  var outputId = 'summarize-output';

  if (notes === '') {
    showError(outputId, 'please paste some notes first');
    return;
  }

  showLoading(outputId, 'Summarizing');

  try {
    var prompt = 'Summarize these student notes. First give a 2-3 sentence overview, then a bullet list (using "- ") of the key points.\n' +
      'Keep it concise. Do not use markdown headers or bold.\n\n' +
      'Notes:\n' + notes;

    var response = await puter.ai.chat(prompt, { model: 'claude-sonnet-5' });
    var text = extractText(response);

    document.getElementById(outputId).innerHTML =
      '<div class="answer-card">' + escapeHtml(text) + '</div>';

  } catch (err) {
    showError(outputId, err.message || 'AI request failed');
  }
}


/* ---------- FEATURE 4: Career Advisor ---------- */
async function getCareerAdvice() {
  var input = document.getElementById('career-input').value.trim();
  var outputId = 'career-output';

  if (input === '') {
    showError(outputId, 'please tell me a bit about your interests first');
    return;
  }

  showLoading(outputId, 'Thinking about what could fit you');

  try {
    var prompt = 'A student is confused about which career to pursue. Here is what they told you about ' +
      'themselves, their interests, subjects they like or dislike, and their doubts:\n\n"' + input + '"\n\n' +
      'Based on this, suggest exactly 3 career paths that could genuinely fit them. For each one, give: ' +
      'the career name, 2-3 sentences on why it could suit them based on what they said, and one practical ' +
      'next step they could take this month (like a subject to focus on, a free course, or a skill to try). ' +
      'Be warm and encouraging, not generic. Do not use markdown headers or bold, just plain numbered text.';

    var response = await puter.ai.chat(prompt, { model: 'claude-sonnet-5' });
    var text = extractText(response);

    document.getElementById(outputId).innerHTML =
      '<div class="answer-card">' + escapeHtml(text) + '</div>';

  } catch (err) {
    showError(outputId, err.message || 'AI request failed');
  }
}


/* =========================================================
   STUDY PLANNER (left sidebar)
   A simple to-do list. Tasks are saved using localStorage,
   which is just a small storage box built into the browser —
   it keeps the tasks even if you close the tab or restart
   your computer, until you clear your browser data.
   ========================================================= */

var plannerTasks = [];

// when the page first loads, try to load any tasks saved from before
function loadPlannerTasks() {
  var saved = localStorage.getItem('studymate-planner-tasks');
  if (saved) {
    plannerTasks = JSON.parse(saved);
  }
  renderPlannerTasks();
}

// saves the current task list into the browser's storage
function savePlannerTasks() {
  localStorage.setItem('studymate-planner-tasks', JSON.stringify(plannerTasks));
}

// draws the task list on the page based on the plannerTasks array
function renderPlannerTasks() {
  var list = document.getElementById('planner-list');
  list.innerHTML = '';

  if (plannerTasks.length === 0) {
    list.innerHTML = '<li class="planner-empty">No tasks yet. Add one above!</li>';
    return;
  }

  for (var i = 0; i < plannerTasks.length; i++) {
    (function (index) {
      var task = plannerTasks[index];

      var item = document.createElement('li');
      item.className = 'planner-item' + (task.done ? ' done' : '');

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.done;
      checkbox.onchange = function () {
        plannerTasks[index].done = checkbox.checked;
        savePlannerTasks();
        renderPlannerTasks();
      };

      var text = document.createElement('span');
      text.className = 'task-text';
      text.textContent = task.text;

      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '✕';
      deleteBtn.onclick = function () {
        plannerTasks.splice(index, 1);
        savePlannerTasks();
        renderPlannerTasks();
      };

      item.appendChild(checkbox);
      item.appendChild(text);
      item.appendChild(deleteBtn);
      list.appendChild(item);
    })(i);
  }
}

function addPlannerTask() {
  var input = document.getElementById('planner-input');
  var value = input.value.trim();
  if (value === '') return;

  plannerTasks.push({ text: value, done: false });
  input.value = '';
  savePlannerTasks();
  renderPlannerTasks();
}

// hook up the "+" button and also let Enter key add a task
document.getElementById('planner-add-btn').addEventListener('click', addPlannerTask);
document.getElementById('planner-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') addPlannerTask();
});

loadPlannerTasks();


/* =========================================================
   BRAIN BREAK MEMORY GAME (right sidebar)
   A simple flip-and-match game with 4 pairs of emoji (8 cards).
   Click 2 cards — if they match, they stay revealed.
   If not, they flip back after a second.
   ========================================================= */

var memoryCards = [];       // the shuffled list of emoji for this game
var flippedCards = [];      // holds the 1 or 2 cards currently flipped
var matchedCount = 0;       // how many pairs have been matched so far
var boardIsBusy = false;    // true while we're showing a "no match" briefly

function startMemoryGame() {
  var emojiPairs = ['📚', '✏️', '🧠', '🔬'];
  var deck = emojiPairs.concat(emojiPairs); // 2 of each = 8 cards

  // shuffle the deck randomly
  for (var i = deck.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = deck[i];
    deck[i] = deck[j];
    deck[j] = temp;
  }

  memoryCards = deck;
  flippedCards = [];
  matchedCount = 0;
  boardIsBusy = false;

  document.getElementById('memory-status').textContent = 'Matches: 0 / 4';
  renderMemoryGrid();
}

function renderMemoryGrid() {
  var grid = document.getElementById('memory-grid');
  grid.innerHTML = '';

  for (var i = 0; i < memoryCards.length; i++) {
    (function (index) {
      var card = document.createElement('div');
      card.className = 'memory-card';
      card.dataset.index = index;

      card.onclick = function () {
        flipMemoryCard(index, card);
      };

      grid.appendChild(card);
    })(i);
  }
}

function flipMemoryCard(index, cardElement) {
  if (boardIsBusy) return;
  if (cardElement.classList.contains('flipped') || cardElement.classList.contains('matched')) return;
  if (flippedCards.length === 2) return;

  cardElement.classList.add('flipped');
  cardElement.textContent = memoryCards[index];
  flippedCards.push({ index: index, element: cardElement });

  if (flippedCards.length === 2) {
    checkForMatch();
  }
}

function checkForMatch() {
  var first = flippedCards[0];
  var second = flippedCards[1];

  if (memoryCards[first.index] === memoryCards[second.index]) {
    // it's a match! keep them revealed
    first.element.classList.add('matched');
    second.element.classList.add('matched');
    matchedCount++;
    document.getElementById('memory-status').textContent = 'Matches: ' + matchedCount + ' / 4';
    flippedCards = [];

    if (matchedCount === 4) {
      document.getElementById('memory-status').textContent = '🎉 All matched! Nice brain break.';
    }
  } else {
    // not a match — flip them back after a short pause
    boardIsBusy = true;
    setTimeout(function () {
      first.element.classList.remove('flipped');
      second.element.classList.remove('flipped');
      first.element.textContent = '';
      second.element.textContent = '';
      flippedCards = [];
      boardIsBusy = false;
    }, 700);
  }
}

// start a fresh game as soon as the page loads
startMemoryGame();