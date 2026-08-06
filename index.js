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

// === ARCHITECTURE INFERENCE ENGINE ===
function inferFromIdea(idea) {
  const t = idea.toLowerCase();
  
  // Check if user specified a product name explicitly (e.g., "AiN: a command center..." or "Name: AiN ...")
  const nameMatch = idea.match(/^(?:Name|Project|App)\s*:\s*([^\n]{2,60})/i) || idea.match(/^([A-Za-z0-9]+)\s*[-:–—]\s/);
  let explicitName = nameMatch ? nameMatch[1].trim() : null;
  
  // Detect app type
  let type = 'ops';
  if (/shop|store|market|sell|product|commerce|boutique|wine|ceramic|surф|restaurant|cafe|bakery|retail|brand|fashion|skincare|cosmetics/.test(t)) type = 'mkt';
  else if (/community|forum|social|group|club|guild|member|discuss|chat|event|meetup/.test(t)) type = 'com';
  else if (/ai|generat|prompt|copilot|assistant|llm|gpt|automation|analyze|intellige/.test(t)) type = 'ai';
  else if (/course|lesson|teach|learn|school|academy|training|education|tutor|quiz|certif/.test(t)) type = 'edu';
  else if (/portfolio|gallery|art|creative|design|music|photo|video|studio|showcase/.test(t)) type = 'crt';
  else if (/client|customer|portal|account|support|ticket|invoice|billing|service/.test(t)) type = 'cust';
  else if (/task|project|dashboard|admin|operation|workflow|manage|team|sprint|kanban|tracker/.test(t)) type = 'ops';
  
  // Detect visual direction
  let visual = 'precise';
  if (/luxury|premium|elegant|gold|boutique|high-end|exclusive|refined/.test(t)) visual = 'lux';
  else if (/dark|dashboard|command|control|monitor|dense|data|terminal|ops center/.test(t)) visual = 'command';
  else if (/professional|corporate|institution|trust|bank|legal|finance|enterprise/.test(t)) visual = 'institution';
  else if (/creative|bold|experimental|neon|vibrant|colorful|modern|tech|startup/.test(t)) visual = 'creative';
  else if (/warm|friendly|cozy|approachable|human|soft|welcoming|community/.test(t)) visual = 'warm';
  else if (/technical|compact|dense|information|functional|data-rich|engineering/.test(t)) visual = 'technical';
  
  // Detect CTA direction
  let cta = 'enquire';
  if (/buy|purchase|shop|order|checkout|product|price|\$/.test(t)) cta = 'buy';
  else if (/book|appointment|schedule|reserve|slot|calendar|booking/.test(t)) cta = 'book';
  else if (/reserve|waitlist|spot|seat|table|limited/.test(t)) cta = 'reserve';
  else if (/enquire|contact|inquire|learn more|get started|join|sign up/.test(t)) cta = 'enquire';
  
  // Detect imagery medium
  let imagery = 'photography';
  if (/illustration|vector|isometric|flat|drawing|sketch|cartoon|icon/.test(t)) imagery = 'illustration';
  else if (/3d|render|blender|three|dimensional|spatial|volumetric/.test(t)) imagery = '3D';
  else if (/photo|photography|camera|shoot|portrait|landscape|real|cinematic/.test(t)) imagery = 'photography';
  
  // Detect build mode
  let mode = 'challenge';
  if (/quick|mvp|simple|minimal|fast|small|prototype|poc/.test(t)) mode = 'quick';
  else if (/guided|phased|serious|production|scalable|architecture|full/.test(t)) mode = 'guided';
  
  // Infer product name from idea
  const words = idea.split(/\s+/).filter(w => w.length > 2);
  let productName = explicitName || '';
  if (!productName) {
    const words = idea.split(/\s+/).filter(w => w.length > 2);
    if (words.length >= 2) {
      productName = words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    } else if (words.length === 1) {
      productName = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
    }
  }
  
  // Infer entities based on type
  const entityMap = {
    ops: ['Task (title, status, priority, assignee, due_date)', 'Project (name, status, owner, progress)', 'ActivityLog (action, entity, user, timestamp)'],
    cust: ['Account (company, plan, status, owner)', 'Ticket (subject, status, priority, assignee)', 'Invoice (amount, status, due_date)'],
    ai: ['Generation (prompt, output, type, status, user)', 'Template (name, system_prompt, category)', 'APIKey (key_name, usage_count, user)'],
    edu: ['Course (title, description, instructor, status)', 'Lesson (title, content, order, course)', 'Enrollment (course, user, progress, status)'],
    mkt: ['Listing (title, price, status, seller, category)', 'Order (listing, buyer, amount, status)', 'Review (listing, reviewer, rating, comment)'],
    com: ['Post (title, content, author, upvotes)', 'Event (name, date, location)', 'RSVP (event, user, status)'],
    crt: ['Portfolio (title, creator, is_published)', 'Artwork (title, image, portfolio, tags)', 'Comment (artwork, author, content)'],
  };
  
  // Infer pages based on type
  const pageMap = {
    ops: '/ (dashboard), /tasks, /tasks/[id], /projects, /reports, /settings',
    cust: '/ (portal), /tickets, /invoices, /account, /admin',
    ai: '/ (home), /generate, /templates, /history, /settings',
    edu: '/ (catalog), /courses/[id], /lessons/[id], /dashboard, /instructor',
    mkt: '/ (marketplace), /listings, /listings/[id], /sell, /orders, /profile/[id]',
    com: '/ (feed), /post/[id], /create, /events, /members, /u/[id]',
    crt: '/ (gallery), /portfolio/[id], /artwork/[id], /create, /discover, /settings',
  };
  
  // Infer palette
  const paletteMap = {
    precise: 'Off-white #FAFAFA + Slate #0F172A + Blue accent #3B82F6',
    command: 'Dark navy #0A0F1E + Light text #E2E8F0 + Blue accent #3B82F6',
    institution: 'Light #F8FAFC + Dark #1E293B + Blue accent #2563EB',
    lux: 'White #FFFFFF + Black #1A1A1A + Gold accent #B8860B',
    creative: 'Dark #0D0D0D + Light #F0F0F0 + Violet accent #7C3AED',
    warm: 'Warm white #FFFBEB + Dark #292524 + Orange accent #EA580C',
    technical: 'Dark slate #0F172A + Light #F1F5F9 + Cyan accent #06B6D4',
  };
  
  return {
    type,
    visual,
    mode,
    cta,
    imagery,
    productName,
    thesis: idea,
    typeName: { ops:'Internal Operations Tool', cust:'Customer Portal', ai:'AI Product', edu:'Education Platform', mkt:'Marketplace', com:'Community Hub', crt:'Creative Experience' }[type],
    visualName: { precise:'Precision Editorial', command:'Operational Command Center', institution:'Institutional Intelligence', lux:'Luxury Minimal', creative:'Creative Technology', warm:'Warm & Human', technical:'High-Density Technical' }[visual],
    modeName: { quick:'Quick Build', guided:'Guided Architect', challenge:'Challenge Mode' }[mode],
    entities: (entityMap[type] || entityMap.ops).join('\n  - '),
    pages: pageMap[type] || pageMap.ops,
    palette: paletteMap[visual] || paletteMap.precise,
    fontMap: { precise:'Inter', command:'JetBrains Mono', institution:'Source Sans 3', lux:'Playfair Display', creative:'Space Grotesk', warm:'Plus Jakarta Sans', technical:'IBM Plex Sans' },
  };
}

// === MWG EFFECTS RECOMMENDATION ENGINE ===
function recommendMWGEffects(type) {
  const MWG_REC = {
    mkt: [
      '• MWG 001 — Horizontal Scroll Cards: For product browsing on /listings page. Cards translate horizontally on vertical scroll with pin+scrub.',
      '• MWG 002 — Mouse-Following 3D Card Tilt: For product detail cards on /listings/[id]. Card tilts and rotates following mouse movement.',
      '• MWG 007 — Circular Image Gallery: For featured products on homepage. Images arranged in circles that rotate on scroll.',
    ],
    com: [
      '• MWG 003 — Circular Fan Layout: For member showcase on /members. Members arranged in arc that rotates on scroll.',
      '• MWG 006 — Pinned Paragraph Sequence: For community stories/announcements. Sequential paragraph reveal with word-level animation.',
    ],
    crt: [
      '• MWG 004 — Word-by-Word Reveal: For artist/creator features on /portfolio/[id]. Words highlight sequentially on scroll.',
      '• MWG 005 — Word Slide-In: For artwork descriptions. Words slide from offset to final position with power4 easing.',
      '• MWG 009 — Letter-by-Letter Reveal: For dramatic quotes or manifestos. Letter-level staggered transitions.',
    ],
    edu: [
      '• MWG 004 — Word-by-Word Reveal: For lesson introductions. Key concepts highlight as user scrolls through content.',
      '• MWG 006 — Pinned Paragraph Sequence: For course descriptions and narratives. Sequential paragraph transitions.',
    ],
    ai: [
      '• MWG 009 — Letter-by-Letter Reveal: For generation output showcases. Dramatic letter-level reveals for AI responses.',
      '• MWG 010 — SVG Reveal: For template showcases. SVG illustrations with scroll-driven fade and rotation.',
    ],
    cust: [
      '• MWG 002 — Mouse-Following 3D Card Tilt: For account/ticket cards. Subtle mouse-driven tilt adds premium feel.',
      '• MWG 010 — SVG Reveal: For knowledge base articles. Scroll-driven content reveal.',
    ],
    ops: [
      '• MWG 010 — SVG Reveal: For dashboard hero sections. Subtle scroll-driven accent animations.',
      '• MWG 001 — Horizontal Scroll Cards: For project/task card carousels on dashboard.',
    ],
  };
  return (MWG_REC[type] || MWG_REC.ops).join('\n');
}

// === MWG CODE SNIPPETS (from ONE/44 Knowledge Base) ===
function getMWGCodeSnippets(type) {
  const CODE = {
    mkt: `// MWG 001 — Horizontal Scroll Cards (for /listings)
const container = document.querySelector('.cards-container');
const cardsContainer = container.querySelector('.cards');
const distance = cardsContainer.scrollWidth - window.innerWidth;

const scrollTween = gsap.to(cardsContainer, {
  x: -distance,
  ease: 'none',
  scrollTrigger: {
    trigger: container,
    pin: true,
    scrub: true,
    start: 'top top',
    end: '+=' + distance
  }
});

// Individual card parallax
document.querySelectorAll('.card').forEach(card => {
  gsap.fromTo(card, { rotation: 10, xPercent: 35, yPercent: 12 }, {
    rotation: -10, xPercent: -35, yPercent: -12,
    ease: 'none',
    scrollTrigger: { trigger: card, containerAnimation: scrollTween, start: 'left 120%', end: 'right -20%', scrub: true }
  });
});

// MWG 002 — Mouse Tilt (for /listings/[id] product cards)
const xTo = gsap.quickTo('.product-card', 'rotationY', { duration: 0.6, ease: 'power3' });
const yTo = gsap.quickTo('.product-card', 'rotationX', { duration: 0.6, ease: 'power3' });
window.addEventListener('mousemove', (e) => {
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  xTo((e.clientX - cx) / cx * 15);
  yTo(-(e.clientY - cy) / cy * 15);
});`,
    com: `// MWG 003 — Circular Fan Rotation (for /members)
const circles = document.querySelectorAll('.member-circle');
const angle = 3;
ScrollTrigger.create({ trigger: '.pin-height', start: 'top top', end: 'bottom bottom', pin: '.container' });
circles.forEach((circle, i) => {
  gsap.fromTo(circle, { rotation: angle * (i - (circles.length-1)/2) }, {
    rotation: -angle * (i - (circles.length-1)/2),
    scrollTrigger: { trigger: '.pin-height', start: 'top top', end: 'bottom bottom', scrub: true }
  });
});

// MWG 006 — Paragraph Sequence (for community stories)
function wrapWordsInSpan(el) {
  el.innerHTML = el.textContent.split(/\s+/).map(w => '<span class="word"><span>${w}</span></span>').join(' ');
}` ,
    crt: `// MWG 004 — Word-by-Word Reveal (for /portfolio/[id])
function wrapWordsInSpan(el) {
  el.innerHTML = el.textContent.split(/\s+/).map(w => '<span class="word"><span>' + w + '</span></span>').join(' ');
}
document.querySelectorAll('.paragraph').forEach(wrapWordsInSpan);
ScrollTrigger.create({ trigger: '.pin-height', start: 'top top', end: 'bottom bottom', pin: '.container' });
gsap.to('.word span', { y: 0, stagger: 0.02, ease: 'power4.inOut', scrollTrigger: { trigger: '.pin-height', start: 'top top', end: 'bottom bottom', scrub: true } });

// MWG 009 — Letter Reveal (for dramatic quotes)
function wrapLettersInSpan(el) {
  el.innerHTML = el.textContent.split('').map(c => c === ' ' ? '<span>&nbsp;</span>' : '<span>' + c + '</span>').join('');
}`,
    edu: `// MWG 004 — Word Reveal (for lesson introductions)
function wrapWordsInSpan(el) {
  el.innerHTML = el.textContent.split(/\s+/).map(w => '<span class="word"><span>' + w + '</span></span>').join(' ');
}
document.querySelectorAll('.lesson-text').forEach(wrapWordsInSpan);
ScrollTrigger.create({ trigger: '.lesson-pin', start: 'top top', end: 'bottom bottom', pin: '.lesson-container' });
gsap.to('.word span', { y: 0, stagger: 0.02, ease: 'power4.inOut', scrollTrigger: { trigger: '.lesson-pin', start: 'top top', end: 'bottom bottom', scrub: true } });

// MWG 006 — Paragraph Sequence (for course descriptions)
const paragraphs = document.querySelectorAll('.narrative p');
paragraphs.forEach(p => wrapWordsInSpan(p));`,
    ai: `// MWG 009 — Letter Reveal (for generation showcases)
function wrapLettersInSpan(el) {
  el.innerHTML = el.textContent.split('').map(c => c === ' ' ? '<span>&nbsp;</span>' : '<span>' + c + '</span>').join('');
}
document.querySelectorAll('.sentence').forEach(wrapLettersInSpan);
const sentences = document.querySelectorAll('.sentence');
const tl = gsap.timeline({ scrollTrigger: { trigger: '.pin-height', start: 'top top', end: 'bottom bottom', scrub: true } });
sentences.forEach((s, i) => {
  if (sentences[i+1]) {
    tl.to(s, { yPercent: -50, y: '-50vh', ease: 'power4.in' })
      .to(s.querySelectorAll('span'), { yPercent: -50, y: '-50vh', stagger: -0.02, ease: 'power2.in' }, '<')
      .from(sentences[i+1], { yPercent: 50, y: '50vh', ease: 'power4.out' }, '<')
      .from(sentences[i+1].querySelectorAll('span'), { yPercent: 50, y: '50vh', ease: 'power2.out', stagger: -0.02 }, '<');
  }
});

// MWG 010 — SVG Reveal (for template showcases)
gsap.to('.template-svg', { autoAlpha: 1, rotation: 0, scrollTrigger: { trigger: '.svg-section', start: 'top 80%', end: 'bottom 20%', scrub: true } });`,
    cust: `// MWG 002 — Mouse Tilt (for account cards)
const xTo = gsap.quickTo('.account-card', 'rotationY', { duration: 0.6, ease: 'power3' });
const yTo = gsap.quickTo('.account-card', 'rotationX', { duration: 0.6, ease: 'power3' });
window.addEventListener('mousemove', (e) => {
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  xTo((e.clientX - cx) / cx * 8);
  yTo(-(e.clientY - cy) / cy * 8);
});

// MWG 010 — SVG Reveal (for knowledge base)
gsap.to('.kb-article', { autoAlpha: 1, scrollTrigger: { trigger: '.kb-section', start: 'top 80%', end: 'bottom 20%', scrub: true } });`,
    ops: `// MWG 001 — Horizontal Scroll (for project cards on dashboard)
const container = document.querySelector('.projects-scroll');
const cardsContainer = container.querySelector('.cards');
const distance = cardsContainer.scrollWidth - window.innerWidth;
gsap.to(cardsContainer, { x: -distance, ease: 'none', scrollTrigger: { trigger: container, pin: true, scrub: true, start: 'top top', end: '+=' + distance } });

// MWG 010 — SVG Reveal (for dashboard hero)
gsap.to('.hero-svg', { autoAlpha: 1, rotation: 0, scrollTrigger: { trigger: '.hero-section', start: 'top 80%', end: 'bottom 20%', scrub: true } });`,
  };
  return CODE[type] || CODE.ops;
}

// === CONNECTOR RECOMMENDATION ENGINE (Base44 OAuth Connectors) ===
function recommendConnectors(type) {
  const CONNECTOR_REC = {
    ops: [
      { id: 'slack', name: 'Slack', reason: 'Push task/project status updates and alerts directly into team channels' },
      { id: 'googlecalendar', name: 'Google Calendar', reason: 'Sync due dates and project milestones to team calendars' },
      { id: 'github', name: 'GitHub API', reason: 'Link tasks to commits/PRs if this tool tracks engineering work' },
      { id: 'sentry', name: 'Sentry', reason: 'Surface production errors as tasks automatically' },
      { id: 'quickbooks', name: 'QuickBooks', reason: 'Sync expense or budget line items if the tool touches finance' },
    ],
    cust: [
      { id: 'intercom', name: 'Intercom', reason: 'Sync support conversations into the portal\'s ticket view' },
      { id: 'hubspot', name: 'HubSpot', reason: 'Sync account/contact data bidirectionally with CRM' },
      { id: 'salesforce', name: 'Salesforce', reason: 'Enterprise CRM sync for account and opportunity data' },
      { id: 'docusign', name: 'Docusign', reason: 'Send and track contract signatures from within the portal' },
      { id: 'quickbooks', name: 'QuickBooks', reason: 'Sync invoices and payment status automatically' },
    ],
    ai: [
      { id: 'hugging_face', name: 'Hugging Face', reason: 'Pull or reference model metadata for generation tracking' },
      { id: 'github', name: 'GitHub API', reason: 'Version control prompt templates and generated code artifacts' },
      { id: 'sentry', name: 'Sentry', reason: 'Track generation failures and API errors' },
      { id: 'slack', name: 'Slack', reason: 'Alert the team on usage spikes or failed generations' },
    ],
    edu: [
      { id: 'google_classroom', name: 'Google Classroom', reason: 'Sync courses and rosters for institutions already using Classroom' },
      { id: 'googlemeet', name: 'Google Meet', reason: 'Launch live lesson sessions directly from a lesson page' },
      { id: 'googleforms', name: 'Google Forms', reason: 'Import quiz/survey data into lesson assessments' },
      { id: 'typeform', name: 'Typeform', reason: 'Richer quiz and feedback forms with branching logic' },
      { id: 'googledocs', name: 'Google Docs', reason: 'Embed or sync collaborative course material drafts' },
    ],
    mkt: [
      { id: 'square', name: 'Square', reason: 'Process in-person or card payments for physical goods' },
      { id: 'wix', name: 'Wix', reason: 'Sync storefront or payment data if a Wix site exists alongside this app' },
      { id: 'mailchimp', name: 'Mailchimp', reason: 'Send abandoned cart or promo emails to buyers' },
      { id: 'klaviyo', name: 'Klaviyo', reason: 'Advanced ecommerce email/SMS flows keyed to purchase events' },
      { id: 'meta_ads', name: 'Meta Ads', reason: 'Sync conversion events for ad campaign optimization' },
      { id: 'docusign', name: 'Docusign', reason: 'Seller agreements or terms acceptance for marketplace onboarding' },
    ],
    com: [
      { id: 'discord', name: 'Discord', reason: 'Mirror community posts/events into a Discord server' },
      { id: 'eventbrite', name: 'Eventbrite', reason: 'Sync event RSVPs and ticketing for community events' },
      { id: 'mailchimp', name: 'Mailchimp', reason: 'Send community newsletters and digest emails' },
      { id: 'linkedin', name: 'LinkedIn', reason: 'Cross-post announcements to grow the community externally' },
      { id: 'typeform', name: 'Typeform', reason: 'Collect structured member feedback or applications' },
    ],
    crt: [
      { id: 'googledrive', name: 'Google Drive', reason: 'Store and sync high-res source files for portfolio pieces' },
      { id: 'dropbox', name: 'Dropbox', reason: 'Alternative asset storage/sync for creators already on Dropbox' },
      { id: 'instagram', name: 'Instagram Business', reason: 'Cross-post portfolio pieces to grow audience' },
      { id: 'contentful', name: 'Contentful', reason: 'Headless CMS sync if content is managed outside Base44' },
      { id: 'typeform', name: 'Typeform', reason: 'Commission request or client intake forms' },
    ],
  };
  return CONNECTOR_REC[type] || CONNECTOR_REC.ops;
}

function formatConnectorRecommendations(type) {
  const recs = recommendConnectors(type);
  return recs.map(r => `- **${r.name}** (\`${r.id}\`) — ${r.reason}`).join('\n');
}


// === ELITE PROMPT COMPILER (instant, no AI need) ===
function compileElitePrompt(type, visual, mode, idea, features) {
  const typeName = TN[type] || type;
  const visualName = VN[visual] || visual;
  const modeName = MN[mode] || mode;

  // === ADVANCED DESIGN TOKEN SYSTEM (from ONE/44 Knowledge Base) ===
  const DS = {
    precise: {
      bg: '#FAFAFA', surface: '#FFFFFF', surfaceElevated: '#F8FAFC', primary: '#0F172A', secondary: '#475569', muted: '#94A3B8',
      accent: '#3B82F6', accentSoft: '#DBEAFE', success: '#10B981', warning: '#F59E0B', danger: '#EF4444', border: '#E2E8F0', overlay: 'rgba(15,23,42,0.6)',
      font: 'Inter', fontMono: 'JetBrains Mono',
      mood: 'Clean, typographic, content-first. Generous whitespace. Editorial layout with precise alignment.',
      density: 'comfortable', // compact | comfortable | spacious
      radius: { sm: '4px', md: '8px', lg: '12px', xl: '16px', pill: '9999px' },
      shadow: { sm: '0 1px 2px rgba(15,23,42,0.06)', md: '0 4px 12px rgba(15,23,42,0.08)', lg: '0 12px 24px rgba(15,23,42,0.10)', xl: '0 24px 48px rgba(15,23,42,0.14)', glow: '0 0 24px rgba(59,130,246,0.15)' },
      motion: { instant: '100ms', quick: '200ms', standard: '300ms', deliberate: '500ms', easing: 'cubic-bezier(0.4, 0, 0.2, 1)', easingEnter: 'cubic-bezier(0.0, 0, 0.2, 1)', easingExit: 'cubic-bezier(0.4, 0, 1, 1)' },
      typeScale: { display: '56px/1.1/-0.02em/700', h1: '40px/1.2/-0.01em/700', h2: '32px/1.25/0/600', h3: '24px/1.35/0/600', h4: '20px/1.4/0/500', bodyLg: '18px/1.6/0/400', body: '16px/1.6/0/400', bodySm: '14px/1.5/0.01em/400', caption: '12px/1.4/0.02em/500', code: '14px/1.5/0/400' },
      spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px', '3xl': '64px' },
      z: { base: '0', dropdown: '100', sticky: '200', modal: '1000', toast: '1100', tooltip: '1200' },
    },
    command: {
      bg: '#0A0F1E', surface: '#111827', surfaceElevated: '#1E293B', primary: '#E2E8F0', secondary: '#94A3B8', muted: '#64748B',
      accent: '#3B82F6', accentSoft: 'rgba(59,130,246,0.15)', success: '#10B981', warning: '#F59E0B', danger: '#EF4444', border: '#1E293B', overlay: 'rgba(0,0,0,0.8)',
      font: 'JetBrains Mono', fontMono: 'JetBrains Mono',
      mood: 'Dark, dense, data-driven. Dashboard aesthetic. Compact spacing with high information density.',
      density: 'compact',
      radius: { sm: '2px', md: '4px', lg: '6px', xl: '8px', pill: '9999px' },
      shadow: { sm: '0 1px 2px rgba(0,0,0,0.3)', md: '0 4px 12px rgba(0,0,0,0.4)', lg: '0 12px 24px rgba(0,0,0,0.5)', xl: '0 24px 48px rgba(0,0,0,0.6)', glow: '0 0 24px rgba(59,130,246,0.25)' },
      motion: { instant: '80ms', quick: '150ms', standard: '250ms', deliberate: '400ms', easing: 'cubic-bezier(0.4, 0, 0.2, 1)', easingEnter: 'cubic-bezier(0.0, 0, 0.2, 1)', easingExit: 'cubic-bezier(0.4, 0, 1, 1)' },
      typeScale: { display: '48px/1.1/-0.02em/700', h1: '36px/1.2/-0.01em/600', h2: '28px/1.25/0/600', h3: '22px/1.35/0/500', h4: '18px/1.4/0/500', bodyLg: '16px/1.5/0/400', body: '14px/1.5/0/400', bodySm: '13px/1.45/0.01em/400', caption: '11px/1.4/0.02em/500', code: '13px/1.5/0/400' },
      spacing: { xs: '4px', sm: '6px', md: '12px', lg: '20px', xl: '28px', '2xl': '40px', '3xl': '56px' },
      z: { base: '0', dropdown: '100', sticky: '200', modal: '1000', toast: '1100', tooltip: '1200' },
    },
    institution: {
      bg: '#F8FAFC', surface: '#FFFFFF', surfaceElevated: '#F1F5F9', primary: '#1E293B', secondary: '#475569', muted: '#94A3B8',
      accent: '#2563EB', accentSoft: '#DBEAFE', success: '#059669', warning: '#D97706', danger: '#DC2626', border: '#CBD5E1', overlay: 'rgba(30,41,59,0.5)',
      font: 'Source Sans 3', fontMono: 'JetBrains Mono',
      mood: 'Professional, structured, trustworthy. Institutional clarity with consistent spacing and hierarchy.',
      density: 'comfortable',
      radius: { sm: '4px', md: '6px', lg: '10px', xl: '14px', pill: '9999px' },
      shadow: { sm: '0 1px 3px rgba(30,41,59,0.08)', md: '0 4px 12px rgba(30,41,59,0.10)', lg: '0 10px 24px rgba(30,41,59,0.12)', xl: '0 20px 40px rgba(30,41,59,0.16)', glow: '0 0 24px rgba(37,99,235,0.12)' },
      motion: { instant: '100ms', quick: '200ms', standard: '300ms', deliberate: '450ms', easing: 'cubic-bezier(0.4, 0, 0.2, 1)', easingEnter: 'cubic-bezier(0.0, 0, 0.2, 1)', easingExit: 'cubic-bezier(0.4, 0, 1, 1)' },
      typeScale: { display: '52px/1.1/-0.02em/700', h1: '38px/1.2/-0.01em/600', h2: '30px/1.25/0/600', h3: '24px/1.35/0/500', h4: '20px/1.4/0/500', bodyLg: '18px/1.6/0/400', body: '16px/1.6/0/400', bodySm: '14px/1.5/0.01em/400', caption: '12px/1.4/0.02em/500', code: '14px/1.5/0/400' },
      spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px', '3xl': '64px' },
      z: { base: '0', dropdown: '100', sticky: '200', modal: '1000', toast: '1100', tooltip: '1200' },
    },
    lux: {
      bg: '#FFFFFF', surface: '#FAFAFA', surfaceElevated: '#F5F5F0', primary: '#1A1A1A', secondary: '#4A4A4A', muted: '#8A8A8A',
      accent: '#B8860B', accentSoft: 'rgba(184,134,11,0.1)', success: '#2D5F2D', warning: '#B8860B', danger: '#8B0000', border: '#E5E5E0', overlay: 'rgba(26,26,26,0.7)',
      font: 'Playfair Display', fontMono: 'JetBrains Mono',
      mood: 'Spacious, elegant, premium. Luxury minimal with gold accents, generous whitespace, and editorial typography.',
      density: 'spacious',
      radius: { sm: '2px', md: '4px', lg: '8px', xl: '12px', pill: '9999px' },
      shadow: { sm: '0 1px 2px rgba(26,26,26,0.04)', md: '0 4px 12px rgba(26,26,26,0.06)', lg: '0 12px 32px rgba(26,26,26,0.08)', xl: '0 24px 56px rgba(26,26,26,0.10)', glow: '0 0 32px rgba(184,134,11,0.10)' },
      motion: { instant: '150ms', quick: '250ms', standard: '400ms', deliberate: '700ms', easing: 'cubic-bezier(0.16, 1, 0.3, 1)', easingEnter: 'cubic-bezier(0.0, 0, 0.2, 1)', easingExit: 'cubic-bezier(0.4, 0, 1, 1)' },
      typeScale: { display: '64px/1.05/-0.03em/700', h1: '48px/1.15/-0.02em/600', h2: '36px/1.2/-0.01em/500', h3: '28px/1.3/0/500', h4: '22px/1.4/0/400', bodyLg: '20px/1.7/0/300', body: '17px/1.7/0.300', bodySm: '15px/1.6/0.01em/400', caption: '13px/1.4/0.05em/500', code: '14px/1.5/0/400' },
      spacing: { xs: '6px', sm: '12px', md: '20px', lg: '32px', xl: '48px', '2xl': '64px', '3xl': '80px' },
      z: { base: '0', dropdown: '100', sticky: '200', modal: '1000', toast: '1100', tooltip: '1200' },
    },
    creative: {
      bg: '#0D0D0D', surface: '#1A1A2E', surfaceElevated: '#252540', primary: '#F0F0F0', secondary: '#A0A0B8', muted: '#686880',
      accent: '#7C3AED', accentSoft: 'rgba(124,58,237,0.15)', success: '#10B981', warning: '#F59E0B', danger: '#EF4444', border: '#2A2A45', overlay: 'rgba(13,13,13,0.85)',
      font: 'Space Grotesk', fontMono: 'JetBrains Mono',
      mood: 'Bold, experimental, modern. Creative technology with vibrant accents and expressive motion.',
      density: 'comfortable',
      radius: { sm: '6px', md: '12px', lg: '16px', xl: '24px', pill: '9999px' },
      shadow: { sm: '0 2px 4px rgba(124,58,237,0.08)', md: '0 8px 24px rgba(124,58,237,0.12)', lg: '0 16px 40px rgba(124,58,237,0.15)', xl: '0 32px 64px rgba(124,58,237,0.20)', glow: '0 0 32px rgba(124,58,237,0.25)' },
      motion: { instant: '100ms', quick: '200ms', standard: '350ms', deliberate: '600ms', easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', easingEnter: 'cubic-bezier(0.0, 0, 0.2, 1)', easingExit: 'cubic-bezier(0.4, 0, 1, 1)' },
      typeScale: { display: '60px/1.1/-0.02em/700', h1: '44px/1.2/-0.01em/700', h2: '34px/1.25/0/600', h3: '26px/1.35/0/600', h4: '20px/1.4/0/500', bodyLg: '18px/1.6/0/400', body: '16px/1.6/0/400', bodySm: '14px/1.5/0.01em/400', caption: '12px/1.4/0.03em/500', code: '14px/1.5/0/400' },
      spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '36px', '2xl': '52px', '3xl': '72px' },
      z: { base: '0', dropdown: '100', sticky: '200', modal: '1000', toast: '1100', tooltip: '1200' },
    },
    warm: {
      bg: '#FFFBEB', surface: '#FFFFFF', surfaceElevated: '#FEF3C7', primary: '#292524', secondary: '#57534E', muted: '#A8A29E',
      accent: '#EA580C', accentSoft: '#FED7AA', success: '#16A34A', warning: '#CA8A04', danger: '#DC2626', border: '#E7E5E4', overlay: 'rgba(41,37,36,0.6)',
      font: 'Plus Jakarta Sans', fontMono: 'JetBrains Mono',
      mood: 'Friendly, approachable, soft. Warm tones, rounded corners, human feel with gentle motion.',
      density: 'comfortable',
      radius: { sm: '6px', md: '10px', lg: '14px', xl: '20px', pill: '9999px' },
      shadow: { sm: '0 1px 3px rgba(41,37,36,0.06)', md: '0 4px 12px rgba(41,37,36,0.08)', lg: '0 10px 24px rgba(41,37,36,0.10)', xl: '0 20px 40px rgba(41,37,36,0.12)', glow: '0 0 24px rgba(234,88,12,0.12)' },
      motion: { instant: '120ms', quick: '220ms', standard: '320ms', deliberate: '500ms', easing: 'cubic-bezier(0.32, 0.72, 0, 1)', easingEnter: 'cubic-bezier(0.0, 0, 0.2, 1)', easingExit: 'cubic-bezier(0.4, 0, 1, 1)' },
      typeScale: { display: '54px/1.1/-0.02em/700', h1: '40px/1.2/-0.01em/700', h2: '32px/1.25/0/600', h3: '24px/1.35/0/600', h4: '20px/1.4/0/500', bodyLg: '18px/1.65/0/400', body: '16px/1.65/0/400', bodySm: '14px/1.5/0.01em/400', caption: '12px/1.4/0.02em/500', code: '14px/1.5/0/400' },
      spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px', '3xl': '64px' },
      z: { base: '0', dropdown: '100', sticky: '200', modal: '1000', toast: '1100', tooltip: '1200' },
    },
    technical: {
      bg: '#0F172A', surface: '#1E293B', surfaceElevated: '#334155', primary: '#F1F5F9', secondary: '#94A3B8', muted: '#64748B',
      accent: '#06B6D4', accentSoft: 'rgba(6,182,212,0.12)', success: '#10B981', warning: '#F59E0B', danger: '#EF4444', border: '#334155', overlay: 'rgba(15,23,42,0.8)',
      font: 'IBM Plex Sans', fontMono: 'IBM Plex Mono',
      mood: 'Compact, information-rich, functional. High-density technical with precise alignment and cyan accents.',
      density: 'compact',
      radius: { sm: '3px', md: '5px', lg: '8px', xl: '12px', pill: '9999px' },
      shadow: { sm: '0 1px 2px rgba(0,0,0,0.2)', md: '0 4px 12px rgba(0,0,0,0.3)', lg: '0 10px 24px rgba(0,0,0,0.4)', xl: '0 20px 40px rgba(0,0,0,0.5)', glow: '0 0 24px rgba(6,182,212,0.20)' },
      motion: { instant: '80ms', quick: '150ms', standard: '250ms', deliberate: '400ms', easing: 'cubic-bezier(0.4, 0, 0.2, 1)', easingEnter: 'cubic-bezier(0.0, 0, 0.2, 1)', easingExit: 'cubic-bezier(0.4, 0, 1, 1)' },
      typeScale: { display: '46px/1.1/-0.02em/700', h1: '34px/1.2/-0.01em/600', h2: '26px/1.25/0/600', h3: '20px/1.35/0/500', h4: '17px/1.4/0/500', bodyLg: '15px/1.5/0/400', body: '14px/1.5/0/400', bodySm: '13px/1.45/0.01em/400', caption: '11px/1.4/0.02em/500', code: '13px/1.5/0/400' },
      spacing: { xs: '4px', sm: '6px', md: '12px', lg: '20px', xl: '28px', '2xl': '40px', '3xl': '56px' },
      z: { base: '0', dropdown: '100', sticky: '200', modal: '1000', toast: '1100', tooltip: '1200' },
    },
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
    '# 🚀 ONE/44 MASTER BUILD DIRECTIVE',
    '',
    '## 1. Execution Directive',
    modeDir,
    'Build everything in a single prompt. Do not ask questions — make smart assumptions based on the idea below.',
    '',
    '## 2. Product Identity',
    `**Type:** ${typeName}`,
    `**Visual Direction:** ${visualName}`,
    `**Build Mode:** ${modeName}`,
    `**Name:** ${productName || 'Derive a fitting product name from the idea.'}`,
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
    '## 11. Design System — Advanced Token Architecture',
    '```css',
    `/* ${visualName} Design System — ONE/44 Advanced Token Architecture */`,
    '',
    '/* === COLOR TOKENS === */',
    `--color-bg: ${ds.bg};`,
    `--color-surface: ${ds.surface};`,
    `--color-surface-elevated: ${ds.surfaceElevated};`,
    `--color-text-primary: ${ds.primary};`,
    `--color-text-secondary: ${ds.secondary};`,
    `--color-text-muted: ${ds.muted};`,
    `--color-accent: ${ds.accent};`,
    `--color-accent-soft: ${ds.accentSoft};`,
    `--color-success: ${ds.success};`,
    `--color-warning: ${ds.warning};`,
    `--color-danger: ${ds.danger};`,
    `--color-border: ${ds.border};`,
    `--color-overlay: ${ds.overlay};`,
    '',
    '/* Contrast ratios: primary text on bg >= 7:1 (AAA), secondary >= 4.5:1 (AA), accent on bg >= 3:1 */',
    '',
    '/* === TYPOGRAPHY SCALE === */',
    `--font-primary: '${ds.font}', sans-serif;`,
    `--font-mono: '${ds.fontMono || 'JetBrains Mono'}', monospace;`,
    `--text-display: ${ds.typeScale.display.split('/')[0]};`,
    `--text-h1: ${ds.typeScale.h1.split('/')[0]};`,
    `--text-h2: ${ds.typeScale.h2.split('/')[0]};`,
    `--text-h3: ${ds.typeScale.h3.split('/')[0]};`,
    `--text-h4: ${ds.typeScale.h4.split('/')[0]};`,
    `--text-body-lg: ${ds.typeScale.bodyLg.split('/')[0]};`,
    `--text-body: ${ds.typeScale.body.split('/')[0]};`,
    `--text-body-sm: ${ds.typeScale.bodySm.split('/')[0]};`,
    `--text-caption: ${ds.typeScale.caption.split('/')[0]};`,
    `--leading-display: ${ds.typeScale.display.split('/')[1]};`,
    `--leading-body: ${ds.typeScale.body.split('/')[1]};`,
    `--weight-display: ${ds.typeScale.display.split('/')[3]};`,
    `--weight-heading: ${ds.typeScale.h2.split('/')[3]};`,
    '',
    '/* === SPACING SCALE === */',
    `--space-xs: ${ds.spacing.xs};`,
    `--space-sm: ${ds.spacing.sm};`,
    `--space-md: ${ds.spacing.md};`,
    `--space-lg: ${ds.spacing.lg};`,
    `--space-xl: ${ds.spacing.xl};`,
    `--space-2xl: ${ds.spacing['2xl']};`,
    `--space-3xl: ${ds.spacing['3xl']};`,
    '',
    '/* === BORDER & RADIUS === */',
    `--radius-sm: ${ds.radius.sm};`,
    `--radius-md: ${ds.radius.md};`,
    `--radius-lg: ${ds.radius.lg};`,
    `--radius-xl: ${ds.radius.xl};`,
    `--radius-pill: ${ds.radius.pill};`,
    `--border-color: ${ds.border};`,
    '',
    '/* === ELEVATION / SHADOWS === */',
    `--shadow-sm: ${ds.shadow.sm};`,
    `--shadow-md: ${ds.shadow.md};`,
    `--shadow-lg: ${ds.shadow.lg};`,
    `--shadow-xl: ${ds.shadow.xl};`,
    `--shadow-glow: ${ds.shadow.glow};`,
    '',
    '/* === MOTION TOKENS === */',
    `--duration-instant: ${ds.motion.instant};`,
    `--duration-quick: ${ds.motion.quick};`,
    `--duration-standard: ${ds.motion.standard};`,
    `--duration-deliberate: ${ds.motion.deliberate};`,
    `--ease-standard: ${ds.motion.easing};`,
    `--ease-enter: ${ds.motion.easingEnter};`,
    `--ease-exit: ${ds.motion.easingExit};`,
    '',
    '/* === Z-INDEX SCALE === */',
    `--z-base: ${ds.z.base};`,
    `--z-dropdown: ${ds.z.dropdown};`,
    `--z-sticky: ${ds.z.sticky};`,
    `--z-modal: ${ds.z.modal};`,
    `--z-toast: ${ds.z.toast};`,
    `--z-tooltip: ${ds.z.tooltip};`,
    '',
    `/* DENSITY: ${ds.density} */`,
    `/* MOOD: ${ds.mood} */`,
    '```',
    '',
    '**Component Specifications:**',
    `- **Button:** height 44px, padding ${ds.spacing.md} ${ds.spacing.lg}, radius ${ds.radius.md}, font ${ds.font} 14px/600, transition ${ds.motion.quick} ${ds.motion.easing}, hover: translateY(-1px) + shadow-md, focus: ring 2px accent, disabled: opacity 0.5`,
    `- **Card:** padding ${ds.spacing.lg}, radius ${ds.radius.lg}, surface ${ds.surface}, border 1px ${ds.border}, shadow-sm -> shadow-lg on hover, transition ${ds.motion.standard} ${ds.motion.easing}`,
    `- **Input:** height 44px, padding ${ds.spacing.md}, radius ${ds.radius.md}, border 1px ${ds.border} -> 2px ${ds.accent} on focus, font ${ds.font} 16px, error: border ${ds.danger}`,
    `- **Modal:** max-width 560px, radius ${ds.radius.xl}, shadow-xl, backdrop overlay ${ds.overlay}, enter: translateY(8px)+opacity(0->1) ${ds.motion.standard} ${ds.motion.easingEnter}, close on ESC`,
    `- **Toast:** top-right, radius ${ds.radius.md}, shadow-lg, auto-dismiss 3s, enter: translateX(100%->0) ${ds.motion.standard} ${ds.motion.easingEnter}`,
    `- **Navigation:** sticky top, z-sticky, height 64px, border-bottom 1px ${ds.border}, active link: accent color + 2px bottom border`,
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
    '## 15. Security — Elite SDLC Hardening (Wiz State of SDLC Security 2026 Standards)',
    '',
    '**Context:** Wiz Research\'s State of SDLC Security 2026 report found that risk scales through concentration, privilege inheritance, and automation — not novel exploits. It specifically flagged Base44-generated apps where shared generation logic introduced systemic design flaws enabling unauthorized access to private applications across multiple environments. This section hardens against that exact failure class.',
    '',
    '### Access Control (highest-priority — this is the flaw class Wiz flagged in Base44 apps)',
    '- Row-Level Security (RLS) enabled on EVERY user-owned entity — non-admins see ONLY records they created, verified per-entity not assumed',
    '- Admin role bypass is EXPLICIT and audited — never an accidental fallthrough of a missing check',
    '- Every list/detail/API read path re-validates ownership server-side — never trust a client-supplied user_id or record ID alone',
    '- Test the negative case: a non-owner user must NOT be able to fetch, list, or mutate another user\'s records by guessing or enumerating IDs',
    '- Public vs private page distinction must be explicit per page — no page is "accidentally public" through a missing auth guard',
    '',
    '### Secrets & Credentials',
    '- Zero hardcoded API keys, tokens, or credentials in source, entity data, or client-side code — use the platform secrets manager exclusively',
    '- No secrets in .env files committed to version control, URLs, query params, or localStorage/sessionStorage',
    '- AI/LLM API keys (OpenAI, Anthropic, etc.) are the fastest-growing leaked-secret category per Wiz research — treat with the same rigor as cloud credentials',
    '- Rotate any credential immediately if it appears in a prompt, log, error message, or committed file',
    '',
    '### Input & Injection',
    '- Sanitize all text input server-side; enforce max lengths; reject raw HTML/script injection',
    '- Validate and re-check every input on the backend even when client-side validation exists — client checks are UX, not security',
    '- Parameterize all queries; never string-concatenate user input into filters or aggregations',
    '',
    '### Dependency & Supply Chain (concentration risk)',
    '- Prefer well-maintained, widely-adopted packages over obscure ones — concentration of trust in popular packages means faster patching, but pin versions to avoid surprise updates',
    '- Any third-party script/CDN dependency (animation libs, analytics, widgets) must be loaded from a pinned version URL, not a floating "latest" tag',
    '- Audit any OAuth connector scope requested — request only the minimum read/write scope needed, never broad admin-level access by default',
    '',
    '### Rate Limiting & Abuse Prevention',
    '- Rate limiting: max 100 API calls per user per 10 minutes on all mutating endpoints',
    '- Debounce and throttle any AI-generation or expensive-compute action to prevent cost abuse',
    '- Log and alert on anomalous access patterns (rapid sequential ID enumeration, mass export attempts)',
    '',
    '### Audit & Monitoring',
    '- Every entity mutation logs created_by and updated_date automatically (Base44 default) — never disable this',
    '- Sensitive actions (role changes, deletions, payment events) should be traceable to a specific user and timestamp',
    '- Treat this app\'s backend functions and workflows as privileged execution paths — the same way CI/CD runners are privileged in traditional SDLC — and scope their permissions minimally',
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
    '## 18. Acceptance Criteria & Self-Audit',
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
    '## 19. Animation System — MWG Effects Library (from ONE/44 Knowledge Base)',
    'Add these CDN scripts to the page <head>:',
    '<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>',
    '<script src="https://unpkg.com/lenis@1.1.16/dist/lenis.min.js"></script>',
    '',
    '### Recommended Effects',
    recommendMWGEffects(type),
    '',
    '### Implementation Code',
    '```javascript',
    getMWGCodeSnippets(type),
    '```',
    '',
    '### Integration Directives',
    '- Initialize GSAP + ScrollTrigger + Lenis in a useEffect hook on page mount',
    '- Use Lenis for smooth scroll: const lenis = new Lenis({ autoRaf: true })',
    '- gsap.registerPlugin(ScrollTrigger) before any scroll-driven animation',
    '- Wrap text animation utility: wrapWordsInSpan splits words into spans, wrapLettersInSpan splits into letters',
    '- Apply pin+scrub effects to primary list/gallery pages (not all pages)',
    '- Mouse tilt effects on detail/card pages only (not list pages)',
    '- Respect prefers-reduced-motion: if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;',
    '- Cleanup: ScrollTrigger.refresh() on route change, kill all triggers on unmount',
    '- Each effect must be self-contained and not conflict with Base44 page rendering',
    '',
    '## 20. Connector Integration Recommendations (Base44 OAuth Connectors)',
    `Based on the ${typeName} product type, ONE/44 recommends evaluating these Base44 connectors for integration:`,
    '',
    formatConnectorRecommendations(type),
    '',
    '**Integration guidance:**',
    '- Treat every connector as an OAuth-scoped extension of this app\'s trust boundary — request the minimum read/write scope needed for the feature, never broad admin access by default',
    '- Only surface a connector setup flow to admins/owners, never to regular end-users, unless the product explicitly requires user-level OAuth (e.g. "connect your own Google Calendar")',
    '- Store no connector tokens in entity data or client code — rely on the platform\'s connector token management exclusively',
    '- If none of the above connectors fit the actual use case, do not force one — ship without integrations rather than bolting on an irrelevant connector',
    '- Re-evaluate this list against the full connector catalog if the product scope changes materially during build',
    '',
    '---',
    `*Generated by ONE/44 Architecture Inference Engine · Powered by FlipBot*`,
    `*${typeName} · ${visualName} · ${modeName}*`,
    '*Copy everything above this line into the Base44 builder. ONE/44 has done the architecture. Now build it.*',
    `*${typeName} · ${visualName} · ${modeName}*`,
    '*Copy everything above this line into the Base44 builder. ONE/44 has done the architecture. Now build it.*',
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

    // /sly prompt → single input, elite inference engine
    if (cn === 'sly' && sub === 'prompt') {
      return res.json(modal('prompt_idea', '🔥 ONE/44 Architecture Inference Engine', [
        textRow('idea', 'What are you building?', 2, true, 'Describe your product vision. ONE/44 will infer the complete architecture.\n\ne.g. A natural wine bar in Leeds. A ceramics studio in Lisbon. A surf school on the Algarve...'),
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

    // /sly fix → show audit findings with one-click fix buttons
    if (cn === 'sly' && sub === 'fix') {
      const projectArg = opts.get('project');
      try {
        // Fetch the user's most recent project (or specified one)
        const projectUrl = projectArg
          ? `https://one44.base44.app/api/entities/Project?q={"id":"${projectArg}"}&limit=1`
          : `https://one44.base44.app/api/entities/Project?limit=1&sort_by=-created_date`;
        const pRes = await fetch(projectUrl, { headers: { 'api_key': '3ec59291a8544701abe7731069d57ef1' } });
        const projects = await pRes.json();
        if (!projects || !projects.length) return res.json(eph('No projects found. Run `/sly audit` first to generate findings.'));
        const project = projects[0];
        const auditDate = project.updated_date ? new Date(project.updated_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';

        // Fetch ALL findings for this project (open + resolved) to show full scan context
        const fRes = await fetch(`https://one44.base44.app/api/entities/AuditFinding?q={"projectId":"${project.id}"}&limit=50&sort_by=-created_date`, {
          headers: { 'api_key': '3ec59291a8544701abe7731069d57ef1' }
        });
        const allFindings = await fRes.json();
        const findings = (allFindings || []).filter(f => f.status === 'open');
        const resolvedCount = (allFindings || []).filter(f => f.status === 'resolved').length;
        
        if (!findings.length) {
          // All findings resolved or no findings
          if (allFindings && allFindings.length) {
            return res.json(eph(`🎉 All ${allFindings.length} findings for **${project.title}** are resolved! Readiness: ${project.readinessScore || 'N/A'}`));
          }
          return res.json(eph(`No audit findings for **${project.title}**. Run \`/sly audit\` first.`));
        }

        const safeFindings = findings.filter(f => f.isSafeFix);
        const manualFindings = findings.filter(f => !f.isSafeFix);
        const safeCount = safeFindings.length;
        const manualCount = manualFindings.length;
        const criticalCount = findings.filter(f => f.severity === 'critical').length;

        // Build findings display — organized by fixability
        const fields = [];
        
        // Project context header
        fields.push({ name: '📊 Project', value: `**${project.title}** \`(${project.status || 'draft'})\``, inline: true });
        fields.push({ name: '🔍 Last Audit', value: auditDate, inline: true });
        fields.push({ name: '📈 Score', value: `${project.readinessScore || 'N/A'} (${project.readinessStatus || 'Not scored'})`, inline: true });
        fields.push(sp());

        // Summary line
        fields.push({ name: '📋 Summary', value: `${findings.length} open findings — ${safeCount} ✅ auto-fixable, ${manualCount} 👁️ manual review, ${resolvedCount} ✅ resolved\n**Critical:** ${criticalCount} · **Warnings:** ${findings.filter(f => f.severity === 'warning').length} · **Optimizations:** ${findings.filter(f => f.severity === 'optimization').length}`, inline: false });
        fields.push(sp());

        // Safe fixes section (show first, these are actionable)
        if (safeCount > 0) {
          fields.push({ name: '✅ ONE-CLICK FIXES', value: 'Click a button below to auto-resolve these findings.', inline: false });
          for (const fnd of safeFindings.slice(0, 5)) {
            const sev = fnd.severity === 'critical' ? '🔴' : fnd.severity === 'warning' ? '🟡' : '🔵';
            fields.push({ name: `${sev} ${fnd.title}`, value: `**Category:** ${fnd.category}\n**Fix Key:** \`${fnd.fixKey}\`\n**Recommendation:** ${(fnd.recommendation || '').substring(0, 120)}${fnd.recommendation?.length > 120 ? '...' : ''}`, inline: false });
          }
        }

        // Manual review section
        if (manualCount > 0) {
          fields.push({ name: '👁️ MANUAL REVIEW REQUIRED', value: 'These findings need your judgment — cannot be auto-fixed.', inline: false });
          for (const fnd of manualFindings.slice(0, 3)) {
            const sev = fnd.severity === 'critical' ? '🔴' : fnd.severity === 'warning' ? '🟡' : '🔵';
            fields.push({ name: `${sev} ${fnd.title}`, value: `**Category:** ${fnd.category}\n**Recommendation:** ${(fnd.recommendation || '').substring(0, 150)}${fnd.recommendation?.length > 150 ? '...' : ''}`, inline: false });
          }
          if (manualCount > 3) {
            fields.push({ name: '+ More', value: `${manualCount - 3} additional manual review findings not shown. Use the ONE/44 web app to view all.`, inline: false });
          }
        }

        // Build buttons — Fix All + individual fix buttons
        const buttons = [];
        if (safeCount > 0) {
          buttons.push({ type: 2, custom_id: `fix_all_${project.id}`, label: `✅ Fix All Safe (${safeCount})`, style: 3 });
        }
        for (const fnd of safeFindings.slice(0, 4)) {
          buttons.push({ type: 2, custom_id: `fix_one_${fnd.id}`, label: `🔧 ${fnd.title.substring(0, 20)}`, style: 1 });
        }
        // Add dismiss button for manual findings
        if (manualCount > 0) {
          buttons.push({ type: 2, custom_id: `fix_dismiss_${project.id}`, label: `👁️ Dismiss Manual`, style: 2 });
        }
        
        // Split buttons into rows of 5 (Discord limit)
        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
          rows.push({ type: 1, components: buttons.slice(i, i + 5) });
        }

        return res.json(E({
          title: `🛠️ Audit Findings — ${project.title}`,
          desc: `**Project:** ${project.title}\n**Audit Date:** ${auditDate}\n**Readiness:** ${project.readinessScore || 'N/A'} (${project.readinessStatus || 'Not scored'})`,
          color: criticalCount > 0 ? C.error : safeCount > 0 ? C.warn : C.info,
          fields,
          components: rows.length > 0 ? rows : undefined
        }));
      } catch (err) {
        return res.json(eph('Error fetching findings: ' + err.message));
      }
    }

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

    // Prompt compile button → fetch latest BotCommand for this user and compile
    if (cid === 'prompt_compile_btn') {
      // Get the latest pending inference for this user
      const pending = await db('list', 'BotCommand', { user_id: uid, command_type: 'prompt_inference', status: 'pending' });
      if (!pending || !pending.length) return res.json(eph('No pending inference found. Run /sly prompt again.'));

      const cmd = pending[0];
      const inference = JSON.parse(cmd.result || '{}');
      const idea = cmd.request_text || 'Build a product';

      // Mark as compiling
      await db('update', 'BotCommand', { status: 'compiling' }, cmd.id).catch(() => {});

      // Return deferred response
      res.json({ type: 5, data: { flags: 64 } });

      // Compile the full 18-section directive
      const fullPrompt = compileElitePrompt(inference.type || 'ops', inference.visual || 'precise', inference.mode || 'challenge', idea, '');

      // Save to PromptArtifact
      await db('create', 'PromptArtifact', {
        goal: idea,
        mode: inference.mode || 'challenge',
        prompt_content: fullPrompt,
        user_profile_id: uid,
      }).catch(() => {});

      // Also try ONE/44 gateway for the full AI-compiled version
      try {
        const gwRes = await fetch('https://one44.base44.app/functions/compileFromIdea', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: 'one44-gateway-2026',
            rawIdea: idea,
            buildMode: inference.mode || 'challenge',
            visualDirection: inference.visualName || 'Precision Editorial',
            title: inference.productName ? inference.productName : idea.substring(0, 60),
            brief: { thesis: idea, recommendedMode: inference.mode || 'challenge' },
          })
        });
        const gw = await gwRes.json();
        const promptText = (gw.ok && gw.promptText) ? gw.promptText : fullPrompt;
        const wordCount = promptText.split(/\s+/).length;

        // Mark as completed
        await db('update', 'BotCommand', { status: 'completed', result: promptText.substring(0, 4000) }, cmd.id).catch(() => {});

        // Post to Discord in chunks
        const chunkSize = 4000;
        const chunks = [];
        for (let i = 0; i < promptText.length; i += chunkSize) {
          chunks.push(promptText.substring(i, i + chunkSize));
        }

        const embeds = chunks.slice(0, 10).map((chunk, idx) => ({
          title: idx === 0 ? `🔥 ONE/44 Master Directive — ${wordCount} words` : `ONE/44 Directive (${idx + 1})…`,
          description: '```' + chunk + '```',
          color: C.success,
          footer: idx === chunks.length - 1 ? { text: FOOTER } : undefined,
          thumbnail: idx === 0 ? { url: LOGO } : undefined,
        }));

        await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${i.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds, flags: 64 })
        });
      } catch (err) {
        // Fallback to local compilation
        await db('update', 'BotCommand', { status: 'completed', result: fullPrompt.substring(0, 4000) }, cmd.id).catch(() => {});
        const chunkSize = 4000;
        const chunks = [];
        for (let i = 0; i < fullPrompt.length; i += chunkSize) {
          chunks.push(fullPrompt.substring(i, i + chunkSize));
        }
        const embeds = chunks.slice(0, 10).map((chunk, idx) => ({
          title: idx === 0 ? `🔥 ONE/44 Compiled — ${fullPrompt.split(/\s+/).length} words` : `Continued (${idx + 1})…`,
          description: '```' + chunk + '```',
          color: C.success,
          footer: idx === chunks.length - 1 ? { text: FOOTER } : undefined,
          thumbnail: idx === 0 ? { url: LOGO } : undefined,
        }));
        await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${i.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds, flags: 64 })
        });
      }
      return;
    }
    if (cid === 'prompt_override') {
      return res.json(modal('prompt_override_modal', '✏️ Override Architecture', [
        textRow('idea', 'Original idea (edit if needed)', 2, true, 'Your idea from earlier'),
        textRow('type', 'App type (optional)', 1, false, 'ops, cust, ai, edu, mkt, com, crt'),
        textRow('visual', 'Visual direction (optional)', 1, false, 'precise, command, institution, lux, creative, warm, technical'),
        textRow('mode', 'Build mode (optional)', 1, false, 'quick, guided, challenge'),
        textRow('features', 'Specific features or constraints? (optional)', 2, false, 'Must-haves, exclusions'),
      ]));
    }


    // Fix All Safe findings
    if (cid.startsWith('fix_all_')) {
      const projectId = cid.replace('fix_all_', '');
      res.json({ type: 5, data: { flags: 64 } }); // deferred
      
      try {
        const fixRes = await fetch(`${ONE44_URL}/applySafeFix`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api_key': '3ec59291a8544701abe7731069d57ef1' },
          body: JSON.stringify({ projectId, fixAll: true })
        });
        const result = await fixRes.json();
        
        const fields = [];
        if (result.fixed && Array.isArray(result.fixed)) {
          for (const fix of result.fixed) {
            fields.push(f(`✅ ${fix.title}`, fix.fixKey || 'Resolved', false));
          }
        }
        if (result.newScore !== undefined) {
          fields.push(sp());
          fields.push(f('📊 New Score', `${result.newScore} (${result.newStatus || 'updated'})`, false));
        }
        
        await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${i.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [embed('✅ Safe Fixes Applied', `${result.fixed?.length || 0} findings resolved automatically.`, C.success, fields)],
            flags: 64
          })
        });
      } catch (err) {
        await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${i.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '❌ Fix failed: ' + err.message, flags: 64 })
        });
      }
      return;
    }
    
    // Dismiss manual findings
    if (cid.startsWith('fix_dismiss_')) {
      const projectId = cid.replace('fix_dismiss_', '');
      res.json({ type: 5, data: { flags: 64 } });
      try {
        // Mark all open non-safe findings as dismissed for this project
        const fRes = await fetch(`https://one44.base44.app/api/entities/AuditFinding?q={"projectId":"${projectId}","status":"open","isSafeFix":false}&limit=20`, {
          headers: { 'api_key': '3ec59291a8544701abe7731069d57ef1' }
        });
        const findings = await fRes.json();
        let dismissed = 0;
        for (const fnd of (findings || [])) {
          await fetch(`https://one44.base44.app/api/entities/AuditFinding/${fnd.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'api_key': '3ec59291a8544701abe7731069d57ef1' },
            body: JSON.stringify({ status: 'dismissed' })
          });
          dismissed++;
        }
        await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${i.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: `👁️ Dismissed ${dismissed} manual review findings.`, flags: 64 })
        });
      } catch (err) {
        await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${i.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '❌ Dismiss failed: ' + err.message, flags: 64 })
        });
      }
      return;
    }
    
    // Fix individual finding
    if (cid.startsWith('fix_one_')) {
      const findingId = cid.replace('fix_one_', '');
      res.json({ type: 5, data: { flags: 64 } }); // deferred
      
      try {
        const fixRes = await fetch(`${ONE44_URL}/applySafeFix`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api_key': '3ec59291a8544701abe7731069d57ef1' },
          body: JSON.stringify({ findingId })
        });
        const result = await fixRes.json();
        
        const fields = [];
        if (result.fixApplied) fields.push(f('🔧 Fix Applied', result.fixApplied, false));
        if (result.recommendation) fields.push(f('📝 Detail', result.recommendation.substring(0, 200), false));
        if (result.newScore !== undefined) fields.push(f('📊 New Score', `${result.newScore} (${result.newStatus || 'updated'})`, false));
        
        await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${i.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [embed('✅ Finding Fixed', result.success ? 'Auto-fix applied successfully.' : 'Fix could not be applied.', result.success ? C.success : C.error, fields)],
            flags: 64
          })
        });
      } catch (err) {
        await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${i.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '❌ Fix failed: ' + err.message, flags: 64 })
        });
      }
      return;
    }

    return res.json(eph('Button received.'));
  }

  // === MODAL SUBMISSIONS (type 5) ===
  if (i.type === 5) {
    const mid = i.data?.custom_id || '';
    const comps = i.data?.components || [];
    const fv = new Map();
    for (const row of comps) for (const c of (row.components || [])) if (c.value) fv.set(c.custom_id, c.value);

    // Prompt idea → infer architecture and show preview
    if (mid === 'prompt_idea') {
      const idea = san(fv.get('idea') || '', 4000);
      if (!idea) return res.json(eph('Please describe what you want to build.'));

      const inference = inferFromIdea(idea);

      // Store inference data for later compilation via BotCommand entity
      await db('create', 'BotCommand', {
        user_id: uid,
        guild_id: GUILD_ID,
        interaction_token: i.token,
        application_id: APP_ID,
        command_type: 'prompt_inference',
        request_text: idea,
        status: 'pending',
        result: JSON.stringify(inference),
      }).catch(() => {});

      // Show inferred architecture as embed with compile/override buttons
      const fields = [
        f('PRODUCT IDENTITY', inference.productName || 'Auto-detected', false),
        f('INDUSTRY', inference.typeName, true),
        f('CTA DIRECTION', inference.cta.toUpperCase(), true),
        f('BUILD MODE', inference.modeName, true),
        sp(),
        f('DESIGN SYSTEM', inference.visualName, true),
        f('PALETTE', inference.palette, false),
        f('IMAGERY MEDIUM', inference.imagery, true),
        f('TYPOGRAPHY', (inference.fontMap || {})[inference.visual] || 'Inter', true),
        sp(),
        { name: 'CORE ENTITIES', value: '• ' + inference.entities, inline: false },
        { name: 'PAGE ARCHITECTURE', value: inference.pages, inline: false },
        { name: 'RECOMMENDED ANIMATIONS', value: recommendMWGEffects(inference.type).substring(0, 1000), inline: false },
        sp(),
        f('PRODUCT THESIS', idea.substring(0, 200) + (idea.length > 200 ? '...' : ''), false),
      ];

      return res.json(E({
        title: '🔍 ONE/44 Architecture Inference',
        desc: 'ONE/44 has read your idea and inferred the complete product architecture. Override any field, then compile the full 18-section Master Build Directive.',
        color: C.brand,
        thumb: true,
        fields,
        components: [
          { type: 1, components: [
            { type: 2, custom_id: 'prompt_compile_btn', label: '✅ Compile ONE/44 Directive', style: 3 },
            { type: 2, custom_id: 'prompt_override', label: '✏️ Override Inference', style: 1 },
          ] },
        ],
      }));
    }

    // Override modal → re-show inference with overrides applied
    if (mid === 'prompt_override_modal') {
      const idea = san(fv.get('idea') || '', 4000);
      // We need to get the original idea — but override modal doesn't have it
      // The override fields are type, visual, mode, features
      // For now, return to compile with overridden fields
      let type = (fv.get('type') || 'ops').toLowerCase().trim();
      let visual = (fv.get('visual') || 'precise').toLowerCase().trim();
      let mode = (fv.get('mode') || 'challenge').toLowerCase().trim();
      const features = san(fv.get('features') || '', 1000);
      if (!['ops', 'cust', 'ai', 'edu', 'mkt', 'com', 'crt'].includes(type)) type = 'ops';
      if (!['precise', 'command', 'institution', 'lux', 'creative', 'warm', 'technical'].includes(visual)) visual = 'precise';
      if (!['quick', 'guided', 'challenge'].includes(mode)) mode = 'challenge';

      // Return deferred response and compile directly
      res.json({ type: 5, data: { flags: 64 } });

      const fullPrompt = compileElitePrompt(type, visual, mode, idea || 'Build a product', features);

      try {
        // Save to PromptArtifact via DB
        await db('create', 'PromptArtifact', {
          goal: idea || 'Override compilation',
          mode: mode,
          prompt_content: fullPrompt,
          user_profile_id: uid,
        }).catch(() => {});

        // Upload via ONE/44 gateway
        const gwRes = await fetch('https://one44.base44.app/functions/compileFromIdea', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: 'one44-gateway-2026',
            rawIdea: idea || 'Build a product',
            buildMode: mode,
            visualDirection: VN[visual] || visual,
            title: inference.productName ? inference.productName : (idea || 'Build a product').substring(0, 60),
            brief: { thesis: idea || 'Build a product', recommendedMode: mode },
          })
        });
        const gw = await gwRes.json();

        const promptText = (gw.ok && gw.promptText) ? gw.promptText : fullPrompt;
        const wordCount = promptText.split(/\s+/).length;
        const chunkSize = 4000;
        const chunks = [];
        for (let i = 0; i < promptText.length; i += chunkSize) {
          chunks.push(promptText.substring(i, i + chunkSize));
        }

        const embeds = chunks.slice(0, 10).map((chunk, idx) => ({
          title: idx === 0 ? `🔥 ONE/44 Master Directive — ${wordCount} words` : `ONE/44 Directive (${idx + 1})…`,
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
      } catch (err) {
        await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${i.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [{ title: '⚠️ Compilation Error', description: 'Could not compile. Try again.', color: C.error, footer: { text: FOOTER } }], flags: 64 })
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
        { name: 'fix', description: '🛠️ Fix audit findings (one-click)', type: 1, options: [{ name: 'project', description: 'Project ID (optional — uses latest if omitted)', type: 3 }] },
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
