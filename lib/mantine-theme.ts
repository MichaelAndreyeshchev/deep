import { createTheme, MantineColorsTuple } from '@mantine/core';

// Custom color palette based on user requirements
const purple: MantineColorsTuple = [
  '#f7edff',
  '#d5bbff',
  '#b59aff',
  '#9679ff',
  '#7859ff',
  '#5a3aff',
  '#40384C',
  '#2A2235',
  '#231C2F',
  '#1f182a',
];

export const theme = createTheme({
  colors: {
    purple,
  },
  primaryColor: 'purple',
  defaultRadius: 'md',
  fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  headings: {
    fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  },
  other: {
    colorText: '#d5bbff',
    colorTextSecondary: '#f7edffff',
    colorBg: '#40384C',
    colorCodeBg: '#231c2f86',
    colorNav: '#231C2F',
    colorChatBar: '#2A2235',
    colorScrollbar: '#635b70ff',
    colorScrollbarHover: '#978ca4ff',
    mainSurfaceSecondary: '#40384C',
    colorNavDanger: '#51001a',
  },
});

// CSS variables for custom styling
export const customCSSVariables = `
:root {
  --color-text: #d5bbff;
  --color-text-s: #f7edffff;
  --color-bg: #40384C;
  --color-code-bg: #231c2f86;
  --color-nav: #231C2F;
  --color-chat-bar: #2A2235;
  --color-scrollbar: #635b70ff;
  --color-scrollbar-hover: #978ca4ff;
  --main-surface-secondary: #40384C;
  --color-nav-danger: #51001a;
  --main-surface-secondary-c: #40384C !important;
  --mantine-color-body: #40384C;
  --mantine-color-text: #f7edffff;
}

* {
  color: var(--color-text-s);
  scrollbar-color: var(--color-scrollbar) transparent;
}

*:hover {
  scrollbar-color: var(--color-scrollbar-hover) transparent;
}

body {
  color: var(--color-text);
  background: var(--color-bg);
}

h1, h2, h3, h4, h5, h6 {
  color: var(--color-text);
}

/* Code blocks */
code {
  background-color: var(--color-code-bg) !important;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar);
  border-radius: 6px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-scrollbar-hover);
}

/* Mantine specific overrides */
.mantine-Paper-root {
  background-color: var(--color-chat-bar);
  color: var(--color-text-s);
}

.mantine-Button-root {
  background-color: var(--color-nav);
}

.mantine-Button-root:hover {
  background-color: #45385d;
}

.mantine-TextInput-input,
.mantine-Textarea-input,
.mantine-Select-input {
  background-color: var(--color-chat-bar);
  color: var(--color-text-s);
  border-color: var(--color-scrollbar);
}

.mantine-Modal-content {
  background-color: var(--color-chat-bar);
}

.mantine-Tabs-tab[data-active] {
  background-color: var(--color-bg);
  border-color: var(--color-text);
}

/* Highlight.js styles */
.hljs {
  background: #1f182a !important;
}

.hljs-keyword {
  color: #ab82ff !important;
  font-weight: bold;
}

.hljs-string {
  color: #c4a7e7 !important;
}

.hljs-function .hljs-title,
.hljs-title {
  color: #ae81ff !important;
  font-weight: bold;
}

.hljs-number {
  color: #d291e4 !important;
}

.hljs-comment {
  color: #6c6783 !important;
  font-style: italic;
}

.hljs-variable {
  color: #ff92df !important;
}

.hljs-built_in {
  color: #ffd700 !important;
  font-weight: bold;
}

.hljs-attr,
.hljs-attribute {
  color: #e7c7ff !important;
}

.hljs-operator {
  color: #ff79c6 !important;
}

.hljs-tag {
  color: #ff6ac1 !important;
  font-weight: bold;
}

.hljs-literal {
  color: #f78c6c !important;
}
`;

