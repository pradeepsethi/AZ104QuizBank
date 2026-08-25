// Shared Firebase config, used by every page so the API key/project settings
// only need to be maintained in one place instead of copy-pasted four times.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCASvB92ch5r11Re1tP_qCRCVvuff5IsMI",
  authDomain: "az104quiz.firebaseapp.com",
  projectId: "az104quiz",
  storageBucket: "az104quiz.firebasestorage.app",
  messagingSenderId: "1087957798298",
  appId: "1:1087957798298:web:c3ef9ba200c9f0357bbe23"
};

export const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Writes/refreshes a profile doc at users/{uid} so the uid is traceable back
// to an email/name directly in Firestore, without needing the Auth console.
// Safe to call on every sign-in: merge:true only touches these fields and
// never overwrites the users/{uid}/scores subcollection.
export async function saveUserProfile(user) {
  if (!user) return;
  try {
    await setDoc(doc(db, "users", user.uid), {
      email: user.email || null,
      displayName: user.displayName || null,
      lastLogin: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error saving user profile:", error);
  }
}
