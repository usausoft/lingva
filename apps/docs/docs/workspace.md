---
sidebar_position: 4
---

# Customer workspace

The hosted workspace is separate from the SDK installed in your application.
Use `/app` to manage projects and translation delivery; use the
[CLI](./installation/cli.md) and framework SDKs in your own repository.
This page describes implemented features. A deployment may disable optional
email, billing, authoring, promotion, or delivery integrations.

## Account and access

Sign up/sign in using the platform's Cognito flow. Confirmation and password
reset are account operations, not project invitations. Signup may be public,
invite-only, or closed according to the deployment's server-side policy.
Project invitations grant membership only in the named project.

Project roles have distinct permissions:

| Role   | Read | Edit translations/drafts | Approve/publish | Manage members/keys |
| ------ | ---- | ------------------------ | --------------- | ------------------- |
| Owner  | Yes  | Yes                      | Yes             | Yes                 |
| Admin  | Yes  | Yes                      | Yes             | Yes                 |
| Editor | Yes  | Yes                      | No              | No                  |
| Viewer | Yes  | No                       | No              | No                  |

Destructive project deletion requires ownership. Internal support access is not
an ownership bypass. Platform roles are separate from these project roles.

## Projects and environments

1. Open `/app/projects`, create a project, and choose its default/target locales.
2. Open `/app/projects/<project-id>` to edit allowed project fields and manage locales.
3. Select an environment before copying setup values, publishing, or inspecting delivery.
4. Keep the CLI's project/environment and runtime bundle URL aligned.

Environment records describe local/remote delivery and publish endpoints.
The setup panel supplies values; customers do not need AWS console access.
Deleting a locale does not erase historical drafts/bundles, but it removes it
from active project delivery. Review consumer code before changing locale scope.

## SDK keys and CLI setup

Create a read-scoped SDK key in **Consumer application setup**. The token is
shown once; copy it immediately. Browser keys must have only `delivery:read`.
Revoke unused keys; for rotation, create a replacement, update consumers and
verify delivery before revoking the old key. Revocation does not recover copies
already visible in browser code.

Human publishing uses `lingva auth login`; CI needs a separately provisioned
write-scoped credential. `auth use-key` saves an existing key locally—it does
not create, rotate or revoke a hosted key. Never expose write/admin credentials
through public frontend environment variables.

Install the selected adapter and choose
[local or hosted delivery](./installation/integration-paths.md). Native Swift,
Kotlin and Flutter packages remain source previews; their default refresh APIs
do not attach credentials. Use packaged bundles or application-owned authenticated
loading as described in [native bundles](./installation/native-bundles.md).

## Translation editing and review

Open `/app/translations` and select a project and locale. The authoring environment
comes from deployment configuration; this page has no environment selector. Search keys and
filter by locale or workflow status. Authorized editors can add keys, edit values
and submit drafts; privileged deletion removes selected keys from the project
dictionaries. Server validation rejects malformed keys, invalid variants and
quota violations. A key is at most 200 ASCII characters using letters, digits,
`.`, `_`, and `-`, with no leading punctuation, consecutive dots or trailing dot.

Review drafts before approval. Owners/admins can approve and promote reviewed
work; viewers cannot edit and editors cannot approve or publish. Draft submission,
approval and publication are different operations. Existing live bundles do not
change merely because a draft was saved.

Promotion has two implementation paths:

- GitHub-enabled deployments dispatch the configured promotion workflow. Its
  `plan` mode is a non-mutating inspection flow; `promote` performs the changes.
- GitHub-disabled direct/local deployments publish approved drafts directly,
  including requests labelled `mode: plan`. **Do not use that path as a dry run.**
  Bulk draft promotion is supported only by the direct/local path.

For a safe CLI preview, use `approve --dry-run`, `publish --dry-run`, or local
`manifest` and `bundle` commands. Use `publish --local-only` to export artifacts
without uploading to configured endpoints. Review partial-failure behavior in
the CLI reference before retrying. These CLI flags do not change the direct/local
platform promotion behavior described above.

## Members and invitations

Owners/admins manage members and invitations through workspace settings.
Create a role-scoped invitation and copy its link. Email-addressed invitations
must be accepted by the matching signed-in account. Expired/revoked invitations
cannot grant access. Revoking an invitation and removing an existing member are
different operations.

Invitation email is optional. A platform super admin controls the persisted
**Enable email invites** setting at `/admin/settings`; the deployment must also
configure a verified sender. Email delivery failure does not destroy the created
invitation: copy and send the returned link manually. Do not assume an absent
email means invitation creation failed.

## Delivery operations

Inspect publish history, current delivery, invalidations and rollback history in
the delivery surface. Publishing stores versioned bundles; invalidation records
refresh intent and queued work, not proof that all clients have refreshed.
Rollback selects a previous published state; verify the current bundle and
consumer app afterwards. These operations require project publish permissions.

CLI transfer is conflict-safe: `pull` performs a three-way merge; `push` checks
the last common revision and rejects stale writes with HTTP 409. Identical mutation
retries are idempotent. Use `--force` on push only for an intentional overwrite.
Keep `.lingva/remote-state.json` private to the repository working copy and gitignored.

## Limits, activity, and billing

The backend enforces Free project limits: one owned project, five members per
project, three active API keys, and 100 distinct translation keys. Translation-key
quota counts flattened keys, not characters or locale copies. Revoked API keys
do not consume active-key quota.

Active-key limits are Free 3, Plus 10, Pro 50, Business 250 and Internal 1000. Existing
keys are not automatically deleted on a downgrade; creation stays blocked while
the count exceeds the new limit. This is not a promise that every other paid
capability or subscription lifecycle is implemented.

Project activity provides an audit trail for supported operations. Billing screens
and optional Stripe infrastructure are a scaffold/opt-in integration, not a
completed automated subscription lifecycle. Contact the operator for available
plans and enabled capabilities.

## Troubleshooting

- 401: confirm login/key and expiry; a public bundle URL still needs authentication.
- 403: check project membership/role and selected environment; a read key cannot publish.
- 409: pull and resolve concurrent edits before retrying; do not blindly force-push.
- 429/quota rejection: reduce active resources or contact the project operator.
- Missing translation: check key/locale, fallback behavior, published revision and runtime loading state.
- Missing email: copy the invitation link and ask an admin to check sender/toggle/SES eligibility.

Use [Help](https://lingva.dev/help) for documentation/support links. Do not send
API keys or private session tokens in support messages.
