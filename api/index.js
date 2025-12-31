const { Transformer } = require('markmap-lib');

module.exports = async (req, res) => {
  // ---------------------------------------------------------
  // 1. CORS 配置 (解决 n8n 或浏览器跨域调用问题)
  // ---------------------------------------------------------
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // 允许任何来源，生产环境建议指定具体域名
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 处理浏览器的 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // ---------------------------------------------------------
  // 2. 请求方法验证
  // ---------------------------------------------------------
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    // ---------------------------------------------------------
    // 3. 安全检查与数据获取
    // ---------------------------------------------------------
    // 检查 body 是否存在，这是之前报错的核心原因
    if (!req.body) {
        throw new Error('Request body is empty. Ensure Content-Type is application/json');
    }

    const { content, options, style } = req.body;

    if (!content) {
      res.status(400).send('Bad Request: markdown content is required.');
      return;
    }

    // ---------------------------------------------------------
    // 4. 核心逻辑 (Markmap 生成)
    // ---------------------------------------------------------
    
    // 动态加载 markmap-cli (适应 ESM 模块)
    const { default: markmap } = await import('markmap-cli');

    const transformer = new Transformer();
    const { root, features } = transformer.transform(content);
    const assets = transformer.getUsedAssets(features);

    // 样式注入逻辑
    const customStyle = `
      svg.markmap { 
        background-color: ${style?.background || 'transparent'};
      }
      .markmap-text {
        fill: ${style?.textColor || '#333333'};
        font: ${style?.font || '16px "Microsoft YaHei", sans-serif'};
      }
      .markmap-line {
        stroke: ${style?.lineColor || '#444444'};
      }
      .markmap-node[data-depth="0"] > circle {
        fill: ${style?.rootBgColor || '#ACD5F2'};
      }
      .markmap-node[data-depth="0"] > text {
        fill: ${style?.rootTextColor || '#1E4615'}; 
      }
    `;
    // 注意：原代码中 #1E461 只有5位，这里补全为6位 #1E4615，请根据需要修改

    const finalStyle = markmap.loadCSS(assets.styles);
    finalStyle.push({ type: 'style', data: customStyle });

    const svg = await markmap.createMarkmap({
        ...options,
        content: root,
        output: undefined, // 设为 undefined 以便返回字符串而不是写入文件
        style: finalStyle,
        script: markmap.loadJS(assets.scripts, { getMarkmap: false })
    });
    
    // ---------------------------------------------------------
    // 5. 返回结果
    // ---------------------------------------------------------
    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(200).send(svg);

  } catch (error) {
    console.error('Server Error:', error);
    // 返回详细错误信息以便调试
    res.status(500).send(`Internal Server Error: ${error.message}`);
  }
};
