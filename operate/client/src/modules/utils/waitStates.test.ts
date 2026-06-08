/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import {describe, it, expect} from 'vitest';
import type {ElementInstanceInspection} from '@camunda/camunda-api-zod-schemas/8.10';
import {getWaitStateLabel, getWaitStateStatusItems} from './waitStates';

const baseWaitState: ElementInstanceInspection = {
  rootProcessInstanceKey: '123',
  processInstanceKey: '123',
  elementInstanceKey: '456',
  elementId: 'task1',
  elementType: 'SERVICE_TASK',
  tenantId: '<default>',
  waitStateType: 'JOB',
  jobDetails: {
    jobKey: '789',
    jobType: 'my-job',
    jobKind: 'BPMN_ELEMENT',
    listenerEventType: null,
    retries: 3,
  },
  messageDetails: null,
};

describe('getWaitStateLabel', () => {
  it('should return null for empty array', () => {
    expect(getWaitStateLabel([])).toBeNull();
  });

  it('should return "Waiting" for MESSAGE wait state', () => {
    expect(
      getWaitStateLabel([
        {
          ...baseWaitState,
          waitStateType: 'MESSAGE',
          jobDetails: null,
          messageDetails: {messageName: 'foo', correlationKey: null},
        },
      ]),
    ).toBe('Waiting');
  });

  it('should return "Waiting" for JOB wait state', () => {
    expect(getWaitStateLabel([baseWaitState])).toBe('Waiting');
  });
});

describe('getWaitStateStatusItems', () => {
  it('should return empty array for no wait states', () => {
    expect(getWaitStateStatusItems([])).toEqual([]);
  });

  it('should format MESSAGE wait state', () => {
    const items = getWaitStateStatusItems([
      {
        ...baseWaitState,
        waitStateType: 'MESSAGE',
        jobDetails: null,
        messageDetails: {messageName: 'order-completion', correlationKey: null},
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe('Waiting for message: order-completion');
  });

  it('should use "unknown" when MESSAGE has no messageDetails', () => {
    const items = getWaitStateStatusItems([
      {
        ...baseWaitState,
        waitStateType: 'MESSAGE',
        jobDetails: null,
        messageDetails: null,
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe('Waiting for message: unknown');
  });

  it('should format JOB wait state', () => {
    const items = getWaitStateStatusItems([
      {
        ...baseWaitState,
        jobDetails: {
          jobKey: '789',
          jobType: 'send-email',
          jobKind: 'BPMN_ELEMENT',
          listenerEventType: null,
          retries: 3,
        },
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe('Waiting for job: send-email');
  });

  it('should format execution listener JOB wait state', () => {
    const items = getWaitStateStatusItems([
      {
        ...baseWaitState,
        jobDetails: {
          jobKey: '789',
          jobType: 'my-listener',
          jobKind: 'EXECUTION_LISTENER',
          listenerEventType: 'START',
          retries: 3,
        },
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe(
      'Waiting for job execution listener my-listener',
    );
  });

  it('should format task listener JOB wait state', () => {
    const items = getWaitStateStatusItems([
      {
        ...baseWaitState,
        jobDetails: {
          jobKey: '789',
          jobType: 'my-task-listener',
          jobKind: 'TASK_LISTENER',
          listenerEventType: 'COMPLETING',
          retries: 3,
        },
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe('Waiting for task listener: my-task-listener');
  });

  it('should format ad-hoc sub process JOB wait state', () => {
    const items = getWaitStateStatusItems([
      {
        ...baseWaitState,
        jobDetails: {
          jobKey: '789',
          jobType: 'my-ad-hoc-job',
          jobKind: 'AD_HOC_SUB_PROCESS',
          listenerEventType: null,
          retries: 3,
        },
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe('Waiting for ad-hoc sub process');
  });

  it('should use "unknown" when JOB has no jobDetails', () => {
    const items = getWaitStateStatusItems([
      {...baseWaitState, jobDetails: null},
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe('Waiting for job: unknown');
  });

  it('should handle multiple wait states', () => {
    const items = getWaitStateStatusItems([
      {
        ...baseWaitState,
        waitStateType: 'MESSAGE',
        jobDetails: null,
        messageDetails: {messageName: 'msg1', correlationKey: null},
      },
      {
        ...baseWaitState,
        waitStateType: 'MESSAGE',
        jobDetails: null,
        messageDetails: {messageName: 'msg2', correlationKey: null},
      },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]!.text).toBe('Waiting for message: msg1');
    expect(items[1]!.text).toBe('Waiting for message: msg2');
  });
});
