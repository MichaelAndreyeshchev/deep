# Quick Start Guide

## 🚀 Installation (3 steps)

### 1. Install Dependencies
```bash
cd C:\Users\micha\open-deep-research-1
pnpm install
```

### 2. Restart Docker
```bash
docker-compose down
docker-compose up -d --build
```

### 3. Access App
Open: **http://localhost:13000**

---

## ✨ New Features

### 1. Findings-to-Citations Mapping

When deep research completes, click the **Findings tab** to see:

```
┌──────────────────────────────────────────┐
│ Finding #1              Citation [2] ✓   │
│ "Quantum computing breaks RSA..."         │
│ Source: nature.com ↗                      │
└──────────────────────────────────────────┘
```

Each card shows:
- Which finding it is (#1, #2, #3...)
- Which citation [N] it belongs to
- Full text from the source
- Link to verify

### 2. Export Options

Three ways to export your research:

| Button | What It Does | File Name |
|--------|--------------|-----------|
| 📋 Copy | Copies markdown to clipboard | - |
| ⬇️ Markdown | Downloads .md file | `research-report-[topic].md` |
| 📄 PDF | Exports formatted PDF | `research-report-[topic].pdf` |

### 3. Interactive Citations

In the Report tab:
- **Hover** [N] → See tooltip with source
- **Click** [N] → Open source in new tab

Example:
> "AI is advancing rapidly [1][2]. New regulations needed [3]."

Citations [1], [2], [3] are clickable links!

---

## 🎨 Purple Theme

Everything is now styled in your custom purple theme:
- Background: Dark purple-gray (#40384C)
- Text: Light purple-white (#f7edffff)
- Accents: Violet/Purple tones
- Code blocks: Purple syntax highlighting

---

## 🧪 Test It

### Step 1: Start Deep Research
1. Open http://localhost:13000
2. Enable "Deep Research" mode
3. Ask: **"Research the impact of AI on healthcare"**

### Step 2: View Results
Wait for research to complete (2-5 minutes), then you'll see:
- Full report with citations [N]
- **NEW: Findings tab** - Click to see findings mapped to citations!
- Citations tab - All references

### Step 3: Explore
- Click different tabs (Report / Findings / Citations)
- Hover over [1], [2], [3] in the report
- Click citations to open sources
- Try exporting as PDF or Markdown

---

## 📋 Quick Reference

### What Changed
| Feature | Before | After |
|---------|--------|-------|
| Findings Display | Hidden in data | **Visible in Findings tab** ✅ |
| Citations | Plain text | **Clickable with tooltips** ✅ |
| Export | Basic | **Copy/MD/PDF with notifications** ✅ |
| UI Library | shadcn/ui | **Mantine** ✅ |
| Theme | Default | **Custom purple** ✅ |

### New Mantine Components
- `Paper` - Card containers
- `Tabs` - Report/Findings/Citations
- `Button` - Export actions
- `Card` - Finding display
- `Badge` - Labels (Finding #1, Citation [2])
- `Tooltip` - Hover info
- `Notifications` - Success/error messages
- `ActionIcon` - Icon buttons

---

## 🔍 Where Things Are

### Key Files
```
app/
├── layout.tsx           # Mantine setup
├── mantine-styles.css   # Custom purple theme
└── (chat)/api/chat/
    └── route.ts         # Sends findings data

components/
└── research-report-mantine.tsx  # NEW component with tabs

lib/
└── mantine-theme.ts     # Theme config
```

### Important URLs
- App: http://localhost:13000
- Mantine Docs: https://mantine.dev/

---

## 🎯 Usage Tips

### Best Practices
1. **Use Deep Research** for full features (findings tab only works with deep research)
2. **Check Findings Tab** to verify sources for each finding
3. **Export before closing** - Save important research
4. **Click citations** to verify information

### Keyboard Shortcuts
- `Ctrl + K` - Open search
- `Ctrl + C` - Copy (when text selected)

---

## ⚠️ Troubleshooting

### Problem: Styles look wrong
**Solution**: Clear cache and rebuild
```bash
pnpm install --force
docker-compose down
docker-compose up -d --build
```

### Problem: Findings tab is empty
**Reason**: Findings only come from deep research
**Solution**: Make sure deep research mode is enabled

### Problem: Export doesn't work
**Check**: Browser console for errors
**Try**: Use Copy button instead, paste elsewhere

### Problem: Dark theme not applying
**Check**: `defaultColorScheme="dark"` in layout.tsx
**Verify**: Mantine styles are imported

---

## 📊 What to Expect

### Typical Research Session
- **Duration**: 2-5 minutes
- **Findings**: 10-30 pieces of information
- **Sources**: 15-30 unique sources
- **Citations**: 20-50+ inline citations
- **Report Length**: 3,000-8,000 words

### Report Structure
```markdown
# Research Report: [Your Topic]

## Executive Summary
[High-level overview with citations [N]]

## Detailed Findings
[In-depth analysis with citations [N]]

## Key Insights
[Important discoveries with citations [N]]

## Conclusions
[Summary and implications with citations [N]]

## References
[1] Source Title - URL
[2] Source Title - URL
...
```

---

## ✅ Success Checklist

After installing, verify:
- [ ] App loads at http://localhost:13000
- [ ] Purple theme is visible
- [ ] Can start deep research
- [ ] Report shows with 3 tabs
- [ ] **Findings tab** shows mapped findings ⭐
- [ ] Citations are clickable
- [ ] Can export PDF
- [ ] Can export Markdown
- [ ] Can copy to clipboard
- [ ] Notifications appear

---

## 💡 Pro Tips

1. **Organize findings by citation**: Use Findings tab to see which sources provided which information

2. **Verify before using**: Click citation links to check original sources

3. **Save important research**: Export as Markdown for documentation or PDF for presentations

4. **Use filters**: The blocklist automatically filters out low-quality sources

5. **Check all tabs**: 
   - Report: Read the full analysis
   - Findings: See source mapping
   - Citations: Browse all references

---

## 📞 Need Help?

1. Check `MANTINE_MIGRATION_COMPLETE.md` for full details
2. See `RESEARCH_FEATURES.md` for research system docs
3. Visit https://mantine.dev/ for Mantine docs
4. Check Docker logs: `docker-compose logs app`

---

**Ready to go!** 🎉

Run these commands and start researching:
```bash
pnpm install
docker-compose down && docker-compose up -d --build
```

Then open: http://localhost:13000

