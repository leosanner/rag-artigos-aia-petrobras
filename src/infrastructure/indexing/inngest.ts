import { z } from "zod";

import type {
  IndexingEventPublisher,
  ProcessIndexingRunHandler,
} from "@/application/indexing/ports";
import { inngest } from "@/infrastructure/ingestion/inngest";

export const RAG_INDEXING_REQUESTED_EVENT = "rag/indexing.requested";

export const ragIndexingRequestedEventDataSchema = z.object({
  runId: z.string().uuid(),
});

export type RagIndexingRequestedEventData = z.infer<
  typeof ragIndexingRequestedEventDataSchema
>;

type InngestSendClient = {
  send(payload: {
    name: typeof RAG_INDEXING_REQUESTED_EVENT;
    data: RagIndexingRequestedEventData;
  }): Promise<unknown>;
};

export class InngestIndexingEventPublisher implements IndexingEventPublisher {
  constructor(private readonly client: InngestSendClient = inngest) {}

  async publishIndexingRequested(runId: string): Promise<void> {
    const data = ragIndexingRequestedEventDataSchema.parse({ runId });

    await this.client.send({
      name: RAG_INDEXING_REQUESTED_EVENT,
      data,
    });
  }
}

export type ProcessIndexingRunFunctionContext = {
  event: {
    data: unknown;
  };
};

export type ProcessIndexingRunFunctionHandler = (
  context: ProcessIndexingRunFunctionContext,
) => Promise<void>;

type InngestFunctionOptions = {
  id: "process-indexing-run";
  name: "Process indexing run";
  triggers: {
    event: typeof RAG_INDEXING_REQUESTED_EVENT;
  };
};

type InngestFunctionClient<TResult> = {
  createFunction(
    options: InngestFunctionOptions,
    handler: ProcessIndexingRunFunctionHandler,
  ): TResult;
};

const processIndexingRunFunctionOptions = {
  id: "process-indexing-run",
  name: "Process indexing run",
  triggers: { event: RAG_INDEXING_REQUESTED_EVENT },
} satisfies InngestFunctionOptions;

export function createProcessIndexingRunFunction<TResult>(
  handler: ProcessIndexingRunHandler,
  client: InngestFunctionClient<TResult>,
): TResult;
export function createProcessIndexingRunFunction(
  handler: ProcessIndexingRunHandler,
): unknown;
export function createProcessIndexingRunFunction<TResult>(
  handler: ProcessIndexingRunHandler,
  client: InngestFunctionClient<TResult> = inngest as unknown as InngestFunctionClient<TResult>,
): TResult {
  return client.createFunction(
    processIndexingRunFunctionOptions,
    async ({ event }) => {
      const data = ragIndexingRequestedEventDataSchema.parse(event.data);

      await handler.execute(data.runId);
    },
  );
}
