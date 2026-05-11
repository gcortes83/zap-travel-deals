const getAllowedMediaIds = (bundle) => {
  // Use media_ids from inputData if provided, otherwise use .env
  if (bundle && bundle.inputData && bundle.inputData.media_ids && bundle.inputData.media_ids.length > 0) {
    return bundle.inputData.media_ids;
  }

  const video01 = process.env.WISTIA_VIDEO_01;
  const video02 = process.env.WISTIA_VIDEO_02;
  const video03 = process.env.WISTIA_VIDEO_03;

  const extractId = (url) => {
    if (!url) return null;
    const match = url.match(/\/medias\/([^/?#]+)/);
    return match ? match[1] : null;
  };

  return [extractId(video01), extractId(video02), extractId(video03)].filter(id => id !== null);
};

const subscribe = async (z, bundle) => {
  const response = await z.request({
    method: 'POST',
    url: 'https://api.wistia.com/v1/webhooks.json',
    body: {
      url: bundle.targetUrl,
      events: ['viewing_session.percent_watched']
    }
  });
  return response.data;
};

const unsubscribe = async (z, bundle) => {
  const webhookId = bundle.subscribeData.id;
  return await z.request({
    method: 'DELETE',
    url: `https://api.wistia.com/v1/webhooks/${webhookId}.json`
  });
};

const extractNameParts = (fullName) => {
  if (!fullName) return { first_name: '', last_name: '' };
  const parts = fullName.trim().split(/\s+/);
  return {
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' ') || ''
  };
};

const perform = async (z, bundle) => {
  // bundle.cleanedRequest will include the parsed JSON object from Wistia.
  // Wistia sends an array of events in the request body.
  const events = bundle.cleanedRequest.events || [];
  const allowedMediaIds = getAllowedMediaIds(bundle);
  
  const leads = events
    .filter(event => event.type === 'viewing_session.percent_watched' || event.type === 'conversion')
    .map(event => {
      const payload = event.payload || {};
      const visitor = payload.visitor || {};
      
      const email = payload.email || visitor.email || (payload.conversion_data ? payload.conversion_data.email : '');
      const fullName = payload.name || visitor.name || (payload.conversion_data ? payload.conversion_data.name : '');
      const { first_name, last_name } = extractNameParts(fullName);

      return {
        id: event.uuid,
        email: email,
        first_name: first_name,
        last_name: last_name,
        percent_watched: payload.percent_watched || 0,
        media_name: payload.media ? payload.media.name : '',
        media_id: payload.media ? payload.media.id : '',
        visitor_id: visitor.id || '',
        viewing_session_id: payload.viewing_session ? payload.viewing_session.id : '',
        generated_at: event.generated_at ? new Date(event.generated_at).toISOString().split('.')[0] + 'Z' : new Date().toISOString().split('.')[0] + 'Z'
      };
    })
    .filter(lead => {
      const hasEmail = !!lead.email;
      const isHighIntent = lead.percent_watched >= 0.75;
      const isAllowedMedia = allowedMediaIds.length === 0 || allowedMediaIds.includes(lead.media_id);
      return hasEmail && isHighIntent && isAllowedMedia;
    });

  return leads;
};

const performList = async (z, bundle) => {
  // Fetch recent media to get events from
  const response = await z.request({
    url: 'https://api.wistia.com/v1/stats/events.json',
    params: {
      // Fetch more to increase chances of finding leads with email
      per_page: 100
    },
    skipThrowForStatus: true
  });

  const allowedMediaIds = getAllowedMediaIds(bundle);

  // Handle unauthorized or other errors gracefully in polling (return sample data)
  if (response.status >= 400) {
    z.console.log(`Wistia API returned ${response.status} in performList: ${response.content}`);
    return [];
  }

  const events = response.data || [];

  // Map Wistia stats events to our lead format
  const leads = events
    .map(event => {
      const conversionData = event.conversion_data || {};
      
      // Try multiple places for name and email
      const email = event.email || conversionData.email || '';
      const fullName = event.name || conversionData.name || '';
      const { first_name, last_name } = extractNameParts(fullName);

      return {
        id: event.event_key || event.id || event.uuid,
        email: email,
        first_name: first_name,
        last_name: last_name,
        percent_watched: event.percent_viewed !== undefined ? event.percent_viewed : 0,
        media_name: event.media_name || 'Unknown Video',
        media_id: event.media_id || '',
        visitor_id: event.visitor_key || '',
        viewing_session_id: event.event_key || '',
        generated_at: event.received_at ? new Date(event.received_at).toISOString().split('.')[0] + 'Z' : new Date().toISOString().split('.')[0] + 'Z'
      };
    })
    .filter(lead => {
      const isHighIntent = lead.email && lead.percent_watched >= 0.75;
      const isAllowedMedia = allowedMediaIds.length === 0 || allowedMediaIds.includes(lead.media_id);
      return isHighIntent && isAllowedMedia;
    });

  return leads;
};

export default {
  key: 'new_lead',
  noun: 'High Intent Lead',

  display: {
    label: 'High Intent Lead (75%+ Watch)',
    description: 'Triggers when a visitor watches at least 75% of a video and provides their email via Turnstile.'
  },

  operation: {
    type: 'hook',
    perform,
    performList,
    performSubscribe: subscribe,
    performUnsubscribe: unsubscribe,

    inputFields: [
      {
        key: 'media_ids',
        label: 'Allowed Media IDs',
        required: false,
        type: 'string',
        list: true,
        helpText: 'Enter specific Wistia Media IDs (hashed IDs) to track. If left empty, the IDs from the environment configuration will be used.'
      }
    ],

    sample: {
      id: '1778517_274b76ad-4a52-4bf6-a3ee-03a2e7814b0e-0f639ba53-880f3a5fc7a5-e97f',
      email: 'traveler@example.com',
      first_name: 'John',
      last_name: 'Doe',
      percent_watched: 0.85,
      media_name: 'Cuernavaca Travel Deals',
      media_id: '9vi9mpq96r',
      visitor_id: '1778517_e31b4239-ad87-472c-9873-0df06c807d9d-ba0d41180-537463e32c72-4629',
      viewing_session_id: '1778517_274b76ad-4a52-4bf6-a3ee-03a2e7814b0e-0f639ba53-880f3a5fc7a5-e97f',
      generated_at: '2026-05-11T16:42:24Z'
    },


    outputFields: [
      { key: 'id', label: 'ID' },
      { key: 'email', label: 'Email' },
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'percent_watched', label: 'Percent Watched', type: 'number' },
      { key: 'media_name', label: 'Video Name' },
      { key: 'media_id', label: 'Video ID' },
      { key: 'visitor_id', label: 'Visitor ID' },
      { key: 'viewing_session_id', label: 'Viewing Session ID' },
      { key: 'generated_at', label: 'Event Time' }
    ]
  }
};
