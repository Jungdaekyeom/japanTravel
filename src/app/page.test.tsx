// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./t/[inviteToken]/TripApp", () => ({ TripApp: () => <div>public-trip-app</div> }));
import Page from "./page";

describe("root page", () => {
  it("renders the public trip app", () => {
    render(<Page />);
    expect(screen.getByText("public-trip-app")).toBeInTheDocument();
  });
});
