import { Inngest } from "inngest";
import { z } from "zod";

import type {
  IngestionEventPublisher,
  ProcessIngestionRunHandler,
} from "@/application/ingestion/ports";
import { env } from "@/env/server";

export const INGESTION_SYNC_REQUESTED_EVENT = "ingestion/sync.requested";

export const ingestionSyncRequestedEventDataSchema = z.object({
  runId: z.string().uuid(),
});

export type IngestionSyncRequestedEventData = z.infer<
  typeof ingestionSyncRequestedEventDataSchema
>;

export const inngest = new Inngest({
  id: "aia-insight",
  name: "AIA Insight",
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  isDev: env.INNGEST_DEV !== undefined ? true : undefined,
});

type InngestSendClient = {
  send(payload: {
    name: typeof INGESTION_SYNC_REQUESTED_EVENT;
    data: IngestionSyncRequestedEventData;
  }): Promise<unknown>;
};

export class InngestIngestionEventPublisher implements IngestionEventPublisher {
  constructor(private readonly client: InngestSendClient = inngest) {}

  async publishSyncRequested(runId: string): Promise<void> {
    const data = ingestionSyncRequestedEventDataSchema.parse({ runId });

    await this.client.send({
      name: INGESTION_SYNC_REQUESTED_EVENT,
      data,
    });
  }
}

export type ProcessIngestionRunFunctionContext = {
  event: {
    data: unknown;
  };
};

export type ProcessIngestionRunFunctionHandler = (
  context: ProcessIngestionRunFunctionContext,
) => Promise<void>;

type InngestFunctionOptions = {
  id: "process-ingestion-run";
  name: "Process ingestion run";
  triggers: {
    event: typeof INGESTION_SYNC_REQUESTED_EVENT;
  };
};

type InngestFunctionClient<TResult> = {
  createFunction(
    options: InngestFunctionOptions,
    handler: ProcessIngestionRunFunctionHandler,
  ): TResult;
};

const processIngestionRunFunctionOptions = {
  id: "process-ingestion-run",
  name: "Process ingestion run",
  triggers: { event: INGESTION_SYNC_REQUESTED_EVENT },
} satisfies InngestFunctionOptions;

export function createProcessIngestionRunFunction<TResult>(
  handler: ProcessIngestionRunHandler,
  client: InngestFunctionClient<TResult>,
): TResult;
export function createProcessIngestionRunFunction(
  handler: ProcessIngestionRunHandler,
): unknown;
export function createProcessIngestionRunFunction<TResult>(
  handler: ProcessIngestionRunHandler,
  client: InngestFunctionClient<TResult> = inngest as unknown as InngestFunctionClient<TResult>,
): TResult {
  return client.createFunction(
    processIngestionRunFunctionOptions,
    async ({ event }) => {
      const data = ingestionSyncRequestedEventDataSchema.parse(event.data);

      await handler.execute(data.runId);
    },
  );
}
