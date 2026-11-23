function isCanvasWorkbench(node) {
  return node?.type === 'image' && ['ai', 'ps', 'collage'].includes(node.variant);
}

// Only the latest photo edge feeds a workbench. An input preview is never a published result.
function createWorkbenchGraph(board = state) {
  const objects = new Map(board.objects.map(node => [node.id, node]));
  const inputs = new Map();
  const outputs = new Map();
  for (const edge of board.connections || []) {
    const from = objects.get(edge.from);
    if (from?.type === 'image' && isCanvasWorkbench(objects.get(edge.to))) inputs.set(edge.to, from);
  }

  function input(node) {
    return inputs.get(node?.id);
  }

  function output(node) {
    if (node?.type !== 'image') return '';
    if (!isCanvasWorkbench(node)) return node.src || '';
    if (outputs.has(node.id)) return outputs.get(node.id);
    // Cache an empty result first so an invalid cycle from an older backup cannot publish.
    outputs.set(node.id, '');
    const upstream = input(node);
    const current = output(upstream);
    if (upstream && !current) return '';

    let image = '';
    if (node.variant === 'ps') {
      const project = board.pikadoProjects?.[node.id];
      if (current && project?.inputSrc === current) image = project.preview || '';
    } else if (node.colorBoardEdit || node.collageEdit) {
      if ((node.aiInput || '') === current) image = node.src || '';
    } else if (current && (!node.aiInput || node.aiInput === current)) {
      image = node.src || '';
    }
    outputs.set(node.id, image);
    return image;
  }

  return {input, output, source:node => output(input(node))};
}

function workbenchSource(node) {
  return createWorkbenchGraph().source(node);
}
