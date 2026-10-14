---
sidebar_position: 1
---

# GitHub project integration

The GitHub integration is a development preview. Availability depends on your
deployment. A platform super admin controls feature availability; project owners
and admins configure their own connection. SDK installation does not require this integration.

## Connect a repository {#connect}

1. Select your project in workspace **Settings** and open **GitHub integration**.
2. Install or configure the deployment's Lingva GitHub App for the selected repository.
3. Choose **Discover GitHub repositories** and verify your GitHub identity.
4. Select a repository you administer, its existing base branch, the project
   environment, configured locales, and one translation folder.
5. Choose **Verify and connect** and complete the fresh GitHub verification.

The initial provider supports JSON files named `<folder>/<locale>.json`, for
example `translations/en.json`. Other file formats and providers are not supported yet.
The App needs Contents, Pull requests, and Actions write access, plus Checks,
Statuses, and Metadata read access. Select only repositories you intend to connect.
You do not need to paste an App private key or personal access token into Lingva.

## Open a translation pull request {#translation-pr}

Create and approve drafts through the [workspace review flow](../workspace.md#translation-editing-and-review).
Select up to 50 approved edits from the connection's environment and locales.
Lingva opens a translation pull request and preserves unrelated repository files
and translation values. Repeating the same selection under the same connection
recovers its existing operation. An unchanged result needs no new commit.

Opening a pull request does not publish a runtime bundle, merge changes, deploy
your application, or dispatch a separate workflow. Your repository's normal
pull-request CI runs according to its GitHub configuration.

Refresh **Pull request and CI status** to inspect checks for the current PR commit.
Unknown, pending, failed, and reported-passed states are distinct. Reported passing
checks do not prove branch-protection requirements, merge readiness, or deployment.
Review the diff and required checks in GitHub before merging.

## Run a workflow explicitly {#workflow}

The optional **Customer GitHub workflow** panel runs a configured workflow on
the connected base branch. Its `workflow_dispatch` declaration must accept these
three inputs: `lingva_request_id`, `lingva_project_id`, and `lingva_environment_id`.
Configure and verify the workflow, prepare a request, then explicitly confirm its run.
These identifiers correlate the run; they are not credentials.

Acceptance by GitHub does not mean the workflow passed. Follow the returned run
link and inspect its result. Reloading or refreshing an existing request checks
its saved state instead of dispatching again. If the response is unknown, inspect
GitHub and the request before preparing another run; automatic retries could duplicate work.

## Disconnect and recover access {#recovery}

**Disconnect** removes the project binding while preserving existing pull requests
and the GitHub App installation. Recent integration history records supported
operations without translation content or credentials.

Suspending the App or removing repository access revokes affected connections.
Restoring access does not automatically reconnect the project. Discover the
repository again and complete fresh verification before syncing.
If a feature is disabled, ask a platform super admin to check policy and deployment readiness.
Project admins cannot enable a globally disabled feature.
