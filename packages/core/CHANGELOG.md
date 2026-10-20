# @lingva/core

## 0.2.0

### Minor Changes

- 354b016: Add portable organization, membership, invitation, and SSO-mode contracts with organization invitation payload validation and retry-safe organization creation request IDs. Add organization administration action names, group and effective-access views, and optional organizationId on project records. Existing project creation payloads and tier limits remain compatible. Invitation assignments are bounded to 90 combined entries for atomic acceptance.
  Add organization audit, deletion, Generic OIDC security and CLI verification action selectors.

## 0.1.0

### Minor Changes

- Prepare the first coordinated public Lingva SDK release with framework adapters,
  public package metadata, installable artifacts, and npm provenance.
