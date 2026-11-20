// Product screenshots taken from Obligraph running on sample (demo) data, light and dark.
// Static imports give next/image the dimensions and a content-hashed URL.

import type { StaticImageData } from "next/image";
import dashboardLight from "../../../public/marketing/dashboard-light.jpg";
import dashboardDark from "../../../public/marketing/dashboard-dark.jpg";
import lineageLight from "../../../public/marketing/lineage-light.jpg";
import lineageDark from "../../../public/marketing/lineage-dark.jpg";
import readinessLight from "../../../public/marketing/readiness-light.jpg";
import readinessDark from "../../../public/marketing/readiness-dark.jpg";
import approvalLight from "../../../public/marketing/approval-light.jpg";
import approvalDark from "../../../public/marketing/approval-dark.jpg";
import regulationsLight from "../../../public/marketing/regulations-light.jpg";
import regulationsDark from "../../../public/marketing/regulations-dark.jpg";
import requirementsLight from "../../../public/marketing/requirements-light.jpg";
import requirementsDark from "../../../public/marketing/requirements-dark.jpg";
import graphLight from "../../../public/marketing/graph-light.jpg";
import graphDark from "../../../public/marketing/graph-dark.jpg";
import obligationLight from "../../../public/marketing/obligation-light.jpg";
import obligationDark from "../../../public/marketing/obligation-dark.jpg";
import calendarLight from "../../../public/marketing/calendar-light.jpg";
import calendarDark from "../../../public/marketing/calendar-dark.jpg";
import filingsLight from "../../../public/marketing/filings-light.jpg";
import filingsDark from "../../../public/marketing/filings-dark.jpg";
import evidenceLight from "../../../public/marketing/evidence-light.jpg";
import evidenceDark from "../../../public/marketing/evidence-dark.jpg";
import board_packLight from "../../../public/marketing/board-pack-light.jpg";
import board_packDark from "../../../public/marketing/board-pack-dark.jpg";
import copilotLight from "../../../public/marketing/copilot-light.jpg";
import copilotDark from "../../../public/marketing/copilot-dark.jpg";
import sbrLight from "../../../public/marketing/sbr-light.jpg";
import sbrDark from "../../../public/marketing/sbr-dark.jpg";

export interface Shot {
  light: StaticImageData;
  dark: StaticImageData;
  alt: string;
}

export const SHOTS = {
  "dashboard": { light: dashboardLight, dark: dashboardDark, alt: "The Obligraph dashboard: policy coverage gauge, workload, filings and approvals" },
  "lineage": { light: lineageLight, dark: lineageDark, alt: "A lineage timeline: a 2019 circular superseded by its 2026 revision" },
  "readiness": { light: readinessLight, dark: readinessDark, alt: "Readiness packs for DPDP, CERT-In and KYC/AML, each with a readiness gauge and top gaps" },
  "approval": { light: approvalLight, dark: approvalDark, alt: "An approval request: maker and checker, notes, evidence files and the decision history" },
  "regulations": { light: regulationsLight, dark: regulationsDark, alt: "The regulations list: circulars with regulator, reference number, status and topics" },
  "requirements": { light: requirementsLight, dark: requirementsDark, alt: "Requirements extracted from a circular, with severity, kind, frequency and your coverage" },
  "graph": { light: graphLight, dark: graphDark, alt: "The knowledge graph of regulations, regulators, entity types, topics and acts" },
  "obligation": { light: obligationLight, dark: obligationDark, alt: "An obligation with its coverage assessment, the quoted policy passage and a suggested fix" },
  "calendar": { light: calendarLight, dark: calendarDark, alt: "The compliance calendar with deadlines, recurring obligations, filings and task due dates" },
  "filings": { light: filingsLight, dark: filingsDark, alt: "The filings tracker: returns by period with due dates, status and acknowledgement references" },
  "evidence": { light: evidenceLight, dark: evidenceDark, alt: "The evidence register: files linked to tasks, obligations and filings with SHA-256 fingerprints" },
  "board-pack": { light: board_packLight, dark: board_packDark, alt: "The board pack: coverage gauge, narrative summary and headline figures for a period" },
  "copilot": { light: copilotLight, dark: copilotDark, alt: "Copilot answering a question about cyber incident reporting, with its sources listed" },
  "sbr": { light: sbrLight, dark: sbrDark, alt: "Scale-based regulation layers for an NBFC, with the current and target layer highlighted" },
} satisfies Record<string, Shot>;

export type ShotName = keyof typeof SHOTS;
