import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Input } from '../ui';
import {
  ALL_INDUSTRY_OPTIONS,
  CUSTOM_INDUSTRY_OPTION,
  INDUSTRY_MAX_LENGTH,
  INDUSTRY_PLACEHOLDER,
  isPredefinedIndustry,
  PREDEFINED_INDUSTRIES,
} from '../../constants/industries';

export interface IndustrySelectProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onClearError?: () => void;
  id?: string;
  selectId?: string;
  inputId?: string;
  disabled?: boolean;
  className?: string;
  selectClassName?: string;
  inputClassName?: string;
  label?: string;
  required?: boolean;
}

export const IndustrySelect: React.FC<IndustrySelectProps> = ({
  value,
  onChange,
  error,
  onClearError,
  selectId = 'industry-select',
  inputId = 'custom-industry-input',
  disabled = false,
  className = '',
  selectClassName = '',
  inputClassName = '',
  label,
  required = false,
}) => {
  // Determine initial selection mode from value
  const initialIsPredefined = isPredefinedIndustry(value);
  const [selectedOption, setSelectedOption] = useState<string>(() => {
    if (initialIsPredefined) return value.trim();
    if (value && value.trim().length > 0) return CUSTOM_INDUSTRY_OPTION;
    return PREDEFINED_INDUSTRIES[0];
  });

  const [customText, setCustomText] = useState<string>(() => {
    if (!initialIsPredefined && value && value.trim().length > 0) {
      return value.slice(0, INDUSTRY_MAX_LENGTH);
    }
    return '';
  });

  // Sync when value changes externally (e.g., campaign loaded or preset applied)
  useEffect(() => {
    const trimmedVal = (value || '').trim();
    if (isPredefinedIndustry(trimmedVal)) {
      setSelectedOption(trimmedVal);
    } else if (trimmedVal.length > 0) {
      setSelectedOption(CUSTOM_INDUSTRY_OPTION);
      setCustomText(trimmedVal.slice(0, INDUSTRY_MAX_LENGTH));
    }
  }, [value]);

  const isCustomSelected = selectedOption === CUSTOM_INDUSTRY_OPTION;

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newOption = e.target.value;
    setSelectedOption(newOption);
    onClearError?.();

    if (newOption === CUSTOM_INDUSTRY_OPTION) {
      // Switched to custom: pass current customText to parent
      onChange(customText);
    } else {
      // Switched to predefined: pass the predefined value immediately
      // Do NOT leak customText into the active value
      onChange(newOption);
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, INDUSTRY_MAX_LENGTH);
    setCustomText(val);
    onClearError?.();
    onChange(val);
  };

  const handleCustomBlur = () => {
    const trimmed = customText.trim();
    if (trimmed !== customText) {
      setCustomText(trimmed);
      onChange(trimmed);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-medium text-content-secondary mb-1.5"
        >
          {label} {required && <span className="text-destructive">*</span>}
        </label>
      )}

      <div>
        <select
          id={selectId}
          value={selectedOption}
          onChange={handleSelectChange}
          disabled={disabled}
          aria-label={label || 'Chọn ngành hàng'}
          className={`flex h-10 w-full rounded-admin border bg-recessed px-3 py-2 text-sm text-foreground leading-snug shadow-inset-well focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
            error && !isCustomSelected
              ? 'border-destructive focus-visible:ring-destructive'
              : 'border-input'
          } ${selectClassName}`}
        >
          {ALL_INDUSTRY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {isCustomSelected && (
        <div className="pt-0.5">
          <Input
            id={inputId}
            type="text"
            value={customText}
            onChange={handleCustomChange}
            onBlur={handleCustomBlur}
            disabled={disabled}
            placeholder={INDUSTRY_PLACEHOLDER}
            maxLength={INDUSTRY_MAX_LENGTH}
            aria-label="Tên ngành hàng tùy chỉnh"
            className={`${
              error ? 'border-destructive focus-visible:ring-destructive' : ''
            } ${inputClassName}`}
          />
        </div>
      )}

      {error && (
        <p className="mt-1.5 flex items-center text-xs text-destructive">
          <AlertCircle className="mr-1 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
};
