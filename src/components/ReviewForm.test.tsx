import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReviewForm from "./ReviewForm";

function respondWith(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: 201, headers: { "Content-Type": "application/json" } }))
  );
}

async function fillAndSubmit(words: string) {
  fireEvent.click(screen.getByRole("radio", { name: "4 stars" }));
  fireEvent.change(screen.getByLabelText(/anything you want to add/i), { target: { value: words } });
  fireEvent.change(screen.getByLabelText(/how your name should appear/i), { target: { value: "Sam P." } });
  fireEvent.click(screen.getByRole("checkbox"));
  const button = await screen.findByRole("button", { name: /submit review/i });
  fireEvent.submit(button.closest("form")!);
}

describe("ReviewForm thank-you", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // A review from the emailed link goes live on its own (2026-10-22), so the
  // student is told it is up rather than waiting for approval.
  it("tells a student from the emailed link that the review is on the site", async () => {
    respondWith({ ok: true, verified: true, published: true });
    render(<ReviewForm token="emailed-token" />);

    await fillAndSubmit("Clear plan, real progress.");

    expect(await screen.findByText(/on DeMario's site now/i)).toBeInTheDocument();
  });

  it("thanks a stars-only rating without promising it will show", async () => {
    respondWith({ ok: true, verified: true, published: false });
    render(<ReviewForm token="emailed-token" />);

    await fillAndSubmit("");

    expect(await screen.findByText(/DeMario has your rating/i)).toBeInTheDocument();
  });

  it("tells a public reviewer it waits for DeMario", async () => {
    respondWith({ ok: true, verified: false, published: false });
    render(<ReviewForm />);

    await fillAndSubmit("Great coach.");

    expect(await screen.findByText(/with DeMario for approval/i)).toBeInTheDocument();
  });
});
