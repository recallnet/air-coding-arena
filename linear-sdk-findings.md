# Linear SDK Comment Type Findings

## SDK Version

- Package: `@linear/sdk`
- Version: `63.4.0`

## Summary

The `parentId` field is a valid, documented field in the Linear SDK's Comment type. It represents the ID of the parent comment under which the current comment is nested, enabling threaded comment functionality.

## Type Definitions

### 1. Comment Class (Runtime - `_generated_sdk.d.ts`)

The `Comment` class extends `Request` and provides the runtime interface:

```typescript
export declare class Comment extends Request {
  constructor(request: LinearRequest, data: L.CommentFragment)

  /** The unique identifier of the entity. */
  id: string

  /** The comment content in markdown format. */
  body: string

  /** The ID of the parent comment under which the current comment is nested. */
  parentId?: string

  /** The parent comment under which the current comment is nested. */
  get parent(): LinearFetch<Comment> | undefined

  // ... other fields
}
```

**Key points:**

- `parentId` is typed as `parentId?: string` (optional string)
- The class also provides a `parent` getter that returns `LinearFetch<Comment> | undefined`
- This allows both direct ID access and lazy-loading of the full parent Comment object

### 2. Comment GraphQL Type (`_generated_documents.d.ts`)

The underlying GraphQL type definition:

```typescript
export declare type Comment = Node & {
  __typename?: 'Comment'

  /** The ID of the issue that the comment is associated with. */
  issueId?: Maybe<Scalars['String']>

  /** The parent comment under which the current comment is nested. */
  parent?: Maybe<Comment>

  /** The ID of the parent comment under which the current comment is nested. */
  parentId?: Maybe<Scalars['String']>

  // ... other fields
}
```

**Key points:**

- `parentId` is typed as `Maybe<Scalars["String"]>` which resolves to `string | null | undefined`
- Both `parent` (the full object) and `parentId` (just the ID) are available
- The field is properly documented in the GraphQL schema

### 3. CommentFragment Type

The fragment used to construct Comment instances:

```typescript
export declare type CommentFragment = {
  __typename: 'Comment'
} & Pick<
  Comment,
  | 'url'
  | 'reactionData'
  | 'resolvingCommentId'
  | 'documentContentId'
  | 'initiativeUpdateId'
  | 'issueId'
  | 'parentId'
  | 'projectUpdateId'
  | 'body'
  | 'updatedAt'
  | 'quotedText'
  | 'archivedAt'
  | 'createdAt'
  | 'resolvedAt'
  | 'editedAt'
  | 'id'
> & {
    // ... nested objects
  }
```

**Key points:**

- `parentId` is explicitly included in the Pick type
- This confirms it's part of the core Comment data structure returned by the API

## How to Use in Our Code

### Direct Property Access (Recommended)

```typescript
import { Comment } from '@linear/sdk'

const comment: Comment = await linearClient.comment(commentId)

// Access parentId directly as a property
const parentId: string | undefined = comment.parentId

if (parentId) {
  console.log(`Comment has parent: ${parentId}`)
}
```

### Type Safety

```typescript
// TypeScript will correctly recognize parentId as string | undefined
function processComment(comment: Comment) {
  // Type guard ensures safe access
  if (comment.parentId) {
    // Inside this block, TypeScript knows parentId is string
    const id: string = comment.parentId
  }
}
```

### Lazy Loading Parent Comment

```typescript
// If you need the full parent Comment object
const parentComment = await comment.parent

if (parentComment) {
  console.log(`Parent comment body: ${parentComment.body}`)
}
```

## Verification from Real Data

From Task 1 context, we confirmed that `parentId` appears in real Linear API responses:

```
ParentId: 5310cbcc-304a-4830-beef-c9188e7a39ff
```

This validates that:

1. The field exists in the API
2. It's accessible as a direct property
3. The SDK types correctly represent the API response

## Conclusion

The `parentId` field is:

- Fully supported and documented in Linear SDK v63.4.0
- Typed as `parentId?: string` in the Comment class
- Available as a direct property access (no special getter needed)
- Properly included in GraphQL schema and fragment types
- Confirmed working with real API data

## Recommendation

When accessing `parentId` in our codebase:

1. Use direct property access: `comment.parentId`
2. Handle optionality with type guards or optional chaining
3. TypeScript will provide full type safety
4. No special SDK methods or workarounds needed

The original issue suggesting the field doesn't exist appears to be incorrect. The field is properly defined and accessible.
