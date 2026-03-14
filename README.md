# AgentMail Multi-Agent Helpdesk

A production-style template that shows how to combine **AgentMail inbox infrastructure** with **Mastra agents and tools** to run a multi-department email workflow.

This project demonstrates how one inbound inbox (`support`) can triage customer messages and route work to specialized department agents (`billing` and `hr`) with domain-specific tools.

## What This Project Integrates

- **Mastra** for agent orchestration, tool execution, and local Studio testing
- **AgentMail** for inbox creation, email send/reply APIs, and real-time WebSocket events
- **OpenAI model via Mastra** for triage and department response generation

## Why This Template Exists

Most teams want to prototype "AI support via email" quickly, but still keep clear boundaries between departments.

This template gives you:

- A reusable multi-agent architecture
- Real inboxes and real email events (not mocked transport)
- Department-specific tool patterns you can expand
- A clean starting point for demos and hackathon submissions

## High-Level Flow

1. Customer sends email to `support@...`
2. Listener receives `message.received` from AgentMail WebSocket
3. `triageAgent` classifies request into `billing` or `hr`
4. Chosen department agent generates response and can call its tools
5. Reply is sent from support inbox in the same thread, while routed department inbox is copied (`bcc` by default)

Direct department emails also work:

- `billing@...` -> handled by `billingAgent`
- `hr@...` -> handled by `hrAgent`

## Agents and Tools

### Agents (`src/mastra/agents`)

- `triage-agent.ts`
  - Classifies inbound support emails into billing/hr
  - Returns structured output (`department`, `summary`, `priority`)
- `billing-agent.ts`
  - Handles billing conversations
  - Uses billing tools
- `hr-agent.ts`
  - Handles HR conversations
  - Uses HR tools

### Tools (`src/mastra/tools`)

- `billing-tools.ts`
  - `issueRefundTool`
  - `lookupInvoiceTool`
- `hr-tools.ts`
  - `draftOfferLetterTool`
  - `lookupEmployeeTool`

## Project Structure

```text
src/
  mastra/
    index.ts
    agents/
      triage-agent.ts
      billing-agent.ts
      hr-agent.ts
    tools/
      billing-tools.ts
      hr-tools.ts
  listener.ts
```

## Prerequisites

- Node.js `>=22.13.0`
- AgentMail API key
- OpenAI API key

## Setup Guide

### 1) Install dependencies

```sh
npm install
```

### 2) Create environment file

```sh
cp .env.example .env
```

### 3) Fill required environment variables

```env
OPENAI_API_KEY=your-openai-key
AGENTMAIL_API_KEY=your-agentmail-key
COMPANY_NAME=Your Company Name
COMPANY_EMAIL_DOMAIN=yourcompany.com
ROUTED_DEPARTMENT_COPY_MODE=bcc

SUPPORT_INBOX_USERNAME=support
BILLING_INBOX_USERNAME=billing
HR_INBOX_USERNAME=hr
```

Notes:

- Usernames are preferred values, not guaranteed.
- If a username is globally taken, the listener auto-creates a unique fallback username for your account.
- Always use the inbox IDs printed in listener logs.
- `ROUTED_DEPARTMENT_COPY_MODE` accepts `bcc` (default) or `cc`.

## Local Development Guide

### Terminal A: run Mastra Studio

```sh
npm run dev
```

Open:

- Studio: `http://localhost:4111`
- API: `http://localhost:4111/api`

### Terminal B: run the email listener

```sh
npm run listen
```

On startup, listener will:

1. Resolve/create support, billing, and hr inboxes for your account
2. Connect to AgentMail WebSocket
3. Subscribe to `message.received` events for those inboxes
4. Print active inbox addresses to use for testing

## How to Test End-to-End

### Scenario 1: Support -> Billing routing

Send an email to the printed support inbox with content like:

`I was double charged. Please refund invoice INV-1024.`

Expected:

- Triage routes to billing
- Billing agent may call invoice/refund tool
- Reply is sent from support inbox and billing inbox is copied on-thread

### Scenario 2: Support -> HR routing

Send an email to support inbox:

`I need an offer letter draft for a Senior Engineer candidate.`

Expected:

- Triage routes to HR
- HR agent may call offer-letter tool
- Reply is sent from support inbox and HR inbox is copied on-thread

### Scenario 3: Direct department handling

Email billing inbox directly and hr inbox directly.

Expected:

- No triage step for direct departmental inboxes
- Department agent handles and replies in-thread

## Build / Run Commands

- `npm run dev` - Mastra Studio dev server
- `npm run listen` - AgentMail WebSocket listener
- `npm run build` - Mastra build
- `npm run start` - Mastra start

## Troubleshooting

### "Inbox not found" on WebSocket subscribe

Cause:

- Subscribing with inbox IDs not owned by your API key

Fix:

- Use latest listener code (clientId-based inbox ownership handling)
- Restart listener and use printed inbox IDs

### "Inbox is taken" during creation

Cause:

- Desired username already exists globally

Fix:

- Listener auto-generates fallback username and continues

### Missing API key errors

Fix:

- Check `.env` and confirm both keys are set:
  - `AGENTMAIL_API_KEY`
  - `OPENAI_API_KEY`

### No replies received

Checklist:

- Listener is running
- WebSocket subscribed successfully
- You emailed the active printed inbox ID
- OpenAI and AgentMail keys are valid

## Extending This Template

To add a new department (example: `legal`):

1. Add tools in `src/mastra/tools/legal-tools.ts`
2. Add agent in `src/mastra/agents/legal-agent.ts`
3. Register in `src/mastra/index.ts`
4. Add legal inbox + routing branch in `src/listener.ts`
5. Update triage instructions/schema to include legal

## Suggested Use Cases

- Internal ops automation
- Shared support inbox triage
- Recruiting workflows
- Finance/billing email operations
- Multi-agent demonstrations for product demos

## Useful Links

- AgentMail docs: https://docs.agentmail.to
- AgentMail console: https://console.agentmail.to
- Mastra docs: https://mastra.ai/docs
- Mastra templates: https://mastra.ai/templates
