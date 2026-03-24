import { useAuth } from '../context/AuthContext';

export default function useCurrentUser() {
  const { currentUser } = useAuth();
  return currentUser;
}
