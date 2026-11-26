/* ==========================================================
   搭子行 TripSync — 双人协同决策原型
   纯前端 / localStorage 持久化 / 无第三方依赖
   ========================================================== */

const LS = 'tripsync_v1';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 9);
const money = n => '¥' + Math.round(n).toLocaleString('zh-CN');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const TABS = [
  { k: 'packing', label: '行李清单' },
  { k: 'place',   label: '想去的地方' },
  { k: 'food',    label: '想吃的' },
  { k: 'todo',    label: '待办' }
];

const LABELS = {
  packing: { bring: '我带了', ask: '你带', share: '共用', abstain: '弃权' },
  place:   { bring: '我想去', ask: '你去', share: '都行', abstain: '不去' },
  food:    { bring: '我想吃', ask: '你去', share: '都行', abstain: '不吃' },
  todo:    { bring: '我搞定', ask: '你搞定', share: '一起', abstain: '算了' }
};

/* ---------------- 数据模型 ---------------- */
function it(o = {}) {
  const base = {
    id: uid(), kind: 'packing', cat: '', title: '', note: '', ref: '',
    p: { A: null, B: null },
    d: { version: 1, owner: null, note: '', confirms: {}, day: null, order: 0 },
    pl: {}
  };
  return Object.assign({}, base, o, {
    p: Object.assign({}, base.p, o.p || {}),
    d: Object.assign({}, base.d, o.d || {}),
    pl: Object.assign({}, base.pl, o.pl || {})
  });
}

function seed() {
  return {
    room: { name: '三亚 · 4天3晚', days: 3, start: '2026-04-12' },
    role: 'A',
    tab: 'packing',
    mapDay: 1,
    mode: 'taxi',
    members: { A: { name: '我' }, B: { name: 'Mia' } },
    expenses: [
      { id: uid(), title: '亚龙湾酒店定金', amount: 1200, payer: 'A' },
      { id: uid(), title: '租车押金', amount: 600, payer: 'B' }
    ],
    items: [
      /* ---- 证件 ---- */
      it({ cat: '证件类', title: '身份证', p: { A: { status: 'bring' }, B: { status: 'bring' } } }),
      it({ cat: '证件类', title: '学生证', p: { A: { status: 'bring' }, B: { status: 'abstain' } } }),
      it({ cat: '证件类', title: '驾驶证', p: { A: { status: 'bring' }, B: { status: 'ask' } } }),
      it({ cat: '证件类', title: '少量现金', p: { A: { status: 'bring', qty: 300 }, B: { status: 'share' } } }),
      it({ cat: '证件类', title: '银行卡', p: { A: { status: 'bring' }, B: { status: 'bring' } } }),

      /* ---- 洗漱 ---- */
      it({ cat: '洗漱用品', title: '牙刷 / 牙膏', p: { A: { status: 'bring' }, B: { status: 'ask' } } }),
      it({ cat: '洗漱用品', title: '洗发水 / 护发素', p: { A: { status: 'ask' }, B: { status: 'bring' } }, note: 'A 只有大瓶，B 有很多小样' }),
      it({ cat: '洗漱用品', title: '沐浴露 / 身体乳', p: { A: { status: 'bring' }, B: { status: 'ask' } } }),
      it({ cat: '洗漱用品', title: '一次性马桶垫', p: { A: { status: 'bring', qty: 5 }, B: { status: 'ask' } } }),
      it({ cat: '洗漱用品', title: '一次性毛巾浴巾', p: { A: { status: 'bring', qty: 5 }, B: { status: 'ask' } } }),
      it({ cat: '洗漱用品', title: '洗脸巾', p: { A: { status: 'abstain' }, B: { status: 'bring' } }, note: 'B 直接带一大包' }),
      it({ cat: '洗漱用品', title: '折叠衣架', p: { A: { status: 'bring', qty: 6 }, B: { status: 'ask' } } }),

      /* ---- 电子 ---- */
      it({ cat: '电子设备', title: '充电宝', p: { A: { status: 'bring' }, B: { status: 'bring' } } }),
      it({ cat: '电子设备', title: '转换插头', p: { A: { status: 'ask' }, B: { status: 'ask' } } }),

      /* ---- 护肤 ---- */
      it({ cat: '化妆护肤', title: '卸妆产品', p: { A: { status: 'bring' }, B: { status: 'ask' } } }),
      it({ cat: '化妆护肤', title: '洗面奶', p: { A: { status: 'bring' }, B: { status: 'bring' } } }),
      it({ cat: '化妆护肤', title: '面膜', p: { A: { status: 'bring', qty: 4 }, B: { status: 'abstain' } }, note: '上次忘带' }),
      it({ cat: '化妆护肤', title: '乳液 / 精华', p: { A: { status: 'abstain' }, B: { status: 'bring' } }, note: 'A 不用，用 B 的' }),

      /* ---- 待办 ---- */
      it({ kind: 'todo', cat: '出发前', title: '订亚龙湾酒店', p: { A: { status: 'bring' }, B: { status: 'share' } } }),
      it({ kind: 'todo', cat: '出发前', title: '买防晒霜 + 驱蚊液', p: { A: { status: 'ask' }, B: { status: 'ask' } } }),
      it({ kind: 'todo', cat: '出发前', title: '线上买蜈支洲岛门票', p: { A: { status: 'bring' }, B: { status: 'ask' } } }),

      /* ---- 景点 ---- */
      it({ kind: 'place', cat: '景点', title: '亚龙湾', p: { A: { status: 'bring' }, B: { status: 'bring' } },
           d: { day: 1, order: 0 }, pl: { lat: 18.228, lng: 109.635, price: 0, dur: 120 } }),
      it({ kind: 'place', cat: '景点', title: '后海村（冲浪）', p: { A: { status: 'bring' }, B: { status: 'abstain' } },
           d: { day: 1, order: 1 }, pl: { lat: 18.322, lng: 109.740, price: 120, dur: 150 } }),
      it({ kind: 'place', cat: '景点', title: '蜈支洲岛', p: { A: { status: 'bring' }, B: { status: 'bring' } },
           d: { day: 1, order: 2 }, pl: { lat: 18.312, lng: 109.766, price: 168, dur: 240 } }),
      it({ kind: 'place', cat: '景点', title: '天涯海角', p: { A: { status: 'abstain' }, B: { status: 'bring' } },
           d: { day: 2, order: 0 }, pl: { lat: 18.301, lng: 109.353, price: 81, dur: 120 } }),
      it({ kind: 'place', cat: '景点', title: '南山文化旅游区', p: { A: { status: 'ask' }, B: { status: 'bring' } },
           d: { day: 2, order: 1 }, pl: { lat: 18.298, lng: 109.395, price: 129, dur: 180 } }),
      it({ kind: 'place', cat: '景点', title: '椰梦长廊', p: { A: { status: 'bring' }, B: { status: 'share' } },
           d: { day: 3, order: 0 }, pl: { lat: 18.270, lng: 109.480, price: 0, dur: 90 } }),
      it({ kind: 'place', cat: '景点', title: '海棠湾免税城', p: { A: { status: 'bring' }, B: { status: 'ask' } },
           d: { day: null, order: 0 }, pl: { lat: 18.335, lng: 109.708, price: 0, dur: 150 } }),

      /* ---- 餐厅 ---- */
      it({ kind: 'food', cat: '正餐', title: '第一市场海鲜加工', p: { A: { status: 'bring' }, B: { status: 'bring' } },
           d: { day: 2, order: 2 }, pl: { lat: 18.253, lng: 109.512, price: 180, dur: 90 } }),
      it({ kind: 'food', cat: '小吃', title: '清补凉', p: { A: { status: 'share' }, B: { status: 'bring' } },
           d: { day: 3, order: 1 }, pl: { lat: 18.250, lng: 109.515, price: 25, dur: 30 } }),
      it({ kind: 'food', cat: '正餐', title: '椰子鸡（椰小鸡）', p: { A: { status: 'bring' }, B: { status: 'share' } },
           d: { day: 3, order: 2 }, pl: { lat: 18.256, lng: 109.508, price: 120, dur: 75 } })
    ]
  };
}

let S = load();
if (!S._ts) S._ts = Date.now();

function load() {
  try { const raw = localStorage.getItem(LS); if (raw) return JSON.parse(raw); } catch (e) {}
  return seed();
}

/* ==========================================================
   同步层：浏览器直连 Supabase（无中间服务器）
   需要先在 Supabase 建一张 rooms 表，SQL 见 sync 面板底部
   ========================================================== */
const CFG_KEY = 'tripsync_cfg';
let CFG = (() => { try { return JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch (e) { return {}; } })();
let dirty = false, pushing = false, pushTimer = null, pollTimer = null, beatTimer = null, lastSig = '';
let syncState = { status: 'off', msg: '仅本机' };

function cfgSave() { try { localStorage.setItem(CFG_KEY, JSON.stringify(CFG)); } catch (e) {} }
function syncOn() { return !!(CFG.url && CFG.key && CFG.room); }

function setStatus(status, msg) {
  syncState = { status, msg };
  const b = $('#syncBtn');
  if (!b) return;
  b.className = 'icon-btn ' + (status === 'ok' ? 'ok' : status === 'sync' ? 'wait' : status === 'error' ? 'err' : '');
  b.textContent = status === 'ok' ? '☁' : status === 'sync' ? '⟳' : status === 'error' ? '!' : '☁';
  b.title = '同步：' + msg;
}

function save() {
  try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {}
  dirty = true;
  schedulePush();
}

/* --- 网络 --- */
function apiPath(p) { return CFG.url.replace(/\/+$/, '') + '/rest/v1/' + p; }
function hdr() {
  return { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key, 'Content-Type': 'application/json' };
}

function payload() {
  const seen = Object.assign({ A: 0, B: 0 }, S.seen || {});
  seen[S.role] = Date.now();
  S.seen = seen;
  return { room: S.room, members: S.members, items: S.items, expenses: S.expenses, seen, _ts: S._ts || 0 };
}
function docSig() {
  return JSON.stringify({ r: S.room, m: S.members, i: S.items, e: S.expenses });
}

function syncHint(e) {
  const m = (e && e.message) || '';
  const code = (m.match(/HTTP (\d+)/) || [])[1];
  if (code === '401') return 'Key 不对，检查 anon public key 是否完整';
  if (code === '404') return '表 rooms 不存在，先跑建表 SQL';
  if (code === '403' || code === '42501') return '权限不足，检查 policy 和 grant 语句';
  if (/Failed to fetch|NetworkError/.test(m)) return '网络不通，检查 URL 或稍后重试';
  return m.slice(0, 40) || '上传失败';
}

async function push() {
  if (!syncOn() || pushing) return;
  pushing = true;
  setStatus('sync', '上传中…');
  try {
    const body = payload();
    body._ts = Date.now();
    S._ts = body._ts;
    const res = await fetch(apiPath('rooms'), {
      method: 'POST',
      headers: Object.assign(hdr(), { Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ id: CFG.room, doc: body, updated_at: new Date().toISOString() })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 90));
    dirty = false;
    lastSig = docSig();
    setStatus('ok', '已同步 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
  } catch (e) {
    setStatus('error', syncHint(e));
    console.warn('[sync] push failed', e);
  } finally {
    pushing = false;
  }
}

async function pull() {
  if (!syncOn()) return null;
  const res = await fetch(apiPath('rooms?id=eq.' + encodeURIComponent(CFG.room) + '&select=doc'), { headers: hdr() });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const rows = await res.json();
  return rows.length ? rows[0].doc : null;
}

/* --- 合并：按 item._ts 取新，支出按 id 并集 --- */
/* --- 变更播报：把远端多出来的改动说成人话 --- */
const FEED_KEY = 'tripsync_feed';
let FEED = (() => { try { return JSON.parse(localStorage.getItem(FEED_KEY) || '[]'); } catch (e) { return []; } })();
function feedSave() { try { localStorage.setItem(FEED_KEY, JSON.stringify(FEED.slice(0, 30))); } catch (e) {} }
function pushFeed(list) {
  const now = Date.now();
  list.forEach(t => FEED.unshift({ t, at: now }));
  FEED = FEED.slice(0, 30);
  feedSave();
}
function fmtAgo(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return m + ' 分钟前';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' 小时前';
  return Math.floor(h / 24) + ' 天前';
}
const DIFF_WORD = {
  packing: { bring: '自己带', ask: '让对方带', share: '共用', abstain: '不带' },
  place:   { bring: '想去', ask: '让对方去', share: '都行', abstain: '不去' },
  food:    { bring: '想吃', ask: '让对方去', share: '都行', abstain: '不吃' },
  todo:    { bring: '自己搞定', ask: '让对方搞定', share: '一起', abstain: '不做' }
};
function diffItem(l, r) {
  const out = [];
  const nm = s => (S.members[s] || {}).name || s;
  const lab = LABELS[r.kind] || LABELS.packing;
  if (!l) { out.push('新增「' + r.title + '」'); return out; }
  ['A', 'B'].forEach(s => {
    const a = l.p && l.p[s] ? l.p[s].status : null;
    const b = r.p && r.p[s] ? r.p[s].status : null;
    if (a !== b) out.push(nm(s) + ' 把「' + r.title + '」改为「' + (b ? (DIFF_WORD[r.kind] || DIFF_WORD.packing)[b] : '未填') + '」');
  });
  if ((l.d.day || 0) !== (r.d.day || 0)) out.push('「' + r.title + '」' + (r.d.day ? '排进 Day ' + r.d.day : '移出日程'));
  if ((l.d.note || '') !== (r.d.note || '')) out.push('「' + r.title + '」的最终备注更新了');
  return out;
}

function mergeDoc(remote) {
  if (!remote) return false;
  const rts = remote._ts || 0;
  let changed = false;
  const changes = [];

  const remoteWipe = (remote.room && remote.room._wipe) || 0;
  const localWipe = (S.room && S.room._wipe) || 0;
  if (localWipe > remoteWipe) return false;   // 本地刚清空，别把远端旧数据合回来
  if (remoteWipe > localWipe) {
    S.items = (remote.items || []).filter(i => !i._del);
    S.expenses = (remote.expenses || []).slice();
    S.room = Object.assign({}, remote.room);
    S._ts = Math.max(S._ts || 0, rts);
    changes.push('对方清空了清单，重新开始');
    pushFeed(changes);
    setTimeout(() => toast('☁️ ' + changes[0]), 150);
    return true;
  }

  const map = new Map(S.items.map(i => [i.id, i]));
  (remote.items || []).forEach(r => {
    const l = map.get(r.id);
    if (!l) { map.set(r.id, r); changed = true; changes.push(...diffItem(null, r)); }
    else if ((r._ts || 0) > (l._ts || 0)) { map.set(r.id, r); changed = true; changes.push(...diffItem(l, r)); }
  });
  if (changed) S.items = [...map.values()];

  const em = new Map(S.expenses.map(e => [e.id, e]));
  (remote.expenses || []).forEach(e => {
    if (!em.has(e.id)) { em.set(e.id, e); changed = true; changes.push('新增一笔「' + e.title + '」' + money(e.amount)); }
  });
  if (changed) S.expenses = [...em.values()];

  if (rts > (S._ts || 0)) {
    if (remote.room) S.room = remote.room;
    if (remote.members) S.members = remote.members;
    S._ts = rts;
  }
  if (remote.seen) {
    const sn = Object.assign({ A: 0, B: 0 }, S.seen || {});
    ['A', 'B'].forEach(k => { sn[k] = Math.max(sn[k] || 0, remote.seen[k] || 0); });
    S.seen = sn;
  }
  if (changes.length) {
    pushFeed(changes.slice(0, 5));
    const msg = changes.length > 6
      ? '☁️ 已同步 ' + changes.length + ' 项改动'
      : '☁️ ' + changes[0] + (changes.length > 1 ? ' 等 ' + changes.length + ' 项' : '');
    setTimeout(() => toast(msg), 150);
  }
  return changed;
}

async function syncOnce() {
  if (!syncOn()) return;
  try {
    const remote = await pull();
    const changed = mergeDoc(remote);
    if (changed) render();
    if (dirty || !remote || docSig() !== lastSig) await push();
    else if (syncState.status !== 'ok') setStatus('ok', '已连接');
  } catch (e) {
    setStatus('error', e.message.slice(0, 40));
  }
}

function schedulePush() {
  if (!syncOn()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => syncOnce(), 1000);
}

function startPolling() {
  clearInterval(pollTimer);
  if (!syncOn()) return;
  pollTimer = setInterval(() => { if (!document.hidden) syncOnce(); }, 4000);
  clearInterval(beatTimer);
  beatTimer = setInterval(() => { if (!document.hidden && syncOn() && syncState.status === 'ok') push(); }, 30000);
}

function initSyncFromURL() {
  const q = new URLSearchParams(location.search);
  const r = q.get('r');
  if (!r) return false;
  const u = q.get('u'), k = q.get('k');
  let changed = false;
  if (u && k && (!CFG.url || !CFG.key || CFG.room !== r)) {
    CFG = { url: u, key: k, room: r };
    cfgSave();
    changed = true;
  } else if (!CFG.room) { CFG.room = r; cfgSave(); }
  try { history.replaceState({}, '', location.pathname); } catch (e) {}  // 清掉地址栏里的密钥
  return changed;
}

function openTripSheet() {
  openSheet(`
    <div class="shead">行程设置</div>
    <div class="srow"><label>名称</label><input id="tName" value="${esc(S.room.name)}"></div>
    <div class="srow"><label>天数</label><input id="tDays" type="number" min="1" max="30" value="${S.room.days}"></div>
    <div class="srow"><label>出发</label><input id="tStart" type="date" value="${esc(S.room.start)}"></div>
    <button class="primary" data-act="tripSave">保存</button>
    <button class="ghost" data-act="wipe" style="color:#B91C1C">清空所有条目和账目（重新开始）</button>
    <button class="ghost" data-act="close">取消</button>`);
}

function openSyncSheet() {
  const on = syncOn();
  const other = S.role === 'A' ? 'B' : 'A';
  const otherSeen = (S.seen || {})[other];
  const st = !on ? '仅本机（数据只存在这台设备）'
    : syncState.status === 'ok' ? '✅ 已连接 · 房间 ' + CFG.room.slice(0, 8) + '…'
    : syncState.status === 'error' ? '⚠️ ' + syncState.msg
    : '⟳ ' + syncState.msg;
  const feedHtml = FEED.length
    ? `<div style="margin-top:12px">
         <div style="font-size:11px;font-weight:600;color:#6B7280;margin-bottom:6px">最近动态</div>
         ${FEED.slice(0, 6).map(f => `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px dashed #EEF0F3;font-size:11.5px">
            <span style="color:#A6ACB5;flex:0 0 52px">${fmtAgo(Date.now() - f.at)}</span>
            <span style="flex:1">${esc(f.t)}</span></div>`).join('')}
       </div>` : '';
  openSheet(`
    <div class="shead">同步设置</div>
    <div style="font-size:12px;color:#6B7280;margin:-6px 0 2px">${esc(st)}</div>
    ${on ? `<div style="font-size:11.5px;color:#A6ACB5;margin-bottom:10px">${esc(S.members[other].name)} ${otherSeen ? '上次改动 ' + fmtAgo(Date.now() - otherSeen) : '暂无记录'}</div>` : '<div style="height:8px"></div>'}
    <div class="srow"><label>URL</label><input id="sUrl" placeholder="https://xxxx.supabase.co" value="${esc(CFG.url || '')}"></div>
    <div class="srow"><label>Key</label><input id="sKey" placeholder="anon public key（eyJhb…）" value="${esc(CFG.key || '')}"></div>
    <div class="srow"><label>房间</label><input id="sRoom" placeholder="留空自动生成" value="${esc(CFG.room || '')}"></div>
    <button class="primary" data-act="syncSave">保存并连接</button>
    ${on ? `<button class="ghost" data-act="syncShare">复制分享链接给朋友</button>
            <button class="ghost" data-act="syncExport">导出存档（复制 JSON）</button>
            <button class="ghost" data-act="syncImport">从 JSON 恢复</button>
            <button class="ghost" data-act="syncOff">断开同步</button>` : ''}
    ${feedHtml}
    <button class="ghost" data-act="close">取消</button>
    <details style="margin-top:12px">
      <summary style="font-size:11.5px;color:#6B7280;cursor:pointer">首次配置怎么做（约 3 分钟）</summary>
      <div style="margin-top:8px;padding:10px;border-radius:10px;background:#F6F7F9;font-size:11px;line-height:1.6;color:#6B7280">
        1. supabase.com 注册 → New project（免费）<br>
        2. 左侧 SQL Editor 粘贴并运行：<br>
        <code style="display:block;margin:4px 0;padding:6px;background:#fff;border:1px solid #E5E8ED;border-radius:6px;font-size:10px;white-space:pre-wrap">create table rooms (id text primary key, doc jsonb, updated_at timestamptz default now());
alter table rooms enable row level security;
create policy "ok" on rooms for all to anon using (true) with check (true);
grant all on rooms to anon;</code>
        3. Settings → API，复制 Project URL 和 anon public key 填到上面<br>
        4. 保存后点「复制分享链接」，发给朋友他打开就能一起填
      </div>
    </details>`);
}

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('已复制'); }
  catch (e) { prompt('手动复制这段链接', t); }
}

/* ---------------- 条目视图（排除已删除的墓碑） ---------------- */
function liveItems() { return S.items.filter(i => !i._del); }

/* ---------------- 决策分析 ---------------- */
function analyze(i) {
  const a = i.p.A && i.p.A.status, b = i.p.B && i.p.B.status;
  if (a === 'bring' && b === 'bring') return { type: 'dup' };
  if (a === 'ask' && b === 'ask') return { type: 'blame' };
  if (a === 'bring' && b === 'ask') return { type: 'ok', owner: 'A' };
  if (b === 'bring' && a === 'ask') return { type: 'ok', owner: 'B' };
  if (a === 'share' || b === 'share') return { type: 'ok', owner: 'share' };
  if (a === 'bring') return { type: 'ok', owner: 'A' };
  if (b === 'bring') return { type: 'ok', owner: 'B' };
  if (a === 'abstain' && b === 'abstain') return { type: 'drop' };
  return { type: 'pending' };
}

function ownerQty(i, owner) {
  if (owner === 'share') return '';
  const p = i.p[owner];
  return p && p.qty ? p.qty : '';
}

function isLocked(i) {
  return i.d.confirms.A === i.d.version && i.d.confirms.B === i.d.version;
}

function finalText(i) {
  const a = analyze(i);
  const isPlan = i.kind === 'place' || i.kind === 'food';
  if (isPlan) {
    if (a.type === 'dup') return '🔥 双方都想去';
    if (a.type === 'drop') return '已排除';
    if (a.type === 'ok') return a.owner === 'share' ? '都行 · 待定顺序' : `已入选（${S.members[a.owner].name} 提议）`;
    return '待定';
  }
  if (a.type === 'dup') return '⚠ 物品重复，请协商谁不带';
  if (a.type === 'blame') return '⚠ 双方都在甩锅，没人带';
  if (a.type === 'drop') return '一致不带';
  if (a.type === 'ok') {
    if (a.owner === 'share') return '共用一份';
    const q = ownerQty(i, a.owner);
    return `由 ${S.members[a.owner].name} 负责${q ? ' × ' + q : ''}`;
  }
  return '待定';
}

/* ---------------- 预算 ---------------- */
function budget() {
  const est = liveItems()
    .filter(i => (i.kind === 'place' || i.kind === 'food') && i.d.day != null && analyze(i).type !== 'drop')
    .reduce((s, i) => s + (i.pl.price || 0) * 2, 0);
  const spent = S.expenses.reduce((s, e) => s + e.amount, 0);
  const paid = { A: 0, B: 0 };
  S.expenses.forEach(e => { paid[e.payer] += e.amount; });
  const half = spent / 2;
  const net = { A: paid.A - half, B: paid.B - half };
  let text = '已平账', warn = false;
  if (net.A > 0.5) { text = `B 应付 A ${money(net.A)}`; warn = true; }
  else if (net.B > 0.5) { text = `A 应付 B ${money(net.B)}`; warn = true; }
  return { est, spent, text, warn };
}

/* ---------------- 地理计算 ---------------- */
function haversine(a, b) {
  const R = 6371000, d = Math.PI / 180;
  const dLat = (b.lat - a.lat) * d, dLng = (b.lng - a.lng) * d;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * d) * Math.cos(b.lat * d) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const SPEED = { walk: 4500, taxi: 22000, transit: 16000 };
const OVERHEAD = { walk: 0, taxi: 180, transit: 420 };
function legSeconds(m, mode) {
  return Math.round((m * 1.3) / (SPEED[mode] / 3600) + OVERHEAD[mode]);
}
function fmtDur(sec) {
  const m = Math.max(1, Math.round(sec / 60));
  return m < 60 ? m + ' 分钟' : Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分';
}
function route(day) {
  return liveItems()
    .filter(i => (i.kind === 'place' || i.kind === 'food') && i.d.day === day && analyze(i).type !== 'drop' && i.pl.lat)
    .sort((x, y) => x.d.order - y.d.order);
}
function totalSeconds(pts, mode) {
  let t = 0;
  for (let k = 1; k < pts.length; k++) t += legSeconds(haversine(pts[k - 1].pl, pts[k].pl), mode);
  return t;
}

/* ---------------- 渲染：顶栏 ---------------- */
function renderTop() {
  $('#roomName').textContent = S.room.name;
  $('#roomMeta').textContent = `${S.room.days} 天 · 出发 ${S.room.start}`;
  const seen = S.seen || {};
  const live = s => (seen[s] || 0) && Date.now() - seen[s] < 90000;
  $('#members').innerHTML = ['A', 'B'].map(s =>
    `<button class="mchip ${s.toLowerCase()} ${S.role === s ? 'on' : ''}" data-act="role" data-side="${s}"
       title="${seen[s] ? '上次改动 ' + fmtAgo(Date.now() - seen[s]) : '还没有改动记录'}">
       <i class="${live(s) ? 'live' : ''}"></i>${esc(S.members[s].name)}${S.role === s ? '（我）' : ''}
     </button>`).join('');
  const b = budget();
  $('#budgetStrip').innerHTML =
    `<div><span>预估总预算</span><b>${money(b.est)}</b></div>
     <div><span>已花费</span><b>${money(b.spent)}</b></div>
     <div><span>AA 结算</span><b class="${b.warn ? 'warn' : ''}">${b.text}</b></div>`;
}

/* ---------------- 渲染：Tab ---------------- */
function renderTabs() {
  const conflicts = liveItems().filter(i => rowFlag(i) === 'hl-yellow' || rowFlag(i) === 'hl-red').length;
  $('#tabs').innerHTML = TABS.map(t =>
    `<button class="tab ${S.tab === t.k ? 'on' : ''}" data-act="tab" data-k="${t.k}">
       ${t.label}${t.k === 'packing' && conflicts ? `<span class="badge">${conflicts}</span>` : ''}
     </button>`).join('');

  const dupPlan = liveItems().filter(i => (i.kind === 'place' || i.kind === 'food') && analyze(i).type === 'dup').length;
  const bar = $('#alertBar');
  if (S.tab === 'packing' && conflicts) {
    bar.hidden = false;
    bar.innerHTML = `⚠️ 有 <b>${conflicts}</b> 项要注意：<span style="color:#B45309">黄色＝都带了（重复）</span>，<span style="color:#B91C1C">红色＝都不带（会漏）</span>。`;
  } else if ((S.tab === 'place' || S.tab === 'food') && dupPlan) {
    bar.hidden = false;
    bar.innerHTML = `🔥 <b>${dupPlan}</b> 个地点双方都想去 —— 已自动进入最终方案，记得排进某一天。`;
  } else {
    bar.hidden = true;
  }
}

/* ---------------- 渲染：主面板 ---------------- */
function renderPanel() {
  const kind = S.tab;
  const p = $('#panel');
  if (kind === 'packing' || kind === 'todo') {
    p.innerHTML = compareHTML(kind) + addBar(kind);
  } else {
    p.innerHTML = placesHTML(kind) + addBar(kind);
  }
}

function addBar(kind) {
  return `<div class="addbar">
    <button data-act="add" data-kind="${kind}">＋ 添加${kind === 'place' ? '地点' : kind === 'food' ? '餐厅' : '事项'}</button>
  </div>`;
}

const SHORT = {
  packing: { bring: '带了', ask: '你带', share: '共用', abstain: '不带' },
  place:   { bring: '想去', ask: '你去', share: '都行', abstain: '不去' },
  food:    { bring: '想吃', ask: '你去', share: '都行', abstain: '不吃' },
  todo:    { bring: '我办', ask: '你办', share: '一起', abstain: '算了' }
};

function tableHead() {
  return `<div class="thead">
    <div>事项</div>
    <div class="ha">${esc(S.members.A.name)}</div>
    <div class="hb">${esc(S.members.B.name)}</div>
  </div>`;
}

function finalShort(i) {
  const a = analyze(i);
  const isPlan = i.kind === 'place' || i.kind === 'food';
  if (a.type === 'dup') return isPlan ? '🔥 双方都想去' : '都带了 · 重复';
  if (a.type === 'blame') return '都在甩锅';
  if (a.type === 'drop') return isPlan ? '都不去' : '都不带 · 会漏';
  if (a.type === 'ok') {
    if (isPlan) return a.owner === 'share' ? '都行' : '已入选';
    if (a.owner === 'share') return '共用';
    return '由 ' + (a.owner === S.role ? '我' : S.members[a.owner].name) + ' 负责';
  }
  return '待定';
}

/* 自动规则：黄=都带了(重复)  红=都不带(会漏)  其余不高亮 */
function autoFlag(i) {
  const a = analyze(i);
  const isPlan = i.kind === 'place' || i.kind === 'food';
  if (a.type === 'dup') return isPlan ? 'hl-good' : 'hl-yellow';
  if (a.type === 'drop' && !isPlan) return 'hl-red';
  return '';
}
/* 最终高亮：手动设置优先，auto 才走规则 */
function rowFlag(i) {
  const h = (i.d && i.d.hl) || 'auto';
  if (h === 'none') return '';
  if (h === 'yellow') return 'hl-yellow';
  if (h === 'red') return 'hl-red';
  return autoFlag(i);
}

function cellHTML(i, side) {
  const pr = i.p[side];
  const lab = SHORT[i.kind] || SHORT.packing;
  const clash = analyze(i).type === 'dup' && pr && pr.status === 'bring';
  const main = pr ? (lab[pr.status] || '—') : '未填';
  return `<button class="cell2 ${side === 'A' ? 'a' : 'b'} ${pr ? 'filled' : ''} ${clash ? 'clash' : ''}"
    data-act="cell" data-id="${i.id}" data-side="${side}">
    <span class="st">${main}${pr && pr.qty ? ' ×' + pr.qty : ''}</span>
    ${pr && pr.text ? `<span class="tx">${esc(pr.text)}</span>` : ''}
  </button>`;
}

function dayChips(i) {
  const days = Array.from({ length: S.room.days }, (_, k) => k + 1);
  return ['未'].concat(days).map(d => {
    const on = d === '未' ? i.d.day == null : i.d.day === d;
    return `<button class="dbtn ${on ? 'on' : ''}" data-act="day" data-id="${i.id}" data-day="${d === '未' ? '' : d}">${d === '未' ? '未安排' : 'Day ' + d}</button>`;
  }).join('');
}

function rowHTML(i) {
  const a = analyze(i);
  const flag = rowFlag(i);
  const locked = isLocked(i);
  const cA = i.d.confirms.A === i.d.version, cB = i.d.confirms.B === i.d.version;
  const nm = s => esc(S.members[s].name).slice(0, 2);
  const isPlan = i.kind === 'place' || i.kind === 'food';
  const sub = finalShort(i);
  const subCls = flag === 'hl-yellow' ? 'warn' : flag === 'hl-red' ? 'danger'
    : flag === 'hl-good' ? 'good' : (a.type === 'pending' || a.type === 'blame' ? 'mute' : '');
  return `<div class="titem ${flag}">
    <div class="trow">
      <div class="tname">
        <div class="t1"><button class="hldot ${flag || (i.d.hl === 'none' ? 'off' : '')}" data-act="hl" data-id="${i.id}" title="设置这一行的高亮"></button>${esc(i.title)}<button class="rowdel" data-act="del" data-id="${i.id}" title="删除">×</button></div>
        <div class="t2 ${subCls}">${esc(sub)}${isPlan && i.pl.price ? ' · ' + money(i.pl.price) + '/人' : ''}</div>
      </div>
      ${cellHTML(i, 'A')}
      ${cellHTML(i, 'B')}
    </div>
    <div class="tnote">
      ${locked ? '<span class="lk">🔒</span>' : ''}
      <input class="fnote" placeholder="备注 / 最终方案，如：这家排队太久，换隔壁" value="${esc(i.d.note)}" data-act="dnote" data-id="${i.id}">
      <button class="cf2 ${cA ? 'on' : ''}" data-act="confirm" data-id="${i.id}" data-side="A" title="${esc(S.members.A.name)} 确认">${nm('A')}</button>
      <button class="cf2 ${cB ? 'on' : ''}" data-act="confirm" data-id="${i.id}" data-side="B" title="${esc(S.members.B.name)} 确认">${nm('B')}</button>
    </div>
    ${isPlan ? `<div class="tday">${dayChips(i)}</div>` : ''}
  </div>`;
}

function compareHTML(kind) {
  const items = liveItems().filter(i => i.kind === kind);
  if (!items.length) return `<div class="empty">还没有内容，点下面添加第一条</div>`;
  const cats = [...new Set(items.map(i => i.cat || '未分类'))];
  return tableHead() + cats.map(cat => {
    const rows = items.filter(i => (i.cat || '未分类') === cat);
    const bad = rows.filter(i => ['hl-yellow', 'hl-red'].includes(rowFlag(i))).length;
    return `<div class="group">
      <div class="ghead"><span>${esc(cat)}</span><span class="cnt">${rows.length} 项${bad ? ' · ' + bad + ' 待协商' : ''}</span></div>
      ${rows.map(rowHTML).join('')}
    </div>`;
  }).join('');
}

function placesHTML(kind) {
  const items = liveItems().filter(i => i.kind === kind);
  if (!items.length) return `<div class="empty">还没有想去的地方，先加两个试试</div>`;
  return tableHead() + `<div class="group">
    <div class="ghead"><span>${kind === 'food' ? '餐厅' : '地点'}</span><span class="cnt">${items.length} 个</span></div>
    ${items.map(rowHTML).join('')}
  </div>`;
}

/* ---------------- 渲染：地图 ---------------- */
function renderMap() {
  const day = S.mapDay || 1;
  const mode = S.mode || 'taxi';
  const pts = route(day);
  const modeName = { walk: '步行', taxi: '打车', transit: '公交' };

  const dayTabs = Array.from({ length: S.room.days }, (_, k) => k + 1).map(d =>
    `<button class="${d === day ? 'on' : ''}" data-act="mapday" data-day="${d}">Day ${d}</button>`).join('');

  const segs = [];
  for (let k = 1; k < pts.length; k++) {
    const m = haversine(pts[k - 1].pl, pts[k].pl);
    segs.push({ m, sec: legSeconds(m, mode) });
  }
  const total = segs.reduce((s, x) => s + x.sec, 0);
  let maxSpan = 0;
  for (let x = 0; x < pts.length; x++) for (let y = x + 1; y < pts.length; y++)
    maxSpan = Math.max(maxSpan, haversine(pts[x].pl, pts[y].pl));

  const warnList = [];
  if (pts.length > 5) warnList.push(`今天安排了 ${pts.length} 个点，行程过满，建议删减或分到第二天。`);
  if (total > 7200) warnList.push(`总通勤 ${fmtDur(total)}，路上时间偏多，建议调整顺序或打车。`);
  if (maxSpan > 40000) warnList.push(`最远两点相距 ${(maxSpan / 1000).toFixed(1)} km，跨度偏大。`);

  const legList = pts.map((p, k) => {
    const seg = k > 0 ? segs[k - 1] : null;
    return `<div class="leg">
      <span class="idx">${k + 1}</span>
      <span class="nm">${esc(p.title)}</span>
      <span class="tm">${seg ? fmtDur(seg.sec) + ' · ' + (seg.m / 1000).toFixed(1) + 'km' : '起点'}</span>
      <span class="mv">
        <button data-act="mv" data-id="${p.id}" data-dir="-1" title="上移">↑</button>
        <button data-act="mv" data-id="${p.id}" data-dir="1" title="下移">↓</button>
      </span>
    </div>`;
  }).join('');

  $('#mapPanel').innerHTML = `
    <div class="mapbox">
      <div class="mtop">
        <span class="ttl">路线地图</span>
        <div class="modes">
          ${['walk', 'taxi', 'transit'].map(m =>
            `<button class="${m === mode ? 'on' : ''}" data-act="mode" data-mode="${m}">${modeName[m]}</button>`).join('')}
        </div>
      </div>
      <div class="daytabs">${dayTabs}</div>
      ${mapSVG(pts)}
      <div class="stats">
        <div><span>点位</span><b class="${pts.length > 5 ? 'warn' : ''}">${pts.length} 个</b></div>
        <div><span>总通勤</span><b class="${total > 7200 ? 'warn' : ''}">${pts.length > 1 ? fmtDur(total) : '—'}</b></div>
        <div><span>最大跨度</span><b class="${maxSpan > 40000 ? 'warn' : ''}">${pts.length > 1 ? (maxSpan / 1000).toFixed(1) + ' km' : '—'}</b></div>
      </div>
      ${warnList.map(w => `<div class="mwarn">⚠️ ${w}</div>`).join('')}
      <div class="leglist">${legList || '<div class="empty" style="border:0;padding:14px">这一天还没有安排地点</div>'}</div>
      <button class="mbtn" data-act="optimize" data-day="${day}">✨ 一键优化顺序（省时）</button>
    </div>`;
}

function mapSVG(pts) {
  if (!pts.length) {
    return `<svg class="map" viewBox="0 0 640 260" preserveAspectRatio="xMidYMid meet">
      <text x="320" y="130" text-anchor="middle" font-size="13" fill="#A6ACB5">把地点排进 Day ${S.mapDay}，这里会自动连线</text>
    </svg>`;
  }
  const W = 640, H = 380, P = 54;
  let minLat = Math.min(...pts.map(p => p.pl.lat)), maxLat = Math.max(...pts.map(p => p.pl.lat));
  let minLng = Math.min(...pts.map(p => p.pl.lng)), maxLng = Math.max(...pts.map(p => p.pl.lng));
  if (maxLat - minLat < 1e-3) { minLat -= 0.01; maxLat += 0.01; }
  if (maxLng - minLng < 1e-3) { minLng -= 0.01; maxLng += 0.01; }
  const X = lng => P + ((lng - minLng) / (maxLng - minLng)) * (W - 2 * P);
  const Y = lat => H - P - ((lat - minLat) / (maxLat - minLat)) * (H - 2 * P);

  const coords = pts.map(p => ({ x: X(p.pl.lng), y: Y(p.pl.lat), p }));
  const path = coords.map((c, k) => (k ? 'L' : 'M') + c.x.toFixed(1) + ' ' + c.y.toFixed(1)).join(' ');

  const mode = S.mode || 'taxi';
  const dash = mode === 'walk' ? '6 6' : mode === 'transit' ? '2 7' : '0';

  let out = `<svg class="map" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
  out += `<defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3B82F6"/><stop offset="1" stop-color="#10B981"/></linearGradient></defs>`;
  // 网格
  for (let gx = P; gx <= W - P; gx += (W - 2 * P) / 6)
    out += `<line x1="${gx}" y1="${P - 12}" x2="${gx}" y2="${H - P + 12}" stroke="#EEF1F5"/>`;
  for (let gy = P - 12; gy <= H - P + 12; gy += (H - 2 * P) / 5)
    out += `<line x1="${P - 12}" y1="${gy}" x2="${W - P + 12}" y2="${gy}" stroke="#EEF1F5"/>`;

  out += `<path d="${path}" fill="none" stroke="url(#lg)" stroke-width="3.2" stroke-linecap="round"
           stroke-linejoin="round" stroke-dasharray="${dash}"/>`;

  // 每段耗时标签
  for (let k = 1; k < coords.length; k++) {
    const a = coords[k - 1], b = coords[k];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const sec = legSeconds(haversine(a.p.pl, b.p.pl), mode);
    out += `<rect x="${mx - 27}" y="${my - 10}" width="54" height="18" rx="9" fill="#fff" opacity=".92" stroke="#E5E8ED"/>`;
    out += `<text x="${mx}" y="${my + 3.5}" text-anchor="middle" font-size="10" fill="#5B616B">${fmtDur(sec)}</text>`;
  }

  coords.forEach((c, k) => {
    const isFood = c.p.kind === 'food';
    const fill = isFood ? '#F59E0B' : '#2563EB';
    out += `<circle cx="${c.x}" cy="${c.y}" r="13" fill="#fff" stroke="${fill}" stroke-width="2.4"/>`;
    out += `<text x="${c.x}" y="${c.y + 4}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${fill}">${k + 1}</text>`;
    const label = c.p.title.length > 6 ? c.p.title.slice(0, 6) + '…' : c.p.title;
    out += `<text x="${c.x}" y="${c.y + 27}" text-anchor="middle" font-size="10.5" fill="#5B616B">${esc(label)}</text>`;
  });

  out += `<g transform="translate(16,${H - 26})">
    <circle cx="6" cy="0" r="5" fill="#fff" stroke="#2563EB" stroke-width="2"/><text x="16" y="4" font-size="9.5" fill="#8B919B">景点</text>
    <circle cx="66" cy="0" r="5" fill="#fff" stroke="#F59E0B" stroke-width="2"/><text x="76" y="4" font-size="9.5" fill="#8B919B">餐厅</text>
  </g>`;
  out += `</svg>`;
  return out;
}

/* ---------------- 交互 ---------------- */
const mask = $('#mask'), sheet = $('#sheet');
function openSheet(html) { sheet.innerHTML = html; sheet.hidden = false; mask.hidden = false; }
function closeSheet() { sheet.hidden = true; mask.hidden = true; }

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2000);
}

function bump(i) { i.d.version += 1; i.d.confirms = {}; i._ts = Date.now(); }

let sheetState = null;

function openHlSheet(id) {
  const i = S.items.find(x => x.id === id);
  if (!i) return;
  const cur = (i.d && i.d.hl) || 'auto';
  const auto = autoFlag(i);
  const autoTxt = auto === 'hl-yellow' ? '自动（当前会标黄）'
    : auto === 'hl-red' ? '自动（当前会标红）'
    : auto === 'hl-good' ? '自动（当前淡绿）' : '自动（当前不标）';
  openSheet(`
    <div class="shead">高亮设置 · ${esc(i.title)}</div>
    <div class="opts">
      <button class="opt ${cur === 'auto' ? 'on' : ''}" data-act="sethl" data-id="${id}" data-v="auto">${autoTxt}</button>
      <button class="opt ${cur === 'yellow' ? 'on' : ''}" data-act="sethl" data-id="${id}" data-v="yellow">强制黄色</button>
      <button class="opt ${cur === 'red' ? 'on' : ''}" data-act="sethl" data-id="${id}" data-v="red">强制红色</button>
      <button class="opt ${cur === 'none' ? 'on' : ''}" data-act="sethl" data-id="${id}" data-v="none">不高亮</button>
    </div>
    <button class="ghost" data-act="close">取消</button>`);
}

function openCellSheet(id, side) {
  const i = S.items.find(x => x.id === id);
  if (!i) return;
  const lab = LABELS[i.kind] || LABELS.packing;
  const cur = i.p[side] || {};
  sheetState = { id, side, status: cur.status || null };
  const opts = Object.entries(lab).map(([k, v]) =>
    `<button class="opt ${cur.status === k ? 'on' : ''}" data-act="pickst" data-st="${k}">${v}</button>`).join('');
  openSheet(`
    <div class="shead">${esc(S.members[side].name)} · ${esc(i.title)}</div>
    <div class="opts">${opts}</div>
    <div class="srow"><label>数量</label><input id="qtyIn" type="number" min="1" value="${cur.qty || 1}"></div>
    <div class="srow"><label>自写</label><input id="txtIn" placeholder="如：我只有大瓶的 / 直接用你的" value="${esc(cur.text || '')}"></div>
    <button class="primary" data-act="savecell">保存</button>
    <button class="ghost" data-act="clearcell" data-id="${id}" data-side="${side}">清空这一栏</button>
    <button class="ghost" data-act="close">取消</button>`);
}

function openAddSheet(kind) {
  const isPlan = kind === 'place' || kind === 'food';
  const cats = [...new Set(S.items.filter(i => i.kind === kind).map(i => i.cat))];
  const catOpts = cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  openSheet(`
    <div class="shead">添加${kind === 'place' ? '地点' : kind === 'food' ? '餐厅' : '事项'}</div>
    <div class="srow"><label>名称</label><input id="nTitle" placeholder="${isPlan ? '如：西岛' : '如：墨镜'}"></div>
    <div class="srow"><label>分类</label>
      <select id="nCat">${catOpts}<option value="__new">＋ 新建分类</option></select>
    </div>
    <div class="srow" id="newCatRow" hidden><label>新分类</label><input id="nCatNew" placeholder="分类名"></div>
    ${isPlan ? `<div class="srow"><label>人均</label><input id="nPrice" type="number" min="0" placeholder="0"></div>` : ''}
    <button class="primary" data-act="doAdd" data-kind="${kind}">添加</button>
    <button class="ghost" data-act="close">取消</button>`);
  $('#nCat').addEventListener('change', e => {
    $('#newCatRow').hidden = e.target.value !== '__new';
  });
}

function openExpenseSheet() {
  openSheet(`
    <div class="shead">记一笔</div>
    <div class="srow"><label>项目</label><input id="eTitle" placeholder="如：打车去蜈支洲"></div>
    <div class="srow"><label>金额</label><input id="eAmt" type="number" min="0" placeholder="0"></div>
    <div class="srow"><label>付款人</label>
      <select id="ePayer"><option value="A">${esc(S.members.A.name)}</option><option value="B">${esc(S.members.B.name)}</option></select>
    </div>
    <button class="primary" data-act="doExpense">保存（AA 均分）</button>
    <button class="ghost" data-act="close">取消</button>`);
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (e.target === mask) { closeSheet(); return; }
  if (!t) return;
  const act = t.dataset.act;
  const id = t.dataset.id;
  const item = id ? S.items.find(x => x.id === id) : null;

  switch (act) {
    case 'role':
      S.role = t.dataset.side; render();
      toast(`已切换为 ${S.members[S.role].name} 的视角`);
      break;

    case 'tab':
      S.tab = t.dataset.k; render();
      break;

    case 'cell':
      openCellSheet(id, t.dataset.side);
      break;

    case 'hl':
      openHlSheet(id);
      break;

    case 'sethl': {
      const it3 = S.items.find(x => x.id === id);
      if (!it3) break;
      const v = t.dataset.v;
      if (v === 'auto') delete it3.d.hl; else it3.d.hl = v;
      it3._ts = Date.now();
      closeSheet(); render();
      break;
    }

    case 'pickst': {
      if (!sheetState) break;
      sheetState.status = t.dataset.st;
      $$('.opt', sheet).forEach(b => b.classList.toggle('on', b.dataset.st === sheetState.status));
      break;
    }

    case 'savecell': {
      if (!sheetState) break;
      const it2 = S.items.find(x => x.id === sheetState.id);
      if (!it2) break;
      if (!sheetState.status) { toast('先选一个状态'); break; }
      const side = sheetState.side;
      const q = parseInt(($('#qtyIn') || {}).value, 10);
      const txt = (($('#txtIn') || {}).value || '').trim();
      if (!it2.p[side]) it2.p[side] = {};
      it2.p[side].status = sheetState.status;
      if (!isNaN(q) && q > 1) it2.p[side].qty = q; else delete it2.p[side].qty;
      if (txt) it2.p[side].text = txt; else delete it2.p[side].text;
      bump(it2); closeSheet(); render();
      const a = analyze(it2);
      if (a.type === 'dup' && it2.kind !== 'place' && it2.kind !== 'food') toast('⚠️ 双方都标了「带了」，已提示协商');
      if (a.type === 'blame') toast('⚠️ 双方都在甩锅，这个没人带');
      break;
    }

    case 'clearcell':
      item.p[t.dataset.side] = null; bump(item); closeSheet(); render();
      break;

    case 'resolve': {
      const side = t.dataset.side;
      if (!item.p[side]) item.p[side] = {};
      item.p[side].status = 'abstain';
      bump(item); render();
      toast(`已标记 ${S.members[side].name} 不带`);
      break;
    }

    case 'confirm': {
      const side = t.dataset.side;
      item.d.confirms[side] = item.d.confirms[side] === item.d.version ? undefined : item.d.version;
      if (item.d.confirms[side] === undefined) delete item.d.confirms[side];
      item._ts = Date.now();
      render();
      toast(isLocked(item) ? '🔒 双方已确认，方案锁定' : '已记录确认，等待对方');
      break;
    }

    case 'day': {
      const d = t.dataset.day;
      item.d.day = d === '' ? null : parseInt(d, 10);
      if (item.d.day != null) {
        const same = S.items.filter(x => x.d.day === item.d.day && x.id !== item.id);
        item.d.order = same.length;
      }
      item._ts = Date.now();
      render();
      break;
    }

    case 'mapday':
      S.mapDay = parseInt(t.dataset.day, 10); render();
      break;

    case 'mode':
      S.mode = t.dataset.mode; render();
      break;

    case 'mv': {
      const dir = parseInt(t.dataset.dir, 10);
      const pts = route(item.d.day);
      const idx = pts.findIndex(x => x.id === item.id);
      const sw = idx + dir;
      if (sw < 0 || sw >= pts.length) break;
      const a = pts[idx], b = pts[sw];
      const tmp = a.d.order; a.d.order = b.d.order; b.d.order = tmp;
      a._ts = Date.now(); b._ts = Date.now();
      render();
      break;
    }

    case 'optimize': {
      const day = parseInt(t.dataset.day, 10);
      const pts = route(day);
      if (pts.length < 3) { toast('至少 3 个地点才能优化顺序'); break; }
      const before = totalSeconds(pts, S.mode);
      const rest = pts.slice(1);
      const out = [pts[0]];
      while (rest.length) {
        const last = out[out.length - 1];
        let bi = 0, bd = Infinity;
        rest.forEach((p, k) => { const d = haversine(last.pl, p.pl); if (d < bd) { bd = d; bi = k; } });
        out.push(rest.splice(bi, 1)[0]);
      }
      out.forEach((p, k) => { p.d.order = k; p._ts = Date.now(); });
      const after = totalSeconds(out, S.mode);
      save(); render();
      const gain = before - after;
      toast(gain > 60
        ? `✨ 已优化：通勤 ${fmtDur(before)} → ${fmtDur(after)}，省 ${Math.round(gain / 60)} 分钟`
        : `当前顺序已接近最优（通勤 ${fmtDur(before)}）`);
      break;
    }

    case 'add':
      openAddSheet(t.dataset.kind);
      break;

    case 'doAdd': {
      const kind = t.dataset.kind;
      const title = ($('#nTitle') || {}).value?.trim();
      if (!title) { toast('请填写名称'); break; }
      let cat = $('#nCat').value;
      if (cat === '__new') cat = ($('#nCatNew').value || '').trim() || '未分类';
      const price = $('#nPrice') ? parseInt($('#nPrice').value, 10) || 0 : 0;
      const ni = it({ kind, cat, title, pl: {} });
      if (kind === 'place' || kind === 'food') {
        ni.pl = {
          lat: 18.25 + (Math.random() - 0.5) * 0.12,
          lng: 109.52 + (Math.random() - 0.5) * 0.18,
          price, dur: 90
        };
      }
      S.items.push(ni); ni._ts = Date.now(); closeSheet(); render();
      toast('已添加');
      break;
    }

    case 'expense':
      openExpenseSheet();
      break;

    case 'doExpense': {
      const title = ($('#eTitle').value || '').trim() || '未命名支出';
      const amt = parseFloat($('#eAmt').value);
      if (!amt || amt <= 0) { toast('请填写金额'); break; }
      S.expenses.push({ id: uid(), title, amount: amt, payer: $('#ePayer').value });
      closeSheet(); render();
      toast('已记账');
      break;
    }

    case 'reset':
      if (confirm('重置为演示数据？当前修改会丢失。')) {
        S = seed(); S._ts = Date.now(); save(); render(); toast('已重置');
      }
      break;

    case 'settings':
      openTripSheet();
      break;

    case 'wipe': {
      if (!confirm('清空所有条目和账目？对方那边也会一起清空，且无法恢复。')) break;
      S.items = [];
      S.expenses = [];
      S.room = Object.assign({}, S.room, { _wipe: Date.now() });
      S._ts = Date.now();
      closeSheet(); render(); toast('已清空，开始列你自己的清单吧');
      break;
    }

    case 'tripSave': {
      const nm = ($('#tName').value || '').trim() || '未命名行程';
      const d = Math.min(30, Math.max(1, parseInt($('#tDays').value, 10) || 1));
      S.room = { name: nm, days: d, start: $('#tStart').value || S.room.start };
      S._ts = Date.now();
      closeSheet(); render(); toast('行程已更新');
      break;
    }

    case 'del': {
      const it = S.items.find(x => x.id === id);
      if (!it) break;
      if (!confirm(`删除「${it.title}」？对方那边也会一起消失。`)) break;
      it._del = true; it._ts = Date.now();
      render(); toast('已删除');
      break;
    }

    case 'sync':
      openSyncSheet();
      break;

    case 'syncSave': {
      const u = ($('#sUrl').value || '').trim().replace(/\/+$/, '');
      const k = ($('#sKey').value || '').trim();
      let r = ($('#sRoom').value || '').trim();
      if (!u || !k) { toast('URL 和 Key 都要填'); break; }
      if (!/^https?:\/\//.test(u)) { toast('URL 要以 https:// 开头'); break; }
      if (!r) r = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
      CFG = { url: u, key: k, room: r };
      cfgSave();
      closeSheet();
      setStatus('sync', '连接中…');
      syncOnce().then(() => { if (syncState.status !== 'error') toast('✅ 同步已开启'); else toast('连接失败，检查 URL / Key / 建表语句'); });
      startPolling();
      break;
    }

    case 'syncShare': {
      const base = location.href.split('?')[0].split('#')[0];
      const link = base + '?r=' + encodeURIComponent(CFG.room) + '&u=' + encodeURIComponent(CFG.url) + '&k=' + encodeURIComponent(CFG.key);
      copyText(link);
      break;
    }

    case 'syncOff': {
      CFG = {};
      cfgSave();
      clearInterval(pollTimer);
      clearInterval(beatTimer);
      closeSheet();
      setStatus('off', '仅本机');
      toast('已断开同步，数据仍在本机');
      break;
    }

    case 'syncExport':
      copyText(JSON.stringify(S));
      break;

    case 'syncImport': {
      const raw = prompt('粘贴之前导出的 JSON：');
      if (!raw) break;
      try {
        const d = JSON.parse(raw);
        if (!d || !Array.isArray(d.items)) throw new Error('bad');
        S = d; S._ts = Date.now(); dirty = true;
        closeSheet(); render();
        toast('已从存档恢复');
      } catch (e) { toast('JSON 格式不对'); }
      break;
    }

    case 'close':
      closeSheet();
      break;
  }
});

document.addEventListener('change', e => {
  const t = e.target.closest('[data-act="dnote"]');
  if (!t) return;
  const item = S.items.find(x => x.id === t.dataset.id);
  if (!item) return;
  if (item.d.note !== t.value) {
    item.d.note = t.value; bump(item); save(); render();
  }
});

/* ---------------- 启动 ---------------- */
function render() {
  renderTop(); renderTabs(); renderPanel(); renderMap(); save();
}
initSyncFromURL();
render();
if (syncOn()) { setStatus('sync', '连接中…'); syncOnce(); startPolling(); }
else setStatus('off', '仅本机');

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && syncOn()) syncOnce();
});
