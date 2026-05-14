# Pre-commit Auto-Fix Demo

This file demonstrates what the pre-commit hooks will auto-fix.

## Auto-Fixed Issues

### Backend (Python)

**Ruff Linter** - Auto-fixes:
- Import sorting
- Unused imports
- Modern syntax (e.g., `isinstance(x, int | float)` instead of `isinstance(x, (int, float))`)
- Code style issues
- And many more...

**Ruff Formatter** - Auto-fixes:
- Line length
- Indentation
- Spacing
- Quote style consistency

### Frontend (TypeScript/JavaScript)

**ESLint** - Auto-fixes:
- Import sorting
- Unused variables (if configured)
- Spacing and formatting issues
- Code style violations

### General

**Whitespace Hooks** - Auto-fix:
- Trailing whitespace
- Missing newline at end of file
- Mixed line endings (CRLF vs LF)

## What Won't Auto-Fix

These require manual intervention:
- **Type errors** (mypy, TypeScript)
- **Logic errors**
- **Breaking syntax errors**
- **Merge conflicts**

## Testing Auto-Fix

1. Make a change with style issues (e.g., add trailing spaces, wrong isinstance syntax)
2. Stage the file: `git add <file>`
3. Try to commit: `git commit -m "test"`
4. Pre-commit will auto-fix what it can
5. Re-add the auto-fixed files: `git add <file>`
6. Commit again: `git commit -m "test"`

The commit will succeed if all issues are auto-fixable, or fail with clear errors if manual fixes are needed.
