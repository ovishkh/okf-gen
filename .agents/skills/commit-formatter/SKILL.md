---
name: commit-formatter
description: Enforces Conventional Commits and descriptive commit messages for better coding push history.
---

# Commit Formatter

When making a commit or preparing for a push, follow these guidelines to ensure the commit history remains clean, readable, and meaningful.

## Rules

1. **Use Conventional Commits**: All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification.
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `style:` for formatting, missing semi colons, etc
   - `refactor:` for refactoring production code
   - `test:` for adding missing tests, refactoring tests
   - `chore:` for updating build tasks, package manager configs, etc

2. **Commit Message Subject Line**:
   - Limit the subject line to 50 characters.
   - Capitalize the subject line.
   - Do not end the subject line with a period.
   - Use the imperative mood in the subject line (e.g., "Add feature" not "Added feature").

3. **Commit Message Body**:
   - Wrap the body at 72 characters.
   - Use the body to explain what and why vs. how.

## Example

```text
feat: Add interactive mode for okf bundle generation

This introduces a new CLI mode that prompts the user for 
all necessary inputs (source paths, URLs, outputs) if they 
prefer not to use command-line flags. 
```
