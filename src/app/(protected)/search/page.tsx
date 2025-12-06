import { NuqsAdapter } from "nuqs/adapters/next/app";
import { SearchClient } from "./search-client";

export default function SearchPage() {
  return (
    <>
      <div className="fixed inset-0 bg-sidebar -z-10" />
      <NuqsAdapter>
        <SearchClient viewMode="cards" />
      </NuqsAdapter>
    </>
  );
}
