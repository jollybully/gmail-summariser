// Google Apps Script for Daily Email Digest
// This script runs once per day at 10am to summarize important emails from the last 24 hours

const DIGEST_RECIPIENT = "your-email@yourdomain.com";
const ALLOWED_DOMAIN = "allowed-domain.com";
const GEMINI_API_KEY = "api-key-here";
const DEBUG_MODE = true; // Set to false for production

// List of email patterns to filter out
const EXCLUDED_PATTERNS = [
	"newsletters@",
	"noreply@",
	"no-reply@",
	"notifications@",
	"info@",
	"marketing@",
	"donotreply@",
	"updates@",
	"mail@",
	"support@",
	"billing@",
	"sales@",
	"legal@",
	"hr@",
	"@freecodecamp.org",
	"@github.com",
	"@gitlab.com",
	"@bitbucket.org",
	"@heroku.com",
	"@herokuapp.com",
	"@herokuapp.net",
	"@google.com",
	"webmaster@",
	"datadojo+summary@",
];

// Add these new constants after EXCLUDED_PATTERNS
const EXCLUDED_SUBJECT_PATTERNS = [
	"automatic reply",
	"out of office",
	"away from office",
	"vacation response",
	"holiday notice",
	"meeting invitation",
	"calendar invitation",
	"calendar notification",
	"declined:",
	"accepted:",
	"updated invitation:",
	"canceled:",
	"cancelled:",
	"reminder:",
	"fwd:",
	"[jira]",
	"[confluence]",
	"[bitbucket]",
	"jenkins build",
	"Archive Request - ",
	"Links / Embeds:",
	"Daily New Releases from Your Followed Artists",
	"Audio Archive"
];

function createDailyTrigger() {
	// Remove any existing triggers
	const triggers = ScriptApp.getProjectTriggers();
	triggers.forEach((trigger) => ScriptApp.deleteTrigger(trigger));

	// Create a new trigger to run at 10am every day
	ScriptApp.newTrigger("generateDailyDigest")
		.timeBased()
		.everyDays(1)
		.atHour(10)
		.create();
}

function generateDailyDigest() {
	try {
		// Check if it's a weekend
		const today = new Date();
		const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

		if (dayOfWeek === 0 || dayOfWeek === 6) {
			Logger.log('Weekend detected - skipping digest');
			return;
		}

		// Determine search window based on day of week
		const searchQuery = buildSearchQuery();
		if (!searchQuery) {
			Logger.log('No search query generated - skipping digest');
			return;
		}

		Logger.log(`Executing search with query: ${searchQuery}`);
		const threads = GmailApp.search(searchQuery);
		Logger.log(`Found ${threads.length} total threads in inbox`);

		let digestContent = [];

		for (const thread of threads) {
			// Skip if thread is read
			if (!thread.hasUnreadMessages()) {
				Logger.log('Skipped - no unread messages');
				continue;
			}

			const messages = thread.getMessages();
			const latestMessage = messages[messages.length - 1];
			const subject = thread.getFirstMessageSubject();

			// Add debug logging
			Logger.log(`Processing thread: ${subject}`);
			Logger.log(`From: ${latestMessage.getFrom()}`);

			// Check subject patterns first
			if (isExcludedSubject(subject)) {
				Logger.log('Skipped - excluded subject pattern');
				continue;
			}

			// Skip if the sender matches any excluded patterns
			if (isExcludedSender(latestMessage.getFrom())) {
				Logger.log('Skipped - excluded sender pattern');
				continue;
			}

			// Only process emails from allowed domain
			const sender = latestMessage.getFrom();
			const emailMatch = sender.match(/<(.+?)>/);
			const emailAddress = emailMatch ? emailMatch[1] : sender;

			if (!emailAddress.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
				Logger.log('Skipped - not from allowed domain');
				continue;
			}

			// Process the thread and add to digest
			const threadSummary = processThread(thread);
			if (threadSummary) {
				digestContent.push(threadSummary);
				Logger.log('Thread added to digest');
			}
		}

		if (digestContent.length > 0) {
			sendDigestEmail(digestContent);
		} else {
			Logger.log("No relevant emails to summarize in the last 24 hours");
		}

	} catch (error) {
		if (DEBUG_MODE) {
			Logger.log('DEBUG MODE: Error notification would have been sent:');
			Logger.log(`Error generating daily digest: ${error.toString()}`);
		} else {
			GmailApp.sendEmail(
				DIGEST_RECIPIENT,
				"Error: Daily Email Digest Failed",
				`The daily email digest script encountered an error: ${error.toString()}`
			);
		}
	}
}

function buildSearchQuery() {
	const today = new Date();
	const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

	// Base query components
	const baseQuery = 'in:inbox is:unread';

	// Determine time window based on day
	let timeWindow;
	if (dayOfWeek === 1) {
		// Monday - look back 3 days to catch Friday, Saturday, and Sunday
		timeWindow = 'newer_than:3d';
		Logger.log('Monday detected - searching last 3 days');
	} else if (dayOfWeek === 0 || dayOfWeek === 6) {
		// Weekend - don't run
		Logger.log('Weekend detected - script should not run');
		return null;
	} else {
		// Regular weekday - look back 1 day
		timeWindow = 'newer_than:1d';
		Logger.log('Regular weekday - searching last 24 hours');
	}

	return `${baseQuery} ${timeWindow}`;
}

function isExcludedSender(sender) {
	const emailMatch = sender.match(/<(.+?)>/);
	const emailAddress = emailMatch
		? emailMatch[1].toLowerCase()
		: sender.toLowerCase();

	// Check if it's a 'via' group email
	const viaMatch = sender.match(/'(.+?)' via/i);
	if (viaMatch) {
		Logger.log(`Detected 'via' group email from: ${viaMatch[1]}`);
		return true;
	}

	// Check against excluded patterns
	return EXCLUDED_PATTERNS.some((pattern) =>
		emailAddress.includes(pattern.toLowerCase())
	);
}

function isExcludedSubject(subject) {
	return EXCLUDED_SUBJECT_PATTERNS.some((pattern) =>
		subject.toLowerCase().includes(pattern.toLowerCase())
	);
}

function processThread(thread) {
	try {
		const messages = thread.getMessages();
		const firstMessage = messages[0];
		const lastMessage = messages[messages.length - 1];

		// Get thread metadata
		const threadData = {
			subject: thread.getFirstMessageSubject(),
			participants: getUniqueParticipants(messages),
			messageCount: messages.length,
			timespan: {
				start: firstMessage.getDate(),
				end: lastMessage.getDate(),
			},
			body: messages.map((m) => m.getPlainBody()).join("\n---\n"),
		};

		// Generate summary using existing summary function
		const summary = generateSummary(threadData);

		return formatThreadSummary(threadData, summary);
	} catch (error) {
		Logger.log(`Error processing thread: ${error.toString()}`);
		return null;
	}
}

function getUniqueParticipants(messages) {
	const participants = new Set();

	messages.forEach((message) => {
		const from = message.getFrom();
		const emailMatch = from.match(/<(.+?)>/);
		const emailAddress = emailMatch ? emailMatch[1] : from;
		participants.add(emailAddress);
	});

	return Array.from(participants);
}

function formatThreadSummary(threadData, summary) {
	const startTime = threadData.timespan.start.toLocaleTimeString();
	const endTime = threadData.timespan.end.toLocaleTimeString();
	const startDate = threadData.timespan.start.toLocaleDateString();
	const endDate = threadData.timespan.end.toLocaleDateString();

	return `
Thread: ${threadData.subject}
Participants: ${threadData.participants.join(", ")}
Messages: ${threadData.messageCount}
Timespan: ${startDate} ${startTime} - ${endDate} ${endTime}

${summary}

----------------------------------------
`;
}

function sendDigestEmail(digestContent) {
	const today = new Date().toLocaleDateString();
	const subject = `Daily Email Digest - ${today}`;

	// Generate top-level summary prompt
	const topLevelPrompt = `
Please provide a brief executive summary of these email threads. Focus on the most important updates, announcements, or action items.
Format your response as:

HIGHLIGHTS:
- [2-4 bullet points of the most significant items]

PRIORITY ACTIONS:
- [List any time-sensitive or important action items]

Here are the threads:

${digestContent.join("\n")}`;

	const topLevelSummary = callGeminiAPI(topLevelPrompt);

	const emailBody = `
DAILY EMAIL DIGEST - ${today}

${topLevelSummary}

----------------------------------------

${digestContent.join("\n")}

---
This digest contains summaries of ${digestContent.length} email threads from the last 24 hours.
`;

	if (DEBUG_MODE) {
		Logger.log('DEBUG MODE: Email would have been sent with:');
		Logger.log(`Subject: ${subject}`);
		Logger.log('Body:');
		Logger.log(emailBody);
	} else {
		GmailApp.sendEmail(DIGEST_RECIPIENT, subject, emailBody, {
			name: "Email Digest Bot",
		});
		Logger.log(`Digest email sent with ${digestContent.length} thread summaries`);
	}
}

// Reuse the existing summary generation function with slight modifications
function generateSummary(threadData) {
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

Email Thread Content:
${threadData.body}

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

// Reuse the existing API call function
function callGeminiAPI(prompt) {
	const apiEndpoint =
		"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent";
	const options = {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-goog-api-key": GEMINI_API_KEY,
		},
		payload: JSON.stringify({
			contents: [
				{
					parts: [{ text: prompt }],
				},
			],
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
