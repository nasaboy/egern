export default async function (ctx) {
  const veid = ctx.env.veid;
  const api_key = ctx.env.api_key;

  const apiUrl = `https://api.64clouds.com/v1/getServiceInfo?veid=${veid}&api_key=${api_key}`;

  let data;
  try {
    const resp = await ctx.http.get(apiUrl);
    data = await resp.json();
  } catch (e) {
    return {
      type: 'widget',
      padding: 16,
      backgroundColor: '#1C1C1E',
      children: [
        {
          type: 'text',
          text: '⚠️ 请求失败',
          font: { size: 'headline', weight: 'bold' },
          textColor: '#FF3B30',
        },
      ],
    };
  }

  const used = data.data_counter;
  const total = data.plan_monthly_data;
  const remaining = Math.max(total - used, 0);
  const usedPercent = Math.min((used / total) * 100, 100);

  function formatBytes(bytes) {
    if (bytes >= 1e12) return (bytes / 1e12).toFixed(2) + ' TB';
    if (bytes >= 1e9)  return (bytes / 1e9).toFixed(2) + ' GB';
    if (bytes >= 1e6)  return (bytes / 1e6).toFixed(2) + ' MB';
    return bytes + ' B';
  }

  const resetDate = new Date(data.data_next_reset * 1000);
  const resetISO = resetDate.toISOString();

  const barColor = usedPercent >= 90 ? '#FF3B30' : usedPercent >= 70 ? '#FF9500' : '#30D158';

  const usedFlex = Math.round(usedPercent);
  const remainFlex = 100 - usedFlex;

  if (ctx.widgetFamily === 'accessoryRectangular') {
    return {
      type: 'widget',
      padding: [2, 4, 2, 4],
      gap: 2,
      children: [
        {
          type: 'text',
          text: 'BWH 流量',
          font: { size: 'headline', weight: 'bold' },
        },
        {
          type: 'text',
          text: `已用 ${formatBytes(used)} / ${formatBytes(total)}`,
          font: { size: 'caption1' },
        },
        {
          type: 'text',
          text: `重置: ${resetDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}`,
          font: { size: 'caption2' },
        },
      ],
    };
  }

  if (ctx.widgetFamily === 'systemSmall') {
    return {
      type: 'widget',
      padding: 14,
      gap: 6,
      backgroundGradient: {
        type: 'linear',
        colors: ['#1C1C2E', '#0F0F1A'],
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 1, y: 1 },
      },
      children: [
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 6,
          children: [
            {
              type: 'image',
              src: 'sf-symbol:network',
              color: '#0A84FF',
              width: 14,
              height: 14,
            },
            {
              type: 'text',
              text: 'BandwagonHost',
              font: { size: 'caption2', weight: 'semibold' },
              textColor: '#0A84FF',
              maxLines: 1,
              minScale: 0.7,
            },
          ],
        },
        { type: 'spacer' },
        {
          type: 'text',
          text: `${usedPercent.toFixed(1)}%`,
          font: { size: 'title', weight: 'bold' },
          textColor: barColor,
        },
        {
          type: 'text',
          text: `${formatBytes(used)} 已用`,
          font: { size: 'caption1' },
          textColor: '#FFFFFFAA',
        },
        {
          type: 'text',
          text: `剩余 ${formatBytes(remaining)}`,
          font: { size: 'caption2' },
          textColor: '#FFFFFF66',
        },
        {
          type: 'stack',
          direction: 'row',
          height: 5,
          borderRadius: 3,
          backgroundColor: '#FFFFFF22',
          children: [
            {
              type: 'stack',
              flex: usedFlex,
              backgroundColor: barColor,
              borderRadius: 3,
              children: [],
            },
            {
              type: 'spacer',
              length: remainFlex > 0 ? undefined : 0,
            },
          ],
        },
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
              textColor: '#FFFFFF55',
              maxLines: 1,
            },
          ],
        },
      ],
    };
  }

  return {
    type: 'widget',
    padding: 16,
    gap: 10,
    backgroundGradient: {
      type: 'linear',
      colors: ['#1C1C2E', '#0F0F1A'],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 },
    },
    refreshAfter: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 8,
        children: [
          {
            type: 'image',
            src: 'sf-symbol:server.rack',
            color: '#0A84FF',
            width: 18,
            height: 18,
          },
          {
            type: 'text',
            text: 'BandwagonHost 流量',
            font: { size: 'headline', weight: 'bold' },
            textColor: '#FFFFFF',
            flex: 1,
            maxLines: 1,
          },
          {
            type: 'text',
            text: `${usedPercent.toFixed(1)}%`,
            font: { size: 'headline', weight: 'bold' },
            textColor: barColor,
          },
        ],
      },
      {
        type: 'stack',
        direction: 'row',
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FFFFFF22',
        children: [
          {
            type: 'stack',
            flex: usedFlex || 1,
            backgroundColor: barColor,
            borderRadius: 4,
            children: [],
          },
          remainFlex > 0
            ? { type: 'spacer' }
            : { type: 'spacer', length: 0 },
        ],
      },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
          {
            type: 'stack',
            direction: 'column',
            gap: 2,
            flex: 1,
            children: [
              {
                type: 'text',
                text: '已使用',
                font: { size: 'caption1' },
                textColor: '#FFFFFF77',
              },
              {
                type: 'text',
                text: formatBytes(used),
                font: { size: 'title3', weight: 'semibold' },
                textColor: '#FFFFFF',
              },
            ],
          },
          {
            type: 'stack',
            direction: 'column',
            gap: 2,
            flex: 1,
            alignItems: 'end',
            children: [
              {
                type: 'text',
                text: '剩余可用',
                font: { size: 'caption1' },
                textColor: '#FFFFFF77',
                textAlign: 'right',
              },
              {
                type: 'text',
                text: formatBytes(remaining),
                font: { size: 'title3', weight: 'semibold' },
                textColor: barColor,
                textAlign: 'right',
              },
            ],
          },
        ],
      },
      {
        type: 'stack',
        height: 1,
        backgroundColor: '#FFFFFF1A',
        children: [],
      },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            gap: 4,
            flex: 1,
            children: [
              {
                type: 'image',
                src: 'sf-symbol:externaldrive',
                color: '#FFFFFF55',
                width: 12,
                height: 12,
              },
              {
                type: 'text',
                text: `月总量 ${formatBytes(total)}`,
                font: { size: 'caption1' },
                textColor: '#FFFFFF77',
              },
            ],
          },
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            gap: 4,
            children: [
              {
                type: 'image',
                src: 'sf-symbol:arrow.clockwise.circle',
                color: '#FFFFFF55',
                width: 12,
                height: 12,
              },
              {
                type: 'text',
                text: '重置于 ',
                font: { size: 'caption1' },
                textColor: '#FFFFFF77',
              },
              {
                type: 'date',
                date: resetISO,
                format: 'relative',
                font: { size: 'caption1' },
                textColor: '#FFFFFF99',
                maxLines: 1,
              },
            ],
          },
        ],
      },
    ],
  };
}
