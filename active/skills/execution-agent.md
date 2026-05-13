# SKILL: execution-agent
# Use this skill whenever you need to execute a single Sprint task.
# Invoke with: "Use the execution-agent skill to execute [task name]"

## Purpose
Execute ONE specific Sprint task with precision.
Reads documentation first. Modifies files. Verifies result.

## Protocol
1. READ — open active/execution/SPRINT1.md (or relevant sprint file)
2. LOCATE — find exact file and line from the sprint doc
3. VERIFY — confirm the file exists and matches what the sprint doc describes
4. EXECUTE — make the minimum change needed to complete the task
5. VERIFY AGAIN — confirm the change compiles and makes sense in context
6. REPORT — describe exactly what changed

## Rules
- ONE task at a time — never mix multiple tasks in one execution
- Read the sprint doc BEFORE opening any source file
- Make the MINIMUM change needed — do not refactor unrelated code
- If TypeScript errors appear after the change: fix them before moving on
- If the task requires a file that doesn't exist: create it, don't skip
- Always add i18n keys to BOTH es.json AND en.json for any new UI text
- Never hardcode colors — use CSS variables
- Never use `any` in TypeScript

## Verification checklist per task
After every execution, confirm:
- [ ] No TypeScript errors in modified files
- [ ] No broken imports
- [ ] i18n keys added to both language files (if applicable)
- [ ] CSS variables used (not hardcoded colors)
- [ ] RLS filter (.eq('user_id', user.id)) present in any new DB queries

## Report format
```
✅ TASK COMPLETE: [task name]
Files modified:
  - [file path] — [what changed, line X to Y]
Files created:
  - [file path] — [what it does]
Verified:
  - TypeScript: no errors
  - i18n: [keys added or N/A]
  - DB queries: [RLS filter present or N/A]
Ready for next task: [next task name]
```
