/**
 * Underwriting Engine - Main Export
 *
 * This module provides a deterministic, accurate calculation engine
 * for auto finance deal structuring.
 */

// Core types
export * from './types';

// Money handling
export * from './money';

// Payment calculations
export * from './payment';

// Book value estimation
export * from './bookValue';

// LTV calculations
export * from './ltv';

// Lender schema and loading
export * from './lenders/schema';
export * from './lenders/loader';

// Main engine
export * from './engine';

// Re-export commonly used functions at top level for convenience
export { calculatePayment } from './payment';
export { estimateBookValue, getBookValueForLtv } from './bookValue';
export { calculateLtv, computeLtv, checkLtvCap } from './ltv';
export { runEngine, assessRisk } from './engine';
export { loadLenderConfigs, getLenderConfigById } from './lenders/loader';
