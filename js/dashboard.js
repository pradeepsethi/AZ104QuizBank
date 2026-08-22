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
  scoresContainer.innerHTML = `<p style="color: #605e5c;">Loading score history...</p>`;

  try {
    const q = query(
      collection(db, "users", uid, "scores"),
      orderBy("timestamp", "desc")
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      scoresContainer.innerHTML = `<p style="color: #605e5c;">No saved quiz scores found yet. Take a quiz to record your scores!</p>`;
      return;
    }

    let html = "";
    querySnapshot.forEach((documentSnap) => {
      const data = documentSnap.data();
      const docId = documentSnap.id;
      const dateStr = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleString() : "N/A";

      html += `
        <div style="border: 1px solid #c8c6c4; padding: 15px; margin-bottom: 12px; border-radius: 6px; background: #faf9f8; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h4 style="margin: 0 0 6px 0; color: #0078d4; font-size: 16px;">${data.quizTitle || "AZ-104 Quiz"}</h4>
            <p style="margin: 2px 0; font-size: 14px;"><strong>Score:</strong> ${data.score} / ${data.totalQuestions} (${data.percentage}%)</p>
            <p style="margin: 2px 0; font-size: 13px; color: #605e5c;"><strong>Time Spent:</strong> ${data.timeTaken || "N/A"}</p>
            <p style="margin: 2px 0; font-size: 12px; color: #8a8886;"><strong>Date:</strong> ${dateStr}</p>
          </div>
          <button class="delete-score-btn btn btn-danger" data-id="${docId}" style="padding: 6px 12px; font-size: 12px; cursor: pointer;">Delete</button>
        </div>
      `;
    });

    scoresContainer.innerHTML = html;

    document.querySelectorAll(".delete-score-btn").forEach((btn) => {
      btn.onclick = (e) => {
        const scoreId = e.target.getAttribute("data-id");
        if (confirm("Are you sure you want to delete this score record?")) {
          deleteScore(uid, scoreId);
        }
      };
    });
  } catch (error) {
    console.error("Error loading scores:", error);
    scoresContainer.innerHTML = `<p style="color: #d13438;">Error loading scores: ${error.message}</p>`;
  }
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
