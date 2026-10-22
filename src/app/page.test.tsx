import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/i18n/LocaleProvider";

vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "font-display-mock" }),
  IBM_Plex_Mono: () => ({ variable: "font-mono-mock" }),
  IBM_Plex_Sans: () => ({ variable: "font-body-mock" }),
}));

import Home from "./page";

describe("home page", () => {
  afterEach(() => {
    cleanup();
    document.cookie = "locale=; path=/; max-age=0";
  });

  it("explains how to add documents with ingestion and indexing links", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /como colocar novos pdfs na base/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/enviar os arquivos para o drive/i)).toBeInTheDocument();
    expect(screen.getByText(/executar a ingestão/i)).toBeInTheDocument();
    expect(screen.getByText(/gerar chunks e vetores/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /abrir ingestão/i })).toHaveAttribute(
      "href",
      "/ingestion",
    );
    expect(screen.getByRole("link", { name: /abrir indexação/i })).toHaveAttribute(
      "href",
      "/indexing",
    );
  });

  it("renders English copy when the provider starts in English", () => {
    render(
      <LocaleProvider initialLocale="en">
        <Home />
      </LocaleProvider>,
    );

    expect(
      screen.getByRole("heading", { name: /how to add new pdfs to the base/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open rag query/i })).toHaveAttribute(
      "href",
      "/query",
    );
    expect(screen.getByRole("link", { name: /open ingestion/i })).toHaveAttribute(
      "href",
      "/ingestion",
    );
    expect(screen.queryByText(/ingestão/i)).not.toBeInTheDocument();
  });

  it("switches language from the header selector", () => {
    render(
      <LocaleProvider initialLocale="pt-BR">
        <Home />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(
      screen.getByRole("heading", { name: /how to add new pdfs to the base/i }),
    ).toBeInTheDocument();
    expect(document.cookie).toContain("locale=en");
  });
});
