// 彩云天气小组件 for Egern
// 环境变量：
//   TOKEN     - 彩云天气 API Token（必填）
//   LONGITUDE - 经度，如 121.4737（必填）
//   LATITUDE  - 纬度，如 31.2304（必填）

export default async function (ctx) {
  const token = ctx.env.TOKEN;
  const lon = ctx.env.LONGITUDE || '121.4737';
  const lat = ctx.env.LATITUDE || '31.2304';

  // 天气现象 -> 中文 & SF Symbol
  function skyconInfo(skycon) {
    const map = {
      CLEAR_DAY:           { text: '晴',     symbol: 'sun.max.fill',         color: '#FFD60A' },
      CLEAR_NIGHT:         { text: '晴',     symbol: 'moon.stars.fill',      color: '#BFC4D6' },
      PARTLY_CLOUDY_DAY:   { text: '多云',   symbol: 'cloud.sun.fill',       color: '#FFB340' },
      PARTLY_CLOUDY_NIGHT: { text: '多云',   symbol: 'cloud.moon.fill',      color: '#8E9DB5' },
      CLOUDY:              { text: '阴',     symbol: 'cloud.fill',           color: '#A0AABB' },
      LIGHT_HAZE:          { text: '轻度霾', symbol: 'sun.haze.fill',        color: '#C8AD7F' },
      MODERATE_HAZE:       { text: '中度霾', symbol: 'sun.haze.fill',        color: '#B89060' },
      HEAVY_HAZE:          { text: '重度霾', symbol: 'sun.haze.fill',        color: '#9E7040' },
      LIGHT_RAIN:          { text: '小雨',   symbol: 'cloud.drizzle.fill',   color: '#64B5F6' },
      MODERATE_RAIN:       { text: '中雨',   symbol: 'cloud.rain.fill',      color: '#42A5F5' },
      HEAVY_RAIN:          { text: '大雨',   symbol: 'cloud.heavyrain.fill', color: '#1E88E5' },
      STORM_RAIN:          { text: '暴雨',   symbol: 'cloud.bolt.rain.fill', color: '#1565C0' },
      FOG:                 { text: '雾',     symbol: 'cloud.fog.fill',       color: '#B0BEC5' },
      LIGHT_SNOW:          { text: '小雪',   symbol: 'cloud.snow.fill',      color: '#B3E5FC' },
      MODERATE_SNOW:       { text: '中雪',   symbol: 'cloud.snow.fill',      color: '#81D4FA' },
      HEAVY_SNOW:          { text: '大雪',   symbol: 'cloud.snow.fill',      color: '#4FC3F7' },
      STORM_SNOW:          { text: '暴雪',   symbol: 'snowflake',            color: '#29B6F6' },
      DUST:                { text: '浮尘',   symbol: 'aqi.medium',           color: '#D4B483' },
      SAND:                { text: '沙尘',   symbol: 'aqi.high',             color: '#C49A4A' },
      WIND:                { text: '大风',   symbol: 'wind',                 color: '#90A4AE' },
    };
    return map[skycon] || { text: skycon, symbol: 'cloud.fill', color: '#A0AABB' };
  }

  // 自适应颜色常量
  const C = {
    bg1:       { dark: '#1C3A5E', light: '#5B9BD5' },
    bg2:       { dark: '#0F2040', light: '#3A7BBF' },
    bg3:       { dark: '#0A1A30', light: '#2060A8' },
    bgError1:  { dark: '#1C2340', light: '#4A6FA5' },
    bgError2:  { dark: '#0F1629', light: '#2E5490' },
    textPri:   { dark: '#FFFFFF',   light: '#FFFFFF' },
    textSec:   { dark: '#FFFFFFCC', light: '#FFFFFFDD' },
    textTer:   { dark: '#FFFFFFAA', light: '#FFFFFFBB' },
    textMuted: { dark: '#FFFFFF99', light: '#FFFFFFAA' },
    textDim:   { dark: '#FFFFFF88', light: '#FFFFFF99' },
    textFaint: { dark: '#FFFFFF66', light: '#FFFFFF88' },
    divider:   { dark: '#FFFFFF20', light: '#FFFFFF30' },
    locIcon:   { dark: '#64B5F6',   light: '#B3D9FF' },
    humIcon:   { dark: '#64B5F6',   light: '#B3D9FF' },
    windIcon:  { dark: '#90CAF9',   light: '#C5E3FF' },
    visIcon:   { dark: '#80DEEA',   light: '#B2EBF2' },
    uvIcon:    { dark: '#FFD60A',   light: '#FFE566' },
    feelIcon:  { dark: '#FF9500',   light: '#FFBB55' },
  };
  function aqiColor(desc) {
    const map = { '优': '#4CAF50', '良': '#8BC34A', '轻度污染': '#FFC107', '中度污染': '#FF9800', '重度污染': '#F44336', '严重污染': '#9C27B0' };
    return map[desc] || '#A0AABB';
  }

  // 风向角度 -> 中文
  function windDir(deg) {
    const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    return dirs[Math.round(deg / 45) % 8];
  }

  // 风速(km/h) -> 风力等级
  function windLevel(speed) {
    if (speed < 1)   return 0;
    if (speed <= 5)  return 1;
    if (speed <= 11) return 2;
    if (speed <= 19) return 3;
    if (speed <= 28) return 4;
    if (speed <= 38) return 5;
    if (speed <= 49) return 6;
    if (speed <= 61) return 7;
    if (speed <= 74) return 8;
    if (speed <= 88) return 9;
    if (speed <= 102) return 10;
    if (speed <= 117) return 11;
    if (speed <= 133) return 12;
    if (speed <= 149) return 13;
    if (speed <= 166) return 14;
    if (speed <= 183) return 15;
    if (speed <= 201) return 16;
    return 17;
  }

  // 错误占位组件
  function errorWidget(msg) {
    return {
      type: 'widget',
      backgroundGradient: {
        type: 'linear',
        colors: [C.bgError1, C.bgError2],
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 1, y: 1 },
      },
      padding: 16,
      gap: 4,
      children: [
        { type: 'image', src: 'sf-symbol:exclamationmark.triangle.fill', color: C.feelIcon, width: 24, height: 24 },
        { type: 'spacer', length: 8 },
        { type: 'text', text: '天气加载失败', font: { size: 'subheadline', weight: 'semibold' }, textColor: C.textPri },
        { type: 'text', text: msg, font: { size: 'caption1' }, textColor: C.textMuted, maxLines: 2 },
      ],
    };
  }

  if (!token) return errorWidget('请配置 TOKEN 环境变量');

  // 天气实况请求
  let data;
  try {
    const weatherUrl = 'https://api.caiyunapp.com/v2.6/' + token + '/' + lon + ',' + lat + '/realtime';
    const resp = await ctx.http.get(weatherUrl, { timeout: 15000 });
    data = await resp.json();
  } catch (e) {
    return errorWidget('网络请求失败: ' + e.message);
  }

  // 行政区划请求（失败时降级，不影响天气数据展示）
  let locationName = '未知位置';
  try {
    const adminUrl = 'https://singer.caiyunhub.com/v3/cartography/reverse_admins?longitude=' + lon + '&latitude=' + lat + '&token=' + token;
    const adminResp = await ctx.http.get(adminUrl, { timeout: 10000 });
    const adminData = await adminResp.json();
    const admins = adminData && adminData.admins;
    if (admins && admins.length > 0) locationName = admins[admins.length - 1].name;
  } catch (_) {
    // 地名查询失败不影响主流程
  }

  if (data.status !== 'ok' || !data.result || data.result.realtime.status !== 'ok') {
    return errorWidget('API 返回异常: ' + (data.status || '未知'));
  }

  const rt = data.result.realtime;
  const sky = skyconInfo(rt.skycon);
  const temp = Math.round(rt.temperature);
  const feelTemp = Math.round(rt.apparent_temperature);
  const humidity = Math.round(rt.humidity * 100);
  const windSpeed = rt.wind.speed.toFixed(1);
  const windDirText = windDir(rt.wind.direction);
  const windLv = windLevel(rt.wind.speed);
  const visibility = rt.visibility.toFixed(1);
  const aqi = rt.air_quality?.aqi?.chn ?? '-';
  const aqiDesc = rt.air_quality?.description?.chn ?? '-';
  const aqiColorVal = aqiColor(aqiDesc);
  const uvIndex = rt.life_index?.ultraviolet?.index ?? '-';
  const uvDesc = rt.life_index?.ultraviolet?.desc ?? '-';
  const comfortIndex = rt.life_index?.comfort?.index ?? '-';
  const comfortDesc = rt.life_index?.comfort?.desc ?? '-';

  const refreshAfter = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const serverTime = new Date(data.server_time * 1000);
  const updateTime = serverTime.getHours().toString().padStart(2, '0') + ':' + serverTime.getMinutes().toString().padStart(2, '0') + ' 更新';

  // accessoryInline（锁屏单行）
  if (ctx.widgetFamily === 'accessoryInline') {
    return {
      type: 'widget',
      refreshAfter,
      children: [
        { type: 'image', src: 'sf-symbol:' + sky.symbol, width: 12, height: 12, color: sky.color },
        { type: 'text', text: ' ' + sky.text + ' ' + temp + '  湿度' + humidity + '%  AQI ' + aqi, font: { size: 'caption1' }, textColor: C.textPri, maxLines: 1 },
      ],
    };
  }

  // accessoryCircular（锁屏圆形）
  if (ctx.widgetFamily === 'accessoryCircular') {
    return {
      type: 'widget',
      refreshAfter,
      padding: 4,
      gap: 2,
      children: [
        { type: 'image', src: 'sf-symbol:' + sky.symbol, color: sky.color, width: 22, height: 22 },
        { type: 'text', text: temp + '', font: { size: 'title3', weight: 'bold' }, textColor: C.textPri, textAlign: 'center' },
        { type: 'text', text: sky.text, font: { size: 'caption2' }, textColor: C.textSec, textAlign: 'center' },
      ],
    };
  }

  // accessoryRectangular（锁屏矩形）
  if (ctx.widgetFamily === 'accessoryRectangular') {
    return {
      type: 'widget',
      refreshAfter,
      gap: 3,
      children: [
        {
          type: 'stack', direction: 'row', alignItems: 'center', gap: 6,
          children: [
            { type: 'image', src: 'sf-symbol:' + sky.symbol, color: sky.color, width: 14, height: 14 },
            { type: 'text', text: locationName + '  ' + sky.text, font: { size: 'headline', weight: 'semibold' }, textColor: C.textPri, maxLines: 1 },
          ],
        },
        { type: 'text', text: temp + 'C  体感 ' + feelTemp + 'C  湿度 ' + humidity + '%', font: { size: 'caption1' }, textColor: C.textSec, maxLines: 1 },
        { type: 'text', text: windDirText + '风 ' + windLv + '级 ' + windSpeed + ' km/h  AQI ' + aqi + ' ' + aqiDesc, font: { size: 'caption1' }, textColor: C.textTer, maxLines: 1 },
      ],
    };
  }

  // systemSmall（主屏小尺寸）
  if (ctx.widgetFamily === 'systemSmall') {
    return {
      type: 'widget',
      refreshAfter,
      backgroundGradient: {
        type: 'linear',
        colors: [C.bg1, C.bg2],
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 1, y: 1 },
      },
      padding: 14,
      gap: 0,
      children: [
        {
          type: 'stack', direction: 'row', alignItems: 'center', gap: 4,
          children: [
            { type: 'spacer' },
            { type: 'image', src: 'sf-symbol:location.fill', color: C.locIcon, width: 10, height: 10 },
            { type: 'text', text: locationName, font: { size: 'caption1', weight: 'medium' }, textColor: C.textSec, maxLines: 1, minScale: 0.8 },
            { type: 'spacer' },
          ],
        },
        { type: 'spacer' },
        { type: 'image', src: 'sf-symbol:' + sky.symbol, color: sky.color, width: 40, height: 40 },
        { type: 'spacer', length: 6 },
        { type: 'text', text: temp + '', font: { size: 'largeTitle', weight: 'bold' }, textColor: C.textPri },
        { type: 'text', text: sky.text, font: { size: 'subheadline' }, textColor: C.textSec },
        { type: 'spacer' },
        {
          type: 'stack', direction: 'row', alignItems: 'center', gap: 4,
          children: [
            { type: 'text', text: humidity + '%', font: { size: 'caption2' }, textColor: C.textTer },
            { type: 'spacer' },
            { type: 'text', text: 'AQI ' + aqi, font: { size: 'caption2', weight: 'semibold' }, textColor: aqiColorVal },
          ],
        },
      ],
    };
  }

  // systemMedium（主屏中尺寸）
  if (ctx.widgetFamily === 'systemMedium') {
    return {
      type: 'widget',
      refreshAfter,
      backgroundGradient: {
        type: 'linear',
        colors: [C.bg1, C.bg2, C.bg3],
        stops: [0, 0.5, 1],
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 1, y: 1 },
      },
      padding: 16,
      gap: 0,
      children: [
        {
          type: 'stack', direction: 'row', alignItems: 'center', gap: 4,
          children: [
            { type: 'spacer' },
            { type: 'image', src: 'sf-symbol:location.fill', color: C.locIcon, width: 11, height: 11 },
            { type: 'text', text: locationName, font: { size: 'caption1', weight: 'medium' }, textColor: C.textSec, maxLines: 1 },
            { type: 'spacer' },
            { type: 'text', text: updateTime, font: { size: 'caption2' }, textColor: C.textFaint },
          ],
        },
        { type: 'spacer' },
        {
          type: 'stack', direction: 'row', alignItems: 'center', gap: 0,
          children: [
            {
              type: 'stack', direction: 'column', alignItems: 'start', gap: 2, flex: 1,
              children: [
                { type: 'image', src: 'sf-symbol:' + sky.symbol, color: sky.color, width: 44, height: 44 },
                { type: 'text', text: temp + '°C', font: { size: 'title', weight: 'bold' }, textColor: C.textPri },
                { type: 'text', text: sky.text + '  体感 ' + feelTemp + '°C', font: { size: 'caption1' }, textColor: C.textSec },
                { type: 'stack', direction: 'row', alignItems: 'center', gap: 4, children: [{ type: 'image', src: 'sf-symbol:sun.and.horizon.fill', color: C.uvIcon, width: 11, height: 11 }, { type: 'text', text: '紫外线  ' + uvIndex + ' ' + uvDesc, font: { size: 'caption2' }, textColor: C.textMuted }] },
              ],
            },
            { type: 'stack', direction: 'column', width: 1, height: 90, backgroundColor: C.divider, children: [] },
            {
              type: 'stack', direction: 'column', alignItems: 'start', gap: 5, padding: [0, 0, 0, 14], flex: 1,
              children: [
                { type: 'stack', direction: 'row', alignItems: 'center', gap: 5, children: [{ type: 'image', src: 'sf-symbol:humidity.fill', color: C.humIcon, width: 12, height: 12 }, { type: 'text', text: '湿度  ' + humidity + '%', font: { size: 'caption1' }, textColor: C.textSec }] },
                { type: 'stack', direction: 'row', alignItems: 'center', gap: 5, children: [{ type: 'image', src: 'sf-symbol:wind', color: C.windIcon, width: 12, height: 12 }, { type: 'text', text: windDirText + '风  ' + windLv + '级 ' + windSpeed + ' km/h', font: { size: 'caption1' }, textColor: C.textSec }] },
                { type: 'stack', direction: 'row', alignItems: 'center', gap: 5, children: [{ type: 'image', src: 'sf-symbol:eye.fill', color: C.visIcon, width: 12, height: 12 }, { type: 'text', text: '能见度  ' + visibility + ' km', font: { size: 'caption1' }, textColor: C.textSec }] },
                { type: 'stack', direction: 'row', alignItems: 'center', gap: 5, children: [{ type: 'image', src: 'sf-symbol:aqi.medium', color: aqiColorVal, width: 12, height: 12 }, { type: 'text', text: 'AQI  ' + aqi + ' ' + aqiDesc, font: { size: 'caption1', weight: 'semibold' }, textColor: aqiColorVal }] },
                { type: 'stack', direction: 'row', alignItems: 'center', gap: 5, children: [{ type: 'image', src: 'sf-symbol:thermometer.medium', color: C.feelIcon, width: 12, height: 12 }, { type: 'text', text: '舒适度  ' + comfortIndex + ' ' + comfortDesc, font: { size: 'caption1' }, textColor: C.textMuted }] },
              ],
            },
          ],
        },
      ],
    };
  }

  // systemLarge / systemExtraLarge（主屏大尺寸）
  return {
    type: 'widget',
    refreshAfter,
    backgroundGradient: {
      type: 'linear',
      colors: [C.bg1, C.bg2, C.bg3],
      stops: [0, 0.5, 1],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 },
    },
    padding: 20,
    gap: 0,
    children: [
      {
        type: 'stack', direction: 'row', alignItems: 'center', gap: 4,
        children: [
          { type: 'spacer' },
          { type: 'image', src: 'sf-symbol:location.fill', color: C.humIcon, width: 12, height: 12 },
          { type: 'text', text: locationName, font: { size: 'subheadline', weight: 'semibold' }, textColor: C.textPri },
          { type: 'spacer' },
          { type: 'text', text: updateTime, font: { size: 'caption1' }, textColor: C.textFaint },
        ],
      },
      { type: 'spacer', length: 16 },
      {
        type: 'stack', direction: 'row', alignItems: 'center', gap: 16,
        children: [
          { type: 'image', src: 'sf-symbol:' + sky.symbol, color: sky.color, width: 64, height: 64 },
          {
            type: 'stack', direction: 'column', alignItems: 'start', gap: 4,
            children: [
              { type: 'text', text: temp + '°C', font: { size: 'largeTitle', weight: 'bold' }, textColor: C.textPri },
              { type: 'text', text: sky.text, font: { size: 'title3' }, textColor: C.textSec },
              { type: 'text', text: '体感温度 ' + feelTemp + '°C', font: { size: 'subheadline' }, textColor: C.textTer },
              { type: 'stack', direction: 'row', alignItems: 'center', gap: 5, children: [{ type: 'image', src: 'sf-symbol:sun.and.horizon.fill', color: C.uvIcon, width: 13, height: 13 }, { type: 'text', text: '紫外线  ' + uvIndex + ' ' + uvDesc, font: { size: 'subheadline' }, textColor: C.textMuted }] },
            ],
          },
        ],
      },
      { type: 'spacer', length: 20 },
      { type: 'stack', direction: 'row', height: 1, backgroundColor: C.divider, children: [] },
      { type: 'spacer', length: 16 },
      {
        type: 'stack', direction: 'row', alignItems: 'start', gap: 12,
        children: [
          {
            type: 'stack', direction: 'column', alignItems: 'start', gap: 14, flex: 1,
            children: [
              { type: 'stack', direction: 'column', alignItems: 'start', gap: 3, children: [{ type: 'stack', direction: 'row', alignItems: 'center', gap: 5, children: [{ type: 'image', src: 'sf-symbol:humidity.fill', color: C.humIcon, width: 13, height: 13 }, { type: 'text', text: '相对湿度', font: { size: 'caption1' }, textColor: C.textDim }] }, { type: 'text', text: humidity + '%', font: { size: 'title3', weight: 'semibold' }, textColor: C.textPri }] },
              { type: 'stack', direction: 'column', alignItems: 'start', gap: 3, children: [{ type: 'stack', direction: 'row', alignItems: 'center', gap: 5, children: [{ type: 'image', src: 'sf-symbol:wind', color: C.windIcon, width: 13, height: 13 }, { type: 'text', text: '风速风向', font: { size: 'caption1' }, textColor: C.textDim }] }, { type: 'text', text: windDirText + '风 ' + windLv + '级 ' + windSpeed + ' km/h', font: { size: 'title3', weight: 'semibold' }, textColor: C.textPri }] },
              { type: 'stack', direction: 'column', alignItems: 'start', gap: 3, children: [{ type: 'stack', direction: 'row', alignItems: 'center', gap: 5, children: [{ type: 'image', src: 'sf-symbol:eye.fill', color: C.visIcon, width: 13, height: 13 }, { type: 'text', text: '能见度', font: { size: 'caption1' }, textColor: C.textDim }] }, { type: 'text', text: visibility + ' km', font: { size: 'title3', weight: 'semibold' }, textColor: C.textPri }] },
            ],
          },
          {
            type: 'stack', direction: 'column', alignItems: 'start', gap: 14, flex: 1,
            children: [
              { type: 'stack', direction: 'column', alignItems: 'start', gap: 3, children: [{ type: 'stack', direction: 'row', alignItems: 'center', gap: 5, children: [{ type: 'image', src: 'sf-symbol:aqi.medium', color: aqiColorVal, width: 13, height: 13 }, { type: 'text', text: '空气质量 AQI', font: { size: 'caption1' }, textColor: C.textDim }] }, { type: 'text', text: aqi + '  ' + aqiDesc, font: { size: 'title3', weight: 'semibold' }, textColor: aqiColorVal }] },
              { type: 'stack', direction: 'column', alignItems: 'start', gap: 3, children: [{ type: 'stack', direction: 'row', alignItems: 'center', gap: 5, children: [{ type: 'image', src: 'sf-symbol:thermometer.medium', color: C.feelIcon, width: 13, height: 13 }, { type: 'text', text: '舒适度', font: { size: 'caption1' }, textColor: C.textDim }] }, { type: 'text', text: comfortIndex + ' ' + comfortDesc, font: { size: 'title3', weight: 'semibold' }, textColor: C.textPri }] },
              { type: 'stack', direction: 'column', alignItems: 'start', gap: 3, children: [{ type: 'stack', direction: 'row', alignItems: 'center', gap: 5, children: [{ type: 'image', src: 'sf-symbol:eye.fill', color: C.visIcon, width: 13, height: 13 }, { type: 'text', text: '能见度', font: { size: 'caption1' }, textColor: C.textDim }] }, { type: 'text', text: visibility + ' km', font: { size: 'title3', weight: 'semibold' }, textColor: C.textPri }] },
            ],
          },
        ],
      },
    ],
  };
}
