# Handle Deleted PR 404 Errors in Reconciliation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix reconciliation crashes when GitHub PRs return 404 (deleted/not found) by handling these gracefully and marking PRs as closed.

**Architecture:** The `syncPRStatusFromGitHub` function in `src/lib/linear-reconcile.ts` currently throws unhandled errors when GitHub API returns 404 for deleted PRs. We'll add specific 404 error handling to mark these PRs as closed and continue reconciliation without errors.

**Tech Stack:** TypeScript, Octokit (GitHub API), Drizzle ORM, Vitest

---

### Task 1: Add test for 404 PR handling

**Files:**
- Modify: `src/lib/linear-reconcile.test.ts`

**Step 1: Write failing test for 404 PR not found**

Add this test at the end of the `describe('reconcileLinearIssues')` block (before the closing brace):

```typescript
it('should handle 404 errors for deleted PRs gracefully', async () => {
  const mockIssue = createMockLinearIssue({
    id: 'linear-with-deleted-pr',
    identifier: 'ENG-404',
  })

  const mockIssues = vi.fn().mockResolvedValue({ nodes: [mockIssue] })
  const mockClient = { issues: mockIssues }

  vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

  // Mock db.insert chain
  const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
  const mockValues = vi.fn().mockReturnValue({
    onConflictDoUpdate: mockOnConflictDoUpdate,
  })
  vi.mocked(db.insert).mockReturnValue({
    values: mockValues,
  } as never)

  // Mock db.select for getting issue ID after insert
  const mockLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
  const mockWhere = vi.fn().mockReturnValue({
    limit: mockLimit,
  })
  const mockFrom = vi.fn().mockReturnValue({
    where: mockWhere,
  })
  const mockSelect = vi.fn().mockReturnValue({
    from: mockFrom,
  })
  vi.mocked(db).select = mockSelect as never

  // Mock db.select for getting attempts (empty for this test)
  const mockAttemptsWhere = vi.fn().mockResolvedValue([
    {
      id: 'attempt-1',
      repo: 'recallnet/air-coding-arena',
      prNumber: 9,
      status: 'open',
      mergedAt: null,
      closedAt: null,
    },
  ])
  vi.mocked(db).select = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: mockAttemptsWhere,
    }),
  }) as never

  // Mock db.update chain for both PR status update and deletion marking
  const mockUpdateWhere = vi.fn().mockResolvedValue(undefined)
  const mockSet = vi.fn().mockReturnValue({
    where: mockUpdateWhere,
  })
  vi.mocked(db.update).mockReturnValue({
    set: mockSet,
  } as never)

  // Mock db.query.issues.findFirst for winner check
  vi.mocked(db).query = {
    issues: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  } as never

  // Mock GitHub API to return 404 error
  process.env['GITHUB_TOKEN'] = 'test-token'

  // Need to mock Octokit globally
  const { Octokit } = await import('@octokit/rest')
  const mockGet = vi.fn().mockRejectedValue({
    status: 404,
    message: 'Not Found',
    name: 'HttpError',
  })
  vi.mocked(Octokit).mockImplementation(
    () =>
      ({
        rest: {
          pulls: {
            get: mockGet,
          },
        },
      }) as never
  )

  const count = await reconcileLinearIssues()

  // Should complete successfully despite 404
  expect(count).toBe(1)

  // Should have attempted to update the PR status to 'closed'
  expect(mockSet).toHaveBeenCalledWith({
    status: 'closed',
    closedAt: expect.any(Date),
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/linear-reconcile.test.ts`
Expected: Test fails because 404 handling not implemented

**Step 3: Add Octokit to vi.mock at top of test file**

Add Octokit mock to existing mocks at the top of the file (around line 16):

```typescript
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(),
}))
```

**Step 4: Run test again**

Run: `npm test -- src/lib/linear-reconcile.test.ts`
Expected: Still fails but with proper mocking

**Step 5: Commit test**

```bash
git add src/lib/linear-reconcile.test.ts
git commit -m "test: add test for handling 404 deleted PR errors"
```

---

### Task 2: Implement 404 error handling

**Files:**
- Modify: `src/lib/linear-reconcile.ts:175-230`

**Step 1: Update error handling in syncPRStatusFromGitHub**

Replace the catch block (lines 224-230) with specific 404 handling:

```typescript
    } catch (error) {
      // Check if this is a 404 error (PR deleted or not found)
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        error.status === 404
      ) {
        // PR has been deleted from GitHub - mark as closed
        console.warn(
          `[Reconcile] PR ${attempt.repo}#${attempt.prNumber} not found on GitHub (deleted) - marking as closed`
        )

        await db
          .update(attempts)
          .set({
            status: 'closed',
            closedAt: new Date(),
          })
          .where(eq(attempts.id, attempt.id))

        continue
      }

      // Log but continue - don't fail reconciliation if GitHub API errors
      console.error(
        `[Reconcile] Failed to sync PR status for ${attempt.repo}#${attempt.prNumber}:`,
        error
      )
    }
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- src/lib/linear-reconcile.test.ts`
Expected: All tests pass

**Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass with >90% coverage

**Step 4: Commit implementation**

```bash
git add src/lib/linear-reconcile.ts
git commit -m "feat: handle 404 errors for deleted PRs in reconciliation

Mark PRs as closed when GitHub API returns 404 (PR deleted or not found).
This prevents reconciliation from failing when PRs are removed from GitHub."
```

---

### Task 3: Add integration-style test for complete flow

**Files:**
- Modify: `src/lib/linear-reconcile.test.ts`

**Step 1: Write test for multiple attempts with mixed 404s**

Add this test after the previous 404 test:

```typescript
it('should handle mixed success and 404 errors for multiple PRs', async () => {
  const mockIssue = createMockLinearIssue({
    id: 'linear-mixed-prs',
    identifier: 'ENG-MIX',
  })

  const mockIssues = vi.fn().mockResolvedValue({ nodes: [mockIssue] })
  const mockClient = { issues: mockIssues }

  vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

  // Mock db.insert chain
  const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
  const mockValues = vi.fn().mockReturnValue({
    onConflictDoUpdate: mockOnConflictDoUpdate,
  })
  vi.mocked(db.insert).mockReturnValue({
    values: mockValues,
  } as never)

  // Mock db.select for getting issue ID
  const mockLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
  const mockWhere = vi.fn().mockReturnValue({
    limit: mockLimit,
  })
  const mockFrom = vi.fn().mockReturnValue({
    where: mockWhere,
  })
  const mockSelect = vi.fn().mockReturnValue({
    from: mockFrom,
  })
  vi.mocked(db).select = mockSelect as never

  // Mock db.select for getting attempts - 3 PRs (1 exists, 2 deleted)
  const mockAttemptsWhere = vi.fn().mockResolvedValue([
    {
      id: 'attempt-1',
      repo: 'recallnet/test-repo',
      prNumber: 100,
      status: 'open',
      mergedAt: null,
      closedAt: null,
    },
    {
      id: 'attempt-2',
      repo: 'recallnet/test-repo',
      prNumber: 8,
      status: 'open',
      mergedAt: null,
      closedAt: null,
    },
    {
      id: 'attempt-3',
      repo: 'recallnet/test-repo',
      prNumber: 9,
      status: 'open',
      mergedAt: null,
      closedAt: null,
    },
  ])
  vi.mocked(db).select = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: mockAttemptsWhere,
    }),
  }) as never

  // Mock db.update for PR status changes
  const mockUpdateWhere = vi.fn().mockResolvedValue(undefined)
  const mockSet = vi.fn().mockReturnValue({
    where: mockUpdateWhere,
  })
  vi.mocked(db.update).mockReturnValue({
    set: mockSet,
  } as never)

  // Mock db.query.issues.findFirst
  vi.mocked(db).query = {
    issues: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  } as never

  // Mock GitHub API - PR 100 exists, 8 and 9 are 404
  process.env['GITHUB_TOKEN'] = 'test-token'
  const { Octokit } = await import('@octokit/rest')
  const mockGet = vi
    .fn()
    .mockResolvedValueOnce({
      data: {
        merged: false,
        state: 'open',
        merged_at: null,
        closed_at: null,
      },
    })
    .mockRejectedValueOnce({
      status: 404,
      message: 'Not Found',
      name: 'HttpError',
    })
    .mockRejectedValueOnce({
      status: 404,
      message: 'Not Found',
      name: 'HttpError',
    })

  vi.mocked(Octokit).mockImplementation(
    () =>
      ({
        rest: {
          pulls: {
            get: mockGet,
          },
        },
      }) as never
  )

  const count = await reconcileLinearIssues()

  // Should complete successfully
  expect(count).toBe(1)

  // Should have called GitHub API 3 times
  expect(mockGet).toHaveBeenCalledTimes(3)

  // Should have marked the two 404 PRs as closed
  expect(mockSet).toHaveBeenCalledWith({
    status: 'closed',
    closedAt: expect.any(Date),
  })
  expect(mockSet).toHaveBeenCalledTimes(2) // Two 404s
})
```

**Step 2: Run test to verify it passes**

Run: `npm test -- src/lib/linear-reconcile.test.ts`
Expected: Test passes with implementation from Task 2

**Step 3: Commit test**

```bash
git add src/lib/linear-reconcile.test.ts
git commit -m "test: add integration test for mixed PR statuses with 404s"
```

---

### Task 4: Verify and push

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Check code coverage**

Run: `npm test -- --coverage`
Expected: Coverage >90% for all metrics

**Step 3: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 4: Format code**

Run: `npm run format`
Expected: All files formatted

**Step 5: Verify in development**

Run: `npm run dev` and trigger reconciliation
Expected: No 404 errors in console, deleted PRs marked as closed

**Step 6: Push to main**

```bash
git push origin main
```

---

## Testing Strategy

1. **Unit tests** verify 404 error detection and database updates
2. **Integration tests** verify mixed scenarios with multiple PRs
3. **Manual testing** confirms reconciliation runs without errors

## Success Criteria

- ✅ Reconciliation completes without throwing 404 errors
- ✅ Deleted PRs are marked as 'closed' with closedAt timestamp
- ✅ Valid PRs continue to sync normally
- ✅ Error messages are logged as warnings, not errors
- ✅ All tests pass with >90% coverage
