---
name: code-review-self
description: Guidelines for conducting a comprehensive self-review of code before opening a PR or pushing to a remote branch.
---

# Code Review (Self)

Before pushing your changes, act as your own code reviewer. Perform a final pass on the diffs you are about to push to catch common mistakes and improve code quality.

## Checklist

1. **Self-Review the Diff**:
   - Read through the entire git diff. Does every change make sense?
   - Are there any leftover `console.log`, `debugger`, or commented-out code blocks?
   - Ensure you haven't accidentally modified files that shouldn't be touched.

2. **Refactoring and Cleanliness**:
   - Are the variable and function names descriptive?
   - Can any overly complex logic be simplified or broken into smaller functions?
   - Is there any code duplication that could be abstracted?

3. **Comments and Documentation**:
   - Have you updated the documentation (e.g., `README.md`, `JSDoc` comments) to reflect your changes?
   - Are the comments explaining the "why" and not just the "what"?

4. **Security and Performance**:
   - Did you introduce any potential security vulnerabilities (e.g., exposing sensitive keys, injection vulnerabilities)?
   - Are there any obvious performance bottlenecks?

By doing a thorough self-review, you ensure that the code pushed to the repository is clean, documented, and ready for a smooth peer review process.
