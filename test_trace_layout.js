// Comprehensive test to trace exactly what happens in the layout

const TOP_STEP = 200;
const VERTICAL_SPACING = 200;

// Simulate the exact scenario: node-7 (join) at 1000, node-8 (new IF) should be at 1200
console.log('=== Tracing Layout Execution ===\n');

// Simulate nodes in the order they appear in the actions array
const actions = [
  { id: 'node-2', type: 'action', data: { type: 'action', properties: {} }, element: { style: { top: '200px' } } },
  { id: 'node-3', type: 'action', data: { type: 'action', properties: {} }, element: { style: { top: '400px' } } },
  // There must be an IF node here that creates the block with node-4, node-5, node-6, node-7
  { id: 'if-1', type: 'action', data: { type: 'If', properties: { ifId: 'if-1' } }, element: { style: { top: '400px' } } },
  { id: 'node-4', type: 'action', data: { type: 'True', properties: { parentIfId: 'if-1' } }, element: { style: { top: '600px' } } },
  { id: 'node-5', type: 'action', data: { type: 'False', properties: { parentIfId: 'if-1' } }, element: { style: { top: '600px' } } },
  { id: 'node-6', type: 'action', data: { type: 'action', properties: { parentIfId: 'if-1', branch: 'true' } }, element: { style: { top: '800px' } } },
  { id: 'node-7', type: 'action', data: { type: 'action', properties: { joinForIfId: 'if-1' } }, element: { style: { top: '1000px' } } },
  { id: 'node-8', type: 'action', data: { type: 'If', properties: {} }, element: { style: { top: '1200px' } } }, // New IF
];

let currentTop = 0 + TOP_STEP; // Start at 200

console.log(`Initial currentTop: ${currentTop}\n`);

for (let i = 0; i < actions.length; i++) {
  const n = actions[i];
  const t = n.data?.type || '';
  
  console.log(`\n--- Step ${i+1}: Processing ${n.id} (type: ${t}) ---`);
  console.log(`  currentTop before: ${currentTop}`);
  
  if (t === 'If') {
    const props = n.data?.properties || {};
    console.log(`  -> IF node`);
    
    if (!props.parentIfId && !props.joinForIfId) {
      console.log(`  -> Plain IF (no parent, no join)`);
      
      // Check if this is the first IF (if-1) or the new one (node-8)
      if (n.id === 'if-1') {
        console.log(`  -> This is the first IF block`);
        // Place IF at currentTop
        n.element.style.top = `${currentTop}px`;
        const startY = currentTop + TOP_STEP; // 400
        let yTrue = startY; // 400
        let yFalse = startY; // 400
        
        // Place True header
        const trueNode = actions.find(a => a.id === 'node-4');
        if (trueNode) {
          trueNode.element.style.top = `${yTrue}px`;
          yTrue += TOP_STEP; // 600
        }
        
        // Place False header
        const falseNode = actions.find(a => a.id === 'node-5');
        if (falseNode) {
          falseNode.element.style.top = `${yFalse}px`;
          yFalse += TOP_STEP; // 600
        }
        
        // Place branch nodes
        const branchNode = actions.find(a => a.id === 'node-6');
        if (branchNode) {
          branchNode.element.style.top = `${yTrue}px`;
          yTrue += TOP_STEP; // 800
        }
        
        const endYBase = Math.max(yTrue, yFalse); // 800
        let blockEndY = endYBase; // 800
        
        // Place join node
        const joinNode = actions.find(a => a.id === 'node-7');
        if (joinNode) {
          joinNode.element.style.top = `${blockEndY}px`; // 800
          // OLD: blockEndY += getHeight(joinNode) + VERTICAL_SPACING;
          // NEW: blockEndY += TOP_STEP;
          blockEndY += TOP_STEP; // 1000
          console.log(`  -> Placed join at ${joinNode.element.style.top}, blockEndY now: ${blockEndY}`);
        }
        
        currentTop = blockEndY + TOP_STEP; // 1000 + 200 = 1200
        console.log(`  -> blockEndY: ${blockEndY}, new currentTop: ${currentTop}`);
      } else {
        // This is node-8 (new IF)
        console.log(`  -> This is the new IF (node-8)`);
        const currentTopStyle = parseFloat(n.element.style.top || '0') || 0;
        console.log(`  -> Current style.top: ${currentTopStyle}`);
        
        // Check for inbound connections
        let maxInboundTop = -Infinity;
        // Simulate: connection from node-7 to node-8
        const srcNode = actions.find(a => a.id === 'node-7');
        if (srcNode) {
          const srcTop = parseFloat(srcNode.element.style.top || '0') || 0;
          maxInboundTop = srcTop;
          console.log(`  -> Found inbound from node-7 at: ${srcTop}`);
        }
        
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
        
        n.element.style.top = `${ifTop}px`;
        console.log(`  -> Final IF top: ${ifTop}`);
        
        const startY = ifTop + TOP_STEP;
        const endYBase = startY + (TOP_STEP * 2);
        const blockEndY = endYBase;
        currentTop = blockEndY + TOP_STEP;
        console.log(`  -> blockEndY: ${blockEndY}, new currentTop: ${currentTop}`);
      }
      continue;
    }
  }
  
  // Check if in IF block
  const isInIfBlock = (t === 'True' || t === 'False') || 
                      (n.data?.properties && n.data?.properties.parentIfId) ||
                      (n.data?.properties && n.data?.properties.joinForIfId);
  
  if (isInIfBlock) {
    console.log(`  -> In IF block, skipping`);
  } else {
    console.log(`  -> Linear node, placing at currentTop`);
    n.element.style.top = `${currentTop}px`;
    currentTop += TOP_STEP;
    console.log(`  -> New currentTop: ${currentTop}`);
  }
}

console.log('\n=== Final Positions ===');
actions.forEach(n => {
  console.log(`${n.id}: ${n.element.style.top}`);
});
console.log(`\nFinal currentTop: ${currentTop}`);
console.log(`Expected node-8 top: 1200px`);
console.log(`Actual node-8 top: ${actions.find(a => a.id === 'node-8')?.element.style.top}`);

// Now test what happens if the join node placement used the OLD formula
console.log('\n\n=== Testing OLD Join Placement Formula ===\n');
let blockEndY = 800; // After branches
console.log(`blockEndY after branches: ${blockEndY}`);
console.log(`Placing join node...`);
// Simulate: join node height = 100px (typical)
const joinHeight = 100;
blockEndY += joinHeight + VERTICAL_SPACING; // 800 + 100 + 200 = 1100
console.log(`blockEndY after join (OLD): ${blockEndY}`);
let ct = blockEndY + TOP_STEP; // 1100 + 200 = 1300
console.log(`currentTop would be: ${ct}`);
console.log(`\nBut wait, if join is at 1000, and blockEndY = 1000, then:`);
blockEndY = 1000;
blockEndY += joinHeight + VERTICAL_SPACING; // 1000 + 100 + 200 = 1300
ct = blockEndY + TOP_STEP; // 1300 + 200 = 1500
console.log(`blockEndY: ${blockEndY}, currentTop: ${ct}`);
console.log(`Still not 1800...`);

// What if there are multiple joins?
console.log(`\nWhat if there are 2 join nodes?`);
blockEndY = 1000;
blockEndY += joinHeight + VERTICAL_SPACING; // 1300
blockEndY += joinHeight + VERTICAL_SPACING; // 1600
ct = blockEndY + TOP_STEP; // 1800
console.log(`blockEndY: ${blockEndY}, currentTop: ${ct}`);
console.log(`AHA! If there are 2 join nodes, currentTop becomes 1800!`);

