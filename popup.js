document.addEventListener("DOMContentLoaded", function () {
  const statusElement = document.getElementById("status");
  const analyzeButton = document.getElementById("analyzeButton");
  const resultsDiv = document.getElementById("results");
  const loadingSpinner = document.getElementById("loadingSpinner");

  let currentVideoUrl = null;
  let currentVideoId = null;

  async function getCurrentTabInfo() {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function getVideoId(url) {
    const regExp =
      /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/;
    const match = url.match(regExp);
    return match && match[1] ? match[1] : null;
  }

  function updateStatus(message, showSpinner = false) {
    statusElement.textContent = message;
    if (loadingSpinner) {
      loadingSpinner.style.display = showSpinner ? "inline-block" : "none";
    }
  }

  function renderResults(analysisData) {
    resultsDiv.innerHTML = "";

    if (!analysisData || analysisData.status === "not_analyzed") {
      updateStatus(
        analysisData ? analysisData.message : "Waiting for video analysis...",
        true
      );
      analyzeButton.disabled = true;
      return;
    } else if (analysisData.status === "analyzing") {
      updateStatus(analysisData.message, true);
      analyzeButton.disabled = true;
      return;
    } else if (analysisData.status === "error") {
      updateStatus(`Error: ${analysisData.message}`);
      analyzeButton.disabled = false;
      analyzeButton.textContent = "Re-analyze";
      return;
    } else if (analysisData.status === "completed" && analysisData.data) {
      const data = analysisData.data;

      if (data.comments && data.comments.length > 0) {
        updateStatus(`Analysis complete for ${data.comments.length} comments.`);
        analyzeButton.disabled = false;
        analyzeButton.textContent = "Re-analyze";

        let positiveCount = 0;
        let neutralCount = 0;
        let negativeCount = 0;
        let totalScore = 0;
        let analyzedCommentsCount = 0;

        data.comments.forEach((comment) => {
          if (
            comment.sentiment &&
            typeof comment.sentiment.score === "number" &&
            !isNaN(comment.sentiment.score)
          ) {
            const score = comment.sentiment.score;
            totalScore += score;
            analyzedCommentsCount++;

            if (score > 0.2) {
              positiveCount++;
            } else if (score < -0.2) {
              negativeCount++;
            } else {
              neutralCount++;
            }
          }
        });

        const averageSentimentScore =
          analyzedCommentsCount > 0 ? totalScore / analyzedCommentsCount : 0;
        let overallSentimentCategory = "Neutral";
        let overallSentimentClass = "neutral-sentiment";
        let verdictEmoji = "😐";
        let verdictTitle = "MIXED RECEPTION";

        if (averageSentimentScore > 0.2) {
          overallSentimentCategory = "Overall Positive";
          overallSentimentClass = "positive-sentiment";
          verdictEmoji = "👍";
          verdictTitle = "RECOMMENDED";
        } else if (averageSentimentScore < -0.2) {
          overallSentimentCategory = "Overall Negative";
          overallSentimentClass = "negative-sentiment";
          verdictEmoji = "👎";
          verdictTitle = "NOT RECOMMENDED";
        } else {
          overallSentimentCategory = "Overall Neutral";
          overallSentimentClass = "neutral-sentiment";
          verdictEmoji = "😐";
          verdictTitle = "MIXED RECEPTION";
        }

        const totalValidComments = positiveCount + neutralCount + negativeCount;
        const positivePercentage =
          totalValidComments > 0
            ? ((positiveCount / totalValidComments) * 100).toFixed(0)
            : 0;
        const neutralPercentage =
          totalValidComments > 0
            ? ((neutralCount / totalValidComments) * 100).toFixed(0)
            : 0;
        const negativePercentage =
          totalValidComments > 0
            ? ((negativeCount / totalValidComments) * 100).toFixed(0)
            : 0;

        const verdictSectionHtml = `
                    <div class="main-verdict ${overallSentimentClass}">
                        <div class="verdict-emoji">${verdictEmoji}</div>
                        <div class="verdict-title">${verdictTitle}</div>
                        <div class="verdict-text-large">${overallSentimentCategory}</div>
                        <div class="verdict-subtext">(${analyzedCommentsCount} comments analyzed)</div>
                        <div class="video-category-display">Category: <strong>${
                          data.videoCategory || "Unknown"
                        }</strong></div>
                    </div>
                    <div class="sentiment-breakdown">
                        <div class="sentiment-bar positive-bar" style="width: ${positivePercentage}%;"><span>${positivePercentage}% Positive</span></div>
                        <div class="sentiment-bar neutral-bar" style="width: ${neutralPercentage}%;"><span>${neutralPercentage}% Neutral</span></div>
                        <div class="sentiment-bar negative-bar" style="width: ${negativePercentage}%;"><span>${negativePercentage}% Negative</span></div>
                    </div>
                `;
        resultsDiv.insertAdjacentHTML("beforeend", verdictSectionHtml);

        if (data.themes && data.themes.length > 0) {
          let themesHtml = `
                        <div class="themes-section">
                            <h4>Common Themes:</h4>
                            <div class="theme-tags-container">
                    `;
          data.themes.forEach((theme) => {
            let themeSentimentClass = "";
            if (theme.sentimentCategory === "positive")
              themeSentimentClass = "positive-sentiment";
            else if (theme.sentimentCategory === "negative")
              themeSentimentClass = "negative-sentiment";
            else themeSentimentClass = "neutral-sentiment";

            themesHtml += `<span class="theme-tag ${themeSentimentClass}">${theme.name} (${theme.occurrences})</span>`;
          });
          themesHtml += `
                            </div>
                            <p class="theme-info">Numbers in parentheses indicate occurrences. Higher scores mean more positive sentiment regarding that theme.</p>
                        </div>
                    `;
          resultsDiv.insertAdjacentHTML("beforeend", themesHtml);
        } else if (data.comments.length > 0) {
          resultsDiv.insertAdjacentHTML(
            "beforeend",
            '<p class="no-themes-info">No significant common themes were detected in the comments.</p>'
          );
        }

        resultsDiv.insertAdjacentHTML(
          "beforeend",
          '<h4 class="comments-heading">Individual Comments:</h4>'
        );
        const commentsContainer = document.createElement("div");
        commentsContainer.className = "individual-comments-container";

        data.comments.forEach((comment) => {
          const p = document.createElement("p");
          let sentimentText = "N/A";
          let sentimentClass = "";

          if (
            comment.sentiment &&
            typeof comment.sentiment.score === "number" &&
            !isNaN(comment.sentiment.score)
          ) {
            const score = comment.sentiment.score;
            if (score > 0.2) {
              sentimentText = "Positive";
              sentimentClass = "positive-sentiment";
            } else if (score < -0.2) {
              sentimentText = "Negative";
              sentimentClass = "negative-sentiment";
            } else {
              sentimentText = "Neutral";
              sentimentClass = "neutral-sentiment";
            }
            p.innerHTML = `<span class="comment-text">${
              comment.text
            }</span> <span class="sentiment ${sentimentClass}">[${sentimentText} Score: ${score.toFixed(
              2
            )}]</span>`;
          } else {
            const errorMessage =
              comment.error ||
              (comment.sentiment && comment.sentiment.error) ||
              "Unknown Analysis Error";
            p.innerHTML = `<span class="comment-text">${comment.text}</span> <span class="sentiment error-sentiment">[Analysis Error: ${errorMessage}]</span>`;
          }
          commentsContainer.appendChild(p);
        });
        resultsDiv.appendChild(commentsContainer);
      } else {
        updateStatus("No comments found or analyzed for this video.");
        resultsDiv.innerHTML = `
                    <p>It appears there are no comments to analyze for this video, or the backend encountered an issue retrieving them.</p>
                    <p>Video Category: <strong>${
                      data.videoCategory || "Unknown"
                    }</strong></p>
                `;
      }
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      message.type === "analysisDataUpdate" &&
      message.videoId === currentVideoId
    ) {
      renderResults(message.data);
    }
  });

  getCurrentTabInfo()
    .then((tab) => {
      if (tab && tab.url) {
        currentVideoUrl = tab.url;
        currentVideoId = getVideoId(currentVideoUrl);

        if (currentVideoId) {
          updateStatus("Requesting analysis data...", true);
          analyzeButton.disabled = true;
          analyzeButton.textContent = "Analyzing...";

          chrome.runtime.sendMessage(
            {
              type: "requestAnalysisData",
              videoId: currentVideoId,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "Error requesting analysis data:",
                  chrome.runtime.lastError.message
                );
                updateStatus(
                  "Error communicating with background service. Try reloading the extension or YouTube page."
                );
                analyzeButton.disabled = false;
                analyzeButton.textContent = "Re-analyze";
                return;
              }
              if (response && response.data) {
                renderResults(response.data);
              } else {
                updateStatus(
                  "No analysis data available yet. Please wait for automatic analysis.",
                  true
                );
              }
            }
          );
        } else {
          updateStatus(
            "Please navigate to a YouTube video page to use the analyzer."
          );
          analyzeButton.textContent = "Not a YouTube video page.";
          analyzeButton.disabled = true;
        }
      } else {
        updateStatus("Could not get current tab URL.");
        console.error(
          "Error getting tab URL: No active tab found or URL not available."
        );
        analyzeButton.disabled = true;
      }
    })
    .catch((error) => {
      updateStatus("Error getting tab URL.");
      console.error("Error getting tab URL:", error);
      analyzeButton.disabled = true;
    });

  analyzeButton.addEventListener("click", () => {
    if (currentVideoId) {
      updateStatus("Initiating re-analysis...", true);
      analyzeButton.disabled = true;
      analyzeButton.textContent = "Analyzing...";
      chrome.runtime.sendMessage({
        type: "videoDetected",
        videoId: currentVideoId,
        forceAnalyze: true,
      });
    }
  });
});
