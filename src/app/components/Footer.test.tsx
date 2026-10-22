import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "@/i18n/LocaleProvider";

import { Footer } from "./Footer";

describe("Footer", () => {
  it("renders Portuguese navigation by default", () => {
    render(<Footer />);

    expect(screen.getByText(/apoiado pela petrobras/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ingestão" })).toHaveAttribute(
      "href",
      "/ingestion",
    );
  });

  it("renders English navigation when the provider starts in English", () => {
    render(
      <LocaleProvider initialLocale="en">
        <Footer />
      </LocaleProvider>,
    );

    expect(screen.getByText(/supported by petrobras/i)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Footer navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Query" })).toHaveAttribute("href", "/query");
    expect(screen.getByRole("link", { name: "Ingestion" })).toHaveAttribute(
      "href",
      "/ingestion",
    );
    expect(screen.getByRole("link", { name: "Indexing" })).toHaveAttribute(
      "href",
      "/indexing",
    );
  });
});
