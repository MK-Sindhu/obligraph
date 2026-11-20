"use client";

import { RefreshCw, ShieldCheck } from "lucide-react";
import { IngestPanel } from "@/components/admin/ingest";
import { JobsPanel } from "@/components/admin/jobs";
import { OverviewPanel, UsagePanel } from "@/components/admin/overview";
import { SourcesPanel } from "@/components/admin/sources";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { api, type AdminOverview } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";

function AdminContent() {
  const overview = useQuery<AdminOverview>("admin:overview", (signal) => api.admin.overview({ signal }));
  const shared = { data: overview.data, loading: overview.loading, error: overview.error, onRetry: overview.reload };

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Platform admin"
        description="The shared regulatory corpus, crawlers and background work behind every organisation on this Obligraph instance."
        actions={
          <Button
            size="sm"
            icon={<RefreshCw size={13} className={overview.loading && overview.data ? "animate-spin" : undefined} />}
            onClick={overview.reload}
            disabled={overview.loading}
          >
            Refresh overview
          </Button>
        }
      />
      <div className="space-y-6">
        <OverviewPanel {...shared} />
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <JobsPanel counts={overview.data?.jobs} onRefreshed={overview.reload} />
          <UsagePanel {...shared} />
        </div>
        <SourcesPanel onQueued={overview.reload} />
        <IngestPanel onIngested={overview.reload} />
      </div>
    </>
  );
}

export function AdminView() {
  const { isSuperuser } = useAuth();
  if (!isSuperuser) {
    return (
      <div className="mt-6 rounded-card soft">
        <EmptyState
          icon={<ShieldCheck size={26} />}
          title="Platform admins only"
          action={
            <ButtonLink href="/dashboard" variant="secondary">
              Back to dashboard
            </ButtonLink>
          }
        >
          This page manages the shared regulatory corpus, crawlers and background jobs for every organisation. Your
          account doesn&rsquo;t have platform admin access. Organisation settings are under Settings.
        </EmptyState>
      </div>
    );
  }
  return <AdminContent />;
}
