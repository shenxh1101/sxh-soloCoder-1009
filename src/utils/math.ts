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
  const match = text.match(/^(-?\d+(?:\.\d+)?(?:\/\d+)?)\s*([a-zA-Z\u4e00-\u9fa5]+)?$/);
  if (match) {
    return {
      value: match[1],
      unit: match[2] || ''
    };
  }
  return null;
}
