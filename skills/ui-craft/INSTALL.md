# ui-craft skill — install guide

A Claude Code skill for implementing stunning, accessible, performant UI. Covers design engineering philosophy, accessibility, animation, spatial design, typography, color systems, and component craft.

## What's in this folder

```
skills/ui-craft/
├── SKILL.md                           # skill entry point (Claude loads this)
└── references/
    ├── accessibility-checklist.md
    ├── animation-playbook.md
    ├── component-patterns.md
    └── review-checklist.md
```

## Install (user-level — available in every project)

macOS / Linux:

```bash
mkdir -p ~/.claude/skills
cp -R skills/ui-craft ~/.claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force -Path "$HOME\.claude\skills" | Out-Null
Copy-Item -Recurse skills\ui-craft "$HOME\.claude\skills\"
```

## Install (project-level — only in one repo)

```bash
mkdir -p .claude/skills
cp -R skills/ui-craft .claude/skills/
```

## Verify it loaded

Open Claude Code in any project and run:

```
/help
```

You should see `ui-craft` in the available skills list. Trigger it by asking things like "build a landing page", "polish this UI", "create a component", or "make it beautiful".

## Direct download (no repo clone)

Grab the four files individually from this repo's `skills/ui-craft/` folder on GitHub and drop them into `~/.claude/skills/ui-craft/` preserving the `references/` subdirectory.
