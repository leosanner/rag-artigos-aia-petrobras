import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/i18n/LocaleProvider";

import IngestionPage from "./page";
import { INGESTION_POLL_INTERVAL_MS } from "./constants";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const ACTIVE_RUN_ID = "22222222-2222-4222-8222-222222222222";
const SECRET = "operator-secret-value";

function jsonResponse(body: unknown, init: { status: number } = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    status: init.status,
    headers: { "Content-Type": "application/json" },
  });
}

function typeSecret(value: string): void {
  const input = screen.getByLabelText(/Segredo do operador/i);
  fireEvent.change(input, { target: { value } });
}

function clickStart(): void {
  fireEvent.click(screen.getByRole("button", { name: /Iniciar ingestão/i }));
}

describe("/ingestion page", () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

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

  it("disables Start until the operator secret is typed", () => {
    render(<IngestionPage />);

    const startButton = screen.getByRole("button", { name: /Iniciar ingestão/i });
    expect(startButton).toBeDisabled();

    typeSecret(SECRET);
    expect(startButton).toBeEnabled();
  });

  it("renders in Portuguese by default", () => {
    render(<IngestionPage />);

    expect(
      screen.getByRole("heading", { name: /Ingestão de documentos/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Start ingestion run/i)).not.toBeInTheDocument();
  });

  it("sends Authorization: Bearer <secret> to POST /api/ingestion/sync on Start", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { runId: RUN_ID, status: "queued", maxDocuments: 3 },
        { status: 202 },
      ),
    );
    render(<IngestionPage />);
    typeSecret(SECRET);

    await act(async () => {
      clickStart();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ingestion/sync",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Bearer ${SECRET}`,
        }),
      }),
    );
  });

  it("displays the queued run id after 202 and polls until the run completes", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          { runId: RUN_ID, status: "queued", maxDocuments: 3 },
          { status: 202 },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: RUN_ID,
          status: "processing",
          maxDocuments: 3,
          selectedCount: 2,
          processedCount: 1,
          failedCount: 0,
          skippedExistingCount: 0,
          lastError: null,
          items: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: RUN_ID,
          status: "completed",
          maxDocuments: 3,
          selectedCount: 2,
          processedCount: 2,
          failedCount: 0,
          skippedExistingCount: 0,
          lastError: null,
          items: [],
        }),
      );

    render(<IngestionPage />);
    typeSecret(SECRET);
    await act(async () => {
      clickStart();
    });

    expect(screen.getByText(RUN_ID)).toBeInTheDocument();
    expect(screen.getByText(/status:\s*na fila/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INGESTION_POLL_INTERVAL_MS);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/ingestion/runs/${RUN_ID}`,
      expect.objectContaining({ method: "GET" }),
    );
    expect(screen.getByText(/status:\s*processando/i)).toBeInTheDocument();
    expect(screen.getByText(/processados:\s*1/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INGESTION_POLL_INTERVAL_MS);
    });

    expect(screen.getByText(/status:\s*concluída/i)).toBeInTheDocument();

    const callCountAfterCompletion = fetchMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INGESTION_POLL_INTERVAL_MS * 3);
    });
    expect(fetchMock.mock.calls.length).toBe(callCountAfterCompletion);
  });

  it("clears the stored secret and shows a rejection message on 401", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "unauthorized" }, { status: 401 }),
    );
    sessionStorage.setItem("ingestion:secret", SECRET);

    render(<IngestionPage />);
    expect((screen.getByLabelText(/Segredo do operador/i) as HTMLInputElement).value).toBe(SECRET);

    await act(async () => {
      clickStart();
    });

    expect(
      screen.getByText(/segredo do operador foi recusado/i),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem("ingestion:secret")).toBeNull();
  });

  it("shows the active run id when the API returns 409", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ activeRunId: ACTIVE_RUN_ID }, { status: 409 }),
    );
    render(<IngestionPage />);
    typeSecret(SECRET);

    await act(async () => {
      clickStart();
    });

    expect(
      screen.getByText(/Outra ingestão já está ativa/i),
    ).toBeInTheDocument();
    expect(screen.getByText(ACTIVE_RUN_ID)).toBeInTheDocument();
  });

  it("persists the secret in sessionStorage and Clear secret removes it", async () => {
    render(<IngestionPage />);
    typeSecret(SECRET);

    expect(sessionStorage.getItem("ingestion:secret")).toBe(SECRET);

    fireEvent.click(screen.getByRole("button", { name: /Limpar segredo/i }));

    expect(sessionStorage.getItem("ingestion:secret")).toBeNull();
    expect((screen.getByLabelText(/Segredo do operador/i) as HTMLInputElement).value).toBe("");
  });

  it("does not render the secret anywhere in the DOM besides the password input value", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { runId: RUN_ID, status: "queued", maxDocuments: 3 },
        { status: 202 },
      ),
    );
    render(<IngestionPage />);
    typeSecret(SECRET);

    await act(async () => {
      clickStart();
    });

    const input = screen.getByLabelText(/Segredo do operador/i) as HTMLInputElement;
    expect(input.type).toBe("password");

    const textContent = document.body.textContent ?? "";
    expect(textContent).not.toContain(SECRET);
  });

  describe("locale", () => {
    afterEach(() => {
      document.cookie = "locale=; path=/; max-age=0";
    });

    it("renders English copy, run statuses, and errors when the provider starts in English", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ activeRunId: ACTIVE_RUN_ID }, { status: 409 }),
      );
      render(
        <LocaleProvider initialLocale="en">
          <IngestionPage />
        </LocaleProvider>,
      );

      expect(
        screen.getByRole("heading", { name: /Document ingestion/i }),
      ).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText(/Operator secret/i), {
        target: { value: SECRET },
      });

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: /Start ingestion run/i }),
        );
      });

      expect(
        screen.getByText(/Another ingestion run is already active/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Ingestão/i)).not.toBeInTheDocument();
    });

    it("re-renders an error already on screen when the locale changes", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 500 }));
      render(
        <LocaleProvider initialLocale="pt-BR">
          <IngestionPage />
        </LocaleProvider>,
      );
      typeSecret(SECRET);

      await act(async () => {
        clickStart();
      });
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Resposta inesperada (HTTP 500)",
      );

      fireEvent.click(screen.getByRole("button", { name: "English" }));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Unexpected response (HTTP 500)",
      );
      expect(document.cookie).toContain("locale=en");
    });
  });
});
