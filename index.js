const express = require('express');
const nacl = require('tweetnacl');

const app = express();

// === CONFIG ===
const PK = process.env.DISCORD_PUBLIC_KEY;
const BT = process.env.DISCORD_BOT_TOKEN;
const APP_ID = process.env.DISCORD_APPLICATION_ID || '1532584353710735370';
const GUILD_ID = process.env.GUILD_ID || '1532583796929728512';
const BOT_API_URL = process.env.BOT_API_URL || 'https://vesper-fe683526.base44.app/functions/botApi';
const BOT_API_SECRET = process.env.BOT_API_SECRET || 'flipbot-bot-api-2026';
const PROV_URL = 'https://vesper-fe683526.base44.app/functions/provisionTemplateServer';
const CK_URL = 'https://vesper-fe683526.base44.app/functions/createCheckoutSession';
const ONE44_URL = 'https://one44.base44.app/functions';
const PORT = process.env.PORT || 3000;

const ROLE_MEMBER = '1532596411395215493';
const ROLE_BUILDER = '1532834237491970151';
const ROLE_SHIPPED = '1532596421470191829';

const FOOTER = 'ONE/44 OS · Powered by FlipBot';
const LOGO = 'https://media.base44.com/images/public/6a6c0faeaea192b5fe683526/6cb74b688_FlipBot-by-SLY-App-Cover.png';
const COBRAND_BANNER = 'https://media.base44.com/images/public/6a6c0faeaea192b5fe683526/38ef78e42_image.png';
const C = { brand: 0x7C5CFC, success: 0x4ADE80, warn: 0xF59E0B, error: 0xEF4444, info: 0x3B82F6, dark: 0x1A1A2E };

// === HELPERS ===
function verifySig(body, sig, ts, key) {
  try { return nacl.sign.detached.verify(Buffer.from(ts + body), Buffer.from(sig, 'hex'), Buffer.from(key, 'hex')); }
  catch { return false; }
}

function san(s, max = 2000) { return (s || '').substring(0, max).replace(/[`@#<>]/g, ''); }

function embed(title, desc, color, fields, thumb, banner) {
  return { title, description: desc, color: color ?? C.brand, fields: fields || [], footer: { text: FOOTER }, timestamp: new Date().toISOString(), ...(thumb ? { thumbnail: { url: LOGO } } : {}), ...(banner ? { image: { url: COBRAND_BANNER } } : {}) };
}

function E(o) {
  const d = { embeds: [embed(o.title, o.desc, o.color, o.fields, o.thumb)], flags: 64 };
  if (o.components) d.components = o.components;
  return { type: 4, data: d };
}

function eph(c) { return { type: 4, data: { content: c, flags: 64 } }; }
function f(n, v, i = true) { return { name: n, value: v, inline: i }; }
function sp() { return { name: '\u200B', value: '\u200B', inline: false }; }
function tip(t) { return { name: '💡 Tip', value: t, inline: false }; }

function modal(cid, title, components) { return { type: 9, data: { custom_id: cid, title, components } }; }
function textRow(cid, label, style = 1, required = false, placeholder = '') {
  return { type: 1, components: [{ type: 4, custom_id: cid, label, style, required, placeholder }] };
}

function getOptions(opts) {
  const m = new Map();
  if (!opts) return m;
  for (const o of opts) { m.set(o.name, o.value); if (o.options) for (const [k, v] of getOptions(o.options)) m.set(k, v); }
  return m;
}

async function assignRole(uid, rid) {
  if (!BT || !uid || !rid) return;
  try { await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${uid}/roles/${rid}`, { method: 'PUT', headers: { Authorization: `Bot ${BT}` } }); } catch {}
}

// === DB API ===
async function db(action, entity, data, id) {
  try {
    const res = await fetch(BOT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${BOT_API_SECRET}` },
      body: JSON.stringify({ action, entity, data, id })
    });
    return await res.json();
  } catch (e) { console.error('DB API error:', e); return null; }
}

// === WIZARD DATA ===
const TYPES = [
  { label: 'Internal Operations Tool', value: 'ops', description: 'Dashboards, admin panels, workflow systems', emoji: { name: '⚙️' } },
  { label: 'Customer Portal', value: 'cust', description: 'Client access, account management, support', emoji: { name: '🏪' } },
  { label: 'AI Product', value: 'ai', description: 'AI-powered tools, generators, analyzers', emoji: { name: '🤖' } },
  { label: 'Education Platform', value: 'edu', description: 'Courses, LMS, training, assessment', emoji: { name: '📚' } },
  { label: 'Marketplace', value: 'mkt', description: 'Listings, transactions, vendor profiles', emoji: { name: '🛒' } },
  { label: 'Community Hub', value: 'com', description: 'Forums, events, profiles, moderation', emoji: { name: '👥' } },
  { label: 'Creative Experience', value: 'crt', description: 'Portfolios, galleries, generators', emoji: { name: '🎨' } },
];
const VISUALS = [
  { label: 'Precision Editorial', value: 'precise', description: 'Clean, typographic, content-first', emoji: { name: '✒️' } },
  { label: 'Operational Command Center', value: 'command', description: 'Dark, dense, data-driven', emoji: { name: '🎛️' } },
  { label: 'Institutional Intelligence', value: 'institution', description: 'Professional, structured, trustworthy', emoji: { name: '🏛️' } },
  { label: 'Luxury Minimal', value: 'lux', description: 'Spacious, elegant, premium', emoji: { name: '✨' } },
  { label: 'Creative Technology', value: 'creative', description: 'Bold, experimental, modern', emoji: { name: '🌈' } },
  { label: 'Warm & Human', value: 'warm', description: 'Friendly, approachable, soft', emoji: { name: '🤝' } },
  { label: 'High-Density Technical', value: 'technical', description: 'Compact, information-rich, functional', emoji: { name: '📊' } },
];
const MODES = [
  { label: 'Quick Build', value: 'quick', description: 'Smaller app, one primary workflow', emoji: { name: '⚡' } },
  { label: 'Guided Architect', value: 'guided', description: 'Serious product, full architecture', emoji: { name: '🏗️' } },
  { label: 'Challenge Mode ⭐ Featured', value: 'challenge', description: 'Competition-optimized, full demo', emoji: { name: '🏆' } },
];
const TN = { ops:'Internal Operations Tool', cust:'Customer Portal', ai:'AI Product', edu:'Education Platform', mkt:'Marketplace', com:'Community Hub', crt:'Creative Experience' };
const VN = { precise:'Precision Editorial', command:'Operational Command Center', institution:'Institutional Intelligence', lux:'Luxury Minimal', creative:'Creative Technology', warm:'Warm & Human', technical:'High-Density Technical' };
const MN = { quick:'Quick Build', guided:'Guided Architect', challenge:'Challenge Mode' };

// === ELITE PROMPT COMPILER (instant, no AI needed) ===
function compileElitePrompt(type, visual, mode, idea, features) {
  const typeName = TN[type] || type;
  const visualName = VN[visual] || visual;
  const modeName = MN[mode] || mode;

  // Design systems per visual selection
  const DS = {
    precise: { bg: '#FAFAFA', surface: '#FFFFFF', primary: '#0F172A', accent: '#3B82F6', success: '#10B981', warning: '#F59E0B', danger: '#EF4444', font: 'Inter', mood: 'Clean, typographic, content-first. Generous whitespace. Editorial layout.' },
    command: { bg: '#0A0F1E', surface: '#111827', primary: '#E2E8F0', accent: '#3B82F6', success: '#10B981', warning: '#F59E0B', danger: '#EF4444', font: 'JetBrains Mono', mood: 'Dark, dense, data-driven. Dashboard aesthetic. Compact spacing.' },
    institution: { bg: '#F8FAFC', surface: '#FFFFFF', primary: '#1E293B', accent: '#2563EB', success: '#059669', warning: '#D97706', danger: '#DC2626', font: 'Source Sans 3', mood: 'Professional, structured, trustworthy. Institutional clarity.' },
    lux: { bg: '#FFFFFF', surface: '#FAFAFA', primary: '#1A1A1A', accent: '#B8860B', success: '#2D5F2D', warning: '#B8860B', danger: '#8B0000', font: 'Playfair Display', mood: 'Spacious, elegant, premium. Luxury minimal with gold accents.' },
    creative: { bg: '#0D0D0D', surface: '#1A1A2E', primary: '#F0F0F0', accent: '#7C3AED', success: '#10B981', warning: '#F59E0B', danger: '#EF4444', font: 'Space Grotesk', mood: 'Bold, experimental, modern. Creative technology with vibrant accents.' },
    warm: { bg: '#FFFBEB', surface: '#FFFFFF', primary: '#292524', accent: '#EA580C', success: '#16A34A', warning: '#CA8A04', danger: '#DC2626', font: 'Plus Jakarta Sans', mood: 'Friendly, approachable, soft. Warm tones, rounded corners, human feel.' },
    technical: { bg: '#0F172A', surface: '#1E293B', primary: '#F1F5F9', accent: '#06B6D4', success: '#10B981', warning: '#F59E0B', danger: '#EF4444', font: 'IBM Plex Sans', mood: 'Compact, information-rich, functional. High-density technical.' },
  };
  const ds = DS[visual] || DS.precise;

  // Mode-specific directives
  const MODE_DIR = {
    quick: 'Build the COMPLETE app in one shot. All features are Phase 1. No phased delivery — ship everything now.',
    guided: 'Build in 2 phases. Phase 1: MVP (P0 features, core flows, auth). Phase 2: Growth (P1 features, integrations, polish).',
    challenge: 'Competition-optimized build. Include ALL features (P0+P1+P2), advanced patterns, edge cases, and demo-ready polish. This must impress judges.',
  };

  // Entity templates per app type
  const ENTITIES = {
    ops: 'Entity: Task\n  - title: string (required)\n  - description: text\n  - status: enum[todo, in_progress, done, blocked]\n  - priority: enum[low, medium, high, urgent]\n  - assignee_id: reference User\n  - due_date: date\n  - created_date: datetime\n  - updated_date: datetime\n\nEntity: Project\n  - name: string (required)\n  - description: text\n  - status: enum[active, on_hold, completed]\n  - owner_id: reference User\n  - created_date: datetime\n\nEntity: ActivityLog\n  - action: string\n  - entity_type: string\n  - entity_id: string\n  - user_id: reference User\n  - timestamp: datetime\n  - metadata: text',
    cust: 'Entity: Account\n  - company_name: string (required)\n  - plan: enum[free, pro, enterprise]\n  - status: enum[active, trial, suspended]\n  - owner_id: reference User\n  - created_date: datetime\n\nEntity: Ticket\n  - subject: string (required)\n  - description: text\n  - status: enum[open, in_progress, resolved, closed]\n  - priority: enum[low, medium, high]\n  - account_id: reference Account\n  - assignee_id: reference User\n  - created_date: datetime\n\nEntity: Invoice\n  - amount: number\n  - status: enum[draft, sent, paid, overdue]\n  - account_id: reference Account\n  - due_date: date\n  - created_date: datetime',
    ai: 'Entity: Generation\n  - prompt: text (required)\n  - output: text\n  - type: enum[text, image, code, analysis]\n  - status: enum[pending, completed, failed]\n  - user_id: reference User\n  - created_date: datetime\n\nEntity: Template\n  - name: string (required)\n  - system_prompt: text\n  - variables: text\n  - category: string\n  - is_public: boolean\n  - created_date: datetime\n\nEntity: APIKey\n  - key_name: string\n  - key_value: string\n  - usage_count: number\n  - last_used: datetime\n  - user_id: reference User',
    edu: 'Entity: Course\n  - title: string (required)\n  - description: text\n  - instructor_id: reference User\n  - status: enum[draft, published, archived]\n  - created_date: datetime\n\nEntity: Lesson\n  - title: string (required)\n  - content: text\n  - order: number\n  - course_id: reference Course\n  - duration_minutes: number\n\nEntity: Enrollment\n  - course_id: reference Course\n  - user_id: reference User\n  - progress: number\n  - status: enum[active, completed, dropped]\n  - enrolled_date: datetime',
    mkt: 'Entity: Listing\n  - title: string (required)\n  - description: text\n  - price: number\n  - status: enum[active, sold, draft, expired]\n  - seller_id: reference User\n  - category: string\n  - created_date: datetime\n\nEntity: Order\n  - listing_id: reference Listing\n  - buyer_id: reference User\n  - amount: number\n  - status: enum[pending, completed, cancelled, refunded]\n  - created_date: datetime\n\nEntity: Review\n  - listing_id: reference Listing\n  - reviewer_id: reference User\n  - rating: number\n  - comment: text\n  - created_date: datetime',
    com: 'Entity: Post\n  - title: string (required)\n  - content: text\n  - author_id: reference User\n  - status: enum[published, draft, archived]\n  - upvotes: number\n  - created_date: datetime\n\nEntity: Event\n  - name: string (required)\n  - description: text\n  - start_date: datetime\n  - end_date: datetime\n  - location: string\n  - created_date: datetime\n\nEntity: RSVP\n  - event_id: reference Event\n  - user_id: reference User\n  - status: enum[going, maybe, not_going]\n  - created_date: datetime',
    crt: 'Entity: Portfolio\n  - title: string (required)\n  - description: text\n  - creator_id: reference User\n  - is_published: boolean\n  - created_date: datetime\n\nEntity: Artwork\n  - title: string (required)\n  - description: text\n  - image_url: string\n  - portfolio_id: reference Portfolio\n  - tags: text\n  - created_date: datetime\n\nEntity: Comment\n  - artwork_id: reference Artwork\n  - author_id: reference User\n  - content: text\n  - created_date: datetime',
  };

  // Page templates per app type
  const PAGES = {
    ops: '- `/` — Dashboard: task stats, project progress, recent activity\n- `/tasks` — Task list: filter by status/priority, search, bulk actions\n- `/tasks/[id]` — Task detail: full view, comments, activity log\n- `/projects` — Project overview: list, create, manage\n- `/projects/[id]` — Project detail: tasks, timeline, team\n- `/reports` — Analytics: charts, trends, export\n- `/settings` — Settings: profile, preferences, integrations',
    cust: '- `/` — Portal home: account summary, recent tickets, invoices\n- `/tickets` — Support tickets: list, create, track\n- `/tickets/[id]` — Ticket detail: conversation, attachments, status\n- `/invoices` — Invoice list: view, download, pay\n- `/account` — Account settings: profile, billing, team\n- `/docs` — Knowledge base: search, browse articles\n- `/admin` — Admin: manage accounts, tickets, reports',
    ai: '- `/` — Home: featured templates, recent generations, quick start\n- `/generate` — Generation interface: prompt input, type selector, output\n- `/templates` — Template library: browse, create, use\n- `/templates/[id]` — Template detail: variables, preview, use\n- `/history` — Generation history: list, search, re-run\n- `/settings` — Settings: API keys, usage, preferences\n- `/api-docs` — API documentation: endpoints, examples',
    edu: '- `/` — Course catalog: featured, search, categories\n- `/courses/[id]` — Course detail: lessons, progress, instructor\n- `/lessons/[id]` — Lesson view: content, video, quiz, next\n- `/dashboard` — Student dashboard: enrolled courses, progress\n- `/instructor` — Instructor panel: create courses, manage lessons\n- `/certificates` — Certificates: earned, download\n- `/settings` — Settings: profile, preferences',
    mkt: '- `/` — Marketplace home: featured listings, categories, search\n- `/listings` — Browse: grid/list, filter, sort\n- `/listings/[id]` — Listing detail: images, description, buy, reviews\n- `/sell` — Create listing: form, photos, pricing\n- `/orders` — Order history: purchases, sales, status\n- `/profile/[id]` — User profile: listings, reviews, rating\n- `/dashboard` — Seller dashboard: stats, earnings, manage',
    com: '- `/` — Community feed: recent posts, trending, categories\n- `/post/[id]` — Post detail: content, comments, upvotes\n- `/create` — Create post: editor, tags, preview\n- `/events` — Events: upcoming, calendar, RSVP\n- `/events/[id]` — Event detail: info, attendees, RSVP\n- `/members` — Member directory: profiles, search\n- `/u/[id]` — User profile: posts, events, badges',
    crt: '- `/` — Portfolio gallery: featured, grid, filter by tags\n- `/portfolio/[id]` — Portfolio view: artworks, bio, contact\n- `/artwork/[id]` — Artwork detail: image, description, comments\n- `/create` — Create artwork: upload, details, tags\n- `/collections` — Collections: curated groups, create\n- `/discover` — Discover: trending, new, categories\n- `/settings` — Settings: profile, portfolio, preferences',
  };

  const entities = ENTITIES[type] || ENTITIES.ops;
  const pages = PAGES[type] || PAGES.ops;
  const modeDir = MODE_DIR[mode] || MODE_DIR.quick;
  const featLines = features ? features.split('\n').map(f => `- ${f}`).join('\n') : `- Core ${typeName.toLowerCase()} functionality\n- User authentication and roles\n- Primary CRUD workflow\n- Dashboard with key metrics`;

  // Build the full 18-section prompt
  const prompt = [
    '# 🚀 BASE44 ONE-SHOT BUILD PROMPT',
    '',
    '## 1. Execution Mode',
    modeDir,
    'Build everything in a single prompt. Do not ask questions — make smart assumptions based on the idea below.',
    '',
    '## 2. Product Identity',
    `**Type:** ${typeName}`,
    `**Visual Direction:** ${visualName}`,
    `**Build Mode:** ${modeName}`,
    '**Name:** Derive a fitting product name from the idea.',
    '',
    '## 3. Product Thesis',
    idea,
    '',
    '## 4. Primary Users',
    `- **Primary:** Users who need ${typeName.toLowerCase()} functionality`,
    '- **Secondary:** Admins/managers who oversee the system',
    '- **Tertiary:** Visitors/guests who browse public content',
    '',
    '## 5. User Roles & Permissions',
    '- **Admin:** Full CRUD on all entities, manage users, view all data, access admin panel',
    '- **Member:** CRUD on own records, view public data, interact with community features',
    '- **Visitor:** View-only access to public content',
    '- Enable Row-Level Security (RLS) on all user-owned entities',
    '',
    '## 6. Scope Priorities (P0/P1/P2)',
    '**P0 (Must Have):**',
    featLines,
    '',
    '**P1 (Should Have):**',
    '- Search and filtering',
    '- Notifications system',
    '- Profile management',
    '- Data export (CSV/JSON)',
    '',
    '**P2 (Nice to Have):**',
    '- Dark mode toggle',
    '- Advanced analytics and charts',
    '- API access for integrations',
    '- Real-time updates (WebSocket)',
    '',
    '## 7. Data Architecture',
    '```',
    `Entity: User (system-defined)`,
    `  - email: string`,
    `  - full_name: string`,
    `  - role: enum[admin, member, visitor]`,
    `  - avatar_url: string`,
    `  - bio: text`,
    '',
    entities,
    '```',
    'Create proper relationships between entities. Add created_date and updated_date to all custom entities.',
    '',
    '## 8. Page Architecture',
    pages,
    '',
    '## 9. Functional Workflows',
    '- **Create flow:** User fills form → validate input → save entity → redirect to detail view → show success toast',
    '- **Search flow:** User types query → debounce 300ms → filter entities → display results with empty state',
    '- **Auth flow:** Sign up → validate → assign role → redirect to dashboard → show welcome',
    '- **Delete flow:** Click delete → confirm modal → delete entity → redirect to list → show toast with undo',
    '- **Notification flow:** Event triggers → create notification → show in-app badge → mark as read on click',
    '',
    '## 10. AI Behavior',
    mode === 'challenge'
      ? 'Include AI-powered features: smart suggestions, content generation, automated categorization. Use the built-in AI agent for natural language interactions. Add an AI assistant that can answer questions about the data.'
      : 'Minimal AI: basic search with fuzzy matching, optional content suggestions. Focus on core CRUD and user experience.',
    '',
    '## 11. Design System',
    `- **Background:** ${ds.bg}`,
    `- **Surface:** ${ds.surface}`,
    `- **Primary text:** ${ds.primary}`,
    `- **Accent:** ${ds.accent}`,
    `- **Success:** ${ds.success}`,
    `- **Warning:** ${ds.warning}`,
    `- **Danger:** ${ds.danger}`,
    `- **Font family:** ${ds.font}`,
    `- **Mood:** ${ds.mood}`,
    '- **Spacing:** 4px base scale (4, 8, 12, 16, 24, 32, 48, 64)',
    '- **Border radius:** 6px inputs, 8px cards, 12px modals, 9999px pills',
    '- **Shadows:** Subtle layered (sm: 0 1px 2px rgba(0,0,0,.05), md: 0 4px 6px rgba(0,0,0,.1), lg: 0 10px 15px rgba(0,0,0,.1))',
    '- **Transitions:** 150ms ease for hover, 200ms for modals',
    '',
    '## 12. UX States',
    '- **Empty:** Friendly illustration + CTA to create first item',
    '- **Loading:** Skeleton screens for lists, spinner overlay for actions',
    '- **Error:** Inline error messages with retry actions, no raw error codes',
    '- **Success:** Toast notifications (top-right, auto-dismiss 3s) with undo option',
    '- **Offline:** Graceful degradation, show cached data with sync indicator',
    '',
    '## 13. Responsive Behavior',
    '- **Mobile (< 640px):** Stack all columns, bottom navigation, swipeable cards, full-width inputs',
    '- **Tablet (640-1024px):** 2-column layouts, collapsible sidebar, touch-optimized controls',
    '- **Desktop (> 1024px):** Full sidebar navigation, multi-column grids, hover states, keyboard shortcuts',
    '',
    '## 14. Accessibility',
    '- WCAG 2.1 AA compliance minimum',
    '- All interactive elements keyboard navigable with visible focus rings',
    '- Screen reader labels (aria-label) on all icon-only buttons',
    '- Color contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for large text',
    '- Semantic HTML: proper headings, landmarks, roles',
    '',
    '## 15. Security',
    '- Row-Level Security on all user-owned entities (non-admins see only their records)',
    '- Admin role bypasses RLS',
    '- Input validation: sanitize all text, enforce max lengths, reject HTML',
    '- No sensitive data in URLs or client-side storage',
    '- Rate limiting: max 100 API calls per user per 10 minutes',
    '',
    '## 16. Seed Data',
    '- 5 sample records for each primary entity with realistic data',
    '- 3 sample users: 1 admin, 1 member, 1 visitor',
    '- Link secondary entities to primary ones with proper references',
    '- Include varied statuses (active, draft, archived) for testing',
    '',
    '## 17. Implementation Contract',
    '1. Use Base44 entities for ALL data models — no external databases',
    '2. Use Base44 pages for ALL routes — no custom routing',
    '3. Use Base44 workflows for ALL automations — no external cron jobs',
    '4. Every form must have client-side validation before submit',
    '5. Every list must have pagination (20 items per page)',
    '6. Every action must show a loading state',
    '7. Every error must have a user-friendly message (no stack traces)',
    '8. Every entity must have RLS enabled',
    '9. Every date must be formatted per user locale',
    '10. Every image must use lazy loading',
    '11. Every modal must be dismissible with ESC key',
    '12. Every table must be sortable by column',
    '13. Every search must be debounced (300ms)',
    '14. Every CTA must have a clear hover state',
    '15. Every form must auto-save drafts to localStorage',
    '16. Every delete must require confirmation',
    '17. Every success must show a toast notification',
    '18. Every page must have proper SEO meta tags',
    '19. Every entity must have created_date and updated_date',
    '20. Every page must have an error boundary',
    '',
    '## 18. Acceptance Criteria',
    '- [ ] User can sign up and gets assigned the correct role automatically',
    `- [ ] User can create, read, update, and delete ${typeName.toLowerCase()} records`,
    '- [ ] User can search and filter records by multiple criteria',
    '- [ ] Admin can manage all users and content',
    '- [ ] All pages are fully responsive (mobile, tablet, desktop)',
    '- [ ] All forms validate input and show inline errors',
    '- [ ] All data is secured with Row-Level Security',
    '- [ ] App initial load is under 2 seconds',
    '- [ ] All entity relationships are properly defined',
    '- [ ] Design matches the design system specification above',
    '- [ ] Empty states show for all list views',
    '- [ ] Loading states show for all async operations',
    '- [ ] Error states show for all failed operations',
    '',
    '---',
    `*Generated by FlipBot /sly prompt · ONE/44 Master Build Directive*`,
    `*${typeName} · ${visualName} · ${modeName}*`,
    '*Copy everything above this line and paste into Base44 builder*',
  ].join('\n');

  return prompt;
}

function selRow(cid, placeholder, options) {
  return { type: 1, components: [{ type: 3, custom_id: cid, placeholder, options, min_values: 1, max_values: 1 }] };
}
function btnRow(cid, label, style = 3) {
  return { type: 1, components: [{ type: 2, custom_id: cid, label, style }] };
}
function stepEmbed(step, total, title, desc, sels = []) {
  const prog = '▶️ '.repeat(step) + '⬜ '.repeat(total - step);
  const sf = sels.length ? [sp(), { name: '✓ Your Selections', value: sels.map(s => '• ' + s).join('\n'), inline: false }] : [];
  return embed(`🔥 Elite Prompt Compiler — Step ${step} of ${total}`, `${prog}\n\n**${title}**\n${desc}`, C.brand, sf, true);
}

// === STATIC EMBEDS ===
function securityEmbed() {
  return E({ title: '🔒 Security', desc: 'How FlipBot handles credentials', color: C.dark, thumb: true, fields: [
    f('🔑 Bot Token', 'Used once. NEVER stored.', false), f('🔏 Public Key', 'Ed25519 — public by design.', false),
    f('✅ Verification', 'Every interaction verified.', false), f('🚫 Never Stored', 'Tokens · Passwords · Secrets', false),
    sp(), tip('Revoke by removing bot from server.')
  ]});
}
function healthEmbed(lat) {
  return E({ title: '🤖 Health', desc: 'All systems operational.', color: C.success, thumb: true, fields: [
    f('Status', 'Online ✅'), f('Mode', 'Always-warm bot'), f('Latency', lat + 'ms'),
    f('Endpoint', 'Railway'), sp(), tip('Use /bot-create to start!')
  ]});
}
function commandsEmbed() {
  return E({ title: '🤖 ONE/44 OS — Command Suite', desc: '12 commands for the full build pipeline:', color: C.brand, thumb: true, fields: [
    f('/sly prompt', '🔥 Compile architecture', false), f('/sly propose', '📄 Generate proposal', false),
    f('/sly emails', '📧 Create email templates', false), f('/sly visuals', '📸 Product visuals', false),
    f('/sly launch', '🚀 Full launch pipeline', false), f('/sly build', '🏗️ AI build analysis', false),
    f('/sly rescue', '🔧 Debug broken builds', false), f('/sly audit', '🔍 Review app URL', false),
    f('/sly docs', '📚 Search Base44 docs', false), f('/sly ship', '🚢 Showcase project', false),
    f('/sly request', '🧩 Browse modules', false), f('/sly upgrade', '💎 View pricing', false),
    sp(), tip('All responses are private.')
  ]});
}
function guideEmbed() {
  return E({ title: '📖 Setup Guide — 3 Paths', desc: 'Choose your adventure:', color: C.brand, thumb: true, fields: [
    { name: '🆓 Server Only', value: 'Run `/bot-create` → leave blank → pick template', inline: false },
    { name: '🤖 Bot Only', value: 'Run `/bot-create` → fill credentials → get `/sly`', inline: false },
    { name: '🚀 Server + Bot', value: 'Run `/bot-create` → fill credentials + template', inline: false },
    sp(), tip('Scopes: bot, applications.commands. Permissions: 84992.')
  ]});
}
function startResponse() {
  return { type: 4, data: { embeds: [embed("⚡ ONE/44 OS — Let's Get Started", "## The Base44 Builder Copilot for Discord\n**🎉 Free Beta — All features unlocked.**\n\nYour build, compiled — from idea to launch. Architecture, proposals, emails, and product visuals in one pipeline.\n\n**🔒 Beta Access — Invite Only**\nRequest access at flipbot.base44.app", C.brand, [f('🚀 Create','Server, bot, or both',false), f('📖 Guide','Step-by-step walkthrough',false), f('🔒 Security','How credentials are handled',false), f('🤖 Commands','Preview the /sly suite',false), sp()], true)], components: [{ type: 1, components: [
    { type: 2, custom_id: 'start_create', label: '🚀 Create', style: 3 },
    { type: 2, custom_id: 'start_guide', label: '📖 Guide', style: 1 },
    { type: 2, custom_id: 'start_security', label: '🔒 Security', style: 1 },
    { type: 2, custom_id: 'start_commands', label: '🤖 Commands', style: 1 }
  ]}], flags: 64 } };
}
function moduleResponse() {
  return { type: 4, data: { embeds: [embed('🧩 Add-on Modules', 'Browse and request add-on modules.\n\n**All modules free during beta.**', C.brand, [f('🔗 App Connector','Query Base44 data',false), f('🚀 Showcase','Submit & browse projects',false), f('💬 Feedback','Request and give reviews',false), f('👥 Team Builder','Find collaborators',false), f('🏆 Challenge','Build challenges',false), f('🎨 Embed Builder','Custom embeds',false)], true)], components: [
    { type: 1, components: [{ type: 2, custom_id: 'module_connector', label: '🔗 Connector', style: 2 }, { type: 2, custom_id: 'module_showcase', label: '🚀 Showcase', style: 2 }, { type: 2, custom_id: 'module_feedback', label: '💬 Feedback', style: 2 }] },
    { type: 1, components: [{ type: 2, custom_id: 'module_team', label: '👥 Team', style: 2 }, { type: 2, custom_id: 'module_challenge', label: '🏆 Challenge', style: 2 }, { type: 2, custom_id: 'module_embed', label: '🎨 Embed', style: 2 }] }
  ], flags: 64 } };
}
function botCreateModal(uid) {
  return modal('bot_create_modal_' + uid, '🚀 Create Your Bot / Server', [
    textRow('app_id', 'App ID (blank = server only)', 1, false, 'Leave blank for server-only'),
    textRow('public_key', 'Public Key (blank = server only)', 1, false, 'Leave blank for server-only'),
    textRow('bot_token', 'Bot Token (blank = server only)', 2, false, 'Leave blank for server-only'),
    textRow('bot_name', 'Bot / Server Name', 1, false, 'My Base44 Community'),
    textRow('template', 'Template (required)', 1, true, 'builder, saas, hackathon, agency, learning'),
  ]);
}
function promptFinalModal(type, visual, mode) {
  return modal(`prompt_final|${type}|${visual}|${mode}`, '🔥 Describe Your App', [
    textRow('idea', 'What are you building?', 2, true, 'Describe it naturally — include whatever you know'),
    textRow('features', 'Specific features or constraints? (optional)', 2, false, 'Must-haves, exclusions'),
  ]);
}

// === MAIN HANDLER ===
app.post('/interactions', express.raw({ type: 'application/json' }), async (req, res) => {
  const t0 = Date.now();
  const rawBody = req.body.toString();
  const sig = req.headers['x-signature-ed25519'];
  const ts = req.headers['x-signature-timestamp'];

  if (!sig || !ts) return res.status(401).json({ error: 'Missing signature' });
  if (!verifySig(rawBody, sig, ts, PK)) return res.status(401).json({ error: 'Invalid signature' });

  const i = JSON.parse(rawBody);

  // PING
  if (i.type === 1) return res.json({ type: 1 });

  const uid = i.member?.user?.id || i.user?.id || 'unknown';
  const gid = i.guild_id || '';

  // Fire-and-forget role assignment
  assignRole(uid, ROLE_MEMBER);

  // === SLASH COMMANDS (type 2) ===
  if (i.type === 2) {
    const cn = i.data?.name || '';
    const sub = i.data?.options?.[0]?.name || '';
    const opts = getOptions(i.data?.options?.[0]?.options);

    // /sly prompt → modal (no wizard, no dropdowns — just works)
    if (cn === 'sly' && sub === 'prompt') {
      return res.json(modal('prompt_modal', '🔥 ONE/44 Prompt Compiler', [
        textRow('idea', 'What are you building?', 2, true, 'A task tracker for small teams'),
        textRow('type', 'App type', 1, false, 'ops, cust, ai, edu, mkt, com, crt (default: ops)'),
        textRow('visual', 'Visual direction', 1, false, 'precise, command, institution, lux, creative, warm, technical (default: precise)'),
        textRow('mode', 'Build mode', 1, false, 'quick, guided, challenge (default: challenge)'),
        textRow('features', 'Specific features or constraints? (optional)', 2, false, 'Must-haves, exclusions'),
      ]));
    }

    // /sly propose → ONE/44 Builder+ required
    if (cn === 'sly' && sub === 'propose') {
      // TODO: Check ONE/44 subscription tier (Builder+) via Subscription entity
      // For now, allow in beta
      return res.json(modal('propose_modal', '📄 Generate Proposal', [
        textRow('idea', 'What are you building?', 2, true, 'Describe the app or project'),
        textRow('client_name', 'Client name (optional)', 1, false, 'Who is this proposal for?'),
        textRow('budget', 'Budget range (optional)', 1, false, 'e.g. $5k-$15k'),
        textRow('timeline', 'Timeline (optional)', 1, false, 'e.g. 4 weeks'),
        textRow('notes', 'Additional notes (optional)', 2, false, 'Special requirements, constraints'),
      ]));
    }

    // /sly emails → ONE/44 Builder+ required
    if (cn === 'sly' && sub === 'emails') {
      // TODO: Check ONE/44 subscription tier (Builder+) via Subscription entity
      // For now, allow in beta
      return res.json(modal('emails_modal', '📧 Generate Email Templates', [
        textRow('app_name', 'App name', 1, true, 'Your product name'),
        textRow('design_style', 'Design style (optional)', 1, false, 'precise, command, lux, creative, warm, technical'),
        textRow('primary_color', 'Primary color (optional)', 1, false, 'Hex, e.g. #7C5CFC'),
        textRow('email_types', 'Email types (optional)', 1, false, 'launch, onboarding, newsletter (default: all)'),
      ]));
    }

    // /sly visuals → ONE/44 Studio+ required
    if (cn === 'sly' && sub === 'visuals') {
      // TODO: Check ONE/44 subscription tier (Studio+) via Subscription entity
      // For now, allow in beta
      return res.json(modal('visuals_modal', '📸 Generate Product Visuals', [
        textRow('product_url', 'Product URL or image URL', 1, true, 'https://...'),
        textRow('studio', 'Studio style (optional)', 1, false, 'e.g. Soho Streetstyle, Cobalt Studio'),
        textRow('prompt', 'Describe the shot (optional)', 2, false, 'e.g. "street campaign, golden hour"'),
        textRow('asset_type', 'Asset type (optional)', 1, false, 'image or video (default: image)'),
      ]));
    }

    // /sly launch → ONE/44 Studio+ required
    if (cn === 'sly' && sub === 'launch') {
      // TODO: Check ONE/44 subscription tier (Studio+) via Subscription entity
      // For now, allow in beta
      return res.json(modal('launch_modal', '🚀 Full Launch Pipeline', [
        textRow('idea', 'What are you building?', 2, true, 'Describe your app idea'),
        textRow('type', 'App type (optional)', 1, false, 'ops, cust, ai, edu, mkt, com, crt (default: ops)'),
        textRow('visual', 'Visual direction (optional)', 1, false, 'precise, command, lux, creative, warm, technical'),
        textRow('mode', 'Build mode (optional)', 1, false, 'quick, guided, challenge (default: challenge)'),
        textRow('features', 'Features or constraints (optional)', 2, false, 'Must-haves, exclusions'),
      ]));
    }

    // /start
    if (cn === 'start') return res.json(startResponse());

    // /sly request
    if (cn === 'sly' && sub === 'request') return res.json(moduleResponse());

    // /security
    if (cn === 'security') return res.json(securityEmbed());

    // /health
    if (cn === 'health') return res.json(healthEmbed(Date.now() - t0));

    // /bot-create → modal
    if (cn === 'bot-create') return res.json(botCreateModal(uid));

    // /sly ship → modal
    if (cn === 'sly' && sub === 'ship') return res.json(modal('ship_modal_' + uid, '🚀 Showcase Your Project', [
      textRow('project_name', 'Project Name', 1, true, 'My Base44 App'),
      textRow('project_url', 'Public URL', 1, true, 'https://app.base44.com/...'),
      textRow('project_description', 'What does it do?', 2, true, 'Describe it'),
      textRow('project_category', 'Category', 1, false, 'SaaS, Tools...'),
    ]));

    // /sly upgrade — split pricing (FlipBot + ONE/44)
    if (cn === 'sly' && sub === 'upgrade') {
      const tool = san(opts.get('tool') || '', 10).toLowerCase().trim();
      const tier = san(opts.get('tier') || '', 20).toLowerCase().trim();
      const CHECKOUT = 'https://one44.base44.app/checkout';

      // ONE/44 tier checkout
      const one44Tiers = {
        builder: { name: 'Builder', price: '$15/mo', desc: 'Proposals + email templates. Full /sly suite unlocked.' },
        studio: { name: 'Studio', price: '$49/mo', desc: 'Everything + AI product visuals. Unlimited everything.' },
        bespoke: { name: 'Bespoke', price: '$149/mo', desc: 'White-glove: custom AI studios, branded deliverables, priority processing.' },
      };

      // FlipBot tier checkout
      const flipbotTiers = {
        pro: { name: 'Pro', price: '$9/mo', desc: '3 bots, 500 cmds/mo, custom modules.' },
        unlimited: { name: 'Unlimited', price: '$25/mo', desc: 'Unlimited bots, commands, servers. Priority support.' },
      };

      // Specific ONE/44 tier
      if (tool === 'one44' && tier && one44Tiers[tier]) {
        const ti = one44Tiers[tier];
        const url = CHECKOUT + '?tool=one44&tier=' + tier + '&discord=' + uid;
        return res.json(E({ title: '💎 ONE/44 — ' + ti.name, desc: ti.desc, color: C.brand, thumb: true, fields: [
          f('Price', ti.price), f('Product', 'ONE/44'), sp(),
          { name: '🔗 Checkout', value: url, inline: false },
          tip('Payment processed by ONE/44. Access updates automatically.'),
        ]}));
      }

      // Specific FlipBot tier
      if (tool === 'flipbot' && tier && flipbotTiers[tier]) {
        const ti = flipbotTiers[tier];
        const url = CHECKOUT + '?tool=flipbot&tier=' + tier + '&discord=' + uid;
        return res.json(E({ title: '🤖 FlipBot — ' + ti.name, desc: ti.desc, color: C.brand, thumb: true, fields: [
          f('Price', ti.price), f('Product', 'FlipBot'), sp(),
          { name: '🔗 Checkout', value: url, inline: false },
          tip('Payment processed by ONE/44. Access updates automatically.'),
        ]}));
      }

      // Default: show both pricing tables
      return res.json(E({ title: '💎 Pricing — ONE/44 × FlipBot', desc: 'Two products. Pick what you need.', color: C.brand, thumb: true, fields: [
        f('🤖 FlipBot — Free', '$0 · 1 bot · 50 cmds/mo · Server creation'),
        f('🤖 FlipBot — Pro', '$9/mo · 3 bots · 500 cmds · Custom modules'),
        f('🤖 FlipBot — Unlimited', '$25/mo · ∞ bots · ∞ cmds · Priority support'),
        sp(),
        f('💎 ONE/44 — Free', '$0 · Prompt compiler · Community'),
        f('💎 ONE/44 — Builder', '$15/mo · Proposals + emails'),
        f('💎 ONE/44 — Studio', '$49/mo · + AI product visuals · Unlimited'),
        f('💎 ONE/44 — Bespoke', '$149/mo · White-glove · Custom everything'),
        sp(),
        tip('`/sly upgrade tool:one44 tier:builder` or `/sly upgrade tool:flipbot tier:pro`'),
      ]}));
    }

    // /sly build, rescue, audit, docs → create BotCommand, return "processing"
    if (cn === 'sly' && ['build', 'rescue', 'audit', 'docs'].includes(sub)) {
      const rt = san(opts.get('goal') || opts.get('problem') || opts.get('url') || opts.get('query') || '', 4000);
      if (!rt) return res.json(eph(`Provide input for \`/sly ${sub}\`.`));

      const pm = { build: '🧠 Analyzing...', rescue: '🔧 Diagnosing...', audit: '🔍 Loading audit...', docs: '📚 Searching docs...' };

      // Return immediately, then create BotCommand in background
      res.json(eph((pm[sub] || '🧠 Processing...') + '\n\n*Result will appear shortly.*'));

      // Create BotCommand (triggers AI workflow)
      db('create', 'BotCommand', {
        command_type: sub, request_text: rt, user_id: uid, guild_id: gid,
        channel_id: i.channel_id || '', interaction_token: i.token || '',
        application_id: APP_ID, status: 'pending', result: '', result_posted: false
      }).catch(e => console.error('BotCommand create failed:', e));

      // Log interaction
      db('create', 'BotInteraction', {
        interaction_id: i.id, command_name: 'sly-' + sub, user_id: uid, guild_id: gid,
        is_ai_command: true, outcome: 'processing', latency_ms: Date.now() - t0, error_category: null
      }).catch(() => {});

      return;
    }

    // /bot-status
    if (cn === 'bot-status') {
      try {
        const all = await db('list', 'BotInstance');
        const mine = (all || []).filter(b => b.owner_discord_id === uid);
        if (!mine.length) return res.json(E({ title: '🤖 No Bots Yet', desc: 'Run `/bot-create` to start!', color: C.warn, thumb: true }));
        return res.json(E({ title: '🤖 Your Bots', desc: `${mine.length} deployed.`, color: C.brand, thumb: true, fields: mine.flatMap(b => [f('🤖 ' + (b.bot_name || 'Bot'), `${b.setup_status || '?'} · ${b.interaction_count || 0} interactions`, false), sp()]) }));
      } catch { return res.json(E({ title: '⚠️ Error', desc: 'Could not load bots.', color: C.error })); }
    }

    // /pulse
    if (cn === 'pulse') {
      try {
        const [p, q, b, c] = await Promise.all([db('list', 'Project'), db('list', 'Question'), db('list', 'BotInstance'), db('list', 'BotCommand')]);
        return res.json(E({ title: '📡 Pulse', desc: 'Live platform activity.', color: C.info, thumb: true, fields: [
          f('🤖 Bots', String((b || []).length)), f('📦 Projects', String((p || []).filter(x => x.is_published).length)),
          f('❓ Questions', String((q || []).filter(x => x.status === 'open').length)),
          f('⚡ AI Runs', String((c || []).length)), f('⏳ Pending', String((c || []).filter(x => x.status === 'pending').length)),
          sp(), { name: '▸ Next Steps', value: '• Use /sly build to start\n• Use /bot-create to deploy', inline: false }
        ]}));
      } catch { return res.json(E({ title: '⚠️ Error', desc: 'Could not load pulse.', color: C.error })); }
    }

    // /ticket
    if (cn === 'ticket') {
      try {
        const tk = await db('create', 'Ticket', {
          user_profile_id: uid, ticket_type: san(opts.get('type') || 'support', 20),
          subject: san(opts.get('subject') || 'Support', 100),
          description: san(opts.get('description') || '', 2000), status: 'open', is_private: true
        });
        return res.json(E({ title: '🎫 Ticket Created', desc: 'Submitted successfully.', color: C.brand, fields: [f('ID', (tk?.id || '').substring(0, 8)), f('Subject', san(opts.get('subject') || 'Support', 50)), tip('Staff will respond in #staff.')] }));
      } catch { return res.json(E({ title: '⚠️ Error', desc: 'Could not create ticket.', color: C.error })); }
    }

    return res.json(E({ title: '❓ Unknown', desc: `Command \`${san(cn, 50)}\` not recognized.`, color: C.error }));
  }

  // === COMPONENT INTERACTIONS (type 3) ===
  if (i.type === 3) {
    const cid = i.data?.custom_id || '';

    // (Wizard removed — using direct modal instead)
    // Start buttons
    if (cid === 'start_create') return res.json(botCreateModal(uid));
    if (cid === 'start_security') return res.json(securityEmbed());
    if (cid === 'start_commands') return res.json(commandsEmbed());
    if (cid === 'start_guide') return res.json(guideEmbed());

    // Module buttons
    if (cid.startsWith('module_')) {
      const m = cid.replace('module_', '');
      const MI = {
        connector: { n: '🔗 App Connector', c: ['/sly data list', '/sly data query'] },
        showcase: { n: '🚀 Showcase', c: ['/sly showcase', '/sly browse'] },
        feedback: { n: '💬 Feedback', c: ['/sly feedback', '/sly review'] },
        team: { n: '👥 Team Builder', c: ['/sly team find', '/sly team offer'] },
        challenge: { n: '🏆 Challenge', c: ['/sly challenge join', '/sly challenge status'] },
        embed: { n: '🎨 Embed Builder', c: ['/sly embed create'] },
      };
      const mod = MI[m];
      if (mod) {
        await db('create', 'ModuleRequest', { user_id: uid, module_name: m, status: 'requested', requested_date: new Date().toISOString(), bot_instance_id: APP_ID }).catch(() => {});
        return res.json(E({ title: `${mod.n} — Requested!`, desc: 'All modules free during beta.', color: C.success, fields: [f('Module', mod.n), f('Status', 'Queued ✅'), sp(), { name: 'Commands', value: mod.c.map(c => '• `' + c + '`').join('\n'), inline: false }, tip('Registered within 24h.')] }));
      }
    }

    return res.json(eph('Button received.'));
  }

  // === MODAL SUBMISSIONS (type 5) ===
  if (i.type === 5) {
    const mid = i.data?.custom_id || '';
    const comps = i.data?.components || [];
    const fv = new Map();
    for (const row of comps) for (const c of (row.components || [])) if (c.value) fv.set(c.custom_id, c.value);

    // Prompt modal → ONE/44 gateway compilation
    if (mid === 'prompt_modal') {
      const idea = san(fv.get('idea') || '', 4000);
      let type = (fv.get('type') || 'ops').toLowerCase().trim();
      let visual = (fv.get('visual') || 'precise').toLowerCase().trim();
      let mode = (fv.get('mode') || 'challenge').toLowerCase().trim();
      const features = san(fv.get('features') || '', 1000);
      if (!idea) return res.json(eph('Please describe what you want to build.'));
      // Validate and apply defaults
      if (!['ops', 'cust', 'ai', 'edu', 'mkt', 'com', 'crt'].includes(type)) type = 'ops';
      if (!['precise', 'command', 'institution', 'lux', 'creative', 'warm', 'technical'].includes(visual)) visual = 'precise';
      if (!['quick', 'guided', 'challenge'].includes(mode)) mode = 'challenge';

      // Generate a semi-detailed brief from the user's inputs
      const typeName = TN[type] || type;
      const visualName = VN[visual] || visual;
      const modeName = MN[mode] || mode;
      const featLines = features ? features.split('\n').map(f => f.trim()).filter(Boolean) : [];
      
      const brief = {
        thesis: idea,
        primaryUser: `Users who need ${typeName.toLowerCase()} functionality`,
        secondaryUsers: ['Admins and managers who oversee the system', 'Visitors who browse public content'],
        corePain: 'Current solutions are fragmented, manual, and lack the specialized features this product provides.',
        currentProcess: 'Users rely on spreadsheets, manual workflows, and disconnected tools.',
        desiredOutcome: 'A unified, streamlined platform that handles the entire workflow in one place.',
        differentiator: `Purpose-built ${typeName.toLowerCase()} with ${visualName.toLowerCase()} aesthetic — not a generic tool.`,
        magicMoment: 'When the user completes their primary task in seconds instead of switching between multiple tools.',
        jobsToBeDone: [
          `When a user wants to use the ${typeName.toLowerCase()}, they want to complete their task quickly and intuitively.`,
          'When an admin needs to manage the system, they want a clear dashboard with all controls in one place.',
          'When a new user joins, they want to understand the product and get started without training.'
        ],
        successCriteria: [
          'A user can complete the primary workflow in under 2 minutes',
          'All data is persisted and recoverable',
          'The interface works on desktop and mobile'
        ],
        assumptions: [
          'Web-only first, mobile responsive',
          'No external integrations in the first build',
          'Single-tenant data model with RLS'
        ],
        nonGoals: featLines.length > 0 ? [] : ['No mobile app in v1', 'No API access in v1', 'No real-time collaboration'],
        recommendedMode: mode || 'challenge'
      };

      // Return deferred response
      res.json({ type: 5, data: { flags: 64 } });

      // Call ONE/44 gateway
      try {
        const gwRes = await fetch('https://one44.base44.app/functions/compileFromIdea', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: 'one44-gateway-2026',
            rawIdea: idea,
            buildMode: mode || 'challenge',
            visualDirection: visualName,
            title: idea.substring(0, 60),
            brief: brief
          })
        });
        const gw = await gwRes.json();

        if (gw.ok && gw.promptText) {
          // Split into chunks for Discord embeds
          const chunkSize = 4000;
          const chunks = [];
          for (let i = 0; i < gw.promptText.length; i += chunkSize) {
            chunks.push(gw.promptText.substring(i, i + chunkSize));
          }

          const embeds = chunks.slice(0, 10).map((chunk, idx) => ({
            title: idx === 0 ? `🔥 ONE/44 Compiled — ${gw.wordCount || '?'} words` : `Continued (${idx + 1})…`,
            description: '```' + chunk + '```',
            color: C.brand,
            footer: idx === chunks.length - 1 ? { text: FOOTER } : undefined,
            thumbnail: idx === 0 ? { url: LOGO } : undefined,
          }));

          await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${i.token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds, flags: 64 })
          });
        } else {
          await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${i.token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [{ title: '⚠️ Compilation Error', description: gw.error || 'Could not compile. Try again.', color: C.error, footer: { text: FOOTER } }], flags: 64 })
          });
        }
      } catch (err) {
        await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${i.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [{ title: '⚠️ Network Error', description: 'Could not reach ONE/44 compiler. Try again.', color: C.error, footer: { text: FOOTER } }], flags: 64 })
        });
      }

      return;
    }

    // Bot create modal
    if (mid.startsWith('bot_create_modal_')) {
      const a = san(fv.get('app_id') || '', 20).trim();
      const puk = san(fv.get('public_key') || '', 128).trim();
      const bt = (fv.get('bot_token') || '').trim();
      const bn = san(fv.get('bot_name') || 'My Base44 Community', 50);
      const tpl = san(fv.get('template') || '', 20).toLowerCase().trim();

      if (!tpl || !['builder', 'saas', 'hackathon', 'agency', 'learning'].includes(tpl))
        return res.json(E({ title: '⚠️ Template Required', desc: 'Pick: builder, saas, hackathon, agency, learning.', color: C.error }));

      // Server-only mode
      if (!a && !puk && !bt) {
        try {
          const provRes = await fetch(PROV_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template: tpl, server_name: bn, owner_discord_id: uid }) });
          const pv = await provRes.json();
          if (!pv.success) return res.json(E({ title: '⚠️ Failed', desc: pv.error || 'Could not create server.', color: C.error }));
          assignRole(uid, ROLE_BUILDER);
          return res.json(E({ title: '🎉 Server Ready!', desc: `**${bn}** created with **${pv.template_name}** template.`, color: C.success, thumb: true, fields: [f('Server ID', pv.guild_id), f('Template', pv.template_name), f('Channels', String(pv.channels_created)), f('Roles', String(pv.roles_created)), sp(), pv.invite_url ? { name: '🔗 Invite', value: pv.invite_url, inline: false } : f('Invite', 'Check server'), tip('You got the 🚀 Builder role!')] }));
        } catch (ex) { return res.json(E({ title: '⚠️ Error', desc: String(ex).substring(0, 200), color: C.error })); }
      }

      // Full bot + server mode
      if (!a || !puk || !bt) return res.json(E({ title: '⚠️ Incomplete', desc: 'Provide ALL THREE or leave ALL blank for server-only.', color: C.error }));
      if (!/^\d{17,20}$/.test(a)) return res.json(E({ title: '⚠️ Invalid App ID', desc: 'Must be 17-20 digits.', color: C.error }));

      try {
        const all = await db('list', 'BotInstance');
        if ((all || []).find(r => r.application_id === a)) return res.json(E({ title: '⚠️ Already Registered', desc: 'This app is already registered.', color: C.warn }));

        const provRes = await fetch(PROV_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bot_token: bt, template: tpl, server_name: bn, application_id: a, public_key: puk, owner_discord_id: uid }) });
        const pv = await provRes.json();
        if (!pv.success) return res.json(E({ title: '⚠️ Failed', desc: pv.error || 'Could not create server.', color: C.error }));

        await db('create', 'BotInstance', { application_id: a, guild_id: pv.guild_id, public_key: puk, owner_discord_id: uid, bot_name: bn, setup_status: 'active', commands_enabled: 'sly', commands_registered: ['sly'], interaction_count: 0, last_interaction: new Date().toISOString() });
        await db('create', 'Subscription', { discord_user_id: uid, tier: 'beta', status: 'active', command_limit: 9999, commands_used_this_month: 0, bot_instance_id: a, current_period_start: new Date().toISOString() }).catch(() => {});
        assignRole(uid, ROLE_BUILDER);

        return res.json(E({ title: '🎉 Server + Bot Ready!', desc: `**${bn}** is live! \`/sly\` registered.`, color: C.success, thumb: true, fields: [f('Server ID', pv.guild_id), f('Template', pv.template_name), f('Channels', String(pv.channels_created)), f('Roles', String(pv.roles_created)), sp(), pv.invite_url ? { name: '🔗 Invite', value: pv.invite_url, inline: false } : f('Invite', 'Check DMs'), sp(), { name: '🔗 Set Endpoint', value: 'Developer Portal → General Info:\n```https://vesper-fe683526.base44.app/functions/discordInteraction```', inline: false }, tip('Bot token used once, never stored.')] }));
      } catch (ex) { return res.json(E({ title: '⚠️ Error', desc: String(ex).substring(0, 200), color: C.error })); }
    }

    // Propose modal → deferred + BotCommand
    if (mid === 'propose_modal') {
      const idea = san(fv.get('idea') || '', 4000);
      if (!idea) return res.json(eph('Please describe what you want to build.'));
      res.json({ type: 5, data: { flags: 64 } });
      db('create', 'BotCommand', {
        command_type: 'propose', request_text: idea, user_id: uid, guild_id: gid,
        channel_id: i.channel_id || '', interaction_token: i.token || '',
        application_id: APP_ID, status: 'pending', result: '', result_posted: false
      }).catch(e => console.error('BotCommand create failed:', e));
      db('create', 'BotInteraction', { interaction_id: i.id, command_name: 'sly-propose', user_id: uid, guild_id: gid, is_ai_command: true, outcome: 'processing', latency_ms: Date.now() - t0, error_category: null }).catch(() => {});
      return;
    }

    // Emails modal → deferred + BotCommand
    if (mid === 'emails_modal') {
      const appName = san(fv.get('app_name') || '', 200);
      if (!appName) return res.json(eph('Please provide an app name.'));
      res.json({ type: 5, data: { flags: 64 } });
      db('create', 'BotCommand', {
        command_type: 'emails', request_text: appName, user_id: uid, guild_id: gid,
        channel_id: i.channel_id || '', interaction_token: i.token || '',
        application_id: APP_ID, status: 'pending', result: '', result_posted: false
      }).catch(e => console.error('BotCommand create failed:', e));
      db('create', 'BotInteraction', { interaction_id: i.id, command_name: 'sly-emails', user_id: uid, guild_id: gid, is_ai_command: true, outcome: 'processing', latency_ms: Date.now() - t0, error_category: null }).catch(() => {});
      return;
    }

    // Visuals modal → deferred + BotCommand (Kive)
    if (mid === 'visuals_modal') {
      const productUrl = san(fv.get('product_url') || '', 500);
      if (!productUrl) return res.json(eph('Please provide a product URL.'));
      res.json({ type: 5, data: { flags: 64 } });
      db('create', 'BotCommand', {
        command_type: 'visuals', request_text: productUrl, user_id: uid, guild_id: gid,
        channel_id: i.channel_id || '', interaction_token: i.token || '',
        application_id: APP_ID, status: 'pending', result: '', result_posted: false
      }).catch(e => console.error('BotCommand create failed:', e));
      db('create', 'BotInteraction', { interaction_id: i.id, command_name: 'sly-visuals', user_id: uid, guild_id: gid, is_ai_command: true, outcome: 'processing', latency_ms: Date.now() - t0, error_category: null }).catch(() => {});
      return;
    }

    // Launch modal → full pipeline (compile + propose + emails + visuals)
    if (mid === 'launch_modal') {
      const idea = san(fv.get('idea') || '', 4000);
      if (!idea) return res.json(eph('Please describe what you want to build.'));
      res.json({ type: 5, data: { flags: 64 } });
      db('create', 'BotCommand', {
        command_type: 'launch', request_text: idea, user_id: uid, guild_id: gid,
        channel_id: i.channel_id || '', interaction_token: i.token || '',
        application_id: APP_ID, status: 'pending', result: '', result_posted: false
      }).catch(e => console.error('BotCommand create failed:', e));
      db('create', 'BotInteraction', { interaction_id: i.id, command_name: 'sly-launch', user_id: uid, guild_id: gid, is_ai_command: true, outcome: 'processing', latency_ms: Date.now() - t0, error_category: null }).catch(() => {});
      return;
    }

    // Ship modal
    if (mid.startsWith('ship_modal_')) {
      try {
        const p = await db('create', 'Project', {
          name: san(fv.get('project_name') || 'Untitled', 100),
          description: san(fv.get('project_description') || '', 2000),
          public_url: san(fv.get('project_url') || '', 500),
          category: san(fv.get('project_category') || 'General', 50),
          build_stage: 'shipped', owner_id: uid, is_draft: false, is_published: true,
          screenshots: [], integrations: [], team: [], collaboration_needs: '', feedback_preference: 'public'
        });
        assignRole(uid, ROLE_SHIPPED);
        return res.json(E({ title: '🚀 Showcased!', desc: `**${p?.name || 'Project'}** is in the showcase.\n\n⭐ Shipped role earned! 🎉`, color: C.success }));
      } catch { return res.json(E({ title: '⚠️ Error', desc: 'Could not create project.', color: C.error })); }
    }

    return res.json(eph('Unknown modal.'));
  }

  res.status(400).json(eph('Unsupported type.'));
});

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }));
app.get('/', (req, res) => res.json({ name: 'FlipBot by SLY', status: 'running' }));

// === COMMAND REGISTRATION ===
async function registerCommands() {
  if (!BT) { console.log('⚠️ No bot token, skipping command registration'); return; }
  const url = `https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`;
  const commands = [
    {
      name: 'sly',
      description: 'ONE/44 OS — Build suite',
      options: [
        { name: 'prompt', description: '🔥 Compile architecture prompt', type: 1 },
        { name: 'propose', description: '📄 Generate client proposal', type: 1 },
        { name: 'emails', description: '📧 Create branded email templates', type: 1 },
        { name: 'visuals', description: '📸 Generate product visuals (Kive)', type: 1 },
        { name: 'launch', description: '🚀 Full launch pipeline', type: 1 },
        { name: 'build', description: '🏗️ AI build analysis', type: 1, options: [{ name: 'goal', description: 'What to build', type: 3, required: true }] },
        { name: 'rescue', description: '🔧 Debug broken builds', type: 1, options: [{ name: 'problem', description: 'What is broken', type: 3, required: true }] },
        { name: 'audit', description: '🔍 Review an app URL', type: 1, options: [{ name: 'url', description: 'App URL to audit', type: 3, required: true }] },
        { name: 'docs', description: '📚 Search Base44 docs', type: 1, options: [{ name: 'query', description: 'Search query', type: 3, required: true }] },
        { name: 'ship', description: '🚢 Showcase your project', type: 1 },
        { name: 'request', description: '🧩 Browse add-on modules', type: 1 },
        { name: 'upgrade', description: '💎 View pricing', type: 1, options: [{ name: 'tool', description: 'flipbot or one44', type: 3 }, { name: 'tier', description: 'pro, unlimited (FlipBot) / builder, studio, bespoke (ONE/44)', type: 3 }] },
      ]
    },
    { name: 'start', description: '⚡ Get started with ONE/44 OS' },
    { name: 'bot-create', description: '🤖 Create a bot or server' },
    { name: 'bot-status', description: '🤖 Check your bots' },
    { name: 'pulse', description: '📡 Live platform activity' },
    { name: 'ticket', description: '🎫 Create support ticket', options: [
      { name: 'subject', description: 'Ticket subject', type: 3, required: true },
      { name: 'type', description: 'support, bug, feature', type: 3, required: true },
      { name: 'description', description: 'Describe the issue', type: 3, required: true }
    ]},
    { name: 'health', description: '🤖 Bot health check' },
  ];
  try {
    const res = await fetch(url, { method: 'PUT', headers: { Authorization: `Bot ${BT}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commands) });
    if (res.ok) console.log('✅ Commands registered (' + commands.length + ' top-level)');
    else console.error('Command registration failed:', res.status, await res.text());
  } catch (e) { console.error('Command registration failed:', e); }
}

app.listen(PORT, async () => {
  console.log(`🔥 ONE/44 OS running on port ${PORT}`);
  await registerCommands();
});
