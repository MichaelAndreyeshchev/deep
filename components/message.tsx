'use client';

import type { ChatRequestOptions, Message } from 'ai';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useMemo, useState, useEffect } from 'react';

import type { Vote } from '@/lib/db/schema';

import { DocumentToolCall, DocumentToolResult } from './document';
import { PencilEditIcon, SparklesIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';
import equal from 'fast-deep-equal';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { MessageEditor } from './message-editor';
import { DocumentPreview } from './document-preview';
import { SearchResults } from './search-results';
import { ExtractResults } from './extract-results';
import { ScrapeResults } from './scrape-results';
import { ResearchReportMantine } from './research-report-mantine';
import { useDeepResearch } from '@/lib/deep-research-context';
import { Progress } from './ui/progress';

type StreamCitation = {
  id: number;
  url: string;
  title: string;
  detail?: string;
};

type StreamFinding = {
  text: string;
  source: string;
  section?: string;
  page?: string;
  confidence?: 'high' | 'medium' | 'low' | null;
  metricLabel?: string | null;
  metricValue?: number | null;
  unit?: string | null;
};

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly,
}: {
  chatId: string;
  message: Message;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: (
    messages: Message[] | ((messages: Message[]) => Message[]),
  ) => void;
  reload: (
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  isReadonly: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const { addActivity, addSource, initProgress, setDepth, updateProgress } =
    useDeepResearch();

  // Track sources from search and extract results
  const [searchSources, setSearchSources] = useState<Array<{
    title: string;
    url: string;
    description: string;
    source: string;
    relevance: number;
  }>>([]);

  // Track research report
  const [researchReport, setResearchReport] = useState<{
    report: string;
    citations: StreamCitation[];
    metadata: {
      topic: string;
      completedSteps: number;
      totalSteps: number;
      duration: number;
      sourcesCount: number;
    };
    findings?: StreamFinding[];
  } | null>(null);

  useEffect(() => {
    if (message.toolInvocations) {
      const sources: Array<{
        title: string;
        url: string;
        description: string;
        source: string;
        relevance: number;
      }> = [];

      message.toolInvocations.forEach((toolInvocation: any) => {
        try {
          if (toolInvocation.toolName === 'search' && toolInvocation.state === 'result') {
            const searchResults = toolInvocation.result.data.map((item: any, index: number) => ({
              title: item.title,
              url: item.url,
              description: item.description,
              source: new URL(item.url).hostname,
              relevance: 1 - (index * 0.1), // Decrease relevance for each subsequent result
            }));
            sources.push(...searchResults);
          }
        } catch (error) {
          console.error('Error processing search results:', error);
        }
      });

      setSearchSources(sources);
      sources.forEach(source => addSource(source));
    }
  }, [message.toolInvocations, addSource]);

  useEffect(() => {
    if (message.toolInvocations) {
      message.toolInvocations.forEach((toolInvocation: any) => {
        try {
          if (toolInvocation.toolName === 'deepResearch') {
            // Handle progress initialization
            if (
              'delta' in toolInvocation &&
              toolInvocation.delta?.type === 'progress-init'
            ) {
              const { maxDepth, totalSteps } = toolInvocation.delta.content;
              initProgress(maxDepth, totalSteps);
            }

            // Handle depth updates
            if (
              'delta' in toolInvocation &&
              toolInvocation.delta?.type === 'depth-delta'
            ) {
              const { current, max } = toolInvocation.delta.content;
              setDepth(current, max);
            }

            // Handle activity updates
            if (
              'delta' in toolInvocation &&
              toolInvocation.delta?.type === 'activity-delta'
            ) {
              const activity = toolInvocation.delta.content;
              addActivity(activity);

              if (
                activity.completedSteps !== undefined &&
                activity.totalSteps !== undefined
              ) {
                updateProgress(activity.completedSteps, activity.totalSteps);
              }
            }

            // Handle source updates
            if (
              'delta' in toolInvocation &&
              toolInvocation.delta?.type === 'source-delta'
            ) {
              addSource(toolInvocation.delta.content);
            }

            // Handle research report
            if (
              'delta' in toolInvocation &&
              toolInvocation.delta?.type === 'research-report'
            ) {
              setResearchReport(toolInvocation.delta.content);
            }

            // Handle final result
            if (
              toolInvocation.state === 'result' &&
              toolInvocation.result?.success &&
              toolInvocation.result.data
            ) {
              const { completedSteps, totalSteps } = toolInvocation.result.data;
              if (completedSteps !== undefined && totalSteps !== undefined) {
                updateProgress(completedSteps, totalSteps);
              }
            }
          }
        } catch (error) {
          console.error('Error processing deep research update:', error);
        }
      });
    }
  }, [
    message.toolInvocations,
    addActivity,
    addSource,
    initProgress,
    setDepth,
    updateProgress,
  ]);

  return (
    <AnimatePresence>
      <motion.div
        className="w-full mx-auto max-w-3xl px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn(
            'flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
            {
              'w-full': mode === 'edit',
              'group-data-[role=user]/message:w-fit': mode !== 'edit',
            },
          )}
        >
          {message.role === 'assistant' && (
            <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
              <div className="translate-y-px">
                <SparklesIcon size={14} />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 w-full">
            {message.experimental_attachments && (
              <div className="flex flex-row justify-end gap-2">
                {message.experimental_attachments.map((attachment) => (
                  <PreviewAttachment
                    key={attachment.url}
                    attachment={attachment}
                  />
                ))}
              </div>
            )}

            {message.content && mode === 'view' && (
              <div className="flex flex-row gap-2 items-start">
                {message.role === 'user' && !isReadonly && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        className="px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100"
                        onClick={() => {
                          setMode('edit');
                        }}
                      >
                        <PencilEditIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit message</TooltipContent>
                  </Tooltip>
                )}

                <div
                  className={cn('flex flex-col gap-4', {
                    'px-3 py-2 rounded-xl':
                      message.role === 'user',
                  })}
                  style={message.role === 'user' ? {
                    backgroundColor: '#6c757d',
                    color: '#ffffff'
                  } : undefined}
                >
                  <Markdown>{message.content as string}</Markdown>
                </div>
              </div>
            )}

            {message.content && mode === 'edit' && (
              <div className="flex flex-row gap-2 items-start">
                <div className="size-8" />

                <MessageEditor
                  key={message.id}
                  message={message}
                  setMode={setMode}
                  setMessages={setMessages}
                  reload={reload}
                />
              </div>
            )}

            {message.toolInvocations && message.toolInvocations.length > 0 && (
              <div className="flex flex-col gap-4">
                {message.toolInvocations.map((toolInvocation) => {
                  const { toolName, toolCallId, state, args } = toolInvocation;

                  if (state === 'result') {
                    const { result } = toolInvocation;

                    return (
                      <div key={toolCallId}>
                        {toolName === 'search' ? (
                          <SearchResults
                            results={result.data.map((item: any) => ({
                              title: item.title,
                              url: item.url,
                              description: item.description,
                              source: new URL(item.url).hostname,
                              favicon: item.favicon,
                            }))}
                          />
                        ) : toolName === 'extract' ? (
                          <ExtractResults
                            results={
                              state === 'result' && result.data
                                ? Array.isArray(result.data)
                                  ? result.data.map((item: any) => ({
                                      url: item.url,
                                      data: item.data,
                                    }))
                                  : {
                                      url: args.urls[0],
                                      data: result.data,
                                    }
                                : []
                            }
                            isLoading={false}
                          />
                        ) : toolName === 'scrape' ? (
                          <ScrapeResults
                            url={args.url}
                            data={result.data}
                            isLoading={false}
                          />
                        ) : toolName === 'deepResearch' ? (
                          <div className="text-sm text-muted-foreground">
                            {result.success
                              ? 'Research completed successfully.'
                              : `Research may have failed: ${result.error}`}
                          </div>
                        ) : null}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={toolCallId}
                      className={cx({
                        skeleton: ['getWeather'].includes(toolName),
                      })}
                    >
                      {toolName === 'extract' ? (
                        <ExtractResults results={[]} isLoading={true} />
                      ) : toolName === 'scrape' ? (
                        <ScrapeResults
                          url={args.url}
                          data=""
                          isLoading={true}
                        />
                      ) : toolName === 'search' ? (
                        <SearchResults results={[]} isLoading={true} />
                      ) : toolName === 'deepResearch' ? (
                        <DeepResearchProgress
                          state={state}
                          activity={
                            (
                              toolInvocation as {
                                state: string;
                                delta?: {
                                  activity?: Array<{
                                    type: string;
                                    status: string;
                                    message: string;
                                    timestamp: string;
                                    depth?: number;
                                    completedSteps?: number;
                                    totalSteps?: number;
                                  }>;
                                };
                              }
                            ).state === 'streaming' &&
                            (toolInvocation as any).delta?.activity
                              ? [
                                  ...((toolInvocation as any).delta.activity ||
                                    []),
                                ]
                              : []
                          }
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Research Report */}
            {researchReport && (
              <ResearchReportMantine
                report={researchReport.report}
                citations={researchReport.citations}
                metadata={researchReport.metadata}
                findings={researchReport.findings || []}
              />
            )}

            {!isReadonly && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                message={message}
                vote={vote}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.content !== nextProps.message.content) return false;
    if (
      !equal(
        prevProps.message.toolInvocations,
        nextProps.message.toolInvocations,
      )
    )
      return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return true;
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message "
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cx(
          'flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl',
          {
            'group-data-[role=user]/message:bg-muted': true,
          },
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
          <SparklesIcon size={14} />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Thinking...
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const DeepResearchProgress = ({
  state,
  activity,
}: {
  state: string;
  activity: Array<{
    type: string;
    status: string;
    message: string;
    timestamp: string;
    depth?: number;
    completedSteps?: number;
    totalSteps?: number;
  }>;
}) => {
  const { state: deepResearchState, updateProgress } = useDeepResearch();
  const [lastActivity, setLastActivity] = useState<string>('');
  const [startTime] = useState<number>(Date.now());
  const maxDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activity && activity.length > 0) {
      const lastItem = activity[activity.length - 1];
      setLastActivity(lastItem.message);

      // Update progress from activity if available
      if (
        lastItem.completedSteps !== undefined &&
        lastItem.totalSteps !== undefined
      ) {
        updateProgress(lastItem.completedSteps, lastItem.totalSteps);
      }
    }
  }, [activity, updateProgress]);

  // Calculate overall progress
  const progress = useMemo(() => {
    if (deepResearchState.totalExpectedSteps === 0) return 0;
    return Math.min(
      (deepResearchState.completedSteps /
        deepResearchState.totalExpectedSteps) *
        100,
      100,
    );
  }, [deepResearchState.completedSteps, deepResearchState.totalExpectedSteps]);

  // Calculate time progress
  const timeProgress = useMemo(() => {
    const elapsed = currentTime - startTime;
    return Math.min((elapsed / maxDuration) * 100, 100);
  }, [currentTime, startTime]);

  // Get current phase
  const currentPhase = useMemo(() => {
    if (!activity.length) return '';
    const current = activity[activity.length - 1];
    switch (current.type) {
      case 'search':
        return 'Searching';
      case 'extract':
        return 'Extracting';
      case 'analyze':
        return 'Analyzing';
      case 'synthesis':
        return 'Synthesizing';
      default:
        return 'Researching';
    }
  }, [activity]);

  // Format time
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const timeUntilTimeout = Math.max(maxDuration - (currentTime - startTime), 0);

  return (
    <div className="w-full space-y-3 rounded-2xl border border-[var(--color-scrollbar)]/50 bg-[var(--color-chat-bar)]/70 p-4 shadow-lg shadow-violet-900/20 backdrop-blur">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex flex-col gap-0.5 text-xs uppercase tracking-widest text-violet-200">
          <span>{currentPhase || 'Research in progress'}</span>
          <span className="text-[11px] text-muted-foreground">
            Depth {deepResearchState.currentDepth}/{deepResearchState.maxDepth}
          </span>
        </div>
        <div className="text-lg font-semibold text-white">
          {Math.round(progress)}%
        </div>
      </div>
      <Progress value={progress} className="w-full" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Time until timeout: {formatTime(timeUntilTimeout)}</span>
        <span>
          Steps {deepResearchState.completedSteps}/
          {deepResearchState.totalExpectedSteps || '—'}
        </span>
      </div>
      <div className="text-xs text-muted-foreground line-clamp-2">
        {lastActivity}
      </div>
    </div>
  );
};
