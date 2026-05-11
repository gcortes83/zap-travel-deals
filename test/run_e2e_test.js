#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // Standard in many environments, but if not we might need to use standard https or find what's available

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const WISTIA_TOKEN = process.env.WISTIA_TOKEN;
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK;

if (!WISTIA_TOKEN || !SLACK_WEBHOOK) {
  console.error('Missing WISTIA_TOKEN or SLACK_WEBHOOK in .env');
  process.exit(1);
}

const z = {
  request: async (options) => {
    const url = options.url;
    const method = options.method || 'GET';
    const headers = options.headers || {};
    let body = options.body;

    // Apply Wistia Auth if needed (emulating beforeRequest middleware)
    if (url.includes('api.wistia.com')) {
      const token = WISTIA_TOKEN.trim();
      const basic = Buffer.from(`${token}:`).toString('base64');
      headers['Authorization'] = `Basic ${basic}`;
    }

    if (body && typeof body === 'object') {
      body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }

    console.log(`Making ${method} request to ${url}...`);
    
    let finalUrl = url;
    if (options.params) {
      const searchParams = new URLSearchParams(options.params);
      finalUrl += (finalUrl.includes('?') ? '&' : '?') + searchParams.toString();
    }

    const response = await fetch(finalUrl, {
      method,
      headers,
      body
    });

    const content = await response.text();
    let data;
    try {
      data = JSON.parse(content);
    } catch (e) {
      data = content;
    }

    return {
      status: response.status,
      content,
      data
    };
  },
  console: {
    log: (...args) => console.log('[Zapier Log]', ...args)
  }
};

(async () => {
  try {
    const newLeadModule = await import(path.resolve(__dirname, '../triggers/new_lead.js'));
    const newLead = newLeadModule.default;

    const sendSlackModule = await import(path.resolve(__dirname, '../creates/send_slack_notification.js'));
    const sendSlack = sendSlackModule.default;

    console.log('--- Step 1: Fetching Leads from Wistia ---');
    const bundle = {
      authData: {
        api_token: WISTIA_TOKEN
      },
      inputData: {}
    };

    const leads = await newLead.operation.performList(z, bundle);
    console.log(`Found ${leads.length} high-intent leads.`);

    if (leads.length === 0) {
      console.log('No leads found to test Slack notification. Using a sample lead.');
      leads.push(newLead.operation.sample);
    }

    const testLead = leads[0];
    console.log('Using lead:', testLead.email);

    console.log('\n--- Step 2: Sending Notification to Slack ---');
    const slackBundle = {
      authData: {
        slack_webhook: SLACK_WEBHOOK
      },
      inputData: {
        email: testLead.email,
        first_name: testLead.first_name,
        last_name: testLead.last_name,
        percent_watched: testLead.percent_watched,
        media_name: testLead.media_name,
        slack_webhook: SLACK_WEBHOOK
      }
    };

    const result = await sendSlack.operation.perform(z, slackBundle);
    console.log('Slack response:', result);
    console.log('\nE2E Test completed successfully!');

  } catch (err) {
    console.error('E2E Test failed:', err);
    process.exit(1);
  }
})();
