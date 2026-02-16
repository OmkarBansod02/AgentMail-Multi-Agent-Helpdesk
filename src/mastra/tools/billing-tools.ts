import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const issueRefundTool = createTool({
  id: 'issue-refund',
  description:
    'Issue a refund to a customer. Use when a customer requests a refund for a charge, subscription, or overpayment.',
  inputSchema: z.object({
    customerId: z.string().describe('The customer ID'),
    amount: z.number().describe('Refund amount in USD'),
    reason: z.string().describe('Reason for the refund'),
  }),
  outputSchema: z.object({
    refundId: z.string(),
    status: z.string(),
    amount: z.number(),
    message: z.string(),
  }),
  execute: async (inputData) => {
    // Simulated refund processing — replace with real billing API
    return {
      refundId: `REF-${Date.now()}`,
      status: 'processed',
      amount: inputData.amount,
      message: `Refund of $${inputData.amount.toFixed(2)} issued to customer ${inputData.customerId}. Reason: ${inputData.reason}. Funds will appear in 5-10 business days.`,
    };
  },
});

export const lookupInvoiceTool = createTool({
  id: 'lookup-invoice',
  description:
    'Look up an invoice by invoice ID or customer email. Use to find billing details, payment status, or invoice history.',
  inputSchema: z.object({
    invoiceId: z.string().optional().describe('The invoice ID (e.g. INV-1234)'),
    customerEmail: z
      .string()
      .optional()
      .describe('The customer email to search invoices for'),
  }),
  outputSchema: z.object({
    invoiceId: z.string(),
    customerEmail: z.string(),
    amount: z.number(),
    status: z.string(),
    dueDate: z.string(),
    items: z.array(
      z.object({
        description: z.string(),
        amount: z.number(),
      }),
    ),
  }),
  execute: async (inputData) => {
    // Simulated invoice lookup — replace with real billing API
    return {
      invoiceId: inputData.invoiceId || `INV-${Math.floor(Math.random() * 9000) + 1000}`,
      customerEmail: inputData.customerEmail || 'customer@example.com',
      amount: 299.99,
      status: 'paid',
      dueDate: '2026-03-01',
      items: [
        { description: 'Pro Plan - Monthly Subscription', amount: 249.99 },
        { description: 'Additional API Calls (10,000)', amount: 50.0 },
      ],
    };
  },
});
