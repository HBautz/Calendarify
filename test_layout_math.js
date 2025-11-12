// Test script to debug IF node placement math
// Simulates the layout logic from dashboard/editor/index.html

const TOP_STEP = 200;
const NODE_WIDTH = 320;
const LEFT_STEP = 400;

// Simulate nodes based on user's data
const nodes = [
  { id: 'node-1', type: 'trigger', data: { type: 'trigger' }, element: { style: { top: '0px', left: '0px' } } },
  { id: 'node-2', type: 'action', data: { type: 'action', properties: {} }, element: { style: { top: '200px', left: '0px' } } },
  { id: 'node-3', type: 'action', data: { type: 'action', properties: {} }, element: { style: { top: '400px', left: '0px' } } },
  { id: 'node-4', type: 'action', data: { type: 'True', properties: { parentIfId: 'if-1' } }, element: { style: { top: '600px', left: '-400px' } } },
  { id: 'node-5', type: 'action', data: { type: 'False', properties: { parentIfId: 'if-1' } }, element: { style: { top: '600px', left: '400px' } } },
  { id: 'node-6', type: 'action', data: { type: 'action', properties: { parentIfId: 'if-1', branch: 'true' } }, element: { style: { top: '800px', left: '-400px' } } },
  { id: 'node-7', type: 'action', data: { type: 'action', properties: { joinForIfId: 'if-1' } }, element: { style: { top: '1000px', left: '0px' } } },
  { id: 'node-8', type: 'action', data: { type: 'If', properties: {} }, element: { style: { top: '1200px', left: '0px' } } }, // This is the new IF
];

// Simulate connections
const connections = new Map();
connections.set('conn-1', { from: nodes[0].element, to: nodes[1].element });
connections.set('conn-2', { from: nodes[1].element, to: nodes[2].element });
connections.set('conn-3', { from: nodes[2].element, to: nodes[3].element }); // node-2 to True header (node-4)
connections.set('conn-4', { from: nodes[2].element, to: nodes[4].element }); // node-2 to False header (node-5)
connections.set('conn-5', { from: nodes[5].element, to: nodes[6].element }); // node-6 to join node-7
connections.set('conn-6', { from: nodes[6].element, to: nodes[7].element }); // node-7 (join) to node-8 (new IF)

console.log('=== Testing Layout Math ===\n');

// Simulate the layout loop
function simulateLayout() {
  const actions = nodes.filter(n => n.type !== 'trigger');
  let currentTop = 0 + TOP_STEP; // Start at 200
  
  console.log('Starting layout loop...');
  console.log(`Initial currentTop: ${currentTop}\n`);
  
  for (let i = 0; i < actions.length; i++) {
    const n = actions[i];
    const el = n.element;
    const t = n.data?.type || '';
    
    console.log(`\n--- Processing ${n.id} (type: ${t}) ---`);
    console.log(`Current currentTop: ${currentTop}`);
    
    if (t === 'If') {
      const props = n.data?.properties || {};
      let ifGridLeft = 0;
      
      // Check if it's a plain IF (not in branch, not a join)
      if (!props.parentIfId && !props.joinForIfId) {
        console.log('  -> Plain IF detected (no parentIfId, no joinForIfId)');
        
        // Read current position
        const currentTopStyle = parseFloat(el.style.top || '0') || 0;
        console.log(`  -> Current style.top: ${currentTopStyle}`);
        
        // Check for inbound connections
        let maxInboundTop = -Infinity;
        let foundConnections = [];
        
        for (const c of connections.values()) {
          if (!c || c.to !== el || !c.from) continue;
          const srcNode = nodes.find(n => n.element === c.from);
          if (!srcNode || !srcNode.element) continue;
          const srcTopStyle = parseFloat(srcNode.element.style.top || '0') || 0;
          foundConnections.push({ from: srcNode.id, top: srcTopStyle });
          if (srcTopStyle > maxInboundTop) maxInboundTop = srcTopStyle;
        }
        
        console.log(`  -> Found inbound connections: ${JSON.stringify(foundConnections)}`);
        console.log(`  -> maxInboundTop: ${maxInboundTop}`);
        
        let ifTop = currentTop;
        
        if (Number.isFinite(maxInboundTop) && maxInboundTop >= 0) {
          ifTop = maxInboundTop + TOP_STEP;
          console.log(`  -> Using inbound: ${maxInboundTop} + ${TOP_STEP} = ${ifTop}`);
        } else if (currentTopStyle >= TOP_STEP && Math.abs(currentTopStyle % TOP_STEP) < 10) {
          ifTop = currentTopStyle;
          console.log(`  -> Using current grid-aligned position: ${currentTopStyle}`);
        } else {
          console.log(`  -> Falling back to currentTop: ${currentTop}`);
        }
        
        el.style.top = `${ifTop}px`;
        console.log(`  -> Final IF top: ${ifTop}`);
        
        // Simulate branch placement
        const startY = ifTop + TOP_STEP;
        const endYBase = startY + (TOP_STEP * 2); // Simulate some branch content
        const blockEndY = endYBase;
        currentTop = blockEndY + TOP_STEP;
        console.log(`  -> blockEndY: ${blockEndY}, new currentTop: ${currentTop}`);
      } else {
        console.log('  -> IF in branch or is join, using currentTop');
        el.style.top = `${currentTop}px`;
        const startY = currentTop + TOP_STEP;
        const endYBase = startY + (TOP_STEP * 2);
        const blockEndY = endYBase;
        currentTop = blockEndY + TOP_STEP;
      }
      continue;
    }
    
    // Check if in IF block
    const isInIfBlock = (n.data?.type === 'True' || n.data?.type === 'False') || 
                        (n.data?.properties && n.data?.properties.parentIfId) ||
                        (n.data?.properties && n.data?.properties.joinForIfId);
    
    if (isInIfBlock) {
      console.log('  -> In IF block, skipping linear placement');
    } else {
      console.log('  -> Linear node, placing at currentTop');
      el.style.top = `${currentTop}px`;
      currentTop += TOP_STEP;
      console.log(`  -> New currentTop: ${currentTop}`);
    }
  }
  
  console.log('\n=== Final Node Positions ===');
  nodes.forEach(n => {
    console.log(`${n.id}: top=${n.element.style.top}`);
  });
  
  console.log(`\nFinal currentTop: ${currentTop}`);
  console.log(`Expected node-8 top: 1200`);
  console.log(`Actual node-8 top: ${nodes[7].element.style.top}`);
}

// Also test the normalization pass
function simulateNormalization() {
  console.log('\n\n=== Testing Normalization Pass ===\n');
  
  // Simulate _layout snapshot
  nodes.forEach(n => {
    const top = parseFloat(n.element.style.top || '0') || 0;
    n._layout = { top };
  });
  
  // Find linear nodes (simplified)
  const linearNodes = nodes.filter(n => {
    if (n.type === 'trigger') return false;
    const d = n.data || {};
    const t = d.type || '';
    if (t === 'If') {
      const pIf = d.properties && d.properties.parentIfId;
      const isJoin = d.properties && d.properties.joinForIfId;
      return !pIf && !isJoin;
    }
    if (!t || t === 'True' || t === 'False') return false;
    const p = d.properties || {};
    if (p.joinForIfId) return false;
    return !p.parentIfId;
  });
  
  console.log('Linear nodes:', linearNodes.map(n => n.id));
  
  // Sort by top
  linearNodes.sort((a, b) => {
    const at = a._layout?.top || parseFloat(a.element.style.top || '0') || 0;
    const bt = b._layout?.top || parseFloat(b.element.style.top || '0') || 0;
    return at - bt;
  });
  
  console.log('\nProcessing linear nodes in order:');
  let prevTop = 0;
  
  for (const ln of linearNodes) {
    const ct = ln._layout?.top || parseFloat(ln.element.style.top || '0') || 0;
    console.log(`\n--- ${ln.id} (current top: ${ct}) ---`);
    console.log(`prevTop: ${prevTop}`);
    
    let desired;
    let didUseInbound = false;
    
    const d = ln.data || {};
    if (d.type === 'If' && !(d.properties && (d.properties.parentIfId || d.properties.joinForIfId))) {
      console.log('  -> Plain IF, checking inbound...');
      let maxInboundTop = -Infinity;
      const foundConnections = [];
      
      for (const c of connections.values()) {
        if (!c || c.to !== ln.element || !c.from) continue;
        const srcNode = nodes.find(n => n.element === c.from);
        if (!srcNode || !srcNode.element) continue;
        const srcTop = srcNode._layout?.top || parseFloat(srcNode.element.style.top || '0') || 0;
        foundConnections.push({ from: srcNode.id, top: srcTop });
        if (srcTop > maxInboundTop) maxInboundTop = srcTop;
      }
      
      console.log(`  -> Inbound connections: ${JSON.stringify(foundConnections)}`);
      console.log(`  -> maxInboundTop: ${maxInboundTop}`);
      
      if (Number.isFinite(maxInboundTop) && maxInboundTop >= 0) {
        desired = maxInboundTop + TOP_STEP;
        didUseInbound = true;
        console.log(`  -> Using inbound: ${maxInboundTop} + ${TOP_STEP} = ${desired}`);
        desired = Math.max(desired, prevTop + TOP_STEP);
        console.log(`  -> After monotonic check: ${desired}`);
      }
    }
    
    if (!didUseInbound) {
      desired = Math.max(TOP_STEP, Math.ceil(ct / TOP_STEP) * TOP_STEP);
      console.log(`  -> Using ceil to grid: ${desired}`);
      desired = Math.max(desired, prevTop + TOP_STEP);
      console.log(`  -> After monotonic check: ${desired}`);
    }
    
    ln.element.style.top = `${desired}px`;
    prevTop = desired;
    console.log(`  -> Final top: ${desired}`);
  }
  
  console.log('\n=== After Normalization ===');
  nodes.forEach(n => {
    console.log(`${n.id}: top=${n.element.style.top}`);
  });
}

// Run tests
simulateLayout();
simulateNormalization();

