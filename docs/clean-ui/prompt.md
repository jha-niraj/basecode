# Prompt for another Claude session

Paste this, with the folder copied into that project as `docs/clean-ui/`:

---

Read `docs/clean-ui/README.md`, `controls.md` and `layout.md` - the clean UI rules learned from runable.com (neutral
greys, not beige). Then map this codebase's shared controls against them (button, dropdown menu, select, input,
textarea, tabs/chips, empty state, sidebar footer, the chat composer) and tell me what differs, with file paths. Ask me
with the question picker before changing anything. Then change the SHARED components first (36px controls, tone
fills with a 5-8% edge instead of white + grey border, soft rounded-2xl menus with 36px rows and thin 16px icons, a
SplitButton for actions with 2-4 ways in, pill ChoiceChips for filters, EmptyState with a Suggestions list, a FilterSheet for
filters that do not fit, a ChatStart screen with the composer at the bottom, one account menu in the sidebar footer
opening on hover with the assistant on its own row above), pilot on two pages, tell me which pages to look
at, and roll out everywhere only after I approve. No sparkle icons for AI, nothing bold, plain hyphens.

---
