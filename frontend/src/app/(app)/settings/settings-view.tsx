"use client";

import { ActivityTab } from "@/components/settings/activity-tab";
import { OrganisationTab } from "@/components/settings/organisation-tab";
import { TabList } from "@/components/settings/tabs";
import { TeamTab } from "@/components/settings/team-tab";
import { PageHeader } from "@/components/ui/misc";
import { useAuth } from "@/lib/auth";
import { useUrlState } from "@/lib/url-state";

type Tab = "organisation" | "team" | "activity";
const TABS: { value: Tab; label: string }[] = [
  { value: "organisation", label: "Organisation" },
  { value: "team", label: "Team" },
  { value: "activity", label: "Activity log" },
];

export function SettingsView() {
  const { org } = useAuth();
  const { get, set } = useUrlState();
  const raw = get("tab");
  const tab: Tab = raw === "team" || raw === "activity" ? raw : "organisation";

  return (
    <>
      <PageHeader eyebrow={org?.name} title="Settings" description="Your organisation's profile, the people who can use Obligraph, and a record of what changed." />
      <TabList
        label="Settings sections"
        idPrefix="settings"
        value={tab}
        onChange={(t) => set({ tab: t === "organisation" ? null : t })}
        tabs={TABS}
      />
      <div role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`}>
        {tab === "organisation" && <OrganisationTab />}
        {tab === "team" && <TeamTab />}
        {tab === "activity" && <ActivityTab />}
      </div>
    </>
  );
}
