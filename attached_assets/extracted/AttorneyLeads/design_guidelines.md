# Design Guidelines: Attorney Leads - Florida Arrest Records Platform

## Design Approach

**Selected Framework**: Carbon Design System (Enterprise Data Applications)
**Justification**: This is a professional B2B tool requiring robust data handling, clear information hierarchy, and reliable workflows for legal professionals. Carbon's enterprise patterns excel at data-dense interfaces while maintaining usability.

**Core Design Principles**:
- Data clarity over visual flair
- Efficient task completion
- Professional credibility
- Scannable information architecture

---

## Typography System

**Font Family**: 
- Primary: Inter (Google Fonts) - body text, data tables, forms
- Display: Space Grotesk (Google Fonts) - page headers, section titles

**Type Scale**:
- Page Headers: text-4xl font-bold (Space Grotesk)
- Section Titles: text-2xl font-semibold (Space Grotesk)
- Subsection Headers: text-xl font-semibold (Inter)
- Body/Data Text: text-base font-normal (Inter)
- Table Headers: text-sm font-semibold uppercase tracking-wide (Inter)
- Table Data: text-sm font-normal (Inter)
- Button Text: text-sm font-medium (Inter)
- Helper Text: text-xs (Inter)

---

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16, 20
- Component internal padding: p-4, p-6
- Section spacing: mb-8, mb-12, mb-16
- Card/panel spacing: p-6, p-8
- Form field spacing: mb-4, mb-6
- Grid gaps: gap-4, gap-6, gap-8

**Container Strategy**:
- Dashboard max-width: max-w-7xl mx-auto px-4
- Data tables: Full-width within container
- Forms: max-w-2xl for optimal readability
- Modals: max-w-lg to max-w-2xl based on content

**Grid Layouts**:
- Stats overview: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6
- Job cards: grid-cols-1 lg:grid-cols-2 gap-6
- Settings/Config: grid-cols-1 md:grid-cols-2 gap-8

---

## Component Library

### Navigation
- **Top Navigation Bar**: Full-width, fixed position, height h-16
  - Logo/brand on left
  - Primary navigation links center/left
  - User account/settings on right
  - Icons: Heroicons (via CDN)

### Dashboard Components

**Stats Cards** (Key Metrics):
- Rounded borders (rounded-lg)
- Padding: p-6
- Display: Total Records, Active Jobs, Last Scrape Date, Export Count
- Include: Large number (text-3xl font-bold), label (text-sm), trend indicator icon

**Action Panel** (Primary Controls):
- Prominent "Start New Scrape" button (w-full md:w-auto)
- County multi-select dropdown
- Quick action buttons: View Records, Export CSV, Job History
- Padding: p-8, rounded-xl border

**Job Status Cards**:
- Real-time progress bars (h-2 rounded-full)
- Status badges: rounded-full px-3 py-1 text-xs font-medium
- Job metadata: County, Start Time, Records Found
- Action buttons: View Details, Cancel (for active jobs)

### Data Display

**Records Table**:
- Sticky header (sticky top-0)
- Alternating row treatment for scannability
- Columns: Inmate ID, Name, County, Booking Date, Charges, Bond Amount, Actions
- Column headers: text-left px-4 py-3 text-sm font-semibold uppercase tracking-wide
- Data cells: px-4 py-4 text-sm
- Row height: min-h-14 for touch-friendly interaction

**Table Controls**:
- Search bar: w-full md:max-w-md with search icon
- Filter dropdowns: County, Date Range, Bond Amount
- Pagination: Bottom-aligned with page numbers and prev/next
- Results per page selector
- Bulk actions: Select all checkbox, Export selected button

**Detail Panel/Modal**:
- Slide-out panel or centered modal
- Full arrest record details in vertical layout
- Labeled data pairs: font-semibold label, font-normal value
- Spacing between fields: mb-4
- Action buttons at bottom: Export, Add to CRM, Close

### Forms & Inputs

**Scrape Configuration Form**:
- Section labels: text-lg font-semibold mb-4
- Input fields: rounded-md border px-4 py-2.5 w-full
- Checkbox group for county selection: grid-cols-2 md:grid-cols-3 gap-4
- Helper text below inputs: text-xs mt-1
- Submit button: Prominent, full-width on mobile

**Search & Filter Bar**:
- Horizontal layout on desktop: flex gap-4
- Stacks on mobile: flex-col gap-4
- Filter icon triggers collapsible advanced filters
- Clear filters button: text-sm font-medium

### Status & Feedback

**Progress Indicators**:
- Linear progress bar for active scraping jobs
- Percentage display: text-sm font-medium
- Estimated time remaining
- Animated spinner for loading states

**Alert Messages**:
- Toast notifications: Fixed position top-right, slide-in animation
- Inline alerts: rounded-md p-4 border-l-4 mb-6
- Success, warning, error, info variants
- Dismissible with close icon

**Empty States**:
- Centered content: flex flex-col items-center justify-center py-12
- Illustration or icon (large size: w-24 h-24)
- Message: text-lg font-medium
- Call-to-action button below

### Buttons

**Primary Actions**: px-6 py-2.5 rounded-md font-medium
**Secondary Actions**: px-4 py-2 rounded-md font-medium border
**Text/Ghost Buttons**: px-3 py-1.5 font-medium
**Icon Buttons**: p-2 rounded-md (for table actions, close buttons)

### Cards & Panels

**Standard Card**: rounded-lg border p-6 mb-6
**Section Panel**: rounded-xl border p-8 mb-8
**Compact Info Card**: rounded-md p-4 border-l-4

---

## Page-Specific Layouts

### Dashboard (Landing Page)
1. **Header Bar** with navigation
2. **Stats Overview Row** (4-column grid on desktop)
3. **Primary Action Panel** with scrape configuration
4. **Active Jobs Section** - Grid of job status cards
5. **Recent Records Preview** - Abbreviated table (5-10 rows) with "View All" link

### Records Management Page
1. **Page Header** with title and primary export button
2. **Search/Filter Bar** spanning full width
3. **Data Table** with all records
4. **Pagination Controls** at bottom
5. **Bulk Action Bar** (sticky bottom when items selected)

### Job History Page
1. **Page Header** 
2. **Filter Controls**: Date range, status filter
3. **Job Cards Grid** - Chronological list of past jobs
4. **Load More** pagination

### Export/Settings Modal
1. **Modal Header** with title and close button
2. **Export Options Form**: Format selection, field mapping
3. **Preview Section**: First 5 rows of export data
4. **Action Footer**: Cancel and Export buttons (right-aligned)

---

## Images

**Hero Section on Marketing/Login Page** (if separate from dashboard):
- Professional image showing legal professionals or courtroom setting
- Dimensions: Full-width, 60vh height on desktop
- Placement: Top of page with overlay gradient
- Content overlay: Centered heading + subheading + CTA button with blurred background (backdrop-blur-md bg-opacity-90)

**Dashboard**: No hero image - purely functional interface
**Icons**: Heroicons throughout (via CDN) for consistency

---

## Accessibility & Interactions

- All form inputs have visible labels
- Focus states: outline-2 outline-offset-2 on interactive elements
- Keyboard navigation fully supported for tables and forms
- Screen reader text for icon-only buttons
- Sufficient contrast ratios for all text (WCAG AA minimum)
- Loading states prevent duplicate submissions