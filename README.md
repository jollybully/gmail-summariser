# Email Summary Assistant

A Google Apps Script that automatically generates AI-powered summaries of emails sent to a designated email address. The script processes incoming emails, generates a concise summary using the Gemini API, and sends the summary back to the original sender.

## Features

- Monitors a designated email address for incoming messages
- Processes emails from authorized domains only
- Generates structured summaries including:
  - Brief overview
  - Key points
  - Action items (if any)
- Sends summaries back to the original sender
- Automatically cleans up processed emails

## Setup

1. Create a new Google Apps Script project:

   - Go to [script.google.com](https://script.google.com)
   - Click "New Project"
   - Rename your project (e.g., "Email Summary Assistant")

2. Copy the code from `code.gs` into your project

3. Set up the configuration variables at the top of the script:

   ```javascript
   const SUMMARY_EMAIL = "your-summary-email@yourdomain.com";
   const ALLOWED_DOMAIN = "yourdomain.com";
   const GEMINI_API_KEY = "YOUR_API_KEY";
   ```

4. Get your Gemini API key:

   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create or select a project
   - Generate an API key
   - Copy the key into the `GEMINI_API_KEY` variable

5. Configure your summary email:

   - For personal use with Gmail, you can use the plus addressing feature:
     - Format: `yourusername+summary@gmail.com`
     - Example: if your email is `john@gmail.com`, use `john+summary@gmail.com`
   - For organizational use, set up a dedicated email address or use plus addressing with your domain

6. Set your allowed domain:

   - For personal use: set `ALLOWED_DOMAIN = "gmail.com"`
   - For organizational use: set to your company's email domain

7. Deploy the script:

   - Click "Deploy" > "New deployment"
   - Choose "Deploy as web app"
   - Set access to "Execute as me" and "Anyone with Google Account"
   - Click "Deploy"
   - Authorize the necessary permissions when prompted

8. Set up the trigger:
   - Run the `createTrigger` function once to set up automatic monitoring
   - Click on "Run" > "Run function" > "createTrigger"
   - The script will now check for new emails every minute

## Usage

1. Forward any email you want summarized to your configured summary email address
2. The script will process the email and send back a structured summary including:
   - A concise overview of the main message
   - Key points from the email
   - Any action items or deadlines mentioned

### Tips

- For personal use, you can create a filter in Gmail to automatically forward certain emails to your summary address
- Test the setup by sending yourself a test email first
- The script will only process emails from the allowed domain for security

## Requirements

- Google Account (Gmail or Google Workspace)
- Google Gemini API key
- Google Apps Script environment

## Security Notes

- The script only processes emails from authorized domains
- All API communications use secure HTTPS
- Implements rate limiting and error handling for API calls
- Your API key should be kept confidential
- The script runs with your Google account permissions

## Troubleshooting

- If summaries aren't being generated, check:
  - The trigger is running (View > Execution log)
  - Your API key is correct
  - Emails are from the allowed domain
  - The summary email address is correct

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
