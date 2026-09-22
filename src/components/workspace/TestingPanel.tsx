'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Sparkles, 
  Terminal, 
  Filter, 
  ChevronRight, 
  ChevronDown,
  Trash2,
  AlertTriangle,
  FlaskConical,
  FileCode,
  ShieldAlert
} from 'lucide-react';
import { config } from '@/lib/config';

export interface TestCaseResult {
  id: string;
  name: string;
  suite?: string;
  status: 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  file?: string;
  line?: number;
}

export interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  status: 'idle' | 'running' | 'passed' | 'failed';
}

interface TestingPanelProps {
  projectId: string;
  userRole?: 'owner' | 'editor' | 'visitor' | 'member';
  onAskZodiac?: (context: { command: string; error: string; file?: string; line?: number }) => void;
  onNavigateToFile?: (filePath: string, line?: number) => void;
}

const PRESET_COMMANDS = [
  { label: 'npm test', command: 'npm test' },
  { label: 'npm run test:unit', command: 'npm run test:unit' },
  { label: 'npx vitest run', command: 'npx vitest run' },
  { label: 'npx jest', command: 'npx jest' },
  { label: 'node --test', command: 'node --test' },
  { label: 'npx tsc --noEmit', command: 'npx tsc --noEmit' },
];

export function TestingPanel({
  projectId,
  userRole = 'editor',
  onAskZodiac,
  onNavigateToFile,
}: TestingPanelProps) {
  const [selectedCommand, setSelectedCommand] = useState('npm test');
  const [customCommand, setCustomCommand] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'results' | 'raw'>('results');
  const [searchFilter, setSearchFilter] = useState('');
  const [expandedTests, setExpandedTests] = useState<Record<string, boolean>>({});
  
  const [summary, setSummary] = useState<TestSuiteSummary>({
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    status: 'idle',
  });

  const [tests, setTests] = useState<TestCaseResult[]>([]);
  const [rawOutput, setRawOutput] = useState<string>('');
  const rawOutputEndRef = useRef<HTMLDivElement>(null);

  const isVisitor = userRole === 'visitor';

  // Parse raw CLI test output to extract structured tests
  const parseTestOutput = (stdout: string, stderr: string, exitCode: number, duration: number) => {
    const combined = `${stdout}\n${stderr}`;
    const parsedTests: TestCaseResult[] = [];
    const lines = combined.split('\n');

    let passedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Pattern matching for common test runners (Jest, Vitest, Mocha, Node:test, TAP)
    lines.forEach((line, index) => {
      const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '').trim();
      
      // Match PASS / ✓
      if (/^(?:PASS|✓|ok\s+\d+)\s+(.+)$/i.test(cleanLine)) {
        const match = cleanLine.match(/^(?:PASS|✓|ok\s+\d+)\s+(.+)$/i);
        const name = match ? match[1] : `Test ${index + 1}`;
        passedCount++;
        parsedTests.push({
          id: `test_${index}_${Date.now()}`,
          name,
          status: 'passed',
        });
      } 
      // Match FAIL / ✕
      else if (/^(?:FAIL|✕|not ok\s+\d+)\s+(.+)$/i.test(cleanLine)) {
        const match = cleanLine.match(/^(?:FAIL|✕|not ok\s+\d+)\s+(.+)$/i);
        const name = match ? match[1] : `Failed Test ${index + 1}`;
        failedCount++;

        // Collect snippet / stack trace from following lines
        const errorLines = lines.slice(index + 1, index + 8)
          .map(l => l.replace(/\x1b\[[0-9;]*m/g, '').trim())
          .filter(l => l.length > 0);

        parsedTests.push({
          id: `test_${index}_${Date.now()}`,
          name,
          status: 'failed',
          error: errorLines.join('\n') || 'Test failed without explicit assertion message.',
        });
      }
      // Match skipped
      else if (/^(?:SKIP|○|-)\s+(.+)$/i.test(cleanLine)) {
        const match = cleanLine.match(/^(?:SKIP|○|-)\s+(.+)$/i);
        const name = match ? match[1] : `Skipped Test ${index + 1}`;
        skippedCount++;
        parsedTests.push({
          id: `test_${index}_${Date.now()}`,
          name,
          status: 'skipped',
        });
      }
    });

    // Fallback if no specific format detected (e.g. tsc or basic script)
    if (parsedTests.length === 0) {
      if (exitCode === 0) {
        passedCount = 1;
        parsedTests.push({
          id: `test_summary_pass`,
          name: 'Command completed successfully',
          status: 'passed',
        });
      } else {
        failedCount = 1;
        parsedTests.push({
          id: `test_summary_fail`,
          name: 'Execution exited with error',
          status: 'failed',
          error: stderr || stdout || `Process exited with code ${exitCode}`,
        });
      }
    }

    setTests(parsedTests);
    setSummary({
      total: passedCount + failedCount + skippedCount,
      passed: passedCount,
      failed: failedCount,
      skipped: skippedCount,
      duration: duration / 1000,
      status: exitCode === 0 ? 'passed' : 'failed',
    });
  };

  const handleRunTests = async () => {
    if (isVisitor || isRunning) return;

    const cmdToRun = isCustom ? customCommand.trim() : selectedCommand;
    if (!cmdToRun) return;

    setIsRunning(true);
    setSummary(prev => ({ ...prev, status: 'running' }));
    setRawOutput(`$ ${cmdToRun}\nExecuting in project root...\n\n`);

    try {
      const backendUrl = config.apiUrl;
      const res = await fetch(`${backendUrl}/api/workspace/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          command: cmdToRun,
          userRole,
          options: { timeout: 60000 },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to run tests' }));
        setRawOutput(prev => prev + `\nExecution Error: ${err.error || res.statusText}\n`);
        setSummary({
          total: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: 0,
          status: 'failed',
        });
        setTests([{
          id: 'exec_fail',
          name: 'Command failed to launch',
          status: 'failed',
          error: err.error || 'Server error',
        }]);
        return;
      }

      const data = await res.json();
      const output = `${data.stdout || ''}\n${data.stderr || ''}`;
      setRawOutput(prev => prev + output + `\n\nProcess exited with code: ${data.exitCode} (${(data.duration / 1000).toFixed(2)}s)`);
      parseTestOutput(data.stdout || '', data.stderr || '', data.exitCode, data.duration || 0);
    } catch (e: any) {
      setRawOutput(prev => prev + `\nConnection error: ${e.message}\n`);
      setSummary(prev => ({ ...prev, status: 'failed' }));
    } finally {
      setIsRunning(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedTests(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAskZodiacForTest = (test: TestCaseResult) => {
    if (onAskZodiac) {
      onAskZodiac({
        command: isCustom ? customCommand : selectedCommand,
        error: `${test.name}\n${test.error || ''}`,
        file: test.file,
        line: test.line,
      });
    }
  };

  const filteredTests = tests.filter(t => 
    t.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (t.error && t.error.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#181818] text-[#d4d4d4] select-none text-xs">
      {/* Testing Controls Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2d2d2d] bg-[#1f1f1f] gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-sky-400" />
          <span className="font-semibold text-white tracking-wide">Test Runner</span>

          {/* Preset Selector */}
          <select
            disabled={isRunning || isVisitor}
            value={isCustom ? 'custom' : selectedCommand}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setIsCustom(true);
              } else {
                setIsCustom(false);
                setSelectedCommand(e.target.value);
              }
            }}
            className="bg-[#2a2a2a] text-[#d4d4d4] border border-[#3c3c3c] rounded px-2 py-1 text-xs outline-none focus:border-sky-500 cursor-pointer"
          >
            {PRESET_COMMANDS.map(p => (
              <option key={p.command} value={p.command}>{p.label}</option>
            ))}
            <option value="custom">Custom Command...</option>
          </select>

          {isCustom && (
            <input
              type="text"
              disabled={isRunning || isVisitor}
              value={customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              placeholder="e.g. npm test -- --coverage"
              className="bg-[#2a2a2a] text-[#d4d4d4] border border-[#3c3c3c] rounded px-2 py-1 text-xs outline-none focus:border-sky-500 w-44 font-mono"
            />
          )}

          {/* Run Button */}
          <button
            onClick={handleRunTests}
            disabled={isRunning || isVisitor}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-medium text-white transition-colors ${
              isVisitor 
                ? 'bg-[#333] text-zinc-500 cursor-not-allowed'
                : isRunning
                  ? 'bg-sky-600/50 cursor-wait'
                  : 'bg-sky-600 hover:bg-sky-500 active:bg-sky-700'
            }`}
            title={isVisitor ? 'Visitors cannot execute test commands' : 'Run tests'}
          >
            {isRunning ? (
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isRunning ? 'Running...' : 'Run All'}</span>
          </button>
        </div>

        {/* View mode toggle & clear */}
        <div className="flex items-center gap-2">
          <div className="flex bg-[#252526] rounded border border-[#3c3c3c] p-0.5">
            <button
              onClick={() => setActiveTab('results')}
              className={`px-2 py-0.5 rounded transition-colors ${
                activeTab === 'results' ? 'bg-[#37373d] text-white font-medium' : 'text-[#858585] hover:text-white'
              }`}
            >
              Results ({summary.total})
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                activeTab === 'raw' ? 'bg-[#37373d] text-white font-medium' : 'text-[#858585] hover:text-white'
              }`}
            >
              <Terminal className="w-3 h-3" />
              <span>Console</span>
            </button>
          </div>

          <button
            onClick={() => {
              setTests([]);
              setRawOutput('');
              setSummary({ total: 0, passed: 0, failed: 0, skipped: 0, duration: 0, status: 'idle' });
            }}
            className="p-1 hover:bg-[#333] rounded text-[#858585] hover:text-white"
            title="Clear test output"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Visitor Restriction Banner */}
      {isVisitor && (
        <div className="bg-amber-950/40 border-b border-amber-800/40 px-3 py-1.5 flex items-center gap-2 text-amber-300">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>You have Visitor access. Terminal and automated test execution are restricted to project Editors and Owners.</span>
        </div>
      )}

      {/* Summary Stats Header Bar */}
      {summary.status !== 'idle' && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2d2d2d] bg-[#1a1a1a]">
          <div className="flex items-center gap-4">
            <span className={`flex items-center gap-1.5 font-medium ${
              summary.status === 'passed' ? 'text-emerald-400' : summary.status === 'failed' ? 'text-red-400' : 'text-sky-400'
            }`}>
              {summary.status === 'passed' && <CheckCircle2 className="w-4 h-4" />}
              {summary.status === 'failed' && <XCircle className="w-4 h-4" />}
              {summary.status === 'running' && <RotateCcw className="w-4 h-4 animate-spin" />}
              <span className="capitalize">{summary.status}</span>
            </span>

            <span className="text-zinc-500">|</span>
            <span className="text-emerald-400 font-medium">{summary.passed} passed</span>
            <span className="text-red-400 font-medium">{summary.failed} failed</span>
            {summary.skipped > 0 && <span className="text-zinc-400">{summary.skipped} skipped</span>}
            <span className="text-zinc-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-zinc-500" />
              {summary.duration.toFixed(2)}s
            </span>
          </div>

          {activeTab === 'results' && tests.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#252526] border border-[#3c3c3c] rounded px-2 py-0.5">
              <Filter className="w-3 h-3 text-[#858585]" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter tests..."
                className="bg-transparent text-xs text-[#d4d4d4] outline-none w-28 placeholder:text-zinc-600"
              />
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'results' ? (
          <div className="p-2 space-y-1">
            {tests.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-[#858585] space-y-2">
                <FlaskConical className="w-8 h-8 text-zinc-600" />
                <p className="text-sm">No test results available.</p>
                <p className="text-xs text-zinc-600">Select a runner command and click &quot;Run All&quot; to execute tests.</p>
              </div>
            ) : (
              filteredTests.map((test) => {
                const isExpanded = !!expandedTests[test.id];
                return (
                  <div
                    key={test.id}
                    className="border border-[#2d2d2d] rounded bg-[#202020] hover:bg-[#252526] transition-colors"
                  >
                    <div
                      onClick={() => toggleExpand(test.id)}
                      className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                        {test.status === 'passed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                        {test.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                        {test.status === 'skipped' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                        <span className={`font-mono truncate ${test.status === 'failed' ? 'text-red-300 font-semibold' : 'text-zinc-200'}`}>
                          {test.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {test.file && (
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onNavigateToFile && test.file) onNavigateToFile(test.file, test.line);
                            }}
                            className="text-[10px] text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <FileCode className="w-3 h-3" />
                            {test.file}
                          </span>
                        )}

                        {test.status === 'failed' && onAskZodiac && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAskZodiacForTest(test);
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/40 text-[11px] font-medium"
                            title="Ask Zodiac to analyze and fix this test failure"
                          >
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            <span>Ask Zodiac</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded details (stack trace / error) */}
                    {isExpanded && test.error && (
                      <div className="px-3 py-2 border-t border-[#2d2d2d] bg-[#181818] font-mono text-[11px] text-red-300/90 whitespace-pre-wrap overflow-x-auto select-text">
                        {test.error}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Raw CLI Console View */
          <div className="h-full w-full bg-[#141414] p-3 font-mono text-[11px] text-zinc-300 overflow-auto whitespace-pre-wrap select-text leading-relaxed">
            {rawOutput || 'Console output will appear here when tests run.'}
            <div ref={rawOutputEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
