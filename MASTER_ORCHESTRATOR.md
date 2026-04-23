# SKOLAR RECONSTRUCTION — MASTER SYSTEM
# Paste this entire file into Claude Code to start the full reconstruction.
# This is a multi-agent system. Claude Code will spawn sub-agents automatically.

You are the Master Orchestrator for the Skolar v2 reconstruction.
You have full access to the codebase, Supabase MCP, and file system.
Your job is to coordinate specialized sub-agents to research, document, and execute.

Read CLAUDE.md first. Then read active/execution/SPRINT1.md.
Then follow this system exactly.

---

## PHASE 0 — BOOT SEQUENCE (do this before anything else)

Run these checks sequentially:

1. Read CLAUDE.md — confirm you understand the project
2. Read active/execution/SPRINT1.md — confirm you know what Sprint 1 requires
3. Read active/config/DB_SCHEMA.md — confirm you know the DB structure
4. Read active/config/SECURITY.md — confirm you know the 4 security issues
5. Check if /public/logo.png exists
6. Check if .env.local has ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY filled in
7. Check if /active folder exists with all subfolders

Report boot status:
✅ READY — if all checks pass
⏸ BLOCKED — list exactly what is missing and ask the user for it

Do not proceed until boot status is ✅ READY.

---

## PHASE 1 — PARALLEL RESEARCH (spawn all agents simultaneously)

Use the Task tool to launch these 6 agents at the same time.
Each agent is independent and reports back to you when done.

### RESEARCH AGENT 1 — UI & Routes Auditor
```
Read every file in the app/ directory recursively.
For every page.tsx and layout.tsx found:
- What route does it serve
- What components does it import
- What Supabase tables does it query
- What is visually broken or incomplete
- Which Sprint 1 tasks affect this file

Return a structured report:
{
  route: string,
  file: string,
  tables: string[],
  broken: string[],
  sprint1_tasks: string[]
}[]
```

### RESEARCH AGENT 2 — Progress Bar & DB Specialist
```
1. Find every file that queries the 'exams' table
2. Find the subjects page — locate the progress bar component exactly
3. Find the line where progress is calculated — explain why it shows 0
4. Search for 'upcoming_exams' in the entire codebase
5. Search for these 4 function names: check_schedule_conflict, handle_task_done, 
   handle_new_user, set_updated_at — find their definitions
6. Find the subjects query that fetches data for the subject cards

Return: exact file paths + line numbers for every finding.
```

### RESEARCH AGENT 3 — AI System Specialist
```
1. Read lib/ai/tools.ts completely — list every tool and what it does
2. Read the Claude API route handler — find the system prompt construction
3. Find where AI chat messages are sent to Claude API
4. Find the subject chat pages — understand the per-subject context
5. Find subject_ai_contexts — confirm it is never written to
6. Identify exactly where to add:
   a. Image base64 passing to Claude API
   b. Voice input connection
   c. subject_ai_contexts write on chat start

Return: exact file + line for each of the 3 additions needed.
```

### RESEARCH AGENT 4 — Notes & Tiptap Specialist
```
1. Read every file related to the notes feature
2. Find the Tiptap editor component and its toolbar
3. Find the exact line in the toolbar where a mic button should be inserted
4. Find where note titles are set — locate the save function
5. Find why notes are saved as 'Untitled' — what condition allows it
6. Find where images are attached to notes (Supabase Storage upload)

Return: exact file paths + line numbers for mic button insertion + title fix.
```

### RESEARCH AGENT 5 — i18n & Assets Specialist
```
1. Read i18n/es.json completely
2. Read i18n/en.json completely
3. Compare both — list every key in es.json missing from en.json and vice versa
4. Scan the entire codebase for hardcoded strings (text not using t() or useTranslation)
5. Find the navbar/sidebar component — locate exact line where logo goes
6. Find app/layout.tsx — locate favicon and og:image metadata
7. Check if these files exist: /public/logo.png, /public/logo.svg, /public/favicon.ico

Return: missing i18n keys list + hardcoded strings with file+line + logo locations + missing assets.
```

### RESEARCH AGENT 6 — Stack & Dependencies Specialist
```
1. Read package.json completely
2. Verify claude-sonnet-4-5 is the model in the AI route
3. Check all Tiptap v3 extensions — are they all installed?
4. Verify Web Speech API is browser native (no package needed)
5. Check if any package is missing for Sprint 1 features
6. Read tsconfig.json — confirm strict mode is on
7. Check tailwind.config.ts — confirm CSS variables are defined

Return: exact npm install commands for anything missing + any config issues.
```

---

## PHASE 2 — MISSING ASSETS PROTOCOL

After all 6 agents complete, check what is missing.
For each missing item, pause and ask the user in this exact format:

```
⏸ WAITING FOR YOUR INPUT
━━━━━━━━━━━━━━━━━━━━━━━━
Asset needed : [name]
Used in      : [Sprint 1 task name]  
Why it blocks: [one sentence]
Action needed: [exactly what to do — upload file / paste value / confirm yes or no]
━━━━━━━━━━━━━━━━━━━━━━━━
```

Wait for user response before asking for next missing item.
Never skip. Never use a placeholder.

Known items to check:
- /public/logo.png or /public/logo.svg
- ANTHROPIC_API_KEY in .env.local
- SUPABASE_SERVICE_ROLE_KEY in .env.local

---

## PHASE 3 — REWRITE DOCUMENTATION

After research is complete and all assets collected,
spawn these documentation agents sequentially:

### DOC AGENT 1
```
Rewrite CLAUDE.md using everything found in the research phase.
Max 80 lines. Only permanent information.
Include real file paths found during research.
Include real DB schema confirmed from codebase queries.
```

### DOC AGENT 2
```
Rewrite active/execution/SPRINT1.md using exact file paths and line numbers
found by research agents 1-6.
Every task must include: exact file to modify + exact line range + exact change needed.
```

### DOC AGENT 3
```
Rewrite active/execution/PROMPTS.md.
One prompt per Sprint 1 task.
Each prompt must be 100% self-contained — include file path, line number, 
exact code pattern to look for, and exact change to make.
A new Claude Code session with zero context should be able to execute 
each prompt successfully using only that prompt + CLAUDE.md.
```

---

## PHASE 4 — EXECUTE SPRINT 1

After documentation is complete, execute tasks one at a time.
Each task is a separate agent. Wait for completion before starting next.

### EXECUTION ORDER

**Task 1 — Security fixes (no code, just SQL)**
```
Execute all 4 security fixes from active/config/SECURITY.md.
Run the SQL for upcoming_exams view fix.
Run the SQL for all 4 vulnerable functions.
Report the exact SQL run and confirm success.
Note: avatars bucket and password protection require dashboard — report these to user.
```

**Task 2 — Fix progress bars**
```
Read the exact file and line identified by Research Agent 2.
Implement: SUM(grade * percentage / 100) from exams 
WHERE submission_status = 'graded' AND grade IS NOT NULL AND subject_id = [id]
Display as X.X / 20.0
If no graded exams: show 0.0 / 20.0
Test: verify the query returns correct data structure.
```

**Task 3 — Fix Untitled notes**
```
Read the exact file and line identified by Research Agent 4.
Implement auto-title logic:
1. Try first H1/H2/H3 heading from Tiptap content
2. Else try first 50 chars of plain text
3. Else use: "Nota — [formatted current date]"
Apply on every save, not just creation.
```

**Task 4 — Integrate logo**
```
Only run this task if /public/logo.png exists (confirmed in Phase 2).
Read exact locations identified by Research Agent 5.
Add logo to: navbar, login, register, favicon, og:image.
Use next/image everywhere. Max height 32px in navbar, max width 140px on auth pages.
```

**Task 5 — Voice in Notes**
```
Read exact toolbar location identified by Research Agent 4.
Add mic button at end of Tiptap toolbar.
Web Speech API: recognition.lang = 'es-ES', continuous = false
On result: editor.chain().focus().insertContent(transcript).run()
Visual: red pulsing dot while recording.
Graceful fallback if browser doesn't support it.
```

**Task 6 — Voice for AI agent**
```
Read exact chat input location identified by Research Agent 3.
Add mic button next to input field.
Web Speech API: same config as notes.
On result: populate input field — do NOT auto-send.
Works in both global chat and subject chats.
```

**Task 7 — Image analysis in AI chat**
```
Read exact locations identified by Research Agent 3.
Frontend: add image attach button, show preview thumbnail.
On send: convert to base64, build content array:
[{type:'image', source:{type:'base64', media_type:'image/jpeg', data: base64}}, 
 {type:'text', text: userMessage}]
API route: pass content array directly to Claude API messages.
Works in both global and subject chats.
```

**Task 8 — Activate subject_ai_contexts**
```
Read exact locations identified by Research Agent 3.
On subject chat start:
1. Check subject_ai_contexts for user+subject — if older than 24h or missing:
2. Fetch: last 5 notes (title + 200 chars), next 3 exams, current progress
3. Format into summary string
4. Upsert to subject_ai_contexts
5. Include summary in system prompt
```

---

## PHASE 5 — FINAL REPORT

After all execution tasks complete:

```
## Sprint 1 Complete ✅

### What was done
| Task | Status | Files changed |
|---|---|---|
[fill in each task]

### Manual actions still needed
[list anything requiring Supabase dashboard clicks]

### Confirmed working
[list what to test in the browser to verify each task]

### Ready for Sprint 2?
[Yes/No — and what needs to happen first]
```

---

## RULES FOR ALL AGENTS

1. Research agents NEVER modify source files
2. Execution agents modify ONE file at a time, then verify
3. If any agent fails: stop, report the exact error, ask user how to proceed
4. Never assume a file path — always verify it exists first
5. Never skip the missing assets check
6. Always read the relevant active/ doc before executing a task
7. One execution task at a time — never run two simultaneously
8. After each execution task: report what changed before moving to next
