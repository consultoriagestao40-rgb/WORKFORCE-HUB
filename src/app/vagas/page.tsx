import { getPublicPortalVacancies } from "@/actions/recruitment";
import { VagasPortalClient } from "./VagasPortalClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicVagasPage() {
    const vacancies = await getPublicPortalVacancies();

    return <VagasPortalClient initialVacancies={vacancies} />;
}
