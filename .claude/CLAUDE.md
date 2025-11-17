# Coding Arena - Claude Instructions

## Mandatory Workflow

### BEFORE starting ANY task:

1. **Check for relevant skills** - Use `Skill` tool to find and load applicable skills
2. **Use brainstorming skill** for design/planning tasks BEFORE coding
3. **Use systematic-debugging** for bugs BEFORE proposing fixes
4. **Use code-reviewer** after completing major work

### Task Delegation Rules:

- **Complex investigations**: Use Task tool with subagent (not direct file reads)
- **Independent tasks**: Dispatch subagents in parallel when possible
- **Code reviews**: ALWAYS use code-reviewer subagent after completing work
- **Planning**: Use brainstorming → writing-plans workflow for complex features

### Context Management:

- **Minimize context usage**: Delegate to subagents instead of doing work yourself
- **Use targeted tools**: Read specific files instead of broad searches
- **Parallel execution**: Launch multiple subagents concurrently when tasks are independent

## Forbidden Patterns:

- ❌ Starting to code before using brainstorming skill
- ❌ Manually debugging without systematic-debugging skill
- ❌ Completing major work without code-reviewer
- ❌ Doing investigation work yourself instead of dispatching subagents
- ❌ Reading many files sequentially when subagent could explore in parallel

## Required Patterns:

- ✅ Skill tool → Brainstorming → Writing Plans → Subagents → Code Review
- ✅ For bugs: Systematic Debugging → TDD → Code Review
- ✅ For exploration: Task tool with Explore subagent
- ✅ For implementation: Dispatch subagents with clear tasks

## Code Quality Standards

- NEVER add fallbacks to production code. Errors are information, fallbacks hide reality.
- Tests must test real production cases. No stubs, fakes, or junk tests.
- Never decrease code coverage requirements.
- Always use TDD for new features (test-driven-development skill)

## When in doubt:

Ask yourself: "Is there a skill for this?" If yes, use it. If unsure, check available skills first.
