/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */

import {z} from 'zod';
import {
	API_VERSION,
	advancedStringFilterSchema,
	getEnumFilterSchema,
	getQueryRequestBodySchema,
	getQueryResponseBodySchema,
	type Endpoint,
} from './common';
import {elementInstanceTypeSchema} from './element-instance';
import {jobKindSchema, listenerEventTypeSchema} from './job';

const waitStateTypeSchema = z.enum(['JOB', 'MESSAGE']);
type WaitStateType = z.infer<typeof waitStateTypeSchema>;

const jobWaitStateDetailsSchema = z.object({
	jobKey: z.string(),
	jobType: z.string(),
	jobKind: jobKindSchema,
	listenerEventType: listenerEventTypeSchema.nullable(),
	retries: z.number().int().nullable(),
});
type JobWaitStateDetails = z.infer<typeof jobWaitStateDetailsSchema>;

const messageWaitStateDetailsSchema = z.object({
	messageName: z.string(),
	correlationKey: z.string().nullable(),
});
type MessageWaitStateDetails = z.infer<typeof messageWaitStateDetailsSchema>;

const elementInstanceInspectionSchema = z.object({
	rootProcessInstanceKey: z.string().nullable(),
	processInstanceKey: z.string(),
	elementInstanceKey: z.string(),
	elementId: z.string(),
	elementType: elementInstanceTypeSchema,
	tenantId: z.string(),
	waitStateType: waitStateTypeSchema,
	jobDetails: jobWaitStateDetailsSchema.nullable(),
	messageDetails: messageWaitStateDetailsSchema.nullable(),
});
type ElementInstanceInspection = z.infer<typeof elementInstanceInspectionSchema>;

const queryElementInstanceInspectionFilterSchema = z
	.object({
		rootProcessInstanceKey: advancedStringFilterSchema,
		processInstanceKey: advancedStringFilterSchema,
		elementInstanceKey: advancedStringFilterSchema,
		elementId: advancedStringFilterSchema,
		elementType: z.union([elementInstanceTypeSchema, getEnumFilterSchema(elementInstanceTypeSchema)]),
		waitStateType: z.union([waitStateTypeSchema, getEnumFilterSchema(waitStateTypeSchema)]),
	})
	.partial();

const queryElementInstanceInspectionRequestBodySchema = getQueryRequestBodySchema({
	sortFields: ['elementInstanceKey', 'processInstanceKey', 'rootProcessInstanceKey', 'elementId'] as const,
	filter: queryElementInstanceInspectionFilterSchema,
});
type QueryElementInstanceInspectionRequestBody = z.infer<typeof queryElementInstanceInspectionRequestBodySchema>;

const queryElementInstanceInspectionResponseBodySchema = getQueryResponseBodySchema(elementInstanceInspectionSchema);
type QueryElementInstanceInspectionResponseBody = z.infer<typeof queryElementInstanceInspectionResponseBodySchema>;

const queryElementInstanceInspection: Endpoint = {
	method: 'POST',
	getUrl() {
		return `/${API_VERSION}/element-instances/wait-states/search`;
	},
};

export {
	waitStateTypeSchema,
	jobWaitStateDetailsSchema,
	messageWaitStateDetailsSchema,
	elementInstanceInspectionSchema,
	queryElementInstanceInspectionRequestBodySchema,
	queryElementInstanceInspectionResponseBodySchema,
	queryElementInstanceInspection,
};

export type {
	WaitStateType,
	JobWaitStateDetails,
	MessageWaitStateDetails,
	ElementInstanceInspection,
	QueryElementInstanceInspectionRequestBody,
	QueryElementInstanceInspectionResponseBody,
};
