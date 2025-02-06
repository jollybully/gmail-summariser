// Google Apps Script for Email Summarization
const SUMMARY_EMAIL = "your-summary-email@yourdomain.com";
const ALLOWED_DOMAIN = "yourdomain.com";
const GEMINI_API_KEY = "YOUR_API_KEY";

function checkForEmailsToProcess() {
  const searchQuery = `to:${SUMMARY_EMAIL} newer_than:10m`;
  const threads = GmailApp.search(searchQuery);

  for (const thread of threads) {
    const latestMessage = thread.getMessages()[thread.getMessages().length - 1];
    const sender = latestMessage.getFrom();
    const emailMatch = sender.match(/<(.+?)>/);
    const emailAddress = emailMatch ? emailMatch[1] : sender;

    if (!emailAddress.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
      Logger.log(`Skipping email from unauthorized sender: ${emailAddress}`);
      continue;
    }

    processEmail(latestMessage, thread);
  }
}

function processEmail(message, thread) {
  try {
    const messages = thread.getMessages();
    const threadContent = messages[0].getPlainBody();

    const emailData = {
      subject: messages[0].getSubject(),
      sender: message.getFrom(),
      body: threadContent,
    };

    const summary = generateSummary(emailData);
    sendSummaryResponse(emailData, summary);

    // Delete the original email and log it
    Logger.log(`Moving thread to trash: ${emailData.subject}`);
    thread.moveToTrash();
    Logger.log("Thread successfully moved to trash");
  } catch (error) {
    Logger.log(`Error processing email: ${error.toString()}`);
  }
}

function generateSummary(emailData) {
  const prompt = `
You are an email summarization assistant. Please provide a clear and concise summary of the following email thread.

Important Guidelines:
- Focus on the main message content, ignoring any signatures, footers, or automated disclaimers
- Pay attention to any requests, deadlines, or action items
- If the email is part of a thread, focus on the most recent/relevant information
- Ignore common email elements like:
  * Email signatures and contact details
  * Legal disclaimers
  * Confidentiality notices
  * Automated footers
  * "Sent from my iPhone" type messages
  * Meeting invites/calendar snippets

Email Content:
${emailData.body}

Please format your response as follows:

SUMMARY:
[Provide a brief, focused summary of the core message - 1-2 sentences maximum]

KEY POINTS:
- [List only the essential information points]
- [Include any specific requests or questions]
- [Include any deadlines or important dates]

ACTION ITEMS (if any):
- [List specific tasks, requests, or required responses]
- [Include who needs to do what, if specified]
- [Include deadlines if mentioned]

Note: If the email contains only greetings, signatures, or automated content, respond with "This email contains no substantial content to summarize."`;

  return callGeminiAPI(prompt);
}

function callGeminiAPI(prompt) {
  const apiEndpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent";
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    payload: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  };

  const maxRetries = 3;
  const initialDelayMs = 1000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = UrlFetchApp.fetch(apiEndpoint, options);

      if (response.getResponseCode() === 429) {
        const backoffMs = initialDelayMs * Math.pow(2, attempt);
        Utilities.sleep(backoffMs);
        continue;
      }

      const jsonResponse = JSON.parse(response.getContentText());
      return jsonResponse.candidates[0].content.parts[0].text;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw new Error(
          `Failed to call Gemini API after ${maxRetries} attempts: ${error.toString()}`
        );
      }
      const backoffMs = initialDelayMs * Math.pow(2, attempt);
      Utilities.sleep(backoffMs);
    }
  }
}

function sendSummaryResponse(emailData, summary) {
  try {
    const emailMatch = emailData.sender.match(/<(.+?)>/);
    const cleanRecipientEmail = emailMatch ? emailMatch[1] : emailData.sender;

    // Find the original thread
    const query = `subject:"${emailData.subject}" from:${cleanRecipientEmail}`;
    const threads = GmailApp.search(query, 0, 1);

    if (threads.length > 0) {
      // Reply only to the person who forwarded it
      threads[0].reply(summary, {
        from: SUMMARY_EMAIL,
        replyTo: SUMMARY_EMAIL,
        subject: `Re: ${emailData.subject}`,
        to: cleanRecipientEmail, // Explicitly set recipient
      });
      Logger.log("Sent summary as reply to original thread");
    } else {
      // Fallback to sending as new email if thread not found
      GmailApp.sendEmail(
        cleanRecipientEmail,
        `Re: ${emailData.subject}`,
        summary,
        {
          from: SUMMARY_EMAIL,
          replyTo: SUMMARY_EMAIL,
        }
      );
      Logger.log("Sent summary as new email (original thread not found)");
    }
  } catch (error) {
    Logger.log(`Error in sendSummaryResponse: ${error.toString()}`);
  }
}

function createTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger("checkForEmailsToProcess")
    .timeBased()
    .everyMinutes(1)
    .create();
}
