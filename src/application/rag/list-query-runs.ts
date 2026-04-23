import type {
  RagQueryRunsRepository,
  RagRunSummary,
} from "@/repositories/rag-query-runs-repository";

export type ListQueryRunsDeps = {
  runsRepository: Pick<RagQueryRunsRepository, "listRecent">;
};

export class ListQueryRuns {
  private readonly runsRepository: Pick<RagQueryRunsRepository, "listRecent">;

  constructor(deps: ListQueryRunsDeps) {
    this.runsRepository = deps.runsRepository;
  }

  async execute(): Promise<RagRunSummary[]> {
    return this.runsRepository.listRecent();
  }
}
