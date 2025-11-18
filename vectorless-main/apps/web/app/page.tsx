'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

type ResearchRun = {
  id: string;
  title: string;
  status: string;
  orchestratorPhase: string | null;
  createdAt: string;
  updatedAt: string;
  backgroundJobId: string | null;
};

type RunDetail = {
  run: {
    id: string;
    title: string;
    status: string;
    orchestratorPhase: string | null;
    prompt: Record<string, unknown> | null;
    documents: { id: string; filename: string; status: string }[];
    conversationTurns: { id: string; role: string; content: { text?: string }; createdAt: string }[];
    progressEvents: { id: string; phase: string; message: string; progress: number; createdAt: string }[];
    reportSections: { id: string; sectionType: string; content: Record<string, unknown>; position: number }[];
  };
};

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold tracking-wide text-slate-300 uppercase">{children}</h2>;
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 shadow-xl">{children}</div>;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-3">
          <div className="text-sm uppercase tracking-[0.3em] text-slate-500">Deep Research Command Center</div>
          <h1 className="text-4xl font-semibold text-white">Create, ingest, and orchestrate diligence runs</h1>
          <p className="max-w-3xl text-slate-400">
            Upload document batches, import transcripts, ask clarifying questions, and dispatch OpenAI Deep Research jobs—
            all with full visibility into citations, progress events, and generated sections.
          </p>
        </header>
        <ResearchWorkspace />
      </div>
    </main>
  );
}

function ResearchWorkspace() {
  const { data: runListData, mutate: mutateRuns, isLoading: loadingRuns } = useSWR<{ runs: ResearchRun[] }>('/api/research/run', fetcher, {
    refreshInterval: 60000
  });

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data: runDetail, mutate: mutateRunDetail, isLoading: loadingDetail } = useSWR<RunDetail>(
    selectedRunId ? `/api/research/run/${selectedRunId}` : null,
    fetcher,
    {
      refreshInterval: 15000
    }
  );
  const { data: sourceData, mutate: mutateSources } = useSWR<{ sources: any[] }>(
    selectedRunId ? `/api/research/run/${selectedRunId}/sources` : null,
    fetcher,
    {
      refreshInterval: 20000
    }
  );

  const selectedRun = runListData?.runs.find((run) => run.id === selectedRunId) ?? null;
  const [editableSections, setEditableSections] = useState<
    { id?: string; sectionType: string; markdown: string }[]
  >([]);
  const [newSectionType, setNewSectionType] = useState('APPENDIX');

  const refreshActiveRun = useCallback(async () => {
    await mutateRuns();
    await mutateRunDetail();
  }, [mutateRunDetail, mutateRuns]);

  const handleCreateRun = useCallback(
    async (formData: FormData) => {
      const payload = {
        title: String(formData.get('title') ?? ''),
        brief: String(formData.get('brief') ?? '')
      };

      const response = await fetch('/api/research/run', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Unable to create run');
      }

      const { run } = await response.json();
      await mutateRuns();
      setSelectedRunId(run.id);
    },
    [mutateRuns]
  );

  const handleUpload = useCallback(
    async (endpoint: string, file: File, runId: string | null, extra?: Record<string, string>) => {
      if (!runId) throw new Error('Select a run first');
      const data = new FormData();
      data.append('file', file);
      data.append('runId', runId);
      if (extra) {
        Object.entries(extra).forEach(([key, value]) => data.append(key, value));
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: data
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }
      await refreshActiveRun();
    },
    [refreshActiveRun]
  );

  const triggerAction = useCallback(
    async (path: string) => {
      if (!selectedRunId) throw new Error('Select a run first');
      const response = await fetch(`/api/research/run/${selectedRunId}/${path}`, { method: 'POST' });
      if (!response.ok) throw new Error(`Failed to ${path}`);
      await refreshActiveRun();
    },
    [refreshActiveRun, selectedRunId]
  );

  const pollStatus = useCallback(async () => {
    if (!selectedRunId) return;
    await fetch(`/api/research/run/${selectedRunId}/status`, { cache: 'no-store' });
    await refreshActiveRun();
  }, [refreshActiveRun, selectedRunId]);

  const saveSections = useCallback(async () => {
    if (!selectedRunId) throw new Error('Select a run first');
    const response = await fetch(`/api/research/run/${selectedRunId}/sections`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sections: editableSections })
    });
    if (!response.ok) {
      throw new Error('Failed to save sections');
    }
    const data = await response.json();
    setEditableSections(
      data.sections.map((section: any) => ({
        id: section.id,
        sectionType: section.sectionType,
        markdown: section.content?.markdown ?? ''
      }))
    );
    await refreshActiveRun();
  }, [editableSections, refreshActiveRun, selectedRunId]);

  const verifySources = useCallback(async () => {
    if (!selectedRunId) return;
    const response = await fetch(`/api/research/run/${selectedRunId}/sources/verify`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to verify sources');
    await mutateSources();
  }, [mutateSources, selectedRunId]);

  const runConversation = useMemo(() => {
    return runDetail?.run.conversationTurns ?? [];
  }, [runDetail]);

  const progressEvents = useMemo(() => {
    return runDetail?.run.progressEvents ?? [];
  }, [runDetail]);

  useEffect(() => {
    if (!selectedRunId && runListData?.runs.length) {
      setSelectedRunId(runListData.runs[0].id);
    }
  }, [runListData, selectedRunId]);

  useEffect(() => {
    if (!runDetail?.run.reportSections) {
      setEditableSections([]);
      return;
    }
    setEditableSections(
      runDetail.run.reportSections.map((section) => ({
        id: section.id,
        sectionType: section.sectionType,
        markdown: (section.content as Record<string, string> | null)?.markdown ?? ''
      }))
    );
  }, [runDetail]);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr_320px]">
      <Panel>
        <SectionTitle>Runs</SectionTitle>
        <div className="mt-4 space-y-3">
          {loadingRuns && <p className="text-sm text-slate-500">Loading runs...</p>}
          {!loadingRuns && !runListData?.runs.length && (
            <p className="text-sm text-slate-500">No runs yet. Create one below.</p>
          )}
          <div className="space-y-2">
            {runListData?.runs.map((run) => (
              <button
                key={run.id}
                onClick={() => setSelectedRunId(run.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                  selectedRunId === run.id
                    ? 'border-emerald-400 bg-emerald-400/10 text-emerald-100'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="font-medium">{run.title}</div>
                <div className="text-xs text-slate-400">
                  {run.status} · {run.orchestratorPhase ?? 'n/a'}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 border-t border-slate-800 pt-4">
          <SectionTitle>New Run</SectionTitle>
          <form
            className="mt-4 space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                const formData = new FormData(event.currentTarget);
                await handleCreateRun(formData);
                event.currentTarget.reset();
              } catch (error) {
                alert((error as Error).message);
              }
            }}
          >
            <input
              name="title"
              placeholder="Project title"
              className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              required
            />
            <textarea
              name="brief"
              placeholder="What should we research?"
              className="h-32 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              required
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
            >
              Create research run
            </button>
          </form>
        </div>
      </Panel>

      <div className="space-y-6">
        <Panel>
          <SectionTitle>Conversation & Clarifications</SectionTitle>
          {loadingDetail && <p className="mt-4 text-sm text-slate-500">Loading conversation…</p>}
          {!loadingDetail && !runConversation.length && (
            <p className="mt-4 text-sm text-slate-500">No clarifications yet.</p>
          )}
          <div className="mt-4 space-y-3">
            {runConversation.map((turn) => (
              <div key={turn.id} className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">{turn.role}</div>
                <p className="mt-1 text-sm text-slate-200">{turn.content?.text}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between">
            <SectionTitle>Report Draft</SectionTitle>
            <div className="flex items-center gap-2">
              <button
                disabled={!selectedRun}
                onClick={async () => {
                  try {
                    await saveSections();
                  } catch (error) {
                    alert((error as Error).message);
                  }
                }}
                className="rounded-lg border border-emerald-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40"
              >
                Save
              </button>
              <button
                disabled={!selectedRun}
                onClick={() => window.open(`/api/research/run/${selectedRunId}/export/markdown`, '_blank')}
                className="rounded-lg border border-slate-700 px-2 py-1 text-xs hover:border-emerald-400 disabled:opacity-40"
              >
                MD
              </button>
              <button
                disabled={!selectedRun}
                onClick={() => window.open(`/api/research/run/${selectedRunId}/export/pdf`, '_blank')}
                className="rounded-lg border border-slate-700 px-2 py-1 text-xs hover:border-emerald-400 disabled:opacity-40"
              >
                PDF
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {editableSections.map((section, index) => (
              <div key={section.id ?? `draft-${index}`} className="space-y-2 rounded-xl border border-slate-800/70 bg-slate-900/40 p-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{section.sectionType}</span>
                  <span>{section.id ? 'autogenerated' : 'draft'}</span>
                </div>
                <textarea
                  value={section.markdown}
                  onChange={(event) =>
                    setEditableSections((prev) => {
                      const next = [...prev];
                      next[index] = { ...next[index], markdown: event.target.value };
                      return next;
                    })
                  }
                  className="h-32 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            ))}
            {!editableSections.length && <p className="text-sm text-slate-500">No sections yet.</p>}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <select
              value={newSectionType}
              onChange={(event) => setNewSectionType(event.target.value)}
              className="flex-1 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="EXECUTIVE_SUMMARY">Executive Summary</option>
              <option value="MARKET_101">Market 101</option>
              <option value="COMPETITIVE_LANDSCAPE">Competitive Landscape</option>
              <option value="CUSTOMER_VOICE">Customer Voice</option>
              <option value="INVESTMENT_THESES">Investment Theses</option>
              <option value="TARGET_UNIVERSE">Target Universe</option>
              <option value="VALUE_CREATION">Value Creation</option>
              <option value="RISKS">Risks</option>
              <option value="APPENDIX">Appendix</option>
            </select>
            <button
              disabled={!selectedRun}
              onClick={() =>
                setEditableSections((prev) => [...prev, { sectionType: newSectionType, markdown: '' }])
              }
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-emerald-400 disabled:opacity-40"
            >
              Add section
            </button>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between">
            <SectionTitle>Progress</SectionTitle>
            <button
              disabled={!selectedRun}
              onClick={() =>
                window.open(`/api/research/run/${selectedRunId}/methodology/export`, '_blank')
              }
              className="rounded-lg border border-slate-700 px-3 py-1 text-xs hover:border-emerald-400 disabled:opacity-40"
            >
              Export log
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {progressEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-800/70 bg-slate-900/30 px-3 py-2 text-sm">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{event.phase}</span>
                  <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
                </div>
                <div className="text-slate-200">{event.message}</div>
              </div>
            ))}
            {!progressEvents.length && <div className="text-sm text-slate-500">No progress yet.</div>}
          </div>
        </Panel>
      </div>

      <Panel>
        <SectionTitle>Actions</SectionTitle>
        <div className="mt-4 space-y-2">
          <button
            disabled={!selectedRun}
            onClick={async () => {
              try {
                await triggerAction('clarify');
              } catch (error) {
                alert((error as Error).message);
              }
            }}
            className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-sm hover:border-emerald-400 disabled:opacity-40"
          >
            Ask clarifying questions
          </button>
          <button
            disabled={!selectedRun}
            onClick={async () => {
              try {
                await triggerAction('rewrite');
              } catch (error) {
                alert((error as Error).message);
              }
            }}
            className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-sm hover:border-emerald-400 disabled:opacity-40"
          >
            Generate research plan
          </button>
          <button
            disabled={!selectedRun}
            onClick={async () => {
              try {
                await triggerAction('start');
              } catch (error) {
                alert((error as Error).message);
              }
            }}
            className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-sm hover:border-emerald-400 disabled:opacity-40"
          >
            Launch Deep Research
          </button>
          <button
            disabled={!selectedRun}
            onClick={async () => {
              try {
                await pollStatus();
              } catch (error) {
                alert((error as Error).message);
              }
            }}
            className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-sm hover:border-emerald-400 disabled:opacity-40"
          >
            Poll status
          </button>
        </div>

        <div className="mt-6 border-t border-slate-800 pt-4">
          <SectionTitle>Upload Documents</SectionTitle>
          <UploadControl
            label="Primary documents"
            disabled={!selectedRun}
            accept=".pdf"
            onUpload={(file) => handleUpload('/api/ingest/upload', file, selectedRunId)}
          />
          <UploadControl
            label="Transcripts"
            disabled={!selectedRun}
            accept=".pdf,.txt"
            onUpload={(file) => handleUpload('/api/transcripts/upload', file, selectedRunId)}
          />
        </div>

        <div className="mt-6 border-t border-slate-800 pt-4">
          <SectionTitle>Documents</SectionTitle>
          <div className="mt-3 space-y-2 text-sm">
            {runDetail?.run.documents.map((doc) => (
              <div key={doc.id} className="rounded-lg border border-slate-800/80 px-3 py-2">
                <div className="font-medium text-slate-100">{doc.filename}</div>
                <div className="text-xs text-slate-500">{doc.status}</div>
              </div>
            ))}
            {!runDetail?.run.documents.length && <p className="text-xs text-slate-500">No uploads yet.</p>}
          </div>
        </div>

        <div className="mt-6 border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between">
            <SectionTitle>Sources & Citations</SectionTitle>
            <button
              disabled={!selectedRun}
              onClick={async () => {
                try {
                  await verifySources();
                } catch (error) {
                  alert((error as Error).message);
                }
              }}
              className="rounded-lg border border-slate-700 px-2 py-1 text-xs hover:border-emerald-400 disabled:opacity-40"
            >
              Verify
            </button>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            {sourceData?.sources?.map((source) => (
              <div key={source.id} className="rounded-lg border border-slate-800/80 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-100">{source.title}</div>
                    <div className="text-xs text-slate-500">{source.type}</div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      source.reliabilityScore >= 0.85
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : source.reliabilityScore >= 0.6
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {(source.reliabilityScore ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {source.document?.filename ?? 'unnamed'} · citations: {source._count?.citations ?? 0}
                </div>
              </div>
            ))}
            {!sourceData?.sources?.length && <p className="text-xs text-slate-500">No sources yet.</p>}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function UploadControl({
  label,
  disabled,
  accept,
  onUpload
}: {
  label: string;
  disabled: boolean;
  accept: string;
  onUpload: (file: File) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-3">
      <div className="text-sm text-slate-400">{label}</div>
      <label className="mt-2 flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-slate-700 px-3 py-2 text-sm hover:border-emerald-400">
        <span>{busy ? 'Uploading…' : 'Choose file'}</span>
        <input
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled || busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              setBusy(true);
              await onUpload(file);
            } catch (error) {
              alert((error as Error).message);
            } finally {
              setBusy(false);
              event.target.value = '';
            }
          }}
        />
      </label>
    </div>
  );
}
