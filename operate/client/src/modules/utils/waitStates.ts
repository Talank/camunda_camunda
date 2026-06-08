/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import type {ElementInstanceInspection} from '@camunda/camunda-api-zod-schemas/8.10';

function getWaitStateLabel(
  waitStates: ElementInstanceInspection[],
): string | null {
  if (waitStates.length === 0) {
    return null;
  }

  return 'Waiting';
}

function getWaitStateStatusItems(
  waitStates: ElementInstanceInspection[],
): Array<{key: string; text: string}> {
  return waitStates.flatMap((waitState) => {
    switch (waitState.waitStateType) {
      case 'MESSAGE': {
        const messageName = waitState.messageDetails?.messageName ?? 'unknown';
        return {
          key: `${waitState.elementInstanceKey}-MESSAGE-${messageName}`,
          text: `Waiting for message: ${messageName}`,
        };
      }
      case 'JOB': {
        const jobType = waitState.jobDetails?.jobType ?? 'unknown';
        const jobKind = waitState.jobDetails?.jobKind;
        if (jobKind === 'EXECUTION_LISTENER') {
          return {
            key: `${waitState.elementInstanceKey}-JOB-${jobKind}-${jobType}`,
            text: `Waiting for job execution listener ${jobType}`,
          };
        }
        if (jobKind === 'TASK_LISTENER') {
          return {
            key: `${waitState.elementInstanceKey}-JOB-${jobKind}-${jobType}`,
            text: `Waiting for task listener: ${jobType}`,
          };
        }
        if (jobKind === 'AD_HOC_SUB_PROCESS') {
          return {
            key: `${waitState.elementInstanceKey}-JOB-${jobKind}-${jobType}`,
            text: 'Waiting for ad-hoc sub process',
          };
        }
        return {
          key: `${waitState.elementInstanceKey}-JOB-${jobType}`,
          text: `Waiting for job: ${jobType}`,
        };
      }
    }
  });
}

export {getWaitStateLabel, getWaitStateStatusItems};
