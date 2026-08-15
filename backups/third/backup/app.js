// State Variables
let questions = [];
let currentQuestionIndex = 0;
let userSelections = []; // Stores array of selected indices for each question
let timerInterval = null;
let totalTimeSeconds = 0;

// Parse Query Parameters
const urlParams = new URLSearchParams(window.location.search);
const topicId = urlParams.get('topic') || 'd3_topic1';
const topicTitle = urlParams.get('title') || 'Topic Practice';

// DOM Elements
const activeTopicTitle = document.getElementById('active-topic-title');
const setSelect = document.getElementById('set-select');
const questionTracker = document.getElementById('question-tracker');
const timerDisplay = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');
const questionPalette = document.getElementById('question-palette');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');

const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const submitBtn = document.getElementById('submit-btn');

const questionScreen = document.getElementById('question-screen');
const resultScreen = document.getElementById('result-screen');
const quizInfo = document.getElementById('quiz-info');
const progressContainer = document.getElementById('progress-container');
const finalScore = document.getElementById('final-score');
const scorePercentage = document.getElementById('score-percentage');
const reviewList = document.getElementById('review-list');

document.addEventListener('DOMContentLoaded', () => {
  activeTopicTitle.textContent = topicTitle;

  startQuizSession();

  setSelect.addEventListener('change', () => {
    startQuizSession();
  });

  prevBtn.addEventListener('click', handlePrevQuestion);
  nextBtn.addEventListener('click', handleNextQuestion);
  submitBtn.addEventListener('click', () => confirmAndSubmitQuiz(false));
});

async function startQuizSession() {
  clearInterval(timerInterval); // Stop any running timer

  const selectedSet = setSelect.value;

  questionScreen.classList.remove('hidden');
  quizInfo.classList.remove('hidden');
  progressContainer.classList.remove('hidden');
  questionPalette.classList.remove('hidden');
  resultScreen.classList.add('hidden');

  await loadQuestions(selectedSet, topicId);

  if (questions.length === 0) {
    questionText.textContent = `No questions found for this topic in ${selectedSet.toUpperCase()}.`;
    optionsContainer.innerHTML = '';
    questionPalette.innerHTML = '';
    questionTracker.textContent = 'Question 0 of 0';
    timerDisplay.textContent = 'Time: --:--';
    prevBtn.disabled = true;
    nextBtn.classList.add('hidden');
    submitBtn.classList.add('hidden');
    return;
  }

  currentQuestionIndex = 0;
  userSelections = new Array(questions.length).fill(null).map(() => []);

  // Set total time: 2 minutes (120s) per question
  totalTimeSeconds = questions.length * 2 * 60;

  renderPalette();
  showQuestion();
  startGlobalTimer();
}

async function loadQuestions(setName, topic) {
  questions = [];
  try {
    const response = await fetch(`data/${setName}/${topic}.json`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    questions = await response.json();
    questions = questions.sort(() => Math.random() - 0.5); // Shuffle questions
  } catch (error) {
    console.error(`Could not load data/${setName}/${topic}.json`, error);
  }
}

function renderPalette() {
  questionPalette.innerHTML = '';
  questions.forEach((_, idx) => {
    const paletteItem = document.createElement('button');
    paletteItem.classList.add('palette-btn');
    paletteItem.textContent = idx + 1;

    if (idx === currentQuestionIndex) paletteItem.classList.add('active');
    if (userSelections[idx] && userSelections[idx].length > 0) {
      paletteItem.classList.add('answered');
    }

    paletteItem.addEventListener('click', () => {
      currentQuestionIndex = idx;
      showQuestion();
    });

    questionPalette.appendChild(paletteItem);
  });
}

function showQuestion() {
  const currentQuestion = questions[currentQuestionIndex];

  // Update Tracker & Progress
  questionTracker.textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;
  const progressPercent = ((currentQuestionIndex + 1) / questions.length) * 100;
  progressBar.style.width = `${progressPercent}%`;

  // Display notice if multi-answer
  const isMultiAnswer = Array.isArray(currentQuestion.correct);
  questionText.textContent = isMultiAnswer
    ? `${currentQuestion.question}\n(Select ALL that apply)`
    : currentQuestion.question;

  optionsContainer.innerHTML = '';

  const selectedIndices = userSelections[currentQuestionIndex] || [];

  currentQuestion.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.textContent = typeof option === 'string' ? option : option.text;
    button.classList.add('option-btn');

    if (selectedIndices.includes(index)) {
      button.classList.add('selected');
    }

    button.addEventListener('click', () => toggleOption(index));
    optionsContainer.appendChild(button);
  });

  updateControls();
  renderPalette();
}

function toggleOption(selectedIndex) {
  const currentQuestion = questions[currentQuestionIndex];
  const isMultiAnswer = Array.isArray(currentQuestion.correct);
  let currentSelected = userSelections[currentQuestionIndex] || [];

  if (isMultiAnswer) {
    if (currentSelected.includes(selectedIndex)) {
      currentSelected = currentSelected.filter(idx => idx !== selectedIndex);
    } else {
      currentSelected.push(selectedIndex);
    }
  } else {
    currentSelected = [selectedIndex];
  }

  userSelections[currentQuestionIndex] = currentSelected;

  const optionButtons = optionsContainer.children;
  Array.from(optionButtons).forEach((btn, idx) => {
    if (currentSelected.includes(idx)) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });

  renderPalette();
}

function updateControls() {
  prevBtn.disabled = currentQuestionIndex === 0;

  if (currentQuestionIndex === questions.length - 1) {
    nextBtn.classList.add('hidden');
    submitBtn.classList.remove('hidden');
  } else {
    nextBtn.classList.remove('hidden');
    submitBtn.classList.remove('hidden');
  }
}

function handlePrevQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    showQuestion();
  }
}

function handleNextQuestion() {
  if (currentQuestionIndex < questions.length - 1) {
    currentQuestionIndex++;
    showQuestion();
  }
}

/* --- Global Exam Timer Functions --- */

function startGlobalTimer() {
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    totalTimeSeconds--;
    updateTimerDisplay();

    if (totalTimeSeconds <= 0) {
      clearInterval(timerInterval);
      alert('⏰ Time is up! Submitting your exam automatically.');
      calculateAndShowResults();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const hrs = Math.floor(totalTimeSeconds / 3600);
  const mins = Math.floor((totalTimeSeconds % 3600) / 60);
  const secs = totalTimeSeconds % 60;

  const paddedMins = String(mins).padStart(2, '0');
  const paddedSecs = String(secs).padStart(2, '0');

  if (hrs > 0) {
    const paddedHrs = String(hrs).padStart(2, '0');
    timerDisplay.textContent = `Time: ${paddedHrs}:${paddedMins}:${paddedSecs}`;
  } else {
    timerDisplay.textContent = `Time: ${paddedMins}:${paddedSecs}`;
  }
}

/* --- Submission & Results --- */

function confirmAndSubmitQuiz(isTimeOut = false) {
  if (!isTimeOut) {
    const missedIndices = [];
    userSelections.forEach((selections, idx) => {
      if (!selections || selections.length === 0) {
        missedIndices.push(idx + 1);
      }
    });

    if (missedIndices.length > 0) {
      const missedStr = missedIndices.map(num => `Q${num}`).join(', ');
      const confirmSubmit = confirm(
        `⚠️ You have ${missedIndices.length} unanswered question(s):\n[ ${missedStr} ]\n\nAre you sure you want to submit?`
      );
      if (!confirmSubmit) return;
    }
  }

  calculateAndShowResults();
}

function calculateAndShowResults() {
  clearInterval(timerInterval);

  let totalScore = 0;
  const userAnswers = [];

  questions.forEach((q, idx) => {
    const selected = userSelections[idx] || [];
    const target = q.correct;
    
    let isCorrect = false;

    if (Array.isArray(target)) {
      const sortedTarget = [...target].sort();
      const sortedSelected = [...selected].sort();
      isCorrect =
        sortedTarget.length === sortedSelected.length &&
        sortedTarget.every((val, index) => val === sortedSelected[index]);
    } else {
      isCorrect = selected.length === 1 && selected[0] === target;
    }

    if (isCorrect) totalScore++;

    userAnswers.push({
      question: q.question,
      selected: formatUserSelectedText(q, selected),
      correct: formatCorrectAnswerText(q),
      isCorrect: isCorrect,
      explanation: formatExplanationText(q.explanation)
    });
  });

  questionScreen.classList.add('hidden');
  quizInfo.classList.add('hidden');
  progressContainer.classList.add('hidden');
  questionPalette.classList.add('hidden');
  resultScreen.classList.remove('hidden');

  finalScore.textContent = `${totalScore} / ${questions.length}`;
  const percentage = Math.round((totalScore / questions.length) * 100);
  scorePercentage.textContent = `${percentage}%`;

  reviewList.innerHTML = '';
  userAnswers.forEach((ans, idx) => {
    const item = document.createElement('li');
    item.classList.add('review-item', ans.isCorrect ? 'pass' : 'fail');
    item.innerHTML = `
      <strong>Q${idx + 1}: ${ans.question}</strong><br/>
      <span>Your Answer: ${ans.selected}</span><br/>
      ${!ans.isCorrect ? `<span>Correct Answer: ${ans.correct}</span><br/>` : ''}
      <small><em>Explanation: ${ans.explanation}</em></small>
    `;
    reviewList.appendChild(item);
  });
}

function getOptionText(question, idx) {
  if (idx === null || idx === undefined) return '';
  const opt = question.options[idx];
  return typeof opt === 'string' ? opt : (opt?.text || '');
}

function formatUserSelectedText(question, selectedIndices) {
  if (!selectedIndices || selectedIndices.length === 0) return 'Not Answered / Time Expired';
  return selectedIndices.map(idx => getOptionText(question, idx)).join(' AND ');
}

function formatCorrectAnswerText(question) {
  const target = question.correct;
  if (Array.isArray(target)) {
    return target.map(idx => getOptionText(question, idx)).join(' AND ');
  }
  return getOptionText(question, target);
}

function formatExplanationText(explanation) {
  if (!explanation) return 'No explanation provided.';
  if (typeof explanation === 'string') return explanation;
  let result = explanation.correctReason || '';
  if (explanation.reference) {
    result += `<br/><a href="${explanation.reference}" target="_blank" rel="noopener noreferrer">Reference Link</a>`;
  }
  return result || 'No explanation provided.';
}