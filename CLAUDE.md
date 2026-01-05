# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack

- **Runtime**: Bun
- **Framework**: Next.js 16 (App Router)
- **React**: 19.2
- **Database**: Neon Postgres (serverless) with Drizzle ORM
- **UI**: Tailwind CSS v4, shadcn/ui, Radix UI
- **Icons**: @tabler/icons-react (always use this)
- **Validation**: Zod v4
- **Auth**: better-auth with organization, magic link, Stripe plugins
- **State**: TanStack Query, nuqs (URL state)
- **Real-time**: Upstash Realtime (WebSocket), Upstash Redis
- **Background Jobs**: QStash workflows
- **Analytics**: PostHog, Axiom logging
- **Payments**: Stripe

## Commands

```bash
bun run dev          # Start dev server with Turbopack
bun run build        # Run migrations + build for production
bun run lint         # Run ESLint

# Database (Drizzle)
bun run db:generate  # Generate migration from schema changes
bun run db:migrate   # Apply migrations
bun run db:studio    # Open Drizzle Studio
bun run db:push      # Push schema directly (local dev only)

# Development utilities
bun run dev:stripe   # Stripe webhook listener
bun run dev:tunnel   # Cloudflare tunnel for external callbacks
bun run dev:all      # Run dev + stripe + tunnel concurrently
bun run email-dev    # Preview email templates
```

## Database Migration Flow

1. Modify `src/db/schema.ts`
2. Run `bun run db:generate` to create SQL migration in `/migrations`
3. Review the generated SQL
4. Run `bun run db:migrate` to apply
5. Commit both schema changes and migration files
6. Never use `db:push` in production (may include destructive statements)

## Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── [org]/(protected)/    # Org-scoped protected routes
│   ├── api/                  # API routes
│   │   ├── auth/[...all]/    # better-auth handler
│   │   ├── workflow/         # QStash workflow endpoints
│   │   └── search/           # Search-related endpoints
│   └── auth/                 # Auth pages
├── actions/                  # Server actions
├── components/
│   ├── ui/                   # shadcn/ui components
│   └── search/               # Search feature components
├── db/
│   ├── schema.ts             # Drizzle schema (single source of truth)
│   └── drizzle.ts            # DB client with Neon Pool
├── hooks/                    # Custom React hooks
├── lib/
│   ├── auth.ts               # better-auth configuration
│   ├── auth-client.ts        # Client-side auth
│   ├── realtime.ts           # Upstash Realtime setup
│   ├── query-keys/           # TanStack Query key factories
│   ├── axiom/                # Logging utilities
│   └── posthog/              # Analytics utilities
├── providers/                # React context providers
├── emails/                   # React Email templates
└── types/                    # TypeScript types
```

## Key Architecture Patterns

### Authentication & Organizations

Uses better-auth with organization plugin. Auth is configured in `src/lib/auth.ts` with Stripe subscription handling, organization hooks, and credit management. Sessions automatically set `activeOrganizationId` on login.

### Real-time Updates (Search Feature)

Search uses SSR + client hybrid approach with real-time updates:

1. **Server prefetch**: `page.tsx` fetches initial data with `cursor: null`
2. **Client hydration**: `useInfiniteQuery` with `initialData` for instant render
3. **Real-time**: `useSearchRealtime` hook connects to Upstash Realtime for status/progress updates
4. **Optimistic updates**: Immediate UI feedback, backend confirmation via realtime events

Realtime events are emitted via `realtime.channel('search:${searchId}').emit()` before async operations (QStash) for instant feedback.

### Cursor-based Pagination

Uses range-based timestamp comparison to handle PostgreSQL microsecond precision vs JavaScript millisecond precision. See `getCandidatesForSearch()` in `src/actions/candidates.ts`.

### QStash Workflows

Background jobs (sourcing, scoring) use QStash workflows in `src/app/api/workflow/`. They emit realtime events at each step to update frontend status.

### TanStack Query Patterns

- Use `initialData` only when query params match server-rendered state
- Always use `placeholderData: keepPreviousData` to prevent UI flicker
- Use `queryClient.setQueryData` for optimistic updates
- Invalidate by prefix pattern: `searchCandidatesKeys.details(searchId)`

### PostHog Feature Flags

- Store flag names in enums/const objects with `UPPERCASE_WITH_UNDERSCORE`
- Keep flag usage to minimum callsites
- Gate flag-dependent code on value validation
- Consult existing naming conventions before creating new events/properties

## Code Style Guidelines

- Prefer simple solutions with less code
- Use shadcn components with default styling
- Never add `mr-2` to buttons with icons
- Use React 19 features (View Transitions) when beneficial
- Prefer `"use cache"` and Partial Prerendering (PPR) patterns
- Treat route params as async (handle Promises)
- Use tag-based cache invalidation (`revalidateTag()`)
- Always resolve issues - don't create fallbacks

## Path Aliases

Use `@/*` for imports from `src/*` (configured in tsconfig.json).
