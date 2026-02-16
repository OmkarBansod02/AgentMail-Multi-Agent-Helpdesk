import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

import { triageAgent } from './agents/triage-agent';
import { billingAgent } from './agents/billing-agent';
import { hrAgent } from './agents/hr-agent';

export const mastra = new Mastra({
  agents: { triageAgent, billingAgent, hrAgent },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
