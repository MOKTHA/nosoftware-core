/**
 * @heynxt/prompt-spec — Helpdesk Ticketing Fixture
 *
 * A hardcoded AppSpecTemplate for a helpdesk ticketing system.
 * Used in integration tests and as a reference spec for pipeline
 * smoke tests. All UUIDs are stable (not generated at runtime)
 * so that test assertions are deterministic.
 */

import type { AppSpecTemplate } from '@heynxt/core-types';

export const helpdeskTicketingFixture: AppSpecTemplate = {
  spec: {
    appId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    appName: 'Helpdesk Ticketing System',
    entities: [
      {
        name: 'Ticket',
        fields: [
          { name: 'id', type: 'uuid', primaryKey: true },
          { name: 'title', type: 'string' },
          { name: 'description', type: 'text' },
          {
            name: 'status',
            type: 'enum',
            values: ['open', 'in_progress', 'resolved', 'closed'],
          },
          {
            name: 'priority',
            type: 'enum',
            values: ['low', 'medium', 'high', 'critical'],
          },
          { name: 'assigneeId', type: 'uuid', nullable: true },
          { name: 'createdAt', type: 'timestamp' },
          { name: 'updatedAt', type: 'timestamp' },
        ],
        relationships: [
          'Ticket belongsTo User via assigneeId',
          'Ticket hasMany Comment',
        ],
      },
      {
        name: 'User',
        fields: [
          { name: 'id', type: 'uuid', primaryKey: true },
          { name: 'name', type: 'string' },
          { name: 'email', type: 'string' },
          {
            name: 'role',
            type: 'enum',
            values: ['support_agent', 'senior_agent', 'manager', 'admin'],
          },
          { name: 'createdAt', type: 'timestamp' },
        ],
      },
      {
        name: 'Comment',
        fields: [
          { name: 'id', type: 'uuid', primaryKey: true },
          { name: 'ticketId', type: 'uuid' },
          { name: 'userId', type: 'uuid' },
          { name: 'body', type: 'text' },
          { name: 'createdAt', type: 'timestamp' },
        ],
        relationships: [
          'Comment belongsTo Ticket via ticketId',
          'Comment belongsTo User via userId',
        ],
      },
    ],
    businessRules: [
      {
        ruleId: 'b1000000-0000-0000-0000-000000000001',
        name: 'SLA Escalation',
        description:
          'If a ticket remains unresolved for more than 4 hours, escalate it to the assigned manager.',
        category: 'escalation',
        version: 1,
      },
      {
        ruleId: 'b2000000-0000-0000-0000-000000000002',
        name: 'Priority Routing',
        description:
          'Critical-priority tickets are automatically assigned to a senior agent.',
        category: 'routing',
        version: 1,
      },
      {
        ruleId: 'b3000000-0000-0000-0000-000000000003',
        name: 'Auto-close',
        description:
          'Tickets in resolved status with no new response for 72 hours are automatically closed.',
        category: 'lifecycle',
        version: 1,
      },
    ],
    uiRequirements: {
      views: ['ticket_list', 'ticket_detail', 'dashboard', 'admin_settings'],
      roles: ['support_agent', 'senior_agent', 'manager', 'admin'],
    },
  },
  blueprintPlan: {
    blueprintId: 'c1000000-0000-0000-0000-000000000001',
    blueprintName: 'Helpdesk Blueprint',
    domainModels: {
      Ticket: {
        type: 'aggregate-root',
        lifecycle: ['open', 'in_progress', 'resolved', 'closed'],
      },
      User: {
        type: 'entity',
        roles: ['support_agent', 'senior_agent', 'manager', 'admin'],
      },
      Comment: {
        type: 'entity',
        parent: 'Ticket',
      },
    },
    constraints: ['additive-only migrations', 'no dropping columns'],
    ruleImplementationHints: {
      'SLA Escalation': 'cron every 15min',
      'Auto-close': 'cron every hour',
    },
  },
  params: {},
};
