import { NuqsAdapter } from "nuqs/adapters/next/app";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { getMembers } from "@/actions/members";
import { MembersTableClient } from "./members-table-client";
import { membersKeys } from "./members-query-keys";
import { MembersPageHeader } from "./members-page-header";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

interface MembersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const search = await searchParams;

  // Get active organization
  const activeOrganization = await auth.api.getFullOrganization({
    headers: await headers(),
  });

  // Prepare query params for table state (used for hydration key)
  const queryParams = {
    page: search.page ?? "1",
    perPage: search.perPage ?? "10",
    sort: search.sort ?? "",
    filters: search.filters ?? "",
    joinOperator: (search.joinOperator as "and" | "or") ?? "and",
  };

  // Parse pagination for server fetch
  const page = parseInt(String(queryParams.page), 10) || 1;
  const perPage = parseInt(String(queryParams.perPage), 10) || 10;

  // Create a new QueryClient for this request
  const queryClient = new QueryClient();

  // Prefetch data on the server
  const data = await getMembers({
    limit: perPage,
    offset: (page - 1) * perPage,
  });

  // Hydrate the query client with the prefetched data
  await queryClient.prefetchQuery({
    queryKey: membersKeys.list(queryParams),
    queryFn: () => data,
  });

  return (
    <NuqsAdapter>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <div className="flex flex-col gap-4">
          <MembersPageHeader organizationId={activeOrganization?.id || ""} />

          <MembersTableClient initialData={data} />
        </div>
      </HydrationBoundary>
    </NuqsAdapter>
  );
}

