import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { app, saveUserProfile } from "./firebase-config.js";

const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

const authReady = new Promise((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    currentUser = user;

    if (!user) {
      window.location.href = "index.html";
      return;
    }

    const signInBtn = document.getElementById("sign-in-btn");
    const userInfo = document.getElementById("user-info");
    const userNameElem = document.getElementById("user-name");
    const signOutBtn = document.getElementById("sign-out-btn");

    if (signInBtn) signInBtn.style.display = "none";
    if (userInfo) userInfo.style.display = "flex";
    if (userNameElem) {
      userNameElem.textContent = user.displayName || user.email;
    }
    if (signOutBtn) {
      signOutBtn.style.display = "inline-block";
      signOutBtn.onclick = () => signOut(auth).then(() => window.location.href = "index.html");
    }
    saveUserProfile(user);

    unsubscribe();
    resolve(user);
  });
});

let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let incorrectQuestionsLog = {};
let selectedMultiIndices = new Set();
let activeQuizTitle = "AZ-104 Practice Quiz";
let activeQuizSet = "set1";
let timerInterval = null;
let totalTimeSeconds = 100 * 60;
let timeRemaining = totalTimeSeconds;

document.addEventListener("DOMContentLoaded", async () => {
  await authReady;

  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") || "complete"; 
  const topic = params.get("topic");
  const domain = params.get("domain");
  const currentSet = params.get("set") || "set1";
  const exam = params.get("exam") || "e1";
  const title = params.get("title");

  const setSelector = document.getElementById("set-selector");

  try {
    const structRes = await fetch("data/azure_certification_structure.json");
    if (structRes.ok) {
      const structData = await structRes.json();
      const setsConfig = structData.sets_config || {};
      let totalSets = setsConfig[mode] || setsConfig.complete || 3;

      if (setSelector) {
        setSelector.innerHTML = "";
        for (let i = 1; i <= totalSets; i++) {
          const setId = `set${i}`;
          const opt = document.createElement("option");
          opt.value = setId;
          opt.textContent = `Set ${i}`;
          if (setId === currentSet) opt.selected = true;
          setSelector.appendChild(opt);
        }

        setSelector.onchange = (e) => {
          params.set("set", e.target.value);
          window.location.search = params.toString();
        };
      }
    }
  } catch (err) {
    console.warn("Could not load sets configuration from structure JSON:", err);
    if (setSelector) {
      setSelector.innerHTML = `
        <option value="set1" ${currentSet === 'set1' ? 'selected' : ''}>Set 1</option>
        <option value="set2" ${currentSet === 'set2' ? 'selected' : ''}>Set 2</option>
        <option value="set3" ${currentSet === 'set3' ? 'selected' : ''}>Set 3</option>
      `;
      setSelector.onchange = (e) => {
        params.set("set", e.target.value);
        window.location.search = params.toString();
      };
    }
  }

  activeQuizSet = mode === "complete" ? exam : currentSet;

  if (title) {
    activeQuizTitle = decodeURIComponent(title);
    const quizTitleElem = document.getElementById("quiz-title");
    const quizTitleTag = document.getElementById("quiz-title-tag");
    if (quizTitleElem) quizTitleElem.textContent = activeQuizTitle;
    if (quizTitleTag) quizTitleTag.textContent = activeQuizTitle;
  }

  showAttemptIndicator();

  startTimer();

  try {
    let response;
    if (mode === "topic" && topic) {
      response = await fetch(`data/topics/${currentSet}/${topic}.json`);
    } else if (mode === "domain" && domain) {
      response = await fetch(`data/domains/${currentSet}/${domain}.json`);
    } else {
      const examFileName = exam.endsWith(".json") ? exam : `${exam}.json`;
      response = await fetch(`data/complete/${examFileName}`);
    }

    if (!response || !response.ok) throw new Error(`Could not load questions file (Status: ${response?.status})`);
    const rawQuestions = await response.json();

    if (rawQuestions && rawQuestions.length > 0) {
      currentQuestions = rawQuestions.map(q => {
        const correctIndices = getCorrectIndices(q);
        const originalOptions = q.options || [];

        let indexedOptions = originalOptions.map((opt, idx) => ({ 
          text: opt, 
          isCorrect: correctIndices.includes(idx) 
        }));
        indexedOptions = shuffleArray(indexedOptions);

        const newOptions = indexedOptions.map(item => item.text);
        const newCorrectIndices = indexedOptions
          .map((item, idx) => item.isCorrect ? idx : null)
          .filter(val => val !== null);

        return {
          ...q,
          options: newOptions,
          correct: newCorrectIndices,
          isMultiple: newCorrectIndices.length > 1
        };
      });

      userAnswers = {};
      incorrectQuestionsLog = {};
      currentQuestionIndex = 0;
      renderPalette();
      loadQuestion();
    } else {
      showError("No questions found in this dataset.");
    }
  } catch (error) {
    console.error("Error loading questions:", error);
    showError(`Failed to load questions file. Verify folder path and JSON structure. (${error.message})`);
  }
});

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function startTimer() {
  const timerElem = document.getElementById("quiz-timer");
  if (!timerElem) return;
  
  timeRemaining = totalTimeSeconds;
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    timeRemaining--;

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      alert("⏱️ Time is up! Submitting your quiz now.");
      finishQuiz();
      return;
    }

    const mins = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    const secs = (timeRemaining % 60).toString().padStart(2, '0');
    timerElem.textContent = `${mins}:${secs}`;
  }, 1000);
}

function parseSingleCorrect(ans) {
  if (typeof ans === "number") return ans;
  if (typeof ans === "string") {
    const upper = ans.trim().toUpperCase();
    const charCode = upper.charCodeAt(0);
    if (charCode >= 65 && charCode <= 90) return charCode - 65;
    const parsed = parseInt(ans, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

function getCorrectIndices(q) {
  const ans = q.correct !== undefined ? q.correct : q.answer;
  if (Array.isArray(ans)) {
    return ans.map(item => parseSingleCorrect(item));
  }
  return [parseSingleCorrect(ans)];
}

function getExplanationHTML(exp) {
  if (!exp) return "";
  if (typeof exp === "string") return `<pre>${exp}</pre>`;
  if (typeof exp === "object") {
    let html = "";
    if (exp.correctReason) html += `<div class="explanation-reason"><strong>Correct Reason:</strong> <pre class="inline-pre">${exp.correctReason}</pre></div>`;
    if (exp.incorrectReasons && Array.isArray(exp.incorrectReasons)) {
      html += `<div class="explanation-reason"><strong>Incorrect Reasons:</strong><ul class="explanation-list">`;
      exp.incorrectReasons.forEach(r => html += `<li class="explanation-list-item"><pre>${r}</pre></li>`);
      html += `</ul></div>`;
    }
    if (exp.reference) html += `<div><strong>Reference:</strong> <a href="${exp.reference}" target="_blank">${exp.reference}</a></div>`;
    return html || `<div>${JSON.stringify(exp)}</div>`;
  }
  return `<div>${String(exp)}</div>`;
}

function renderPalette() {
  const paletteContainer = document.getElementById("question-palette");
  if (!paletteContainer) return;
  paletteContainer.innerHTML = "";

  currentQuestions.forEach((_, idx) => {
    const btn = document.createElement("button");
    btn.className = "palette-btn";
    btn.textContent = idx + 1;

    if (idx === currentQuestionIndex) {
      btn.classList.add("is-current");
    }
    if (userAnswers[idx] !== undefined) {
      btn.classList.add(userAnswers[idx].isCorrect ? "is-correct" : "is-incorrect");
    }

    btn.onclick = () => {
      currentQuestionIndex = idx;
      renderPalette();
      loadQuestion();
    };
    paletteContainer.appendChild(btn);
  });
}

function loadQuestion() {
  const questionCard = document.getElementById("quiz-card");
  if (!questionCard) return;

  const q = currentQuestions[currentQuestionIndex];
  if (!q) {
    showError("Question data is missing or improperly formatted.");
    return;
  }

  selectedMultiIndices.clear();
  const previousAnswer = userAnswers[currentQuestionIndex];
  const correctIndices = q.correct;
  const isMultiple = q.isMultiple;
  const explanationHTML = getExplanationHTML(q.explanation);

  questionCard.innerHTML = `
    <div class="question-meta">
      Question ${currentQuestionIndex + 1} of ${currentQuestions.length} ${q.subtopic ? `(${q.subtopic})` : ''}
    </div>

    <div class="question-controls">
      <button id="prev-btn" class="btn" ${currentQuestionIndex === 0 ? 'disabled' : ''}>← Previous</button>
      <button id="submit-early-btn" class="btn btn-danger">Submit Quiz 🏁</button>
      <button id="next-btn" class="btn btn-primary">
        ${currentQuestionIndex === currentQuestions.length - 1 ? 'Finish Quiz 🏁' : 'Next'}
      </button>
    </div>

    <pre class="question-text">${q.question ? q.question.trim() : ''}${isMultiple ? `<div class="question-multi-hint">(Select ${correctIndices.length} correct options)</div>` : ''}</pre>

    <div id="options-container" class="options-container"></div>
    ${isMultiple && !previousAnswer ? `
      <button id="submit-multi-btn" class="btn btn-primary submit-multi-btn">
        Submit Answer
      </button>
    ` : ''}
    <div id="explanation-box" class="explanation-box ${previousAnswer ? 'visible' : ''}">
      ${previousAnswer ? `<strong>Explanation:</strong><div class="explanation-body">${explanationHTML}</div>` : ''}
    </div>
  `;

  const optionsContainer = document.getElementById("options-container");
  (q.options || []).forEach((optionText, index) => {
    const btn = document.createElement("button");
    btn.className = "btn option-btn";
    btn.innerHTML = `<span>${isMultiple ? '☐ ' : ''}${optionText}</span>`;

    if (previousAnswer) {
      btn.disabled = true;
      const isSelected = previousAnswer.selectedIndices.includes(index);
      const isCorrectOption = correctIndices.includes(index);

      if (isCorrectOption) {
        btn.classList.add("is-correct");
        if (isMultiple) btn.innerHTML = `<span>☑ ${optionText}</span>`;
      } else if (isSelected) {
        btn.classList.add("is-incorrect");
        if (isMultiple) btn.innerHTML = `<span>☒ ${optionText}</span>`;
      }
    } else {
      if (isMultiple) {
        btn.onclick = () => {
          if (selectedMultiIndices.has(index)) {
            selectedMultiIndices.delete(index);
            btn.classList.remove("is-selected-multi");
            btn.innerHTML = `<span>☐ ${optionText}</span>`;
          } else {
            selectedMultiIndices.add(index);
            btn.classList.add("is-selected-multi");
            btn.innerHTML = `<span>☑ ${optionText}</span>`;
          }
        };
      } else {
        btn.onclick = () => handleAnswerSelect([index], correctIndices, explanationHTML);
      }
    }
    optionsContainer.appendChild(btn);
  });

  if (isMultiple && !previousAnswer) {
    const submitMultiBtn = document.getElementById("submit-multi-btn");
    submitMultiBtn.onclick = () => {
      if (selectedMultiIndices.size === 0) {
        alert("Please select at least one option.");
        return;
      }
      handleAnswerSelect(Array.from(selectedMultiIndices), correctIndices, explanationHTML);
    };
  }

  document.getElementById("prev-btn").onclick = () => {
    if (currentQuestionIndex > 0) { currentQuestionIndex--; renderPalette(); loadQuestion(); }
  };
  document.getElementById("next-btn").onclick = () => {
    if (currentQuestionIndex < currentQuestions.length - 1) { currentQuestionIndex++; renderPalette(); loadQuestion(); }
    else { finishQuiz(); }
  };
  document.getElementById("submit-early-btn").onclick = () => {
    if (confirm("Are you sure you want to submit your quiz now?")) {
      finishQuiz();
    }
  };
}

function handleAnswerSelect(selectedIndices, correctIndices, explanationHTML) {
  const isCorrect = selectedIndices.length === correctIndices.length &&
                    selectedIndices.every(idx => correctIndices.includes(idx));

  userAnswers[currentQuestionIndex] = { selectedIndices, isCorrect };

  if (!isCorrect) {
    const q = currentQuestions[currentQuestionIndex];
    incorrectQuestionsLog[currentQuestionIndex] = {
      question: q.question ? q.question.trim() : "",
      subtopic: q.subtopic || null,
      options: q.options || [],
      correctIndices: correctIndices,
      selectedIndices: selectedIndices,
      explanation: q.explanation || null
    };
  } else {
    delete incorrectQuestionsLog[currentQuestionIndex];
  }

  renderPalette();

  const buttons = document.querySelectorAll("#options-container .option-btn");
  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    const isSelected = selectedIndices.includes(idx);
    const isCorrectOption = correctIndices.includes(idx);

    if (isCorrectOption) {
      btn.classList.add("is-correct");
    } else if (isSelected) {
      btn.classList.add("is-incorrect");
    }
  });

  const submitMultiBtn = document.getElementById("submit-multi-btn");
  if (submitMultiBtn) submitMultiBtn.style.display = "none";

  if (explanationHTML) {
    const expBox = document.getElementById("explanation-box");
    if (expBox) {
      expBox.classList.add("visible");
      expBox.innerHTML = `<strong>Explanation:</strong><div class="explanation-body">${explanationHTML}</div>`;
    }
  }
}

async function finishQuiz() {
  if (timerInterval) clearInterval(timerInterval);
  const quizCard = document.getElementById("quiz-card");
  const paletteCard = document.getElementById("palette-card");
  if (paletteCard) paletteCard.style.display = "none";

  let correctCount = 0;
  Object.values(userAnswers).forEach(ans => { if (ans.isCorrect) correctCount++; });
  const percentage = Math.round((correctCount / currentQuestions.length) * 100);

  const secondsSpent = totalTimeSeconds - timeRemaining;
  const mins = Math.floor(secondsSpent / 60);
  const secs = secondsSpent % 60;
  const timeTakenStr = `${mins}m ${secs}s`;

  if (quizCard) {
    quizCard.innerHTML = `
      <div class="quiz-results">
        <h2>Quiz Completed! 🎉</h2>
        <p class="quiz-results__score">
          Score: ${correctCount} / ${currentQuestions.length} (${percentage}%)
        </p>
        <p class="quiz-results__meta">Time Taken: <strong>${timeTakenStr}</strong></p>
        <p id="save-status" class="quiz-results__save-status">⏳ Saving score to Firestore...</p>
        
        <div id="nav-actions" class="quiz-results__actions">
          <a href="index.html" class="btn btn-primary">Back to Home</a>
          <a href="dashboard.html" class="btn btn-neutral">View Dashboard</a>
        </div>
      </div>
    `;
  }

  const statusElem = document.getElementById("save-status");
  const navActions = document.getElementById("nav-actions");

  if (currentUser) {
    try {
      const incorrectQuestionsPayload = Object.values(incorrectQuestionsLog);

      await addDoc(collection(db, "users", currentUser.uid, "scores"), {
        quizTitle: activeQuizTitle,
        quizSet: activeQuizSet,
        score: correctCount,
        totalQuestions: currentQuestions.length,
        percentage: percentage,
        timeTaken: timeTakenStr,
        timestamp: serverTimestamp(),
        incorrectQuestions: incorrectQuestionsPayload
      });
      if (statusElem) {
        statusElem.classList.add("status-success");
        statusElem.textContent = "✅ Score successfully recorded in your dashboard!";
      }
      if (navActions) navActions.classList.add("ready");
    } catch (error) {
      console.error("Error saving score:", error);
      if (statusElem) {
        statusElem.classList.add("status-error");
        statusElem.textContent = `⚠️ Could not save score: ${error.message}`;
      }
      if (navActions) navActions.classList.add("ready");
    }
  } else {
    if (statusElem) {
      statusElem.classList.add("status-info");
      statusElem.textContent = "ℹ️ Note: Sign in on the home page to save your scores automatically.";
    }
    if (navActions) navActions.classList.add("ready");
  }
}

function showError(msg) {
  const quizCard = document.getElementById("quiz-card");
  if (quizCard) quizCard.innerHTML = `<div class="error-message">${msg}</div>`;
}

// Looks up how many times the signed-in user has previously completed this
// exact quiz — same title AND same question set — and shows a small summary
// next to the Question Set dropdown: attempt count, best score, and when it
// was last taken. Switching sets re-runs this for the newly selected set.
async function showAttemptIndicator() {
  const indicatorElem = document.getElementById("attempt-indicator");
  if (!indicatorElem || !currentUser || !activeQuizTitle) return;

  indicatorElem.className = "attempt-indicator";
  indicatorElem.textContent = "Checking attempt history…";

  try {
    // Note: two equality (==) filters on different fields do NOT require a
    // Firestore composite index — only combining where() with orderBy() on a
    // different field does. So this stays index-free.
    const q = query(
      collection(db, "users", currentUser.uid, "scores"),
      where("quizTitle", "==", activeQuizTitle),
      where("quizSet", "==", activeQuizSet)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      indicatorElem.classList.add("attempt-indicator--new");
      indicatorElem.textContent = `🆕 First time on ${activeQuizSet}`;
      return;
    }

    let attemptCount = 0;
    let bestPercentage = -Infinity;
    let latestData = null;
    let latestMs = -Infinity;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      attemptCount += 1;
      const pct = typeof data.percentage === "number" ? data.percentage : parseFloat(data.percentage) || 0;
      if (pct > bestPercentage) bestPercentage = pct;
      const ms = data.timestamp ? data.timestamp.toDate().getTime() : 0;
      if (ms >= latestMs) {
        latestMs = ms;
        latestData = data;
      }
    });

    const timesLabel = attemptCount === 1 ? "1 time" : `${attemptCount} times`;
    const lastDateStr = latestData && latestData.timestamp
      ? new Date(latestData.timestamp.toDate()).toLocaleDateString()
      : "N/A";
    const lastPct = latestData ? (latestData.percentage ?? "N/A") : "N/A";

    indicatorElem.classList.add("attempt-indicator--attempted");
    indicatorElem.textContent = `🔁 Attempted ${timesLabel} on ${activeQuizSet} · Best: ${bestPercentage}% · Last: ${lastPct}% on ${lastDateStr}`;
  } catch (error) {
    console.error("Error checking attempt history:", error);
    indicatorElem.textContent = "";
  }
}