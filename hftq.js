// 和风天气小组件 for Egern
// 环境变量（在 widgets env 中配置）：
//   QW_HOST     - 你的 API Host，例如 abcxyz.qweatherapi.com
//   QW_KEY      - 你的 API Key
//   LOCATION    - 支持：城市名（如"北京"）、LocationID（如"101010100"）
//                       或经纬度坐标（如"116.41,39.92"，格式为"经度,纬度"）
//   CITY_NAME   - （可选）覆盖显示的城市名称，不填则自动使用 GeoAPI 返回的城市名

export default async function (ctx) {
  const host = ctx.env.QW_HOST;
  const key = ctx.env.QW_KEY;
  const locationInput = ctx.env.LOCATION || "北京";
  const cityNameOverride = ctx.env.CITY_NAME || "";

  const headers = { "X-QW-Api-Key": key };

  // ── 错误 UI 工厂 ──────────────────────────────────────────
  function errorWidget(msg) {
    return {
      type: "widget",
      backgroundColor: "#1C1C1E",
      padding: 16,
      children: [
        {
          type: "image",
          src: "sf-symbol:exclamationmark.triangle.fill",
          color: "#FF9F0A",
          width: 24,
          height: 24,
        },
        { type: "spacer", length: 8 },
        {
          type: "text",
          text: msg,
          font: { size: "footnote" },
          textColor: "#EBEBF599",
          maxLines: 3,
        },
      ],
    };
  }

  // ── GeoAPI：解析 LOCATION → LocationID + 经纬度 + 城市名 ──
  // 缓存 key 基于 locationInput，避免每次刷新都调 GeoAPI
  const geoCacheKey = `qw_geo_${locationInput}`;
  let geoInfo = ctx.storage.getJSON(geoCacheKey);

  if (!geoInfo) {
    let geoResp;
    try {
      geoResp = await ctx.http.get(
        `https://${host}/geo/v2/city/lookup?location=${encodeURIComponent(locationInput)}&number=1&lang=zh`,
        { headers }
      );
    } catch (e) {
      return errorWidget("GeoAPI 请求失败：" + e.message);
    }
    const geoData = await geoResp.json();
    if (geoData.code !== "200" || !geoData.location || geoData.location.length === 0) {
      return errorWidget(`城市解析失败（${geoData.code}）：找不到"${locationInput}"`);
    }
    const loc = geoData.location[0];
    geoInfo = {
      id:   loc.id,        // LocationID，用于天气接口
      lat:  loc.lat,       // 纬度，用于空气质量接口
      lon:  loc.lon,       // 经度，用于空气质量接口
      name: loc.name,      // 城市名
      adm1: loc.adm1,      // 一级行政区（省/直辖市）
    };
    // GeoAPI 结果缓存 24 小时（城市信息基本不变）
    ctx.storage.setJSON(geoCacheKey, geoInfo);
  }

  // CITY_NAME 有配置则优先使用，否则用 GeoAPI 返回的城市名
  const cityName = cityNameOverride || geoInfo.name;

  // ── 并发获取天气 + 空气质量 ───────────────────────────────
  // 天气接口：用 LocationID（精确）
  // 空气质量接口：用经纬度（该接口只支持坐标）
  let weather, air;
  try {
    const [wResp, aResp] = await Promise.all([
      ctx.http.get(
        `https://${host}/v7/weather/now?location=${geoInfo.id}&lang=zh`,
        { headers }
      ),
      ctx.http.get(
        `https://${host}/airquality/v1/current/${geoInfo.lat}/${geoInfo.lon}`,
        { headers }
      ),
    ]);
    weather = await wResp.json();
    air = await aResp.json();
  } catch (e) {
    return errorWidget("天气请求失败：" + e.message);
  }

  if (weather.code !== "200") {
    return errorWidget(`天气 API 错误 ${weather.code}`);
  }

  const now = weather.now;

  // AQI：中国标准优先 cn-mee-1h（实时）→ cn-mee（日均）→ 第一条兜底
  // 注意：中国地区不返回 QAQI，code 为 cn-mee / cn-mee-1h
  const aqiIndex =
    (air.indexes || []).find((i) => i.code === "cn-mee-1h") ||
    (air.indexes || []).find((i) => i.code === "cn-mee") ||
    (air.indexes || [])[0];
  const aqiVal = aqiIndex ? aqiIndex.aqiDisplay : "—";

  // cn-mee / cn-mee-1h 的 category 为英文，按文档映射为中文
  // 其他地区直接使用原始 category
  const cnCategoryMap = {
    Excellent: "优",
    Good: "良",
    "Lightly Polluted": "轻度污染",
    "Moderately Polluted": "中度污染",
    "Heavily Polluted": "重度污染",
    "Severely Polluted": "严重污染",
  };
  const rawCategory = aqiIndex ? aqiIndex.category : "";
  const isCnAqi =
    aqiIndex &&
    (aqiIndex.code === "cn-mee" || aqiIndex.code === "cn-mee-1h");
  const aqiCategory = isCnAqi
    ? cnCategoryMap[rawCategory] || rawCategory
    : rawCategory;

  const aqiColor = aqiIndex
    ? `rgba(${aqiIndex.color.red},${aqiIndex.color.green},${aqiIndex.color.blue},1)`
    : "#8E8E93";

  // 风力等级文字
  function windDesc(scale) {
    const n = parseInt(scale, 10);
    if (n <= 1) return "微风";
    if (n <= 3) return `${scale}级`;
    return `${scale}级大风`;
  }

  // 下载和风天气 SVG 图标并转为 base64 data URI
  // 图标 URL: https://icons.qweather.com/assets/icons/{icon}.svg
  async function fetchWeatherIcon(iconCode) {
    const cacheKey = `qw_icon_${iconCode}`;
    const cached = ctx.storage.get(cacheKey);
    if (cached) return cached;
    try {
      const resp = await ctx.http.get(
        `https://icons.qweather.com/assets/icons/${iconCode}.svg`
      );
      const svgText = await resp.text();
      // 转为 base64 data URI
      const b64 = btoa(unescape(encodeURIComponent(svgText)));
      const dataUri = `data:image/svg+xml;base64,${b64}`;
      ctx.storage.set(cacheKey, dataUri);
      return dataUri;
    } catch {
      return null;
    }
  }

  // SF Symbol 降级（仅锁屏或图标加载失败时使用）
  function sfSymbolFallback(iconCode) {
    const code = parseInt(iconCode, 10);
    if (code === 100 || code === 150) return "sun.max.fill";
    if ([101, 102, 103, 151, 152, 153].includes(code)) return "cloud.sun.fill";
    if (code === 104) return "cloud.fill";
    if (code >= 300 && code < 400) return "cloud.rain.fill";
    if (code >= 400 && code < 500) return "snowflake";
    if (code >= 500 && code < 600) return "cloud.fog.fill";
    if (code >= 200 && code < 300) return "wind";
    return "cloud.fill";
  }

  const refreshTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  // 预加载图标（锁屏尺寸不需要，跳过以节省时间）
  const isAccessory =
    ctx.widgetFamily === "accessoryCircular" ||
    ctx.widgetFamily === "accessoryRectangular" ||
    ctx.widgetFamily === "accessoryInline";

  const weatherIconSrc = isAccessory
    ? `sf-symbol:${sfSymbolFallback(now.icon)}`
    : (await fetchWeatherIcon(now.icon)) || `sf-symbol:${sfSymbolFallback(now.icon)}`;

  // ── accessoryRectangular（锁定屏幕矩形）────────────────────
  if (ctx.widgetFamily === "accessoryRectangular") {
    return {
      type: "widget",
      refreshAfter: refreshTime,
      padding: [2, 4, 2, 4],
      gap: 2,
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 6,
          children: [
            {
              type: "image",
              src: weatherIconSrc,
              width: 16,
              height: 16,
            },
            {
              type: "text",
              text: `${cityName}  ${now.temp}°`,
              font: { size: "headline", weight: "semibold" },
              maxLines: 1,
            },
          ],
        },
        {
          type: "text",
          text: `${now.text}  湿度 ${now.humidity}%  AQI ${aqiVal}`,
          font: { size: "caption1" },
          maxLines: 1,
        },
      ],
    };
  }

  // ── accessoryCircular（锁定屏幕圆形）──────────────────────
  if (ctx.widgetFamily === "accessoryCircular") {
    return {
      type: "widget",
      refreshAfter: refreshTime,
      children: [
        {
          type: "stack",
          direction: "column",
          alignItems: "center",
          gap: 2,
          children: [
            {
              type: "image",
              src: weatherIconSrc,
              width: 20,
              height: 20,
            },
            {
              type: "text",
              text: `${now.temp}°`,
              font: { size: "title3", weight: "bold" },
            },
          ],
        },
      ],
    };
  }

  // ── systemSmall ────────────────────────────────────────────
  if (ctx.widgetFamily === "systemSmall") {
    return {
      type: "widget",
      refreshAfter: refreshTime,
      backgroundGradient: {
        type: "linear",
        colors: ["#1D3461", "#1F6FAE"],
        stops: [0, 1],
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 1, y: 1 },
      },
      padding: 14,
      gap: 4,
      children: [
        {
          type: "text",
          text: cityName,
          font: { size: "footnote", weight: "semibold" },
          textColor: "#FFFFFFCC",
          maxLines: 1,
        },
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 6,
          children: [
            {
              type: "image",
              src: weatherIconSrc,
              width: 28,
              height: 28,
            },
            {
              type: "text",
              text: `${now.temp}°`,
              font: { size: "title", weight: "bold" },
              textColor: "#FFFFFF",
            },
          ],
        },
        {
          type: "text",
          text: now.text,
          font: { size: "subheadline" },
          textColor: "#FFFFFFCC",
        },
        { type: "spacer" },
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 4,
          children: [
            {
              type: "image",
              src: "sf-symbol:aqi.low",
              color: aqiColor,
              width: 12,
              height: 12,
            },
            {
              type: "text",
              text: `AQI ${aqiVal}  ${aqiCategory}`,
              font: { size: "caption2" },
              textColor: "#FFFFFFAA",
              maxLines: 1,
            },
          ],
        },
      ],
    };
  }

  // ── systemMedium / systemLarge（默认）─────────────────────
  const isLarge = ctx.widgetFamily === "systemLarge";

  const mainChildren = [
    // 顶部：城市 + 当前时间
    {
      type: "stack",
      direction: "row",
      alignItems: "center",
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 4,
          flex: 1,
          children: [
            {
              type: "image",
              src: "sf-symbol:location.fill",
              color: "#64D2FF",
              width: 12,
              height: 12,
            },
            {
              type: "text",
              text: cityName,
              font: { size: "subheadline", weight: "semibold" },
              textColor: "#FFFFFFDD",
              maxLines: 1,
            },
          ],
        },
        {
          type: "date",
          date: new Date().toISOString(),
          format: "time",
          font: { size: "caption2" },
          textColor: "#FFFFFF66",
        },
      ],
    },
    { type: "spacer", length: 6 },
    // 中部：大温度 + 图标
    {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 12,
      children: [
        {
          type: "image",
          src: weatherIconSrc,
          width: 52,
          height: 52,
        },
        {
          type: "stack",
          direction: "column",
          gap: 2,
          children: [
            {
              type: "text",
              text: `${now.temp}°C`,
              font: { size: "largeTitle", weight: "bold" },
              textColor: "#FFFFFF",
              maxLines: 1,
              minScale: 0.7,
            },
            {
              type: "text",
              text: now.text,
              font: { size: "subheadline" },
              textColor: "#FFFFFFCC",
            },
            {
              type: "text",
              text: `体感 ${now.feelsLike}°`,
              font: { size: "footnote" },
              textColor: "#FFFFFF88",
            },
          ],
        },
      ],
    },
    { type: "spacer" },
    // 底部详情行：湿度 / 风力 / AQI / 能见度
    {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 0,
      children: [
        {
          type: "stack",
          direction: "column",
          alignItems: "center",
          flex: 1,
          gap: 3,
          children: [
            {
              type: "image",
              src: "sf-symbol:humidity.fill",
              color: "#64D2FF",
              width: 16,
              height: 16,
            },
            {
              type: "text",
              text: `${now.humidity}%`,
              font: { size: "caption1", weight: "semibold" },
              textColor: "#FFFFFF",
            },
            {
              type: "text",
              text: "湿度",
              font: { size: "caption2" },
              textColor: "#FFFFFF66",
            },
          ],
        },
        { type: "stack", width: 1, height: 36, backgroundColor: "#FFFFFF22" },
        {
          type: "stack",
          direction: "column",
          alignItems: "center",
          flex: 1,
          gap: 3,
          children: [
            {
              type: "image",
              src: "sf-symbol:wind",
              color: "#30D158",
              width: 16,
              height: 16,
            },
            {
              type: "text",
              text: windDesc(now.windScale),
              font: { size: "caption1", weight: "semibold" },
              textColor: "#FFFFFF",
            },
            {
              type: "text",
              text: now.windDir,
              font: { size: "caption2" },
              textColor: "#FFFFFF66",
            },
          ],
        },
        { type: "stack", width: 1, height: 36, backgroundColor: "#FFFFFF22" },
        {
          type: "stack",
          direction: "column",
          alignItems: "center",
          flex: 1,
          gap: 3,
          children: [
            {
              type: "image",
              src: "sf-symbol:aqi.medium",
              color: aqiColor,
              width: 16,
              height: 16,
            },
            {
              type: "text",
              text: aqiVal,
              font: { size: "caption1", weight: "semibold" },
              textColor: "#FFFFFF",
            },
            {
              type: "text",
              text: aqiCategory || "AQI",
              font: { size: "caption2" },
              textColor: "#FFFFFF66",
              maxLines: 1,
            },
          ],
        },
        { type: "stack", width: 1, height: 36, backgroundColor: "#FFFFFF22" },
        {
          type: "stack",
          direction: "column",
          alignItems: "center",
          flex: 1,
          gap: 3,
          children: [
            {
              type: "image",
              src: "sf-symbol:eye.fill",
              color: "#FFD60A",
              width: 16,
              height: 16,
            },
            {
              type: "text",
              text: `${now.vis}km`,
              font: { size: "caption1", weight: "semibold" },
              textColor: "#FFFFFF",
            },
            {
              type: "text",
              text: "能见度",
              font: { size: "caption2" },
              textColor: "#FFFFFF66",
            },
          ],
        },
      ],
    },
  ];

  // Large 额外追加降水 & 气压卡片
  if (isLarge) {
    mainChildren.push(
      { type: "spacer", length: 12 },
      {
        type: "stack",
        direction: "row",
        gap: 8,
        children: [
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            flex: 1,
            gap: 6,
            backgroundColor: "#FFFFFF12",
            borderRadius: 10,
            padding: [8, 10, 8, 10],
            children: [
              {
                type: "image",
                src: "sf-symbol:cloud.rain.fill",
                color: "#5AC8FA",
                width: 18,
                height: 18,
              },
              {
                type: "stack",
                direction: "column",
                gap: 1,
                children: [
                  {
                    type: "text",
                    text: `${now.precip} mm`,
                    font: { size: "footnote", weight: "semibold" },
                    textColor: "#FFFFFF",
                  },
                  {
                    type: "text",
                    text: "过去1小时降水",
                    font: { size: "caption2" },
                    textColor: "#FFFFFF66",
                  },
                ],
              },
            ],
          },
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            flex: 1,
            gap: 6,
            backgroundColor: "#FFFFFF12",
            borderRadius: 10,
            padding: [8, 10, 8, 10],
            children: [
              {
                type: "image",
                src: "sf-symbol:gauge.medium",
                color: "#FF9F0A",
                width: 18,
                height: 18,
              },
              {
                type: "stack",
                direction: "column",
                gap: 1,
                children: [
                  {
                    type: "text",
                    text: `${now.pressure} hPa`,
                    font: { size: "footnote", weight: "semibold" },
                    textColor: "#FFFFFF",
                  },
                  {
                    type: "text",
                    text: "大气压强",
                    font: { size: "caption2" },
                    textColor: "#FFFFFF66",
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: "spacer" },
      {
        type: "text",
        text: "数据来源：和风天气",
        font: { size: "caption2" },
        textColor: "#FFFFFF44",
        textAlign: "right",
      }
    );
  }

  return {
    type: "widget",
    refreshAfter: refreshTime,
    backgroundGradient: {
      type: "linear",
      colors: ["#0A1628", "#0D2137", "#133B5C"],
      stops: [0, 0.5, 1],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 },
    },
    padding: 16,
    gap: 0,
    children: mainChildren,
  };
}
