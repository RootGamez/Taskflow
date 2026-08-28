import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PageEditorHeader, type PageEditorHeaderProps } from "@/features/pages/components/PageEditorHeader";

function renderHeader(overrides: Partial<PageEditorHeaderProps> = {}) {
  const props: PageEditorHeaderProps = {
    icon: "",
    title: "Onboarding del equipo",
    canEdit: true,
    onIconChange: vi.fn(),
    onTitleChange: vi.fn(),
    ...overrides,
  };

  return render(<PageEditorHeader {...props} />);
}

describe("PageEditorHeader", () => {
  it("renders the title in a textarea", () => {
    renderHeader();

    const titleField = screen.getByLabelText(/titulo/i);
    expect(titleField.tagName).toBe("TEXTAREA");
    expect(titleField).toHaveValue("Onboarding del equipo");
  });

  it("limits the icon to 8 chars", () => {
    renderHeader();

    const iconField = screen.getByLabelText(/icono/i);
    expect(iconField).toHaveAttribute("maxLength", "8");
  });

  it("disables everything when canEdit is false", () => {
    renderHeader({ canEdit: false });

    expect(screen.getByLabelText(/titulo/i)).toBeDisabled();
    expect(screen.getByLabelText(/icono/i)).toBeDisabled();
  });
});
