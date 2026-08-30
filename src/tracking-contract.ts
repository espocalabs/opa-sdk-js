/**
 * Temporary literal contract for the tracking endpoints reserved by the API
 * team. Reconcile this module with `src/generated/openapi.ts` as soon as the
 * canonical OpenAPI document publishes these paths, then delete it.
 */

export interface IdentifyTraits {
	email?: string;
	name?: string;
	avatar?: string;
	[key: string]: unknown;
}

export interface IdentifyInput {
	anonymousId: string;
	externalId: string;
	traits?: IdentifyTraits;
	clickId?: string;
}

export interface IdentifyResult {
	customerId: string;
	anonymousId: string;
	externalId: string;
	merged: boolean;
}

export interface TrackEventInput {
	eventId: string;
	eventName: string;
	anonymousId?: string;
	externalId?: string;
	clickId?: string;
	properties?: Record<string, unknown>;
	occurredAt?: string;
}

export interface TrackEventResult {
	eventId: string;
	customerId: string;
	deduped: boolean;
}

export interface TrackLeadInput {
	clickId: string;
	eventName: string;
	customerExternalId: string;
	customerEmail?: string;
	customerName?: string;
	customerAvatar?: string;
	metadata?: Record<string, unknown>;
}

export interface TrackSaleInput {
	customerExternalId: string;
	amount: number;
	currency?: string;
	eventName?: string;
	paymentProcessor?: string;
	invoiceId?: string;
	clickId?: string;
	metadata?: Record<string, unknown>;
}

export interface ConversionCustomer {
	id: string;
	externalId: string;
	email: string | null;
	name: string | null;
	avatar: string | null;
	createdAt: string;
}

export interface ConversionEvent {
	id: string;
	eventType: string;
	eventName: string;
	clickId: string | null;
	customerId: string;
	valueCents: number | null;
	currency: string | null;
	invoiceId: string | null;
	paymentProcessor: string | null;
	metadata: Record<string, unknown> | null;
	occurredAt: string;
	createdAt: string;
}

export interface TrackConversionResult {
	event: ConversionEvent;
	customer: ConversionCustomer;
	deduped: boolean;
}

type TrackingOperation<Input, Output> = {
	parameters: {
		query?: never;
		header?: never;
		path?: never;
		cookie?: never;
	};
	requestBody: { content: { "application/json": Input } };
	responses: {
		200: {
			headers: { [name: string]: unknown };
			content: { "application/json": { data: Output } };
		};
	};
};

type PostOnlyPath<Operation> = {
	parameters: {
		query?: never;
		header?: never;
		path?: never;
		cookie?: never;
	};
	get?: never;
	put?: never;
	post: Operation;
	delete?: never;
	options?: never;
	head?: never;
	patch?: never;
	trace?: never;
};

export interface TrackingPaths {
	"/track/identify": PostOnlyPath<TrackingOperation<IdentifyInput, IdentifyResult>>;
	"/track/event": PostOnlyPath<TrackingOperation<TrackEventInput, TrackEventResult>>;
	"/track/lead": PostOnlyPath<TrackingOperation<TrackLeadInput, TrackConversionResult>>;
	"/track/sale": PostOnlyPath<TrackingOperation<TrackSaleInput, TrackConversionResult>>;
}
