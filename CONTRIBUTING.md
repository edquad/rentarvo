# Contributing to Rentarvo

We use a **branch + pull request** workflow. Do **not** push directly to `main`.

## Daily workflow

```bash
# 1. Start from latest main
git checkout main
git pull origin main

# 2. Create a feature branch
git checkout -b feature/your-change-name

# 3. Work, commit, push the branch
git add .
git commit -m "Describe your change"
git push -u origin feature/your-change-name

# 4. Open a pull request on GitHub (base: main)
gh pr create --base main --title "Your title" --body "What changed and why"

# 5. After review (or self-check), merge the PR on GitHub
#    Merging to main triggers deploy to Lightsail.
```

## Branch naming

| Prefix | Use for |
|--------|---------|
| `feature/` | New features |
| `fix/` | Bug fixes |
| `chore/` | Tooling, docs, config |

Examples: `feature/documents-gallery`, `fix/expense-pagination`, `chore/update-deps`

## Rules on `main`

- Direct pushes to `main` are **blocked**
- Changes must go through a **pull request**
- Use descriptive commit messages
- Keep PRs focused (one feature or fix when possible)

## Deploy

Production deploy runs when a PR is **merged** into `main` (not on branch pushes).

Live app: http://44.211.51.126

## Local setup

See [README.md](./README.md) for install and `pnpm dev`.
