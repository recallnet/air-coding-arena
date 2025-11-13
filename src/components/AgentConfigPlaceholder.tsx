/**
 * Agent configuration placeholder component.
 * Client Component that shows where configuration settings will be in Milestone 3.
 *
 * @packageDocumentation
 */

'use client'

import { Badge } from '@/components/ui/Badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'

/**
 * Agent configuration placeholder component.
 * Shows non-functional UI preview of configuration options coming in Milestone 3.
 *
 * @returns Agent configuration placeholder component
 */
export function AgentConfigPlaceholder(): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Agent assignment settings</CardDescription>
          </div>
          <Badge variant="warning">Coming in Milestone 3</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 opacity-50">
          <div className="text-sm font-medium text-foreground">
            Assignment Mode
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                value="all"
                disabled
                className="h-4 w-4"
              />
              <div>
                <div className="font-medium text-foreground">
                  Run all agents
                </div>
                <div className="text-sm text-foreground-secondary">
                  Assign all enabled agents to every issue
                </div>
              </div>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                value="max_n"
                disabled
                className="h-4 w-4"
              />
              <div className="flex-1">
                <div className="font-medium text-foreground">Max N agents</div>
                <div className="text-sm text-foreground-secondary">
                  Random sample of N enabled agents per issue (minimum 2)
                </div>
                <div className="mt-2">
                  <label className="flex items-center gap-2">
                    <span className="text-sm text-foreground-secondary">
                      Max agents:
                    </span>
                    <input
                      type="number"
                      min="2"
                      defaultValue="5"
                      disabled
                      className="w-20 rounded-geist border border-border px-2 py-1 text-sm"
                    />
                  </label>
                </div>
              </div>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                value="manual"
                disabled
                className="h-4 w-4"
              />
              <div>
                <div className="font-medium text-foreground">
                  Manual assignment only
                </div>
                <div className="text-sm text-foreground-secondary">
                  No auto-assignment, listen for @mentions in comments
                </div>
              </div>
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
