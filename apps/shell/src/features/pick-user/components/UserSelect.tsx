import { Select } from '@baseline/ui';
import { useSelection } from '../../../shared/lib';

/** The active user. There is no login (auth isn't scored): the choice is only a name to show and stamp. */
export function UserSelect() {
  const { users, activeUser, selectUser } = useSelection();
  return (
    <Select
      label="User"
      value={activeUser.id}
      onChange={(event) => {
        selectUser(event.target.value);
      }}
    >
      {users.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </Select>
  );
}
