---
name: pre-push-check
description: Ensures code quality standards (linting, tests, build) are met before preparing a push to the remote repository.
---

# Pre-Push Check

Before committing or pushing any code to a shared branch or remote repository, run through this pre-push validation check to ensure code quality.

## Required Checks

Whenever you are preparing a branch for a push, you must perform the following actions:

1. **Lint and Format**:
   - Ensure the code complies with all linting rules in the project.
   - Run the linting command (e.g., `npm run lint` or `pnpm lint`).
   - Fix any auto-fixable issues using the formatter.

2. **Run Tests**:
   - Run the unit/integration test suite to ensure no regressions were introduced.
   - For example, run `npm test` or `npm run test`.
   - Ensure all tests pass.

3. **Verify Build**:
   - Ensure the project builds successfully.
   - Run the build command (e.g., `npm run build` or `pnpm build`).
   - Verify that there are no TypeScript compilation errors.

4. **Review Diff**:
   - Review the final diff before pushing to ensure no unwanted files (e.g., debug files, `node_modules`, `dist`, `.env` files) are staged.
   - Check that secrets are not accidentally included in the commit.

By adhering to this skill, the repository maintains a high bar for incoming code, reducing the likelihood of breaking the build or introducing bugs.
