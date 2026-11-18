import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { xdgOpenScript } from './xdg-open.mjs'

export function prepareXdgOpen() {
  const directory = mkdtempSync(join(tmpdir(), 'listhen-xdg-'))
  try {
    const command = join(directory, 'xdg-open')
    writeFileSync(command, xdgOpenScript(), { encoding: 'utf8', flag: 'wx', mode: 0o700 })
    return {
      command,
      dispose() {
        rmSync(directory, { recursive: true, force: true })
      },
    }
  }
  catch (error) {
    rmSync(directory, { recursive: true, force: true })
    throw error
  }
}
