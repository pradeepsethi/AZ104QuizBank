// Map of all topics to fetch when "All Topics" is selected
const ALL_TOPICS = [
  'd1_topic1', 'd1_topic2', 'd1_topic3',
  'd2_topic1', 'd2_topic2', 'd2_topic3',
  'd3_topic1', 'd3_topic2', 'd3_topic3', 'd3_topic4',
  'd4_topic1', 'd4_topic2', 'd4_topic3',
  'd5_topic1', 'd5_topic2'
];

// App State
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timerInterval = null;
let timeLeft = 30;
let userAnswers = [];

// DOM Elements
const startScreen = document.getElementById('start-screen');
const questionScreen = document.getElementById('question-screen');
const resultScreen = document.getElementById('result-screen');
const quizInfo = document.getElementById('quiz-info');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');

const setSelect = document.getElementById('set-select');
const topicSelect = document.getElementById('topic-select');
const startBtn = document.getElementById('start-btn');
const nextBtn = document.getElementById('next-btn');
const restartBtn = document.getElementById('restart-btn');

const questionTracker = document.getElementById('question-tracker');
const timerDisplay = document.getElementById('timer');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');

const finalScore = document.getElementById('final-score');
const scorePercentage = document.getElementById('score-percentage');
const reviewList = document.getElementById('review-list');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  startBtn.addEventListener('click', startQuiz);
  nextBtn.addEventListener('click', handleNextQuestion);
  restartBtn.addEventListener('click', resetQuiz);
});

// Load Questions from JSON files based on folder structure
async function loadQuestions(setName, topicName) {
  questions = [];
  
  try {
    if (topicName === 'all') {
      // Fetch all topic files for the set in parallel
      const fetchPromises = ALL_TOPICS.map(topic => 
        fetch(`data/${setName}/${topic}.json`).then(res => res.ok ? res.json() : [])
      );
      const results = await Promise.all(fetchPromises);
      questions = results.flat();
    } else {
      // Fetch specific topic file
      const response = await fetch(`data/${setName}/${topicName}.json`);
      if (!response.ok) throw new Error(`Could not find data/${setName}/${topicName}.json`);
      questions = await response.json();
    }

    // Shuffle questions for randomized order
    questions = questions.sort(() => Math.random() - 0.5);

  } catch (error) {
    console.error('Error loading questions:', error);
    alert(`Failed to load quiz data. Check that file exists at: data/${setName}/${topicName}.json`);
  }
}

// Start Quiz Session
async function startQuiz() {
  const selectedSet = setSelect.value;
  const selectedTopic = topicSelect.value;

  startBtn.disabled = true;
  startBtn.textContent = 'Loading Questions...';

  await loadQuestions(selectedSet, selectedTopic);

  startBtn.disabled = false;
  startBtn.textContent = 'Start Practice Exam';

  if (questions.length === 0) return;

  startScreen.classList.add('hidden');
  questionScreen.classList.remove('hidden');
  quizInfo.classList.remove('hidden');
  progressContainer.classList.remove('hidden');

  currentQuestionIndex = 0;
  score = 0;
  userAnswers = [];

  showQuestion();
}

// Render Current Question
function showQuestion() {
  resetState();
  const currentQuestion = questions[currentQuestionIndex];

  questionTracker.textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;
  const progressPercent = (currentQuestionIndex / questions.length) * 100;
  progressBar.style.width = `${progressPercent}%`;

  questionText.textContent = currentQuestion.question;

  // Supports options arrays of strings or objects
  currentQuestion.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.textContent = typeof option === 'string' ? option : option.text;
    button.classList.add('option-btn');
    button.addEventListener('click', () => selectOption(index));
    optionsContainer.appendChild(button);
  });

  startTimer();
}

// Reset Timer and Controls
function resetState() {
  clearInterval(timerInterval);
  timeLeft = 30;
  timerDisplay.textContent = `Time: ${timeLeft}s`;
  nextBtn.classList.add('hidden');
  optionsContainer.innerHTML = '';
}

// Helper to safely extract option text
function getOptionText(question, idx) {
  if (idx === null || idx === undefined) return 'Time Expired';
  const opt = question.options[idx];
  return typeof opt === 'string' ? opt : (opt?.text || '');
}

// Helper to format correct answer(s) string for review
function formatCorrectAnswerText(question) {
  const target = question.correct;
  if (Array.isArray(target)) {
    return target.map(idx => getOptionText(question, idx)).join(' AND ');
  }
  return getOptionText(question, target);
}

// Helper to format structured explanation object
function formatExplanationText(explanation) {
  if (!explanation) return 'No explanation provided.';
  if (typeof explanation === 'string') return explanation;

  let result = explanation.correctReason || '';
  if (explanation.reference) {
    result += `<br/><a href="${explanation.reference}" target="_blank" rel="noopener noreferrer">Microsoft Documentation Reference</a>`;
  }
  return result || 'No explanation provided.';
}

// Handle Option Selection
function selectOption(selectedIndex) {
  clearInterval(timerInterval);
  const currentQuestion = questions[currentQuestionIndex];
  const optionButtons = optionsContainer.children;

  const target = currentQuestion.correct;
  
  // Handles single integer index or array of correct indices
  const isCorrect = Array.isArray(target)
    ? target.includes(selectedIndex)
    : selectedIndex === target;

  if (isCorrect) score++;

  const selectedLabel = getOptionText(currentQuestion, selectedIndex);
  const correctLabel = formatCorrectAnswerText(currentQuestion);
  const explanationText = formatExplanationText(currentQuestion.explanation);

  userAnswers.push({
    question: currentQuestion.question,
    selected: selectedLabel,
    correct: correctLabel,
    isCorrect: isCorrect,
    explanation: explanationText
  });

  // Highlight option buttons
  Array.from(optionButtons).forEach((btn, idx) => {
    btn.disabled = true;

    const isTargetOption = Array.isArray(target)
      ? target.includes(idx)
      : idx === target;

    if (isTargetOption) {
      btn.classList.add('correct');
    } else if (idx === selectedIndex) {
      btn.classList.add('incorrect');
    }
  });

  nextBtn.classList.remove('hidden');
}

// Timer Controller
function startTimer() {
  timerInterval = setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = `Time: ${timeLeft}s`;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      selectOption(null);
    }
  }, 1000);
}

// Next Question or Show Results
function handleNextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex < questions.length) {
    showQuestion();
  } else {
    showResults();
  }
}

// Display Results
function showResults() {
  questionScreen.classList.add('hidden');
  quizInfo.classList.add('hidden');
  progressContainer.classList.add('hidden');
  resultScreen.classList.remove('hidden');

  finalScore.textContent = `${score} / ${questions.length}`;
  const percentage = Math.round((score / questions.length) * 100);
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

function resetQuiz() {
  resultScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
}