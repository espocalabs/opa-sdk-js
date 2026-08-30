type Operation<Input, Output> = {
	parameters: { query?: never; header?: never; path?: never; cookie?: never };
	requestBody: { content: { "application/json": Input } };
	responses: {
		200: { headers: Record<string, unknown>; content: { "application/json": { data: Output } } };
	};
};
type PostPath<O> = {
	parameters: Operation<never, never>["parameters"];
	get?: never;
	put?: never;
	post: O;
	delete?: never;
	options?: never;
	head?: never;
	patch?: never;
	trace?: never;
};
export type LegacyPaths = {
	"/links/bulk-archive": PostPath<Operation<{ linkIds: string[] }, { archivedCount: number }>>;
	"/links/bulk-restore": PostPath<Operation<{ linkIds: string[] }, { restoredCount: number }>>;
	"/links/bulk-move": PostPath<
		Operation<{ linkIds: string[]; folderId: string }, { movedCount: number }>
	>;
	"/links/bulk-tag": PostPath<
		Operation<{ linkIds: string[]; tagIds: string[] }, { taggedCount: number }>
	>;
};
