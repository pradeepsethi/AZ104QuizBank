import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { app, saveUserProfile } from "./firebase-config.js";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const signInBtn = document.getElementById("sign-in-btn");
const userInfo = document.getElementById("user-info");
const userNameElem = document.getElementById("user-name");
const signOutBtn = document.getElementById("sign-out-btn");

if (signInBtn) {
  signInBtn.onclick = () => signInWithPopup(auth, provider).catch(err => console.error("Auth error:", err));
}
if (signOutBtn) {
  signOutBtn.onclick = () => signOut(auth).then(() => window.location.href = "index.html");
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    if (signInBtn) signInBtn.style.display = "none";
    if (userInfo) userInfo.style.display = "flex";
    if (userNameElem) userNameElem.textContent = user.displayName || user.email;
    saveUserProfile(user);
  } else {
    if (signInBtn) signInBtn.style.display = "block";
    if (userInfo) userInfo.style.display = "none";
  }
});