import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RAG_SOURCE_EXCERPT_PREVIEW_LENGTH,
  truncateExcerptPreview,
} from "./constants";
import QueryPage from "./page";

const LONG_EXCERPT = `${"A".repeat(RAG_SOURCE_EXCERPT_PREVIEW_LENGTH)} trecho extra para truncar`;
const SECRET = "query-secret-value";

const SUCCESS_RESPONSE = {
  answer:
    "Os documentos destacam classificacao supervisionada e segmentacao [1] [2].",
  mode: "global" as const,
  sources: [
    {
      sourceNumber: 1,
      chunkId: "11111111-1111-4111-8111-111111111111",
      documentId: "22222222-2222-4222-8222-222222222222",
      documentTitle: "artigo-a.pdf",
      chunkIndex: 0,
      excerpt: LONG_EXCERPT,
      score: 0.91,
      documentPipelineVersion: "documents-v1",
      chunkingVersion: "hybrid-v1-900-150",
      embeddingModel: "text-embedding-3-large",
    },
    {
      sourceNumber: 2,
      chunkId: "33333333-3333-4333-8333-333333333333",
      documentId: "44444444-4444-4444-8444-444444444444",
      documentTitle: "artigo-b.pdf",
      chunkIndex: 1,
      excerpt: "Trecho curto.",
      score: 0.87,
      documentPipelineVersion: "documents-v1",
      chunkingVersion: "hybrid-v1-900-150",
      embeddingModel: "text-embedding-3-large",
    },
  ],
  metadata: {
    mode: "global" as const,
    topK: 6,
    promptVersion: "f03-global-rag-v1",
    generationModel: "gpt-4.1-mini",
    embeddingModel: "text-embedding-3-large",
  },
};

function jsonResponse(
  body: unknown,
  init: { status: number } = { status: 200 },
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status,
    headers: { "Content-Type": "application/json" },
  });
}

function typeQuestion(value: string): void {
  fireEvent.change(screen.getByLabelText(/pergunta/i), {
    target: { value },
  });
}

function typeSecret(value: string): void {
  fireEvent.change(screen.getByLabelText(/secret de consulta/i), {
    target: { value },
  });
}

function clickSubmit(): void {
  fireEvent.click(screen.getByRole("button", { name: /consultar base/i }));
}

describe("/query page", () => {
  const fetchMock = vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.clear();
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders PT-BR copy, stays global-only, and requires the secret", () => {
    render(<QueryPage />);

    expect(
      screen.getByRole("heading", { name: /consulta na base/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/pergunta/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/secret de consulta/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /consultar base/i })).toBeDisabled();
    expect(screen.queryByText(/focado/i)).not.toBeInTheDocument();
  });

  it("keeps submit disabled for whitespace-only questions", () => {
    render(<QueryPage />);
    typeSecret(SECRET);

    typeQuestion("   ");

    expect(screen.getByRole("button", { name: /consultar base/i })).toBeDisabled();
  });

  it("keeps submit disabled until a secret is typed", () => {
    render(<QueryPage />);
    typeQuestion("Pergunta valida");

    expect(screen.getByRole("button", { name: /consultar base/i })).toBeDisabled();

    typeSecret(SECRET);

    expect(screen.getByRole("button", { name: /consultar base/i })).toBeEnabled();
  });

  it("shows a loading state and posts the trimmed global question", async () => {
    let resolveFetch: ((value: Response) => void) | null = null;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(<QueryPage />);
    typeSecret(`  ${SECRET}  `);
    typeQuestion(`   ${SUCCESS_RESPONSE.answer}   `);

    await act(async () => {
      clickSubmit();
    });

    expect(
      screen.getByRole("button", { name: /consultando/i }),
    ).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rag/ask",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: `Bearer ${SECRET}`,
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          question: SUCCESS_RESPONSE.answer,
          mode: "global",
        }),
      }),
    );

    await act(async () => {
      resolveFetch?.(jsonResponse(SUCCESS_RESPONSE));
    });
  });

  it("renders the answer, numbered sources, and the technical summary without promptVersion", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SUCCESS_RESPONSE));

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Quais tecnicas aparecem com mais frequencia?");

    await act(async () => {
      clickSubmit();
    });

    expect(screen.getByText(SUCCESS_RESPONSE.answer)).toBeInTheDocument();
    expect(screen.getByText("1. artigo-a.pdf")).toBeInTheDocument();
    expect(screen.getByText("2. artigo-b.pdf")).toBeInTheDocument();
    expect(screen.getByText(/top-k:\s*6/i)).toBeInTheDocument();
    expect(screen.getByText(/gpt-4\.1-mini/i)).toBeInTheDocument();
    expect(screen.getByText(/text-embedding-3-large/i)).toBeInTheDocument();
    expect(screen.queryByText(/f03-global-rag-v1/i)).not.toBeInTheDocument();
  });

  it("truncates long excerpts only in the rendered preview", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SUCCESS_RESPONSE));

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Explique o contexto.");

    await act(async () => {
      clickSubmit();
    });

    const preview = truncateExcerptPreview(LONG_EXCERPT);

    expect(screen.getByText(preview)).toBeInTheDocument();
    expect(screen.queryByText(LONG_EXCERPT)).not.toBeInTheDocument();
    expect(truncateExcerptPreview(LONG_EXCERPT)).toBe(preview);
    expect(LONG_EXCERPT).toContain("trecho extra para truncar");
  });

  it("shows the empty-sources message when the answer succeeds without retrieved sources", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...SUCCESS_RESPONSE,
        answer: "Nao encontrei evidencias suficientes nos documentos recuperados.",
        sources: [],
      }),
    );

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Existe evidencia suficiente?");

    await act(async () => {
      clickSubmit();
    });

    expect(
      screen.getByText(/nao encontrei evidencias suficientes/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/nenhuma fonte foi recuperada para esta pergunta/i),
    ).toBeInTheDocument();
  });

  it("shows a safe invalid-request message on 400", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "invalid_request" }, { status: 400 }),
    );

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Pergunta invalida");

    await act(async () => {
      clickSubmit();
    });

    expect(
      screen.getByText(/digite uma pergunta valida para consultar/i),
    ).toBeInTheDocument();
  });

  it("clears the stored secret and shows a rejection message on 401", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "unauthorized" }, { status: 401 }),
    );
    sessionStorage.setItem("query:secret", SECRET);

    render(<QueryPage />);

    expect((screen.getByLabelText(/secret de consulta/i) as HTMLInputElement).value).toBe(SECRET);

    typeQuestion("Pergunta valida");

    await act(async () => {
      clickSubmit();
    });

    expect(screen.getByText(/secret de consulta foi rejeitado/i)).toBeInTheDocument();
    expect(sessionStorage.getItem("query:secret")).toBeNull();
    expect((screen.getByLabelText(/secret de consulta/i) as HTMLInputElement).value).toBe("");
  });

  it.each([502, 503])(
    "shows the safe technical message for HTTP %s",
    async (status) => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          {
            error:
              status === 502
                ? "generation_failed"
                : "generation_unavailable",
          },
          { status },
        ),
      );

      render(<QueryPage />);
      typeSecret(SECRET);
      typeQuestion("Pergunta valida");

      await act(async () => {
        clickSubmit();
      });

      expect(
        screen.getByText(
          /nao foi possivel consultar a base agora\. tente novamente em instantes\./i,
        ),
      ).toBeInTheDocument();
    },
  );

  it("shows the same safe technical message for network failures and malformed success bodies", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    const { unmount } = render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Pergunta valida");

    await act(async () => {
      clickSubmit();
    });

    expect(
      screen.getByText(
        /nao foi possivel consultar a base agora\. tente novamente em instantes\./i,
      ),
    ).toBeInTheDocument();

    unmount();
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Pergunta valida de novo");

    await act(async () => {
      clickSubmit();
    });

    expect(
      screen.getByText(
        /nao foi possivel consultar a base agora\. tente novamente em instantes\./i,
      ),
      ).toBeInTheDocument();
  });

  it("persists the secret in sessionStorage and lets the user clear it", () => {
    render(<QueryPage />);
    typeSecret(SECRET);

    expect(sessionStorage.getItem("query:secret")).toBe(SECRET);

    fireEvent.click(screen.getByRole("button", { name: /limpar secret/i }));

    expect(sessionStorage.getItem("query:secret")).toBeNull();
    expect((screen.getByLabelText(/secret de consulta/i) as HTMLInputElement).value).toBe("");
  });

  it("does not render the secret outside the password input", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SUCCESS_RESPONSE));

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Pergunta valida");

    await act(async () => {
      clickSubmit();
    });

    const input = screen.getByLabelText(/secret de consulta/i) as HTMLInputElement;
    expect(input.type).toBe("password");
    expect(document.body.textContent ?? "").not.toContain(SECRET);
  });
});
