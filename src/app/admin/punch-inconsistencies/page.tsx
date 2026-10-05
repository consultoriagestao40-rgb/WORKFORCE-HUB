import { redirect } from "next/navigation";

export default function PunchInconsistenciesPage() {
    redirect("/admin/punch-adjustments?tab=inconsistencies");
}

