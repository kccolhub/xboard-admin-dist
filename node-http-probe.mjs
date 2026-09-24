// Readable React components embedded into the admin distribution bundle.
export function selectHttpProbeResult(node, local) {
  const saved = node.http_test;
  return local?.result && (!saved || local.result.checked_at > saved.checked_at) ? local.result : saved;
}

export function createHttpProbeStore() {
  const states = new Map(), listeners = new Set();
  const empty = Object.freeze({pending: false, result: null});
  const emit = () => listeners.forEach(listener => listener());
  return {
    get: id => states.get(id) || empty,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async run(id, request) {
      if (states.get(id)?.pending) return null;
      states.set(id, {...(states.get(id) || empty), pending: true}); emit();
      try {
        const response = await request({id});
        const result = response?.data;
        if (!result || !['success', 'failed', 'unavailable'].includes(result.status) || !result.checked_at) throw new Error('Invalid HTTP probe result');
        states.set(id, {pending: false, result}); emit();
        return result;
      } finally {
        const state = states.get(id);
        if (state?.pending) { states.set(id, {...state, pending: false}); emit(); }
      }
    },
  };
}

export function createNodeHttpProbeComponents(React, jsx, {Item, post, base, toast, useTranslation}) {
  const store = createHttpProbeStore();
  const useState = id => React.useSyncExternalStore(store.subscribe, () => store.get(id));
  function useText() {
    const {i18n} = useTranslation();
    const chinese = (i18n.resolvedLanguage || i18n.language || 'zh').startsWith('zh');
    return (zh, en) => chinese ? zh : en;
  }
  function Action({node, refetch}) {
    const state = useState(node.id), text = useText();
    return jsx.jsx(Item, {
      className: 'cursor-pointer', disabled: state.pending, 'data-testid': 'node-http-test',
      title: text('面板经此节点请求 HTTPS；使用现有有效用户，产生少量流量。', 'HTTPS through this node from the panel; uses an eligible user and a small amount of traffic.'),
      onSelect: async event => {
        event.preventDefault();
        try {
          const result = await store.run(node.id, data => post(base + '/server/manage/testHttp', data, {timeout: 25000}));
          if (!result) return;
          const title = text('HTTP 测试', 'HTTP test');
          if (result.status === 'success') toast.success(`${title}: ${result.http_status} · ${result.latency_ms} ms`);
          else toast.error(`${title}: ${result.message}`);
          Promise.resolve(refetch()).catch(() => {});
        } catch {
          toast.error(text('测试请求失败或已有测试进行中，请稍后刷新重试。', 'Test request failed or another test is running. Refresh and retry.'));
        }
      },
      children: jsx.jsxs('span', {style: {display: 'flex', alignItems: 'center', gap: 8}, children: [
        jsx.jsx('svg', {width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true,
          children: jsx.jsx('path', {d: 'M3 12h4l3-8 4 16 3-8h4'})}),
        state.pending ? text('正在测试…', 'Testing…') : text('HTTP 真实测试', 'HTTP proxy test'),
      ]}),
    });
  }
  function Result({node}) {
    const state = useState(node.id), text = useText();
    const result = selectHttpProbeResult(node, state);
    const stale = result && (result.stale || Date.now() / 1000 - result.checked_at > 300);
    const label = state.pending ? text('测试中…', 'Testing…')
      : !result ? text('未测试', 'Not tested')
      : result.status === 'success' ? text('成功', 'Success')
      : result.status === 'failed' ? text('失败', 'Failed') : text('无法测试', 'Unavailable');
    const color = !result || state.pending || stale ? 'inherit' : result.status === 'success' ? '#059669' : '#dc2626';
    return jsx.jsxs('div', {'data-testid': 'node-http-result', style: {borderTop: '1px solid currentColor', paddingTop: 10, maxWidth: 280, fontSize: 11, lineHeight: 1.6, overflowWrap: 'anywhere'}, children: [
      jsx.jsxs('div', {style: {display: 'flex', justifyContent: 'space-between', gap: 12, fontWeight: 600}, children: [
        'HTTP', jsx.jsx('span', {style: {color}, children: label + (stale ? text('（历史结果）', ' (historical)') : '')}),
      ]}),
      result?.http_status != null && jsx.jsx('div', {children: `HTTP ${result.http_status}${result.latency_ms != null ? ` · ${result.latency_ms} ms` : ''}`}),
      result && result.status !== 'success' && jsx.jsx('div', {children: result.message}),
      result && jsx.jsx('div', {style: {opacity: .75}, children: new Date(result.checked_at * 1000).toLocaleString()}),
      result && jsx.jsx('div', {style: {opacity: .75}, children: result.target}),
      jsx.jsx('div', {style: {opacity: .75}, children: text('面板服务器 → 此节点 → HTTPS', 'Panel server → this node → HTTPS')}),
      !result && jsx.jsx('div', {children: text('在「操作」中点击「HTTP 真实测试」', 'Choose “HTTP proxy test” in Actions')}),
    ]});
  }
  return {Action, Result};
}
