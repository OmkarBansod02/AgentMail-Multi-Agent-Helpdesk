import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const draftOfferLetterTool = createTool({
  id: 'draft-offer-letter',
  description:
    'Draft a formal offer letter for a job candidate. Use when HR needs to prepare an employment offer.',
  inputSchema: z.object({
    candidateName: z.string().describe('Full name of the candidate'),
    position: z.string().describe('Job title being offered'),
    salary: z.number().describe('Annual salary in USD'),
    startDate: z.string().describe('Proposed start date (e.g. 2026-04-01)'),
  }),
  outputSchema: z.object({
    letterContent: z.string(),
    status: z.string(),
  }),
  execute: async (inputData) => {
    // Simulated offer letter — replace with real HR system
    const letterContent = `
OFFER OF EMPLOYMENT

Date: ${new Date().toISOString().split('T')[0]}

Dear ${inputData.candidateName},

We are pleased to offer you the position of ${inputData.position} at Acme Corp.

Compensation: $${inputData.salary.toLocaleString()} per year
Start Date: ${inputData.startDate}
Employment Type: Full-time

Benefits Include:
- Health, dental, and vision insurance
- 401(k) with 4% company match
- 20 days PTO + company holidays
- Remote work flexibility

This offer is contingent upon successful completion of a background check.
Please confirm your acceptance within 7 business days.

We are excited to welcome you to the team!

Best regards,
HR Department
Acme Corp
    `.trim();

    return {
      letterContent,
      status: 'drafted',
    };
  },
});

export const lookupEmployeeTool = createTool({
  id: 'lookup-employee',
  description:
    'Look up an employee by ID or name. Use to find employee details, department, role, or contact information.',
  inputSchema: z.object({
    employeeId: z.string().optional().describe('The employee ID (e.g. EMP-1234)'),
    employeeName: z.string().optional().describe('The employee name to search for'),
  }),
  outputSchema: z.object({
    employeeId: z.string(),
    name: z.string(),
    email: z.string(),
    department: z.string(),
    position: z.string(),
    startDate: z.string(),
    status: z.string(),
  }),
  execute: async (inputData) => {
    // Simulated employee lookup — replace with real HR system
    const name = inputData.employeeName || 'Jane Smith';
    return {
      employeeId: inputData.employeeId || `EMP-${Math.floor(Math.random() * 9000) + 1000}`,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@acmecorp.com`,
      department: 'Engineering',
      position: 'Senior Software Engineer',
      startDate: '2024-06-15',
      status: 'active',
    };
  },
});
