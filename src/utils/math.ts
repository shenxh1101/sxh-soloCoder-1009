import type { Fraction } from '../types';

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

export function lcm(a: number, b: number): number {
  return (Math.abs(a) * Math.abs(b)) / gcd(a, b);
}

export function simplifyFraction(fraction: Fraction): Fraction {
  if (fraction.denominator === 0) {
    throw new Error('Denominator cannot be zero');
  }
  const divisor = gcd(fraction.numerator, fraction.denominator);
  let numerator = fraction.numerator / divisor;
  let denominator = fraction.denominator / divisor;
  if (denominator < 0) {
    numerator *= -1;
    denominator *= -1;
  }
  return { numerator, denominator };
}

export function areFractionsEquivalent(a: Fraction, b: Fraction): boolean {
  const simplifiedA = simplifyFraction(a);
  const simplifiedB = simplifyFraction(b);
  return (
    simplifiedA.numerator === simplifiedB.numerator &&
    simplifiedA.denominator === simplifiedB.denominator
  );
}

export function fractionToNumber(fraction: Fraction): number {
  return fraction.numerator / fraction.denominator;
}

export function numberToFraction(num: number, tolerance: number = 0.0001): Fraction {
  if (Number.isInteger(num)) {
    return { numerator: num, denominator: 1 };
  }
  let numerator = 1;
  let denominator = 1;
  let result = 1;
  while (Math.abs(result - num) > tolerance && denominator < 10000) {
    if (result < num) {
      numerator++;
    } else {
      denominator++;
      numerator = Math.round(num * denominator);
    }
    result = numerator / denominator;
  }
  return simplifyFraction({ numerator, denominator });
}

export function fractionToString(fraction: Fraction): string {
  const simplified = simplifyFraction(fraction);
  if (simplified.denominator === 1) {
    return simplified.numerator.toString();
  }
  return `${simplified.numerator}/${simplified.denominator}`;
}

export function parseFraction(str: string): Fraction | null {
  const fractionMatch = str.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1], 10);
    const denominator = parseInt(fractionMatch[2], 10);
    if (denominator === 0) return null;
    return { numerator, denominator };
  }
  const numberMatch = str.match(/^(-?\d+(\.\d+)?)$/);
  if (numberMatch) {
    const num = parseFloat(numberMatch[1]);
    return numberToFraction(num);
  }
  return null;
}

export function parseAnswer(
  answer: string
): number | Fraction | string {
  const fraction = parseFraction(answer);
  if (fraction) {
    return fraction;
  }
  const num = parseFloat(answer);
  if (!isNaN(num)) {
    return num;
  }
  return answer;
}

export function answersEqual(
  a: number | Fraction | string,
  b: number | Fraction | string,
  tolerance: number = 0.001
): boolean {
  const aIsFraction = typeof a === 'object' && 'numerator' in a;
  const bIsFraction = typeof b === 'object' && 'numerator' in b;

  if (aIsFraction && bIsFraction) {
    return areFractionsEquivalent(a as Fraction, b as Fraction);
  }

  const aNum = aIsFraction ? fractionToNumber(a as Fraction) : typeof a === 'number' ? a : parseFloat(a as string);
  const bNum = bIsFraction ? fractionToNumber(b as Fraction) : typeof b === 'number' ? b : parseFloat(b as string);

  if (!isNaN(aNum) && !isNaN(bNum)) {
    return Math.abs(aNum - bNum) < tolerance;
  }

  return String(a) === String(b);
}

export function extractUnit(text: string): { value: string; unit: string } | null {
  const match = text.match(/^(-?\d+(?:\.\d+)?(?:\/\d+)?)\s*([a-zA-Z\u4e00-\u9fa5°²³]+)?$/);
  if (match) {
    return {
      value: match[1],
      unit: match[2] || ''
    };
  }
  return null;
}

const unitAliases: { [key: string]: string } = {
  'cm': 'cm',
  'CM': 'cm',
  '厘米': 'cm',
  '公分': 'cm',
  'm': 'm',
  'M': 'm',
  '米': 'm',
  'dm': 'dm',
  'DM': 'dm',
  '分米': 'dm',
  'mm': 'mm',
  'MM': 'mm',
  '毫米': 'mm',
  'km': 'km',
  'KM': 'km',
  '千米': 'km',
  '公里': 'km',
  'cm²': 'cm²',
  'CM²': 'cm²',
  'cm2': 'cm²',
  'CM2': 'cm²',
  '平方厘米': 'cm²',
  '公分²': 'cm²',
  'm²': 'm²',
  'M²': 'm²',
  'm2': 'm²',
  'M2': 'm²',
  '平方米': 'm²',
  '平米': 'm²',
  'dm²': 'dm²',
  'DM²': 'dm²',
  'dm2': 'dm²',
  'DM2': 'dm²',
  '平方分米': 'dm²',
  'mm²': 'mm²',
  'MM²': 'mm²',
  'mm2': 'mm²',
  'MM2': 'mm²',
  '平方毫米': 'mm²',
  'km²': 'km²',
  'KM²': 'km²',
  'km2': 'km²',
  'KM2': 'km²',
  '平方千米': 'km²',
  '平方公里': 'km²',
  'cm³': 'cm³',
  'CM³': 'cm³',
  'cm3': 'cm³',
  'CM3': 'cm³',
  '立方厘米': 'cm³',
  'm³': 'm³',
  'M³': 'm³',
  'm3': 'm³',
  'M3': 'm³',
  '立方米': 'm³',
  '°': '°',
  '度': '°',
  '°C': '°C',
  '摄氏度': '°C',
  '%': '%',
  'percent': '%',
  '百分比': '%'
};

export function normalizeUnit(unit: string): string {
  const trimmed = unit.trim();
  if (!trimmed) return '';
  return unitAliases[trimmed] || trimmed;
}

export function unitsEqual(unit1: string, unit2: string): boolean {
  const norm1 = normalizeUnit(unit1);
  const norm2 = normalizeUnit(unit2);
  if (!norm1 || !norm2) return norm1 === norm2;
  return norm1 === norm2;
}

export function formatUnit(unit: string): string {
  const normalized = normalizeUnit(unit);
  const displayMap: { [key: string]: string } = {
    'cm²': 'cm²',
    'm²': 'm²',
    'dm²': 'dm²',
    'mm²': 'mm²',
    'km²': 'km²',
    'cm³': 'cm³',
    'm³': 'm³',
    '°': '°'
  };
  return displayMap[normalized] || normalized;
}
