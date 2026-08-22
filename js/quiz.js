import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
let selectedMultiIndices = new Set();
let activeQuizTitle = "AZ-104 Practice Quiz";
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

  if (title) {
    activeQuizTitle = decodeURIComponent(title);
    const quizTitleElem = document.getElementById("quiz-title");
    const quizTitleTag = document.getElementById("quiz-title-tag");
    if (quizTitleElem) quizTitleElem.textContent = activeQuizTitle;
    if (quizTitleTag) quizTitleTag.textContent = activeQuizTitle;
  }

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
  if (typeof exp === "string") return `<pre style="white-space: pre-wrap; font-family: inherit; margin: 0; font-weight: normal;">${exp}</pre>`;
  if (typeof exp === "object") {
    let html = "";
    if (exp.correctReason) html += `<div style="margin-bottom: 8px;"><strong>Correct Reason:</strong> <pre style="white-space: pre-wrap; font-family: inherit; display: inline; font-weight: normal;">${exp.correctReason}</pre></div>`;
    if (exp.incorrectReasons && Array.isArray(exp.incorrectReasons)) {
      html += `<div style="margin-bottom: 8px;"><strong>Incorrect Reasons:</strong><ul style="margin: 4px 0 0 20px; padding: 0;">`;
      exp.incorrectReasons.forEach(r => html += `<li style="margin-bottom: 4px;"><pre style="white-space: pre-wrap; font-family: inherit; margin: 0; font-weight: normal;">${r}</pre></li>`);
      html += `</ul></div>`;
    }
    if (exp.reference) html += `<div><strong>Reference:</strong> <a href="${exp.reference}" target="_blank" style="color: #0078d4;">${exp.reference}</a></div>`;
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
    btn.style.cssText = "padding: 8px; border: 1px solid #c8c6c4; background: #fff; cursor: pointer; border-radius: 4px; font-weight: 600;";

    if (idx === currentQuestionIndex) {
      btn.style.borderColor = "#0078d4";
      btn.style.borderWidth = "2px";
    }
    if (userAnswers[idx] !== undefined) {
      btn.style.background = userAnswers[idx].isCorrect ? "#dff6dd" : "#fde7e9";
      btn.style.borderColor = userAnswers[idx].isCorrect ? "#107c41" : "#d13438";
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
    <div style="font-size: 14px; color: #605e5c; margin-bottom: 10px; font-weight: 600;">
      Question ${currentQuestionIndex + 1} of ${currentQuestions.length} ${q.subtopic ? `(${q.subtopic})` : ''}
    </div>

    <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #edebe9; padding-bottom: 15px;">
      <button id="prev-btn" class="btn" style="padding: 8px 16px; cursor: pointer;" ${currentQuestionIndex === 0 ? 'disabled' : ''}>← Previous</button>
      <button id="submit-early-btn" class="btn btn-danger" style="padding: 8px 16px; background: #d13438; color: white; border: none; border-radius: 4px; cursor: pointer;">Submit Quiz 🏁</button>
      <button id="next-btn" class="btn btn-primary" style="padding: 8px 16px; background: #0078d4; color: white; border: none; border-radius: 4px; cursor: pointer;">
        ${currentQuestionIndex === currentQuestions.length - 1 ? 'Finish Quiz 🏁' : 'Next'}
      </button>
    </div>

    <pre style="margin-top: 0; font-size: 17px; color: #201f1e; font-family: inherit; white-space: pre-wrap; font-weight: normal; background-color: #f0f2f5; padding: 16px 18px; border-radius: 6px; border: 1px solid #e1e4e8;">${q.question ? q.question.trim() : ''}${isMultiple ? `<div style="font-size: 13px; color: #0078d4; margin-top: 8px; font-weight: normal;">(Select ${correctIndices.length} correct options)</div>` : ''}</pre>

    <div id="options-container" style="margin-top: 20px;"></div>
    ${isMultiple && !previousAnswer ? `
      <button id="submit-multi-btn" class="btn btn-primary" style="margin-top: 15px; padding: 10px 20px; background: #0078d4; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Submit Answer
      </button>
    ` : ''}
    <div id="explanation-box" style="display: ${previousAnswer ? 'block' : 'none'}; margin-top: 20px; padding: 15px; background: #f3f2f1; border-left: 4px solid #0078d4; border-radius: 4px;">
      ${previousAnswer ? `<strong>Explanation:</strong><div style="margin-top: 8px;">${explanationHTML}</div>` : ''}
    </div>
  `;

  const optionsContainer = document.getElementById("options-container");
  (q.options || []).forEach((optionText, index) => {
    const btn = document.createElement("button");
    btn.className = "btn option-btn";
    btn.style.cssText = "display: block; width: 100%; text-align: left; margin: 8px 0; padding: 12px 16px; background: #ffffff; border: 1px solid #c8c6c4; cursor: pointer; border-radius: 4px; transition: background 0.2s;";
    btn.innerHTML = `<span style="white-space: pre-wrap; font-family: inherit;">${isMultiple ? '☐ ' : ''}${optionText}</span>`;

    if (previousAnswer) {
      btn.disabled = true;
      const isSelected = previousAnswer.selectedIndices.includes(index);
      const isCorrectOption = correctIndices.includes(index);

      if (isCorrectOption) {
        btn.style.backgroundColor = "#dff6dd";
        btn.style.borderColor = "#107c41";
        btn.style.fontWeight = "bold";
        if (isMultiple) btn.innerHTML = `<span style="white-space: pre-wrap; font-family: inherit;">☑ ${optionText}</span>`;
      } else if (isSelected) {
        btn.style.backgroundColor = "#fde7e9";
        btn.style.borderColor = "#d13438";
        if (isMultiple) btn.innerHTML = `<span style="white-space: pre-wrap; font-family: inherit;">☒ ${optionText}</span>`;
      }
    } else {
      if (isMultiple) {
        btn.onclick = () => {
          if (selectedMultiIndices.has(index)) {
            selectedMultiIndices.delete(index);
            btn.style.background = "#ffffff";
            btn.innerHTML = `<span style="white-space: pre-wrap; font-family: inherit;">☐ ${optionText}</span>`;
          } else {
            selectedMultiIndices.add(index);
            btn.style.background = "#eff6fc";
            btn.innerHTML = `<span style="white-space: pre-wrap; font-family: inherit;">☑ ${optionText}</span>`;
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
  renderPalette();

  const buttons = document.querySelectorAll("#options-container .option-btn");
  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    const isSelected = selectedIndices.includes(idx);
    const isCorrectOption = correctIndices.includes(idx);

    if (isCorrectOption) {
      btn.style.backgroundColor = "#dff6dd";
      btn.style.borderColor = "#107c41";
      btn.style.fontWeight = "bold";
    } else if (isSelected) {
      btn.style.backgroundColor = "#fde7e9";
      btn.style.borderColor = "#d13438";
    }
  });

  const submitMultiBtn = document.getElementById("submit-multi-btn");
  if (submitMultiBtn) submitMultiBtn.style.display = "none";

  if (explanationHTML) {
    const expBox = document.getElementById("explanation-box");
    if (expBox) {
      expBox.style.display = "block";
      expBox.innerHTML = `<strong>Explanation:</strong><div style="margin-top: 8px;">${explanationHTML}</div>`;
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
      <div style="text-align: center; padding: 20px;">
        <h2>Quiz Completed! 🎉</h2>
        <p style="font-size: 22px; font-weight: bold; color: #0078d4; margin: 15px 0;">
          Score: ${correctCount} / ${currentQuestions.length} (${percentage}%)
        </p>
        <p style="font-size: 14px; color: #605e5c; margin-bottom: 5px;">Time Taken: <strong>${timeTakenStr}</strong></p>
        <p id="save-status" style="font-size: 14px; color: #605e5c; font-weight: 500;">⏳ Saving score to Firestore...</p>
        
        <div id="nav-actions" style="margin-top: 25px; opacity: 0.4; pointer-events: none; transition: opacity 0.3s;">
          <a href="index.html" class="btn btn-primary" style="text-decoration: none; margin-right: 10px; padding: 10px 20px; background: #0078d4; color: white; border-radius: 4px;">Back to Home</a>
          <a href="dashboard.html" class="btn" style="text-decoration: none; padding: 10px 20px; background: #f3f2f1; color: #323130; border: 1px solid #c8c6c4; border-radius: 4px;">View Dashboard</a>
        </div>
      </div>
    `;
  }

  const statusElem = document.getElementById("save-status");
  const navActions = document.getElementById("nav-actions");

  if (currentUser) {
    try {
      await addDoc(collection(db, "users", currentUser.uid, "scores"), {
        quizTitle: activeQuizTitle,
        score: correctCount,
        totalQuestions: currentQuestions.length,
        percentage: percentage,
        timeTaken: timeTakenStr,
        timestamp: serverTimestamp()
      });
      if (statusElem) {
        statusElem.style.color = "#107c41";
        statusElem.textContent = "✅ Score successfully recorded in your dashboard!";
      }
      if (navActions) {
        navActions.style.opacity = "1";
        navActions.style.pointerEvents = "auto";
      }
    } catch (error) {
      console.error("Error saving score:", error);
      if (statusElem) {
        statusElem.style.color = "#d13438";
        statusElem.textContent = `⚠️ Could not save score: ${error.message}`;
      }
      if (navActions) {
        navActions.style.opacity = "1";
        navActions.style.pointerEvents = "auto";
      }
    }
  } else {
    if (statusElem) {
      statusElem.style.color = "#a4262c";
      statusElem.textContent = "ℹ️ Note: Sign in on the home page to save your scores automatically.";
    }
    if (navActions) {
      navActions.style.opacity = "1";
      navActions.style.pointerEvents = "auto";
    }
  }
}

function showError(msg) {
  const quizCard = document.getElementById("quiz-card");
  if (quizCard) quizCard.innerHTML = `<div style="color: #d13438; text-align: center; padding: 20px; font-weight: 500;">${msg}</div>`;
}