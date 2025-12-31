const { Transformer } = require('markmap-lib');

module.exports = async (req, res) => {
  // 1. 设置跨域和请求方法检查
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { content, options, style } = req.body;
    if (!content) return res.status(400).send('Markdown content is required');

    // 2. 转换 Markdown
    const transformer = new Transformer();
    const { root, features } = transformer.transform(content);
    const assets = transformer.getUsedAssets(features);

    // 3. 手动构建 CSS 和 JS (替代报错的 loadCSS)
    let styleTags = '';
    let scriptTags = '';

    // 处理样式
    if (assets.styles) {
      assets.styles.forEach(item => {
        if (item.type === 'stylesheet') {
          styleTags += `<link rel="stylesheet" href="${item.data.href}">\n`;
        } else if (item.type === 'style') {
          styleTags += `<style>${item.data}</style>\n`;
        }
      });
    }

    // 注入你的自定义样式 (颜色等)
    const customCSS = `
      <style>
        svg.markmap { width: 100%; height: 100vh; background-color: ${style?.background || 'transparent'}; }
        .markmap-node > circle { fill: ${style?.rootBgColor || '#ACD5F2'}; }
        .markmap-text { fill: ${style?.textColor || '#333'}; font: ${style?.font || '16px sans-serif'}; }
        .markmap-link { stroke: ${style?.lineColor || '#444'}; }
      </style>
    `;

    // 处理脚本
    if (assets.scripts) {
      assets.scripts.forEach(item => {
        if (item.type === 'script') {
           if (item.data.src) {
             scriptTags += `<script src="${item.data.src}"></script>\n`;
           } else if (item.data.textContent) {
             scriptTags += `<script>${item.data.textContent}</script>\n`;
           }
        }
      });
    }

    // 4. 拼接最终 HTML
    // 注意：这不是静态SVG图片，而是包含JS的动态页面
    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${styleTags}
${customCSS}
</head>
<body style="margin:0;padding:0;overflow:hidden;">
<svg id="markmap"></svg>
${scriptTags}
<script>
  (function() {
    const { Markmap } = window.markmap;
    // 渲染导图
    Markmap.create('#markmap', ${JSON.stringify(options || null)}, ${JSON.stringify(root)});
  })();
</script>
</body>
</html>
    `;

    // 5. 返回 HTML 字符串
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);

  } catch (error) {
    console.error(error);
    res.status(500).send(`Server Error: ${error.message}`);
  }
};
