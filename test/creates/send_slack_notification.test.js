import zapier from 'zapier-platform-core';
import App from '../../index.js';

const appTester = zapier.createAppTester(App);
zapier.tools.env.inject();

describe('creates.send_slack_notification', () => {
  it('should format the Slack message correctly', async () => {
    const bundle = {
      inputData: {
        email: 'traveler@example.com',
        first_name: 'John',
        last_name: 'Doe',
        media_name: 'Serengeti Luxury Tour',
        percent_watched: 0.80
      }
    };

    const result = await appTester(App.creates['send_slack_notification'].operation.perform, bundle);
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('Cuernavaca Travel Deals - New Hot Lead!');
    expect(result.message).toContain('connect with: John Doe');
    expect(result.message).toContain('watched 80% of the Serengeti Luxury Tour video');
  });
});
