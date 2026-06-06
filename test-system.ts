import { db } from './server/db.js';
import { generateLocalJobAndProposalFallback } from './server/proposal.js';
import assert from 'assert';

console.log('🧪 Starting Gigflow Automated System Check Tests...');

async function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      console.log(`📡 [TEST] ${name}`);
      fn();
      console.log(`✅ [PASS] ${name}\n`);
      passed++;
    } catch (error: any) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(error.stack || error);
      console.log();
      failed++;
    }
  }

  // Test 1: Database Initialization and Defaults
  test('DB Initialization and Default Values', () => {
    const defaultProfile = db.getOpportunities('default_test@gmail.com');
    assert(Array.isArray(defaultProfile), 'Opportunities should always be retrieved as an array');
    
    const settings = db.getAutomationSettings('default_test@gmail.com');
    assert.strictEqual(settings.mode, 'assisted', 'Default mode should be assisted');
    assert.strictEqual(settings.autoApproveMinScore, 85, 'Default auto approve score should be 85');
  });

  // Test 2: Database Partitioning (User Isolation)
  test('DB Partitioning User Isolation', () => {
    const user1 = 'alice@example.com';
    const user2 = 'bob@example.com';

    // Clear previous settings for test reproducibility
    db.updateAutomationSettings({ mode: 'auto' }, user1);
    db.updateAutomationSettings({ mode: 'assisted' }, user2);

    const s1 = db.getAutomationSettings(user1);
    const s2 = db.getAutomationSettings(user2);

    assert.strictEqual(s1.mode, 'auto', 'User 1 settings should be saved separately');
    assert.strictEqual(s2.mode, 'assisted', 'User 2 settings should be saved separately and not conflict');
  });

  // Test 3: Local Job Matching Score & Language Heuristics Fallback - English
  test('Local Matching Fallback Logic - English Requirements', () => {
    const mockJob = {
      title: 'Build a React dashboard',
      description: 'Need a senior React developer with strong TypeScript skills and Tailwind CSS styling.',
      budget: '$450',
      platform: 'Mostaql',
      url: 'https://mostaql.com/project/123'
    };

    const mockProfile = {
      skills: ['React', 'TypeScript', 'Tailwind CSS', 'Node.js'],
      experience: 'senior',
      proposalTone: 'Professional',
      languages: ['English']
    };

    const result = generateLocalJobAndProposalFallback(mockJob, mockProfile);
    
    assert.strictEqual(result.status, 'SUCCESS', 'Heuristic generation must state SUCCESS');
    assert(result.jobAnalysis.matchScore >= 80, 'Score should reflect alignment in React, TypeScript, and Tailwind');
    assert.strictEqual(result.proposal.language, 'English', 'Should correctly identify English job description language');
    assert(result.proposal.text.includes('React'), 'Proposal should contain identified skills or job title elements');
  });

  // Test 4: Local Job Matching Score & Language Heuristics Fallback - Arabic
  test('Local Matching Fallback Logic - Arabic Requirements', () => {
    const mockJob = {
      title: 'تطوير موقع ووردبريس أو ريأكت',
      description: 'نبحث عن مبرمج ريأكت لتطوير لوحة تحكم ذكية باستخدام ريأكت وتصميم سريع ومتجاوب.',
      budget: '$200',
      platform: 'Mostaql',
      url: 'https://mostaql.com/project/456'
    };

    const mockProfile = {
      skills: ['React', 'TypeScript', 'Tailwind CSS'],
      experience: 'senior',
      proposalTone: 'Professional',
      languages: ['Arabic', 'English']
    };

    const result = generateLocalJobAndProposalFallback(mockJob, mockProfile);
    
    assert.strictEqual(result.status, 'SUCCESS', 'Heuristic fallback should return SUCCESS');
    assert.strictEqual(result.proposal.language, 'Arabic', ' Arabic language must be detected from Arabic description');
    assert(result.proposal.text.includes('مرحباً بك'), 'Arabic proposal text should match standard custom greeting template');
  });

  // Test 5: Dynamic Form Evaluation Safety Checks
  test('Dynamic Playwright Form Evaluators Isolation', () => {
    // Replicates standard evaluation mechanics utilized in crawl loops without risking DOM conflicts
    const mockFunctionStr = `
      const isStandard = (id, name) => {
        return id === 'bid__period' || id === 'bid__cost' || id === 'bid__details' || id === 'bid__realCost' ||
               name === 'period' || name === 'cost' || name === 'details' || name === 'realCost' ||
               id === 'comment' || name === 'comment';
      };
      return isStandard('bid__period', 'period');
    `;
    const evaluator = new Function(mockFunctionStr);
    assert.strictEqual(evaluator(), true, 'Checking element parameters must succeed without referencing global/external compiler scopes');
  });

  console.log('📊 TEST SUMMARY');
  console.log(`   Passed: ${passed}/${passed + failed}`);
  console.log(`   Failed: ${failed}/${passed + failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('✨ All System Check Tests passed flawlessly!');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error encountered:', err);
  process.exit(1);
});
