/**
 * Type definitions for Recharts chart components
 * These types help ensure type safety when working with chart event handlers and data
 */

/**
 * Base chart data point interface
 * Most charts use this or extend it
 */
export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number | undefined;
}

/**
 * Pie chart entry type
 * Used with Recharts PieChart component
 */
export interface PieChartEntry {
  name: string;
  value: number;
  fill?: string;
  percent?: number;
  payload?: ChartDataPoint;
  [key: string]: string | number | ChartDataPoint | undefined;
}

/**
 * Bar chart entry type
 * Used with Recharts BarChart component
 */
export interface BarChartEntry {
  name: string;
  value: number;
  fill?: string;
  payload?: ChartDataPoint;
  [key: string]: string | number | ChartDataPoint | undefined;
}

/**
 * Line chart entry type
 * Used with Recharts LineChart component
 */
export interface LineChartEntry {
  name: string;
  value: number;
  stroke?: string;
  payload?: ChartDataPoint;
  [key: string]: string | number | ChartDataPoint | undefined;
}

/**
 * Area chart entry type
 * Used with Recharts AreaChart component
 */
export interface AreaChartEntry {
  name: string;
  value: number;
  fill?: string;
  payload?: ChartDataPoint;
  [key: string]: string | number | ChartDataPoint | undefined;
}
