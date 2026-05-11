export default {
  type: 'custom',
  test: {
    url: 'https://api.wistia.com/v1/account.json'
  },
  fields: [
    {
      key: 'api_token',
      type: 'string',
      required: true,
      helpText: 'Your Wistia API Token. [Learn more](https://wistia.com/support/developers/api-guide#api-tokens).'
    },
    {
      key: 'slack_webhook',
      type: 'string',
      required: false,
      helpText: 'Optional: Global Slack Incoming Webhook URL. [How to create](https://api.slack.com/messaging/webhooks).'
    }
  ],
  connectionLabel: '{{bundle.authData.api_token}}'
};
