# Agent Instructions

You're working inside the **Skolar framework**. This architecture separates concerns so that product direction defines how the app should feel, the existing system provides the working foundation, modules define where decisions apply, and the codebase handles execution. That separation is what keeps the product coherent while it evolves.

## The Skolar Architecture

**Layer 1: Product Direction (The Instructions)**
- The product direction defines how Skolar should feel and behave
- Skolar must feel premium, youthful but serious, Apple-like without being a copy, academic, aspirational, clean, modern, and trustworthy
- This direction exists to keep decisions coherent across the app instead of solving each screen in isolation
- Written as system-level guidance, the same way you'd define standards for a product team

**Layer 2: Existing System (The Foundation)**
- This is the current Skolar app already implemented in the project folder
- It already contains working flows, screens, components, logic, styling patterns, and product decisions
- This is not a greenfield build
- Your role is to understand what already exists before changing it, preserve what is working, and improve weak areas without causing regressions
- Example: If the Calendar needs improvement, don't casually rebuild it from scratch. First inspect the current structure, then decide whether the right move is a correction, refinement, extension, or selective replacement

**Layer 3: Modules (The Decision Surface)**
- Home, Calendar, Subjects, Tasks, Exams, Notes, and other app areas are the modules where product decisions get applied
- Each module has a job, a user expectation, and a visual and functional standard
- You connect product direction to implementation by improving these modules in ways that remain native to Skolar as a whole
- Example: If Home needs stronger hierarchy, solve it in a way that still feels consistent with Calendar, Subjects, and the rest of the app

**Layer 4: Codebase and Deployment (The Execution)**
- The codebase does the actual execution: UI, state, interactions, responsiveness, validation, logic, AI integrations, and persistence
- The project is already published on GitHub and deployed on Vercel
- The app is not being built from zero. It already has a base structure and implementation history
- Changes must be made over the current system, then published and deployed properly
- ESLint, build integrity, and production stability matter. Broken syntax, unused imports, fragile logic, and careless regressions are not acceptable

**Why this matters:** When AI treats an existing product like a blank slate, quality drops fast. A local improvement can easily become a system-level regression. By separating product direction, the existing foundation, module-level decisions, and code execution, you stay focused on improving the live product without breaking its coherence.

## How to Operate

**1. Look for the existing system first**
Before building anything new, inspect the current implementation in the relevant part of the app. Reuse, refine, or extend what already exists when possible. Only create a new pattern, flow, or structure when the current system clearly does not support the task well enough.

**2. Learn and adapt when things fail**
When you hit an issue:
- Read the full problem carefully, whether it is visual, functional, structural, or technical
- Fix the implementation and verify the result works
- If the failure reveals a recurring weakness, preserve that learning in the product direction or implementation approach
- Example: A mobile calendar layout technically works but becomes hard to read in practice, so you don't just patch spacing. You redesign the event density and hierarchy, verify the result on the affected surfaces, and preserve that improved standard moving forward

**3. Keep the system direction current**
The Skolar framework should evolve as you learn. When you find better interaction patterns, stronger visual standards, repeated UX issues, or recurring implementation mistakes, update the system direction accordingly. That said, don't casually overwrite core direction. These are the app's operating standards and should be preserved and refined, not replaced impulsively.

## The Self-Improvement Loop

Every failure is a chance to make the product stronger:
1. Identify what is weak, broken, confusing, or inconsistent
2. Fix the implementation
3. Verify the fix works in context
4. Preserve the improved approach as part of the system standard
5. Move on with a stronger product

This loop is how Skolar improves over time.

## File Structure

**What goes where:**
- **Source of truth**: The project folder contains the working Skolar app and its implementation base
- **Production**: GitHub stores the project history and Vercel hosts the deployed product
- **Configuration**: Local environment configuration lives in `.env.local`; hosted environment variables live in the Vercel Dashboard

**Project realities:**
- The app already exists and is live
- The current stage is testing, analysis, improvements, corrections, refinements, and selective feature expansion
- New functions can be created, but only when they fit the product and genuinely improve the system
- Local work is not enough. Meaningful changes must be published and deployed properly so the live product stays current

**Core principle:** This is not a scratch build. Treat Skolar as an existing production system. Study what is already there, improve it deliberately, preserve working behavior when possible, and only introduce deeper changes when they are clearly justified.

## Product Direction

Skolar should feel:
- premium
- youthful but serious
- Apple-like without being a copy
- academic
- aspirational
- clean
- modern
- trustworthy

**Avoid:**
- generic dark dashboards
- empty space without intention
- heavy or clumsy blocks
- cross-screen inconsistencies
- UI that feels like a demo
- flashy decisions that reduce clarity
- unnecessary rewrites
- complexity that does not create real value

**Seek:**
- obsessive refinement
- strong visual hierarchy
- elegant microinteractions
- excellent navigation
- clear consistency across modules
- balance between beauty and utility
- a product that feels intentionally designed in every state

## Working Standards

**Visual system**
- Layout should use space intentionally and never feel cramped or wasteful
- Typography should create strong hierarchy and maintain excellent readability
- Cards should feel premium, separated from the background, and visually coherent
- Color should support understanding, not just decoration
- Motion should be brief, intentional, and satisfying without slowing the interface down

**Module standards**
- Home should create an immediate sense of clarity and usefulness
- Calendar should feel like a serious planning tool with maximum legibility
- Subjects should feel structured, premium, and easy to understand at a glance
- Tasks should feel fast, fluid, and reliable
- Exams should communicate urgency, timing, and preparation clearly
- Notes and supporting tools should feel integrated into the same product language

**Decision priority**
1. clarity of use
2. consistency of the system
3. premium aesthetic quality
4. microinteraction and delight
5. extra technical complexity only if it adds clear value

## Bottom Line

You sit between Skolar’s direction and Skolar’s implementation. Your job is to understand the current system, make smart product decisions, improve the right modules, fix problems cleanly, publish changes responsibly, and keep strengthening the product as you go.

Stay coherent. Stay pragmatic. Improve the live system without breaking it.