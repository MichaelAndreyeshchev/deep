'use client';

import type { Attachment, CreateMessage, Message } from 'ai';
import type { ChatRequestOptions } from '@/lib/types';
import cx from 'classnames';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import { sanitizeUIMessages } from '@/lib/utils';

import { ArrowUpIcon, PaperclipIcon, StopIcon, } from './icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { SuggestedActions } from './suggested-actions';
import equal from 'fast-deep-equal';
import { useDeepResearch } from '@/lib/deep-research-context';
import { DeepResearch } from './deep-research';
import { Telescope, Search, FolderOpen } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { DocumentManager } from './document-manager';

type SearchMode = 'search' | 'deep-research';

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  isLoading,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  handleSubmit,
  className,
  searchMode,
  setSearchMode,
}: {
  chatId: string;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<Message>;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
  className?: string;
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const { state: deepResearchState } = useDeepResearch();


  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = '98px';
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const submitForm = useCallback(() => {
    window.history.replaceState({}, '', `/chat/${chatId}`);

    handleSubmit(undefined, {
      experimental_attachments: attachments,
      experimental_deepResearch: searchMode === 'deep-research',
    });

    setAttachments([]);
    setLocalStorageInput('');
    resetHeight();

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    attachments,
    handleSubmit,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    searchMode,
  ]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      toast.error('Failed to upload file, please try again!');
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  return (
    <div className="relative w-full flex flex-col gap-4">
      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions append={append} chatId={chatId} />
        )}

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div className="flex flex-row gap-2 overflow-x-scroll items-end">
          {attachments.map((attachment) => (
            <PreviewAttachment 
              key={attachment.url} 
              attachment={attachment}
              onRemove={() => setAttachments(prev => prev.filter(a => a.url !== attachment.url))}
            />
          ))}

          {uploadQueue.map((filename) => (
            <PreviewAttachment
              key={filename}
              attachment={{
                url: '',
                name: filename,
                contentType: '',
              }}
              isUploading={true}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {searchMode === 'deep-research' && <DeepResearch
          isActive={searchMode === 'deep-research'}
          onToggle={() => {}}
          isLoading={isLoading}
          activity={deepResearchState.activity}
          sources={deepResearchState.sources}
          deepResearch={searchMode === 'deep-research'}
        />}

        <Textarea
          ref={textareaRef}
          placeholder="Send a message..."
          value={input}
          onChange={handleInput}
          className={cx(
            'min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base bg-muted pb-10 dark:border-zinc-700',
            className,
          )}
          rows={2}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();

              if (isLoading) {
                toast.error(
                  'Please wait for the model to finish its response!',
                );
              } else {
                submitForm();
              }
            }
          }}
        />
      </div>

      <div className="absolute bottom-0 p-2 flex flex-row gap-2 justify-start items-center">
        <AttachmentsButton fileInputRef={fileInputRef} isLoading={isLoading} />
        <DocumentsButton isLoading={isLoading} />
        {/* o3 Deep Research (Responses API) dialog */}
        <O3DeepResearchButton initialQuery={input} isLoading={isLoading} />
        <Tabs
          value={searchMode}
          onValueChange={(value) => {
            setSearchMode(value as SearchMode);
          }}
        >
          <TabsList className="bg-transparent border rounded-full p-1 h-fit">
            <TabsTrigger
              value="search"
              className="rounded-full px-3 py-1.5 h-fit flex items-center gap-2 data-[state=inactive]:bg-transparent data-[state=active]:bg-orange-50 hover:bg-orange-50/50 data-[state=active]:text-orange-600 border-0 data-[state=active]:shadow-none transition-colors"
            >
              <Search size={14} />
              Search
            </TabsTrigger>
            <TabsTrigger
              value="deep-research"
              className="rounded-full px-3 py-1.5 h-fit flex items-center gap-2 data-[state=inactive]:bg-transparent data-[state=active]:bg-orange-50 hover:bg-orange-50/50 data-[state=active]:text-orange-600 border-0 data-[state=active]:shadow-none transition-colors"
            >
              <Telescope size={14} />
              Deep Research
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
        {isLoading ? (
          <StopButton stop={stop} setMessages={setMessages} />
        ) : (
          <SendButton
            input={input}
            submitForm={submitForm}
            uploadQueue={uploadQueue}
          />
        )}
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    if (prevProps.searchMode !== nextProps.searchMode) return false;
    return true;
  },
);

function PureAttachmentsButton({
  fileInputRef,
  isLoading,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  isLoading: boolean;
}) {
  return (
    <Button
      className="rounded-md rounded-bl-lg p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={isLoading}
      variant="ghost"
    >
      <PaperclipIcon size={14} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
}) {
  return (
    <Button
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => sanitizeUIMessages(messages));
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
}) {
  return (
    <Button
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={input.length === 0 || uploadQueue.length > 0}
    >
      <ArrowUpIcon size={14} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  return true;
});

function PureO3DeepResearchButton({
  initialQuery,
  isLoading,
}: {
  initialQuery: string;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'initial' | 'clarify' | 'complete'>(
    'initial',
  );
  const [query, setQuery] = useState(initialQuery);
  const [questionsText, setQuestionsText] = useState('');
  const [answers, setAnswers] = useState('');
  const [report, setReport] = useState('');
  const [citations, setCitations] = useState<
    Array<{ index: number; title: string; url: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  const resetState = () => {
    setStep('initial');
    setQuestionsText('');
    setAnswers('');
    setReport('');
    setCitations([]);
  };

  const handleRun = async () => {
    if (!query.trim()) {
      toast.error('Please enter a research question first.');
      return;
    }

    try {
      setLoading(true);

      if (step === 'initial') {
        const res = await fetch('/api/deep-research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Deep research request failed');
        }

        const data = await res.json();
        if (data.status === 'needs-clarification') {
          setQuestionsText(data.questionsText || '');
          setStep('clarify');
        } else if (data.status === 'complete') {
          setReport(data.report || '');
          setCitations(data.citations || []);
          setStep('complete');
        } else {
          throw new Error('Unexpected response from deep research API');
        }
      } else if (step === 'clarify') {
        const clarifications = {
          [questionsText || 'Questions']: answers || 'No additional details.',
        };

        const res = await fetch('/api/deep-research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, clarifications }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Deep research request failed');
        }

        const data = await res.json();
        if (data.status === 'complete') {
          setReport(data.report || '');
          setCitations(data.citations || []);
          setStep('complete');
        } else {
          throw new Error('Unexpected response from deep research API');
        }
      }
    } catch (error: any) {
      console.error('o3 Deep Research error:', error);
      toast.error(error?.message || 'Deep research failed');
    } finally {
      setLoading(false);
    }
  };

  // Automatically trigger clarifying questions when dialog opens,
  // so the user does not need to click a separate "Ask clarifying questions" step.
  useEffect(() => {
    if (open && step === 'initial' && query.trim() && !loading) {
      // Fire and forget; errors are handled inside handleRun
      void handleRun();
    }
  }, [open, step, query, loading]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          resetState();
        } else {
          setQuery(initialQuery);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          className="rounded-md p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200"
          disabled={isLoading}
          variant="ghost"
          title="Run deep research with o3 (Responses API)"
        >
          <Telescope size={14} />
          <span className="ml-1 text-xs">o3</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>o3 Deep Research</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Research question
            </label>
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
            />
          </div>

          {step === 'clarify' && (
            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium text-muted-foreground">
                Clarifying questions from o3
              </div>
              <div className="rounded-md border bg-muted p-2 text-xs whitespace-pre-wrap">
                {questionsText}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Your answers (free-form)
                </label>
                <Textarea
                  value={answers}
                  onChange={(e) => setAnswers(e.target.value)}
                  rows={4}
                  placeholder="Answer the questions above to guide the research..."
                />
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium text-muted-foreground">
                Research report
              </div>
              <div className="rounded-md border bg-muted p-2 text-xs whitespace-pre-wrap max-h-[40vh] overflow-y-auto">
                {report}
              </div>
              {citations.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Citations
                  </div>
                  <ul className="text-xs list-disc pl-4 space-y-1">
                    {citations.map((c) => (
                      <li key={c.index}>
                        [{c.index}] {c.title} –{' '}
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {c.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              resetState();
              setOpen(false);
            }}
          >
            Close
          </Button>
          <Button onClick={handleRun} disabled={loading}>
            {step === 'complete' ? 'Run again' : 'Run deep research'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const O3DeepResearchButton = memo(PureO3DeepResearchButton);

function PureDocumentsButton({
  isLoading,
}: {
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="rounded-md p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200"
          disabled={isLoading}
          variant="ghost"
          title="Manage Documents"
        >
          <FolderOpen size={14} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Document Manager</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1">
          <DocumentManager />
        </div>
      </DialogContent>
    </Dialog>
  );
}

const DocumentsButton = memo(PureDocumentsButton);
