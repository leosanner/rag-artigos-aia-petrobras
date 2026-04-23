import type {
  RagQueryRunsRepository,
  RagRunDetail,
} from "@/repositories/rag-query-runs-repository";

export type GetQueryRunDeps = {
  runsRepository: Pick<RagQueryRunsRepository, "getById">;
};

export class GetQueryRun {
  private readonly runsRepository: Pick<RagQueryRunsRepository, "getById">;

  constructor(deps: GetQueryRunDeps) {
    this.runsRepository = deps.runsRepository;
  }

  async execute(id: string): Promise<RagRunDetail | null> {
    return this.runsRepository.getById(id);
  }
}
