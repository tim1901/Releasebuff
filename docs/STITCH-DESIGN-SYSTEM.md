---
name: Releasebuff Intelligence
colors:
  surface: '#fafaf4'
  surface-dim: '#dadad5'
  surface-bright: '#fafaf4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f4ee'
  surface-container: '#eeeee8'
  surface-container-high: '#e8e8e3'
  surface-container-highest: '#e3e3dd'
  on-surface: '#1a1c19'
  on-surface-variant: '#414844'
  inverse-surface: '#2f312d'
  inverse-on-surface: '#f1f1eb'
  outline: '#717973'
  outline-variant: '#c1c8c2'
  surface-tint: '#406654'
  primary: '#002719'
  on-primary: '#ffffff'
  primary-container: '#173d2d'
  on-primary-container: '#80a893'
  inverse-primary: '#a7d0b9'
  secondary: '#466800'
  on-secondary: '#ffffff'
  secondary-container: '#bfef6f'
  on-secondary-container: '#4a6d00'
  tertiary: '#1d231d'
  on-tertiary: '#ffffff'
  tertiary-container: '#323831'
  on-tertiary-container: '#9ba198'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c2ecd5'
  primary-fixed-dim: '#a7d0b9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#294e3d'
  secondary-fixed: '#c2f271'
  secondary-fixed-dim: '#a7d558'
  on-secondary-fixed: '#121f00'
  on-secondary-fixed-variant: '#344e00'
  tertiary-fixed: '#dee4da'
  tertiary-fixed-dim: '#c2c8bf'
  on-tertiary-fixed: '#171d17'
  on-tertiary-fixed-variant: '#424841'
  background: '#fafaf4'
  on-background: '#1a1c19'
  surface-variant: '#e3e3dd'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 19px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 17px
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 15px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 13px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1.25rem
  margin-lg: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style
The design system operates at the nexus of technical rigor and public product craft. Designed for founders, lead engineers, and builders operating in the open, the interface rejects marketing fluff in favor of an instrumentation panel aesthetic: disciplined, information-dense, and grounded in concrete artifact trails.

The visual narrative draws from high-precision engineering manuals and modern developer tooling. It combines structural grid lines, tactile metadata blocks, and tabular monospaced tags with a deep botanical forest palette and high-visibility electric lime cues. The emotional tone evokes calm certainty, meticulous craftsmanship, and systematic accountability—transforming noisy raw commits and Pull Requests into authentic build-in-public stories.

## Colors
The system relies on a calibrated botanical-technical hierarchy:

- **Primary Deep Forest (`#173D2D`)**: Anchors global navigational chrome, primary active states, structural headers, and command triggers.
- **Electric Lime Accent (`#C9FA78`)**: High-intent, non-destructive focal point used for primary call-to-actions, live indicators, pipeline stage markers, and success-ready cues. Paired strictly with dark ink for accessible contrast.
- **Secondary Soft Panel (`#EAF0E6`)**: Nested card tiers, inspector panes, and metadata groupings.
- **Warm Canvas Neutral (`#F8F8F2`)**: Base surface layer that softens prolonged work sessions compared to harsh pure white.
- **Crisp Dark Ink (`#1E2922`)**: High-contrast body typography, critical metrics, and readable header text.
- **Subtle Structural Borders (`#D9E2D8`)**: Hairline dividers defining high-density grids and contextual cards.
- **Muted Metadata Ink (`#5D6B61`)**: Timestamps, git SHA identifiers, pipeline indexes, and auxiliary labels.

Status and evidence badges draw from subtle tinted fills anchored by structured borders:
- **Git/Evidence Badges**: Neutral light tint `#F0F4EE` with `#1E2922` ink.
- **State Badges (e.g., Ready to Draft, Scheduled)**: Lime wash `#E4F7C7` with `#173D2D` ink, or forest wash with white ink for published states.

## Typography
Typography creates a strong architectural contrast between primary product copy and telemetry data. 

- **Primary UI & Headings (Hanken Grotesk)**: Renders with sharp terminals, robust x-height, and neutral precision. Display sizes employ tighter letter tracking to preserve density and authority.
- **Instrumentation & Metadata (JetBrains Mono)**: Applied to all pipeline step indicators (`RBF.01 / DISCOVER`), git reference SHAs, taxonomy group keys, timestamps, UTC offsets, and evidence flags. Monospaced layers must use tabular numbers (`tnum`) for columnar alignment across dense tables and proof trees.

## Layout & Spacing
The layout follows a disciplined 12-column grid system paired with split workbench primitives (feed list, proof drawer, distribution modal).

- **Grid & Columns**: 12-column dynamic layout with standard desktop container bounds capping at 1440px. The main viewport defaults to a two-pane workbench: a 7-column discovery/evidence stream and a 5-column draft inspection and context ledger.
- **Rhythm**: Spacing follows a compact 4px base increment. High-density zones (diff views, metadata cards, taxonomy matrices) rely on `space-xs` (4px) and `space-sm` (8px) for internal padding to maximize information density.
- **Responsive Adaptations**:
  - **Desktop (>=1024px)**: Full multi-pane workflow with persistent pipeline status and dockable side inspector.
  - **Tablet (768px - 1023px)**: 8-column layout; secondary panels collapse into bottom drawers or slide-in sheets. Margins compress to 1.5rem.
  - **Mobile (<768px)**: 4-column single-stack stream. Proof badges, commit pills, and taxonomy matrices reflow into horizontal scrolling chips. Margins compress to 1.25rem.

## Elevation & Depth
Visual hierarchy is achieved through structural borders and tonal tiering rather than diffuse shadows.

- **Hairline Boundary Tiers**: Surfaces are demarcated by `1px solid #D9E2D8`. Overlapping surfaces never use heavy drop shadows; depth is conveyed via strict z-indexing, hairline dividers, and slight shifts between `#F8F8F2` (canvas), `#EAF0E6` (sub-tier panel), and `#FFFFFF` (elevated card surface).
- **Transient Layers (Drawers & Modals)**: Buffer integration modals and proof-grounded drawer previews feature a 1px border (`#D9E2D8`), an ambient blur backdrop (`rgba(23, 61, 45, 0.2)` with `backdrop-filter: blur(4px)`), and a minimal structural keyline shadow: `0 4px 16px rgba(30, 41, 34, 0.08)`.
- **Focus & Selection**: Selected evidence rows and card focus use a 1px inner border outline rendered in Deep Forest (`#173D2D`) or an Electric Lime (`#C9FA78`) accent pip.

## Shapes
The shape philosophy favors compact, calibrated geometry (`roundedness: 1` / 4px base border radius).

- **Cards, Panels & Inputs**: Use 4px border radii (`0.25rem`) to maintain an architectural, technical aesthetic.
- **System Tags, Badges & Pills**: Evidence markers (PR, Issue, Commit) and Taxonomy items adopt a 2px to 4px crisp corner radius, avoiding soft consumer-style pills to preserve an engineering-grade instrument feel.
- **Exceptions**: Status indicators (e.g., active pipeline pulse dots) and selection dots remain circular (`rounded-full`).

## Components

### 1. Buttons & Triggers
- **Primary Action (Publish / Push to Buffer)**: Background `#C9FA78`, label `#173D2D` in bold JetBrains Mono or semi-bold Hanken Grotesk, 1px border `#173D2D`. Hover triggers slight brightness adjustment with solid dark underline.
- **Secondary Action (Interpret / Contextualize)**: Background `#173D2D`, label `#F8F8F2`, 1px border `#173D2D`.
- **Tertiary / Utility (Evidence Filter, Raw Diff)**: Background `#FFFFFF`, label `#1E2922`, 1px border `#D9E2D8`. Hover transitions to `#EAF0E6`.

### 2. Pipeline System Tags & Stage Trackers
- Encoded with prefix typography `JetBrains Mono` (`label-sm` or `label-md`).
- Step indicator format: `RBF.01 / DISCOVER`, `RBF.02 / INTERPRET`, `RBF.03 / DRAFT`, `RBF.04 / PUBLISH`.
- Active steps display a 6px `#C9FA78` square prefix glyph; inactive or completed steps show neutral muted borders.

### 3. Evidence Badges
- Compact tokens dedicated to raw artifact references: `PR #142`, `commit: 8f3c1a`, `diff: +142/-18`.
- Styled with `JetBrains Mono`, 11px font size, `#F0F4EE` background, `#1E2922` text, and a `#D9E2D8` perimeter outline. Interactive badges feature an external link glyph.

### 4. 16-Category Taxonomy Matrix
Organized across 4 foundational groups with explicit visual keys:
- **Product Progress**: Architecture, Feature Ship, Bug Squashing, Performance Win.
- **Learning & Craft**: Tech Stack Pivot, Tooling Insight, Post-Mortem, Best Practice.
- **Product Marketing**: Value Proposition, Launch Update, Teaser/Demo, User Feedback.
- **Audience & Growth**: Metric Milestone, Open Source Note, Community Voice, Revenue Reflection.
- Components use 10px uppercase mono tags with low-saturation colored dot indicators or muted borders to avoid visual clutter when multiple tags are affixed to a single discovery card.

### 5. Status Pills
- High-contrast states: `New`, `Needs Context`, `Ready to Draft`, `Drafted`, `Scheduled`, `Published`.
- Rendered with 11px mono labels, 2px radius, and dedicated status tints (e.g., `Ready to Draft` paired with lime accent wash; `Needs Context` paired with a cautionary amber outline).

### 6. Cards & Workbench Feed Units
- Background `#FFFFFF` sitting over `#F8F8F2` canvas, bordered with 1px `#D9E2D8`.
- Header houses system code, timestamp, and primary taxonomy badge. Body presents synthesized discovery thesis, followed by raw code/PR evidence chips along the footer.

### 7. Form Controls & Schedule Inputs
- Input fields use 12px monospaced inputs with 1px `#D9E2D8` borders and 6px padding.
- Focused inputs shift border to `#173D2D` with zero diffuse glow.
- **UTC Time Controls**: Tabular digit spinners with timezone chips locked to UTC standards.

### 8. Buffer Integration Modal & Proof Drawer
- Modal windows are anchored by a structured header: breadcrumb path, account handle preview, and social channel destination chips (e.g., X, LinkedIn, Mastodon).
- Proof drawer docks to the right screen edge, offering side-by-side verification between the generated draft and the source git diff lines.