#!/usr/bin/env npx ts-node

/**
 * Foundation Analysis Validation Script
 *
 * This script validates that foundation analysis has been completed
 * before allowing phase implementation to proceed.
 *
 * Usage:
 *   npx ts-node scripts/validate-foundation.ts [phase-number]
 *   npm run validate:foundation -- 8
 *
 * Exit codes:
 *   0 - Validation passed
 *   1 - Validation failed
 */

import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

interface FoundationChecklist {
  phase: string;
  name: string;
  status: 'incomplete' | 'complete' | 'approved';
  sections: {
    name: string;
    required: boolean;
    completed: boolean;
  }[];
}

const REQUIRED_SECTIONS = [
  { name: 'Prerequisites Assessment', required: true },
  { name: 'Platform Impact Assessment', required: true },
  { name: 'Architecture Impact', required: true },
  { name: 'Performance Analysis', required: true },
  { name: 'Security Considerations', required: true },
  { name: 'Rollback Strategy', required: true },
  { name: 'Design System Compliance', required: true },
  { name: 'Testing Strategy', required: true },
  { name: 'Sign-Off', required: true },
];

const PLATFORM_REQUIREMENTS = [
  'macOS',
  'Windows',
  'Linux',
];

function parseChecklistFile(content: string): FoundationChecklist {
  const lines = content.split('\n');

  // Extract phase info from header
  const phaseMatch = content.match(/# Phase (\d+(?:\.\d+)?): (.+?) - Foundation Analysis/);
  const phase = phaseMatch?.[1] || 'unknown';
  const name = phaseMatch?.[2] || 'Unknown Phase';

  // Check status
  let status: 'incomplete' | 'complete' | 'approved' = 'incomplete';
  if (content.includes('[x] Approved') || content.includes('[X] Approved')) {
    status = 'approved';
  } else if (content.includes('[x] Complete') || content.includes('[X] Complete')) {
    status = 'complete';
  }

  // Check each required section
  const sections = REQUIRED_SECTIONS.map((section) => {
    const sectionRegex = new RegExp(`## \\d+\\.? ?${section.name}`, 'i');
    const sectionExists = sectionRegex.test(content);

    // Check if checkboxes in this section are completed
    const sectionStart = content.search(sectionRegex);
    if (sectionStart === -1) {
      return { ...section, completed: false };
    }

    // Find next section
    const nextSectionMatch = content.slice(sectionStart + 10).search(/^## \d+/m);
    const sectionEnd = nextSectionMatch === -1
      ? content.length
      : sectionStart + 10 + nextSectionMatch;

    const sectionContent = content.slice(sectionStart, sectionEnd);

    // Count checkboxes
    const uncheckedBoxes = (sectionContent.match(/- \[ \]/g) || []).length;
    const checkedBoxes = (sectionContent.match(/- \[x\]/gi) || []).length;

    // Section is completed if there are checkboxes and all are checked
    // OR if there are no checkboxes (narrative section)
    const hasCheckboxes = uncheckedBoxes + checkedBoxes > 0;
    const completed = !hasCheckboxes || uncheckedBoxes === 0;

    return {
      ...section,
      completed,
    };
  });

  return { phase, name, status, sections };
}

function validatePlatformCoverage(content: string): string[] {
  const errors: string[] = [];

  for (const platform of PLATFORM_REQUIREMENTS) {
    const platformMentioned = content.toLowerCase().includes(platform.toLowerCase());
    const platformSectionRegex = new RegExp(`\\[.\\] ${platform}:`, 'i');
    const hasCheckbox = platformSectionRegex.test(content);

    if (!platformMentioned && !hasCheckbox) {
      errors.push(`Platform not addressed: ${platform}`);
    }
  }

  return errors;
}

function validateFoundation(phaseNumber: string): ValidationResult {
  const result: ValidationResult = {
    passed: false,
    errors: [],
    warnings: [],
  };

  // Find foundation checklist for this phase
  const foundationsDir = path.join(process.cwd(), '.planning', 'foundations');
  const phaseDir = path.join(foundationsDir, `phase-${phaseNumber}`);
  const checklistPath = path.join(phaseDir, 'FOUNDATION_CHECKLIST.md');

  // Check if foundation directory exists
  if (!fs.existsSync(phaseDir)) {
    result.errors.push(`Foundation directory not found: ${phaseDir}`);
    result.errors.push(`Create foundation analysis before implementing phase ${phaseNumber}`);
    return result;
  }

  // Check if checklist exists
  if (!fs.existsSync(checklistPath)) {
    result.errors.push(`Foundation checklist not found: ${checklistPath}`);
    result.errors.push(`Copy template from .planning/FOUNDATION_ANALYSIS.md`);
    return result;
  }

  // Parse and validate checklist
  const content = fs.readFileSync(checklistPath, 'utf-8');
  const checklist = parseChecklistFile(content);

  console.log(`\nValidating Phase ${checklist.phase}: ${checklist.name}`);
  console.log('='.repeat(50));

  // Check required sections
  for (const section of checklist.sections) {
    if (section.required && !section.completed) {
      result.errors.push(`Incomplete section: ${section.name}`);
    } else if (section.completed) {
      console.log(`  ✓ ${section.name}`);
    } else {
      console.log(`  ○ ${section.name} (optional)`);
    }
  }

  // Validate platform coverage
  const platformErrors = validatePlatformCoverage(content);
  result.errors.push(...platformErrors);

  // Check status
  if (checklist.status === 'incomplete') {
    result.warnings.push('Foundation status is "incomplete" - mark as complete when ready');
  } else if (checklist.status === 'complete') {
    result.warnings.push('Foundation marked complete but not yet approved');
  }

  // Determine if validation passed
  result.passed = result.errors.length === 0;

  return result;
}

function printResult(result: ValidationResult): void {
  console.log('\n' + '='.repeat(50));

  if (result.errors.length > 0) {
    console.log('\n❌ VALIDATION FAILED\n');
    console.log('Errors:');
    for (const error of result.errors) {
      console.log(`  • ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of result.warnings) {
      console.log(`  ⚠ ${warning}`);
    }
  }

  if (result.passed) {
    console.log('\n✅ VALIDATION PASSED\n');
    console.log('Foundation analysis is complete. Implementation can proceed.');
  } else {
    console.log('\n🛑 Implementation blocked until foundation analysis is complete.\n');
  }
}

function listPendingFoundations(): void {
  const foundationsDir = path.join(process.cwd(), '.planning', 'foundations');

  if (!fs.existsSync(foundationsDir)) {
    console.log('No foundations directory found.');
    return;
  }

  console.log('\nFoundation Analysis Status:');
  console.log('='.repeat(50));

  const entries = fs.readdirSync(foundationsDir);
  const phaseDirs = entries.filter((e) =>
    e.startsWith('phase-') && fs.statSync(path.join(foundationsDir, e)).isDirectory()
  );

  if (phaseDirs.length === 0) {
    console.log('No phase foundations found.');
    return;
  }

  for (const phaseDir of phaseDirs) {
    const checklistPath = path.join(foundationsDir, phaseDir, 'FOUNDATION_CHECKLIST.md');

    if (fs.existsSync(checklistPath)) {
      const content = fs.readFileSync(checklistPath, 'utf-8');
      const checklist = parseChecklistFile(content);

      const icon = checklist.status === 'approved' ? '✅' :
        checklist.status === 'complete' ? '🔄' : '❌';

      console.log(`  ${icon} ${phaseDir}: ${checklist.name} [${checklist.status}]`);
    } else {
      console.log(`  ⚠️  ${phaseDir}: No checklist found`);
    }
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--list') {
  listPendingFoundations();
  process.exit(0);
}

if (args[0] === '--help') {
  console.log(`
Foundation Analysis Validator

Usage:
  npx ts-node scripts/validate-foundation.ts [phase-number]
  npx ts-node scripts/validate-foundation.ts --list
  npx ts-node scripts/validate-foundation.ts --help

Arguments:
  phase-number   The phase number to validate (e.g., 8, 5.1)
  --list         Show status of all phase foundations
  --help         Show this help message

Examples:
  npx ts-node scripts/validate-foundation.ts 8
  npm run validate:foundation -- 8
`);
  process.exit(0);
}

const phaseNumber = args[0];
const result = validateFoundation(phaseNumber);
printResult(result);
process.exit(result.passed ? 0 : 1);
