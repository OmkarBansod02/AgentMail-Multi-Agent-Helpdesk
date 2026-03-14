/** AgentMail + Mastra email router listener */

import 'dotenv/config';
import { AgentMailClient, AgentMail } from 'agentmail';
import { z } from 'zod';
import { mastra } from './mastra/index.js';

const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY;
if (!AGENTMAIL_API_KEY) {
  console.error('Missing AGENTMAIL_API_KEY environment variable');
  process.exit(1);
}

const SUPPORT_USERNAME = process.env.SUPPORT_INBOX_USERNAME || 'support';
const BILLING_USERNAME = process.env.BILLING_INBOX_USERNAME || 'billing';
const HR_USERNAME = process.env.HR_INBOX_USERNAME || 'hr';
const ROUTED_DEPARTMENT_COPY_MODE =
  process.env.ROUTED_DEPARTMENT_COPY_MODE?.toLowerCase() === 'cc' ? 'cc' : 'bcc';
const WS_OPEN_TIMEOUT_MS = Number(process.env.WS_OPEN_TIMEOUT_MS || '15000');

let SUPPORT_INBOX = `${SUPPORT_USERNAME}@agentmail.to`;
let BILLING_INBOX = `${BILLING_USERNAME}@agentmail.to`;
let HR_INBOX = `${HR_USERNAME}@agentmail.to`;

const processedMessages = new Set<string>();
const OUR_INBOXES = new Set<string>();

const client = new AgentMailClient({ apiKey: AGENTMAIL_API_KEY });

const triageSchema = z.object({
  department: z
    .enum(['billing', 'hr'])
    .describe('The department to route the email to'),
  summary: z
    .string()
    .describe('Brief summary of the email for the department agent'),
  priority: z
    .enum(['low', 'medium', 'high'])
    .describe('Priority level of the request'),
});

function extractEmail(fromField: string): string {
  const match = fromField.match(/<(.+?)>/);
  return match ? match[1] : fromField.trim();
}

function log(label: string, message: string) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${label} ${message}`);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

function departmentCopyRecipients(deptInbox: string): { cc?: string[]; bcc?: string[] } {
  return ROUTED_DEPARTMENT_COPY_MODE === 'cc' ? { cc: [deptInbox] } : { bcc: [deptInbox] };
}

async function findInboxByClientId(clientId: string): Promise<string | null> {
  const response = await client.inboxes.list();
  const existing = response.inboxes.find((inbox) => inbox.clientId === clientId);
  return existing?.inboxId ?? null;
}

async function ensureInbox(role: 'support' | 'billing' | 'hr', username: string): Promise<string> {
  const clientId = `agentmail-mastra-${role}-inbox`;

  const existingInbox = await findInboxByClientId(clientId);
  if (existingInbox) {
    log('[inbox]', `Using existing ${role} inbox: ${existingInbox}`);
    return existingInbox;
  }

  try {
    const created = await client.inboxes.create({ username, clientId });
    log('[inbox]', `Created ${role} inbox: ${created.inboxId}`);
    return created.inboxId;
  } catch (err: any) {
    const bodyName = err?.body?.name || '';
    const message = (err?.body?.message || err?.message || String(err)).toLowerCase();
    const isTaken = bodyName === 'IsTakenError' || message.includes('is taken');

    if (!isTaken) {
      throw err;
    }

    const fallbackUsername = `${username}-${randomSuffix()}`;
    const fallback = await client.inboxes.create({ username: fallbackUsername, clientId });
    log(
      '[inbox]',
      `Preferred ${role} username "${username}" was taken. Using ${fallback.inboxId} instead.`,
    );
    return fallback.inboxId;
  }
}

async function handleSupportEmail(msg: AgentMail.Message) {
  const senderEmail = extractEmail(msg.from || '');
  const subject = msg.subject || '(no subject)';
  const body = msg.text || '';

  log('[triage]', `Classifying email from ${senderEmail} — "${subject}"`);

  const triageAgent = mastra.getAgent('triageAgent');
  const classification = await triageAgent.generate(
    [
      {
        role: 'user',
        content: `Classify this incoming customer email:\n\nFrom: ${senderEmail}\nSubject: ${subject}\nBody:\n${body}`,
      },
    ],
    { structuredOutput: { schema: triageSchema } },
  );

  const result = classification.object;
  if (!result) {
    log('[triage]', 'No classification returned — defaulting to billing');
  }

  const department = result?.department || 'billing';
  const summary = result?.summary || subject;
  const priority = result?.priority || 'medium';
  const deptInbox = department === 'billing' ? BILLING_INBOX : HR_INBOX;

  log('[triage]', `Routed to ${department.toUpperCase()} (priority: ${priority})`);
  log('[triage]', `Summary: ${summary}`);

  const deptAgentId = department === 'billing' ? 'billingAgent' : 'hrAgent';
  const deptAgent = mastra.getAgent(deptAgentId);

  log(`[${department}]`, 'Generating reply...');

  const response = await deptAgent.generate(
    [
      {
        role: 'user',
        content: `You received this customer email. Please write a helpful reply.\n\nFrom: ${senderEmail}\nSubject: ${subject}\nBody:\n${body}`,
      },
    ],
    { maxSteps: 5 },
  );

  try {
    const copyRecipients = departmentCopyRecipients(deptInbox);

    if (msg.messageId) {
      await client.inboxes.messages.reply(SUPPORT_INBOX, msg.messageId, {
        to: [senderEmail],
        text: response.text,
        ...copyRecipients,
      });
    } else {
      await client.inboxes.messages.send(SUPPORT_INBOX, {
        to: [senderEmail],
        subject: `Re: ${subject}`,
        text: response.text,
        ...copyRecipients,
      });
    }

    log(
      `[${department}]`,
      `Reply sent from ${SUPPORT_INBOX} to ${senderEmail} (${ROUTED_DEPARTMENT_COPY_MODE}: ${deptInbox})`,
    );
  } catch (err) {
    log('[error]', `Failed to send reply: ${err}`);
  }
}

async function handleDepartmentEmail(
  department: 'billing' | 'hr',
  msg: AgentMail.Message,
) {
  const senderEmail = extractEmail(msg.from || '');
  const subject = msg.subject || '(no subject)';
  const body = msg.text || '';
  const inboxId = department === 'billing' ? BILLING_INBOX : HR_INBOX;

  log(`[${department}]`, `Email from ${senderEmail} — "${subject}"`);

  const agentId = department === 'billing' ? 'billingAgent' : 'hrAgent';
  const agent = mastra.getAgent(agentId);

  log(`[${department}]`, 'Generating reply...');

  const response = await agent.generate(
    [
      {
        role: 'user',
        content: `You received this customer email. Please write a helpful reply.\n\nFrom: ${senderEmail}\nSubject: ${subject}\nBody:\n${body}`,
      },
    ],
    { maxSteps: 5 },
  );

  try {
    await client.inboxes.messages.reply(inboxId, msg.messageId, {
      to: [senderEmail],
      text: response.text,
    });
    log(`[${department}]`, `Reply sent from ${inboxId} to ${senderEmail}`);
  } catch (err) {
    log('[error]', `Failed to send reply: ${err}`);
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  AGENTMAIL + MASTRA — MULTI-AGENT EMAIL ROUTER');
  console.log('='.repeat(60) + '\n');

  SUPPORT_INBOX = await ensureInbox('support', SUPPORT_USERNAME);
  BILLING_INBOX = await ensureInbox('billing', BILLING_USERNAME);
  HR_INBOX = await ensureInbox('hr', HR_USERNAME);

  OUR_INBOXES.clear();
  OUR_INBOXES.add(SUPPORT_INBOX);
  OUR_INBOXES.add(BILLING_INBOX);
  OUR_INBOXES.add(HR_INBOX);

  console.log('');
  log('[ws]', 'Connecting to AgentMail WebSocket...');

  const socket = await client.websockets.connect({
    apiKey: AGENTMAIL_API_KEY,
    reconnectAttempts: 2,
  });

  let subscribedForCurrentConnection = false;
  const subscribeToInboxes = () => {
    if (subscribedForCurrentConnection) return;
    socket.sendSubscribe({
      type: 'subscribe',
      inboxIds: [SUPPORT_INBOX, BILLING_INBOX, HR_INBOX],
      eventTypes: ['message.received'],
    });
    subscribedForCurrentConnection = true;
  };

  let startupSettled = false;
  let startupResolve: (() => void) | null = null;
  let startupReject: ((reason?: unknown) => void) | null = null;

  const startupReady = new Promise<void>((resolve, reject) => {
    startupResolve = resolve;
    startupReject = reject;
  });

  const startupTimer = setTimeout(() => {
    if (startupSettled) return;
    startupSettled = true;
    startupReject?.(
      new Error(
        `WebSocket did not subscribe within ${WS_OPEN_TIMEOUT_MS}ms. Check AGENTMAIL_API_KEY and network/firewall/VPN settings.`,
      ),
    );
  }, WS_OPEN_TIMEOUT_MS);

  socket.on('open', () => {
    log('[ws]', 'Connected');
    subscribeToInboxes();
  });

  // Handle race where socket opens before handlers are attached.
  if (socket.readyState === 1) {
    log('[ws]', 'Connected');
    subscribeToInboxes();
  }

  socket.on('message', async (event) => {
    if (event.type === 'subscribed') {
      if (!startupSettled) {
        startupSettled = true;
        clearTimeout(startupTimer);
        startupResolve?.();
      }

      log('[ws]', `Subscribed to: ${event.inboxIds?.join(', ')}`);
      console.log('');
      console.log(`  Send emails to: ${SUPPORT_INBOX}`);
      console.log(`  (or directly to ${BILLING_INBOX} / ${HR_INBOX})`);
      console.log('');
      log('[ws]', 'Waiting for incoming emails...\n');
      return;
    }

    if (event.type === 'event' && 'eventType' in event) {
      if (event.eventType !== 'message.received') return;

      const receivedEvent = event as AgentMail.MessageReceivedEvent;
      const msg = receivedEvent.message;
      if (!msg) return;

      const messageId = msg.messageId;
      const fromEmail = extractEmail(msg.from || '');

      if (messageId && processedMessages.has(messageId)) return;
      if (messageId) processedMessages.add(messageId);

      if (OUR_INBOXES.has(fromEmail)) return;

      console.log('\n' + '-'.repeat(60));

      try {
        if (msg.inboxId === SUPPORT_INBOX) {
          await handleSupportEmail(msg);
        } else if (msg.inboxId === BILLING_INBOX) {
          await handleDepartmentEmail('billing', msg);
        } else if (msg.inboxId === HR_INBOX) {
          await handleDepartmentEmail('hr', msg);
        }
      } catch (err) {
        log('[error]', `Error processing email: ${err}`);
      }

      console.log('-'.repeat(60) + '\n');
    }
  });

  socket.on('error', (error) => {
    log('[error]', `WebSocket error: ${error}`);
    if (!startupSettled) {
      startupSettled = true;
      clearTimeout(startupTimer);
      startupReject?.(new Error(`WebSocket startup error: ${String(error)}`));
    }
  });

  socket.on('close', (event) => {
    log('[ws]', `Disconnected: ${event?.code} ${event?.reason}`);
    subscribedForCurrentConnection = false;
    if (!startupSettled) {
      startupSettled = true;
      clearTimeout(startupTimer);
      startupReject?.(
        new Error(`WebSocket closed before subscribe: ${event?.code ?? 'unknown'} ${event?.reason ?? ''}`),
      );
    }
  });

  await startupReady;
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
