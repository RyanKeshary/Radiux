async function benchmarkZodiac() {
  const t0 = Date.now();
  console.log('--- Starting Zodiac Real-Time Benchmark ---');

  const res = await fetch('http://localhost:3000/api/ai/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userMessage: 'Inspect the active open package.json and update version to 1.0.1.',
      context: {
        project: { id: 'default', name: 'Radiux Test Project' },
        user: { id: 'admin', role: 'owner', name: 'Tester' },
        activeFile: {
          path: 'package.json',
          language: 'json',
          content: '{\n  "name": "radiux",\n  "version": "1.0.0"\n}\n',
        },
        intentMode: 'EDIT',
      },
      permissionMode: 'AUTONOMOUS',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('HTTP Error:', res.status, text);
    process.exit(1);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let stepTimings = [];
  let currentStep = 0;
  let lastEventTime = t0;
  let finalSummary = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const raw = line.slice(6).trim();
        if (!raw) continue;
        try {
          const ev = JSON.parse(raw);
          const now = Date.now();
          const elapsed = now - t0;
          const delta = now - lastEventTime;
          lastEventTime = now;

          if (ev.type === 'status') {
            console.log(`[+${elapsed}ms] STATUS: ${ev.message}`);
          } else if (ev.type === 'tool_start') {
            console.log(`[+${elapsed}ms] ⚡ TOOL START: ${ev.toolName} (args: ${JSON.stringify(ev.args)})`);
          } else if (ev.type === 'tool_finish') {
            console.log(`[+${elapsed}ms] ✅ TOOL FINISH: ${ev.toolName} (in ${delta}ms)`);
          } else if (ev.type === 'token') {
            process.stdout.write(ev.token);
          } else if (ev.type === 'iteration_complete') {
            console.log(`[+${elapsed}ms] 🔄 STEP ${ev.step} COMPLETE`);
          } else if (ev.type === 'error') {
            console.log(`[+${elapsed}ms] ❌ ERROR: ${ev.message}`);
          } else if (ev.type === 'done') {
            console.log(`\n[+${elapsed}ms] 🎯 DONE: ${ev.summary}`);
            finalSummary = ev.summary;
          }
        } catch (e) {}
      }
    }
  }

  const totalDuration = Date.now() - t0;
  console.log(`\n========================================`);
  console.log(`TOTAL EXECUTION TIME: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
  console.log(`========================================`);

  if (totalDuration > 10000) {
    console.warn(`WARNING: Took longer than 10s. Investigate remaining bottlenecks.`);
  } else {
    console.log(`SUCCESS: Zodiac executed multi-step autonomous task in ultra-fast timeframe!`);
  }
}

benchmarkZodiac().catch(console.error);
