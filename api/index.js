const { Transformer } = require('markmap-lib');

module.exports = async (req, res) => {
  try {
    // 动态加载 markmap-cli
    const { default: markmap } = await import('markmap-cli');

    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const { content, options, style } = req.body;
    if (!content) {
      res.status(400).send('Bad Request: markdown content is required.');
      return;
    }

    const transformer = new Transformer();
    const { root, features } = transformer.transform(content);
    const assets = transformer.getUsedAssets(features);

    // 样式注入逻辑
    const customStyle = `
      svg.markmap { 
        background-color: ${style?.background || 'transparent'};
      }
      .markmap-text {
        fill: ${style?.textColor || '#333'};
        font: ${style?.font || '16px sans-serif'};
      }
      .markmap-line {
        stroke: ${style?.lineColor || '#444'};
      }
      .markmap-node[data-depth="0"] > circle {
        fill: ${style?.rootBgColor || '#ACD5F2'};
      }
      .markmap-node[data-depth="0"] > text {
        fill: ${style?.rootTextColor || '#1E461'};
      }
    `;

    const finalStyle = markmap.loadCSS(assets.styles);
    finalStyle.push({ type: 'style', data: customStyle });

    const svg = await markmap.createMarkmap({
        ...options,
        content: root,
        output: ``,
        style: finalStyle,
        script: markmap.loadJS(assets.scripts, { getMarkmap: false })
    });
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(200).send(svg);

  } catch (error) {
    console.error(error);
    res.status(500).send(`Internal Server Error: ${error.message}`);
  }
};
