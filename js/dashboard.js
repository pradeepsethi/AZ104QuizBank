import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { app, saveUserProfile } from "./firebase-config.js";

const auth = getAuth(app);
const db = getFirestore(app);

const scoresContainer = document.getElementById("scores-container");
const authWarning = document.getElementById("auth-warning");
const signInBtn = document.getElementById("sign-in-btn");
const userInfo = document.getElementById("user-info");
const userNameElem = document.getElementById("user-name");
const signOutBtn = document.getElementById("sign-out-btn");

let currentUser = null;
let scoreDataMap = {};

if (signOutBtn) {
  signOutBtn.onclick = () => signOut(auth).then(() => window.location.href = "index.html");
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  // ROUTE GUARD: Redirect to login page if unauthenticated
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  if (signInBtn) signInBtn.style.display = "none";
  if (userInfo) userInfo.style.display = "flex";
  if (userNameElem) userNameElem.textContent = user.displayName || user.email;
  if (signOutBtn) signOutBtn.style.display = "inline-block";
  saveUserProfile(user);

  authWarning.style.display = "none";
  loadScores(user.uid);
});

async function loadScores(uid) {
  if (!scoresContainer) return;
  scoresContainer.innerHTML = `<p class="text-muted">Loading score history...</p>`;

  try {
    const q = query(
      collection(db, "users", uid, "scores"),
      orderBy("timestamp", "desc")
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      scoresContainer.innerHTML = `<p class="text-muted">No saved quiz scores found yet. Take a quiz to record your scores!</p>`;
      return;
    }

    let rows = "";
    scoreDataMap = {};
    querySnapshot.forEach((documentSnap) => {
      const data = documentSnap.data();
      const docId = documentSnap.id;
      scoreDataMap[docId] = data;
      const dateStr = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleString() : "N/A";
      const incorrectCount = Array.isArray(data.incorrectQuestions) ? data.incorrectQuestions.length : 0;

      rows += `
        <tr>
          <td class="quiz-title-cell">${data.quizTitle || "AZ-104 Quiz"}</td>
          <td class="set-cell">${data.quizSet || "N/A"}</td>
          <td class="score-cell">${data.score} / ${data.totalQuestions} (${data.percentage}%)</td>
          <td>${data.timeTaken || "N/A"}</td>
          <td>${dateStr}</td>
          <td>
            ${incorrectCount > 0
              ? `<button class="review-btn btn btn-neutral" data-id="${docId}">🔍 Review (${incorrectCount})</button>`
              : `<span class="text-muted">—</span>`}
          </td>
          <td><button class="delete-score-btn btn btn-danger" data-id="${docId}">Delete</button></td>
        </tr>
        <tr class="review-row" id="review-row-${docId}" style="display: none;">
          <td colspan="7"><div class="review-panel" id="review-panel-${docId}"></div></td>
        </tr>
      `;
    });

    scoresContainer.innerHTML = `
      <div class="scores-table-wrap">
        <table class="scores-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Set</th>
              <th>Score</th>
              <th>Time Spent</th>
              <th>Date</th>
              <th>Incorrect Questions</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;

    document.querySelectorAll(".delete-score-btn").forEach((btn) => {
      btn.onclick = (e) => {
        const scoreId = e.target.getAttribute("data-id");
        if (confirm("Are you sure you want to delete this score record?")) {
          deleteScore(uid, scoreId);
        }
      };
    });

    document.querySelectorAll(".review-btn").forEach((btn) => {
      btn.onclick = (e) => {
        const docId = e.currentTarget.getAttribute("data-id");
        toggleReview(docId, e.currentTarget);
      };
    });
  } catch (error) {
    console.error("Error loading scores:", error);
    scoresContainer.innerHTML = `<p class="text-danger">Error loading scores: ${error.message}</p>`;
  }
}

function toggleReview(docId, btnElem) {
  const row = document.getElementById(`review-row-${docId}`);
  const panel = document.getElementById(`review-panel-${docId}`);
  if (!row || !panel) return;

  const isHidden = row.style.display === "none";

  if (isHidden) {
    if (!panel.dataset.rendered) {
      renderReviewPanel(docId, panel);
      panel.dataset.rendered = "true";
    }
    row.style.display = "table-row";
    if (btnElem) btnElem.textContent = btnElem.textContent.replace("🔍 Review", "🔽 Hide");
  } else {
    row.style.display = "none";
    if (btnElem) btnElem.textContent = btnElem.textContent.replace("🔽 Hide", "🔍 Review");
  }
}

function renderReviewPanel(docId, panel) {
  const data = scoreDataMap[docId];
  const incorrectQuestions = (data && data.incorrectQuestions) || [];

  if (incorrectQuestions.length === 0) {
    panel.innerHTML = `<p class="text-muted">No incorrect questions recorded for this attempt.</p>`;
    return;
  }

  let html = "";
  incorrectQuestions.forEach((q, i) => {
    const options = q.options || [];
    const correctIndices = q.correctIndices || [];
    const selectedIndices = q.selectedIndices || [];
    const isMultiple = correctIndices.length > 1;
    const explanationHTML = getExplanationHTML(q.explanation);

    let optionsHtml = "";
    options.forEach((optText, idx) => {
      const isCorrectOption = correctIndices.includes(idx);
      const isSelected = selectedIndices.includes(idx);
      let cls = "option-btn review-option";
      let marker = "";

      if (isCorrectOption) {
        cls += " is-correct";
        if (isMultiple) marker = "☑ ";
      } else if (isSelected) {
        cls += " is-incorrect";
        if (isMultiple) marker = "☒ ";
      }
      optionsHtml += `<div class="${cls}"><span>${marker}${optText}</span></div>`;
    });

    html += `
      <div class="review-question">
        <div class="question-meta">Missed Question ${i + 1}${q.subtopic ? ` (${q.subtopic})` : ""}</div>
        <pre class="question-text">${q.question || ""}</pre>
        <div class="options-container">${optionsHtml}</div>
        <div class="explanation-box visible">
          <strong>Explanation:</strong>
          <div class="explanation-body">${explanationHTML}</div>
        </div>
      </div>
    `;
  });

  panel.innerHTML = html;
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

async function deleteScore(uid, scoreId) {
  try {
    await deleteDoc(doc(db, "users", uid, "scores", scoreId));
    loadScores(uid);
  } catch (error) {
    console.error("Error deleting score:", error);
    alert(`Failed to delete record: ${error.message}`);
  }
}
