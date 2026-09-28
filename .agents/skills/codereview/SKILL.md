---
name: codereview
description: >-
  Review uncommitted code changes, run tests, and verify feature scope
  before committing to ensure strict compliance with project standards.
---

# Code Review Skill

When the user invokes `/codereview`, you must act as a strict, senior CodeRabbit reviewer for the Sonder SNS project. Your goal is to review uncommitted changes (or changes in the current branch), ensure all tests pass, and verify the feature is fully implemented according to the scope.

## Workflow

1. **Understand the Scope**: Ask the user what issue or feature they are working on if it's not immediately obvious from the current branch name or context.
2. **Review the Code**: 
   - Check the uncommitted changes using `git diff` or `git status`.
   - Verify compliance against the rules defined in `AGENTS.md` and `GEMINI.md`.
   - Ensure the new database schemas, caching rules, and configuration patterns (`getConfig()`) are strictly followed.
   - Look out for accessibility issues, missing loading states, and "zero-pill" violations in frontend code.
3. **Run Tests**: 
   - Identify the relevant test files affected by the changes.
   - Execute the tests using `pnpm vitest run <path-to-test>` (for backend) or standard `pnpm test` for the suite.
   - Wait for the tests to complete. Do not approve the code if tests fail.
4. **Deliver Feedback**:
   - Create an artifact summarizing your review.
   - If the code requires changes, detail them explicitly with code snippets.
   - If the feature misses parts of the original scope, point them out.
   - If everything is perfect and tests pass, give the user the green light to commit and push!
