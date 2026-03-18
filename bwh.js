export default async function (ctx) {
  const veid = ctx.env.VEID;
  const apiKey = ctx.env.API_KEY;

  // ── 错误视图 ──────────────────────────────────────────────
  function errorWidget(msg) {
    return {
      type: 'widget',
      backgroundColor: '#1C1C1E',
      padding: 16,
      gap: 8,
      children: [
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 6,
          children: [
            { type: 'image', src: 'sf-symbol:exclamationmark.triangle.fill', color: '#FF9F0A', width: 16, height: 16 },
            { type: 'text', text: 'BandwagonHost', font: { size: 'caption1', weight: 'semibold' }, textColor: '#FF9F0A' },
          ],
        },
        { type: 'text', text: msg, font: { size: 'caption2' }, textColor: '#FF453A' },
      ],
    };
  }

  // ── 参数校验 ──────────────────────────────────────────────
  if (!veid || !apiKey) {
    return errorWidget('请在 env 中配置 VEID 和 API_KEY');
  }

  // ── 拉取数据 ──────────────────────────────────────────────
  let info;
  try {
    const url = `https://api.64clouds.com/v1/getLiveServiceInfo?veid=${veid}&api_key=${apiKey}`;
    const resp = await ctx.http.get(url, { timeout: 15000 });
    info = await resp.json();
  } catch (e) {
    return errorWidget('请求失败: ' + e.message);
  }

  if (!info || info.error !== 0) {
    return errorWidget('API 错误: ' + (info ? info.message : '无响应'));
  }

  // ── 数据处理 ──────────────────────────────────────────────
  function fmtBytes(bytes) {
    if (bytes == null) return 'N/A';
    const units = ['B', 'KB', 'MB', 'GB'];
    let val = bytes;
    let i = 0;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return val.toFixed(i === 0 ? 0 : 2) + ' ' + units[i];
  }


  const used     = info.data_counter || 0;
  const total    = info.plan_monthly_data || 0;
  const ratio    = total > 0 ? used / total : 0;
  const pct      = Math.round(ratio * 100);
  const usedStr  = fmtBytes(used);
  const totalStr = fmtBytes(total);

  // plan_ram 单位 bytes，mem_available_kb 单位 KB
  // 已用 = 总量(bytes→KB) - 可用(KB)
  const planRamKb    = info.plan_ram != null ? Math.round(info.plan_ram / 1024) : null;
  const memAvailKb   = info.mem_available_kb;
  const memUsedKb    = (planRamKb != null && memAvailKb != null) ? planRamKb - memAvailKb : null;

  // KB → MB / GB，最大单位 GB
  function fmtMemKb(kb) {
    if (kb == null) return 'N/A';
    if (kb >= 1024 * 1024) return (kb / 1024 / 1024).toFixed(2) + ' GB';
    if (kb >= 1024) return (kb / 1024).toFixed(0) + ' MB';
    return kb + ' KB';
  }

  const memStr = memUsedKb != null
    ? `${fmtMemKb(memUsedKb)} / ${fmtMemKb(planRamKb)}`
    : 'N/A';

  // 重置日期：data_next_reset 是 Unix 时间戳（秒）
  let resetStr = 'N/A';
  if (info.data_next_reset) {
    const d = new Date(info.data_next_reset * 1000);
    resetStr = `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  const dc = info.node_location || 'N/A';

  // 进度条颜色
  const barColor = pct < 70 ? '#30D158' : pct < 90 ? '#FF9F0A' : '#FF453A';
  const pctColor = barColor;

  // ── 锁屏矩形（精简版） ────────────────────────────────────
  if (ctx.widgetFamily === 'accessoryRectangular') {
    return {
      type: 'widget',
      padding: [2, 4, 2, 4],
      gap: 2,
      children: [
        {
          type: 'stack', direction: 'row', alignItems: 'center', gap: 4,
          children: [
            { type: 'image', src: 'sf-symbol:network', color: '#0A84FF', width: 12, height: 12 },
            { type: 'text', text: 'BandwagonHost', font: { size: 'caption2', weight: 'bold' }, textColor: '#FFFFFF', maxLines: 1 },
          ],
        },
        { type: 'text', text: `流量 ${usedStr} / ${totalStr}  ${pct}%`, font: { size: 'caption2' }, textColor: '#EEEEEE', maxLines: 1 },
        { type: 'text', text: `内存 ${memStr}  重置 ${resetStr}`, font: { size: 'caption2' }, textColor: '#AAAAAA', maxLines: 1 },
      ],
    };
  }

  // ── 锁屏内联 ─────────────────────────────────────────────
  if (ctx.widgetFamily === 'accessoryInline') {
    return {
      type: 'widget',
      children: [
        { type: 'text', text: `BWH 流量 ${pct}% · ${usedStr}/${totalStr}`, font: { size: 'caption1' }, maxLines: 1 },
      ],
    };
  }

  // ── 主屏幕小尺寸 ──────────────────────────────────────────
  if (ctx.widgetFamily === 'systemSmall') {
    return {
      type: 'widget',
      backgroundGradient: {
        type: 'linear',
        colors: ['#1C1C2E', '#12122A'],
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 1, y: 1 },
      },
      padding: 14,
      gap: 6,
      children: [
        // 标题行
        {
          type: 'stack', direction: 'row', alignItems: 'center', gap: 5,
          children: [
            { type: 'image', src: 'sf-symbol:server.rack', color: '#0A84FF', width: 14, height: 14 },
            { type: 'text', text: 'BWH', font: { size: 'caption1', weight: 'heavy' }, textColor: '#0A84FF' },
          ],
        },
        { type: 'spacer' },
        // 百分比大字
        {
          type: 'text', text: pct + '%',
          font: { size: 'title2', weight: 'bold' },
          textColor: pctColor,
        },
        // 已用/总量
        {
          type: 'text', text: `${usedStr}\n/ ${totalStr}`,
          font: { size: 'caption2' }, textColor: '#CCCCCC',
        },
        { type: 'spacer' },
        // DC
        {
          type: 'stack', direction: 'row', alignItems: 'center', gap: 4,
          children: [
            { type: 'image', src: 'sf-symbol:location.fill', color: '#636366', width: 10, height: 10 },
            { type: 'text', text: dc, font: { size: 'caption2' }, textColor: '#636366', maxLines: 1, minScale: 0.6 },
          ],
        },
      ],
    };
  }

  // ── 主屏幕中/大尺寸（默认） ───────────────────────────────
  // 进度条（用 stack 模拟）
  const BAR_FILL = Math.max(1, Math.round(ratio * 100)); // 1~100 → flex 比例

  return {
    type: 'widget',
    backgroundGradient: {
      type: 'linear',
      colors: ['#1C1C2E', '#12122A'],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 },
    },
    padding: 16,
    gap: 10,
    children: [

      // ── 标题行 ──
      {
        type: 'stack', direction: 'row', alignItems: 'center', gap: 6,
        children: [
          { type: 'image', src: 'sf-symbol:server.rack', color: '#0A84FF', width: 18, height: 18 },
          { type: 'text', text: 'BandwagonHost', font: { size: 'headline', weight: 'bold' }, textColor: '#FFFFFF', flex: 1 },
          // DC 标签
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            gap: 3,
            backgroundColor: '#2C2C3E',
            borderRadius: 6,
            padding: [2, 6, 2, 6],
            children: [
              { type: 'image', src: 'sf-symbol:location.fill', color: '#636366', width: 10, height: 10 },
              { type: 'text', text: dc, font: { size: 'caption2' }, textColor: '#8E8E93', maxLines: 1, minScale: 0.7 },
            ],
          },
        ],
      },

      // ── 流量区 ──
      {
        type: 'stack', direction: 'column', gap: 6,
        backgroundColor: '#2C2C3E',
        borderRadius: 10,
        padding: [10, 12, 10, 12],
        children: [
          // 行标题 + 百分比
          {
            type: 'stack', direction: 'row', alignItems: 'center',
            children: [
              { type: 'image', src: 'sf-symbol:arrow.up.arrow.down', color: '#0A84FF', width: 13, height: 13 },
              { type: 'spacer', length: 5 },
              { type: 'text', text: '流量使用', font: { size: 'subheadline', weight: 'semibold' }, textColor: '#EEEEEE', flex: 1 },
              { type: 'text', text: pct + '%', font: { size: 'subheadline', weight: 'bold' }, textColor: pctColor },
            ],
          },
          // 进度条
          {
            type: 'stack', direction: 'row', height: 6, borderRadius: 3,
            backgroundColor: '#3A3A4C',
            children: [
              {
                type: 'stack', flex: BAR_FILL, height: 6,
                backgroundColor: barColor, borderRadius: 3,
                children: [],
              },
              { type: 'spacer', length: 0, flex: Math.max(0, 100 - BAR_FILL) },
            ],
          },
          // 已用 / 总量
          {
            type: 'stack', direction: 'row', alignItems: 'center',
            children: [
              { type: 'text', text: usedStr, font: { size: 'footnote', weight: 'medium' }, textColor: '#FFFFFF' },
              { type: 'text', text: ' / ' + totalStr, font: { size: 'footnote' }, textColor: '#8E8E93' },
              { type: 'spacer' },
              // 重置日期
              {
                type: 'stack', direction: 'row', alignItems: 'center', gap: 3,
                children: [
                  { type: 'image', src: 'sf-symbol:arrow.clockwise', color: '#636366', width: 10, height: 10 },
                  { type: 'text', text: '重置 ' + resetStr, font: { size: 'caption2' }, textColor: '#636366' },
                ],
              },
            ],
          },
        ],
      },

      // ── 内存区 ──
      {
        type: 'stack', direction: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#2C2C3E',
        borderRadius: 10,
        padding: [8, 12, 8, 12],
        children: [
          { type: 'image', src: 'sf-symbol:memorychip', color: '#BF5AF2', width: 14, height: 14 },
          { type: 'text', text: '内存', font: { size: 'footnote', weight: 'semibold' }, textColor: '#EEEEEE' },
          { type: 'spacer' },
          { type: 'text', text: memStr, font: { size: 'footnote', weight: 'medium' }, textColor: '#BF5AF2' },
        ],
      },

    ],
  };
}
