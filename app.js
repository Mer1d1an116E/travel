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

function starterPack() {
  const m = (cat, title) => it({ cat, title, p: { A: null, B: null } });
  return [
    m('证件类', '身份证'), m('证件类', '银行卡'), m('证件类', '少量现金'),
    m('洗漱用品', '牙刷 / 牙膏'), m('洗漱用品', '洗面奶'), m('洗漱用品', '毛巾'),
    m('电子设备', '充电器'), m('电子设备', '充电宝'), m('电子设备', '耳机'),
    m('衣物', '换洗衣物'), m('衣物', '拖鞋'),
    m('其他', '常用药'), m('其他', '雨伞'), m('其他', '防晒霜')
  ];
}

let S = null;              // 当前打开的行程（DB.trips 里的同一个引用）
let DB = loadDB();

function blankTrip(name) {
  return {
    id: uid(), syncRoom: '', role: 'A',
    room: { name: name || '新行程', days: 3, start: new Date(Date.now() + 864e5 * 14).toISOString().slice(0, 10) },
    members: { A: { name: '我' }, B: { name: '朋友' } },
    items: [], expenses: [], seen: { A: 0, B: 0 }, _ts: 0, roomTs: 0,
    tab: 'packing', mapDay: 1, mode: 'taxi'
  };
}

function loadDB() {
  let raw = null;
  try { raw = localStorage.getItem(LS); } catch (e) {}
  if (raw) {
    try {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.trips)) { d.currentId = null; return d; }
      if (d && Array.isArray(d.items)) {          // 旧版单行程 → 迁移成一条行程
        let oldRoom = '';
        try { oldRoom = (JSON.parse(localStorage.getItem('tripsync_cfg') || '{}').room) || ''; } catch (e) {}
        d.id = d.id || uid();
        d.syncRoom = d.syncRoom || oldRoom;
        return { trips: [d], currentId: null };
      }
    } catch (e) {}
  }
  const demo = seed(); demo.id = uid(); demo.syncRoom = '';
  return { trips: [demo], currentId: null };
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
  try { localStorage.setItem(LS, JSON.stringify(DB)); } catch (e) {}
  if (!S) return;
  dirty = true;
  schedulePush();
}

/* --- 网络 --- */
function apiPath(p) { return CFG.url.replace(/\/+$/, '') + '/rest/v1/' + p; }
function hdr() {
  return { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key, 'Content-Type': 'application/json' };
}

function payload() {
  if (!S) return null;
  const seen = Object.assign({ A: 0, B: 0 }, S.seen || {});
  seen[S.role] = Date.now();
  S.seen = seen;
  return { room: S.room, members: S.members, items: S.items, expenses: S.expenses, seen, roomTs: S.roomTs || 0, _ts: S._ts || 0 };
}
function docSig() {
  if (!S) return '';
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
  if (!syncOn() || pushing || !S) return;
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

  if (rts > (S._ts || 0)) S._ts = rts;
  const rr = remote.roomTs || remote._ts || 0;
  const remoteLive = (remote.items || []).filter(i => !i._del).length;
  const localLive = S.items.filter(i => !i._del).length;
  const blankShell = remoteLive === 0 && localLive > 0;      // 对方是空行程，别覆盖我的
  const localShell = localLive === 0 && remoteLive > 0;      // 我是刚建的空壳，以对方为准
  if (!blankShell && (localShell || rr > (S.roomTs || 0))) {
    if (remote.room) S.room = remote.room;
    if (remote.members) S.members = remote.members;
    S.roomTs = Math.max(S.roomTs || 0, rr);
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
  if (!syncOn() || !S) return;
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
  const r = q.get('r'), u = q.get('u'), k = q.get('k');
  try { history.replaceState({}, '', location.pathname); } catch (e) {}  // 清掉地址栏里的密钥
  if (u && k) { CFG.url = u; CFG.key = k; cfgSave(); }
  if (!r) return false;
  let t = DB.trips.find(x => x.syncRoom === r);
  if (!t) {
    t = blankTrip('一起的行程');
    t.syncRoom = r;
    DB.trips.push(t);
  }
  openTrip(t);
  return true;
}

function openTripSheet() {
  openSheet(`
    <div class="shead">行程设置</div>
    <div style="font-size:11.5px;color:#8B919B;margin:-6px 0 10px">
      同步：${S.syncRoom ? ((CFG.url && CFG.key) ? '已绑定房间 ' + S.syncRoom.slice(0, 6) + '…' : '已生成房间，但还没填 URL / Key') : '仅本机 · 点下面按钮生成邀请链接'}
    </div>
    <div class="srow"><label>名称</label><input id="tName" value="${esc(S.room.name)}"></div>
    <div class="srow"><label>城市</label><input id="tCity" placeholder="如：上海（用于判断有无地铁）" value="${esc(S.room.city || '')}"></div>
    <div class="srow"><label>天数</label><input id="tDays" type="number" min="1" max="30" value="${S.room.days}"></div>
    <div class="srow"><label>出发</label><input id="tStart" type="date" value="${esc(S.room.start)}"></div>
    <div class="srow"><label>我</label><input id="tNameA" placeholder="你的名字" value="${esc(S.members.A.name)}"></div>
    <div class="srow"><label>对方</label><input id="tNameB" placeholder="朋友的名字" value="${esc(S.members.B.name)}"></div>
    <button class="primary" data-act="tripSave">保存</button>
    <button class="ghost" data-act="syncShare">📋 复制邀请链接给朋友（同一行程一起填）</button>
    <button class="ghost" data-act="wipe" style="color:#B91C1C">清空所有条目和账目（重新开始）</button>
    <button class="ghost" data-act="close">取消</button>`);
}

async function testConn() {
  if (!CFG.url || !CFG.key) { toast('还没填 Supabase URL / Key'); return; }
  if (!S) { toast('先进入一个行程'); return; }
  if (!S.syncRoom) { S.syncRoom = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12); }
  CFG.room = S.syncRoom; cfgSave();
  setStatus('sync', '测试中…');
  try {
    const remote = await pull();
    if (!remote) {
      await push();
      toast('服务器还没有这个房间，已创建 ✅');
    } else {
      toast('连接正常 ✅ 服务器上有 ' + (remote.items || []).filter(i => !i._del).length + ' 条');
      setStatus('ok', '已连接');
      const changed = mergeDoc(remote);
      if (changed) render();
    }
  } catch (e) {
    const h = syncHint(e);
    setStatus('error', h);
    toast('连接失败：' + h);
  }
}

function openSyncSheet() {
  const on = syncOn();
  const other = S.role === 'A' ? 'B' : 'A';
  const otherSeen = (S.seen || {})[other];
  const st = !on ? '仅本机（数据只存在这台设备）'
    : syncState.status === 'ok' ? '✅ 已连接 · 房间 ' + (CFG.room || '').slice(0, 8) + '…'
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
    <div class="diag">
      <div><span>房间号</span><b>${esc((S && S.syncRoom) || '未生成')}</b></div>
      <div><span>本机条目</span><b>${S ? liveItems().length : 0}</b></div>
      <div><span>服务器</span><b>${CFG.url ? '已填地址' : '未填'}</b></div>
    </div>
    ${(CFG.url && CFG.key && S) ? '<button class="ghost" data-act="synctest">🔌 测试连接（看服务器上有几条）</button>' : ''}
    <div class="srow"><label>URL</label><input id="sUrl" placeholder="https://xxxx.supabase.co" value="${esc(CFG.url || '')}"></div>
    <div class="srow"><label>Key</label><input id="sKey" placeholder="anon public key（eyJhb…）" value="${esc(CFG.key || '')}"></div>
    <div class="srow"><label>房间</label><input id="sRoom" placeholder="留空自动生成" value="${esc((S && S.syncRoom) || '')}"></div>
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
const SPEED = { walk: 4500, taxi: 22000, transit: 16000, metro: 32000 };
const OVERHEAD = { walk: 0, taxi: 180, transit: 420, metro: 300 };
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

/* ---------------- 行程首页 ---------------- */
function withTrip(t, fn) {
  const old = S; S = t;
  try { return fn(); } finally { S = old; }
}

function tripCard(t) {
  const n = t.items.filter(i => !i._del).length;
  const warn = withTrip(t, () => t.items.filter(i => ['hl-yellow', 'hl-red'].includes(rowFlag(i))).length);
  const est = withTrip(t, () => budget().est);
  const syncTxt = !t.syncRoom ? '仅本机' : (CFG.url && CFG.key ? '已同步' : '待配置');
  return `<div class="tripcard" data-act="open" data-id="${t.id}">
    <div class="tc-top">
      <div class="tc-name">${esc(t.room.name)}</div>
      <span class="tc-badge ${t.syncRoom ? 'on' : ''}">${syncTxt}</span>
    </div>
    <div class="tc-meta">${esc(t.room.start || '')} · ${t.room.days} 天 · ${esc(t.members.A.name)} &amp; ${esc(t.members.B.name)}${t.syncRoom ? ' · <span class="tcid">#' + esc(t.syncRoom.slice(0, 6)) + '</span>' : ''}</div>
    <div class="tc-stat">
      <span><b>${n}</b> 条目</span>
      <span><b class="${warn ? 'warn' : ''}">${warn}</b> 待处理</span>
      <span><b>${money(est)}</b> 预估</span>
    </div>
    <button class="tc-del" data-act="delTrip" data-id="${t.id}" title="删除行程">×</button>
  </div>`;
}

function renderHome() {
  $('#roomName').textContent = '我的行程';
  $('#roomMeta').textContent = DB.trips.length + ' 个行程';
  $('#members').innerHTML = '';
  $('#budgetStrip').innerHTML = '';
  $('#tabs').innerHTML = '';
  $('#alertBar').hidden = true;
  $('#mapPanel').innerHTML = '';
  $('#panel').innerHTML = DB.trips.map(tripCard).join('') +
    `<button class="newtrip" data-act="newTrip">＋ 新建行程</button>
     <div class="homefoot">点卡片进入 · 数据存在本机，配置 Supabase 后两人实时同步</div>`;
}

function openTrip(t) {
  S = t;
  if (!S.role) S.role = 'A';
  if (!S.seen) S.seen = { A: 0, B: 0 };
  if (!S.tab) S.tab = 'packing';
  if (!S.mapDay) S.mapDay = 1;
  if (!S.mode) S.mode = 'taxi';
  DB.currentId = t.id;
  CFG.room = t.syncRoom || '';
  cfgSave();
  document.body.classList.remove('home');
  const back = $('#backBtn'); if (back) back.hidden = false;
  render();
  if (CFG.url && CFG.key && CFG.room) { setStatus('sync', '连接中…'); syncOnce(); startPolling(); }
  else { setStatus('off', '仅本机'); clearInterval(pollTimer); clearInterval(beatTimer); }
}

function goHome() {
  S = null; DB.currentId = null;
  clearInterval(pollTimer); clearInterval(beatTimer);
  document.body.classList.add('home');
  const back = $('#backBtn'); if (back) back.hidden = true;
  save();
  renderHome();
}

function openNewTripSheet() {
  openSheet(`
    <div class="shead">新建行程</div>
    <div class="srow"><label>名称</label><input id="nTripName" placeholder="如：厦门 · 周末"></div>
    <div class="srow"><label>天数</label><input id="nTripDays" type="number" min="1" max="30" value="3"></div>
    <div class="srow"><label>出发</label><input id="nTripStart" type="date" value="${new Date(Date.now() + 864e5 * 14).toISOString().slice(0, 10)}"></div>
    <div class="srow"><label>我</label><input id="nTripA" placeholder="你的名字"></div>
    <div class="srow"><label>对方</label><input id="nTripB" placeholder="朋友的名字"></div>
    <div class="srow" style="align-items:center"><label>模板</label>
      <label style="font-size:12px;color:#6B7280;display:flex;align-items:center;gap:6px">
        <input id="nTripTpl" type="checkbox" style="flex:0 0 auto;width:16px" checked> 带一份基础行李清单
      </label>
    </div>
    <button class="primary" data-act="doNewTrip">创建</button>
    <button class="ghost" data-act="close">取消</button>`);
}

/* ---------------- 渲染：顶栏 ---------------- */
function renderTop() {
  $('#roomName').textContent = S.room.name;
  $('#roomMeta').textContent = (S.room.city ? S.room.city + ' · ' : '') + `${S.room.days} 天 · 出发 ${S.room.start}`;
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
        <div class="t1"><button class="hldot ${flag || (i.d.hl === 'none' ? 'off' : '')}" data-act="hl" data-id="${i.id}" title="设置这一行的高亮"></button>${esc(i.title)}${(i.pl && i.pl.lat) ? `<button class="rowpin" data-act="amap" data-id="${i.id}" title="在高德地图打开这个点">📍</button>` : ''}<button class="rowdel" data-act="del" data-id="${i.id}" title="删除">×</button></div>
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

/* ---------------- 真实地图（高德 JS API） ---------------- */
const MAP_KEY = 'tripsync_map';
let AMAP = { map: null, host: null, overlays: [], loading: null, failed: false, seq: 0 };

function mapCfg() { try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}'); } catch (e) { return {}; } }
function mapReady() { const c = mapCfg(); return !!(c.key && !AMAP.failed); }

function loadAMap(key, code) {
  if (window.AMap) return Promise.resolve();
  if (AMAP.loading) return AMAP.loading;
  AMAP.loading = new Promise((res, rej) => {
    window._AMapSecurityConfig = { securityJsCode: code || '' };
    const sc = document.createElement('script');
    sc.src = 'https://webapi.amap.com/maps?v=2.0&key=' + encodeURIComponent(key);
    sc.onload = () => res();
    sc.onerror = () => rej(new Error('脚本加载失败'));
    document.head.appendChild(sc);
  });
  return AMAP.loading;
}

function drawAmap(pts) {
  const map = AMAP.map, A = window.AMap;
  if (!map || !A) return;
  if (AMAP.overlays.length) map.remove(AMAP.overlays);
  AMAP.overlays = [];
  if (!pts.length) { map.setCenter([116.397, 39.909]); map.setZoom(10); return; }

  const COLORS = { walk: '#10B981', taxi: '#3B82F6', transit: '#F59E0B', metro: '#7C3AED' };
  for (let k = 1; k < pts.length; k++) {
    const L = legInfo(pts, k);
    AMAP.overlays.push(new A.Polyline({
      path: [[pts[k - 1].pl.lng, pts[k - 1].pl.lat], [pts[k].pl.lng, pts[k].pl.lat]],
      strokeColor: COLORS[L.mode] || '#3B82F6',
      strokeWeight: L.mode === 'metro' ? 7 : 5,
      strokeOpacity: .9, showDir: true, lineJoin: 'round'
    }));
  }
  pts.forEach((p, k) => {
    const mk = new A.Marker({
      position: [p.pl.lng, p.pl.lat], title: p.title,
      label: {
        content: '<div class="amap-lb">' + (k + 1) + '. ' + esc(p.title) + '</div>',
        direction: 'top', offset: new A.Pixel(0, -4)
      }
    });
    mk.on('click', () => openLegSheet(p.id));
    AMAP.overlays.push(mk);
  });
  map.add(AMAP.overlays);
  try { map.setFitView(AMAP.overlays, false, [70, 70, 70, 70]); } catch (e) {}
}

async function mountAmap(pts) {
  const slot = document.getElementById('mapSlot');
  if (!slot) return;
  const seq = ++AMAP.seq;
  const c = mapCfg();
  try {
    await loadAMap(c.key, c.code);
    if (seq !== AMAP.seq) return;
    if (!AMAP.host) {
      AMAP.host = document.createElement('div');
      AMAP.host.style.cssText = 'width:100%;height:100%';
    }
    slot.appendChild(AMAP.host);
    if (!AMAP.map) {
      AMAP.map = new window.AMap.Map(AMAP.host, { zoom: 11, viewMode: '2D', resizeEnable: true });
    } else {
      AMAP.map.resize();
    }
    drawAmap(pts);
  } catch (e) {
    AMAP.failed = true;
    toast('地图加载失败：' + e.message + '（先看下 Key / 安全密钥 / 域名白名单）');
    render();
  }
}

function openMapKeySheet() {
  const c = mapCfg();
  openSheet(`
    <div class="shead">真实地图 · 高德 JS API</div>
    <div style="font-size:11.5px;color:#8B919B;margin:-6px 0 10px">不填也能用，网页继续显示现在这张示意图。</div>
    <div class="srow"><label>Key</label><input id="mkKey" placeholder="Web端(JS API) Key" value="${esc(c.key || '')}"></div>
    <div class="srow"><label>安全密钥</label><input id="mkCode" placeholder="securityJsCode（jscode）" value="${esc(c.code || '')}"></div>
    <button class="primary" data-act="saveMapKey">保存并加载</button>
    ${c.key ? '<button class="ghost" data-act="clearMapKey">关闭真实地图，回到示意图</button>' : ''}
    <button class="ghost" data-act="close">取消</button>
    <details style="margin-top:12px">
      <summary style="font-size:11.5px;color:#6B7280;cursor:pointer">怎么拿 Key（约 10 分钟，需实名）</summary>
      <div style="margin-top:8px;padding:10px;border-radius:10px;background:#F6F7F9;font-size:11px;line-height:1.7;color:#6B7280">
        1. lbs.amap.com 注册个人开发者 → 完成实名<br>
        2. 控制台 → 应用管理 → 创建新应用<br>
        3. 添加 Key → 服务平台选「Web端(JS API)」<br>
        4. 同页会生成「安全密钥 jscode」，两个都要填到上面<br>
        5. 域名白名单填：<code style="background:#fff;padding:1px 4px;border-radius:4px">mer1d1an116e.github.io</code>
      </div>
    </details>`);
}

/* ---------------- 路径规划（经 Supabase Edge Function 代理） ---------------- */
const ROUTE_CACHE_KEY = 'tripsync_routes';
const ROUTE_TTL = 7 * 864e5;

function routeCacheAll() { try { return JSON.parse(localStorage.getItem(ROUTE_CACHE_KEY) || '{}'); } catch (e) { return {}; } }
function routeCachePut(k, data) {
  const all = routeCacheAll();
  all[k] = { at: Date.now(), data };
  try { localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(all)); } catch (e) {}
}
function planReady() { return !!(CFG.url && CFG.key); }

async function callPlan(a, b, mode) {
  if (!planReady()) throw new Error('先在 ☁ 里配好 Supabase 才能自动规划');
  const city = (S.room.city || '').trim();
  const k = [a.lng.toFixed(5), a.lat.toFixed(5), b.lng.toFixed(5), b.lat.toFixed(5), city, mode || 'transit'].join('|');
  const hit = routeCacheAll()[k];
  if (hit && Date.now() - hit.at < ROUTE_TTL) return hit.data;

  const res = await fetch(CFG.url.replace(/\/+$/, '') + '/functions/v1/transit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: CFG.key, Authorization: 'Bearer ' + CFG.key },
    body: JSON.stringify({ from: a.lng + ',' + a.lat, to: b.lng + ',' + b.lat, city, mode: mode || 'transit' })
  });
  let d;
  try { d = await res.json(); } catch (e) { throw new Error('返回不是 JSON（函数可能还没部署）'); }
  if (!res.ok || d.error) throw new Error(d.error || ('HTTP ' + res.status));
  routeCachePut(k, d);
  return d;
}

async function planDay(day) {
  const pts = route(day);
  if (pts.length < 2) { toast('这一天至少要有 2 个地点'); return; }
  if (!planReady()) { toast('先在 ☁ 里配好 Supabase'); return; }
  toast('正在规划，可能需要几秒…');
  let ok = 0;
  for (let k = 1; k < pts.length; k++) {
    const it = pts[k];
    try {
      const d = await callPlan(pts[k - 1].pl, it.pl, 'transit');
      const metro = d.steps.find(x => x.mode === 'metro');
      it.d.leg = {
        mode: metro ? 'metro' : 'transit',
        line: d.summary,
        mins: Math.max(1, Math.round(d.dur / 60)),
        auto: true
      };
      it._ts = Date.now();
      ok++;
    } catch (e) {
      toast('规划失败：' + e.message);
      break;
    }
  }
  render();
  if (ok) toast('已自动填好 ' + ok + ' 段路线');
}

async function autoLegFromSheet(id) {
  const it = S.items.find(x => x.id === id);
  if (!it) return;
  if (it.d.day == null) { toast('这个地点还没排进某一天'); return; }
  const pts = route(it.d.day);
  const idx = pts.findIndex(x => x.id === id);
  if (idx < 1) { toast('这是当天第一个点，没有上一站'); return; }
  if (!planReady()) { toast('先在 ☁ 里配好 Supabase'); return; }
  toast('查询中…');
  try {
    const d = await callPlan(pts[idx - 1].pl, it.pl, 'transit');
    const metro = d.steps.find(x => x.mode === 'metro');
    if (legState) {
      legState.mode = metro ? 'metro' : 'transit';
      legState.auto = true;
      $$('.opt', sheet).forEach(b => b.classList.toggle('on', b.dataset.v === legState.mode));
    }
    const li = $('#legLineIn'); if (li) li.value = d.summary;
    const mi = $('#legMinsIn'); if (mi) mi.value = Math.max(1, Math.round(d.dur / 60));
    toast('已填入，点保存生效');
  } catch (e) {
    toast('规划失败：' + e.message);
  }
}

/* ---------------- 交通方式与路段 ---------------- */
const MODES = [
  { k: 'walk',    label: '步行', color: '#10B981', dash: '6 6' },
  { k: 'taxi',    label: '打车', color: '#3B82F6', dash: '0' },
  { k: 'transit', label: '公交', color: '#F59E0B', dash: '2 7' },
  { k: 'metro',   label: '地铁', color: '#7C3AED', dash: '0' }
];
const MODE_OF = {};
MODES.forEach(m => { MODE_OF[m.k] = m; });

const METRO_CITIES = ['北京', '上海', '广州', '深圳', '成都', '重庆', '杭州', '武汉', '西安', '南京',
  '天津', '苏州', '郑州', '长沙', '青岛', '沈阳', '大连', '昆明', '合肥', '福州', '厦门', '南宁',
  '南昌', '贵阳', '石家庄', '太原', '兰州', '乌鲁木齐', '呼和浩特', '温州', '宁波', '无锡', '佛山',
  '东莞', '香港', '澳门', '长春', '哈尔滨', '济南', '徐州', '绍兴', '常州', '洛阳', '芜湖', '南通'];

function legOf(item) { return (item && item.d && item.d.leg) || {}; }
function legMode(item) { return legOf(item).mode || S.mode || 'taxi'; }
function legLine(item) { return legOf(item).line || ''; }
function legMins(item) {
  const v = legOf(item).mins;
  return (v === 0 || v) ? Number(v) : null;
}
function legInfo(pts, k) {                 // 第 k 段：pts[k-1] → pts[k]
  const to = pts[k];
  const mode = legMode(to);
  const m = haversine(pts[k - 1].pl, to.pl);
  const est = legSeconds(m, mode);
  const man = legMins(to);
  return { mode, line: legLine(to), m, est, sec: man != null ? Math.round(man * 60) : est, manual: man != null, auto: !!legOf(to).auto };
}
function daySeconds(pts) {
  let t = 0;
  for (let k = 1; k < pts.length; k++) t += legInfo(pts, k).sec;
  return t;
}

/* ---------------- 渲染：地图 ---------------- */
function renderMap() {
  const day = S.mapDay || 1;
  const pts = route(day);
  const view = S.mapView || 'map';
  const total = daySeconds(pts);
  let maxSpan = 0;
  for (let x = 0; x < pts.length; x++) for (let y = x + 1; y < pts.length; y++)
    maxSpan = Math.max(maxSpan, haversine(pts[x].pl, pts[y].pl));

  const dayTabs = Array.from({ length: S.room.days }, (_, k) => k + 1).map(d =>
    `<button class="${d === day ? 'on' : ''}" data-act="mapday" data-day="${d}">Day ${d}</button>`).join('');

  const warnList = [];
  if (pts.length > 5) warnList.push(`今天安排了 ${pts.length} 个点，行程过满，建议删减或分到第二天。`);
  if (total > 7200) warnList.push(`总通勤 ${fmtDur(total)}，路上时间偏多，建议调整顺序或换交通方式。`);
  if (maxSpan > 40000) warnList.push(`最远两点相距 ${(maxSpan / 1000).toFixed(1)} km，跨度偏大。`);

  const legRows = pts.map((p, k) => {
    if (k === 0) return `<div class="leg"><span class="idx">1</span><span class="nm">${esc(p.title)}</span><span class="tm">起点</span></div>`;
    const L = legInfo(pts, k);
    const mc = MODE_OF[L.mode] || MODE_OF.taxi;
    return `<button class="leg" data-act="leg" data-id="${p.id}">
      <span class="idx">${k + 1}</span>
      <span class="nm">${esc(p.title)}</span>
      <span class="tm"><i class="dc" style="background:${mc.color}"></i>${mc.label}${L.line ? ' · ' + esc(L.line) : ''} · ${fmtDur(L.sec)}${L.auto ? ' <b class="auto">自动</b>' : L.manual ? ' ✎' : ''}</span>
    </button>`;
  }).join('');

  $('#mapPanel').innerHTML = `
    <div class="mapbox">
      <div class="mtop">
        <span class="ttl">路线</span>
        <div style="display:flex;align-items:center;gap:6px">
        <button class="gearbtn" data-act="mapkey" title="地图设置">⚙</button>
        <div class="modes">
          <button class="${view === 'map' ? 'on' : ''}" data-act="mapview" data-v="map">地图</button>
          <button class="${view === 'metro' ? 'on' : ''}" data-act="mapview" data-v="metro">路线</button>
        </div>
        </div>
      </div>
      <div class="daytabs">${dayTabs}</div>
      <div class="mdefault">
        <span class="lbl">默认</span>
        ${MODES.map(m => `<button class="${(S.mode || 'taxi') === m.k ? 'on' : ''}" data-act="mode" data-mode="${m.k}">${m.label}</button>`).join('')}
        ${view === 'metro' ? `<label class="stime">出发<input type="time" data-act="stime" value="${esc(S.room.startTime || '09:00')}"></label>` : ''}
      </div>
      ${view === 'metro' ? routeDiagram(pts) : (mapReady() && pts.length ? '<div id="mapSlot" class="map-slot"></div>' : mapSVG(pts))}
      <div class="stats">
        <div><span>点位</span><b class="${pts.length > 5 ? 'warn' : ''}">${pts.length} 个</b></div>
        <div><span>总通勤</span><b class="${total > 7200 ? 'warn' : ''}">${pts.length > 1 ? fmtDur(total) : '—'}</b></div>
        <div><span>最大跨度</span><b class="${maxSpan > 40000 ? 'warn' : ''}">${pts.length > 1 ? (maxSpan / 1000).toFixed(1) + ' km' : '—'}</b></div>
      </div>
      ${warnList.map(w => `<div class="mwarn">⚠️ ${w}</div>`).join('')}
      <div class="leglist">${legRows || '<div class="empty" style="border:0;padding:14px">这一天还没有安排地点</div>'}</div>
      ${pts.length > 1 ? '<div style="font-size:10.5px;color:#A6ACB5;padding:0 12px 8px">点任意一段可单独改交通方式和地铁线路</div>' : ''}
      <button class="mbtn ghostbtn" data-act="planday" data-day="${day}">🛣 自动规划这一天（高德实时路线）</button>
      <button class="mbtn" data-act="optimize" data-day="${day}">✨ 一键优化顺序（省时）</button>
      <button class="mbtn ghostbtn" data-act="copyday" data-day="${day}">📋 复制今天的地点清单（名称 + 坐标）</button>
    </div>`;

  if (view !== 'metro' && mapReady() && pts.length) mountAmap(pts);
}

function hm(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.round(mins % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
function startMinutes() {
  const t = (S.room.startTime || '09:00').split(':');
  return (parseInt(t[0], 10) || 9) * 60 + (parseInt(t[1], 10) || 0);
}

function routeDiagram(pts) {
  if (!pts.length) return `<div class="empty" style="margin:12px">把地点排进 Day ${S.mapDay || 1}，这里会按顺序列出每一段路</div>`;
  let acc = startMinutes();
  let out = '<div class="metro">';
  pts.forEach((p, k) => {
    if (k > 0) {
      const L = legInfo(pts, k);
      const mc = MODE_OF[L.mode] || MODE_OF.taxi;
      acc += L.sec / 60;
      out += `<div class="mline">
        <span class="mtime"></span>
        <span class="mbar" style="background:${mc.color}"></span>
        <span class="mtext">${mc.label}${L.line ? ' · ' + esc(L.line) : ''} · ${fmtDur(L.sec)}${L.auto ? ' <b class="auto">自动</b>' : L.manual ? ' <b class="man">手填</b>' : ''}</span>
      </div>`;
    }
    out += `<div class="mstop">
      <span class="mtime">${hm(acc)}</span>
      <span class="mdot"></span>
      <span class="mname">${k + 1}. ${esc(p.title)}</span>
    </div>`;
  });
  out += `<div class="mend">预计 ${hm(acc)} 到达最后一个点${pts.length > 1 ? '，共 ' + fmtDur(daySeconds(pts)) + ' 在路上' : ''}</div>`;
  out += '</div>';
  return out;
}

function mapSVG(pts) {
  if (!pts.length) {
    return `<svg class="map" viewBox="0 0 640 260" preserveAspectRatio="xMidYMid meet">
      <text x="320" y="130" text-anchor="middle" font-size="13" fill="#A6ACB5">把地点排进 Day ${S.mapDay || 1}，这里会自动连线</text>
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

  let out = `<svg class="map" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
  for (let gx = P; gx <= W - P; gx += (W - 2 * P) / 6)
    out += `<line x1="${gx}" y1="${P - 12}" x2="${gx}" y2="${H - P + 12}" stroke="#EEF1F5"/>`;
  for (let gy = P - 12; gy <= H - P + 12; gy += (H - 2 * P) / 5)
    out += `<line x1="${P - 12}" y1="${gy}" x2="${W - P + 12}" y2="${gy}" stroke="#EEF1F5"/>`;

  for (let k = 1; k < coords.length; k++) {
    const a = coords[k - 1], b = coords[k];
    const L = legInfo(pts, k);
    const mc = MODE_OF[L.mode] || MODE_OF.taxi;
    out += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"
      stroke="${mc.color}" stroke-width="${L.mode === 'metro' ? 4.4 : 3}" stroke-linecap="round"
      stroke-dasharray="${mc.dash}" opacity=".92"/>`;
  }

  for (let k = 1; k < coords.length; k++) {
    const a = coords[k - 1], b = coords[k];
    const L = legInfo(pts, k);
    const mc = MODE_OF[L.mode] || MODE_OF.taxi;
    const txt = mc.label + (L.line ? ' ' + L.line : '') + ' · ' + fmtDur(L.sec);
    let w = 14;
    for (const ch of txt) w += ch.charCodeAt(0) > 127 ? 9.6 : 5.4;
    w = Math.min(w, 190);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    out += `<rect x="${(mx - w / 2).toFixed(1)}" y="${(my - 10).toFixed(1)}" width="${w.toFixed(1)}" height="19" rx="9.5" fill="#fff" opacity=".95" stroke="${mc.color}" stroke-opacity=".45"/>`;
    out += `<text x="${mx.toFixed(1)}" y="${(my + 3.6).toFixed(1)}" text-anchor="middle" font-size="10" fill="${mc.color}">${esc(txt)}</text>`;
  }

  coords.forEach((c, k) => {
    const isFood = c.p.kind === 'food';
    const fill = isFood ? '#F59E0B' : '#2563EB';
    out += `<circle cx="${c.x}" cy="${c.y}" r="13" fill="#fff" stroke="${fill}" stroke-width="2.4"/>`;
    out += `<text x="${c.x}" y="${c.y + 4}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${fill}">${k + 1}</text>`;
    const label = c.p.title.length > 6 ? c.p.title.slice(0, 6) + '…' : c.p.title;
    out += `<text x="${c.x}" y="${c.y + 27}" text-anchor="middle" font-size="10.5" fill="#5B616B">${esc(label)}</text>`;
  });

  const lx = 16, ly = H - 26;
  out += `<g transform="translate(${lx},${ly})">
    <circle cx="6" cy="0" r="5" fill="#fff" stroke="#2563EB" stroke-width="2"/><text x="16" y="4" font-size="9.5" fill="#8B919B">景点</text>
    <circle cx="66" cy="0" r="5" fill="#fff" stroke="#F59E0B" stroke-width="2"/><text x="76" y="4" font-size="9.5" fill="#8B919B">餐厅</text>
    <line x1="112" y1="0" x2="134" y2="0" stroke="#7C3AED" stroke-width="3.4"/><text x="140" y="4" font-size="9.5" fill="#8B919B">地铁</text>
    <line x1="176" y1="0" x2="198" y2="0" stroke="#10B981" stroke-width="3" stroke-dasharray="6 6"/><text x="204" y="4" font-size="9.5" fill="#8B919B">步行</text>
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

let legState = null;

function openLegSheet(id) {
  const i = S.items.find(x => x.id === id);
  if (!i) return;
  const cur = legMode(i);
  legState = { id, mode: cur };
  const city = (S.room.city || '').trim();
  const known = !city || METRO_CITIES.some(c => city.indexOf(c) >= 0);
  let estTxt = '';
  if (i.d.day != null) {
    const dp = route(i.d.day);
    const idx = dp.findIndex(x => x.id === i.id);
    if (idx > 0) estTxt = '（约 ' + Math.round(legInfo(dp, idx).est / 60) + ' 分钟）';
  }
  openSheet(`
    <div class="shead">怎么去「${esc(i.title)}」</div>
    <div class="opts">
      ${MODES.map(m => `<button class="opt ${cur === m.k ? 'on' : ''}" data-act="pickleg" data-v="${m.k}">${m.label}</button>`).join('')}
    </div>
    <div class="srow"><label>线路</label><input id="legLineIn" placeholder="如：3号线 4站 / 换乘2号线" value="${esc(legLine(i))}"></div>
    <div class="srow"><label>时长</label><input id="legMinsIn" type="number" min="0" placeholder="留空＝自动估算${estTxt}" value="${legMins(i) != null ? legMins(i) : ''}"></div>
    ${known ? '' : `<div style="font-size:11px;color:#B45309;margin:-2px 0 8px">「${esc(city)}」不在内置地铁城市里，仍可手动记线路。</div>`}
    <div style="font-size:10.5px;color:#A6ACB5;margin-bottom:8px">线路只是备注，用来在「地铁图」里显示；时间按距离估算。</div>
    <button class="primary" data-act="saveleg">保存</button>
    <button class="ghost" data-act="autoleg" data-id="${id}">🛣 自动规划这一段</button>
    <button class="ghost" data-act="close">取消</button>`);
}

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
    ${isPlan ? `<div class="srow"><label>人均</label><input id="nPrice" type="number" min="0" placeholder="0"></div>
    <div class="srow"><label>坐标</label><input id="nCoord" placeholder="可选：31.2304, 121.4737"></div>` : ''}
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
  const item = (id && S) ? S.items.find(x => x.id === id) : null;

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

    case 'mapview':
      S.mapView = t.dataset.v; render();
      break;

    case 'mapkey':
      openMapKeySheet();
      break;

    case 'planday':
      planDay(parseInt(t.dataset.day, 10));
      break;

    case 'autoleg':
      autoLegFromSheet(id);
      break;

    case 'saveMapKey': {
      const k = (($('#mkKey').value) || '').trim();
      const cd = (($('#mkCode').value) || '').trim();
      if (!k) { toast('Key 不能为空'); break; }
      localStorage.setItem(MAP_KEY, JSON.stringify({ key: k, code: cd }));
      AMAP.failed = false;
      closeSheet();
      toast('正在加载高德地图…');
      S.mapView = 'map';
      render();
      break;
    }

    case 'clearMapKey':
      localStorage.removeItem(MAP_KEY);
      AMAP.failed = false;
      closeSheet(); render();
      toast('已关闭真实地图');
      break;

    case 'amap': {
      const itA = S.items.find(x => x.id === id);
      if (!itA || !itA.pl || !itA.pl.lat) break;
      const url = 'https://uri.amap.com/marker?position=' + itA.pl.lng + ',' + itA.pl.lat +
        '&name=' + encodeURIComponent(itA.title) + '&callnative=1&src=tripsync';
      try { window.open(url, '_blank'); } catch (e) { copyText(url); }
      break;
    }

    case 'copyday': {
      const dpts = route(parseInt(t.dataset.day, 10));
      if (!dpts.length) { toast('这一天还没有地点'); break; }
      const txt = 'Day ' + t.dataset.day + '\n' + dpts.map((p, k) =>
        (k + 1) + '. ' + p.title + '  ' + p.pl.lat.toFixed(5) + ',' + p.pl.lng.toFixed(5)).join('\n');
      copyText(txt);
      break;
    }

    case 'leg':
      openLegSheet(id);
      break;

    case 'pickleg': {
      if (!legState) break;
      legState.mode = t.dataset.v;
      $$('.opt', sheet).forEach(b => b.classList.toggle('on', b.dataset.v === legState.mode));
      break;
    }

    case 'saveleg': {
      if (!legState) break;
      const it4 = S.items.find(x => x.id === legState.id);
      if (!it4) break;
      const ln = (($('#legLineIn') || {}).value || '').trim();
      const rawM = (($('#legMinsIn') || {}).value || '').trim();
      const mins = rawM === '' ? null : Math.max(0, Number(rawM));
      const def = S.mode || 'taxi';
      if (legState.mode === def && !ln && mins == null) delete it4.d.leg;
      else it4.d.leg = { mode: legState.mode, line: ln, mins, auto: !!legState.auto };
      it4._ts = Date.now();
      closeSheet(); render();
      break;
    }

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
      const before = daySeconds(pts);
      const rest = pts.slice(1);
      const out = [pts[0]];
      while (rest.length) {
        const last = out[out.length - 1];
        let bi = 0, bd = Infinity;
        rest.forEach((p, k) => { const d = haversine(last.pl, p.pl); if (d < bd) { bd = d; bi = k; } });
        out.push(rest.splice(bi, 1)[0]);
      }
      out.forEach((p, k) => { p.d.order = k; p._ts = Date.now(); });
      const after = daySeconds(out);
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
        let lat = null, lng = null;
        const rawC = ($('#nCoord') ? $('#nCoord').value : '').trim();
        if (rawC) {
          const q = rawC.split(/[,，\s]+/).map(Number);
          if (q.length >= 2 && isFinite(q[0]) && isFinite(q[1])) { lat = q[0]; lng = q[1]; }
        }
        if (lat == null) {
          const ex = liveItems().filter(i => i.pl && i.pl.lat);
          if (ex.length) {
            const clat = ex.reduce((a, i) => a + i.pl.lat, 0) / ex.length;
            const clng = ex.reduce((a, i) => a + i.pl.lng, 0) / ex.length;
            lat = clat + (Math.random() - 0.5) * 0.05;
            lng = clng + (Math.random() - 0.5) * 0.05;
          } else {
            lat = 18.25; lng = 109.52;
          }
        }
        ni.pl = { lat, lng, price, dur: 90 };
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
      if (!S) break;
      if (confirm('重置当前行程为演示数据？当前内容会丢失。')) {
        const f = seed();
        S.room = f.room; S.members = f.members; S.items = f.items; S.expenses = f.expenses;
        S._ts = Date.now(); save(); render(); toast('已重置');
      }
      break;

    case 'settings':
      if (!S) break;
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
      const na = ($('#tNameA').value || '').trim() || S.members.A.name;
      const nb = ($('#tNameB').value || '').trim() || S.members.B.name;
      const ct = ($('#tCity').value || '').trim();
      S.room = Object.assign({}, S.room, { name: nm, days: d, start: $('#tStart').value || S.room.start, city: ct });
      S.members = { A: Object.assign({}, S.members.A, { name: na }), B: Object.assign({}, S.members.B, { name: nb }) };
      S._ts = Date.now();
      S.roomTs = S._ts;
      closeSheet(); render(); toast('已保存');
      break;
    }

    case 'home':
      goHome();
      break;

    case 'open': {
      const t = DB.trips.find(x => x.id === id);
      if (t) openTrip(t);
      break;
    }

    case 'newTrip':
      openNewTripSheet();
      break;

    case 'doNewTrip': {
      const nm = ($('#nTripName').value || '').trim() || '新行程';
      const d = Math.min(30, Math.max(1, parseInt($('#nTripDays').value, 10) || 3));
      const st = $('#nTripStart').value || '';
      const na = ($('#nTripA').value || '').trim() || '我';
      const nb = ($('#nTripB').value || '').trim() || '朋友';
      const tpl = $('#nTripTpl').checked;
      const t = blankTrip(nm);
      t.room.days = d;
      if (st) t.room.start = st;
      t.members = { A: { name: na }, B: { name: nb } };
      t.syncRoom = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
      if (tpl) t.items = starterPack();
      t._ts = Date.now();
      t.roomTs = t._ts;
      DB.trips.push(t);
      closeSheet();
      openTrip(t);
      toast('行程已创建');
      break;
    }

    case 'delTrip': {
      const t = DB.trips.find(x => x.id === id);
      if (!t) break;
      if (!confirm('删除行程「' + t.room.name + '」？本机数据会消失（对方设备不受影响）。')) break;
      DB.trips = DB.trips.filter(x => x.id !== id);
      save();
      renderHome();
      toast('已删除');
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

    case 'synctest':
      testConn();
      break;

    case 'syncSave': {
      if (!S) { toast('先进入一个行程再配同步'); break; }
      const u = ($('#sUrl').value || '').trim().replace(/\/+$/, '');
      const k = ($('#sKey').value || '').trim();
      let r = ($('#sRoom').value || '').trim();
      if (!u || !k) { toast('URL 和 Key 都要填'); break; }
      if (!/^https?:\/\//.test(u)) { toast('URL 要以 https:// 开头'); break; }
      if (!r && S && S.syncRoom) r = S.syncRoom;
      if (!r) r = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
      if (S) { S.syncRoom = r; S._ts = Date.now(); }
      CFG = { url: u, key: k, room: r };
      cfgSave();
      closeSheet();
      setStatus('sync', '连接中…');
      syncOnce().then(() => { if (syncState.status !== 'error') toast('✅ 同步已开启'); else toast('连接失败，检查 URL / Key / 建表语句'); });
      startPolling();
      break;
    }

    case 'syncShare': {
      if (!S) { toast('先进一个行程再分享'); break; }
      if (!CFG.url || !CFG.key) { toast('先填 URL 和 Key'); break; }
      if (!S.syncRoom) { S.syncRoom = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12); S._ts = Date.now(); }
      CFG.room = S.syncRoom; cfgSave();
      const base = location.href.split('?')[0].split('#')[0];
      const link = base + '?r=' + encodeURIComponent(S.syncRoom) + '&u=' + encodeURIComponent(CFG.url) + '&k=' + encodeURIComponent(CFG.key);
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
      if (!S) { toast('先进一个行程'); break; }
      copyText(JSON.stringify(S));
      break;

    case 'syncImport': {
      if (!S) { toast('先进一个行程'); break; }
      const raw = prompt('粘贴之前导出的 JSON：');
      if (!raw) break;
      try {
        const d = JSON.parse(raw);
        const doc = d && Array.isArray(d.trips) ? d.trips[0] : d;
        if (!doc || !Array.isArray(doc.items)) throw new Error('bad');
        S.room = doc.room; S.members = doc.members; S.items = doc.items;
        S.expenses = doc.expenses || []; S._ts = Date.now(); dirty = true;
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
  const st = e.target.closest('[data-act="stime"]');
  if (st) {
    S.room.startTime = st.value || '09:00';
    S._ts = Date.now();
    S.roomTs = S._ts;
    save(); render();
    return;
  }
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
  if (!S) { renderHome(); return; }
  renderTop(); renderTabs(); renderPanel(); renderMap(); save();
}
if (!initSyncFromURL()) {
  document.body.classList.add('home');
  const back = $('#backBtn'); if (back) back.hidden = true;
  renderHome();
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && syncOn()) syncOnce();
});
