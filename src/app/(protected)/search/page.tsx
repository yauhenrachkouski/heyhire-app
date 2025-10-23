import { NuqsAdapter } from "nuqs/adapters/next/app";
import { SearchClient } from "./search-client";

export default function SearchPage() {
  return (
    <NuqsAdapter>
      <SearchClient viewMode="cards" />
    </NuqsAdapter>
  );
}
