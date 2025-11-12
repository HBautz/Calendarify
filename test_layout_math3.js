// Test script to simulate the FULL layout with IF blocks and see where currentTop goes wrong

const TOP_STEP = 200;

// Simulate the actual node structure from user's data
const nodes = [
  { id: 'node-1', type: 'trigger', data: { type: 'trigger' }, element: { style: { top: '0px' } } },
  { id: 'node-2', type: 'action', data: { type: 'action', properties: {} }, element: { style: { top: '200px' } } },
  { id: 'node-3', type: 'action', data: { type: 'action', properties: {} }, element: { style: { top: '400px' } } },
  // IF block starts here (node-2 is the IF, but we don't have it in the data, so let's assume node-3 connects to an IF)
  // Actually, looking at the data, node-4 and node-5 are True/False headers
  { id: 'node-4', type: 'action', data: { type: 'True', properties: { parentIfId: 'if-1' } }, element: { style: { top: '600px' } } },
  { id: 'node-5', type: 'action', data: { type: 'False', properties: { parentIfId: 'if-1' } }, element: { style: { top: '600px' } } },
  { id: 'node-6', type: 'action', data: { type: 'action', properties: { parentIfId: 'if-1', branch: 'true' } }, element: { style: { top: '800px' } } },
  { id: 'node-7', type: 'action', data: { type: 'action', properties: { joinForIfId: 'if-1' } }, element: { style: { top: '1000px' } } },
  { id: 'node-8', type: 'action', data: { type: 'If', properties: {} }, element: { style: { top: '1200px' } } }, // New IF
];

// We need to find the IF node that created the block
// Let's assume there's an IF node between node-3 and node-4
const ifNode = {
  id: 'if-node-1',
  type: 'action',
  data: { type: 'If', properties: { ifId: 'if-1' } },
  element: { style: { top: '400px' } }
};

console.log('=== Simulating Full Layout Loop ===\n');

const actions = nodes.filter(n => n.type !== 'trigger');
let currentTop = 0 + TOP_STEP; // Start at 200

console.log(`Initial currentTop: ${currentTop}\n`);

// Simulate processing each action
for (let i = 0; i < actions.length; i++) {
  const n = actions[i];
  const t = n.data?.type || '';
  
  console.log(`\n--- Processing ${n.id} (type: ${t}) ---`);
  console.log(`  currentTop before: ${currentTop}`);
  
  // Check if in IF block
  const isInIfBlock = (t === 'True' || t === 'False') || 
                      (n.data?.properties && n.data?.properties.parentIfId) ||
                      (n.data?.properties && n.data?.properties.joinForIfId);
  
  if (t === 'If') {
    const props = n.data?.properties || {};
    console.log(`  -> IF node detected`);
    console.log(`  -> parentIfId: ${props.parentIfId}, joinForIfId: ${props.joinForIfId}`);
    
    if (!props.parentIfId && !props.joinForIfId) {
      console.log(`  -> Plain IF (no parent, no join)`);
      
      // Read current position
      const currentTopStyle = parseFloat(n.element.style.top || '0') || 0;
      console.log(`  -> Current style.top: ${currentTopStyle}`);
      
      // Check for inbound (simplified - no connections in this test)
      let maxInboundTop = -Infinity;
      // In real code, this would check WorkflowManager.connections
      
      let ifTop = currentTop;
      
      if (Number.isFinite(maxInboundTop) && maxInboundTop >= 0) {
        ifTop = maxInboundTop + TOP_STEP;
        console.log(`  -> Using inbound: ${ifTop}`);
      } else if (currentTopStyle >= TOP_STEP && Math.abs(currentTopStyle % TOP_STEP) < 10) {
        ifTop = currentTopStyle;
        console.log(`  -> Using current grid-aligned position: ${ifTop}`);
      } else {
        console.log(`  -> Falling back to currentTop: ${ifTop}`);
      }
      
      n.element.style.top = `${ifTop}px`;
      console.log(`  -> Set IF top to: ${ifTop}`);
      
      // Simulate branch placement
      const startY = ifTop + TOP_STEP;
      const endYBase = startY + (TOP_STEP * 2); // Simulate branches
      const blockEndY = endYBase;
      currentTop = blockEndY + TOP_STEP;
      console.log(`  -> blockEndY: ${blockEndY}, new currentTop: ${currentTop}`);
    } else {
      console.log(`  -> IF in branch, using currentTop`);
      n.element.style.top = `${currentTop}px`;
      const startY = currentTop + TOP_STEP;
      const endYBase = startY + (TOP_STEP * 2);
      const blockEndY = endYBase;
      currentTop = blockEndY + TOP_STEP;
    }
    continue;
  }
  
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
nodes.forEach(n => {
  console.log(`${n.id}: ${n.element.style.top}`);
});
console.log(`\nFinal currentTop: ${currentTop}`);
console.log(`node-8 expected: 1200px`);
console.log(`node-8 actual: ${nodes[7].element.style.top}`);

// Now let's see what happens if we process an IF block BEFORE node-8
console.log('\n\n=== Testing IF Block Processing ===\n');
console.log('If there was an IF block before node-8, currentTop would be advanced.');
console.log('Let\'s simulate: IF at 400, branches end at 1000, join at 1000');
console.log('After IF block: currentTop = 1000 + 200 = 1200');
console.log('Then node-8 (new IF) is processed with currentTop = 1200');
console.log('But wait - if node-7 (join) is processed as part of the IF block,');
console.log('and the block ends at 1000, then currentTop = 1200');
console.log('Then node-8 should use its inbound connection (node-7 at 1000) -> 1200');
console.log('OR use its current position (1200) -> 1200');
console.log('So it should work... unless currentTop is somehow 1800?');

// Let's check: what if the IF block processing advances currentTop incorrectly?
console.log('\n=== What if IF block advances currentTop too far? ===\n');
let ct = 200;
console.log('Start: currentTop = 200');
console.log('Process node-2 (linear): currentTop = 400');
console.log('Process node-3 (linear): currentTop = 600');
console.log('Process IF block (if it exists):');
console.log('  - IF at 600');
console.log('  - True/False at 800');
console.log('  - Branches...');
console.log('  - Join at 1000');
console.log('  - blockEndY = 1000');
console.log('  - currentTop = 1000 + 200 = 1200');
console.log('Process node-8 (new IF):');
console.log('  - currentTop = 1200');
console.log('  - Should use inbound (node-7 at 1000) -> 1200');
console.log('  - OR use current position (1200) -> 1200');
console.log('  - Result: 1200 ✓');
console.log('\nBut user sees 1800...');
console.log('1800 = 9 * 200');
console.log('So currentTop must be 1600 when node-8 is processed');
console.log('1600 = 8 * 200');
console.log('This suggests 8 nodes were processed before node-8');
console.log('But we only have 7 action nodes before node-8...');
console.log('Unless the IF block itself counts as advancing currentTop multiple times?');

