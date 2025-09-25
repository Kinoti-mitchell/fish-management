// Validation utilities for the Fish Management application

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ValidationRule {
  field: string;
  validator: (value: any) => boolean;
  message: string;
}

// Common validation functions
export const validators = {
  required: (value: any): boolean => {
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return !isNaN(value) && value > 0;
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined;
  },

  email: (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  phone: (value: string): boolean => {
    // Kenyan phone number format: +254XXXXXXXXX or 07XXXXXXXX
    const phoneRegex = /^(\+254|0)[17]\d{8}$/;
    return phoneRegex.test(value.replace(/\s/g, ''));
  },

  positiveNumber: (value: number): boolean => {
    return typeof value === 'number' && value > 0 && !isNaN(value);
  },

  nonNegativeNumber: (value: number): boolean => {
    return typeof value === 'number' && value >= 0 && !isNaN(value);
  },

  fishSize: (value: number): boolean => {
    return typeof value === 'number' && value >= 0 && value <= 10;
  },

  fishGrade: (value: string): boolean => {
    return ['A', 'B', 'C'].includes(value);
  },

  fishStatus: (value: string): boolean => {
    return ['received', 'processed', 'graded', 'stored', 'dispatched'].includes(value);
  },

  condition: (value: string): boolean => {
    return ['excellent', 'good', 'fair', 'poor'].includes(value);
  },

  orderStatus: (value: string): boolean => {
    return ['pending', 'confirmed', 'dispatched', 'completed'].includes(value);
  },

  dispatchStatus: (value: string): boolean => {
    return ['scheduled', 'in-transit', 'delivered'].includes(value);
  },

  minLength: (min: number) => (value: string): boolean => {
    return typeof value === 'string' && value.length >= min;
  },

  maxLength: (max: number) => (value: string): boolean => {
    return typeof value === 'string' && value.length <= max;
  },

  date: (value: string): boolean => {
    const date = new Date(value);
    return !isNaN(date.getTime());
  },

  futureDate: (value: string): boolean => {
    const date = new Date(value);
    return !isNaN(date.getTime()) && date > new Date();
  },

  pastDate: (value: string): boolean => {
    const date = new Date(value);
    return !isNaN(date.getTime()) && date <= new Date();
  }
};

// Validation schemas for different entities
export const validationSchemas = {
  fish: {
    size: [
      { validator: validators.required, message: 'Size is required' },
      { validator: validators.fishSize, message: 'Size must be between 0 and 10' }
    ],
    weight: [
      { validator: validators.required, message: 'Weight is required' },
      { validator: validators.positiveNumber, message: 'Weight must be a positive number' }
    ],
    grade: [
      { validator: validators.required, message: 'Grade is required' },
      { validator: validators.fishGrade, message: 'Grade must be A, B, or C' }
    ],
    status: [
      { validator: validators.required, message: 'Status is required' },
      { validator: validators.fishStatus, message: 'Invalid status' }
    ],
    farmerName: [
      { validator: validators.required, message: 'Farmer name is required' },
      { validator: validators.minLength(2), message: 'Farmer name must be at least 2 characters' }
    ],
    pricePerKg: [
      { validator: validators.required, message: 'Price per kg is required' },
      { validator: validators.positiveNumber, message: 'Price must be a positive number' }
    ]
  },

  warehouseEntry: {
    totalWeight: [
      { validator: validators.required, message: 'Total weight is required' },
      { validator: validators.positiveNumber, message: 'Total weight must be a positive number' }
    ],
    totalPieces: [
      { validator: validators.required, message: 'Total pieces is required' },
      { validator: validators.positiveNumber, message: 'Total pieces must be a positive number' }
    ],
    farmerName: [
      { validator: validators.required, message: 'Farmer name is required' },
      { validator: validators.minLength(2), message: 'Farmer name must be at least 2 characters' }
    ],
    farmerPhone: [
      { validator: validators.required, message: 'Farmer phone is required' },
      { validator: validators.phone, message: 'Invalid phone number format' }
    ],
    condition: [
      { validator: validators.required, message: 'Condition is required' },
      { validator: validators.condition, message: 'Invalid condition' }
    ],
    pricePerKg: [
      { validator: validators.required, message: 'Price per kg is required' },
      { validator: validators.positiveNumber, message: 'Price must be a positive number' }
    ]
  },

  outletOrder: {
    outletName: [
      { validator: validators.required, message: 'Outlet name is required' },
      { validator: validators.minLength(2), message: 'Outlet name must be at least 2 characters' }
    ],
    outletLocation: [
      { validator: validators.required, message: 'Outlet location is required' },
      { validator: validators.minLength(2), message: 'Outlet location must be at least 2 characters' }
    ],
    outletPhone: [
      { validator: validators.required, message: 'Outlet phone is required' },
      { validator: validators.phone, message: 'Invalid phone number format' }
    ],
    requestedQuantity: [
      { validator: validators.required, message: 'Requested quantity is required' },
      { validator: validators.positiveNumber, message: 'Requested quantity must be a positive number' }
    ],
    pricePerKg: [
      { validator: validators.required, message: 'Price per kg is required' },
      { validator: validators.positiveNumber, message: 'Price must be a positive number' }
    ]
  },

  user: {
    email: [
      { validator: validators.required, message: 'Email is required' },
      { validator: validators.email, message: 'Invalid email format' }
    ],
    password: [
      { validator: validators.required, message: 'Password is required' },
      { validator: validators.minLength(6), message: 'Password must be at least 6 characters' }
    ]
  }
};

// Main validation function
export const validate = (data: any, schema: any): ValidationResult => {
  const errors: string[] = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    
    for (const rule of rules as any[]) {
      if (!rule.validator(value)) {
        errors.push(rule.message);
        break; // Only show first error per field
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Sanitization functions
export const sanitizers = {
  trim: (value: string): string => value.trim(),
  
  toLowerCase: (value: string): string => value.toLowerCase(),
  
  toUpperCase: (value: string): string => value.toUpperCase(),
  
  removeSpaces: (value: string): string => value.replace(/\s/g, ''),
  
  formatPhone: (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.startsWith('254')) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('0')) {
      return `+254${cleaned.substring(1)}`;
    } else if (cleaned.startsWith('7')) {
      return `+254${cleaned}`;
    }
    return value;
  },
  
  roundToDecimal: (value: number, decimals: number = 2): number => {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  },
  
  formatDate: (value: string): string => {
    const date = new Date(value);
    return date.toISOString().split('T')[0];
  }
};

// Sanitize data based on field type
export const sanitizeData = (data: any, fieldTypes: Record<string, string>): any => {
  const sanitized = { ...data };
  
  for (const [field, type] of Object.entries(fieldTypes)) {
    const value = sanitized[field];
    
    if (typeof value === 'string') {
      switch (type) {
        case 'email':
          sanitized[field] = sanitizers.toLowerCase(sanitizers.trim(value));
          break;
        case 'phone':
          sanitized[field] = sanitizers.formatPhone(value);
          break;
        case 'name':
          sanitized[field] = sanitizers.trim(value);
          break;
        case 'text':
          sanitized[field] = sanitizers.trim(value);
          break;
      }
    } else if (typeof value === 'number') {
      switch (type) {
        case 'currency':
          sanitized[field] = sanitizers.roundToDecimal(value, 2);
          break;
        case 'weight':
          sanitized[field] = sanitizers.roundToDecimal(value, 2);
          break;
        case 'percentage':
          sanitized[field] = sanitizers.roundToDecimal(value, 1);
          break;
      }
    }
  }
  
  return sanitized;
};
