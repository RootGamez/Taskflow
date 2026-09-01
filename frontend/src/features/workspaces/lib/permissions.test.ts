import { describe, expect, it } from "vitest";

import {
  canManageWorkspaceMembers,
  canMutateWorkspace,
  canRemoveWorkspaceMember,
} from "@/features/workspaces/lib/permissions";

describe("canMutateWorkspace", () => {
  it("permite a owner, admin y member; niega a viewer y sin rol", () => {
    expect(canMutateWorkspace("owner")).toBe(true);
    expect(canMutateWorkspace("admin")).toBe(true);
    expect(canMutateWorkspace("member")).toBe(true);
    expect(canMutateWorkspace("viewer")).toBe(false);
    expect(canMutateWorkspace(null)).toBe(false);
  });
});

describe("canManageWorkspaceMembers", () => {
  it("solo permite a owner y admin", () => {
    expect(canManageWorkspaceMembers("owner")).toBe(true);
    expect(canManageWorkspaceMembers("admin")).toBe(true);
    expect(canManageWorkspaceMembers("member")).toBe(false);
    expect(canManageWorkspaceMembers("viewer")).toBe(false);
    expect(canManageWorkspaceMembers(undefined)).toBe(false);
  });
});

describe("canRemoveWorkspaceMember", () => {
  it("el owner puede eliminar admins, members y viewers", () => {
    expect(
      canRemoveWorkspaceMember({ requesterRole: "owner", targetRole: "admin", isSelf: false }),
    ).toBe(true);
    expect(
      canRemoveWorkspaceMember({ requesterRole: "owner", targetRole: "member", isSelf: false }),
    ).toBe(true);
    expect(
      canRemoveWorkspaceMember({ requesterRole: "owner", targetRole: "viewer", isSelf: false }),
    ).toBe(true);
  });

  it("nadie puede eliminar al owner", () => {
    expect(
      canRemoveWorkspaceMember({ requesterRole: "owner", targetRole: "owner", isSelf: false }),
    ).toBe(false);
    expect(
      canRemoveWorkspaceMember({ requesterRole: "admin", targetRole: "owner", isSelf: false }),
    ).toBe(false);
  });

  it("nadie puede eliminarse a si mismo desde la lista de miembros", () => {
    expect(
      canRemoveWorkspaceMember({ requesterRole: "admin", targetRole: "admin", isSelf: true }),
    ).toBe(false);
    expect(
      canRemoveWorkspaceMember({ requesterRole: "owner", targetRole: "owner", isSelf: true }),
    ).toBe(false);
  });

  it("un admin no puede eliminar a otro admin, pero si a members y viewers", () => {
    expect(
      canRemoveWorkspaceMember({ requesterRole: "admin", targetRole: "admin", isSelf: false }),
    ).toBe(false);
    expect(
      canRemoveWorkspaceMember({ requesterRole: "admin", targetRole: "member", isSelf: false }),
    ).toBe(true);
    expect(
      canRemoveWorkspaceMember({ requesterRole: "admin", targetRole: "viewer", isSelf: false }),
    ).toBe(true);
  });

  it("nadie puede volver a eliminar a alguien ya eliminado", () => {
    expect(
      canRemoveWorkspaceMember({ requesterRole: "owner", targetRole: "removed", isSelf: false }),
    ).toBe(false);
    expect(
      canRemoveWorkspaceMember({ requesterRole: "admin", targetRole: "removed", isSelf: false }),
    ).toBe(false);
  });

  it("member y viewer nunca pueden eliminar a nadie", () => {
    expect(
      canRemoveWorkspaceMember({ requesterRole: "member", targetRole: "viewer", isSelf: false }),
    ).toBe(false);
    expect(
      canRemoveWorkspaceMember({ requesterRole: "viewer", targetRole: "member", isSelf: false }),
    ).toBe(false);
    expect(
      canRemoveWorkspaceMember({ requesterRole: null, targetRole: "member", isSelf: false }),
    ).toBe(false);
  });
});
