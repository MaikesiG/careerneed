import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ConfirmDialog from "./ConfirmDialog";

function DialogTestWrapper({
  defaultOpen = false,
  isLoading = false,
  onConfirm = vi.fn(),
  onCancel = vi.fn(),
  confirmLabel,
  pendingLabel,
}: {
  defaultOpen?: boolean;
  isLoading?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  pendingLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open Delete Dialog
      </button>
      <ConfirmDialog
        isOpen={isOpen}
        title="Delete Item"
        description="Are you sure you want to permanently delete this item?"
        isLoading={isLoading}
        confirmLabel={confirmLabel}
        pendingLabel={pendingLabel}
        onConfirm={onConfirm}
        onCancel={() => {
          onCancel();
          setIsOpen(false);
        }}
      />
    </div>
  );
}

describe("ConfirmDialog - Group 1: Focus management & dismiss behavior", () => {
  it("focuses the Cancel button upon opening", async () => {
    render(<DialogTestWrapper defaultOpen={false} />);

    const openButton = screen.getByRole("button", { name: "Open Delete Dialog" });
    openButton.focus();
    expect(openButton).toHaveFocus();

    fireEvent.click(openButton);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await waitFor(() => {
      expect(cancelButton).toHaveFocus();
    });
  });

  it("closes via Escape key when not loading", () => {
    const handleCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Item"
        description="This action cannot be undone."
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={handleCancel}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it("restores focus to the triggering element when closed", async () => {
    render(<DialogTestWrapper defaultOpen={false} />);

    const openButton = screen.getByRole("button", { name: "Open Delete Dialog" });
    openButton.focus();
    fireEvent.click(openButton);

    const cancelButton = await screen.findByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancelButton).toHaveFocus());

    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(openButton).toHaveFocus();
    });
  });
});

describe("ConfirmDialog - Group 2: Loading state, disabled actions, and duplicate prevention", () => {
  it("displays the pendingLabel when loading", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Item"
        description="Processing deletion..."
        isLoading={true}
        confirmLabel="Confirm Delete"
        pendingLabel="Deleting item…"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Deleting item…" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm Delete" })).not.toBeInTheDocument();
  });

  it("disables all action buttons while loading", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Item"
        description="Processing deletion..."
        isLoading={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Close dialog" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
  });

  it("ignores the Escape key while loading", () => {
    const handleCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Item"
        description="Processing deletion..."
        isLoading={true}
        onConfirm={vi.fn()}
        onCancel={handleCancel}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleCancel).not.toHaveBeenCalled();
  });

  it("ignores backdrop click while loading", () => {
    const handleCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Item"
        description="Processing deletion..."
        isLoading={true}
        onConfirm={vi.fn()}
        onCancel={handleCancel}
      />
    );

    const backdrop = screen.getByRole("dialog");
    fireEvent.click(backdrop);
    expect(handleCancel).not.toHaveBeenCalled();
  });

  it("prevents duplicate confirmation calls when clicked while loading", () => {
    const handleConfirm = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Item"
        description="Processing deletion..."
        isLoading={true}
        pendingLabel="Deleting…"
        onConfirm={handleConfirm}
        onCancel={vi.fn()}
      />
    );

    const pendingButton = screen.getByRole("button", { name: "Deleting…" });
    fireEvent.click(pendingButton);
    expect(handleConfirm).not.toHaveBeenCalled();
  });
});
