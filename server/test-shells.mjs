import os from 'os';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { detectProfiles, getSanitizedEnv } from './workspace-manager.mjs';

const require = createRequire(import.meta.url);
let pty;
try {
  pty = require('node-pty');
} catch (e) {
  console.error('[Shell Diagnostics] Failed to load node-pty:', e.message);
}

console.log('\n========================================');
console.log('       Radiux Shell Diagnostics');
console.log('========================================');
console.log(`Platform: ${os.platform()} (${os.arch()})`);
console.log(`Node: ${process.version}`);
console.log('========================================\n');

const profiles = detectProfiles();
console.log('Detected Profiles from Registry:');
for (const p of profiles) {
  console.log(`  • [${p.id}] ${p.name} -> ${p.executable} (default: ${p.isDefault || false})`);
}
console.log('');

// Test all candidate profiles for the platform
const candidateProfiles = os.platform() === 'win32'
  ? [
      { id: 'pwsh', name: 'PowerShell 7', check: 'pwsh' },
      { id: 'powershell', name: 'Windows PowerShell', check: 'powershell.exe' },
      { id: 'cmd', name: 'Command Prompt', check: 'cmd.exe' },
      { id: 'gitbash', name: 'Git Bash', check: 'bash.exe' },
      { id: 'wsl', name: 'WSL', check: 'wsl.exe' },
    ]
  : [
      { id: 'bash', name: 'Bash', check: 'bash' },
      { id: 'zsh', name: 'Zsh', check: 'zsh' },
      { id: 'sh', name: 'Sh', check: 'sh' },
    ];

function safeKill(proc) {
  if (!proc) return;
  try {
    if (os.platform() === 'win32' && proc.pid) {
      spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t']);
    } else {
      proc.kill();
    }
  } catch (e) {}
}

async function testSpawn(prof) {
  return new Promise((resolve) => {
    try {
      if (!pty) {
        return resolve({ ok: false, error: 'node-pty not available' });
      }
      const proc = pty.spawn(prof.executable, prof.args || [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: getSanitizedEnv(),
      });

      let output = '';
      let resolved = false;

      const finish = (ok, err) => {
        if (resolved) return;
        resolved = true;
        safeKill(proc);
        resolve({ ok, output, error: err });
      };

      const timer = setTimeout(() => {
        finish(output.length > 0, output.length > 0 ? null : 'Timeout');
      }, 2000);

      proc.onData((data) => {
        output += data;
        clearTimeout(timer);
        setTimeout(() => {
          finish(true, null);
        }, 200);
      });

      proc.onExit(() => {
        clearTimeout(timer);
        finish(true, null);
      });
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

console.log('Diagnostic Shell Availability & Spawn Verification:');

for (const cand of candidateProfiles) {
  const match = profiles.find(p => p.id === cand.id);
  if (match) {
    const result = await testSpawn(match);
    if (result.ok) {
      console.log(`  ✓ ${cand.name} (${match.executable}) — PTY SPAWN OK`);
    } else {
      console.log(`  ⚠ ${cand.name} (${match.executable}) — SPAWN FAILED: ${result.error || 'No output'}`);
    }
  } else {
    console.log(`  ✗ ${cand.name} — NOT INSTALLED`);
  }
}

console.log('\n========================================\n');
process.exit(0);
