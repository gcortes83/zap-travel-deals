const perform = async (z, bundle) => {
  const slackWebhookUrl = bundle.authData.slack_webhook || bundle.inputData.slack_webhook || process.env.SLACK_WEBHOOK;
  const slackRecipient = bundle.inputData.slack_recipient || process.env.NOTIFICATIONS_SLACK;
  const email = bundle.inputData.email;
  const firstName = bundle.inputData.first_name || '';
  const lastName = bundle.inputData.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const percentWatched = bundle.inputData.percent_watched;
  const mediaName = bundle.inputData.media_name;

  // The template from instructions:
  // Cuernavaca Travel Deals - New Hot Lead! connect with: [Full Name]
  // Someone just watched 80% of the Serengeti Luxury Tour video.
  // Email: [Traveler Email]
  
  const message = `Cuernavaca Travel Deals - New Hot Lead! connect with: ${fullName}

Someone just watched ${Math.round(percentWatched * 100)}% of the ${mediaName} video.
Email: ${email}`;
  
  if (!slackWebhookUrl) {
    throw new Error('Slack Webhook URL not found in input fields or environment variables (SLACK_WEBHOOK).');
  }
  
  const response = await z.request({
    method: 'POST',
    url: slackWebhookUrl,
    body: {
      text: message
    },
    skipThrowForStatus: true
  });

  if (response.status >= 400 || (response.status !== 204 && !response.data && response.content !== 'ok')) {
    z.console.log(`Slack API returned ${response.status}: ${response.content}`);
    throw new Error(`Slack API error: ${response.status} - ${response.content}`);
  }

  // If it's a successful 200/204, Slack webhooks often return "ok" or nothing
  return {
    success: true,
    message: message,
    sent_to: slackRecipient,
    status: 'sent',
    raw_response: response.data
  };
};

export default {
  key: 'send_slack_notification',
  noun: 'Slack Notification',

  display: {
    label: 'Send Slack Notification',
    description: 'Sends a hot lead notification to Slack.'
  },

  operation: {
    perform,
    inputFields: [
      { key: 'slack_webhook', label: 'Slack Webhook URL', required: false, type: 'string', helpText: 'Your Slack Incoming Webhook URL. If empty, uses the default from environment configuration.' },
      { key: 'slack_recipient', label: 'Slack Channel/Recipient Name', required: false, type: 'string', helpText: 'Display name for the target channel/recipient. If empty, uses the default from environment configuration.' },
      { key: 'email', label: 'Traveler Email', required: true, type: 'string' },
      { key: 'first_name', label: 'First Name', required: false, type: 'string' },
      { key: 'last_name', label: 'Last Name', required: false, type: 'string' },
      { key: 'media_name', label: 'Video Name', required: true, type: 'string' },
      { key: 'percent_watched', label: 'Percent Watched', required: true, type: 'number' }
    ],
    sample: {
      success: true,
      message: 'Cuernavaca Travel Deals - New Hot Lead! connect with: John Doe \n\nSomeone just watched 80% of the Serengeti Luxury Tour video.\nEmail: traveler@example.com',
      sent_to: '#sales-leads',
      status: 'sent',
      raw_response: 'ok'
    },

    outputFields: [
      { key: 'success', label: 'Success', type: 'boolean' },
      { key: 'message', label: 'Message' },
      { key: 'sent_to', label: 'Sent To' },
      { key: 'status', label: 'Status' },
      { key: 'raw_response', label: 'Raw Response' }
    ]
  }
};
