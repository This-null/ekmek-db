export class Validator {
  static isString(value: any): boolean {
    return typeof value === 'string';
  }

  static isNumber(value: any): boolean {
    return typeof value === 'number' && !isNaN(value);
  }

  static isArray(value: any): boolean {
    return Array.isArray(value);
  }

  static isObject(value: any): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  static hasRequiredKeys(obj: any, keys: string[]): boolean {
    if (!this.isObject(obj)) return false;
    return keys.every(key => key in obj);
  }
}