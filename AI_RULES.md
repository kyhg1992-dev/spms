# AI Rules for SPMS Development

## Purpose

This file defines mandatory engineering rules for all future AI agents and contributors working on SPMS, the Smart Preventive Maintenance System. SPMS is an industrial maintenance operations platform. It must remain operational, scalable, technician-friendly, enterprise-ready, bilingual, and maintainable.

These rules are written to preserve the existing product direction while allowing disciplined, incremental improvement.

## 1. Architecture Preservation

- Preserve the existing React + TypeScript + Firebase architecture.
- Do not replace the routing, data access, authentication, UI component system, or Firebase backend without explicit human approval.
- Prefer incremental extension over rewrites.
- Keep features aligned with the existing module structure under `src/pages`, `src/components`, `src/hooks`, `src/api`, `src/services`, `src/lib`, and `src/models`.
- Do not introduce a new state management library, backend framework, database, ORM, or design system unless explicitly requested.
- Keep business logic close to existing services, hooks, models, normalizers, and permission utilities.

## 2. React + Firebase Constraints

- SPMS is a Firebase-backed React application. Preserve Firebase Auth, Firestore, and Storage usage.
- Use existing Firebase client setup from `src/lib/firebase.ts`.
- Use existing Firestore service patterns before creating new access layers.
- Use React Query hooks where the app already expects cached server state.
- Use Firestore snapshot subscriptions only where realtime operational behavior is needed.
- Do not bypass Firestore security rules by moving privileged client behavior into unsafe frontend code.
- Do not introduce server-only assumptions into browser code.

## 3. TypeScript Standards

- Maintain strict, readable TypeScript.
- Prefer existing domain types from `src/models/firestore.ts`.
- Avoid `any`. If unavoidable, isolate it and document why.
- Validate user input with Zod when forms or external data are involved.
- Normalize Firestore reads through existing normalizer patterns when documents may contain legacy or optional fields.
- Keep function signatures explicit for service and utility functions.
- Avoid broad type assertions that hide real data-shape problems.

## 4. Bilingual Arabic/English Requirements

- SPMS must remain bilingual-ready, with Arabic as a primary operator-facing language.
- Preserve Arabic labels and operational terminology already used in the UI.
- Use professional maintenance terminology, not generic app wording.
- English may be used for technical identifiers, code, routes, and internal documentation.
- User-facing strings should be clear for Arabic-speaking technicians and managers.
- Avoid mixing Arabic and English in a way that harms readability.

## 5. RTL/LTR Support

- Preserve RTL-first layout behavior for Arabic screens.
- Use `dir="ltr"` for technical identifiers, IDs, paths, serial numbers, emails, URLs, and numeric codes when needed.
- Ensure tables, forms, dialogs, command palette entries, and mobile layouts remain usable in RTL.
- Do not hard-code left/right spacing when logical CSS utilities or existing RTL-aware patterns are available.
- Verify that Arabic text, Latin codes, dates, and numbers do not visually collide.

## 6. Industrial UI/UX Philosophy

- SPMS is an industrial maintenance operations platform, not a marketing site.
- UI must be dense, clear, calm, and operational.
- Prioritize scanability, task completion, status visibility, and field usability.
- Avoid decorative redesigns, oversized hero sections, ornamental graphics, and one-off visual experiments.
- Use existing UI components and design language.
- Every screen should help technicians, managers, or admins complete maintenance work with confidence.
- Prefer practical dashboards, clear tables, actionable forms, and concise status indicators.

## 7. PM Workflow Philosophy

- Preventive maintenance workflows must be predictable, auditable, and tied to assets.
- PM schedules should support time-based, meter-based, kilometer-based, and combined triggers as modeled.
- PM completion should update next due values and create traceable history.
- Auto-created work orders must be deterministic and auditable.
- PM alerts should be generated from real due/overdue logic, not static display assumptions.
- Do not implement PM shortcuts that break traceability or maintenance compliance.

## 8. Work Order Lifecycle Rules

- Work orders are operational records and must be treated as controlled lifecycle entities.
- Status transitions must be deliberate and valid.
- Required work order states include the current model: `open`, `assigned`, `in_progress`, `waiting_parts`, `completed`, and `cancelled`.
- Completion must capture meaningful close-out data such as labor, downtime, notes, cost, and completion timestamp where applicable.
- Assignment changes, priority changes, approvals, cancellations, and completions must be auditable.
- Requester, technician, manager, and admin roles must have distinct behavior.
- Do not allow silent destructive changes to work order history.

## 9. Firebase Security Rules Discipline

- Firestore rules are part of the application contract.
- Any change to client permissions must be reviewed against `firestore.rules`.
- Any new collection must include corresponding rules before being used by production UI.
- Do not weaken rules to make frontend code work.
- Temporary development bypasses must be clearly labeled, narrowly scoped, and removed before production hardening.
- Security rules should reflect role-based access, ownership constraints, and operational safety.

## 10. Audit Trail Requirements

- Important operational writes must produce audit events.
- Audit logs should capture actor, action, entity type, entity ID, timestamp, and a human-readable Arabic label.
- Required audit coverage includes asset create/update/delete, meter readings, work order transitions, PM changes, settings changes, user role changes, notification lifecycle changes, and attachment operations.
- Audit failures should not unnecessarily block field operations, but they must be visible during debugging.
- Do not remove or bypass audit behavior to simplify a feature.

## 11. Naming Conventions

- Use English for code identifiers, file names, routes, collection names, and TypeScript types.
- Use clear domain names: `Asset`, `WorkOrder`, `PMSchedule`, `MeterReading`, `Notification`, `ActivityLogEntry`.
- Keep Firestore collection names consistent with existing names: `users`, `assets`, `workOrders`, `pmSchedules`, `notifications`, `meterReadings`, `activityLogs`, `attachments`, `companySettings`.
- Use kebab-case for component/page file names where the project already does.
- Use descriptive function names that reveal domain intent.
- Avoid vague names such as `data`, `stuff`, `thing`, `handler2`, or `newService`.

## 12. Forbidden Actions

Future AI agents must not:

- Rebuild the project from scratch.
- Replace React, Firebase, Vite, TypeScript, or the existing UI system without explicit approval.
- Install unnecessary packages.
- Delete existing business logic to simplify implementation.
- Rewrite working modules without a specific defect or approved redesign.
- Weaken Firestore or Storage security rules casually.
- Hard-code production credentials, secrets, UIDs, or privileged emails.
- Break Arabic/RTL support.
- Introduce mock-only behavior into production paths.
- Hide errors that operators or maintainers need to know about.
- Perform destructive Git or filesystem operations without explicit approval.

## 13. Git Workflow Discipline

- Keep changes small, reviewable, and related to the requested task.
- Do not mix unrelated refactors with feature work.
- Before editing, inspect the relevant files and preserve user or teammate changes.
- Do not revert changes you did not make unless explicitly asked.
- Use clear commit messages when commits are requested.
- Document verification steps in the final handoff.
- If Git tooling is unavailable, state that clearly and continue with careful file-level discipline.

## 14. Performance Rules

- Avoid unnecessary rerenders, duplicate Firestore reads, and broad unbounded queries.
- Use React Query cache patterns already present in the project.
- Prefer pagination, filtering, and query limits for large operational datasets.
- Keep dashboard metrics efficient and derived from available snapshots only when appropriate.
- Do not subscribe to large collections unless realtime behavior is operationally necessary.
- Avoid heavy client-side computation in technician-facing mobile workflows.
- Keep bundle growth under control; do not add large dependencies for small tasks.

## 15. Mobile Technician UX Principles

- Technician workflows must be fast on mobile.
- Forms should be short, clear, and tolerant of field conditions.
- Primary actions should be reachable with minimal scrolling.
- Use readable touch targets and avoid dense controls that are hard to tap.
- Support quick status updates, meter entry, notes, photos, and work order close-out.
- Never require technicians to understand internal IDs when a human-readable asset or work order label can be shown.
- Preserve offline/error resilience expectations where Firebase behavior allows.

## 16. Notification Standards

- Notifications must be actionable, relevant, and role-aware.
- Notifications should reference the related entity through `refPath` where applicable.
- Priority should reflect operational urgency: low, normal, high, or critical.
- Avoid noisy notifications for routine background changes.
- Critical alerts should be clear, concise, and tied to maintenance action.
- Notification read/unread state must be auditable when implemented.
- Email notification behavior must not be implied unless actual delivery exists.

## 17. Future Scalability Rules

- Design new features so Firestore collections can grow.
- Avoid designs that require loading all historical records for every dashboard view.
- Keep domain logic reusable across pages, hooks, and future automation.
- Prefer explicit schemas, typed services, and normalized read models.
- Plan for departments, locations, technician teams, asset hierarchies, attachments, spare parts, and reporting expansion.
- Keep data contracts stable; migration support should be explicit when fields change.

## 18. Do Not Rebuild Existing Modules Unnecessarily

- Existing modules should be extended, not replaced, unless there is a documented defect or approved redesign.
- Asset management, authentication, routing, dashboard layout, Firebase setup, and UI primitives must be preserved.
- When improving a module, keep current user-visible behavior unless the requested task requires a change.
- Avoid broad styling rewrites while implementing operational features.

## 19. Prefer Extending Existing Services And Hooks

- Use `src/hooks/use-spms-data.ts` for query hooks when adding page data needs.
- Use `src/services/firestore/spms-service.ts` for domain writes when possible.
- Use `src/services/firestore/crud.ts` only through domain-level services unless a generic operation is truly appropriate.
- Use existing normalizers or add matching normalizers for new Firestore read models.
- Use existing permission helpers and update them consistently with Firestore rules.
- Keep page components focused on UI and orchestration, not deep business rules.

## 20. Avoid Overengineering

- Solve the operational problem in front of the team.
- Do not add abstractions before duplication or complexity justifies them.
- Do not introduce queues, workers, custom frameworks, event buses, or elaborate state machines without clear need and approval.
- Prefer clear, typed, maintainable code over clever patterns.
- Enterprise-ready does not mean complicated; it means reliable, auditable, secure, and understandable.

## Final Principle

Every change to SPMS must strengthen the platform as a real maintenance operations system. The correct solution is the one that helps technicians complete work, helps managers trust the data, protects operational records, and keeps the codebase maintainable for the next engineer.

