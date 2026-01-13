#!/usr/bin/env tsx
/**
 * Lender Matrix Extractor using Groq
 *
 * Uses Groq's fast LLM inference to extract lender pricing matrices
 * from PDFs or rate sheet text and convert them to our JSON schema.
 *
 * Usage:
 *   npx tsx scripts/extract_lender_matrix.ts --input rate_sheet.txt --lender "New Lender"
 *   npx tsx scripts/extract_lender_matrix.ts --input rate_sheet.txt --lender "New Lender" --output config/new_lender.json
 *
 * Environment:
 *   GROQ_API_KEY - Required for Groq API access
 *
 * The extractor:
 * 1. Reads the input file (text/PDF content)
 * 2. Sends to Groq for structured extraction
 * 3. Validates output against our schema
 * 4. Saves with needsReview: true flag for human verification
 */

import * as fs from 'fs';
import * as path from 'path';
import Groq from 'groq-sdk';

// Schema validation
import { validateLenderSchema, createDefaultLenderSchema } from '../shared/underwriting/lenders/schema';
import type { LenderSchema, LenderTierConfig, VehicleRiskAdjustment } from '../shared/underwriting/types';

// Parse command line arguments
const args = process.argv.slice(2);
const inputIndex = args.findIndex(a => a === '--input' || a === '-i');
const lenderIndex = args.findIndex(a => a === '--lender' || a === '-l');
const outputIndex = args.findIndex(a => a === '--output' || a === '-o');

const inputFile = inputIndex >= 0 ? args[inputIndex + 1] : null;
const lenderName = lenderIndex >= 0 ? args[lenderIndex + 1] : null;
const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : null;

if (!inputFile || !lenderName) {
  console.error('Usage: npx tsx scripts/extract_lender_matrix.ts --input <file> --lender <name>');
  console.error('');
  console.error('Options:');
  console.error('  --input, -i   Input file (rate sheet text or extracted PDF content)');
  console.error('  --lender, -l  Lender name for the output config');
  console.error('  --output, -o  Output file path (optional, defaults to config/<id>.json)');
  console.error('');
  console.error('Environment:');
  console.error('  GROQ_API_KEY  Required for Groq API access');
  process.exit(1);
}

// Check for API key
const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error('Error: GROQ_API_KEY environment variable is required');
  console.error('');
  console.error('Get your API key from: https://console.groq.com/keys');
  console.error('Then set it: export GROQ_API_KEY=your_key_here');
  process.exit(1);
}

// Initialize Groq client
const groq = new Groq({
  apiKey: apiKey,
});

const EXTRACTION_PROMPT = `You are a financial data extraction assistant. Your task is to extract lender pricing and eligibility information from the provided rate sheet or documentation and convert it to a structured JSON format.

Extract the following information:

1. **Credit Tiers**: Look for FICO score ranges or tier names (deep subprime, subprime, near prime, prime) and their associated:
   - APR ranges (min and max)
   - Minimum down payment percentages
   - Maximum LTV percentages
   - Advance percentages (base and max)

2. **Loan Parameters**:
   - Allowed loan terms (in months)
   - Minimum and maximum amount financed
   - Maximum backend product limits
   - Lender fees (as percentage)

3. **Vehicle Restrictions**:
   - Maximum vehicle age (in years)
   - Maximum mileage
   - Any excluded makes/models

4. **Vehicle Risk Adjustments**: Look for any make/model specific adjustments like:
   - Theft risk penalties (e.g., Kia/Hyundai 2011-2021)
   - Preferred make bonuses (e.g., Toyota, Honda)
   - Problem vehicle penalties (e.g., certain Nissan CVT models)

Output your extraction as valid JSON matching this structure:

{
  "tiers": [
    {
      "creditTier": "deep_subprime" | "subprime" | "near_prime" | "prime",
      "minApr": number,
      "maxApr": number,
      "minDownPercent": number,
      "baseAdvancePercent": number,
      "maxAdvancePercent": number,
      "maxLtvPercent": number
    }
  ],
  "allowedTerms": [36, 48, 60, 72],
  "minAmountFinanced": number,
  "maxAmountFinanced": number,
  "maxBackendTotal": number,
  "maxBackendPercent": number,
  "lenderFeePercent": number,
  "vehicleRestrictions": {
    "maxAgeYears": number,
    "maxMileage": number,
    "excludedMakes": ["string"]
  },
  "vehicleRiskAdjustments": [
    {
      "make": "string",
      "model": "string" (optional),
      "multiplier": number (e.g., 0.85 for 15% reduction, 1.05 for 5% bonus),
      "reason": "string",
      "yearRange": { "start": number, "end": number } (optional)
    }
  ],
  "extractionNotes": ["string"],
  "citedSections": ["string"]
}

If information is not found in the source, use reasonable industry defaults and note this in extractionNotes.

Standard defaults if not specified:
- maxVehicleAge: 15 years
- maxMileage: 150000
- lenderFeePercent: 2.5%
- maxBackendTotal: 3500
- maxBackendPercent: 25%

Credit tier APR ranges if not specified:
- deep_subprime: 22-28%
- subprime: 18-24%
- near_prime: 12-18%
- prime: 8-12%

IMPORTANT: Only output valid JSON. Do not include any markdown formatting or explanations outside the JSON.`;

async function extractWithGroq(content: string): Promise<any> {
  console.log('Sending to Groq for extraction...');

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: EXTRACTION_PROMPT,
        },
        {
          role: 'user',
          content: `Please extract the lender matrix from the following rate sheet:\n\n${content}`,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1, // Low temperature for more deterministic extraction
      max_tokens: 4096,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from Groq');
    }

    // Try to parse JSON from response
    // Sometimes the model includes markdown code blocks
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    return JSON.parse(jsonStr);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error('Failed to parse Groq response as JSON');
      throw error;
    }
    throw error;
  }
}

function buildLenderSchema(
  lenderName: string,
  extraction: any
): LenderSchema {
  const id = lenderName.toLowerCase().replace(/[^a-z0-9]+/g, '_');

  // Start with default schema
  const schema = createDefaultLenderSchema(id, lenderName);

  // Override with extracted values
  if (extraction.tiers && extraction.tiers.length > 0) {
    schema.tiers = extraction.tiers.map((tier: any) => ({
      creditTier: tier.creditTier,
      minApr: tier.minApr,
      maxApr: tier.maxApr,
      minDownPercent: tier.minDownPercent || 5,
      baseAdvancePercent: tier.baseAdvancePercent || 110,
      maxAdvancePercent: tier.maxAdvancePercent || 135,
      maxLtvPercent: tier.maxLtvPercent || 135,
    }));
  }

  if (extraction.allowedTerms) {
    schema.allowedTerms = extraction.allowedTerms;
  }

  if (extraction.minAmountFinanced) {
    schema.minAmountFinanced = extraction.minAmountFinanced;
  }

  if (extraction.maxAmountFinanced) {
    schema.maxAmountFinanced = extraction.maxAmountFinanced;
  }

  if (extraction.maxBackendTotal) {
    schema.maxBackendTotal = extraction.maxBackendTotal;
  }

  if (extraction.maxBackendPercent) {
    schema.maxBackendPercent = extraction.maxBackendPercent;
  }

  if (extraction.lenderFeePercent) {
    schema.lenderFeePercent = extraction.lenderFeePercent;
  }

  if (extraction.vehicleRestrictions) {
    schema.vehicleRestrictions = {
      maxAgeYears: extraction.vehicleRestrictions.maxAgeYears || 15,
      maxMileage: extraction.vehicleRestrictions.maxMileage || 150000,
      excludedMakes: extraction.vehicleRestrictions.excludedMakes || [],
    };
  }

  if (extraction.vehicleRiskAdjustments) {
    schema.vehicleRiskAdjustments = extraction.vehicleRiskAdjustments.map((adj: any) => ({
      make: adj.make,
      model: adj.model,
      multiplier: adj.multiplier,
      reason: adj.reason,
      yearRange: adj.yearRange,
    }));
  }

  // Mark as needing review
  schema.needsReview = true;
  schema.approved = false;
  schema.source = 'Groq extraction';

  // Add extraction notes
  if (extraction.extractionNotes) {
    schema.notes = [
      ...(schema.notes || []),
      'EXTRACTED BY GROQ - REQUIRES HUMAN REVIEW',
      ...extraction.extractionNotes,
    ];
  }

  if (extraction.citedSections) {
    schema.notes = [
      ...(schema.notes || []),
      'Source sections: ' + extraction.citedSections.join(', '),
    ];
  }

  return schema;
}

async function main() {
  console.log('Lender Matrix Extractor');
  console.log('=======================\n');

  // Read input file
  const inputPath = path.resolve(inputFile!);
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`Reading: ${inputPath}`);
  const content = fs.readFileSync(inputPath, 'utf-8');
  console.log(`Content length: ${content.length} characters\n`);

  // Extract using Groq
  const extraction = await extractWithGroq(content);
  console.log('\nExtraction complete!\n');

  // Build schema
  const schema = buildLenderSchema(lenderName!, extraction);

  // Validate schema
  const validation = validateLenderSchema(schema);
  console.log('Validation:');
  console.log(`  Valid: ${validation.isValid}`);

  if (validation.errors.length > 0) {
    console.log('  Errors:');
    validation.errors.forEach(e => console.log(`    - ${e}`));
  }

  if (validation.warnings.length > 0) {
    console.log('  Warnings:');
    validation.warnings.forEach(w => console.log(`    - ${w}`));
  }

  console.log();

  // Determine output path
  const defaultOutput = path.join(
    __dirname,
    '../shared/underwriting/lenders/config',
    `${schema.id}.json`
  );
  const outputPath = outputFile ? path.resolve(outputFile) : defaultOutput;

  // Check if file exists
  if (fs.existsSync(outputPath)) {
    console.log(`Warning: Output file already exists: ${outputPath}`);
    const backupPath = outputPath.replace('.json', `.backup-${Date.now()}.json`);
    fs.copyFileSync(outputPath, backupPath);
    console.log(`Backed up existing file to: ${backupPath}`);
  }

  // Write output
  fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2));
  console.log(`\nSchema written to: ${outputPath}`);

  // Summary
  console.log('\nExtracted Configuration:');
  console.log(`  Name: ${schema.name}`);
  console.log(`  ID: ${schema.id}`);
  console.log(`  Tiers: ${schema.tiers.length}`);
  console.log(`  Terms: ${schema.allowedTerms.join(', ')}`);
  console.log(`  Amount Range: $${schema.minAmountFinanced} - $${schema.maxAmountFinanced}`);
  console.log(`  Max LTV: ${Math.max(...schema.tiers.map(t => t.maxLtvPercent))}%`);
  console.log(`  Risk Adjustments: ${schema.vehicleRiskAdjustments.length}`);
  console.log(`  Excluded Makes: ${schema.vehicleRestrictions.excludedMakes.join(', ') || 'None'}`);

  console.log('\n========================================');
  console.log('IMPORTANT: This config is marked as needsReview=true');
  console.log('Please verify all values before setting approved=true');
  console.log('========================================');
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
