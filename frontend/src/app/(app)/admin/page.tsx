import type { Metadata } from "next";
import { AdminView } from "./admin-view";

export const metadata: Metadata = { title: "Platform admin" };

export default function AdminPage() {
  return <AdminView />;
}
