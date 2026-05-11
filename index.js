import packageJson from './package.json' with { type: 'json' };
import zapier from 'zapier-platform-core';

import getNewLead from './triggers/new_lead.js';
import sendSlackNotification from './creates/send_slack_notification.js';
import authentication from './authentication.js';

const handleBeforeRequest = (request, z, bundle) => {
  // Only apply Wistia Token to Wistia API requests
  if (request.url.includes('api.wistia.com')) {
    const token = bundle.authData.api_token || process.env.WISTIA_TOKEN;
    if (token) {
      // Wistia uses HTTP Basic auth with the API token as the username and an empty password
      const basic = Buffer.from(`${token}:`).toString('base64');
      request.headers.Authorization = `Basic ${basic}`;
    }
  }
  return request;
};


export default {
  // This is just shorthand to reference the installed dependencies you have.
  // Zapier will need to know these before we can upload.
  version: packageJson.version,
  platformVersion: zapier.version,

  // If you want your trigger to show up, you better include it here!
  triggers: {
    [getNewLead.key]: getNewLead
  },

  authentication: authentication,

  beforeRequest: [handleBeforeRequest],

  // If you want your searches to show up, you better include it here!
  searches: {},

  // If you want your creates to show up, you better include it here!
  creates: {
    [sendSlackNotification.key]: sendSlackNotification
  },

  resources: {},
  flags: {
    cleanInputData: false
  }
};
