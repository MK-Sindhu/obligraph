"use client";

import { ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Button, IconButton, IconTile } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Avatar, Input, Label, Panel, Select } from "@/components/ui/misc";
import { EmptyState, ErrorState, InlineError, LoadingRows } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, type MemberOut, type Role } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDate, humanize } from "@/lib/format";
import { useMembers } from "@/lib/members";

const ROLES: Role[] = ["viewer", "member", "admin", "owner"];
const ROLE_HELP: Record<Role, string> = {
  viewer: "Reads everything; changes nothing.",
  member: "Works tasks and updates obligation status and owners.",
  admin: "Also uploads policies, edits the organisation and manages members.",
  owner: "Full control, including other owners.",
};

function AddMemberDialog({
  open,
  onClose,
  onAdded,
  isOwner,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (m: MemberOut) => void;
  isOwner: boolean;
}) {
  const [form, setForm] = useState({ name: "", email: "", role: "member" as Role, password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  function reset() {
    setForm({ name: "", email: "", role: "member", password: "" });
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const m = await api.org.addMember({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        password: form.password || null,
      });
      reset();
      onAdded(m);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (busy) return;
        reset();
        onClose();
      }}
      title="Add a member"
      subtitle="They sign in with their email. Existing Obligraph users keep their current password."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="add-member" variant="primary" loading={busy} icon={<UserPlus size={14} />}>
            Add member
          </Button>
        </>
      }
    >
      <form id="add-member" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="m-name">Name</Label>
            <Input id="m-name" required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="m-email">Email</Label>
            <Input
              id="m-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="m-role">Role</Label>
          <Select id="m-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.filter((r) => r !== "owner" || isOwner).map((r) => (
              <option key={r} value={r}>
                {humanize(r)}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-[12px] text-ink-3">{ROLE_HELP[form.role]}</p>
        </div>
        <div>
          <Label htmlFor="m-password" hint="Required if they don't have an Obligraph account yet">
            Initial password
          </Label>
          <Input
            id="m-password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <InlineError error={error} />
      </form>
    </Dialog>
  );
}

function RoleCell({
  member,
  canManage,
  isOwner,
  soleOwner,
  onChange,
  busy,
}: {
  member: MemberOut;
  canManage: boolean;
  isOwner: boolean;
  soleOwner: boolean;
  onChange: (role: Role) => void;
  busy: boolean;
}) {
  // Backend rules: only an owner may grant or change the owner role, and an
  // organisation must always keep at least one owner.
  const lockReason =
    member.role === "owner" && !isOwner
      ? "Only an owner can change an owner's role"
      : soleOwner
        ? "The organisation needs at least one owner. Make someone else an owner first."
        : null;
  if (!canManage || lockReason) {
    return (
      <span className="text-[13px] text-ink-2" title={lockReason ?? undefined}>
        {humanize(member.role)}
        {soleOwner && canManage && <span className="ml-1.5 text-[11.5px] text-ink-3">(only owner)</span>}
      </span>
    );
  }
  return (
    <Select
      aria-label={`Role for ${member.user.name}`}
      value={member.role}
      disabled={busy}
      onChange={(e) => onChange(e.target.value as Role)}
      className="h-9 w-[124px] text-[13px]"
    >
      {ROLES.filter((r) => r !== "owner" || isOwner).map((r) => (
        <option key={r} value={r}>
          {humanize(r)}
        </option>
      ))}
    </Select>
  );
}

export function TeamTab() {
  const { user, role, can, refresh } = useAuth();
  const toast = useToast();
  const members = useMembers();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<MemberOut | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const canManage = can("admin");
  const isOwner = role === "owner";

  async function changeRole(m: MemberOut, next: Role) {
    if (next === m.role) return;
    setBusyId(m.user.id);
    try {
      const updated = await api.org.updateMember(m.user.id, next);
      members.setData((prev) => (prev ?? []).map((x) => (x.user.id === m.user.id ? updated : x)));
      toast.success(`${m.user.name} is now ${humanize(next).toLowerCase()}`);
      if (m.user.id === user?.id) refresh();
    } catch (err) {
      toast.error("Couldn't change the role", errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    const m = removing;
    setBusyId(m.user.id);
    try {
      await api.org.removeMember(m.user.id);
      members.setData((prev) => (prev ?? []).filter((x) => x.user.id !== m.user.id));
      toast.success(`${m.user.name} removed`);
      setRemoving(null);
      if (m.user.id === user?.id) refresh();
    } catch (err) {
      toast.error("Couldn't remove the member", errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const list = members.members;
  const ownerCount = list.filter((m) => m.role === "owner").length;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel
        title="Members"
        meta={members.data ? `${list.length} ${list.length === 1 ? "person" : "people"}` : undefined}
        actions={
          canManage ? (
            <Button size="sm" variant="primary" icon={<UserPlus size={13} />} onClick={() => setAdding(true)}>
              Add member
            </Button>
          ) : undefined
        }
      >
        {members.loading && !members.data && <LoadingRows rows={3} label="Loading members" />}
        {members.error != null && !members.data && <ErrorState error={members.error} onRetry={members.reload} />}
        {members.data && list.length === 0 && (
          <EmptyState icon={<Users size={24} />} title="No members">
            Add the people who track compliance with you.
          </EmptyState>
        )}
        {list.length > 0 && (
          <div className="overflow-x-auto px-3 pb-3">
            <table className="w-full min-w-[540px] text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] text-ink-3 [&>th]:font-medium">
                  <th className="px-4 py-2">Person</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Joined</th>
                  {canManage && <th className="w-12 px-3 py-2" aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {list.map((m) => {
                  const you = m.user.id === user?.id;
                  const ownerRow = m.role === "owner";
                  return (
                    <tr key={m.user.id} className="border-t border-line">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={m.user.name} size={36} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-medium text-ink">
                              <span className="truncate">{m.user.name}</span>
                              {you && (
                                <span className="rounded-full bg-accent-wash px-2 py-px text-[11px] font-medium text-accent">You</span>
                              )}
                            </p>
                            <p className="truncate text-[12px] text-ink-3">{m.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <RoleCell
                          member={m}
                          canManage={canManage}
                          isOwner={isOwner}
                          soleOwner={ownerRow && ownerCount === 1}
                          busy={busyId === m.user.id}
                          onChange={(r) => changeRole(m, r)}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-2">{fmtDate(m.joined_at)}</td>
                      {canManage && (
                        <td className="px-3 py-3 text-right">
                          <IconButton
                            size="sm"
                            label={
                              ownerRow
                                ? "Owners can't be removed. Make them an admin first (another owner must remain)."
                                : `Remove ${m.user.name}`
                            }
                            disabled={ownerRow || busyId === m.user.id}
                            className="hover:text-danger!"
                            onClick={() => setRemoving(m)}
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <aside className="rounded-card card px-6 py-6">
        <IconTile tone="accent" size="md" className="mb-4">
          <ShieldCheck size={18} />
        </IconTile>
        <p className="display mb-3 text-[15.5px]">Roles</p>
        <dl className="space-y-3 text-[13px]">
          {[...ROLES].reverse().map((r) => (
            <div key={r}>
              <dt className="font-medium text-ink">{humanize(r)}</dt>
              <dd className="text-ink-2">{ROLE_HELP[r]}</dd>
            </div>
          ))}
        </dl>
        {!canManage && <p className="mt-3 text-[12.5px] text-ink-3">Only admins and owners can add or change members.</p>}
      </aside>

      <AddMemberDialog
        open={adding}
        isOwner={isOwner}
        onClose={() => setAdding(false)}
        onAdded={(m) => {
          setAdding(false);
          members.setData((prev) => [...(prev ?? []), m]);
          toast.success("Member added", `${m.user.name} can now sign in as ${humanize(m.role).toLowerCase()}.`);
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        onClose={() => busyId === null && setRemoving(null)}
        onConfirm={confirmRemove}
        busy={busyId !== null}
        title={removing?.user.id === user?.id ? "Leave this organisation?" : "Remove this member?"}
        confirmLabel={removing?.user.id === user?.id ? "Leave organisation" : "Remove member"}
      >
        {removing?.user.id === user?.id ? (
          <p>You will lose access to this organisation immediately.</p>
        ) : (
          <p>
            <span className="font-medium text-ink">{removing?.user.name}</span> will lose access to this organisation.
            Their Obligraph account itself isn&rsquo;t deleted.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
