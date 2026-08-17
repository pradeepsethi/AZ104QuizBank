# ☁️ AZ-104: Microsoft Azure Administrator Practice Quiz Bank

An interactive, zero-dependency web application designed for candidate preparation for the **Microsoft Azure Administrator (AZ-104)** certification exam. Practice by specific **topics**, full **domains**, or timed **mock exams**.

---

## ✨ Features

* 🎯 **3 Practice Modes:**
  * **Topic Mode:** Focus on specific micro-topics (e.g., *Entra Users & Groups*, *Storage Accounts*, *Virtual Networks*).
  * **Domain Mode:** Test your knowledge across an entire certification objective domain.
  * **Exam Mode:** Full timed mock exam spanning all 5 Azure domains.
* 🔀 **Multiple Practice Sets:** Easily switch between different question sets (`Set 1`, `Set 2`, `Set 3`) on the fly.
* ⏱️ **Interactive Quiz UI:** Real-time countdown timer, dynamic progress bar, interactive question palette navigator, and review screen with detailed explanations.
* ⚡ **Lightweight & Fast:** Built purely with **HTML5, CSS3, and Vanilla JavaScript (ES6+)**. No external build tools, libraries, or npm frameworks required.

---

## 📁 Repository Structure

```text
my-az104-quiz/
├── index.html         # Main dashboard / landing page
├── topic.html         # Interactive quiz engine page
├── styles.css         # Main stylesheet (CSS custom properties)
├── app.js             # Core quiz logic, timer, and data fetcher
├── README.md          # Project documentation
└── data/              # Quiz data repository
    ├── topics/        # Micro-topic question sets
    │   ├── set1/
    │   │   ├── d1_topic1.json
    │   │   ├── d1_topic2.json
    │   │   └── ...
    │   ├── set2/
    │   └── set3/
    ├── domains/       # Domain-wide question sets
    │   ├── set1/
    │   │   ├── d1.json
    │   │   └── ...
    │   └── set2/
    └── exams/         # Full mock exam sets
        ├── e1.json
        ├── e2.json
        └── e3.json