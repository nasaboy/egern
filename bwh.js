export default async function (ctx) {
  const veid   = ctx.env.VEID;
  const apiKey = ctx.env.API_KEY;

  // ── 工具函数 ──────────────────────────────────────────────
  function toGB(bytes) {
    if (bytes >= 1099511627776) return (bytes / 1099511627776).toFixed(2) + ' TB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  }

  function toGBNum(bytes) {
    return (bytes / 1073741824).toFixed(1);
  }

  // 进度颜色：绿 → 橙 → 红
  function barColor(ratio) {
    if (ratio >= 0.9) return '#FF453A';
    if (ratio >= 0.7) return '#FF9F0A';
    return '#30D158';
  }

  // 错误兜底
  function errorWidget(msg) {
    return {
      type: 'widget',
      backgroundGradient: {
        type: 'linear',
        colors: ['#1a1a2e', '#16213e'],
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 1, y: 1 },
      },
      padding: 16,
      gap: 8,
      children: [
        {
          type: 'image',
          src: 'sf-symbol:exclamationmark.triangle.fill',
          color: '#FF9F0A',
          width: 22,
          height: 22,
        },
        {
          type: 'text',
          text: msg,
          font: { size: 'footnote' },
          textColor: '#FF453A',
          maxLines: 3,
        },
      ],
    };
  }

  if (!veid || !apiKey) return errorWidget('请在 env 中设置 VEID 和 API_KEY');

  // ── 请求 API ──────────────────────────────────────────────
  let info;
  try {
    const resp = await ctx.http.get(
      `https://api.64clouds.com/v1/getServiceInfo?veid=${veid}&api_key=${apiKey}`,
      { timeout: 10000 }
    );
    info = await resp.json();
  } catch (e) {
    return errorWidget('请求失败: ' + e.message);
  }

  if (info.error !== 0) return errorWidget('API 错误 #' + info.error);

  // ── 数据解析 ──────────────────────────────────────────────
  const totalBytes = info.plan_monthly_data;          // 套餐流量（字节）
  const usedBytes  = info.data_counter;               // 已用（字节）
  const resetTs    = info.data_next_reset;            // 重置时间戳（秒）
  const resetISO   = new Date(resetTs * 1000).toISOString();

  const ratio      = Math.min(usedBytes / totalBytes, 1);
  const pct        = (ratio * 100).toFixed(1);
  const color      = barColor(ratio);

  const usedStr    = toGB(usedBytes);
  const totalStr   = toGB(totalBytes);
  const remainStr  = toGB(Math.max(totalBytes - usedBytes, 0));

  // 机房简称：取括号前内容最后一段，去掉多余空格
  const dc         = info.node_datacenter || info.node_location || '';
  const dcShort    = (dc.split('(')[0] || dc).trim().replace(/^US:\s*/i, '');

  const ip         = (info.ip_addresses || [])[0] || '—';
  const suspended  = info.suspended ? '⚠️ 已暂停' : null;

  // ── 锁屏圆形 ─────────────────────────────────────────────
  if (ctx.widgetFamily === 'accessoryCircular') {
    return {
      type: 'widget',
      padding: 2,
      gap: 1,
      children: [
        {
          type: 'text',
          text: pct + '%',
          font: { size: 'title2', weight: 'bold' },
          textColor: color,
          textAlign: 'center',
          maxLines: 1,
        },
        {
          type: 'text',
          text: 'BWH',
          font: { size: 'caption2' },
          textColor: '#FFFFFFAA',
          textAlign: 'center',
          maxLines: 1,
        },
      ],
    };
  }

  // ── 锁屏矩形 ─────────────────────────────────────────────
  if (ctx.widgetFamily === 'accessoryRectangular') {
    return {
      type: 'widget',
      padding: [2, 4, 2, 4],
      gap: 3,
      children: [
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 5,
          children: [
            {
              type: 'image',
              src: 'sf-symbol:server.rack',
              width: 12,
              height: 12,
            },
            {
              type: 'text',
              text: 'BWH 流量监控',
              font: { size: 'headline', weight: 'bold' },
              maxLines: 1,
            },
          ],
        },
        {
          type: 'text',
          text: `已用 ${usedStr} / ${totalStr}  (${pct}%)`,
          font: { size: 'body' },
          maxLines: 1,
          minScale: 0.8,
        },
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 4,
          children: [
            {
              type: 'text',
              text: '重置：',
              font: { size: 'footnote' },
            },
            {
              type: 'date',
              date: resetISO,
              format: 'relative',
              font: { size: 'footnote', weight: 'medium' },
            },
          ],
        },
      ],
    };
  }

  // ── 主屏 Small ────────────────────────────────────────────
  if (ctx.widgetFamily === 'systemSmall') {
    const BAR = 10;
    const f   = Math.round(ratio * BAR);
    const bar = '█'.repeat(f) + '░'.repeat(BAR - f);

    return {
      type: 'widget',
      backgroundGradient: {
        type: 'linear',
        colors: ['#0d1b2a', '#1b2a3b', '#162032'],
        stops: [0, 0.5, 1],
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 1, y: 1 },
      },
      padding: 14,
      gap: 6,
      children: [
        // 标题
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 5,
          children: [
            {
              type: 'image',
              src: 'sf-symbol:server.rack',
              color: '#64D2FF',
              width: 13,
              height: 13,
            },
            {
              type: 'text',
              text: 'BandwagonHost',
              font: { size: 'caption1', weight: 'semibold' },
              textColor: '#64D2FF',
              maxLines: 1,
              minScale: 0.7,
            },
          ],
        },
        // 大百分比
        {
          type: 'text',
          text: pct + '%',
          font: { size: 'title', weight: 'bold' },
          textColor: color,
          maxLines: 1,
        },
        // 字符进度条
        {
          type: 'text',
          text: bar,
          font: { size: 10, weight: 'regular', family: 'Menlo' },
          textColor: color,
          maxLines: 1,
        },
        // 已用/总量
        {
          type: 'text',
          text: usedStr + ' / ' + totalStr,
          font: { size: 'caption2', weight: 'medium' },
          textColor: '#FFFFFFCC',
          maxLines: 1,
          minScale: 0.8,
        },
        { type: 'spacer' },
        // 重置倒计时
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 4,
          children: [
            {
              type: 'image',
              src: 'sf-symbol:arrow.clockwise',
              color: '#FFFFFF55',
              width: 10,
              height: 10,
            },
            {
              type: 'date',
              date: resetISO,
              format: 'relative',
              font: { size: 'caption2' },
              textColor: '#FFFFFF88',
              maxLines: 1,
            },
          ],
        },
      ],
    };
  }

  // ── 主屏 Medium（默认）───────────────────────────────────
  const BAR_LEN = 22;
  const filled  = Math.round(ratio * BAR_LEN);
  const barStr  = '█'.repeat(filled) + '░'.repeat(BAR_LEN - filled);

  const medChildren = [
    // 标题行
    {
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      gap: 8,
      children: [
        {
          type: 'image',
          src: 'sf-symbol:server.rack',
          color: '#64D2FF',
          width: 18,
          height: 18,
        },
        {
          type: 'text',
          text: 'BandwagonHost',
          font: { size: 'headline', weight: 'bold' },
          textColor: '#FFFFFF',
          flex: 1,
          maxLines: 1,
        },
        // 暂停警告（有则显示）
        ...(suspended ? [{
          type: 'text',
          text: suspended,
          font: { size: 'caption1', weight: 'semibold' },
          textColor: '#FF453A',
          maxLines: 1,
        }] : [{
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 4,
          children: [
            {
              type: 'image',
              src: 'sf-symbol:circle.fill',
              color: '#30D158',
              width: 8,
              height: 8,
            },
            {
              type: 'text',
              text: '运行中',
              font: { size: 'caption1' },
              textColor: '#30D158',
              maxLines: 1,
            },
          ],
        }]),
      ],
    },

    // 机房 & IP
    {
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      gap: 6,
      children: [
        {
          type: 'image',
          src: 'sf-symbol:location.fill',
          color: '#FFFFFF44',
          width: 11,
          height: 11,
        },
        {
          type: 'text',
          text: dcShort,
          font: { size: 'caption1' },
          textColor: '#FFFFFF66',
          flex: 1,
          maxLines: 1,
          minScale: 0.8,
        },
        {
          type: 'text',
          text: ip,
          font: { size: 'caption1', family: 'Menlo' },
          textColor: '#FFFFFF55',
          maxLines: 1,
        },
      ],
    },

    // 进度条
    {
      type: 'text',
      text: barStr,
      font: { size: 11, weight: 'regular', family: 'Menlo' },
      textColor: color,
      maxLines: 1,
    },

    // 已用 / 总量 / 百分比
    {
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      gap: 4,
      children: [
        {
          type: 'text',
          text: '已用',
          font: { size: 'subheadline' },
          textColor: '#FFFFFF66',
        },
        {
          type: 'text',
          text: usedStr,
          font: { size: 'subheadline', weight: 'bold' },
          textColor: color,
        },
        {
          type: 'text',
          text: '/ ' + totalStr,
          font: { size: 'subheadline' },
          textColor: '#FFFFFF44',
        },
        { type: 'spacer' },
        {
          type: 'text',
          text: pct + '%',
          font: { size: 'title3', weight: 'bold' },
          textColor: color,
        },
      ],
    },

    // 剩余流量
    {
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      gap: 4,
      children: [
        {
          type: 'image',
          src: 'sf-symbol:tray.fill',
          color: '#FFFFFF44',
          width: 12,
          height: 12,
        },
        {
          type: 'text',
          text: '剩余 ' + remainStr,
          font: { size: 'footnote' },
          textColor: '#FFFFFF88',
        },
        { type: 'spacer' },
      ],
    },

    { type: 'spacer' },

    // 重置日期行
    {
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      gap: 6,
      children: [
        {
          type: 'image',
          src: 'sf-symbol:arrow.clockwise.circle',
          color: '#FFFFFF44',
          width: 13,
          height: 13,
        },
        {
          type: 'text',
          text: '重置日期：',
          font: { size: 'footnote' },
          textColor: '#FFFFFF55',
        },
        {
          type: 'date',
          date: resetISO,
          format: 'date',
          font: { size: 'footnote', weight: 'medium' },
          textColor: '#FFFFFFCC',
        },
        { type: 'spacer' },
        {
          type: 'date',
          date: resetISO,
          format: 'relative',
          font: { size: 'footnote' },
          textColor: '#FFFFFF55',
        },
      ],
    },
  ];

  return {
    type: 'widget',
    backgroundGradient: {
      type: 'linear',
      colors: ['#0d1b2a', '#1b2a3b', '#162032'],
      stops: [0, 0.5, 1],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 },
    },
    padding: 16,
    gap: 8,
    children: medChildren,
  };
}
