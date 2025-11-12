# Linear API Notes

## Comment Parent Relationships

### Access Pattern

Linear SDK comments expose parent relationships via a direct property access pattern:

**Direct Property Access:**
```typescript
const parentId: string | undefined | null = comment.parentId
```

- **Type**: `Maybe<Scalars["String"]>` (equivalent to `string | undefined | null`)
- **Field**: `parentId` is a direct property on the Comment object
- **Access**: No async calls or function invocations required

### Type Definition

From `@linear/sdk` version 63.4.0, the Comment type includes:

```typescript
export type Comment = {
  // ... other fields
  /** The parent comment under which the current comment is nested. */
  parent?: Maybe<Comment>;
  /** The ID of the parent comment under which the current comment is nested. */
  parentId?: Maybe<Scalars["String"]>;
  // ... other fields
}
```

Both `parent` (full Comment object) and `parentId` (just the ID string) are available:
- `comment.parent` - Returns the full parent Comment object (if it exists)
- `comment.parentId` - Returns just the parent comment ID string (more efficient)

### Usage in Codebase

See `/Users/andrewhill/Coding/coding-arena/src/lib/linear-sync.ts` line 132 for the implementation:

```typescript
// Get parent ID if it exists
const parentId: string | undefined | null = comment.parentId
commentParents.set(commentId, parentId ?? null)
```

This parent relationship is used by `determineAgentOwnershipFromThread()` to walk up the comment thread chain and find the original agent mention, enabling thread-based PR attribution.

### Testing Verification

**Test Issue**: ENG-320
- **Linear ID**: `e7376814-a82e-48a4-bea7-55a263f88a09`
- **Identifier**: ENG-320

**Test Scenario**:
1. Parent comment (ID: `comment-1`): Contains `@engine` mention
2. Reply comment (ID: `comment-2`): Contains PR link `https://github.com/.../pull/1559`
3. Expected: PR #1559 attributed to "engine" agent only

**Verification Results**:
- `comment.parentId` successfully returns parent comment ID string
- Thread detection correctly walks parent chain to find `@engine` mention
- PR #1559 correctly attributed to "engine" agent
- No fallback to `guessAgent()` heuristics needed
- Database state verified: Only 1 attempt created (engine, PR #1559)

**Debug Script**: `/Users/andrewhill/Coding/coding-arena/scripts/debug-sync.ts`
- Lines 52-53: Tests direct `parentId` access
- Confirmed `comment.parentId` returns string value for threaded comments
- Confirmed `comment.parentId` returns `undefined` for top-level comments

### SDK Version

**Package**: `@linear/sdk`
**Version**: `^63.4.0`
**Installation**: `npm install @linear/sdk`

### Implementation Notes

1. **No GraphQL Query Required**: The `parentId` field is automatically included in SDK responses when fetching comments via `issue.comments()`. No custom GraphQL query or field selection needed.

2. **Type Safety**: TypeScript properly types `parentId` as optional, requiring null checks:
   ```typescript
   const parentId = comment.parentId ?? null
   ```

3. **Pagination**: When fetching comments with parent relationships, ensure you handle pagination to get all comments:
   ```typescript
   let commentsConnection = await issue.comments()
   while (commentsConnection.pageInfo.hasNextPage) {
     const nextComments = await issue.comments({
       after: commentsConnection.pageInfo.endCursor
     })
     // ... collect comments
   }
   ```

4. **Thread Walking**: The `determineAgentOwnershipFromThread()` function uses a `Set<string>` to track visited comments and prevent infinite loops in case of circular references (though Linear prevents these server-side).

### Related Files

- Implementation: `/Users/andrewhill/Coding/coding-arena/src/lib/linear-sync.ts`
- Debug script: `/Users/andrewhill/Coding/coding-arena/scripts/debug-sync.ts`
- Test scripts:
  - `/Users/andrewhill/Coding/coding-arena/scripts/add-eng320.ts`
  - `/Users/andrewhill/Coding/coding-arena/scripts/clear-eng320.ts`
  - `/Users/andrewhill/Coding/coding-arena/scripts/check-eng320-attempts.ts`

### Historical Context

This implementation was verified as part of fixing thread-based agent detection. Previous attempts tried various access patterns including:
- `await comment.parent` (async function call)
- `comment.parent?.id` (nested property)
- Custom GraphQL queries

The verified solution is the simplest: direct property access via `comment.parentId`.
