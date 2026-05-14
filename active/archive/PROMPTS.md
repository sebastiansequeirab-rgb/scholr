# Prompts — Sprint 1
Copy and paste one at a time into Claude Code.

---

## 1. Fix progress bars
```
Find the subjects page and locate the progress bar component.
Find the query that fetches exam data per subject.

Fix the progress bar to show the real weighted grade:
Formula: SUM(grade * percentage / 100) from the exams table
WHERE submission_status = 'graded' AND grade IS NOT NULL AND subject_id = [id]

Display as "X.X / 20.0". If no graded exams: show "0.0 / 20.0".
Do not change anything else.
```

---

## 2. Integrate logo
```
I have placed my logo at /public/logo.png.
Integrate it in:
1. Sidebar/navbar — replace current logo with next/image. Max height 32px.
2. Login page — centered above the form. Max width 140px.
3. Register page — same as login.
4. Favicon and og:image — update app/layout.tsx metadata.
Use next/image everywhere. Do not change other styling.
```

---

## 3. Voice in Notes
```
Find the Tiptap toolbar in the notes feature.
Add a microphone button at the end of the toolbar.

On click:
- Activate Web Speech API (SpeechRecognition or webkitSpeechRecognition)
- recognition.lang = 'es-ES'
- recognition.continuous = false
- On result: editor.chain().focus().insertContent(transcript).run()
- Show red pulsing dot while recording

Add fallback message if browser doesn't support Web Speech API.
Do not change anything else in the editor.
```

---

## 4. Voice for AI agent
```
Find the AI chat input component.
Add a microphone button next to the text input.

On click:
- Activate Web Speech API
- recognition.lang = 'es-ES'
- On result: populate the input field with transcribed text
- Do NOT auto-send — user confirms manually
- Show pulsing indicator while recording

Works in both global chat and per-subject chats.
```

---

## 5. Image analysis in AI chat
```
Find the AI chat input component and the API route that calls the AI.

The current AI model is Groq llama-3.3-70b using GROQ_API_KEY.
Build this migration-ready — use a config flag AI_PROVIDER='groq'|'claude'.

Step 1 — Frontend:
Add image attach button (clip icon). Accept jpeg/png/webp only.
Show thumbnail preview. Store file in state.

Step 2 — On send with image:
Convert to base64. Build content based on provider:

// Groq (current)
content: [
  { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
  { type: 'text', text: userMessage }
]

// Claude (future — leave ready in code behind the flag)
content: [
  { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
  { type: 'text', text: userMessage }
]

Step 3 — API route: accept content array, pass to AI provider.
Works in global and subject chats.
```

---

## 6. Fix Untitled notes
```
Find where note titles are saved to the database.
Find the condition that allows a note to be saved with an empty or 'Untitled' title.

Fix: before saving, if title is empty or 'Untitled':
1. Extract first H1/H2/H3 heading from Tiptap content
2. If none: take first 50 characters of plain text
3. If empty: use "Nota — [formatted current date in es-ES locale]"

Apply on every save. Do not change anything else.
```

---

## 7. Activate subject_ai_contexts
```
Find where subject AI chat sessions are initialized.
Find the system prompt construction for subject chats.

When a subject chat starts:
1. Check subject_ai_contexts for this user + subject
2. If missing or older than 24 hours:
   a. Fetch last 5 notes for this subject (title + first 200 chars)
   b. Fetch next 3 upcoming exams (title, date, percentage)
   c. Calculate current progress (same formula as progress bars)
   d. Format as summary string
   e. Upsert to subject_ai_contexts
3. Include summary in system prompt:
   "Academic context for [subject name]: [summary]"
```

---

## 8. Security fixes
```
Run these SQL statements in the Supabase SQL editor.
Read active/config/SECURITY.md for the complete SQL.
Execute them in this order:
1. Fix upcoming_exams view (drop and recreate without SECURITY DEFINER)
2. Fix the 4 vulnerable functions (add SET search_path = public to each)
3. Fix avatars bucket policy

After running all SQL, go to:
Supabase Dashboard → Authentication → Sign In / Up → Password Strength → Enable leaked password protection.

Report which fixes were applied via SQL and which required the dashboard.
```
