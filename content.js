// chrome-extension/content.js

// Function to extract YouTube Video ID from a URL
function getVideoId(url) {
  const regExp =
    /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/;
  const match = url.match(regExp);
  return match && match[1] ? match[1] : null;
}

let lastVideoId = null;

// Function to check current URL and send video ID to background script
function checkVideoAndSendToBackground() {
  const currentUrl = window.location.href;
  const currentVideoId = getVideoId(currentUrl);

  if (currentVideoId && currentVideoId !== lastVideoId) {
    console.log(`Content: Detected new video ID: ${currentVideoId}`);
    lastVideoId = currentVideoId;
    // Send message to background script
    chrome.runtime.sendMessage({
      type: "videoDetected",
      videoId: currentVideoId,
      url: currentUrl,
    });
  } else if (!currentVideoId && lastVideoId) {
    // If we were on a video and now we're not (e.g., navigated to YouTube homepage)
    console.log(
      "Content: Navigated away from a video page. Resetting lastVideoId."
    );
    lastVideoId = null; // Reset
  }
}

// Initial check when content script loads
checkVideoAndSendToBackground();

// Use MutationObserver for YouTube's Single-Page Application (SPA) navigation.
// This is crucial because YouTube often changes content without a full page reload.
const observer = new MutationObserver(() => {
  checkVideoAndSendToBackground();
});

// Observe changes to the document body (child list and subtree for URL changes, attributes for title changes).
// This is a robust way to detect navigation in SPAs.
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
});

// Also listen for pushState/replaceState events which YouTube uses for navigation
const originalPushState = history.pushState;
history.pushState = function () {
  originalPushState.apply(this, arguments);
  checkVideoAndSendToBackground();
};
const originalReplaceState = history.replaceState;
history.replaceState = function () {
  originalReplaceState.apply(this, arguments);
  checkVideoAndSendToBackground();
};

console.log("Content script loaded and observing URL changes.");
