import React, { useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { defaultCountries, FlagImage, parseCountry, usePhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';

const preferredCountries = ['ph', 'us', 'gb', 'ca', 'au', 'de', 'in', 'it', 'ch', 'ar'];
const countries = defaultCountries.map((countryData) => parseCountry(countryData));

interface PhoneNumberInputProps {
  id: string;
  name: string;
  value: string;
  onChange: (phoneNumber: string) => void;
  disabled?: boolean;
  autoComplete?: string;
}

export const PhoneNumberInput: React.FC<PhoneNumberInputProps> = ({
  id,
  name,
  value,
  onChange,
  disabled = false,
  autoComplete = 'tel',
}) => {
  const [isCountryListOpen, setIsCountryListOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const countryButtonRef = useRef<HTMLButtonElement>(null);

  const { inputValue, country, handlePhoneValueChange, setCountry } = usePhoneInput({
    defaultCountry: 'ph',
    value,
    countries: defaultCountries,
    preferredCountries,
    disableDialCodeAndPrefix: true,
    onChange: ({ phone }) => onChange(phone),
  });

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLocaleLowerCase();
    return countries
      .filter(
        (item) =>
          !query ||
          item.name.toLocaleLowerCase().includes(query) ||
          item.dialCode.includes(query.replace(/^\+/, '')) ||
          item.iso2.toLocaleLowerCase().includes(query)
      )
      .sort((left, right) => {
        const leftPriority = preferredCountries.indexOf(left.iso2);
        const rightPriority = preferredCountries.indexOf(right.iso2);
        if (leftPriority >= 0 || rightPriority >= 0) {
          if (leftPriority < 0) return 1;
          if (rightPriority < 0) return -1;
          return leftPriority - rightPriority;
        }
        return left.name.localeCompare(right.name);
      });
  }, [countries, countrySearch]);

  React.useEffect(() => {
    if (!isCountryListOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsCountryListOpen(false);
        setCountrySearch('');
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCountryListOpen(false);
        setCountrySearch('');
        countryButtonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCountryListOpen]);

  const selectCountry = (iso2: string) => {
    setCountry(iso2, { focusOnInput: true });
    setIsCountryListOpen(false);
    setCountrySearch('');
  };

  return (
    <div ref={containerRef} className="relative z-20">
      <div className="flex min-h-[50px] items-center rounded-2xl border border-[#DCE4EF] bg-[#F8FAFC] transition-colors focus-within:border-[#2459C4] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#2459C4]/20">
        <button
          ref={countryButtonRef}
          type="button"
          aria-label={`Select country, currently ${country.name} +${country.dialCode}`}
          aria-haspopup="listbox"
          aria-expanded={isCountryListOpen}
          disabled={disabled}
          onClick={() => setIsCountryListOpen((isOpen) => !isOpen)}
          className="ml-2.5 inline-flex h-10 shrink-0 items-center gap-1 rounded-xl px-2 text-sm text-[#17233B] hover:bg-[#EAF0FA] focus:outline-none focus:ring-2 focus:ring-[#2459C4]/40 disabled:opacity-60"
        >
          <FlagImage iso2={country.iso2} size="1.25rem" alt={`${country.name} flag`} disableLazyLoading />
          <span className="font-semibold">+{country.dialCode}</span>
          <ChevronDown
            className={`h-4 w-4 text-[#64748B] transition-transform ${isCountryListOpen ? 'rotate-180' : ''}`}
          />
        </button>
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          required
          disabled={disabled}
          value={inputValue}
          onChange={handlePhoneValueChange}
          placeholder="Phone number"
          aria-label="Phone number"
          className="min-w-0 flex-1 rounded-r-2xl border-0 bg-transparent px-2.5 py-3 text-sm text-[#17233B] outline-none placeholder:text-[#94A3B8] focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {isCountryListOpen && (
        <div className="absolute left-0 top-full z-[80] mt-2 w-full min-w-[270px] overflow-hidden rounded-2xl border border-[#1E3A78]/60 bg-[#171A21] p-2.5 text-white shadow-2xl shadow-[#060D1E]/40">
          <div className="relative mb-2">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              autoFocus
              aria-label="Search countries"
              placeholder="Search countries or code"
              value={countrySearch}
              onChange={(event) => setCountrySearch(event.target.value)}
              className="w-full rounded-xl border border-[#2459C4] bg-[#08132B] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-400/30"
            />
          </div>
          <ul role="listbox" aria-label="Countries" className="max-h-56 overflow-y-auto">
            {filteredCountries.length ? (
              filteredCountries.map((item) => (
                <li key={item.iso2} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={country.iso2 === item.iso2}
                    onClick={() => selectCountry(item.iso2)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                  >
                    <FlagImage iso2={item.iso2} size="1.25rem" alt="" disableLazyLoading />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="text-slate-300">+{item.dialCode}</span>
                    {country.iso2 === item.iso2 && <Check className="h-4 w-4 text-cyan-300" />}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-2.5 py-3 text-center text-xs text-slate-400">
                No matching countries
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
