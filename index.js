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
const PORT = process.env.PORT || 3000;

const ROLE_MEMBER = '1532596411395215493';
const ROLE_BUILDER = '1532834237491970151';
const ROLE_SHIPPED = '1532596421470191829';

const FOOTER = 'FlipBot by SLY • Flip your app into a bot.';
const LOGO = 'https://media.base44.com/images/public/6a6c0faeaea192b5fe683526/6cb74b688_FlipBot-by-SLY-App-Cover.png';
const C = { brand: 0x7C5CFC, success: 0x4ADE80, warn: 0xF59E0B, error: 0xEF4444, info: 0x3B82F6, dark: 0x1A1A2E };

// === HELPERS ===
function verifySig(body, sig, ts, key) {
  try { return nacl.sign.detached.verify(Buffer.from(ts + body), Buffer.from(sig, 'hex'), Buffer.from(key, 'hex')); }
  catch { return false; }
}

function san(s, max = 2000) { return (s || '').substring(0, max).replace(/[`@#<>]/g, ''); }

function embed(title, desc, color, fields, thumb) {
  return { title, description: desc, color: color ?? C.brand, fields: fields || [], footer: { text: FOOTER }, timestamp: new Date().toISOString(), ...(thumb ? { thumbnail: { url: LOGO } } : {}) };
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
  { label: 'Internal Operations Tool', value: 'ops', description: 'Dashboards, admin panels, workflow systems', emoji: '⚙️' },
  { label: 'Customer Portal', value: 'cust', description: 'Client access, account management, support', emoji: '🏪' },
  { label: 'AI Product', value: 'ai', description: 'AI-powered tools, generators, analyzers', emoji: '🤖' },
  { label: 'Education Platform', value: 'edu', description: 'Courses, LMS, training, assessment', emoji: '📚' },
  { label: 'Marketplace', value: 'mkt', description: 'Listings, transactions, vendor profiles', emoji: '🛒' },
  { label: 'Community Hub', value: 'com', description: 'Forums, events, profiles, moderation', emoji: '👥' },
  { label: 'Creative Experience', value: 'crt', description: 'Portfolios, galleries, generators', emoji: '🎨' },
];
const VISUALS = [
  { label: 'Precision Editorial', value: 'precise', description: 'Clean, typographic, content-first', emoji: '✒️' },
  { label: 'Operational Command Center', value: 'command', description: 'Dark, dense, data-driven', emoji: '🎛️' },
  { label: 'Institutional Intelligence', value: 'institution', description: 'Professional, structured, trustworthy', emoji: '🏛️' },
  { label: 'Luxury Minimal', value: 'lux', description: 'Spacious, elegant, premium', emoji: '✨' },
  { label: 'Creative Technology', value: 'creative', description: 'Bold, experimental, modern', emoji: '🌈' },
  { label: 'Warm & Human', value: 'warm', description: 'Friendly, approachable, soft', emoji: '🤝' },
  { label: 'High-Density Technical', value: 'technical', description: 'Compact, information-rich, functional', emoji: '📊' },
];
const MODES = [
  { label: 'Quick Build', value: 'quick', description: 'Smaller app, one primary workflow', emoji: '⚡' },
  { label: 'Guided Architect', value: 'guided', description: 'Serious product, full architecture', emoji: '🏗️' },
  { label: 'Challenge Mode ⭐ Featured', value: 'challenge', description: 'Competition-optimized, full demo', emoji: '🏆' },
];
const TN = { ops:'Internal Operations Tool', cust:'Customer Portal', ai:'AI Product', edu:'Education Platform', mkt:'Marketplace', com:'Community Hub', crt:'Creative Experience' };
const VN = { precise:'Precision Editorial', command:'Operational Command Center', institution:'Institutional Intelligence', lux:'Luxury Minimal', creative:'Creative Technology', warm:'Warm & Human', technical:'High-Density Technical' };
const MN = { quick:'Quick Build', guided:'Guided Architect', challenge:'Challenge Mode' };

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
  return E({ title: '🤖 /sly Commands', desc: '8 AI-powered subcommands:', color: C.brand, thumb: true, fields: [
    f('/sly build', 'Idea → architecture', false), f('/sly rescue', 'Diagnose broken builds', false),
    f('/sly audit', 'Review an app URL', false), f('/sly docs', 'Answer from docs', false),
    f('/sly prompt', '🔥 Elite one-shot prompt', false), f('/sly ship', 'Showcase project', false),
    f('/sly request', 'Browse modules', false), f('/sly upgrade', 'View pricing', false),
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
  return { type: 4, data: { embeds: [embed("⚡ FlipBot — Let's Get Started", "## The Base44 Builder Copilot for Discord\n**🎉 Free Beta — All features unlocked.**\n\nThree paths: **server only**, **bot only**, or **both**.", C.brand, [f('🚀 Create','Server, bot, or both',false), f('📖 Guide','Step-by-step walkthrough',false), f('🔒 Security','How credentials are handled',false), f('🤖 Commands','Preview the /sly suite',false), sp()], true)], components: [{ type: 1, components: [
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

    // /sly prompt → wizard
    if (cn === 'sly' && sub === 'prompt') {
      return res.json({ type: 4, data: { flags: 64, embeds: [stepEmbed(1, 4, 'What type of app are you building?', 'Pick the category that best fits your idea. This shapes the entire architecture.')], components: [selRow('prompt_t', 'Select an app type...', TYPES)] } });
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

    // /sly upgrade
    if (cn === 'sly' && sub === 'upgrade') {
      const tier = san(opts.get('tier') || '', 20).toLowerCase().trim();
      if (tier && ['pro', 'studio', 'template', 'bespoke'].includes(tier)) {
        try {
          const ckRes = await fetch(CK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier, discord_user_id: uid }) });
          const ck = await ckRes.json();
          if (ck.checkout_url) return res.json(E({ title: '💎 Upgrade to ' + tier.charAt(0).toUpperCase() + tier.slice(1), desc: 'Click to complete upgrade.', color: C.brand, thumb: true, fields: [{ name: '🔗 Checkout', value: ck.checkout_url, inline: false }, tip('Instant activation.') }));
          return res.json(E({ title: '⚠️ Error', desc: ck.error || 'Could not create checkout.', color: C.error }));
        } catch { return res.json(E({ title: '⚠️ Error', desc: 'Could not create checkout link.', color: C.error })); }
      }
      return res.json(E({ title: '💎 Pricing', desc: 'Run `/sly upgrade <tier>` for a link.', color: C.brand, thumb: true, fields: [f('Free', '$0 · 1 bot · 50 cmds/mo'), f('Pro', '$12/mo · 3 bots · 500 cmds'), f('Studio', '$39/mo · ∞ bots · ∞ cmds'), f('Template', '$49/mo · Full server + bot'), f('Bespoke', '$99/mo · Custom design'), sp(), tip('Example: /sly upgrade pro')] }));
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

    // Wizard: select app type
    if (cid === 'prompt_t') {
      const type = i.data.values?.[0] || 'ops';
      return res.json({ type: 6, data: { embeds: [stepEmbed(2, 4, "What's the visual direction?", 'Choose the aesthetic personality. This defines the design system.', [`Type: ${TN[type] || type}`])], components: [selRow(`prompt_v|${type}`, 'Select a visual style...', VISUALS)] } });
    }

    // Wizard: select visual
    if (cid.startsWith('prompt_v|')) {
      const [_, type] = cid.split('|');
      const visual = i.data.values?.[0] || 'precise';
      return res.json({ type: 6, data: { embeds: [stepEmbed(3, 4, "What's your build mode?", 'How ambitious is this build?', [`Type: ${TN[type] || type}`, `Visual: ${VN[visual] || visual}`])], components: [selRow(`prompt_m|${type}|${visual}`, 'Select a build mode...', MODES)] } });
    }

    // Wizard: select mode
    if (cid.startsWith('prompt_m|')) {
      const [_, type, visual] = cid.split('|');
      const mode = i.data.values?.[0] || 'challenge';
      return res.json({ type: 6, data: { embeds: [stepEmbed(4, 4, 'Ready to compile!', 'Click the button below and describe your app idea.\n\nThe output includes:\n• Complete entity architecture\n• Page definitions & routes\n• Functional workflows\n• Design system (colors, fonts, spacing)\n• Seed data\n• Acceptance criteria\n• Implementation contract\n• Ready-to-paste Base44 prompt', [`Type: ${TN[type] || type}`, `Visual: ${VN[visual] || visual}`, `Mode: ${MN[mode] || mode}`])], components: [btnRow(`prompt_btn|${type}|${visual}|${mode}`, '📝 Describe My App Idea', 3)] } });
    }

    // Wizard: button → modal
    if (cid.startsWith('prompt_btn|')) {
      const [_, type, visual, mode] = cid.split('|');
      return res.json(promptFinalModal(type, visual, mode));
    }

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

    // Prompt final → create BotCommand
    if (mid.startsWith('prompt_final|')) {
      const [_, type, visual, mode] = mid.split('|');
      const idea = san(fv.get('idea') || '', 4000);
      const features = san(fv.get('features') || '', 1000);
      if (!idea) return res.json(eph('Please describe what you want to build.'));

      const combined = [
        '=== ELITE PROMPT COMPILATION REQUEST ===', '',
        `APP TYPE: ${TN[type] || type}`, `VISUAL: ${VN[visual] || visual}`, `BUILD MODE: ${MN[mode] || mode}`, '',
        'IDEA:', idea, '', 'FEATURES:', features || '(Infer from idea)', '', '=== END ===', '',
        'Generate a complete structured elite one-shot build prompt for a Base44 app with these 18 sections:',
        '1. Execution Mode 2. Product Identity 3. Product Thesis 4. Primary Users 5. User Roles & Permissions',
        '6. Scope Priorities (P0/P1/P2) 7. Data Architecture (entities, fields, types, relationships)',
        '8. Page Architecture (routes, purposes, actions) 9. Functional Workflows (triggers, steps, mutations, states)',
        '10. AI Behavior 11. Design System (hex colors, fonts, spacing) 12. UX States 13. Responsive Behavior',
        '14. Accessibility 15. Security 16. Seed Data 17. Implementation Contract (20+ rules)',
        '18. Acceptance Criteria 19. Final Self-Audit.',
        'Be extremely specific with real entity names, field names, routes. Target 8,000-15,000 words. Ready-to-paste markdown.',
      ].join('\n');

      // Return "Compiling..." immediately
      res.json({ type: 6, data: { embeds: [embed('🔥 Compiling Elite Prompt…', `**${TN[type] || type}** · ${VN[visual] || visual} · ${MN[mode] || mode}\n\nYour idea is being compiled into a master one-shot build prompt.\n\n⏱️ 30-60 seconds. Result will appear here.`, C.brand, [{ name: '📋 Your Idea', value: idea.substring(0, 200) + (idea.length > 200 ? '...' : ''), inline: false }], true)] } });

      // Create BotCommand in background
      db('create', 'BotCommand', {
        command_type: 'prompt', request_text: combined, user_id: uid, guild_id: gid,
        channel_id: i.channel_id || '', interaction_token: i.token || '',
        application_id: APP_ID, status: 'pending', result: '', result_posted: false
      }).catch(e => console.error('BotCommand create failed:', e));

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

app.listen(PORT, () => console.log(`🔥 FlipBot running on port ${PORT}`));
