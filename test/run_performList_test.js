#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env to ensure media_ids filtering can be tested
dotenv.config({ path: path.resolve(__dirname, '../.env') });

(async () => {
  console.log('--- Running performList test with mock data ---');
  
  const newLeadModule = await import(path.resolve(__dirname, '../triggers/new_lead.js'));
  const newLead = newLeadModule.default || newLeadModule;

  const events = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../events.json'), 'utf8'));

  const z = {
    request: async (options) => {
      console.log(`[Mock z.request] Calling: ${options.url}`);
      // Simulate Wistia API response for performList
      return { 
        status: 200, 
        data: events, 
        content: JSON.stringify(events) 
      };
    },
    console: { 
      log: (...args) => console.log('[Zapier Log]', ...args) 
    }
  };

  // Test Case 1: Default (No inputData, uses .env)
  console.log('\n--- Case 1: Using default media_ids from .env ---');
  const bundle1 = { inputData: {} };
  
  try {
    const leads = await newLead.operation.performList(z, bundle1);
    console.log('Leads found:', leads.length);
    if (leads.length > 0) {
      console.log('First lead sample:', JSON.stringify(leads[0], null, 2));
    }
  } catch (err) {
    console.error('Error running performList (Case 1):', err);
  }

  // Test Case 2: Specific media_ids in bundle
  console.log('\n--- Case 2: Using specific media_ids in bundle ---');
  const bundle2 = { 
    inputData: { 
      media_ids: ['9vi9mpq96r'] 
    } 
  };
  
  try {
    const leads = await newLead.operation.performList(z, bundle2);
    console.log('Leads found for 9vi9mpq96r:', leads.length);
    const allMatch = leads.every(l => l.media_id === '9vi9mpq96r');
    console.log('All leads match requested media_id:', allMatch);
  } catch (err) {
    console.error('Error running performList (Case 2):', err);
  }

  // Test Case 3: Empty results (unauthorized simulation)
  console.log('\n--- Case 3: Simulating 401 Unauthorized ---');
  const z401 = {
    ...z,
    request: async () => ({ status: 401, content: 'Unauthorized', data: {} })
  };
  
  try {
    const leads = await newLead.operation.performList(z401, bundle1);
    console.log('Leads found on 401:', leads.length);
  } catch (err) {
    console.error('Error running performList (Case 3):', err);
  }

  console.log('\n--- performList test completed ---');
})();
