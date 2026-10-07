import { Select } from '@baseline/ui';
import { useSelection } from '../../../shared/lib';

/** The display currency (D11). The choice is the shell's, and every mounted remote gets it as new props. */
export function CurrencySelect() {
  const { currencies, currency, selectCurrency } = useSelection();
  return (
    <Select
      label="Currency"
      value={currency.code}
      onChange={(event) => {
        selectCurrency(event.target.value);
      }}
    >
      {currencies.map((option) => (
        <option key={option.code} value={option.code}>
          {option.code}
        </option>
      ))}
    </Select>
  );
}
