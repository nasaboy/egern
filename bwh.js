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

  function toGB(bytes) {
    return (bytes / 1024 ** 3).toFixed(2) + ' GB';
  }

  const resetDate = new Date(data.data_next_reset * 1000);
  const resetStr = resetDate.getFullYear() + '-'
    + String(resetDate.getMonth() + 1).padStart(2, '0') + '-'
    + String(resetDate.getDate()).padStart(2, '0');

  const location = data.node_location;
  const ip = data.ip_addresses[0] || 'N/A';

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
          text: `已用 ${toGB(used)} / ${toGB(total)}`,
          font: { size: 'caption1' },
        },
        {
          type: 'text',
          text: `重置: ${resetStr}`,
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
              flex: 1,
              maxLines: 1,
              minScale: 0.7,
            },
          ],
        },
        {
          type: 'text',
          text: ip,
          font: { size: 'caption2' },
          textColor: '#FFFFFF88',
          maxLines: 1,
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
          text: `${toGB(used)} / ${toGB(total)}`,
          font: { size: 'caption1' },
          textColor: '#FFFFFFAA',
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
          type: 'text',
          text: `重置: ${resetStr}`,
          font: { size: 'caption2' },
          textColor: '#FFFFFF55',
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
            color: '#0A84FF',
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
          {
            type: 'text',
            text: `${usedPercent.toFixed(1)}%`,
            font: { size: 'headline', weight: 'bold' },
            textColor: barColor,
          },
        ],
      },
      // 节点位置 & IP
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 12,
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
                src: 'sf-symbol:location.fill',
                color: '#FFFFFF55',
                width: 11,
                height: 11,
              },
              {
                type: 'text',
                text: location,
                font: { size: 'caption1' },
                textColor: '#FFFFFF88',
                maxLines: 1,
                minScale: 0.8,
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
                src: 'sf-symbol:antenna.radiowaves.left.and.right',
                color: '#FFFFFF55',
                width: 11,
                height: 11,
              },
              {
                type: 'text',
                text: ip,
                font: { size: 'caption1', family: 'Menlo' },
                textColor: '#FFFFFF88',
                maxLines: 1,
              },
            ],
          },
        ],
      },
      // 进度条
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
      // 已用 / 剩余
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
                text: toGB(used),
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
                text: toGB(remaining),
                font: { size: 'title3', weight: 'semibold' },
                textColor: barColor,
                textAlign: 'right',
              },
            ],
          },
        ],
      },
      // 分割线
      {
        type: 'stack',
        height: 1,
        backgroundColor: '#FFFFFF1A',
        children: [],
      },
      // 月总量 & 重置日期
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
                text: `月总量 ${toGB(total)}`,
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
                text: `重置于 ${resetStr}`,
                font: { size: 'caption1' },
                textColor: '#FFFFFF99',
              },
            ],
          },
        ],
      },
    ],
  };
}
