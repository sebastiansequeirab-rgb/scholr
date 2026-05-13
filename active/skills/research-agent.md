# SKILL: research-agent
# Use this skill whenever you need to investigate a specific part of the Skolar codebase.
# Invoke with: "Use the research-agent skill to investigate [topic]"

## Purpose
Deep-dive investigation of a specific codebase area.
Returns structured findings with exact file paths and line numbers.
Never modifies files — read only.

## Protocol
1. Identify scope — what exactly needs to be investigated
2. Read all relevant files completely before forming conclusions
3. Cross-reference findings across multiple files
4. Return structured JSON report with:
   - file: exact path
   - line: exact line number or range
   - finding: what was found
   - action_needed: what Sprint task this affects

## Output format
```json
{
  "scope": "what was investigated",
  "findings": [
    {
      "file": "src/features/student/subjects/SubjectCard.tsx",
      "line": "45-67",
      "finding": "Progress bar reads from subject.progress field which is never calculated",
      "action_needed": "Sprint 1 — Fix progress bars"
    }
  ],
  "missing_assets": ["list anything not found that is needed"],
  "recommended_fix_order": ["ordered list of what to fix first"]
}
```

## Rules
- Never modify files
- Never assume — verify every file path exists before referencing it
- If something is unclear, note it as UNKNOWN rather than guessing
- Always check both the component AND the data source (hook/query)
