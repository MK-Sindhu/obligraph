"use client";

import { Info, Pencil, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { RegulatorTag } from "@/components/domain/badges";
import { EntityClassPicker } from "@/components/domain/entity-picker";
import { Button, IconTile } from "@/components/ui/button";
import { Input, Label, Meta, Panel, Select, Tag, Toggle } from "@/components/ui/misc";
import { ErrorState, InlineError, LoadingRows } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { api, type ActivityOut, type OrgOut, type SbrLayer } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { humanize } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { useVocab } from "@/lib/vocab";

function profileValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(", ") || "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// Workflow settings live in the org profile; they're edited in their own panel.
const CONTROL_KEYS = ["sbr_layer", "approval_sla_days", "maker_checker", "sso_domain"];
const LAYER_LABEL: Record<SbrLayer, string> = { base: "Base layer", middle: "Middle layer", upper: "Upper layer", top: "Top layer" };
// Entity classes the backend treats as NBFCs for scale-based regulation.
const NBFC_CLASSES = ["nbfc", "nbfc_mfi", "hfc"];

interface Controls {
  sbr_layer: SbrLayer | "";
  approval_sla_days: number;
  maker_checker: boolean;
  sso_domain: string;
}

function readControls(o: OrgOut): Controls {
  const p = o.profile ?? {};
  const layer = typeof p.sbr_layer === "string" ? (p.sbr_layer as SbrLayer) : "";
  const sla = typeof p.approval_sla_days === "number" ? p.approval_sla_days : 2;
  return {
    sbr_layer: layer,
    approval_sla_days: sla,
    maker_checker: p.maker_checker === undefined ? true : p.maker_checker === true,
    sso_domain: typeof p.sso_domain === "string" ? p.sso_domain : "",
  };
}

/** The obligations a profile change added and retired, from the audit record it leaves. */
async function lastOrgChange(): Promise<{ added: number; retired: number } | null> {
  try {
    const log: ActivityOut[] = await api.org.activity(10);
    const ev = log.find((e) => e.action === "org.updated");
    if (!ev) return null;
    const added = Number(ev.data.added ?? 0);
    const retired = Number(ev.data.retired ?? 0);
    return { added: Number.isFinite(added) ? added : 0, retired: Number.isFinite(retired) ? retired : 0 };
  } catch {
    return null;
  }
}

function ControlsPanel({ org, onSaved }: { org: OrgOut; onSaved: (o: OrgOut) => void }) {
  const { can, refresh } = useAuth();
  const toast = useToast();
  const isAdmin = can("admin");
  const initial = readControls(org);
  const [f, setF] = useState<Controls>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const isNbfc = org.entity_classes.some((c) => NBFC_CLASSES.includes(c));
  const changed = (Object.keys(initial) as (keyof Controls)[]).filter((k) => f[k] !== initial[k]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!changed.length) return;
    setBusy(true);
    setError(null);
    try {
      const profile: Record<string, unknown> = {};
      for (const k of changed) profile[k] = k === "sso_domain" ? f.sso_domain.trim().toLowerCase().replace(/^@/, "") : f[k];
      const updated = await api.org.update({ profile });
      if (changed.includes("sbr_layer")) {
        const effect = await lastOrgChange();
        const layer = f.sbr_layer ? LAYER_LABEL[f.sbr_layer] : "no layer";
        toast.success(
          `Moved to ${layer}`,
          effect
            ? `${effect.added} obligation${effect.added === 1 ? "" : "s"} added, ${effect.retired} retired.${effect.added ? " New ones are being assessed against your policies." : ""}`
            : "Obligations are being recalculated for the new layer.",
        );
      } else {
        toast.success("Settings saved");
      }
      onSaved(updated);
      refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Workflow and controls"
      icon={
        <IconTile tone="accent" size="sm">
          <SlidersHorizontal size={15} />
        </IconTile>
      }
    >
      <form onSubmit={save} className="space-y-5 px-6 pb-6 pt-1">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="ctl-sbr" hint={isNbfc ? "NBFCs only" : "Not an NBFC"}>
              Scale-based regulation layer
            </Label>
            <Select id="ctl-sbr" disabled={!isAdmin || busy} value={f.sbr_layer} onChange={(e) => setF({ ...f, sbr_layer: e.target.value as SbrLayer | "" })}>
              <option value="">Not set</option>
              {(Object.keys(LAYER_LABEL) as SbrLayer[]).map((k) => (
                <option key={k} value={k}>
                  {LAYER_LABEL[k]}
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-[11.5px] text-ink-3">Changing it adds the requirements of the new layer and retires ones that no longer apply.</p>
          </div>
          <div>
            <Label htmlFor="ctl-sla" hint="1–60 days">
              Approval SLA
            </Label>
            <div className="relative">
              <Input
                id="ctl-sla"
                type="number"
                min={1}
                max={60}
                required
                disabled={!isAdmin || busy}
                value={f.approval_sla_days}
                onChange={(e) => setF({ ...f, approval_sla_days: Math.round(Number(e.target.value)) })}
                className="pr-14"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12.5px] text-ink-3">days</span>
            </div>
            <p className="mt-1.5 text-[11.5px] text-ink-3">Requests not decided in time escalate to the next level of approver.</p>
          </div>
          <div>
            <Label htmlFor="ctl-sso" hint="Optional">
              Single sign-on domain
            </Label>
            <Input
              id="ctl-sso"
              disabled={!isAdmin || busy}
              value={f.sso_domain}
              onChange={(e) => setF({ ...f, sso_domain: e.target.value })}
              placeholder="company.in"
              pattern="@?[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
              title="A domain such as company.in"
            />
            <p className="mt-1.5 text-[11.5px] text-ink-3">People signing in with SSO from this domain join this organisation.</p>
          </div>
          <div className="rounded-[18px] bg-surface-2 px-4 py-3.5">
            <Toggle
              checked={f.maker_checker}
              disabled={!isAdmin || busy}
              onChange={(v) => setF({ ...f, maker_checker: v })}
              label={<span className="font-medium text-ink">Maker-checker approvals</span>}
            />
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
              Tasks linked to high or critical obligations need a second person&rsquo;s sign-off before they move to review or done.
            </p>
          </div>
        </div>
        <InlineError error={error} />
        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button type="submit" variant="primary" loading={busy} disabled={!changed.length}>
              Save controls
            </Button>
            {changed.length > 0 && (
              <Button variant="ghost" onClick={() => setF(initial)} disabled={busy}>
                Discard
              </Button>
            )}
            {changed.length > 0 && <span className="text-[12px] text-ink-3">{changed.length} unsaved change{changed.length === 1 ? "" : "s"}</span>}
          </div>
        ) : (
          <p className="text-[12.5px] text-ink-3">Only admins and owners can change these.</p>
        )}
      </form>
    </Panel>
  );
}

function EditForm({ org, onDone }: { org: OrgOut; onDone: (o: OrgOut | null) => void }) {
  const toast = useToast();
  const [name, setName] = useState(org.name);
  const [classes, setClasses] = useState<string[]>(org.entity_classes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const classesChanged =
    classes.length !== org.entity_classes.length || classes.some((c) => !org.entity_classes.includes(c));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!classes.length) {
      setError(new Error("Choose at least one entity type."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: { name?: string; entity_classes?: string[] } = {};
      if (name.trim() !== org.name) body.name = name.trim();
      if (classesChanged) body.entity_classes = classes;
      const updated = Object.keys(body).length ? await api.org.update(body) : org;
      toast.success(
        "Organisation updated",
        classesChanged ? "Obligations are being recalculated for your new entity types." : undefined,
      );
      onDone(updated);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5 px-6 pb-6 pt-1">
      <div className="max-w-md">
        <Label htmlFor="org-name">Organisation name</Label>
        <Input id="org-name" required minLength={2} maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="org-classes" hint={`${classes.length} selected`}>
          Entity types
        </Label>
        <EntityClassPicker id="org-classes" value={classes} onChange={setClasses} disabled={busy} />
      </div>
      {classesChanged && (
        <p className="flex gap-2.5 rounded-[18px] border border-accent/20 bg-accent-wash px-4 py-3 text-[13px] text-ink-2">
          <Info size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
          Changing entity types changes which regulations apply to you. Obligraph adds obligations for newly applicable
          requirements and retires ones that no longer apply; your regulators are updated to match.
        </p>
      )}
      <InlineError error={error} />
      <div className="flex gap-2.5">
        <Button type="submit" variant="primary" loading={busy}>
          Save changes
        </Button>
        <Button variant="ghost" onClick={() => onDone(null)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function OrganisationTab() {
  const { can, refresh } = useAuth();
  const { entity, regulator } = useVocab();
  const org = useQuery<OrgOut>("org", (signal) => api.org.get({ signal }));
  const [editing, setEditing] = useState(false);
  const isAdmin = can("admin");

  if (org.loading && !org.data) return <Panel title="Organisation profile"><LoadingRows rows={4} label="Loading organisation" /></Panel>;
  if (!org.data) return <Panel title="Organisation profile"><ErrorState error={org.error} onRetry={org.reload} /></Panel>;

  const o = org.data;
  const profile = Object.entries(o.profile ?? {}).filter(([k]) => !CONTROL_KEYS.includes(k));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
      <Panel
        title="Organisation profile"
        actions={
          isAdmin && !editing ? (
            <Button size="sm" icon={<Pencil size={13} />} onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          ) : undefined
        }
      >
        {editing ? (
          <EditForm
            org={o}
            onDone={(updated) => {
              setEditing(false);
              if (updated) {
                org.setData(updated);
                refresh();
              }
            }}
          />
        ) : (
          <dl className="grid gap-x-6 gap-y-5 px-6 pb-6 pt-1 sm:grid-cols-2">
            <Meta label="Name">{o.name}</Meta>
            <Meta label="Workspace ID">
              <span className="font-mono text-[12.5px] text-ink-2">{o.slug}</span>
            </Meta>
            <Meta label="Entity types" className="sm:col-span-2">
              {o.entity_classes.length ? (
                <span className="flex flex-wrap gap-1.5">
                  {o.entity_classes.map((k) => (
                    <Tag key={k}>{entity(k)}</Tag>
                  ))}
                </span>
              ) : (
                <span className="text-ink-3">None set — no regulations can be matched to you.</span>
              )}
            </Meta>
            <Meta label="Regulators" className="sm:col-span-2">
              {o.regulators.length ? (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {o.regulators.map((r) => (
                    <span key={r} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
                      <RegulatorTag regulator={r} />
                      {regulator(r)}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-ink-3">None</span>
              )}
            </Meta>
            {profile.map(([k, v]) => (
              <Meta key={k} label={humanize(k)}>
                {profileValue(v)}
              </Meta>
            ))}
          </dl>
        )}
      </Panel>

      <ControlsPanel
        key={JSON.stringify(readControls(o))}
        org={o}
        onSaved={(updated) => org.setData(updated)}
      />
      </div>

      <aside className="rounded-card card px-6 py-6 text-[13px] leading-relaxed text-ink-2">
        <IconTile tone="accent" size="md" className="mb-4">
          <Info size={18} />
        </IconTile>
        <p className="display mb-1.5 text-[15.5px] text-ink">How applicability works</p>
        <p>
          Each requirement in a circular names the entity types it binds. Obligraph creates an obligation for your
          organisation whenever a requirement covers one of your entity types.
        </p>
        {!isAdmin && <p className="mt-3 text-ink-3">Only admins and owners can change the organisation profile.</p>}
      </aside>
    </div>
  );
}
