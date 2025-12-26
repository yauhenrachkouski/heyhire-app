# Scoring and Sourcing Workflow Review

This note captures potential issues observed in the current sourcing + scoring flow and the fixes I recommend revisiting later.

## Potential Issues

1. Workflow failure leaves search stuck at progress 30
   - If the external API or network is unavailable during polling, the workflow can fail before completion.
   - Result: search stays in `processing` with progress ~30 and no durable failure status.

2. No durable workflow run state
   - UI relies on realtime events/logs; there is no DB record of workflow start/end/error.
   - Hard to diagnose after the fact or resume safely.

3. Polling is required (no callback from external API)
   - External API returns a task_id and needs polling to get results.
   - Realtime events only update the UI; they do not replace polling.

4. Per-candidate scoring failures are not surfaced at search level
   - Individual scoring errors are stored, but search-level status does not reflect “scoring failed.”

5. Parse/model cache dependency (v3)
   - Scoring now depends on cached `parse_response` and `scoring_model`.
   - If they are missing/invalid, scoring fails per candidate.

## Recommended Fixes

1. Persist workflow run state
   - Add a simple `workflow_status`, `workflow_error`, `workflow_updated_at` on `search`.
   - Update at each step and on failure to avoid “stuck at 30” ambiguity.

2. Add a lightweight resume/retry endpoint
   - Re-trigger the workflow using existing `searchId`.
   - Guard against duplicate processing by checking current status.

3. Emit failure status on search
   - On workflow failure, set search `status=error` and store the failure reason.

4. Surface scoring completion
   - Add `scoring_status` + counts on search to indicate scored/total.

5. Cache generation job
   - Create explicit endpoints or a background job to populate `parse_response` and `scoring_model` once.
   - Keep scoring evaluation strictly read-only from cache.

## Notes

- Polling is necessary because the external sourcing API does not provide a webhook/callback.
- Realtime only reflects UI events; it is not a source of truth.
