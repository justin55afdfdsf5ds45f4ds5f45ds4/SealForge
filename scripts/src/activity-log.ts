/**
 * Agent activity logger — saves structured log for dashboard replay.
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type AgentPhase = 'SCAN' | 'IDENTIFY' | 'HUNT' | 'REASON' | 'PACKAGE' | 'PUBLISH';

export interface ActivityEntry {
  timestamp: string;
  phase: AgentPhase;
  message: string;
  data?: any;
}

export class ActivityLog {
  entries: ActivityEntry[] = [];

  log(phase: AgentPhase, message: string, data?: any): void {
    const entry: ActivityEntry = {
      timestamp: new Date().toISOString(),
      phase,
      message,
      data,
    };
    this.entries.push(entry);

    const icons: Record<AgentPhase, string> = {
      SCAN: '\u{1F50D}',
      IDENTIFY: '\u{1F9E0}',
      HUNT: '\u{1F50E}',
      REASON: '\u{1F4AD}',
      PACKAGE: '\u{1F4E6}',
      PUBLISH: '\u{1F3EA}',
    };
    console.log(`  ${icons[phase]} [${phase}] ${message}`);
  }

  save(): void {
    // Save to frontend public dir for dashboard replay
    const frontendPublic = join(__dirname, '..', '..', 'frontend', 'public');
    if (!existsSync(frontendPublic)) {
      mkdirSync(frontendPublic, { recursive: true });
    }
    const outPath = join(frontendPublic, 'agent-activity.json');
    writeFileSync(outPath, JSON.stringify(this.entries, null, 2));
    console.log(`  Activity log saved: ${outPath}`);
  }
}
