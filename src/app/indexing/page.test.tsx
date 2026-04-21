import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import IndexingPage from "./page";
import { INDEXING_POLL_INTERVAL_MS } from "./constants";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const ACTIVE_RUN_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";
const SECRET = "operator-secret-value";

function jsonResponse(body: unknown, init: { status: number } = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    status: init.status,
    headers: { "Content-Type": "application/json" },
  });
}

function typeSecret(value: string): void {
  fireEvent.change(screen.getByLabelText(/segredo do operador/i), {
    target: { value },
  });
}

function clickStart(): void {
  fireEvent.click(screen.getByRole("button", { name: /iniciar indexacao/i }));
}

describe("/indexing page", () => {
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders Portuguese operator copy and keeps Start disabled until a secret is typed", () => {
    render(<IndexingPage />);

    expect(screen.getByText(/indexacao de documentos/i)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /iniciar indexacao/i });
    expect(button).toBeDisabled();

    typeSecret(SECRET);
    expect(button).toBeEnabled();
  });

  it("posts Authorization, force, and optional documentId when starting a run", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          runId: RUN_ID,
          status: "queued",
          documentId: DOCUMENT_ID,
          force: true,
        },
        { status: 202 },
      ),
    );
    render(<IndexingPage />);
    typeSecret(SECRET);
    fireEvent.change(screen.getByLabelText(/documento especifico/i), {
      target: { value: DOCUMENT_ID },
    });
    fireEvent.click(screen.getByLabelText(/recriar chunks existentes/i));

    await act(async () => {
      clickStart();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rag/indexing/runs",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Bearer ${SECRET}`,
        }),
        body: JSON.stringify({ documentId: DOCUMENT_ID, force: true }),
      }),
    );
  });

  it("polls run details until a terminal status is reached", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          { runId: RUN_ID, status: "queued", documentId: null, force: false },
          { status: 202 },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: RUN_ID,
          status: "processing",
          documentId: null,
          force: false,
          selectedCount: 2,
          processedCount: 1,
          failedCount: 0,
          skippedCount: 1,
          lastError: null,
          items: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: RUN_ID,
          status: "completed",
          documentId: null,
          force: false,
          selectedCount: 2,
          processedCount: 1,
          failedCount: 0,
          skippedCount: 1,
          lastError: null,
          items: [],
        }),
      );

    render(<IndexingPage />);
    typeSecret(SECRET);
    await act(async () => {
      clickStart();
    });

    expect(screen.getByText(RUN_ID)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INDEXING_POLL_INTERVAL_MS);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/rag/indexing/runs/${RUN_ID}`,
      expect.objectContaining({ method: "GET" }),
    );
    expect(screen.getByText(/processados:\s*1/i)).toBeInTheDocument();
    expect(screen.getByText(/ignorados:\s*1/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INDEXING_POLL_INTERVAL_MS);
    });
    expect(screen.getByText(/completed/i)).toBeInTheDocument();

    const callCount = fetchMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INDEXING_POLL_INTERVAL_MS * 3);
    });
    expect(fetchMock.mock.calls.length).toBe(callCount);
  });

  it("clears the stored secret and shows a Portuguese rejection message on 401", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "unauthorized" }, { status: 401 }),
    );
    sessionStorage.setItem("indexing:secret", SECRET);

    render(<IndexingPage />);

    await act(async () => {
      clickStart();
    });

    expect(screen.getByText(/segredo foi recusado/i)).toBeInTheDocument();
    expect(sessionStorage.getItem("indexing:secret")).toBeNull();
  });

  it("shows the active run id when the API returns 409", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ activeRunId: ACTIVE_RUN_ID }, { status: 409 }),
    );
    render(<IndexingPage />);
    typeSecret(SECRET);

    await act(async () => {
      clickStart();
    });

    expect(screen.getByText(/outra indexacao ja esta ativa/i)).toBeInTheDocument();
    expect(screen.getByText(ACTIVE_RUN_ID)).toBeInTheDocument();
  });

  it("starts polling the active run after the conflict CTA is clicked", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ activeRunId: ACTIVE_RUN_ID }, { status: 409 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: ACTIVE_RUN_ID,
          status: "processing",
          documentId: null,
          force: false,
          selectedCount: 1,
          processedCount: 0,
          failedCount: 0,
          skippedCount: 0,
          lastError: null,
          items: [],
        }),
      );

    render(<IndexingPage />);
    typeSecret(SECRET);

    await act(async () => {
      clickStart();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /acompanhar execucao ativa/i }),
      );
    });

    expect(screen.getByText(ACTIVE_RUN_ID)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INDEXING_POLL_INTERVAL_MS);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/rag/indexing/runs/${ACTIVE_RUN_ID}`,
      expect.objectContaining({ method: "GET" }),
    );
    expect(screen.getByText(/status:\s*processing/i)).toBeInTheDocument();
  });

  it("does not render the secret outside the password input", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { runId: RUN_ID, status: "queued", documentId: null, force: false },
        { status: 202 },
      ),
    );
    render(<IndexingPage />);
    typeSecret(SECRET);

    await act(async () => {
      clickStart();
    });

    const input = screen.getByLabelText(/segredo do operador/i) as HTMLInputElement;
    expect(input.type).toBe("password");
    expect(document.body.textContent ?? "").not.toContain(SECRET);
  });
});
