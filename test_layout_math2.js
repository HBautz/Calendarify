// Test script to debug what happens when currentTop is already high
// This simulates the scenario where nodes are processed in a different order

const TOP_STEP = 200;

// Simulate the problematic scenario
console.log('=== Testing High currentTop Scenario ===\n');

// Simulate what happens if currentTop is already 1800 when we process the IF
let currentTop = 1800;
const ifNode = {
  id: 'node-8',
  type: 'action',
  data: { type: 'If', properties: {} },
  element: { style: { top: '1200px', left: '0px' } }
};

// Simulate connections (but what if they don't exist yet?)
const connections = new Map();
// Connection might not exist yet when layout runs!
// connections.set('conn-1', { from: { id: 'node-7' }, to: ifNode.element });

console.log(`Starting with currentTop: ${currentTop}`);
console.log(`IF node current style.top: ${ifNode.element.style.top}`);
console.log(`Connections exist: ${connections.size > 0}\n`);

// Simulate the layout logic
const props = ifNode.data?.properties || {};
let ifTop = currentTop; // Default to currentTop

if (!props.parentIfId && !props.joinForIfId) {
  console.log('Plain IF detected');
  
  // Read current position
  const currentTopStyle = parseFloat(ifNode.element.style.top || '0') || 0;
  const currentTopLocal = currentTopStyle; // Simplified for test
  console.log(`  currentTopStyle: ${currentTopStyle}`);
  console.log(`  currentTopLocal: ${currentTopLocal}`);
  
  // Check for inbound connections
  let maxInboundTop = -Infinity;
  let foundAny = false;
  
  for (const c of connections.values()) {
    if (!c || c.to !== ifNode.element || !c.from) continue;
    foundAny = true;
    const srcTopStyle = parseFloat(c.from.style?.top || '0') || 0;
    if (srcTopStyle > maxInboundTop) maxInboundTop = srcTopStyle;
  }
  
  console.log(`  Found connections: ${foundAny}`);
  console.log(`  maxInboundTop: ${maxInboundTop}`);
  
  if (Number.isFinite(maxInboundTop) && maxInboundTop >= 0) {
    ifTop = maxInboundTop + TOP_STEP;
    console.log(`  -> Using inbound: ${maxInboundTop} + ${TOP_STEP} = ${ifTop}`);
  } else if (currentTopLocal >= TOP_STEP && Math.abs(currentTopLocal % TOP_STEP) < 10) {
    ifTop = currentTopLocal;
    console.log(`  -> Using current grid-aligned position: ${currentTopLocal}`);
  } else {
    console.log(`  -> Falling back to currentTop: ${currentTop}`);
  }
}

ifNode.element.style.top = `${ifTop}px`;
console.log(`\nFinal IF top: ${ifTop}`);
console.log(`Expected: 1200`);
console.log(`Result: ${ifTop === 1200 ? 'CORRECT' : 'WRONG'}`);

// Now test what happens if the node's position is NOT grid-aligned
console.log('\n\n=== Testing Non-Grid-Aligned Position ===\n');
ifNode.element.style.top = '1234px'; // Not grid-aligned
currentTop = 1800;

ifTop = currentTop;
const currentTopStyle2 = parseFloat(ifNode.element.style.top || '0') || 0;
const currentTopLocal2 = currentTopStyle2;

console.log(`currentTop: ${currentTop}`);
console.log(`currentTopLocal: ${currentTopLocal2}`);
console.log(`Is grid-aligned? ${Math.abs(currentTopLocal2 % TOP_STEP) < 10}`);

if (Number.isFinite(maxInboundTop) && maxInboundTop >= 0) {
  ifTop = maxInboundTop + TOP_STEP;
} else if (currentTopLocal2 >= TOP_STEP && Math.abs(currentTopLocal2 % TOP_STEP) < 10) {
  ifTop = currentTopLocal2;
} else {
  console.log(`  -> Falling back to currentTop: ${currentTop}`);
}

console.log(`Final IF top: ${ifTop}`);

// Test what happens if we process nodes in wrong order
console.log('\n\n=== Testing Node Processing Order ===\n');

const nodes = [
  { id: 'node-2', element: { style: { top: '200px' } }, data: { type: 'action', properties: {} } },
  { id: 'node-3', element: { style: { top: '400px' } }, data: { type: 'action', properties: {} } },
  { id: 'node-7', element: { style: { top: '1000px' } }, data: { type: 'action', properties: { joinForIfId: 'if-1' } } },
  { id: 'node-8', element: { style: { top: '1200px' } }, data: { type: 'If', properties: {} } },
];

// What if node-8 is processed BEFORE node-7 in the actions array?
console.log('Processing nodes in order: node-2, node-3, node-8, node-7');
let ct = TOP_STEP;

for (const n of nodes) {
  const t = n.data?.type || '';
  console.log(`\nProcessing ${n.id} (type: ${t}), currentTop: ${ct}`);
  
  if (t === 'If') {
    const props = n.data?.properties || {};
    if (!props.parentIfId && !props.joinForIfId) {
      const currentTopLocal = parseFloat(n.element.style.top || '0') || 0;
      console.log(`  Plain IF, current position: ${currentTopLocal}`);
      
      // Check connections - but node-7 hasn't been processed yet!
      let maxInboundTop = -Infinity;
      // Simulate: connection from node-7 to node-8 exists, but node-7's position might not be final yet
      const srcNode = nodes.find(n2 => n2.id === 'node-7');
      if (srcNode) {
        const srcTop = parseFloat(srcNode.element.style.top || '0') || 0;
        maxInboundTop = srcTop;
        console.log(`  Found source node-7 at: ${srcTop}`);
      }
      
      let ifTop = ct;
      if (Number.isFinite(maxInboundTop) && maxInboundTop >= 0) {
        ifTop = maxInboundTop + TOP_STEP;
        console.log(`  Using inbound: ${maxInboundTop} + ${TOP_STEP} = ${ifTop}`);
      } else if (currentTopLocal >= TOP_STEP && Math.abs(currentTopLocal % TOP_STEP) < 10) {
        ifTop = currentTopLocal;
        console.log(`  Using current position: ${currentTopLocal}`);
      } else {
        console.log(`  Falling back to currentTop: ${ct}`);
      }
      
      n.element.style.top = `${ifTop}px`;
      ct = ifTop + (TOP_STEP * 3); // Simulate branch end
    }
  } else {
    const isInIfBlock = (n.data?.properties && n.data?.properties.joinForIfId);
    if (!isInIfBlock) {
      n.element.style.top = `${ct}px`;
      ct += TOP_STEP;
    }
  }
}

console.log('\nFinal positions:');
nodes.forEach(n => {
  console.log(`  ${n.id}: ${n.element.style.top}`);
});

