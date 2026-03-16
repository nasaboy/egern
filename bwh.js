export default async function (ctx) {
  const veid = ctx.env.VEID;
  const apiKey = ctx.env.API_KEY;

  // ── 错误兜底布局 ──────────────────────────────────────────
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
      children: [
        {
          type: 'image',
          src: 'sf-symbol:exclamationmark.triangle.fill',
          color: '#FF9F0A',
          width: 20,
          height: 20,
        },
        { type: 'spacer', length: 6 },
        {
          type: 'text',
          text: msg,
          font: { size: 'footnote' },
          textColor: '#FF453A',
          maxLines: 2,
        },
      ],
      gap: 4,
    };
  }

  if (!veid || !apiKey) {
    return errorWidget('请在 env 中设置 VEID 和 API_KEY');
  }

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

  if (info.error !== 0) {
    return errorWidget('API 错误: ' + (info.message || info.error));
  }

  // ── 数据解析 ──────────────────────────────────────────────
  const totalBytes = info.plan_monthly_data;          // 套餐总量（字节）
  const usedBytes  = info.data_counter;               // 已用（字节）
  const resetTs    = info.data_next_reset;            // 重置时间戳（秒）

  function toGB(bytes) {
    return (bytes / 1073741824).toFixed(2);
  }

  const usedGB  = toGB(usedBytes);
  const totalGB = toGB(totalBytes);
  const ratio   = Math.min(usedBytes / totalBytes, 1); // 0~1
  const pct     = (ratio * 100).toFixed(1);

  const resetDate = new Date(resetTs * 1000).toISOString();

  // 进度条颜色：绿 → 橙 → 红
  let barColor = '#30D158';
  if (ratio >= 0.9)      barColor = '#FF453A';
  else if (ratio >= 0.7) barColor = '#FF9F0A';

  // ── 锁屏矩形（accessoryRectangular）─────────────────────
  if (ctx.widgetFamily === 'accessoryRectangular') {
    return {
      type: 'widget',
      padding: [2, 4, 2, 4],
      gap: 2,
      children: [
        {
          type: 'text',
          text: `🖥 BWH 流量`,
          font: { size: 'headline', weight: 'bold' },
          maxLines: 1,
        },
        {
          type: 'text',
          text: `已用 ${usedGB} / ${totalGB} GB (${pct}%)`,
          font: { size: 'body' },
          maxLines: 1,
        },
        {
          type: 'text',
          text: `重置于`,
          font: { size: 'footnote' },
          maxLines: 1,
        },
        {
          type: 'date',
          date: resetDate,
          format: 'relative',
          font: { size: 'footnote' },
          maxLines: 1,
        },
      ],
    };
  }

  // ── 锁屏圆形（accessoryCircular）────────────────────────
  if (ctx.widgetFamily === 'accessoryCircular') {
    return {
      type: 'widget',
      padding: 4,
      gap: 2,
      children: [
        {
          type: 'text',
          text: `${pct}%`,
          font: { size: 'title2', weight: 'bold' },
          textAlign: 'center',
          maxLines: 1,
        },
        {
          type: 'text',
          text: 'BWH',
          font: { size: 'caption2' },
          textAlign: 'center',
          maxLines: 1,
        },
      ],
    };
  }

  // ── 主屏 Small ────────────────────────────────────────────
  if (ctx.widgetFamily === 'systemSmall') {
    return {
      type: 'widget',
      backgroundGradient: {
        type: 'linear',
        colors: ['#0f2027', '#203a43', '#2c5364'],
        stops: [0, 0.5, 1],
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 1, y: 1 },
      },
      padding: 14,
      gap: 8,
      children: [
        // 标题行
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 6,
          children: [
            {
              type: 'image',
              src: 'sf-symbol:server.rack',
              color: '#64D2FF',
              width: 14,
              height: 14,
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
        // 百分比大字
        {
          type: 'text',
          text: `${pct}%`,
          font: { size: 'title', weight: 'bold' },
          textColor: barColor,
          maxLines: 1,
        },
        // 用量
        {
          type: 'text',
          text: `${usedGB} / ${totalGB} GB`,
          font: { size: 'footnote', weight: 'medium' },
          textColor: '#FFFFFFCC',
          maxLines: 1,
          minScale: 0.8,
        },
        { type: 'spacer' },
        // 重置标签
        {
          type: 'text',
          text: '距重置',
          font: { size: 'caption2' },
          textColor: '#FFFFFF66',
          maxLines: 1,
        },
        {
          type: 'date',
          date: resetDate,
          format: 'relative',
          font: { size: 'caption1', weight: 'medium' },
          textColor: '#FFFFFFCC',
          maxLines: 1,
        },
      ],
    };
  }

  // ── 主屏 Medium / Large（默认）───────────────────────────
  const BAR_TOTAL = 20; // 字符进度条长度
  const filled = Math.round(ratio * BAR_TOTAL);
  const empty  = BAR_TOTAL - filled;
  const barStr = '█'.repeat(filled) + '░'.repeat(empty);

  return {
    type: 'widget',
    backgroundGradient: {
      type: 'linear',
      colors: ['#0f2027', '#203a43', '#2c5364'],
      stops: [0, 0.5, 1],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 },
    },
    padding: 18,
    gap: 10,
    children: [
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
            width: 20,
            height: 20,
          },
          {
            type: 'text',
            text: 'BandwagonHost 流量',
            font: { size: 'headline', weight: 'bold' },
            textColor: '#FFFFFF',
            flex: 1,
            maxLines: 1,
          },
        ],
      },
      // 进度条
      {
        type: 'text',
        text: barStr,
        font: { size: 11, weight: 'regular', family: 'Menlo' },
        textColor: barColor,
        maxLines: 1,
      },
      // 已用 / 总量
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          {
            type: 'text',
            text: `已用`,
            font: { size: 'subheadline' },
            textColor: '#FFFFFF99',
          },
          {
            type: 'text',
            text: `${usedGB} GB`,
            font: { size: 'subheadline', weight: 'semibold' },
            textColor: barColor,
          },
          {
            type: 'text',
            text: `/ ${totalGB} GB`,
            font: { size: 'subheadline' },
            textColor: '#FFFFFF66',
          },
          { type: 'spacer' },
          {
            type: 'text',
            text: `${pct}%`,
            font: { size: 'title3', weight: 'bold' },
            textColor: barColor,
          },
        ],
      },
      { type: 'spacer' },
      // 重置时间行
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          {
            type: 'image',
            src: 'sf-symbol:arrow.clockwise.circle',
            color: '#FFFFFF66',
            width: 14,
            height: 14,
          },
          {
            type: 'text',
            text: '重置日期：',
            font: { size: 'footnote' },
            textColor: '#FFFFFF66',
          },
          {
            type: 'date',
            date: resetDate,
            format: 'date',
            font: { size: 'footnote', weight: 'medium' },
            textColor: '#FFFFFFCC',
          },
          { type: 'spacer' },
          {
            type: 'date',
            date: resetDate,
            format: 'relative',
            font: { size: 'footnote' },
            textColor: '#FFFFFF66',
          },
        ],
      },
    ],
  };
}
