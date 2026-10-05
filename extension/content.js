// Local agent backend or deployed Render URL
const API_URL = "http://localhost:5000/api/evaluate-shorts-intent";

const SHORT_PATTERNS = [
  /instagram\.com\/reels/i,
  /instagram\.com\/reel\//i,
  /youtube\.com\/shorts/i,
  /tiktok\.com/i
];

function isShortsUrl(url) {
  return SHORT_PATTERNS.some((pattern) => pattern.test(url));
}

function pauseAllVideos() {
  const mediaElements = document.querySelectorAll("video, audio");
  mediaElements.forEach((el) => {
    try {
      el.pause();
      el.muted = true;
    } catch (_) {}
  });
}

function removeModal() {
  const existing = document.getElementById("mindfulbrake-backdrop");
  if (existing) existing.remove();
}

function renderModal() {
  if (document.getElementById("mindfulbrake-backdrop")) return;

  const backdrop = document.createElement("div");
  backdrop.id = "mindfulbrake-backdrop";

  backdrop.innerHTML = `
    <div class="mindfulbrake-card">
      <h2>⏸️ Short-Form Hook Detected</h2>
      <p>Short-form feeds are engineered to trigger compulsive dopamine loops. What specific video or topic did you come here to watch?</p>
      
      <textarea id="mf-intent-input" class="mindfulbrake-textarea" placeholder="e.g., Checking a tutorial reel sent by my classmate..."></textarea>
      
      <div class="mindfulbrake-actions">
        <button id="mf-leave-btn" class="mindfulbrake-btn btn-secondary">Exit Feed</button>
        <button id="mf-submit-btn" class="mindfulbrake-btn btn-primary">Check Intent</button>
      </div>

      <div id="mf-alert-box" class="mindfulbrake-alert"></div>
    </div>
  `;

  document.documentElement.appendChild(backdrop);

  // Exit Feed brings them back to safe landing page
  document.getElementById("mf-leave-btn").addEventListener("click", () => {
    window.location.href = window.location.origin;
  });

  // Evaluate Intent with AI Agent
  document.getElementById("mf-submit-btn").addEventListener("click", async () => {
    const input = document.getElementById("mf-intent-input").value;
    const alertBox = document.getElementById("mf-alert-box");
    const submitBtn = document.getElementById("mf-submit-btn");

    submitBtn.disabled = true;
    submitBtn.innerText = "Analyzing...";
    alertBox.style.display = "block";
    alertBox.style.background = "#232332";
    alertBox.style.color = "#d1d5db";
    alertBox.innerText = "Evaluating intent with local Gemma agent...";

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput: input, platform: window.location.hostname })
      });

      const data = await res.json();

      if (data.verdict === "VERIFIED") {
        alertBox.style.background = "#064e3b";
        alertBox.style.color = "#6ee7b7";
        alertBox.innerText = `Access Granted: ${data.reason} (${data.passMinutes}m pass)`;

        // Set pass expiration in chrome storage
        const passExpiry = Date.now() + (data.passMinutes || 3) * 60 * 1000;
        chrome.storage.local.set({ passExpiry }, () => {
          setTimeout(() => {
            removeModal();
            // Resume videos if requested
            const vids = document.querySelectorAll("video");
            vids.forEach(v => { v.muted = false; v.play(); });
          }, 1200);
        });
      } else {
        alertBox.style.background = "#7f1d1d";
        alertBox.style.color = "#fca5a5";
        alertBox.innerText = `${data.reason} Redirecting out of the dopamine loop...`;

        setTimeout(() => {
          window.location.href = window.location.origin;
        }, 3200);
      }
    } catch (err) {
      alertBox.style.background = "#374151";
      alertBox.style.color = "#f3f4f6";
      alertBox.innerText = "Agent unreachable. Redirecting to home.";
      setTimeout(() => { window.location.href = window.location.origin; }, 1500);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = "Check Intent";
    }
  });
}

function inspectRoute() {
  if (!isShortsUrl(window.location.href)) {
    removeModal();
    return;
  }

  // Check if active pass exists
  chrome.storage.local.get(["passExpiry"], (data) => {
    if (data.passExpiry && Date.now() < data.passExpiry) {
      // User is within an active pass
      return;
    }
    pauseAllVideos();
    renderModal();
  });
}

// Intercept video autoplay loops
setInterval(() => {
  if (isShortsUrl(window.location.href) && document.getElementById("mindfulbrake-backdrop")) {
    pauseAllVideos();
  }
}, 500);

// Detect client-side SPA navigation
let previousUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== previousUrl) {
    previousUrl = window.location.href;
    inspectRoute();
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

// Initial execution
inspectRoute();