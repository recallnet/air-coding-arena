import { execFileSync } from 'node:child_process'
import { createPrivateKey } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { expect, it } from 'vitest'

it('stores no parseable PEM private keys in tracked source, tests or documentation', () => {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
  const filesWithKeys = new Set<string>()
  const envelope =
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    for (const match of content.matchAll(envelope)) {
      try {
        createPrivateKey(match[0])
        filesWithKeys.add(file)
      } catch {
        // Non-key instructional placeholders do not contain usable key material.
      }
    }
  }
  // Failure output contains filenames only, never private key contents.
  expect([...filesWithKeys]).toEqual([])
})
