/**
 * Tests for state machine type definitions
 */
import { describe, expect, it } from 'vitest'

import {
  IssueStatus,
  AgentStatus,
  isValidIssueTransition,
  isValidAgentTransition,
  type IssueStatusType,
  type AgentStatusType,
} from './state-machine'

describe('State Machine Types', () => {
  describe('IssueStatus', () => {
    it('should have all required states', () => {
      expect(IssueStatus.OPEN).toBe('open')
      expect(IssueStatus.IN_PROGRESS).toBe('in_progress')
      expect(IssueStatus.COMPLETED).toBe('completed')
      expect(IssueStatus.CANCELLED).toBe('cancelled')
    })
  })

  describe('AgentStatus', () => {
    it('should have all required states', () => {
      expect(AgentStatus.PENDING).toBe('pending')
      expect(AgentStatus.SUBMITTED).toBe('submitted')
      expect(AgentStatus.ACCEPTED).toBe('accepted')
      expect(AgentStatus.REJECTED).toBe('rejected')
      expect(AgentStatus.IGNORED).toBe('ignored')
    })
  })

  describe('isValidIssueTransition', () => {
    it('should allow open -> in_progress', () => {
      expect(isValidIssueTransition('open', 'in_progress')).toBe(true)
    })

    it('should allow open -> cancelled', () => {
      expect(isValidIssueTransition('open', 'cancelled')).toBe(true)
    })

    it('should allow in_progress -> completed', () => {
      expect(isValidIssueTransition('in_progress', 'completed')).toBe(true)
    })

    it('should allow in_progress -> cancelled', () => {
      expect(isValidIssueTransition('in_progress', 'cancelled')).toBe(true)
    })

    it('should reject invalid transitions', () => {
      expect(isValidIssueTransition('completed', 'open')).toBe(false)
      expect(isValidIssueTransition('cancelled', 'in_progress')).toBe(false)
    })

    it('should throw error for invalid from state', () => {
      expect(() =>
        isValidIssueTransition('invalid_state' as IssueStatusType, 'open')
      ).toThrow('Invalid issue state: invalid_state')
    })

    it('should include valid states in error message', () => {
      expect(() =>
        isValidIssueTransition('bad_state' as IssueStatusType, 'open')
      ).toThrow('Expected one of: open, in_progress, completed, cancelled')
    })
  })

  describe('isValidAgentTransition', () => {
    it('should allow pending -> submitted', () => {
      expect(isValidAgentTransition('pending', 'submitted')).toBe(true)
    })

    it('should allow pending -> ignored', () => {
      expect(isValidAgentTransition('pending', 'ignored')).toBe(true)
    })

    it('should allow submitted -> accepted', () => {
      expect(isValidAgentTransition('submitted', 'accepted')).toBe(true)
    })

    it('should allow submitted -> rejected', () => {
      expect(isValidAgentTransition('submitted', 'rejected')).toBe(true)
    })

    it('should reject invalid transitions', () => {
      expect(isValidAgentTransition('accepted', 'rejected')).toBe(false)
      expect(isValidAgentTransition('ignored', 'submitted')).toBe(false)
    })

    it('should throw error for invalid from state', () => {
      expect(() =>
        isValidAgentTransition('invalid_state' as AgentStatusType, 'pending')
      ).toThrow('Invalid agent state: invalid_state')
    })

    it('should include valid states in error message', () => {
      expect(() =>
        isValidAgentTransition('bad_state' as AgentStatusType, 'pending')
      ).toThrow(
        'Expected one of: pending, submitted, accepted, rejected, ignored'
      )
    })
  })
})
