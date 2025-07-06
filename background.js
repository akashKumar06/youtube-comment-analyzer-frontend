const BACKEND_API_URL = "http://localhost:8000";

const ANALYZED_DATA_CACHE = {};

function getVideoId(url) {
  const regExp =
    /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/;
  const match = url.match(regExp);
  return match && match[1] ? match[1] : null;
}

async function fetchAndAnalyzeVideo(videoId, forceAnalyze = false) {
  console.log(`Background: Starting analysis for video ID: ${videoId}`);

  if (
    !forceAnalyze &&
    ANALYZED_DATA_CACHE[videoId] &&
    (ANALYZED_DATA_CACHE[videoId].status === "analyzing" ||
      ANALYZED_DATA_CACHE[videoId].status === "completed")
  ) {
    console.log(
      `Background: Analysis for ${videoId} already in progress or completed. Skipping.`
    );
    broadcastDataToPopup(videoId); // Broadcast existing state
    return;
  }

  // Set status to analyzing
  ANALYZED_DATA_CACHE[videoId] = {
    status: "analyzing",
    message: "Fetching and analyzing comments...",
  };
  broadcastDataToPopup(videoId); // Update popup with "analyzing" status

  try {
    const fetchUrl = `${BACKEND_API_URL}/comments?videoId=${videoId}`;
    const response = await fetch(fetchUrl);

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = `Backend Error: ${
        errorData.message || response.statusText
      }`;
      console.error("Background: Backend Proxy Error:", errorData);
      ANALYZED_DATA_CACHE[videoId] = { status: "error", message: errorMessage };
    } else {
      const data = await response.json();
      ANALYZED_DATA_CACHE[videoId] = { status: "completed", data: data };
      console.log(`Background: Analysis completed for video ID: ${videoId}`);
    }
  } catch (error) {
    const errorMessage = `Analysis failed: ${error.message}`;
    console.error(
      "Background: Error fetching comments and sentiment from backend:",
      error
    );
    ANALYZED_DATA_CACHE[videoId] = { status: "error", message: errorMessage };
  } finally {
    broadcastDataToPopup(videoId);
  }
}

// Function to send data to the open popup if it's for the relevant video
function broadcastDataToPopup(videoId) {
  chrome.runtime
    .sendMessage({
      type: "analysisDataUpdate",
      videoId: videoId,
      data: ANALYZED_DATA_CACHE[videoId],
    })
    .catch((error) => {
      console.debug(
        "No active popup listener or error sending message:",
        error.message
      );
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "videoDetected" && message.videoId) {
    const videoId = message.videoId;
    fetchAndAnalyzeVideo(videoId, message.forceAnalyze);
  } else if (message.type === "requestAnalysisData" && message.videoId) {
    const videoId = message.videoId;
    if (ANALYZED_DATA_CACHE[videoId]) {
      sendResponse({ data: ANALYZED_DATA_CACHE[videoId] });
    } else {
      sendResponse({
        data: {
          status: "not_analyzed",
          message:
            "No analysis data found for this video. Starting analysis...",
        },
      });
      fetchAndAnalyzeVideo(videoId);
    }
    return true;
  }
});

console.log("Background service worker started.");
