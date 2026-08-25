import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { app, saveUserProfile } from "./firebase-config.js";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let isUserLoggedIn = false;

// Fetch and render domains & topics from data/azure_certification_structure.json
async function loadOfficialTopics() {
  const gridContainer = document.getElementById("domains-grid");
  const examSelector = document.getElementById("exam-selector");

  try {
    const response = await fetch("data/azure_certification_structure.json");
    if (!response.ok) throw new Error("Failed to load azure_certification_structure.json");
    const structureData = await response.json();

    // Populate Complete Exam Selector
    if (structureData.sets_config && structureData.sets_config.complete) {
      examSelector.innerHTML = "";
      for (let i = 1; i <= structureData.sets_config.complete; i++) {
        const opt = document.createElement("option");
        opt.value = `e${i}`;
        opt.textContent = `Exam ${i} (e${i}.json)`;
        examSelector.appendChild(opt);
      }
    }

    // Render Domains & Topics Grid
    gridContainer.innerHTML = "";
    structureData.domains.forEach((d) => {
      const domainId = d.domain_id;
      const domainTitle = d.domain;

      let topicsHtml = "";
      d.topics.forEach((topicObj) => {
        const topicId = `${domainId}_${topicObj.topic_id}`;
        topicsHtml += `
          <li>
            <a href="quiz.html?mode=topic&set=set1&topic=${topicId}&title=${encodeURIComponent(topicObj.name)}" class="quiz-access-link">
              ${topicObj.name}
            </a>
          </li>`;
      });

      const section = document.createElement("section");
      section.className = "domain-column card";
      section.innerHTML = `
        <div class="domain-column__header">
          <a href="quiz.html?mode=domain&set=set1&domain=${domainId}&title=${encodeURIComponent(domainTitle)}" class="quiz-access-link domain-column__link">
            ${domainTitle} →
          </a>
          <span class="domain-column__percentage">${d.percentage}</span>
        </div>
        <ul class="domain-column__topics">
          ${topicsHtml}
        </ul>
      `;
      gridContainer.appendChild(section);
    });

    attachLinkGuardHandlers();
  } catch (error) {
    console.error("Error loading topic metadata:", error);
    gridContainer.innerHTML = `<p class="text-danger">Could not load official exam structure: ${error.message}</p>`;
  }
}

function attachLinkGuardHandlers() {
  const allQuizLinks = document.querySelectorAll("a[href*='quiz.html']");
  allQuizLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      if (!isUserLoggedIn) {
        e.preventDefault();
        alert("⚠️ Access Restricted: You must sign in with Google to attempt quizzes.");
        signInWithPopup(auth, provider).catch(err => console.error("Auth error:", err));
      }
    });
  });
}

loadOfficialTopics();

// Exam Selector Logic
const examSelector = document.getElementById("exam-selector");
const fullExamLink = document.getElementById("full-exam-link");

examSelector.onchange = (e) => {
  const selectedExam = e.target.value;
  const examTitleName = `AZ-104 Complete Practice Exam (${selectedExam.toUpperCase()})`;
  const examUrl = new URL("quiz.html", window.location.origin);
  examUrl.searchParams.set("mode", "complete");
  examUrl.searchParams.set("exam", selectedExam);
  examUrl.searchParams.set("title", examTitleName);
  fullExamLink.href = examUrl.pathname + examUrl.search;
};

// Firebase Auth UI
const signInBtn = document.getElementById("sign-in-btn");
const signOutBtn = document.getElementById("sign-out-btn");
const userInfo = document.getElementById("user-info");
const userName = document.getElementById("user-name");
const loginAlertBanner = document.getElementById("login-alert-banner");

signInBtn.onclick = () => signInWithPopup(auth, provider).catch(err => console.error("Auth error:", err));
signOutBtn.onclick = () => signOut(auth).catch(err => console.error("Sign out error:", err));

onAuthStateChanged(auth, (user) => {
  if (user) {
    isUserLoggedIn = true;
    signInBtn.style.display = "none";
    userInfo.style.display = "flex";
    userName.textContent = user.displayName || user.email;
    if (loginAlertBanner) loginAlertBanner.style.display = "none";
    saveUserProfile(user);
  } else {
    isUserLoggedIn = false;
    signInBtn.style.display = "block";
    userInfo.style.display = "none";
    if (loginAlertBanner) loginAlertBanner.style.display = "block";
  }
});
