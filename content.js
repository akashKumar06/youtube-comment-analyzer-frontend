function getVideoId(url) {
  const regExp =
    /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/;
  const match = url.match(regExp);
  return match && match[1] ? match[1] : null;
}

let lastVideoId = null;

function checkVideoAndSendToBackground() {
  const currentUrl = window.location.href;
  const currentVideoId = getVideoId(currentUrl);

  if (currentVideoId && currentVideoId !== lastVideoId) {
    console.log(`Content: Detected new video ID: ${currentVideoId}`);
    lastVideoId = currentVideoId;
    chrome.runtime.sendMessage({
      type: "videoDetected",
      videoId: currentVideoId,
      url: currentUrl,
    });
  } else if (!currentVideoId && lastVideoId) {
    console.log(
      "Content: Navigated away from a video page. Resetting lastVideoId."
    );
    lastVideoId = null;
  }
}

checkVideoAndSendToBackground();

const observer = new MutationObserver(() => {
  checkVideoAndSendToBackground();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
});

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
