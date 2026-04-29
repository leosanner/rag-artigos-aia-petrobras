import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "font-display-mock" }),
  IBM_Plex_Mono: () => ({ variable: "font-mono-mock" }),
  IBM_Plex_Sans: () => ({ variable: "font-body-mock" }),
}));

import Home from "./page";

describe("home page", () => {
  it("explains how to add documents with ingestion and indexing links", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /como colocar novos pdfs na base/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/enviar os arquivos para o drive/i)).toBeInTheDocument();
    expect(screen.getByText(/executar a ingestao/i)).toBeInTheDocument();
    expect(screen.getByText(/gerar chunks e vetores/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /abrir ingestao/i })).toHaveAttribute(
      "href",
      "/ingestion",
    );
    expect(screen.getByRole("link", { name: /abrir indexacao/i })).toHaveAttribute(
      "href",
      "/indexing",
    );
  });
});
